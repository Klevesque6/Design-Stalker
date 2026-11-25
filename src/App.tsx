import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Archive, ArrowLeft, ExternalLink, X } from 'lucide-react';
import type { AuditConfig, AuditReport, CrawlProgressEvent } from './types/audit';
import {
  clearAuditHistory,
  deleteAuditFromHistory,
  getAuditFromHistory,
  listAuditHistory,
  saveAuditToHistory,
  type SavedAuditMeta,
} from './lib/historyStore';
import { downloadZipBundle } from './lib/exporters';
import { AuditIntake } from './components/AuditIntake';
import { OverviewAndScreenshots } from './components/tabs/OverviewAndScreenshots';
import { UITab } from './components/tabs/UITab';
import { ComponentsTab } from './components/tabs/ComponentsTab';
import { IATab, IxDTab } from './components/tabs/IxDAndIATabs';
import { AccessibilityTab, TechStackTab, UXTab } from './components/tabs/UXA11yTechTabs';
import { ExportsStudio } from './components/ExportsStudio';
import { HistoryView } from './components/HistoryView';

type AppView = 'analyzer' | 'history' | 'exports';
type ReportTab = 'overview' | 'ui' | 'components' | 'ixd' | 'ia' | 'ux' | 'accessibility' | 'tech';

const REPORT_TABS: { key: ReportTab; label: string }[] = [
  { key: 'overview', label: 'Overview & AI' },
  { key: 'ui', label: 'UI' },
  { key: 'components', label: 'Components' },
  { key: 'ixd', label: 'IxD' },
  { key: 'ia', label: 'IA' },
  { key: 'ux', label: 'UX' },
  { key: 'accessibility', label: 'Accessibility' },
  { key: 'tech', label: 'Tech Stack' },
];

export default function App() {
  const [view, setView] = useState<AppView>('analyzer');
  const [activeReport, setActiveReport] = useState<AuditReport | null>(null);
  const [activeTab, setActiveTab] = useState<ReportTab>('overview');
  const [historyList, setHistoryList] = useState<SavedAuditMeta[]>([]);

  // Live SSE crawl state
  const [isCrawling, setIsCrawling] = useState(false);
  const [progress, setProgress] = useState<CrawlProgressEvent | null>(null);
  const [progressLog, setProgressLog] = useState<CrawlProgressEvent[]>([]);
  const [crawlError, setCrawlError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Lightbox image inspection
  const [lightbox, setLightbox] = useState<{ src: string; caption: string } | null>(null);
  const [isQuickZipping, setIsQuickZipping] = useState(false);
  const [isRetryingCritique, setIsRetryingCritique] = useState(false);

  const refreshHistory = useCallback(async () => {
    try {
      const items = await listAuditHistory();
      setHistoryList(items);
    } catch {
      // IndexedDB unavailable
    }
  }, []);

  useEffect(() => {
    refreshHistory();
  }, [refreshHistory]);

  const handleStartAudit = async (config: AuditConfig) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setActiveReport(null);
    setView('analyzer');
    setIsCrawling(true);
    setCrawlError(null);
    setProgressLog([]);
    setProgress({
      type: 'stage',
      stage: 'Connecting',
      message: `Initiating live crawl for ${config.url}`,
      percent: 2,
      pagesCompleted: 0,
      totalPagesTarget: config.maxPages,
    });

    try {
      const response = await fetch('/api/analyze/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        const errJson = await response.json().catch(() => ({ error: `Server returned HTTP ${response.status}` }));
        throw new Error(errJson.error || `Request failed with status ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const chunks = buffer.split('\n\n');
        buffer = chunks.pop() || '';

        for (const chunk of chunks) {
          const line = chunk
            .split('\n')
            .find((l) => l.startsWith('data: '));
          if (!line) continue;

          try {
            const evt = JSON.parse(line.slice(6)) as CrawlProgressEvent;
            if (evt.type === 'error') {
              setCrawlError(evt.error || evt.message || 'Crawl failed.');
              setIsCrawling(false);
              return;
            }
            setProgress(evt);
            if (evt.type === 'stage' || evt.type === 'page') {
              setProgressLog((prev) => [...prev.slice(-30), evt]);
            }
            if (evt.type === 'complete' && evt.report) {
              setActiveReport(evt.report);
              setActiveTab('overview');
              setIsCrawling(false);
              await saveAuditToHistory(evt.report).catch(() => undefined);
              await refreshHistory();
              return;
            }
          } catch {
            // Ignore malformed SSE line
          }
        }
      }
      setIsCrawling(false);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        setCrawlError('Crawl cancelled.');
      } else {
        setCrawlError(err instanceof Error ? err.message : 'Unable to complete website crawl.');
      }
      setIsCrawling(false);
    }
  };

  const handleCancelAudit = () => {
    abortRef.current?.abort();
    setIsCrawling(false);
  };

  const handleOpenSaved = async (id: string) => {
    const loaded = await getAuditFromHistory(id).catch(() => null);
    if (loaded) {
      setActiveReport(loaded);
      setActiveTab('overview');
      setView('analyzer');
      setCrawlError(null);
    }
  };

  const handleDeleteSaved = async (id: string) => {
    await deleteAuditFromHistory(id).catch(() => undefined);
    if (activeReport?.id === id) {
      setActiveReport(null);
    }
    await refreshHistory();
  };

  const handleClearHistory = async () => {
    await clearAuditHistory().catch(() => undefined);
    await refreshHistory();
  };

  const handleQuickZip = async () => {
    if (!activeReport) return;
    setIsQuickZipping(true);
    try {
      await downloadZipBundle(activeReport);
    } finally {
      setIsQuickZipping(false);
    }
  };

  const handleRetryCritique = async () => {
    if (!activeReport || isRetryingCritique) return;
    setIsRetryingCritique(true);
    try {
      const { aiCritique: _unused, ...payload } = activeReport;
      const res = await fetch('/api/critique', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const nextCritique = await res.json();
        const updated: AuditReport = { ...activeReport, aiCritique: nextCritique };
        setActiveReport(updated);
        await saveAuditToHistory(updated).catch(() => undefined);
        await refreshHistory();
      }
    } finally {
      setIsRetryingCritique(false);
    }
  };

  const handlePrimaryHeaderAction = () => {
    if (activeReport && view === 'analyzer') {
      setView('exports');
    } else {
      setActiveReport(null);
      setCrawlError(null);
      setView('analyzer');
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F5F0] text-[#1C1917] flex flex-col">
      {/* Top Bar Contract: 3 zones separated by gap-8 */}
      <header className="sticky top-0 z-30 bg-[#F8F5F0]/95 backdrop-blur-sm border-b border-[#E2DDD5] no-print">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Single wordmark */}
          <button
            type="button"
            onClick={() => {
              setView('analyzer');
            }}
            className="font-serif text-xl font-semibold tracking-tight text-[#1C1917] whitespace-nowrap shrink-0 cursor-pointer"
          >
            Monograph
          </button>

          {/* Zone 2: Clean single-line text navigation links */}
          <nav className="flex items-center gap-7 text-sm font-medium text-[#57534E]">
            <button
              type="button"
              onClick={() => setView('analyzer')}
              className={`py-5 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                view === 'analyzer'
                  ? 'border-[#1D3557] text-[#1C1917]'
                  : 'border-transparent hover:text-[#1C1917]'
              }`}
            >
              Analyzer
            </button>
            <button
              type="button"
              onClick={() => setView('history')}
              className={`py-5 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                view === 'history'
                  ? 'border-[#1D3557] text-[#1C1917]'
                  : 'border-transparent hover:text-[#1C1917]'
              }`}
            >
              Saved Audits
            </button>
            <button
              type="button"
              onClick={() => setView('exports')}
              disabled={!activeReport}
              className={`py-5 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                view === 'exports'
                  ? 'border-[#1D3557] text-[#1C1917]'
                  : 'border-transparent hover:text-[#1C1917]'
              }`}
            >
              Exports
            </button>
          </nav>

          {/* Zone 3: 1 primary action */}
          <div className="shrink-0">
            <button
              type="button"
              onClick={handlePrimaryHeaderAction}
              className="px-4 py-2 bg-[#1D3557] hover:bg-[#152843] text-white text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {activeReport && view === 'analyzer' ? 'Export Suite' : 'New Audit'}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        {view === 'history' && (
          <HistoryView
            audits={historyList}
            onOpen={handleOpenSaved}
            onDelete={handleDeleteSaved}
            onClearAll={handleClearHistory}
            onStartNew={() => {
              setActiveReport(null);
              setView('analyzer');
            }}
          />
        )}

        {view === 'exports' && activeReport && (
          <div className="max-w-7xl mx-auto px-6 py-10">
            <button
              type="button"
              onClick={() => setView('analyzer')}
              className="mb-6 inline-flex items-center gap-1.5 text-xs font-medium text-[#57534E] hover:text-[#1C1917] cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to {activeReport.domain} Dossier</span>
            </button>
            <ExportsStudio report={activeReport} />
          </div>
        )}

        {view === 'analyzer' && !activeReport && (
          <AuditIntake
            onStartAudit={handleStartAudit}
            onCancelAudit={handleCancelAudit}
            isCrawling={isCrawling}
            progress={progress}
            progressLog={progressLog}
            errorMessage={crawlError}
            recentAudits={historyList}
            onOpenSaved={handleOpenSaved}
            onDeleteSaved={handleDeleteSaved}
          />
        )}

        {view === 'analyzer' && activeReport && (
          <div className="max-w-7xl mx-auto px-6 py-8 lg:py-10">
            {/* Dossier Header */}
            <div className="pb-6 border-b border-[#E2DDD5] flex flex-col lg:flex-row lg:items-end justify-between gap-6">
              <div className="min-w-0">
                <div className="flex items-center gap-3 text-xs text-[#78716C] no-print">
                  <button
                    type="button"
                    onClick={() => setActiveReport(null)}
                    className="inline-flex items-center gap-1 text-[#1D3557] hover:underline font-medium cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>New URL</span>
                  </button>
                  <span>·</span>
                  <span className="font-mono tabular-nums">
                    Audited {new Date(activeReport.createdAt).toLocaleString()}
                  </span>
                </div>

                <h1 className="mt-2 font-serif text-3xl lg:text-4xl text-[#1C1917] truncate">
                  {activeReport.siteTitle || activeReport.domain}
                </h1>

                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#57534E]">
                  <a
                    href={activeReport.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-[#1D3557] hover:underline inline-flex items-center gap-1"
                  >
                    <span>{activeReport.url}</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums">
                    {activeReport.pages.length} {activeReport.pages.length === 1 ? 'page' : 'pages'} crawled
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums">{activeReport.components.length} components</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums">
                    WCAG {activeReport.accessibility.score}/100 ({activeReport.accessibility.grade})
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums">
                    {(activeReport.crawlDurationMs / 1000).toFixed(1)}s crawl
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0 no-print">
                <button
                  type="button"
                  onClick={() => setView('exports')}
                  className="h-10 px-4 bg-white border border-[#E2DDD5] hover:border-[#1D3557] text-[#1C1917] text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap"
                >
                  DESIGN.md &amp; Tokens
                </button>
                <button
                  type="button"
                  onClick={handleQuickZip}
                  disabled={isQuickZipping}
                  className="h-10 px-4 bg-[#1D3557] hover:bg-[#152843] disabled:opacity-60 text-white text-xs font-medium rounded-md inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <Archive className="w-3.5 h-3.5" />
                  <span>{isQuickZipping ? 'Zipping...' : 'Download ZIP Bundle'}</span>
                </button>
              </div>
            </div>

            {/* 8-Tab Analysis Navigation Bar */}
            <div className="mt-6 border-b border-[#E2DDD5] overflow-x-auto no-print">
              <div className="flex items-center gap-1 min-w-max">
                {REPORT_TABS.map((tab) => {
                  const active = activeTab === tab.key;
                  return (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setActiveTab(tab.key)}
                      className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        active
                          ? 'border-[#1D3557] text-[#1C1917]'
                          : 'border-transparent text-[#57534E] hover:text-[#1C1917]'
                      }`}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Active Tab Panel */}
            <div className="mt-8">
              {activeTab === 'overview' && (
                <OverviewAndScreenshots
                  report={activeReport}
                  onInspectImage={(src, caption) => setLightbox({ src, caption })}
                  onRetryCritique={handleRetryCritique}
                  isRetryingCritique={isRetryingCritique}
                />
              )}
              {activeTab === 'ui' && <UITab ui={activeReport.ui} />}
              {activeTab === 'components' && (
                <ComponentsTab
                  components={activeReport.components}
                  onInspectImage={(src, caption) => setLightbox({ src, caption })}
                />
              )}
              {activeTab === 'ixd' && <IxDTab ixd={activeReport.ixd} />}
              {activeTab === 'ia' && <IATab ia={activeReport.ia} />}
              {activeTab === 'ux' && (
                <UXTab
                  ux={activeReport.ux}
                  report={activeReport}
                  onInspectImage={(src, caption) => setLightbox({ src, caption })}
                />
              )}
              {activeTab === 'accessibility' && (
                <AccessibilityTab accessibility={activeReport.accessibility} />
              )}
              {activeTab === 'tech' && (
                <TechStackTab
                  techStack={activeReport.techStack}
                  stylesheetUrls={activeReport.rawArtifacts.stylesheetUrls}
                />
              )}
            </div>
          </div>
        )}
      </main>

      {/* Quiet Editorial Footer */}
      <footer className="border-t border-[#E2DDD5] mt-16 py-6 no-print">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#78716C]">
          <span>Monograph — Architectural UI/UX Website Analyzer</span>
          <span>Real headless browser extraction · Local IndexedDB history</span>
        </div>
      </footer>

      {/* Full-Screen Screenshot Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-[#1C1917]/85 p-6 flex flex-col items-center justify-center no-print"
          onClick={() => setLightbox(null)}
        >
          <div
            className="max-w-6xl w-full max-h-[90vh] bg-white rounded-lg border border-[#E2DDD5] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-3.5 border-b border-[#E2DDD5] flex items-center justify-between gap-4 bg-[#FAF8F4]">
              <span className="text-xs font-mono text-[#1C1917] truncate">{lightbox.caption}</span>
              <button
                type="button"
                onClick={() => setLightbox(null)}
                aria-label="Close screenshot preview"
                className="p-1 text-[#57534E] hover:text-[#1C1917] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 bg-[#EFECE6] overflow-auto flex justify-center">
              <img
                src={lightbox.src}
                alt={lightbox.caption}
                referrerPolicy="no-referrer"
                className="max-w-full h-auto rounded border border-[#D6CFC4] bg-white"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

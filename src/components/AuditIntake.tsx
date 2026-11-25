import React, { useState } from 'react';
import {
  ArrowRight,
  Clock,
  Globe,
  Layers,
  Loader2,
  Monitor,
  Smartphone,
  Square,
  Tablet,
  Trash2,
} from 'lucide-react';
import type { AuditConfig, CrawlProgressEvent, ViewportKey } from '../types/audit';
import type { SavedAuditMeta } from '../lib/historyStore';

interface AuditIntakeProps {
  onStartAudit: (config: AuditConfig) => void;
  onCancelAudit: () => void;
  isCrawling: boolean;
  progress: CrawlProgressEvent | null;
  progressLog: CrawlProgressEvent[];
  errorMessage: string | null;
  recentAudits: SavedAuditMeta[];
  onOpenSaved: (id: string) => void;
  onDeleteSaved: (id: string) => void;
}

const SAMPLE_SITES = [
  { label: 'example.com', url: 'https://example.com', pages: 1 },
  { label: 'stripe.com', url: 'https://stripe.com', pages: 5 },
  { label: 'linear.app', url: 'https://linear.app', pages: 5 },
  { label: 'vercel.com', url: 'https://vercel.com', pages: 5 },
];

const VIEWPORT_OPTIONS: { key: ViewportKey; label: string; width: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: 'desktop', label: 'Desktop', width: '1440px', icon: Monitor },
  { key: 'tablet', label: 'Tablet', width: '768px', icon: Tablet },
  { key: 'phone', label: 'Phone', width: '390px', icon: Smartphone },
];

export function AuditIntake({
  onStartAudit,
  onCancelAudit,
  isCrawling,
  progress,
  progressLog,
  errorMessage,
  recentAudits,
  onOpenSaved,
  onDeleteSaved,
}: AuditIntakeProps) {
  const [url, setUrl] = useState('');
  const [maxPages, setMaxPages] = useState(10);
  const [viewports, setViewports] = useState<ViewportKey[]>(['desktop', 'tablet', 'phone']);

  const toggleViewport = (key: ViewportKey) => {
    setViewports((prev) => {
      if (prev.includes(key)) {
        if (prev.length === 1) return prev; // Keep at least one viewport selected
        return prev.filter((v) => v !== key);
      }
      return [...prev, key];
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim() || isCrawling) return;
    onStartAudit({ url: url.trim(), maxPages, viewports });
  };

  const runSample = (sampleUrl: string, samplePages: number) => {
    setUrl(sampleUrl);
    setMaxPages(samplePages);
    onStartAudit({ url: sampleUrl, maxPages: samplePages, viewports });
  };

  return (
    <div className="max-w-5xl mx-auto px-6 py-12 lg:py-16">
      {/* Editorial Header */}
      <div className="max-w-3xl">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-[#78716C]">
          Front-End Architecture &amp; Design System Dossier
        </p>
        <h1 className="mt-3 font-serif text-4xl lg:text-5xl font-normal tracking-tight text-[#1C1917] leading-[1.12]">
          Deconstruct any live website into exact design tokens and UX evidence.
        </h1>
        <p className="mt-4 text-base text-[#57534E] leading-relaxed max-w-2xl">
          Enter a public URL. Monograph loads the site in a real headless Chromium browser, crawls key flows across
          phone, tablet, and desktop widths, measures computed styles and WCAG contrast, and compiles a reusable design
          specification.
        </p>
      </div>

      {/* Main Intake Form Surface */}
      <form
        onSubmit={handleSubmit}
        className="mt-10 bg-white border border-[#E2DDD5] rounded-lg p-6 lg:p-8"
      >
        <label htmlFor="target-url" className="block text-sm font-medium text-[#1C1917]">
          Website URL
        </label>
        <div className="mt-2.5 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Globe className="w-4 h-4 text-[#78716C] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              id="target-url"
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={isCrawling}
              placeholder="https://linear.app or stripe.com"
              className="w-full h-12 pl-10 pr-4 bg-[#F8F5F0] border border-[#E2DDD5] rounded-md text-[15px] text-[#1C1917] placeholder:text-[#A8A29E] focus:outline-none focus:bg-white focus:border-[#1D3557] transition-colors disabled:opacity-60 font-mono"
            />
          </div>
          {!isCrawling ? (
            <button
              type="submit"
              disabled={!url.trim()}
              className="h-12 px-6 bg-[#1D3557] hover:bg-[#152843] disabled:bg-[#A8A29E] text-white text-sm font-medium rounded-md inline-flex items-center justify-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:cursor-not-allowed"
            >
              <span>Analyze Website</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={onCancelAudit}
              className="h-12 px-6 bg-[#1C1917] hover:bg-[#292524] text-white text-sm font-medium rounded-md inline-flex items-center justify-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>Stop Crawl</span>
            </button>
          )}
        </div>

        {/* Configuration Controls */}
        <div className="mt-6 pt-6 border-t border-[#E2DDD5] grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
          {/* Pages to Crawl */}
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-[0.08em] text-[#57534E]">
                Pages to Crawl
              </span>
              <span className="text-xs font-mono tabular-nums text-[#1C1917] font-medium">
                {maxPages} {maxPages === 1 ? 'page' : 'pages'}
              </span>
            </div>
            <div className="mt-2.5 flex items-center gap-3">
              <input
                type="range"
                min={1}
                max={15}
                value={maxPages}
                disabled={isCrawling}
                onChange={(e) => setMaxPages(Number(e.target.value))}
                aria-label="Maximum pages to crawl"
                className="flex-1 accent-[#1D3557] cursor-pointer"
              />
              <div className="flex items-center gap-1 bg-[#EFECE6] p-1 rounded-md">
                {[1, 5, 10, 15].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    disabled={isCrawling}
                    onClick={() => setMaxPages(preset)}
                    className={`px-2.5 py-1 text-xs font-mono tabular-nums rounded transition-colors cursor-pointer ${
                      maxPages === preset
                        ? 'bg-white text-[#1C1917] font-medium border border-[#E2DDD5]'
                        : 'text-[#57534E] hover:text-[#1C1917]'
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>
            <p className="mt-1.5 text-xs text-[#78716C]">
              Prioritizes home, product, pricing, signup, and checkout paths automatically.
            </p>
          </div>

          {/* Screen Sizes */}
          <div>
            <span className="block text-xs font-medium uppercase tracking-[0.08em] text-[#57534E]">
              Screen Sizes to Capture
            </span>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {VIEWPORT_OPTIONS.map(({ key, label, width, icon: Icon }) => {
                const active = viewports.includes(key);
                return (
                  <button
                    key={key}
                    type="button"
                    disabled={isCrawling}
                    onClick={() => toggleViewport(key)}
                    className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-md text-xs font-medium border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      active
                        ? 'bg-[#1D3557] text-white border-[#1D3557]'
                        : 'bg-[#F8F5F0] text-[#57534E] border-[#E2DDD5] hover:border-[#A8A29E] hover:text-[#1C1917]'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{label}</span>
                    <span className={`font-mono tabular-nums ${active ? 'text-white/75' : 'text-[#78716C]'}`}>
                      {width}
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="mt-1.5 text-xs text-[#78716C]">
              Captures full-page responsive screenshots plus element crops for key components.
            </p>
          </div>
        </div>

        {/* Sample quick-start links */}
        {!isCrawling && (
          <div className="mt-5 pt-4 border-t border-[#EFECE6] flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-[#78716C]">
            <span>Try live audit:</span>
            {SAMPLE_SITES.map((s) => (
              <button
                key={s.label}
                type="button"
                onClick={() => runSample(s.url, s.pages)}
                className="font-mono text-[#1D3557] hover:underline underline-offset-4 cursor-pointer whitespace-nowrap"
              >
                {s.label} ({s.pages}p)
              </button>
            ))}
          </div>
        )}
      </form>

      {/* Error Notice */}
      {errorMessage && (
        <div className="mt-6 bg-white border border-[#B91C1C]/35 rounded-lg p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-[#B91C1C]">Crawl Could Not Complete</p>
              <p className="mt-1 text-sm text-[#57534E]">{errorMessage}</p>
            </div>
          </div>
        </div>
      )}

      {/* Live Streaming Progress Console */}
      {isCrawling && progress && (
        <div className="mt-8 bg-white border border-[#E2DDD5] rounded-lg p-6 lg:p-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <Loader2 className="w-4 h-4 text-[#1D3557] animate-spin shrink-0" />
              <h2 className="font-serif text-xl text-[#1C1917]">{progress.stage || 'Running Live Audit'}</h2>
            </div>
            <div className="text-sm font-mono tabular-nums text-[#1D3557] font-medium">
              {progress.percent}%
              {typeof progress.pagesCompleted === 'number' && typeof progress.totalPagesTarget === 'number'
                ? ` · ${progress.pagesCompleted}/${progress.totalPagesTarget} pages`
                : ''}
            </div>
          </div>

          <div className="mt-4 h-1.5 w-full bg-[#EFECE6] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#1D3557] transition-all duration-300 ease-out"
              style={{ width: `${Math.max(4, progress.percent)}%` }}
            />
          </div>

          <p className="mt-3 text-sm text-[#57534E]">{progress.message}</p>

          {progressLog.length > 0 && (
            <div className="mt-5 pt-4 border-t border-[#EFECE6] max-h-52 overflow-y-auto space-y-2">
              {progressLog.map((item, idx) => (
                <div
                  key={`${item.stage}-${idx}`}
                  className="flex items-baseline justify-between gap-4 text-xs"
                >
                  <div className="flex items-baseline gap-2.5 min-w-0">
                    <span className="font-mono tabular-nums text-[#78716C] shrink-0">
                      {String(idx + 1).padStart(2, '0')}
                    </span>
                    <span className="font-medium text-[#1C1917] shrink-0">{item.stage}</span>
                    <span className="text-[#57534E] truncate">{item.message}</span>
                  </div>
                  <span className="font-mono tabular-nums text-[#78716C] shrink-0">{item.percent}%</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Architectural Capability Index (when idle) */}
      {!isCrawling && (
        <div className="mt-14 pt-10 border-t border-[#E2DDD5] grid grid-cols-1 md:grid-cols-3 gap-10">
          <div>
            <p className="text-xs font-mono text-[#78716C]">01. Collection</p>
            <h3 className="mt-2 font-serif text-lg text-[#1C1917]">Real Browser Extraction</h3>
            <p className="mt-2 text-sm text-[#57534E] leading-relaxed">
              Headless Chromium renders full client-side JavaScript, computes rendered styles, probes live hover states,
              and captures phone, tablet, and desktop screenshots.
            </p>
          </div>
          <div>
            <p className="text-xs font-mono text-[#78716C]">02. Seven-Tab Audit</p>
            <h3 className="mt-2 font-serif text-lg text-[#1C1917]">Deterministic + AI Critique</h3>
            <p className="mt-2 text-sm text-[#57534E] leading-relaxed">
              Inspect exact color frequencies, cropped components, transitions, visual sitemaps, UX flows, WCAG contrast
              ratios, tech stack, and grounded AI recommendations.
            </p>
          </div>
          <div>
            <p className="text-xs font-mono text-[#78716C]">03. Reusable Outputs</p>
            <h3 className="mt-2 font-serif text-lg text-[#1C1917]">Drop-In System Artifacts</h3>
            <p className="mt-2 text-sm text-[#57534E] leading-relaxed">
              Export <span className="font-mono text-xs">DESIGN.md</span>,{' '}
              <span className="font-mono text-xs">tokens.json</span>,{' '}
              <span className="font-mono text-xs">tailwind.config.ts</span>, component screenshot packs, print PDF, or a
              single ZIP bundle.
            </p>
          </div>
        </div>
      )}

      {/* Recent Local Browser History */}
      {!isCrawling && recentAudits.length > 0 && (
        <div className="mt-14 pt-10 border-t border-[#E2DDD5]">
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="font-serif text-2xl text-[#1C1917]">Recent Local Audits</h2>
            <span className="text-xs text-[#78716C] font-mono tabular-nums">
              {recentAudits.length} saved in browser
            </span>
          </div>
          <div className="bg-white border border-[#E2DDD5] rounded-lg divide-y divide-[#EFECE6]">
            {recentAudits.slice(0, 6).map((audit) => (
              <div
                key={audit.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-5 py-4 hover:bg-[#FAF8F4] transition-colors"
              >
                <button
                  type="button"
                  onClick={() => onOpenSaved(audit.id)}
                  className="flex items-center gap-4 text-left min-w-0 flex-1 cursor-pointer"
                >
                  {audit.thumbnailDataUrl ? (
                    <img
                      src={audit.thumbnailDataUrl}
                      alt={`${audit.domain} preview`}
                      referrerPolicy="no-referrer"
                      className="w-16 h-11 object-cover object-top rounded border border-[#E2DDD5] shrink-0 bg-[#EFECE6]"
                    />
                  ) : (
                    <div className="w-16 h-11 rounded border border-[#E2DDD5] bg-[#EFECE6] flex items-center justify-center shrink-0">
                      <Layers className="w-4 h-4 text-[#78716C]" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#1C1917] truncate">{audit.domain}</p>
                    <p className="mt-0.5 text-xs text-[#78716C] truncate">
                      {audit.pagesCount} {audit.pagesCount === 1 ? 'page' : 'pages'} · {audit.componentsCount}{' '}
                      components · WCAG {audit.accessibilityScore}/100 ({audit.accessibilityGrade})
                    </p>
                  </div>
                </button>
                <div className="flex items-center gap-4 shrink-0">
                  <span className="text-xs text-[#78716C] font-mono tabular-nums inline-flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    {new Date(audit.createdAt).toLocaleDateString()}
                  </span>
                  <button
                    type="button"
                    onClick={() => onOpenSaved(audit.id)}
                    className="text-xs font-medium text-[#1D3557] hover:underline underline-offset-4 cursor-pointer whitespace-nowrap"
                  >
                    Open Report
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteSaved(audit.id)}
                    aria-label={`Delete audit for ${audit.domain}`}
                    className="p-1.5 text-[#78716C] hover:text-[#B91C1C] transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

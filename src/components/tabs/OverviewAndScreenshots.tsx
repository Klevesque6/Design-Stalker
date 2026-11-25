import React, { useState } from 'react';
import { AlertTriangle, Download, Maximize2, Monitor, RefreshCw, Smartphone, Tablet } from 'lucide-react';
import type { AuditReport, ViewportKey } from '../../types/audit';

interface OverviewAndScreenshotsProps {
  report: AuditReport;
  onInspectImage: (src: string, caption: string) => void;
  onRetryCritique: () => void;
  isRetryingCritique: boolean;
}

export function OverviewAndScreenshots({
  report,
  onInspectImage,
  onRetryCritique,
  isRetryingCritique,
}: OverviewAndScreenshotsProps) {
  const [selectedPageIdx, setSelectedPageIdx] = useState(0);
  const availableViewports: ViewportKey[] = ['desktop', 'tablet', 'phone'];
  const currentPage = report.pages[selectedPageIdx] || report.pages[0];

  const firstAvailableVp =
    availableViewports.find((vp) => currentPage?.screenshots?.[vp]) || 'desktop';
  const [selectedViewport, setSelectedViewport] = useState<ViewportKey>(firstAvailableVp);

  const activeShot =
    currentPage?.screenshots?.[selectedViewport] ||
    currentPage?.screenshots?.desktop ||
    currentPage?.screenshots?.tablet ||
    currentPage?.screenshots?.phone;

  const downloadShot = () => {
    if (!activeShot?.dataUrl) return;
    const a = document.createElement('a');
    a.href = activeShot.dataUrl;
    a.download = `${report.domain}-${currentPage.archetype}-${activeShot.viewport}.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="space-y-12">
      {/* Grounded AI Critique Section */}
      <section className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 pb-4 border-b border-[#E2DDD5]">
          <div>
            <p className="text-xs font-mono text-[#78716C]">Grounded Synthesis</p>
            <h2 className="mt-1 font-serif text-2xl text-[#1C1917]">Design &amp; UX Critique</h2>
          </div>
          <p className="text-xs text-[#78716C]">
            Derived strictly from extracted styles, DOM metrics, WCAG calculations, and captured screenshots
          </p>
        </div>

        {report.aiCritique.status === 'error' ? (
          <div className="bg-white border border-[#B45309]/40 rounded-lg p-6">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-[#B45309] shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-semibold text-[#1C1917]">AI Critique Unavailable</h3>
                  <p className="mt-1 text-sm text-[#57534E]">
                    {report.aiCritique.errorMessage || 'Could not generate AI design critique for this audit.'}
                  </p>
                  <p className="mt-2 text-xs text-[#78716C]">
                    All seven deterministic technical audit tabs, component crops, screenshots, and code exports remain
                    fully available.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onRetryCritique}
                disabled={isRetryingCritique}
                className="h-9 px-3.5 bg-[#1D3557] hover:bg-[#152843] disabled:opacity-60 text-white text-xs font-medium rounded-md inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRetryingCritique ? 'animate-spin' : ''}`} />
                <span>{isRetryingCritique ? 'Retrying...' : 'Retry AI Critique'}</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Executive Summary */}
            <div className="bg-white border border-[#E2DDD5] rounded-lg p-6 lg:p-8">
              <p className="text-xs uppercase tracking-[0.12em] text-[#78716C]">Executive Assessment</p>
              <p className="mt-3 font-serif text-xl lg:text-2xl text-[#1C1917] leading-relaxed max-w-4xl">
                {report.aiCritique.executiveSummary}
              </p>
              {report.aiCritique.designPhilosophy && (
                <p className="mt-4 pt-4 border-t border-[#EFECE6] text-sm text-[#57534E] leading-relaxed max-w-3xl">
                  <span className="font-semibold text-[#1C1917]">Design Language: </span>
                  {report.aiCritique.designPhilosophy}
                </p>
              )}
            </div>

            {/* Two-column Strengths vs Weak Spots */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-white border border-[#E2DDD5] rounded-lg p-6">
                <h3 className="font-serif text-lg text-[#1C1917] pb-3 border-b border-[#EFECE6]">
                  Why the Design Works
                </h3>
                <div className="mt-4 divide-y divide-[#EFECE6]">
                  {report.aiCritique.whyItWorks.map((item, idx) => (
                    <div key={idx} className="py-4 first:pt-0 last:pb-0">
                      <p className="text-sm font-semibold text-[#1C1917]">{item.title}</p>
                      <p className="mt-1 text-sm text-[#57534E] leading-relaxed">{item.detail}</p>
                      <p className="mt-2 text-xs font-mono text-[#1D3557]">Evidence: {item.evidence}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white border border-[#E2DDD5] rounded-lg p-6">
                <h3 className="font-serif text-lg text-[#1C1917] pb-3 border-b border-[#EFECE6]">
                  UX &amp; Accessibility Weak Spots
                </h3>
                <div className="mt-4 divide-y divide-[#EFECE6]">
                  {report.aiCritique.uxWeakSpots.map((item, idx) => (
                    <div key={idx} className="py-4 first:pt-0 last:pb-0">
                      <p className="text-sm font-semibold text-[#1C1917]">{item.title}</p>
                      <p className="mt-1 text-sm text-[#57534E] leading-relaxed">{item.detail}</p>
                      <p className="mt-2 text-xs text-[#B45309] font-medium">Impact: {item.impact}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Prioritized Improvements Table */}
            <div className="bg-white border border-[#E2DDD5] rounded-lg overflow-hidden">
              <div className="px-6 py-4 border-b border-[#E2DDD5]">
                <h3 className="font-serif text-lg text-[#1C1917]">Prioritized Recommendations</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[#E2DDD5] bg-[#FAF8F4] text-xs font-medium text-[#57534E]">
                      <th className="py-3 px-5 w-24">Priority</th>
                      <th className="py-3 px-4 w-28">Domain</th>
                      <th className="py-3 px-4">Recommendation &amp; Rationale</th>
                      <th className="py-3 px-5">Concrete Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EFECE6] text-sm">
                    {report.aiCritique.improvements.map((imp, idx) => {
                      const prioColor =
                        imp.priority === 'high'
                          ? 'text-[#B91C1C]'
                          : imp.priority === 'medium'
                            ? 'text-[#B45309]'
                            : 'text-[#15803D]';
                      return (
                        <tr key={idx} className="align-top hover:bg-[#FAF8F4]/70">
                          <td className={`py-4 px-5 font-mono text-xs uppercase font-medium ${prioColor}`}>
                            {imp.priority}
                          </td>
                          <td className="py-4 px-4 text-xs text-[#57534E] font-medium">{imp.category}</td>
                          <td className="py-4 px-4">
                            <p className="font-medium text-[#1C1917]">{imp.title}</p>
                            <p className="mt-1 text-xs text-[#57534E] leading-relaxed">{imp.rationale}</p>
                          </td>
                          <td className="py-4 px-5 text-xs font-mono text-[#1D3557] leading-relaxed">
                            {imp.action}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Responsive Full-Page Screenshot Gallery */}
      <section className="space-y-5 print-break-inside-avoid">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-4 border-b border-[#E2DDD5]">
          <div>
            <p className="text-xs font-mono text-[#78716C]">Multi-Viewport Capture</p>
            <h2 className="mt-1 font-serif text-2xl text-[#1C1917]">Responsive Page Screenshots</h2>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Page selector */}
            <select
              value={selectedPageIdx}
              onChange={(e) => {
                const idx = Number(e.target.value);
                setSelectedPageIdx(idx);
                const nextP = report.pages[idx];
                if (nextP && !nextP.screenshots[selectedViewport]) {
                  const fallback = availableViewports.find((v) => nextP.screenshots[v]);
                  if (fallback) setSelectedViewport(fallback);
                }
              }}
              aria-label="Select crawled page"
              className="h-9 px-3 bg-white border border-[#E2DDD5] rounded-md text-xs font-mono text-[#1C1917] focus:outline-none focus:border-[#1D3557]"
            >
              {report.pages.map((p, idx) => (
                <option key={p.url} value={idx}>
                  {p.path} ({p.archetype})
                </option>
              ))}
            </select>

            {/* Viewport switcher */}
            <div className="inline-flex items-center bg-[#EFECE6] p-1 rounded-md">
              {([
                { key: 'desktop', label: 'Desktop', icon: Monitor },
                { key: 'tablet', label: 'Tablet', icon: Tablet },
                { key: 'phone', label: 'Phone', icon: Smartphone },
              ] as const).map(({ key, label, icon: Icon }) => {
                const hasShot = Boolean(currentPage?.screenshots?.[key]);
                const active = activeShot?.viewport === key;
                return (
                  <button
                    key={key}
                    type="button"
                    disabled={!hasShot}
                    onClick={() => setSelectedViewport(key)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                      active
                        ? 'bg-white text-[#1C1917] border border-[#E2DDD5]'
                        : 'text-[#57534E] hover:text-[#1C1917]'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{label}</span>
                  </button>
                );
              })}
            </div>

            {activeShot && (
              <button
                type="button"
                onClick={downloadShot}
                className="h-9 px-3 bg-white border border-[#E2DDD5] hover:border-[#1D3557] rounded-md text-xs font-medium text-[#1C1917] inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Save JPG</span>
              </button>
            )}
          </div>
        </div>

        {activeShot ? (
          <div className="bg-[#EFECE6] border border-[#E2DDD5] rounded-lg p-6 flex flex-col items-center">
            <div className="w-full flex items-center justify-between text-xs text-[#57534E] mb-4">
              <span className="font-mono">
                {currentPage.path} · {activeShot.width}px width · full height {activeShot.fullHeight}px
              </span>
              <button
                type="button"
                onClick={() =>
                  onInspectImage(
                    activeShot.dataUrl,
                    `${report.domain}${currentPage.path} (${activeShot.viewport} — ${activeShot.width}px)`
                  )
                }
                className="inline-flex items-center gap-1.5 text-[#1D3557] hover:underline font-medium cursor-pointer"
              >
                <Maximize2 className="w-3.5 h-3.5" />
                <span>Inspect Full Size</span>
              </button>
            </div>
            <div
              className={`bg-white border border-[#D6CFC4] rounded overflow-hidden max-h-[620px] overflow-y-auto ${
                activeShot.viewport === 'phone'
                  ? 'max-w-[390px] w-full'
                  : activeShot.viewport === 'tablet'
                    ? 'max-w-[768px] w-full'
                    : 'w-full'
              }`}
            >
              <img
                src={activeShot.dataUrl}
                alt={`${report.domain} ${currentPage.path} ${activeShot.viewport} screenshot`}
                referrerPolicy="no-referrer"
                onClick={() =>
                  onInspectImage(
                    activeShot.dataUrl,
                    `${report.domain}${currentPage.path} (${activeShot.viewport} — ${activeShot.width}px)`
                  )
                }
                className="w-full h-auto block cursor-zoom-in"
              />
            </div>
          </div>
        ) : (
          <div className="bg-white border border-[#E2DDD5] rounded-lg p-8 text-center text-sm text-[#78716C]">
            No screenshot captured for this page and viewport.
          </div>
        )}
      </section>
    </div>
  );
}

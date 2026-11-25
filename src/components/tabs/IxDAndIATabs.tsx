import React, { useMemo, useState } from 'react';
import { AlertTriangle, ChevronRight, ExternalLink } from 'lucide-react';
import type { IAAnalysis, IxDAnalysis } from '../../types/audit';

interface IxDTabProps {
  ixd: IxDAnalysis;
}

export function IxDTab({ ixd }: IxDTabProps) {
  const [stateFilter, setStateFilter] = useState<'all' | 'hover' | 'focus' | 'focus-visible' | 'active'>('all');

  const filteredStates = useMemo(() => {
    if (stateFilter === 'all') return ixd.pseudoStates;
    return ixd.pseudoStates.filter((s) => s.state === stateFilter);
  }, [ixd.pseudoStates, stateFilter]);

  return (
    <div className="space-y-12">
      {/* Summary & Libraries */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white border border-[#E2DDD5] rounded-lg p-6">
          <p className="text-xs font-mono text-[#78716C]">01. Motion Stack</p>
          <h2 className="mt-1 font-serif text-xl text-[#1C1917]">Animation Libraries &amp; Telemetry</h2>
          <dl className="mt-4 divide-y divide-[#EFECE6] text-sm">
            <div className="py-3 flex justify-between gap-4">
              <dt className="text-[#57534E]">Detected Libraries</dt>
              <dd className="font-medium text-[#1C1917] text-right">
                {ixd.animationLibraries.length > 0 ? ixd.animationLibraries.join(' · ') : 'Native CSS only'}
              </dd>
            </div>
            <div className="py-3 flex justify-between gap-4">
              <dt className="text-[#57534E]">Interactive Elements</dt>
              <dd className="font-mono tabular-nums text-[#1C1917]">{ixd.interactiveElementCount}</dd>
            </div>
            <div className="py-3 flex justify-between gap-4">
              <dt className="text-[#57534E]">Captured State Rules</dt>
              <dd className="font-mono tabular-nums text-[#1C1917]">{ixd.pseudoStates.length}</dd>
            </div>
            <div className="py-3 flex justify-between gap-4">
              <dt className="text-[#57534E]">Unique Transitions / Keyframes</dt>
              <dd className="font-mono tabular-nums text-[#1C1917]">
                {ixd.transitions.length} transitions · {ixd.keyframes.length} @keyframes
              </dd>
            </div>
          </dl>
        </div>

        <div className="bg-white border border-[#E2DDD5] rounded-lg p-6">
          <p className="text-xs font-mono text-[#78716C]">02. Viewport Choreography</p>
          <h2 className="mt-1 font-serif text-xl text-[#1C1917]">Scroll Effects &amp; Sticky Regions</h2>
          {ixd.scrollEffects.length === 0 ? (
            <p className="mt-4 text-sm text-[#78716C]">
              Standard document scroll flow — no sticky layers, scroll snap, or scroll-reveal attributes detected.
            </p>
          ) : (
            <div className="mt-4 divide-y divide-[#EFECE6]">
              {ixd.scrollEffects.map((effect) => (
                <div key={effect.type} className="py-3 flex items-baseline justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-[#1C1917] capitalize">{effect.type.replace('-', ' ')}</p>
                    <p className="text-xs text-[#57534E] mt-0.5">{effect.detail}</p>
                  </div>
                  <span className="font-mono text-xs tabular-nums text-[#1D3557] shrink-0">
                    {effect.count}×
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Pseudo-States (:hover, :focus, :active) */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-4 border-b border-[#E2DDD5]">
          <div>
            <p className="text-xs font-mono text-[#78716C]">03. Interactive States</p>
            <h2 className="mt-1 font-serif text-2xl text-[#1C1917]">Hover, Focus &amp; Active Transitions</h2>
          </div>
          <div className="inline-flex flex-wrap items-center gap-1 bg-[#EFECE6] p-1 rounded-md">
            {(['all', 'hover', 'focus', 'focus-visible', 'active'] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStateFilter(st)}
                className={`px-2.5 py-1 text-xs font-mono rounded transition-colors cursor-pointer whitespace-nowrap ${
                  stateFilter === st
                    ? 'bg-white text-[#1C1917] border border-[#E2DDD5]'
                    : 'text-[#57534E] hover:text-[#1C1917]'
                }`}
              >
                {st === 'all' ? 'All States' : `:${st}`}
              </button>
            ))}
          </div>
        </div>

        {filteredStates.length === 0 ? (
          <div className="bg-white border border-[#E2DDD5] rounded-lg p-8 text-sm text-[#78716C]">
            No pseudo-state rules captured for this filter (some cross-origin stylesheets restrict CSS rule inspection).
          </div>
        ) : (
          <div className="bg-white border border-[#E2DDD5] rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#E2DDD5] bg-[#FAF8F4] text-xs font-medium text-[#57534E]">
                    <th className="py-3 px-5 w-28">State</th>
                    <th className="py-3 px-4 w-64">Selector / Target</th>
                    <th className="py-3 px-5">Measured Property Changes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EFECE6] text-xs font-mono">
                  {filteredStates.slice(0, 32).map((rule, idx) => (
                    <tr key={`${rule.selector}-${rule.state}-${idx}`} className="align-top hover:bg-[#FAF8F4]/70">
                      <td className="py-3 px-5 text-[#1D3557] font-medium">:{rule.state}</td>
                      <td className="py-3 px-4 text-[#1C1917] break-all">{rule.selector}</td>
                      <td className="py-3 px-5 text-[#57534E]">
                        <div className="space-y-1">
                          {Object.entries(rule.properties).map(([prop, val]) => (
                            <div key={prop}>
                              <span className="text-[#1C1917]">{prop}:</span> {val}
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* CSS Transitions & Keyframes */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white border border-[#E2DDD5] rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-[#E2DDD5]">
            <h3 className="font-serif text-xl text-[#1C1917]">Transitions &amp; Timing Curves</h3>
          </div>
          {ixd.transitions.length === 0 ? (
            <p className="p-6 text-sm text-[#78716C]">No explicit CSS transition timings measured.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#E2DDD5] bg-[#FAF8F4] text-xs font-medium text-[#57534E]">
                    <th className="py-2.5 px-5">Property</th>
                    <th className="py-2.5 px-4 text-right">Duration</th>
                    <th className="py-2.5 px-4">Easing Curve</th>
                    <th className="py-2.5 px-5">Sample Element</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EFECE6] text-xs font-mono">
                  {ixd.transitions.slice(0, 20).map((t, idx) => (
                    <tr key={idx} className="hover:bg-[#FAF8F4]/70">
                      <td className="py-3 px-5 text-[#1C1917] max-w-[180px] truncate">{t.property}</td>
                      <td className="py-3 px-4 text-right tabular-nums text-[#1D3557] font-medium whitespace-nowrap">
                        {t.duration}
                      </td>
                      <td className="py-3 px-4 text-[#57534E] max-w-[200px] truncate">{t.timingFunction}</td>
                      <td className="py-3 px-5 text-[#78716C] max-w-[160px] truncate">{t.selector}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="bg-white border border-[#E2DDD5] rounded-lg p-6">
          <h3 className="font-serif text-xl text-[#1C1917] pb-3 border-b border-[#EFECE6]">@keyframes</h3>
          {ixd.keyframes.length === 0 ? (
            <p className="mt-4 text-sm text-[#78716C]">No CSS @keyframes rules extracted from accessible sheets.</p>
          ) : (
            <div className="mt-4 divide-y divide-[#EFECE6]">
              {ixd.keyframes.map((kf) => (
                <div key={kf.name} className="py-3">
                  <p className="font-mono text-xs font-medium text-[#1D3557]">{kf.name}</p>
                  <p className="mt-1 font-mono text-[11px] text-[#78716C]">{kf.steps}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

interface IATabProps {
  ia: IAAnalysis;
}

export function IATab({ ia }: IATabProps) {
  const [selectedHeadingPath, setSelectedHeadingPath] = useState(ia.headingStructures[0]?.pagePath || '/');

  const depthGroups = useMemo(() => {
    const groups = new Map<number, typeof ia.sitemap>();
    for (const node of ia.sitemap) {
      const list = groups.get(node.depth) || [];
      list.push(node);
      groups.set(node.depth, list);
    }
    return Array.from(groups.entries()).sort((a, b) => a[0] - b[0]);
  }, [ia.sitemap]);

  const activeHeadingDoc =
    ia.headingStructures.find((h) => h.pagePath === selectedHeadingPath) || ia.headingStructures[0];

  return (
    <div className="space-y-12">
      {/* 1. Visual Sitemap Tree */}
      <section className="space-y-5">
        <div className="pb-4 border-b border-[#E2DDD5] flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
          <div>
            <p className="text-xs font-mono text-[#78716C]">01. Site Topology</p>
            <h2 className="mt-1 font-serif text-2xl text-[#1C1917]">Visual Sitemap &amp; Page Archetypes</h2>
          </div>
          <span className="text-xs font-mono tabular-nums text-[#78716C]">
            {ia.sitemap.length} crawled pages across {depthGroups.length} depth level(s)
          </span>
        </div>

        <div className="bg-white border border-[#E2DDD5] rounded-lg p-6 space-y-6">
          {depthGroups.map(([depth, nodes]) => (
            <div key={depth} className="space-y-3">
              <p className="text-xs font-mono uppercase tracking-[0.1em] text-[#78716C]">
                Level {depth} — {depth === 0 ? 'Root Entry' : depth === 1 ? 'Primary Navigation & Key Flows' : 'Secondary Pages'}
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {nodes.map((node) => {
                  const isSelected = node.path === selectedHeadingPath;
                  return (
                    <button
                      key={node.url}
                      type="button"
                      onClick={() => setSelectedHeadingPath(node.path)}
                      className={`text-left p-4 rounded-md border transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-[#F8F5F0] border-[#1D3557]'
                          : 'bg-white border-[#E2DDD5] hover:border-[#A8A29E]'
                      }`}
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="font-mono text-xs font-medium text-[#1D3557] truncate">
                          {node.path}
                        </span>
                        <span className="text-[11px] uppercase tracking-wider text-[#78716C] shrink-0">
                          {node.archetype}
                        </span>
                      </div>
                      <p className="mt-1.5 text-sm font-medium text-[#1C1917] truncate">{node.title}</p>
                      <p className="mt-2 text-xs text-[#78716C] font-mono tabular-nums">
                        {node.inboundLinks} in · {node.outboundLinks} out
                        {node.parentPath ? ` · from ${node.parentPath}` : ''}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 2. Navigation Hierarchy & Footer Architecture */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white border border-[#E2DDD5] rounded-lg p-6">
          <p className="text-xs font-mono text-[#78716C]">02. Primary Navigation</p>
          <h3 className="mt-1 font-serif text-xl text-[#1C1917] pb-3 border-b border-[#EFECE6]">
            Top-Level Menu Hierarchy
          </h3>
          {ia.primaryNavigation.length === 0 ? (
            <p className="mt-4 text-sm text-[#78716C]">No structured header navigation links detected.</p>
          ) : (
            <ul className="mt-4 divide-y divide-[#EFECE6]">
              {ia.primaryNavigation.map((item, idx) => (
                <li key={`${item.label}-${idx}`} className="py-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium text-[#1C1917]">{item.label}</span>
                    {item.href && (
                      <span className="text-xs font-mono text-[#78716C] truncate max-w-[200px]">
                        {(() => {
                          try {
                            return new URL(item.href).pathname;
                          } catch {
                            return item.href;
                          }
                        })()}
                      </span>
                    )}
                  </div>
                  {item.children.length > 0 && (
                    <ul className="mt-2 pl-4 space-y-1 border-l border-[#E2DDD5]">
                      {item.children.map((ch, cIdx) => (
                        <li key={cIdx} className="text-xs text-[#57534E] flex items-center gap-1.5">
                          <ChevronRight className="w-3 h-3 text-[#A8A29E] shrink-0" />
                          <span>{ch.label}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="bg-white border border-[#E2DDD5] rounded-lg p-6">
          <p className="text-xs font-mono text-[#78716C]">03. Footer Architecture</p>
          <h3 className="mt-1 font-serif text-xl text-[#1C1917] pb-3 border-b border-[#EFECE6]">
            Footer Link Columns
          </h3>
          {ia.footerColumns.length === 0 ? (
            <p className="mt-4 text-sm text-[#78716C]">No multi-column footer navigation detected.</p>
          ) : (
            <div className="mt-4 grid grid-cols-2 gap-6">
              {ia.footerColumns.map((col, idx) => (
                <div key={idx}>
                  <p className="text-xs font-semibold uppercase tracking-wider text-[#1C1917]">{col.heading}</p>
                  <ul className="mt-2 space-y-1.5">
                    {col.links.map((l, lIdx) => (
                      <li key={lIdx} className="text-xs text-[#57534E] truncate">
                        {l.label}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* 3. Per-Page Heading Structure */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-4 border-b border-[#E2DDD5]">
          <div>
            <p className="text-xs font-mono text-[#78716C]">04. Document Outline</p>
            <h2 className="mt-1 font-serif text-2xl text-[#1C1917]">Heading Hierarchy (H1–H6)</h2>
          </div>
          <select
            value={selectedHeadingPath}
            onChange={(e) => setSelectedHeadingPath(e.target.value)}
            aria-label="Select page for heading hierarchy"
            className="h-9 px-3 bg-white border border-[#E2DDD5] rounded-md text-xs font-mono text-[#1C1917] focus:outline-none focus:border-[#1D3557]"
          >
            {ia.headingStructures.map((h) => (
              <option key={h.pageUrl} value={h.pagePath}>
                {h.pagePath} ({h.headings.length} headings)
              </option>
            ))}
          </select>
        </div>

        {activeHeadingDoc && (
          <div className="bg-white border border-[#E2DDD5] rounded-lg p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[#EFECE6] text-xs">
              <div className="flex items-center gap-2 text-[#57534E]">
                <span className="font-mono text-[#1C1917] font-medium">{activeHeadingDoc.pagePath}</span>
                <span>·</span>
                <span className="font-mono tabular-nums">H1 count: {activeHeadingDoc.h1Count}</span>
                {activeHeadingDoc.skippedLevels.length > 0 && (
                  <>
                    <span>·</span>
                    <span className="text-[#B45309] font-medium inline-flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Skipped levels: {activeHeadingDoc.skippedLevels.join(', ')}
                    </span>
                  </>
                )}
              </div>
              <a
                href={activeHeadingDoc.pageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[#1D3557] hover:underline font-mono"
              >
                <span>Open Page</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            {activeHeadingDoc.headings.length === 0 ? (
              <p className="mt-4 text-sm text-[#78716C]">No visible headings found on this page.</p>
            ) : (
              <div className="mt-4 space-y-2">
                {activeHeadingDoc.headings.map((h, idx) => (
                  <div
                    key={idx}
                    className="flex items-baseline gap-3 py-1"
                    style={{ paddingLeft: `${(h.level - 1) * 20}px` }}
                  >
                    <span
                      className={`font-mono text-xs shrink-0 w-7 ${
                        h.hasSkipWarning ? 'text-[#B45309] font-semibold' : 'text-[#1D3557]'
                      }`}
                    >
                      H{h.level}
                    </span>
                    <span className="text-sm text-[#1C1917]">{h.text || '(empty heading)'}</span>
                    {h.hasSkipWarning && (
                      <span className="text-[11px] font-mono text-[#B45309]">level jump</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

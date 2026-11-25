import React, { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import type { UIAnalysis } from '../../types/audit';

interface UITabProps {
  ui: UIAnalysis;
}

export function UITab({ ui }: UITabProps) {
  const [copiedHex, setCopiedHex] = useState<string | null>(null);
  const [colorRoleFilter, setColorRoleFilter] = useState<string>('all');

  const copyValue = (val: string) => {
    navigator.clipboard.writeText(val).catch(() => undefined);
    setCopiedHex(val);
    setTimeout(() => setCopiedHex(null), 1400);
  };

  const roles = ['all', 'background', 'surface', 'text', 'accent', 'border'];
  const filteredColors =
    colorRoleFilter === 'all' ? ui.colors : ui.colors.filter((c) => c.role === colorRoleFilter);
  const maxSpacing = Math.max(1, ...ui.spacing.map((s) => s.count));

  return (
    <div className="space-y-12">
      {/* 1. Color Palette */}
      <section className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-4 border-b border-[#E2DDD5]">
          <div>
            <p className="text-xs font-mono text-[#78716C]">01. Color System</p>
            <h2 className="mt-1 font-serif text-2xl text-[#1C1917]">Extracted Color Palette &amp; Frequency</h2>
          </div>
          <div className="inline-flex flex-wrap items-center gap-1 bg-[#EFECE6] p-1 rounded-md">
            {roles.map((role) => (
              <button
                key={role}
                type="button"
                onClick={() => setColorRoleFilter(role)}
                className={`px-2.5 py-1 text-xs font-medium capitalize rounded transition-colors cursor-pointer whitespace-nowrap ${
                  colorRoleFilter === role
                    ? 'bg-white text-[#1C1917] border border-[#E2DDD5]'
                    : 'text-[#57534E] hover:text-[#1C1917]'
                }`}
              >
                {role}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {filteredColors.map((color) => (
            <button
              key={`${color.hex}-${color.role}`}
              type="button"
              onClick={() => copyValue(color.hex)}
              className="group text-left bg-white border border-[#E2DDD5] hover:border-[#1D3557] rounded-lg overflow-hidden transition-colors cursor-pointer"
            >
              <div
                className="h-20 w-full border-b border-[#E2DDD5] relative"
                style={{ backgroundColor: color.hex }}
              >
                <span className="absolute right-2.5 bottom-2 opacity-0 group-hover:opacity-100 transition-opacity bg-white/95 text-[#1C1917] px-2 py-0.5 rounded text-[11px] font-mono inline-flex items-center gap-1 border border-[#E2DDD5]">
                  {copiedHex === color.hex ? <Check className="w-3 h-3 text-[#15803D]" /> : <Copy className="w-3 h-3" />}
                  {copiedHex === color.hex ? 'Copied' : 'Copy'}
                </span>
              </div>
              <div className="p-3.5">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-mono text-sm font-medium text-[#1C1917]">{color.hex}</span>
                  <span className="font-mono text-xs tabular-nums text-[#1D3557] font-medium">
                    {color.percentage}%
                  </span>
                </div>
                <p className="mt-1 text-xs text-[#78716C] capitalize">
                  {color.role} · <span className="font-mono tabular-nums">{color.count}×</span>
                </p>
                <div className="mt-2.5 h-1 w-full bg-[#EFECE6] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#1C1917]"
                    style={{ width: `${Math.max(4, Math.min(100, color.percentage * 2.5))}%` }}
                  />
                </div>
                <p className="mt-2 text-[11px] font-mono text-[#78716C] truncate">{color.sampleUsage}</p>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* 2. Fonts & Computed Type Scale */}
      <section className="space-y-5">
        <div className="pb-4 border-b border-[#E2DDD5]">
          <p className="text-xs font-mono text-[#78716C]">02. Typography</p>
          <h2 className="mt-1 font-serif text-2xl text-[#1C1917]">Font Families &amp; Type Scale</h2>
        </div>

        {/* Font Family Strip */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {ui.fonts.map((font) => (
            <div key={font.family} className="bg-white border border-[#E2DDD5] rounded-lg p-5">
              <p className="text-xs text-[#78716C] capitalize">
                {font.role} · {font.source.replace('-', ' ')}
              </p>
              <p className="mt-2 text-2xl font-medium text-[#1C1917] truncate" style={{ fontFamily: font.family }}>
                {font.family}
              </p>
              <p className="mt-3 text-xs font-mono text-[#57534E] tabular-nums">
                Weights: {font.weights.join(', ')} · {font.usageCount} nodes
              </p>
            </div>
          ))}
        </div>

        {/* Type Scale Table */}
        <div className="bg-white border border-[#E2DDD5] rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#E2DDD5] bg-[#FAF8F4] text-xs font-medium text-[#57534E]">
                  <th className="py-3 px-5 w-20">Role</th>
                  <th className="py-3 px-4">Specimen</th>
                  <th className="py-3 px-4">Family</th>
                  <th className="py-3 px-4 text-right">Size</th>
                  <th className="py-3 px-4 text-right">Weight</th>
                  <th className="py-3 px-4 text-right">Line Height</th>
                  <th className="py-3 px-5 text-right">Tracking</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EFECE6]">
                {ui.typeScale.map((entry, idx) => (
                  <tr key={`${entry.level}-${idx}`} className="hover:bg-[#FAF8F4]/70">
                    <td className="py-3.5 px-5 font-mono text-xs font-medium text-[#1D3557]">{entry.level}</td>
                    <td className="py-3.5 px-4 max-w-sm">
                      <p
                        className="text-[#1C1917] truncate"
                        style={{
                          fontSize: `${Math.min(28, Math.max(12, entry.fontSizePx))}px`,
                          fontWeight: Number(entry.fontWeight) || 400,
                        }}
                      >
                        {entry.sampleText || 'The quick brown fox jumps over the lazy dog'}
                      </p>
                    </td>
                    <td className="py-3.5 px-4 text-xs text-[#57534E]">{entry.fontFamily}</td>
                    <td className="py-3.5 px-4 text-xs font-mono tabular-nums text-right text-[#1C1917]">
                      {entry.fontSizePx}px
                    </td>
                    <td className="py-3.5 px-4 text-xs font-mono tabular-nums text-right text-[#57534E]">
                      {entry.fontWeight}
                    </td>
                    <td className="py-3.5 px-4 text-xs font-mono tabular-nums text-right text-[#57534E]">
                      {entry.lineHeight}
                    </td>
                    <td className="py-3.5 px-5 text-xs font-mono tabular-nums text-right text-[#57534E]">
                      {entry.letterSpacing}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* 3. Spacing & Layout Grid */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Spacing Scale */}
        <div className="bg-white border border-[#E2DDD5] rounded-lg p-6">
          <div className="flex items-baseline justify-between pb-3 border-b border-[#EFECE6]">
            <div>
              <p className="text-xs font-mono text-[#78716C]">03. Spacing System</p>
              <h3 className="mt-1 font-serif text-xl text-[#1C1917]">Measured Scale</h3>
            </div>
            <span className="font-mono text-xs text-[#1D3557] font-medium">
              Base unit: {ui.layout.baseSpacingUnitPx}px
            </span>
          </div>
          <div className="mt-4 space-y-3">
            {ui.spacing.map((sp) => (
              <div key={sp.valuePx} className="grid grid-cols-12 items-center gap-3 text-xs">
                <span className="col-span-3 font-mono tabular-nums text-[#1C1917]">{sp.valuePx}px</span>
                <div className="col-span-6 flex items-center gap-2">
                  <div
                    className="h-3 bg-[#1D3557]/80 rounded-xs"
                    style={{ width: `${Math.max(6, Math.min(100, (sp.valuePx / 96) * 100))}%` }}
                  />
                </div>
                <span className="col-span-3 text-right font-mono tabular-nums text-[#78716C]">
                  {sp.count}× ({Math.round((sp.count / maxSpacing) * 100)}%)
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Layout Grid & Breakpoints */}
        <div className="bg-white border border-[#E2DDD5] rounded-lg p-6 space-y-5">
          <div className="pb-3 border-b border-[#EFECE6]">
            <p className="text-xs font-mono text-[#78716C]">04. Layout &amp; Media</p>
            <h3 className="mt-1 font-serif text-xl text-[#1C1917]">Grid, Breakpoints &amp; Imagery</h3>
          </div>
          <dl className="divide-y divide-[#EFECE6] text-sm">
            <div className="py-3 flex justify-between gap-4">
              <dt className="text-[#57534E]">Layout Pattern</dt>
              <dd className="font-medium text-[#1C1917] text-right">{ui.layout.detectedGridSystem}</dd>
            </div>
            <div className="py-3 flex justify-between gap-4">
              <dt className="text-[#57534E]">CSS Grid / Flex Nodes</dt>
              <dd className="font-mono tabular-nums text-[#1C1917]">
                {ui.layout.gridUsageCount} grid · {ui.layout.flexUsageCount} flex
              </dd>
            </div>
            <div className="py-3 flex justify-between gap-4">
              <dt className="text-[#57534E]">Detected Breakpoints</dt>
              <dd className="font-mono text-xs text-[#1C1917] text-right">
                {ui.layout.breakpoints.length > 0
                  ? ui.layout.breakpoints.map((b) => `${b}px`).join(' · ')
                  : 'Cross-origin sheets restricted'}
              </dd>
            </div>
            <div className="py-3 flex justify-between gap-4">
              <dt className="text-[#57534E]">Container Max-Widths</dt>
              <dd className="font-mono text-xs text-[#1C1917] text-right">
                {ui.layout.containerMaxWidths.length > 0
                  ? ui.layout.containerMaxWidths.map((w) => `${w}px`).join(' · ')
                  : 'Fluid'}
              </dd>
            </div>
            <div className="py-3 flex justify-between gap-4">
              <dt className="text-[#57534E]">Icon Set</dt>
              <dd className="text-[#1C1917] text-right">
                {ui.mediaProfile.iconLibraries.join(', ') || 'None'} ({ui.mediaProfile.inlineSvgCount} inline SVGs)
              </dd>
            </div>
            <div className="py-3 flex justify-between gap-4">
              <dt className="text-[#57534E]">Image Profile</dt>
              <dd className="text-[#1C1917] text-right text-xs leading-relaxed max-w-xs">
                {ui.mediaProfile.imageStyleSummary}
              </dd>
            </div>
          </dl>
        </div>
      </section>

      {/* 4. Border Radius & Shadows */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white border border-[#E2DDD5] rounded-lg p-6">
          <h3 className="font-serif text-xl text-[#1C1917] pb-3 border-b border-[#EFECE6]">Border Radii</h3>
          {ui.borderRadii.length === 0 ? (
            <p className="mt-4 text-sm text-[#78716C]">Sharp rectilinear geometry (0px corners across elements).</p>
          ) : (
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
              {ui.borderRadii.slice(0, 9).map((rad) => (
                <div key={rad.value} className="p-3 bg-[#F8F5F0] border border-[#E2DDD5] rounded flex items-center gap-3">
                  <div
                    className="w-8 h-8 bg-white border-2 border-[#1D3557] shrink-0"
                    style={{ borderRadius: rad.value }}
                  />
                  <div className="min-w-0">
                    <p className="font-mono text-xs text-[#1C1917] truncate">{rad.value}</p>
                    <p className="font-mono text-[11px] text-[#78716C] tabular-nums">{rad.count}×</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white border border-[#E2DDD5] rounded-lg p-6">
          <h3 className="font-serif text-xl text-[#1C1917] pb-3 border-b border-[#EFECE6]">Elevation &amp; Shadows</h3>
          {ui.shadows.length === 0 ? (
            <p className="mt-4 text-sm text-[#78716C]">Flat surface system — no box-shadow declarations detected.</p>
          ) : (
            <div className="mt-4 space-y-4">
              {ui.shadows.map((sh) => (
                <div key={sh.value} className="flex items-center gap-4">
                  <div
                    className="w-12 h-12 rounded-md bg-white border border-[#EFECE6] shrink-0"
                    style={{ boxShadow: sh.value }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-[#1C1917]">
                      {sh.tier} · <span className="font-mono text-[#78716C] tabular-nums">{sh.count}×</span>
                    </p>
                    <p className="mt-1 font-mono text-[11px] text-[#57534E] break-all">{sh.value}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* 5. Extracted CSS Variables */}
      {ui.cssVariables.length > 0 && (
        <section className="bg-white border border-[#E2DDD5] rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-[#E2DDD5] flex items-baseline justify-between">
            <h3 className="font-serif text-lg text-[#1C1917]">Root CSS Custom Properties</h3>
            <span className="text-xs font-mono tabular-nums text-[#78716C]">{ui.cssVariables.length} variables</span>
          </div>
          <div className="max-h-72 overflow-y-auto divide-y divide-[#EFECE6]">
            {ui.cssVariables.slice(0, 40).map((v) => (
              <div key={v.name} className="px-6 py-2.5 flex items-center justify-between gap-4 text-xs font-mono">
                <span className="text-[#1D3557] truncate">{v.name}</span>
                <span className="text-[#57534E] truncate max-w-md text-right">{v.value}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

import React from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import type {
  AccessibilityAnalysis,
  AuditReport,
  TechStackAnalysis,
  UXAnalysis,
} from '../../types/audit';

interface UXTabProps {
  ux: UXAnalysis;
  report: AuditReport;
  onInspectImage: (src: string, caption: string) => void;
}

export function UXTab({ ux, report, onInspectImage }: UXTabProps) {
  const homeDesktop = report.pages[0]?.screenshots?.desktop;
  const homePhone = report.pages[0]?.screenshots?.phone;

  return (
    <div className="space-y-12">
      {/* 1. Core User Flows */}
      <section className="space-y-5">
        <div className="pb-4 border-b border-[#E2DDD5]">
          <p className="text-xs font-mono text-[#78716C]">01. User Journeys</p>
          <h2 className="mt-1 font-serif text-2xl text-[#1C1917]">Primary Conversion &amp; Task Flows</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {ux.flows.map((flow) => (
            <div key={flow.name} className="bg-white border border-[#E2DDD5] rounded-lg p-5">
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="text-sm font-semibold text-[#1C1917]">{flow.name}</h3>
                <span
                  className={`text-xs font-mono font-medium ${
                    flow.detected ? 'text-[#15803D]' : 'text-[#78716C]'
                  }`}
                >
                  {flow.detected ? `Detected · ~${flow.estimatedSteps} steps` : 'Not detected'}
                </span>
              </div>
              <p className="mt-2 text-sm text-[#57534E] leading-relaxed">{flow.notes}</p>
              {flow.targetUrl && (
                <p className="mt-2.5 text-xs font-mono text-[#1D3557] truncate">Target: {flow.targetUrl}</p>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* 2. CTA Placement & Repetition */}
      <section className="space-y-4">
        <div className="pb-4 border-b border-[#E2DDD5] flex items-baseline justify-between">
          <div>
            <p className="text-xs font-mono text-[#78716C]">02. Calls to Action</p>
            <h2 className="mt-1 font-serif text-2xl text-[#1C1917]">CTA Placement &amp; Repetition</h2>
          </div>
          <span className="text-xs font-mono tabular-nums text-[#78716C]">{ux.ctas.length} distinct CTAs</span>
        </div>

        <div className="bg-white border border-[#E2DDD5] rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#E2DDD5] bg-[#FAF8F4] text-xs font-medium text-[#57534E]">
                  <th className="py-3 px-5">CTA Copy</th>
                  <th className="py-3 px-4">Placement Zone</th>
                  <th className="py-3 px-4">First Seen</th>
                  <th className="py-3 px-4">Style Swatch</th>
                  <th className="py-3 px-5 text-right">Repeats</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EFECE6] text-sm">
                {ux.ctas.slice(0, 18).map((cta, idx) => (
                  <tr key={`${cta.text}-${idx}`} className="hover:bg-[#FAF8F4]/70">
                    <td className="py-3 px-5 font-medium text-[#1C1917]">{cta.text}</td>
                    <td className="py-3 px-4 text-xs font-mono text-[#57534E] capitalize">
                      {cta.placement.replace(/-/g, ' ')}
                    </td>
                    <td className="py-3 px-4 text-xs font-mono text-[#78716C]">{cta.pagePath}</td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center gap-2 text-xs font-mono text-[#57534E]">
                        <span
                          className="w-4 h-4 rounded-xs border border-[#D6CFC4] inline-block shrink-0"
                          style={{
                            backgroundColor: cta.backgroundColor === 'transparent' ? '#FFFFFF' : cta.backgroundColor,
                          }}
                        />
                        {cta.backgroundColor}
                      </span>
                    </td>
                    <td className="py-3 px-5 text-right font-mono tabular-nums text-xs text-[#1D3557] font-medium">
                      {cta.repeatCount}×
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* 3. Forms & Trust Signals */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white border border-[#E2DDD5] rounded-lg p-6">
          <p className="text-xs font-mono text-[#78716C]">03. Input Friction</p>
          <h3 className="mt-1 font-serif text-xl text-[#1C1917] pb-3 border-b border-[#EFECE6]">
            Forms &amp; Field Complexity
          </h3>
          {ux.forms.length === 0 ? (
            <p className="mt-4 text-sm text-[#78716C]">No interactive forms detected across the crawled pages.</p>
          ) : (
            <div className="mt-4 divide-y divide-[#EFECE6]">
              {ux.forms.map((f, idx) => (
                <div key={idx} className="py-3.5 first:pt-0 last:pb-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-sm font-semibold text-[#1C1917]">{f.purpose}</p>
                    <span className="text-xs font-mono tabular-nums text-[#1D3557]">
                      {f.fieldCount} fields · {f.requiredCount} required
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-[#57534E]">
                    Page <span className="font-mono">{f.pagePath}</span> · Submit: &ldquo;{f.submitLabel}&rdquo;
                    {f.isMultiStep ? ' · Multi-step flow' : ' · Single-step'}
                  </p>
                  <p className="mt-1 text-[11px] font-mono text-[#78716C]">Types: {f.inputTypes.join(', ')}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white border border-[#E2DDD5] rounded-lg p-6">
          <p className="text-xs font-mono text-[#78716C]">04. Credibility Markers</p>
          <h3 className="mt-1 font-serif text-xl text-[#1C1917] pb-3 border-b border-[#EFECE6]">
            Detected Trust Signals
          </h3>
          {ux.trustSignals.length === 0 ? (
            <p className="mt-4 text-sm text-[#78716C]">
              No explicit testimonials, security badges, or customer logo strips detected.
            </p>
          ) : (
            <div className="mt-4 divide-y divide-[#EFECE6]">
              {ux.trustSignals.map((ts, idx) => (
                <div key={idx} className="py-3.5 first:pt-0 last:pb-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-sm font-medium text-[#1C1917]">{ts.label}</p>
                    <span className="text-[11px] font-mono uppercase text-[#78716C]">{ts.category}</span>
                  </div>
                  <p className="mt-1 text-xs text-[#57534E]">
                    {ts.evidence} (<span className="font-mono">{ts.pagePath}</span>)
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* 4. Mobile Layout Adaptation */}
      <section className="space-y-5">
        <div className="pb-4 border-b border-[#E2DDD5]">
          <p className="text-xs font-mono text-[#78716C]">05. Responsive Behavior</p>
          <h2 className="mt-1 font-serif text-2xl text-[#1C1917]">Desktop vs. Mobile Adaptation</h2>
        </div>

        <div className="bg-white border border-[#E2DDD5] rounded-lg p-6 space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pb-5 border-b border-[#EFECE6]">
            <div>
              <p className="text-xs text-[#78716C]">Nav Collapse</p>
              <p className="mt-1 text-sm font-semibold text-[#1C1917]">
                {ux.mobileDelta.navCollapsedToMenu ? 'Collapses to Menu' : 'Remains Inline'}
              </p>
            </div>
            <div>
              <p className="text-xs text-[#78716C]">H1 Scaling</p>
              <p className="mt-1 text-sm font-mono tabular-nums text-[#1C1917]">
                {ux.mobileDelta.desktopH1Px ?? '—'}px → {ux.mobileDelta.mobileH1Px ?? '—'}px
              </p>
            </div>
            <div>
              <p className="text-xs text-[#78716C]">Body Scaling</p>
              <p className="mt-1 text-sm font-mono tabular-nums text-[#1C1917]">
                {ux.mobileDelta.desktopBodyPx ?? '—'}px → {ux.mobileDelta.mobileBodyPx ?? '—'}px
              </p>
            </div>
            <div>
              <p className="text-xs text-[#78716C]">Horizontal Overflow</p>
              <p
                className={`mt-1 text-sm font-semibold ${
                  ux.mobileDelta.horizontalOverflowOnMobile ? 'text-[#B91C1C]' : 'text-[#15803D]'
                }`}
              >
                {ux.mobileDelta.horizontalOverflowOnMobile ? 'Overflow Detected' : 'Clean Fit (390px)'}
              </p>
            </div>
          </div>

          <ul className="space-y-1.5 text-sm text-[#57534E]">
            {ux.mobileDelta.layoutNotes.map((note, idx) => (
              <li key={idx}>• {note}</li>
            ))}
          </ul>

          {(homeDesktop || homePhone) && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-2">
              {homeDesktop && (
                <div className="lg:col-span-8 bg-[#EFECE6] p-4 rounded border border-[#E2DDD5]">
                  <p className="text-xs font-mono text-[#57534E] mb-2">Desktop (1440px)</p>
                  <div className="max-h-[420px] overflow-y-auto bg-white border border-[#D6CFC4] rounded">
                    <img
                      src={homeDesktop.dataUrl}
                      alt="Desktop layout comparison"
                      referrerPolicy="no-referrer"
                      onClick={() => onInspectImage(homeDesktop.dataUrl, `${report.domain} — Desktop (1440px)`)}
                      className="w-full h-auto block cursor-zoom-in"
                    />
                  </div>
                </div>
              )}
              {homePhone && (
                <div className="lg:col-span-4 bg-[#EFECE6] p-4 rounded border border-[#E2DDD5] flex flex-col items-center">
                  <p className="text-xs font-mono text-[#57534E] mb-2 self-start">Phone (390px)</p>
                  <div className="max-h-[420px] overflow-y-auto bg-white border border-[#D6CFC4] rounded max-w-[260px] w-full">
                    <img
                      src={homePhone.dataUrl}
                      alt="Phone layout comparison"
                      referrerPolicy="no-referrer"
                      onClick={() => onInspectImage(homePhone.dataUrl, `${report.domain} — Phone (390px)`)}
                      className="w-full h-auto block cursor-zoom-in"
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

interface AccessibilityTabProps {
  accessibility: AccessibilityAnalysis;
}

export function AccessibilityTab({ accessibility }: AccessibilityTabProps) {
  const scoreColor =
    accessibility.score >= 85
      ? 'text-[#15803D]'
      : accessibility.score >= 65
        ? 'text-[#B45309]'
        : 'text-[#B91C1C]';

  const CheckRow = ({ label, passed, detail }: { label: string; passed: boolean; detail: string }) => (
    <div className="py-3 flex items-center justify-between gap-4 text-sm">
      <div className="flex items-center gap-2.5">
        {passed ? (
          <CheckCircle2 className="w-4 h-4 text-[#15803D] shrink-0" />
        ) : (
          <XCircle className="w-4 h-4 text-[#B91C1C] shrink-0" />
        )}
        <span className="text-[#1C1917] font-medium">{label}</span>
      </div>
      <span className={`text-xs font-mono ${passed ? 'text-[#15803D]' : 'text-[#B91C1C]'}`}>{detail}</span>
    </div>
  );

  return (
    <div className="space-y-12">
      {/* Deterministic Accessibility Scoreboard */}
      <section className="bg-white border border-[#E2DDD5] rounded-lg p-6 lg:p-8 grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
        <div className="md:col-span-4 md:border-r md:border-[#EFECE6] md:pr-6">
          <p className="text-xs font-mono uppercase tracking-wider text-[#78716C]">WCAG Audit Score</p>
          <div className="mt-2 flex items-baseline gap-3">
            <span className={`font-serif text-5xl font-semibold tabular-nums ${scoreColor}`}>
              {accessibility.score}
            </span>
            <span className="font-mono text-lg text-[#78716C]">/ 100 · Grade {accessibility.grade}</span>
          </div>
          <p className="mt-2 text-xs text-[#57534E]">
            Computed deterministically from contrast ratios, image alt text, landmarks, form labels, and focus styles.
          </p>
        </div>

        <div className="md:col-span-8 grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-[#78716C]">Contrast Failures</p>
            <p className="mt-1 font-mono text-2xl tabular-nums text-[#1C1917]">
              {accessibility.contrastFailures.length}
            </p>
            <p className="text-[11px] text-[#78716C] font-mono tabular-nums">
              of {accessibility.contrastCheckedCount} checked
            </p>
          </div>
          <div>
            <p className="text-xs text-[#78716C]">Missing Alt Text</p>
            <p className="mt-1 font-mono text-2xl tabular-nums text-[#1C1917]">
              {accessibility.missingAltImages.length}
            </p>
            <p className="text-[11px] text-[#78716C] font-mono tabular-nums">
              of {accessibility.totalImagesChecked} images
            </p>
          </div>
          <div>
            <p className="text-xs text-[#78716C]">Unlabeled Controls</p>
            <p className="mt-1 font-mono text-2xl tabular-nums text-[#1C1917]">
              {accessibility.ariaStats.unlabeledButtons + accessibility.ariaStats.unlabeledInputs}
            </p>
            <p className="text-[11px] text-[#78716C] font-mono tabular-nums">
              {accessibility.ariaStats.unlabeledButtons} btn · {accessibility.ariaStats.unlabeledInputs} input
            </p>
          </div>
          <div>
            <p className="text-xs text-[#78716C]">ARIA Attributes</p>
            <p className="mt-1 font-mono text-2xl tabular-nums text-[#1C1917]">
              {accessibility.ariaStats.ariaAttributesCount}
            </p>
            <p className="text-[11px] text-[#78716C] font-mono tabular-nums">
              {accessibility.keyboardFocus.focusableElementsCount} focusable
            </p>
          </div>
        </div>
      </section>

      {/* Contrast Failures */}
      <section className="space-y-4">
        <div className="pb-4 border-b border-[#E2DDD5]">
          <p className="text-xs font-mono text-[#78716C]">01. Color Contrast</p>
          <h2 className="mt-1 font-serif text-2xl text-[#1C1917]">WCAG AA Contrast Failures</h2>
        </div>

        {accessibility.contrastFailures.length === 0 ? (
          <div className="bg-white border border-[#E2DDD5] rounded-lg p-6 text-sm text-[#15803D] font-medium">
            All {accessibility.contrastCheckedCount} sampled visible text elements passed WCAG AA contrast ratios.
          </div>
        ) : (
          <div className="bg-white border border-[#E2DDD5] rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#E2DDD5] bg-[#FAF8F4] text-xs font-medium text-[#57534E]">
                    <th className="py-3 px-5 w-24">Preview</th>
                    <th className="py-3 px-4">Text &amp; Selector</th>
                    <th className="py-3 px-4">Pair (FG / BG)</th>
                    <th className="py-3 px-4 text-right">Measured</th>
                    <th className="py-3 px-5 text-right">Required</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EFECE6] text-xs">
                  {accessibility.contrastFailures.map((cf, idx) => (
                    <tr key={idx} className="hover:bg-[#FAF8F4]/70">
                      <td className="py-3 px-5">
                        <span
                          className="inline-flex items-center justify-center w-12 h-7 rounded border border-[#D6CFC4] font-semibold text-xs"
                          style={{ color: cf.foregroundHex, backgroundColor: cf.backgroundHex }}
                        >
                          Aa
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <p className="text-sm text-[#1C1917] font-medium truncate max-w-xs">
                          &ldquo;{cf.textSnippet}&rdquo;
                        </p>
                        <p className="font-mono text-[11px] text-[#78716C]">
                          {cf.selector} · {cf.fontSizePx}px · {cf.pagePath}
                        </p>
                      </td>
                      <td className="py-3 px-4 font-mono text-[#57534E]">
                        {cf.foregroundHex} on {cf.backgroundHex}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-[#B91C1C] font-semibold">
                        {cf.ratio}:1
                      </td>
                      <td className="py-3 px-5 text-right font-mono tabular-nums text-[#57534E]">
                        {cf.requiredRatio}:1
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* Semantic HTML, Landmarks & Keyboard Focus */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white border border-[#E2DDD5] rounded-lg p-6">
          <h3 className="font-serif text-xl text-[#1C1917] pb-3 border-b border-[#EFECE6]">
            Landmarks &amp; Semantic HTML
          </h3>
          <div className="mt-2 divide-y divide-[#EFECE6]">
            <CheckRow
              label="Document language attribute"
              passed={accessibility.semanticHtml.hasLangAttribute}
              detail={accessibility.semanticHtml.hasLangAttribute ? `lang="${accessibility.semanticHtml.langValue}"` : 'Missing'}
            />
            <CheckRow
              label="Document <title>"
              passed={accessibility.semanticHtml.hasDocumentTitle}
              detail={accessibility.semanticHtml.hasDocumentTitle ? 'Present' : 'Missing'}
            />
            <CheckRow
              label="Main landmark (<main>)"
              passed={accessibility.ariaStats.hasMainLandmark}
              detail={accessibility.ariaStats.hasMainLandmark ? 'Present' : 'Missing'}
            />
            <CheckRow
              label="Navigation landmark (<nav>)"
              passed={accessibility.ariaStats.hasNavLandmark}
              detail={accessibility.ariaStats.hasNavLandmark ? 'Present' : 'Missing'}
            />
            <CheckRow
              label="Header & Footer landmarks"
              passed={accessibility.ariaStats.hasHeaderLandmark && accessibility.ariaStats.hasFooterLandmark}
              detail={`${accessibility.ariaStats.hasHeaderLandmark ? 'Header' : 'No header'} · ${accessibility.ariaStats.hasFooterLandmark ? 'Footer' : 'No footer'}`}
            />
            <CheckRow
              label="Heading outline sequence"
              passed={accessibility.semanticHtml.headingOrderValid}
              detail={accessibility.semanticHtml.headingOrderValid ? 'Valid hierarchy' : 'Skipped levels or multiple H1'}
            />
          </div>
        </div>

        <div className="bg-white border border-[#E2DDD5] rounded-lg p-6">
          <h3 className="font-serif text-xl text-[#1C1917] pb-3 border-b border-[#EFECE6]">
            Keyboard Focus &amp; Images
          </h3>
          <div className="mt-2 divide-y divide-[#EFECE6]">
            <CheckRow
              label="Skip-to-content link"
              passed={accessibility.keyboardFocus.hasSkipLink}
              detail={accessibility.keyboardFocus.hasSkipLink ? 'Detected' : 'Not found'}
            />
            <CheckRow
              label="Positive tabindex misuse"
              passed={accessibility.keyboardFocus.positiveTabIndexCount === 0}
              detail={`${accessibility.keyboardFocus.positiveTabIndexCount} found`}
            />
            <CheckRow
              label="Outline removed without fallback"
              passed={accessibility.keyboardFocus.outlineRemovedWithoutFallback === 0}
              detail={`${accessibility.keyboardFocus.outlineRemovedWithoutFallback} elements`}
            />
            <CheckRow
              label="Unlabeled buttons / inputs"
              passed={accessibility.ariaStats.unlabeledButtons + accessibility.ariaStats.unlabeledInputs === 0}
              detail={`${accessibility.ariaStats.unlabeledButtons} buttons · ${accessibility.ariaStats.unlabeledInputs} inputs`}
            />
          </div>

          {accessibility.missingAltImages.length > 0 && (
            <div className="mt-5 pt-4 border-t border-[#EFECE6]">
              <p className="text-xs font-semibold text-[#B91C1C]">
                Images Missing Alt Text ({accessibility.missingAltImages.length})
              </p>
              <div className="mt-2 max-h-40 overflow-y-auto space-y-1.5">
                {accessibility.missingAltImages.slice(0, 12).map((img, idx) => (
                  <p key={idx} className="text-[11px] font-mono text-[#57534E] truncate">
                    {img.pagePath} — {img.src} ({img.width}×{img.height})
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

interface TechStackTabProps {
  techStack: TechStackAnalysis;
  stylesheetUrls: string[];
}

export function TechStackTab({ techStack, stylesheetUrls }: TechStackTabProps) {
  const maxKb = Math.max(1, ...techStack.pageSpeed.breakdownByType.map((b) => b.sizeKb));

  return (
    <div className="space-y-12">
      {/* 1. Technology Detection Matrix */}
      <section className="space-y-5">
        <div className="pb-4 border-b border-[#E2DDD5]">
          <p className="text-xs font-mono text-[#78716C]">01. Stack Fingerprint</p>
          <h2 className="mt-1 font-serif text-2xl text-[#1C1917]">Frameworks, CSS &amp; Infrastructure</h2>
        </div>

        <div className="bg-white border border-[#E2DDD5] rounded-lg divide-y divide-[#EFECE6]">
          {[
            { label: 'Frontend Framework', values: techStack.frameworks },
            { label: 'CSS Architecture', values: techStack.cssApproach },
            { label: 'Component Libraries', values: techStack.componentLibraries },
            { label: 'CMS & Hosting Signals', values: techStack.cmsAndHosting },
            { label: 'Analytics, Payments & Tools', values: techStack.analyticsAndTools },
          ].map((row) => (
            <div
              key={row.label}
              className="px-6 py-4 flex flex-col sm:flex-row sm:items-baseline justify-between gap-2"
            >
              <span className="text-sm font-medium text-[#57534E]">{row.label}</span>
              <span className="text-sm font-medium text-[#1C1917] sm:text-right">
                {row.values.length > 0 ? row.values.join(' · ') : 'None detected'}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* 2. Page Speed Basics & Network Weight */}
      <section className="space-y-5">
        <div className="pb-4 border-b border-[#E2DDD5]">
          <p className="text-xs font-mono text-[#78716C]">02. Performance Telemetry</p>
          <h2 className="mt-1 font-serif text-2xl text-[#1C1917]">Page Speed Basics &amp; Asset Weight</h2>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {[
            {
              label: 'First Contentful Paint',
              val:
                techStack.pageSpeed.firstContentfulPaintMs !== null
                  ? `${techStack.pageSpeed.firstContentfulPaintMs} ms`
                  : 'N/A',
            },
            { label: 'DOMContentLoaded', val: `${techStack.pageSpeed.domContentLoadedMs} ms` },
            { label: 'Total Load Time', val: `${techStack.pageSpeed.loadTimeMs} ms` },
            { label: 'Network Requests', val: `${techStack.pageSpeed.totalRequests}` },
            { label: 'Estimated Transfer', val: `${techStack.pageSpeed.totalTransferKb} KB` },
          ].map((m) => (
            <div key={m.label} className="bg-white border border-[#E2DDD5] rounded-lg p-5">
              <p className="text-xs text-[#78716C]">{m.label}</p>
              <p className="mt-2 font-mono text-2xl tabular-nums text-[#1C1917]">{m.val}</p>
            </div>
          ))}
        </div>

        {techStack.pageSpeed.breakdownByType.length > 0 && (
          <div className="bg-white border border-[#E2DDD5] rounded-lg p-6 space-y-3">
            <h3 className="font-serif text-lg text-[#1C1917] pb-2 border-b border-[#EFECE6]">
              Transfer Breakdown by Resource Type
            </h3>
            {techStack.pageSpeed.breakdownByType.map((item) => (
              <div key={item.type} className="grid grid-cols-12 items-center gap-3 text-xs">
                <span className="col-span-3 font-mono capitalize text-[#1C1917]">{item.type}</span>
                <div className="col-span-6 h-2.5 bg-[#EFECE6] rounded-xs overflow-hidden">
                  <div
                    className="h-full bg-[#1D3557]"
                    style={{ width: `${Math.max(3, (item.sizeKb / maxKb) * 100)}%` }}
                  />
                </div>
                <span className="col-span-3 text-right font-mono tabular-nums text-[#57534E]">
                  {item.sizeKb} KB · {item.requests} req
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 3. Extracted JS & CSS Assets */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white border border-[#E2DDD5] rounded-lg p-6">
          <div className="flex items-baseline justify-between pb-3 border-b border-[#EFECE6]">
            <h3 className="font-serif text-lg text-[#1C1917]">JavaScript Bundles</h3>
            <span className="text-xs font-mono tabular-nums text-[#78716C]">
              {techStack.scriptUrls.length} files
            </span>
          </div>
          {techStack.scriptUrls.length === 0 ? (
            <p className="mt-4 text-sm text-[#78716C]">No external script URLs discovered.</p>
          ) : (
            <ul className="mt-3 max-h-60 overflow-y-auto divide-y divide-[#EFECE6] text-xs font-mono">
              {techStack.scriptUrls.map((src, idx) => (
                <li key={idx} className="py-2 text-[#57534E] break-all">
                  {src}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="bg-white border border-[#E2DDD5] rounded-lg p-6">
          <div className="flex items-baseline justify-between pb-3 border-b border-[#EFECE6]">
            <h3 className="font-serif text-lg text-[#1C1917]">Stylesheet Assets</h3>
            <span className="text-xs font-mono tabular-nums text-[#78716C]">
              {stylesheetUrls.length} sheets · {techStack.htmlSizeKb} KB HTML
            </span>
          </div>
          {stylesheetUrls.length === 0 ? (
            <p className="mt-4 text-sm text-[#78716C]">
              Styles are injected inline ({techStack.inlineStyleCount} inline style attributes).
            </p>
          ) : (
            <ul className="mt-3 max-h-60 overflow-y-auto divide-y divide-[#EFECE6] text-xs font-mono">
              {stylesheetUrls.map((href, idx) => (
                <li key={idx} className="py-2 text-[#57534E] break-all">
                  {href}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}

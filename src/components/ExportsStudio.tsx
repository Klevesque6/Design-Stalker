import React, { useMemo, useState } from 'react';
import { Archive, Check, Copy, Download, FileCode2, FileText, Printer } from 'lucide-react';
import type { AuditReport } from '../types/audit';
import {
  downloadTextFile,
  downloadZipBundle,
  generateDesignMd,
  generateMarkdownReport,
  generateTailwindConfig,
  generateTokensJson,
} from '../lib/exporters';

interface ExportsStudioProps {
  report: AuditReport;
}

type ExportFileKey = 'design-md' | 'tokens-json' | 'tailwind-config' | 'audit-md';

export function ExportsStudio({ report }: ExportsStudioProps) {
  const [activeFile, setActiveFile] = useState<ExportFileKey>('design-md');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isZipping, setIsZipping] = useState(false);

  const generatedFiles = useMemo(() => {
    return {
      'design-md': {
        filename: 'DESIGN.md',
        label: 'DESIGN.md',
        mime: 'text/markdown;charset=utf-8',
        description: 'Complete human- and AI-readable design system specification for reuse.',
        content: generateDesignMd(report),
      },
      'tokens-json': {
        filename: 'tokens.json',
        label: 'tokens.json',
        mime: 'application/json;charset=utf-8',
        description: 'W3C Design Tokens JSON with exact colors, typography, spacing, shadows, and timings.',
        content: generateTokensJson(report),
      },
      'tailwind-config': {
        filename: 'tailwind.config.ts',
        label: 'tailwind.config.ts',
        mime: 'text/typescript;charset=utf-8',
        description: 'Drop-in Tailwind theme config populated with extracted site tokens.',
        content: generateTailwindConfig(report),
      },
      'audit-md': {
        filename: `${report.domain}-audit-report.md`,
        label: 'Audit Report (.md)',
        mime: 'text/markdown;charset=utf-8',
        description: 'Full UI/UX, Accessibility, IA, Tech Stack, and AI Critique Markdown report.',
        content: generateMarkdownReport(report),
      },
    };
  }, [report]);

  const pageShotCount = useMemo(
    () => report.pages.reduce((sum, p) => sum + Object.keys(p.screenshots).length, 0),
    [report.pages]
  );
  const componentCropCount = useMemo(
    () => report.components.filter((c) => Boolean(c.screenshotDataUrl)).length,
    [report.components]
  );

  const currentFile = generatedFiles[activeFile];

  const handleCopy = () => {
    navigator.clipboard.writeText(currentFile.content).catch(() => undefined);
    setCopiedKey(activeFile);
    setTimeout(() => setCopiedKey(null), 1600);
  };

  const handleDownloadZip = async () => {
    setIsZipping(true);
    try {
      await downloadZipBundle(report);
    } finally {
      setIsZipping(false);
    }
  };

  const handlePrintPdf = () => {
    window.print();
  };

  return (
    <div className="space-y-10">
      {/* Primary Bundle Banner */}
      <section className="bg-white border border-[#E2DDD5] rounded-lg p-6 lg:p-8 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="max-w-2xl">
          <p className="text-xs font-mono uppercase tracking-[0.12em] text-[#78716C]">
            Reusable System Deliverables
          </p>
          <h2 className="mt-1 font-serif text-3xl text-[#1C1917]">
            Export {report.domain} Design Package
          </h2>
          <p className="mt-2 text-sm text-[#57534E] leading-relaxed">
            Download a single ZIP bundle containing <span className="font-mono text-xs">DESIGN.md</span>,{' '}
            <span className="font-mono text-xs">tokens.json</span>,{' '}
            <span className="font-mono text-xs">tailwind.config.ts</span>,{' '}
            <span className="font-mono text-xs">audit-report.md</span>, {pageShotCount} full-page responsive
            screenshots, and {componentCropCount} component crops.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={handlePrintPdf}
            className="h-11 px-4 bg-[#F8F5F0] hover:bg-[#EFECE6] border border-[#E2DDD5] text-[#1C1917] text-sm font-medium rounded-md inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
          >
            <Printer className="w-4 h-4" />
            <span>Print / Save PDF</span>
          </button>
          <button
            type="button"
            onClick={handleDownloadZip}
            disabled={isZipping}
            className="h-11 px-5 bg-[#1D3557] hover:bg-[#152843] disabled:opacity-60 text-white text-sm font-medium rounded-md inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
          >
            <Archive className="w-4 h-4" />
            <span>{isZipping ? 'Packaging ZIP...' : 'Download Full ZIP Bundle'}</span>
          </button>
        </div>
      </section>

      {/* Individual Code & Document Previewer */}
      <section className="bg-white border border-[#E2DDD5] rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-[#E2DDD5] flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#FAF8F4]">
          <div className="inline-flex flex-wrap items-center gap-1 bg-[#EFECE6] p-1 rounded-md">
            {(Object.keys(generatedFiles) as ExportFileKey[]).map((key) => {
              const f = generatedFiles[key];
              const active = activeFile === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActiveFile(key)}
                  className={`px-3 py-1.5 text-xs font-mono rounded transition-colors cursor-pointer whitespace-nowrap ${
                    active
                      ? 'bg-white text-[#1C1917] font-medium border border-[#E2DDD5]'
                      : 'text-[#57534E] hover:text-[#1C1917]'
                  }`}
                >
                  {f.label}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="h-9 px-3.5 bg-white border border-[#E2DDD5] hover:border-[#1D3557] rounded-md text-xs font-medium text-[#1C1917] inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
            >
              {copiedKey === activeFile ? (
                <>
                  <Check className="w-3.5 h-3.5 text-[#15803D]" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Contents</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => downloadTextFile(currentFile.filename, currentFile.content, currentFile.mime)}
              className="h-9 px-3.5 bg-[#1D3557] hover:bg-[#152843] rounded-md text-xs font-medium text-white inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download {currentFile.filename}</span>
            </button>
          </div>
        </div>

        <div className="px-6 py-3 border-b border-[#EFECE6] flex items-center gap-2 text-xs text-[#57534E]">
          {activeFile === 'tokens-json' || activeFile === 'tailwind-config' ? (
            <FileCode2 className="w-4 h-4 text-[#78716C] shrink-0" />
          ) : (
            <FileText className="w-4 h-4 text-[#78716C] shrink-0" />
          )}
          <span>{currentFile.description}</span>
        </div>

        <div className="p-6 max-h-[540px] overflow-auto bg-[#FBF9F5]">
          <pre className="text-xs font-mono text-[#1C1917] leading-relaxed whitespace-pre-wrap break-words">
            {currentFile.content}
          </pre>
        </div>
      </section>

      {/* Quick Screenshot Pack Summary */}
      <section className="space-y-4">
        <div className="pb-3 border-b border-[#E2DDD5] flex items-baseline justify-between">
          <h3 className="font-serif text-xl text-[#1C1917]">Included Screenshot Pack</h3>
          <span className="text-xs font-mono tabular-nums text-[#78716C]">
            {pageShotCount} full pages · {componentCropCount} component crops
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {report.pages.flatMap((page) =>
            (['desktop', 'tablet', 'phone'] as const)
              .filter((vp) => Boolean(page.screenshots[vp]))
              .map((vp) => {
                const shot = page.screenshots[vp]!;
                return (
                  <div
                    key={`${page.url}-${vp}`}
                    className="bg-white border border-[#E2DDD5] rounded-lg overflow-hidden flex flex-col"
                  >
                    <div className="h-32 bg-[#EFECE6] overflow-hidden border-b border-[#EFECE6]">
                      <img
                        src={shot.dataUrl}
                        alt={`${page.path} ${vp}`}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover object-top"
                      />
                    </div>
                    <div className="p-3 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-mono text-[#1C1917] truncate">{page.path}</p>
                        <p className="text-[11px] text-[#78716C] capitalize">
                          {vp} · {shot.width}px
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const a = document.createElement('a');
                          a.href = shot.dataUrl;
                          a.download = `${report.domain}-${page.archetype}-${vp}.jpg`;
                          document.body.appendChild(a);
                          a.click();
                          document.body.removeChild(a);
                        }}
                        title="Download screenshot"
                        className="p-1.5 text-[#57534E] hover:text-[#1D3557] cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
          )}
        </div>
      </section>
    </div>
  );
}

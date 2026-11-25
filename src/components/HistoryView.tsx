import React, { useMemo, useState } from 'react';
import { Clock, Layers, Search, Trash2 } from 'lucide-react';
import type { SavedAuditMeta } from '../lib/historyStore';

interface HistoryViewProps {
  audits: SavedAuditMeta[];
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  onClearAll: () => void;
  onStartNew: () => void;
}

export function HistoryView({ audits, onOpen, onDelete, onClearAll, onStartNew }: HistoryViewProps) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return audits;
    return audits.filter(
      (a) =>
        a.domain.toLowerCase().includes(q) ||
        a.siteTitle.toLowerCase().includes(q) ||
        a.url.toLowerCase().includes(q)
    );
  }, [audits, query]);

  return (
    <div className="max-w-5xl mx-auto px-6 py-12">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6 border-b border-[#E2DDD5]">
        <div>
          <p className="text-xs font-mono uppercase tracking-[0.12em] text-[#78716C]">
            Local Browser Archive (IndexedDB)
          </p>
          <h1 className="mt-1 font-serif text-3xl text-[#1C1917]">Saved Site Audits</h1>
        </div>

        <div className="flex items-center gap-3">
          {audits.length > 0 && (
            <button
              type="button"
              onClick={onClearAll}
              className="text-xs font-medium text-[#78716C] hover:text-[#B91C1C] transition-colors cursor-pointer"
            >
              Clear All
            </button>
          )}
          <button
            type="button"
            onClick={onStartNew}
            className="h-9 px-4 bg-[#1D3557] hover:bg-[#152843] text-white text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap"
          >
            New Audit
          </button>
        </div>
      </div>

      {audits.length > 0 && (
        <div className="mt-6 relative max-w-sm">
          <Search className="w-4 h-4 text-[#78716C] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search saved domains..."
            className="w-full h-10 pl-9 pr-3 bg-white border border-[#E2DDD5] rounded-md text-sm text-[#1C1917] placeholder:text-[#A8A29E] focus:outline-none focus:border-[#1D3557]"
          />
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="mt-8 bg-white border border-[#E2DDD5] rounded-lg p-12 text-center">
          <p className="font-serif text-xl text-[#1C1917]">
            {audits.length === 0 ? 'No saved audits yet' : 'No matching audits found'}
          </p>
          <p className="mt-2 text-sm text-[#57534E]">
            {audits.length === 0
              ? 'Run your first website analysis and Monograph will store the complete visual dossier locally for offline review and export.'
              : 'Try a different domain keyword.'}
          </p>
          {audits.length === 0 && (
            <button
              type="button"
              onClick={onStartNew}
              className="mt-5 h-10 px-5 bg-[#1D3557] hover:bg-[#152843] text-white text-sm font-medium rounded-md transition-colors cursor-pointer"
            >
              Analyze a Website
            </button>
          )}
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-5">
          {filtered.map((audit) => (
            <div
              key={audit.id}
              className="bg-white border border-[#E2DDD5] hover:border-[#A8A29E] rounded-lg overflow-hidden transition-colors flex flex-col"
            >
              <button
                type="button"
                onClick={() => onOpen(audit.id)}
                className="h-44 bg-[#EFECE6] border-b border-[#EFECE6] overflow-hidden text-left cursor-pointer relative"
              >
                {audit.thumbnailDataUrl ? (
                  <img
                    src={audit.thumbnailDataUrl}
                    alt={`${audit.domain} screenshot`}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover object-top"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Layers className="w-6 h-6 text-[#A8A29E]" />
                  </div>
                )}
              </button>
              <div className="p-5 flex-1 flex flex-col justify-between gap-4">
                <div>
                  <div className="flex items-baseline justify-between gap-3">
                    <h2 className="text-base font-semibold text-[#1C1917] truncate">{audit.domain}</h2>
                    <span className="text-xs font-mono tabular-nums text-[#1D3557] font-medium shrink-0">
                      WCAG {audit.accessibilityScore}/100
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-[#57534E] truncate">{audit.siteTitle}</p>
                  <p className="mt-2 text-xs text-[#78716C] font-mono tabular-nums">
                    {audit.pagesCount} {audit.pagesCount === 1 ? 'page' : 'pages'} · {audit.componentsCount} components
                  </p>
                </div>

                <div className="pt-3 border-t border-[#EFECE6] flex items-center justify-between gap-3">
                  <span className="text-xs text-[#78716C] font-mono tabular-nums inline-flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    {new Date(audit.createdAt).toLocaleString()}
                  </span>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => onOpen(audit.id)}
                      className="text-xs font-medium text-[#1D3557] hover:underline underline-offset-4 cursor-pointer"
                    >
                      Open Dossier
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(audit.id)}
                      aria-label={`Delete ${audit.domain}`}
                      className="text-[#78716C] hover:text-[#B91C1C] transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

import React, { useMemo, useState } from 'react';
import { Check, Copy, Download, Maximize2, Search } from 'lucide-react';
import type { ComponentCategory, ComponentInventoryItem } from '../../types/audit';

interface ComponentsTabProps {
  components: ComponentInventoryItem[];
  onInspectImage: (src: string, caption: string) => void;
}

const CATEGORIES: { key: 'all' | ComponentCategory; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'button', label: 'Buttons' },
  { key: 'card', label: 'Cards' },
  { key: 'nav', label: 'Navs' },
  { key: 'form', label: 'Forms' },
  { key: 'modal', label: 'Modals' },
  { key: 'hero', label: 'Heroes' },
  { key: 'footer', label: 'Footers' },
];

export function ComponentsTab({ components, onInspectImage }: ComponentsTabProps) {
  const [activeCategory, setActiveCategory] = useState<'all' | ComponentCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const counts = useMemo(() => {
    const map: Record<string, number> = { all: components.length };
    for (const c of components) {
      map[c.category] = (map[c.category] || 0) + 1;
    }
    return map;
  }, [components]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return components.filter((c) => {
      if (activeCategory !== 'all' && c.category !== activeCategory) return false;
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        c.selector.toLowerCase().includes(q) ||
        c.cssText.toLowerCase().includes(q) ||
        c.pagePath.toLowerCase().includes(q)
      );
    });
  }, [components, activeCategory, searchQuery]);

  const handleCopyCss = (item: ComponentInventoryItem) => {
    navigator.clipboard.writeText(item.cssText).catch(() => undefined);
    setCopiedId(item.id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const handleDownloadCrop = (item: ComponentInventoryItem) => {
    if (!item.screenshotDataUrl) return;
    const a = document.createElement('a');
    a.href = item.screenshotDataUrl;
    a.download = `component-${item.category}-${item.id}.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-4 border-b border-[#E2DDD5]">
        <div>
          <p className="text-xs font-mono text-[#78716C]">Component Inventory</p>
          <h2 className="mt-1 font-serif text-2xl text-[#1C1917]">
            Extracted UI Primitives &amp; Cropped Specimens
          </h2>
        </div>

        <div className="relative w-full lg:w-64">
          <Search className="w-4 h-4 text-[#78716C] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter selector or CSS..."
            className="w-full h-9 pl-9 pr-3 bg-white border border-[#E2DDD5] rounded-md text-xs text-[#1C1917] placeholder:text-[#A8A29E] focus:outline-none focus:border-[#1D3557]"
          />
        </div>
      </div>

      {/* Category Filter Bar */}
      <div className="flex flex-wrap items-center gap-1.5 bg-[#EFECE6] p-1.5 rounded-md w-fit">
        {CATEGORIES.map((cat) => {
          const count = counts[cat.key] || 0;
          const active = activeCategory === cat.key;
          return (
            <button
              key={cat.key}
              type="button"
              onClick={() => setActiveCategory(cat.key)}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                active
                  ? 'bg-white text-[#1C1917] border border-[#E2DDD5]'
                  : 'text-[#57534E] hover:text-[#1C1917]'
              }`}
            >
              {cat.label}{' '}
              <span className="font-mono tabular-nums text-[#78716C] ml-1">{count}</span>
            </button>
          );
        })}
      </div>

      {/* Component Cards */}
      {filtered.length === 0 ? (
        <div className="bg-white border border-[#E2DDD5] rounded-lg p-12 text-center">
          <p className="text-sm text-[#57534E]">
            No components matched this category or search filter on the crawled pages.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filtered.map((item) => (
            <div
              key={item.id}
              className="bg-white border border-[#E2DDD5] rounded-lg overflow-hidden flex flex-col"
            >
              {/* Header */}
              <div className="px-5 py-4 border-b border-[#EFECE6] flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-[#1C1917] truncate">{item.name}</h3>
                  <p className="mt-1 text-xs text-[#78716C] font-mono tabular-nums truncate">
                    {item.category} · {item.pagePath} · {item.width}×{item.height}px
                    {item.instanceCount > 1 ? ` · ${item.instanceCount}×` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {item.screenshotDataUrl && (
                    <button
                      type="button"
                      onClick={() => handleDownloadCrop(item)}
                      title="Download component screenshot"
                      className="p-1.5 text-[#57534E] hover:text-[#1C1917] border border-[#E2DDD5] rounded transition-colors cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleCopyCss(item)}
                    className="px-2.5 py-1.5 text-xs font-medium text-[#1D3557] border border-[#E2DDD5] hover:border-[#1D3557] rounded inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    {copiedId === item.id ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-[#15803D]" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy CSS</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Screenshot Crop Mat */}
              <div className="bg-[#EFECE6] p-5 border-b border-[#EFECE6] flex items-center justify-center min-h-[140px] max-h-[260px] overflow-hidden relative group">
                {item.screenshotDataUrl ? (
                  <>
                    <img
                      src={item.screenshotDataUrl}
                      alt={`${item.name} cropped screenshot`}
                      referrerPolicy="no-referrer"
                      onClick={() =>
                        onInspectImage(item.screenshotDataUrl!, `${item.name} (${item.selector})`)
                      }
                      className="max-h-[220px] max-w-full w-auto h-auto object-contain rounded border border-[#D6CFC4] bg-white cursor-zoom-in"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        onInspectImage(item.screenshotDataUrl!, `${item.name} (${item.selector})`)
                      }
                      aria-label="Inspect crop full size"
                      className="absolute right-3 bottom-3 opacity-0 group-hover:opacity-100 transition-opacity bg-white/95 text-[#1C1917] p-1.5 rounded border border-[#E2DDD5] cursor-pointer"
                    >
                      <Maximize2 className="w-3.5 h-3.5" />
                    </button>
                  </>
                ) : (
                  <div className="text-center px-4">
                    <p className="text-xs font-mono text-[#78716C]">{item.selector}</p>
                    {item.textSnippet && (
                      <p className="mt-1 text-xs text-[#57534E] line-clamp-2">&ldquo;{item.textSnippet}&rdquo;</p>
                    )}
                  </div>
                )}
              </div>

              {/* Extracted CSS Code */}
              <div className="p-4 bg-[#FAF8F4] flex-1">
                <pre className="text-[11px] font-mono text-[#292524] leading-relaxed overflow-x-auto whitespace-pre">
                  {item.cssText}
                </pre>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

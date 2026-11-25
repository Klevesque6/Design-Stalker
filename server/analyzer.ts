import type {
  AccessibilityAnalysis,
  ColorToken,
  ComponentInventoryItem,
  ContrastFailure,
  CrawledPageSummary,
  CTAEntry,
  FontFamilyToken,
  FormAuditItem,
  IAAnalysis,
  IxDAnalysis,
  KeyframeRule,
  MissingAltImage,
  NavMenuItem,
  PageArchetype,
  PageHeadingStructure,
  PseudoStateRule,
  RadiusToken,
  ResponsiveMobileDelta,
  ScrollEffectSignal,
  ShadowToken,
  SitemapNode,
  SpacingToken,
  TechStackAnalysis,
  TransitionRule,
  TrustSignalItem,
  TypeScaleEntry,
  UIAnalysis,
  UserFlowSummary,
  UXAnalysis,
} from '../src/types/audit.ts';

export interface RawPageExtraction {
  url: string;
  path: string;
  title: string;
  archetype: PageArchetype;
  depth: number;
  parentPath: string | null;
  statusCode: number;
  loadTimeMs: number;
  domContentLoadedMs: number;
  firstContentfulPaintMs: number | null;
  wordCount: number;
  htmlSizeKb: number;
  htmlPreview: string;
  faviconUrl: string | null;
  internalLinks: { href: string; path: string; text: string }[];
  colors: {
    hex: string;
    rgb: string;
    role: 'background' | 'surface' | 'text' | 'accent' | 'border';
    sampleUsage: string;
  }[];
  cssVariables: { name: string; value: string }[];
  fonts: {
    family: string;
    weight: string;
    role: 'display' | 'body' | 'mono' | 'other';
    source: 'google-fonts' | 'custom-webfont' | 'system';
  }[];
  typeScaleSamples: {
    level: string;
    fontFamily: string;
    fontSizePx: number;
    fontWeight: string;
    lineHeight: string;
    letterSpacing: string;
    sampleText: string;
  }[];
  spacingValues: { valuePx: number; usage: string }[];
  radii: string[];
  shadows: string[];
  breakpoints: number[];
  containerMaxWidths: number[];
  gridUsageCount: number;
  flexUsageCount: number;
  inlineSvgCount: number;
  iconLibraries: string[];
  images: {
    src: string;
    alt: string | null;
    width: number;
    height: number;
    format: string;
    lazy: boolean;
  }[];
  components: ComponentInventoryItem[];
  pseudoStates: PseudoStateRule[];
  transitions: TransitionRule[];
  keyframes: KeyframeRule[];
  scrollEffects: ScrollEffectSignal[];
  animationLibraries: string[];
  interactiveElementCount: number;
  primaryNavigation: NavMenuItem[];
  footerColumns: { heading: string; links: { label: string; href: string }[] }[];
  headingStructure: PageHeadingStructure;
  ctas: CTAEntry[];
  forms: FormAuditItem[];
  trustSignals: TrustSignalItem[];
  contrastFailures: ContrastFailure[];
  contrastCheckedCount: number;
  ariaStats: AccessibilityAnalysis['ariaStats'];
  keyboardFocus: AccessibilityAnalysis['keyboardFocus'];
  semanticHtml: AccessibilityAnalysis['semanticHtml'];
  techSignals: {
    frameworks: string[];
    cssApproach: string[];
    componentLibraries: string[];
    cmsAndHosting: string[];
    analyticsAndTools: string[];
    stylesheetUrls: string[];
    scriptUrls: string[];
    inlineStyleCount: number;
  };
  networkStats: {
    totalRequests: number;
    totalTransferKb: number;
    byType: Record<string, { requests: number; sizeKb: number }>;
  };
}

export function classifyPageArchetype(urlStr: string, linkText = ''): PageArchetype {
  try {
    const parsed = new URL(urlStr);
    const p = parsed.pathname.toLowerCase();
    const combined = `${p} ${linkText.toLowerCase()}`;
    if (p === '/' || p === '' || p === '/index.html') return 'home';
    if (/checkout|cart|bag|order|payment|billing/.test(combined)) return 'checkout';
    if (/signup|sign-up|register|join|get-started|start-free|trial|login|sign-in|auth/.test(combined)) return 'signup';
    if (/pricing|plans|tiers|subscribe/.test(combined)) return 'pricing';
    if (/product|feature|platform|solution|tour|demo|overview|catalog|shop/.test(combined)) return 'product';
    if (/contact|support|talk-to-sales|book-demo/.test(combined)) return 'contact';
    if (/docs|documentation|api|guide|help|reference/.test(combined)) return 'docs';
    if (/about|company|team|story|mission|careers/.test(combined)) return 'about';
    return 'other';
  } catch {
    return 'other';
  }
}

export function scoreInternalLinkPriority(urlStr: string, linkText: string): number {
  const archetype = classifyPageArchetype(urlStr, linkText);
  const scores: Record<PageArchetype, number> = {
    home: 100,
    pricing: 95,
    product: 92,
    signup: 90,
    checkout: 88,
    contact: 72,
    about: 65,
    docs: 60,
    other: 30,
  };
  let score = scores[archetype];
  try {
    const parsed = new URL(urlStr);
    const segments = parsed.pathname.split('/').filter(Boolean);
    // Prefer shallower paths over deep blog/article slugs
    score -= Math.min(segments.length * 8, 28);
    if (/\.(pdf|zip|png|jpg|jpeg|svg|webp|mp4|xml|json)$/i.test(parsed.pathname)) {
      return -100;
    }
    if (parsed.search && parsed.search.length > 40) {
      score -= 20;
    }
  } catch {
    return -100;
  }
  return score;
}

function detectBaseSpacingUnit(values: number[]): number {
  if (!values.length) return 8;
  const nonZero = values.filter((v) => v >= 4 && v <= 96);
  if (!nonZero.length) return 8;
  const div8 = nonZero.filter((v) => v % 8 === 0).length / nonZero.length;
  const div4 = nonZero.filter((v) => v % 4 === 0).length / nonZero.length;
  const div5 = nonZero.filter((v) => v % 5 === 0).length / nonZero.length;
  if (div8 >= 0.55) return 8;
  if (div4 >= 0.65) return 4;
  if (div5 >= 0.6) return 5;
  return 4;
}

export function aggregateAuditData(
  rawPages: RawPageExtraction[],
  pageSummaries: CrawledPageSummary[],
  mobileDelta: ResponsiveMobileDelta
): {
  ui: UIAnalysis;
  components: ComponentInventoryItem[];
  ixd: IxDAnalysis;
  ia: IAAnalysis;
  ux: UXAnalysis;
  accessibility: AccessibilityAnalysis;
  techStack: TechStackAnalysis;
} {
  // 1. UI Analysis Aggregation
  const colorMap = new Map<
    string,
    { hex: string; rgb: string; count: number; roles: Record<string, number>; sampleUsage: string }
  >();
  let totalColorHits = 0;

  const cssVarMap = new Map<string, string>();
  const fontMap = new Map<
    string,
    { family: string; weights: Set<string>; count: number; role: FontFamilyToken['role']; source: FontFamilyToken['source'] }
  >();
  const typeScaleMap = new Map<string, TypeScaleEntry>();
  const spacingMap = new Map<number, { count: number; usages: Set<string> }>();
  const radiusMap = new Map<string, number>();
  const shadowMap = new Map<string, number>();
  const breakpointSet = new Set<number>();
  const containerWidthSet = new Set<number>();
  let gridUsageCount = 0;
  let flexUsageCount = 0;
  let inlineSvgCount = 0;
  const iconLibSet = new Set<string>();
  const imageFormats: Record<string, number> = {};
  let totalImages = 0;
  let lazyCount = 0;
  const aspectRatios = new Map<string, number>();

  for (const p of rawPages) {
    for (const c of p.colors) {
      totalColorHits++;
      const existing = colorMap.get(c.hex);
      if (existing) {
        existing.count++;
        existing.roles[c.role] = (existing.roles[c.role] || 0) + 1;
      } else {
        colorMap.set(c.hex, {
          hex: c.hex,
          rgb: c.rgb,
          count: 1,
          roles: { [c.role]: 1 },
          sampleUsage: c.sampleUsage,
        });
      }
    }

    for (const v of p.cssVariables) {
      if (!cssVarMap.has(v.name) && cssVarMap.size < 80) {
        cssVarMap.set(v.name, v.value);
      }
    }

    for (const f of p.fonts) {
      const key = f.family.toLowerCase();
      const existing = fontMap.get(key);
      if (existing) {
        existing.count++;
        existing.weights.add(f.weight);
        if (f.role === 'display' && existing.role === 'other') existing.role = 'display';
        if (f.source !== 'system' && existing.source === 'system') existing.source = f.source;
      } else {
        fontMap.set(key, {
          family: f.family,
          weights: new Set([f.weight]),
          count: 1,
          role: f.role,
          source: f.source,
        });
      }
    }

    for (const t of p.typeScaleSamples) {
      const key = `${t.level}|${Math.round(t.fontSizePx)}|${t.fontWeight}`;
      const existing = typeScaleMap.get(key);
      if (existing) {
        existing.count++;
      } else {
        typeScaleMap.set(key, { ...t, count: 1 });
      }
    }

    for (const s of p.spacingValues) {
      const rounded = Math.round(s.valuePx);
      if (rounded <= 0 || rounded > 160) continue;
      const existing = spacingMap.get(rounded);
      if (existing) {
        existing.count++;
        existing.usages.add(s.usage);
      } else {
        spacingMap.set(rounded, { count: 1, usages: new Set([s.usage]) });
      }
    }

    for (const r of p.radii) {
      radiusMap.set(r, (radiusMap.get(r) || 0) + 1);
    }

    for (const sh of p.shadows) {
      shadowMap.set(sh, (shadowMap.get(sh) || 0) + 1);
    }

    p.breakpoints.forEach((b) => breakpointSet.add(b));
    p.containerMaxWidths.forEach((w) => containerWidthSet.add(w));
    gridUsageCount += p.gridUsageCount;
    flexUsageCount += p.flexUsageCount;
    inlineSvgCount += p.inlineSvgCount;
    p.iconLibraries.forEach((l) => iconLibSet.add(l));

    for (const img of p.images) {
      totalImages++;
      if (img.lazy) lazyCount++;
      imageFormats[img.format] = (imageFormats[img.format] || 0) + 1;
      if (img.width > 20 && img.height > 20) {
        const r = img.width / img.height;
        const bucket =
          r > 1.65 ? '16:9 / Wide' : r > 1.2 ? '4:3 / Landscape' : r >= 0.85 ? '1:1 / Square' : '3:4 / Portrait';
        aspectRatios.set(bucket, (aspectRatios.get(bucket) || 0) + 1);
      }
    }
  }

  const colors: ColorToken[] = Array.from(colorMap.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 24)
    .map((entry) => {
      const topRole = (Object.entries(entry.roles).sort((a, b) => b[1] - a[1])[0]?.[0] ||
        'surface') as ColorToken['role'];
      return {
        hex: entry.hex,
        rgb: entry.rgb,
        count: entry.count,
        percentage: totalColorHits > 0 ? Number(((entry.count / totalColorHits) * 100).toFixed(1)) : 0,
        role: topRole,
        sampleUsage: entry.sampleUsage,
      };
    });

  const fonts: FontFamilyToken[] = Array.from(fontMap.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 8)
    .map((f) => ({
      family: f.family,
      weights: Array.from(f.weights).sort((a, b) => Number(a) - Number(b)),
      usageCount: f.count,
      role: f.role,
      source: f.source,
    }));

  const levelRank: Record<string, number> = {
    H1: 1,
    H2: 2,
    H3: 3,
    H4: 4,
    Body: 5,
    Button: 6,
    Small: 7,
  };
  const typeScale: TypeScaleEntry[] = Array.from(typeScaleMap.values())
    .sort((a, b) => (levelRank[a.level] ?? 9) - (levelRank[b.level] ?? 9) || b.fontSizePx - a.fontSizePx)
    .reduce<TypeScaleEntry[]>((acc, item) => {
      if (!acc.some((x) => x.level === item.level && Math.abs(x.fontSizePx - item.fontSizePx) < 2)) {
        acc.push(item);
      }
      return acc;
    }, [])
    .slice(0, 12);

  const spacingRawList = Array.from(spacingMap.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 14);
  const baseSpacingUnitPx = detectBaseSpacingUnit(spacingRawList.map(([val]) => val));

  const spacing: SpacingToken[] = spacingRawList
    .sort((a, b) => a[0] - b[0])
    .map(([valuePx, info]) => ({
      valuePx,
      label: `${valuePx}px (${(valuePx / 16).toFixed(valuePx % 4 === 0 ? 2 : 3).replace(/\.?0+$/, '')}rem)`,
      count: info.count,
      usage: Array.from(info.usages).slice(0, 2).join(', '),
    }));

  const borderRadii: RadiusToken[] = Array.from(radiusMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([value, count]) => ({ value, count }));

  const shadows: ShadowToken[] = Array.from(shadowMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([value, count], idx) => ({
      value,
      count,
      tier: ['Elevation 1 (Subtle)', 'Elevation 2 (Card)', 'Elevation 3 (Floating)', 'Elevation 4 (Modal)', 'Elevation 5', 'Elevation 6'][idx] || `Elevation ${idx + 1}`,
    }));

  const breakpoints = Array.from(breakpointSet)
    .filter((b) => b >= 320 && b <= 1920)
    .sort((a, b) => a - b)
    .slice(0, 10);

  const containerMaxWidths = Array.from(containerWidthSet)
    .filter((w) => w >= 640 && w <= 1600)
    .sort((a, b) => a - b)
    .slice(0, 6);

  const dominantAspectRatios = Array.from(aspectRatios.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([ratio, count]) => ({ ratio, count }));

  const topFormat = Object.entries(imageFormats).sort((a, b) => b[1] - a[1])[0]?.[0] || 'mixed';
  const lazyLoadedPercent = totalImages > 0 ? Math.round((lazyCount / totalImages) * 100) : 0;

  const ui: UIAnalysis = {
    colors,
    cssVariables: Array.from(cssVarMap.entries()).map(([name, value]) => ({ name, value })),
    fonts,
    typeScale,
    spacing,
    borderRadii,
    shadows,
    layout: {
      breakpoints,
      containerMaxWidths,
      gridUsageCount,
      flexUsageCount,
      detectedGridSystem:
        gridUsageCount > flexUsageCount * 0.4
          ? 'Hybrid CSS Grid + Flexbox architecture'
          : flexUsageCount > 0
            ? 'Flexbox-led responsive column layout'
            : 'Classic flow / block container layout',
      baseSpacingUnitPx,
    },
    mediaProfile: {
      iconLibraries: Array.from(iconLibSet),
      inlineSvgCount,
      totalImages,
      imageFormats,
      lazyLoadedPercent,
      dominantAspectRatios,
      imageStyleSummary:
        totalImages === 0
          ? 'Typography and vector-driven interface with minimal raster photography.'
          : `${totalImages} raster images (${topFormat.toUpperCase()} primary, ${lazyLoadedPercent}% lazy-loaded) paired with ${inlineSvgCount} inline SVGs.`,
    },
  };

  // 2. Components Aggregation (deduplicate by category + name + selector signature)
  const componentMap = new Map<string, ComponentInventoryItem>();
  for (const p of rawPages) {
    for (const comp of p.components) {
      const sig = `${comp.category}|${comp.selector.slice(0, 48)}|${Math.round(comp.width / 20)}x${Math.round(comp.height / 20)}`;
      const existing = componentMap.get(sig);
      if (existing) {
        existing.instanceCount += comp.instanceCount;
        if (!existing.screenshotDataUrl && comp.screenshotDataUrl) {
          existing.screenshotDataUrl = comp.screenshotDataUrl;
        }
      } else {
        componentMap.set(sig, { ...comp });
      }
    }
  }
  const components = Array.from(componentMap.values()).slice(0, 42);

  // 3. IxD Aggregation
  const pseudoMap = new Map<string, PseudoStateRule>();
  const transitionMap = new Map<string, TransitionRule>();
  const keyframeMap = new Map<string, KeyframeRule>();
  const scrollMap = new Map<string, ScrollEffectSignal>();
  const animLibSet = new Set<string>();
  let interactiveElementCount = 0;

  for (const p of rawPages) {
    interactiveElementCount += p.interactiveElementCount;
    for (const ps of p.pseudoStates) {
      const k = `${ps.state}|${ps.selector}`;
      if (!pseudoMap.has(k) && pseudoMap.size < 45) pseudoMap.set(k, ps);
    }
    for (const tr of p.transitions) {
      const k = `${tr.property}|${tr.duration}|${tr.timingFunction}`;
      if (!transitionMap.has(k) && transitionMap.size < 30) transitionMap.set(k, tr);
    }
    for (const kf of p.keyframes) {
      const existing = keyframeMap.get(kf.name);
      if (existing) existing.usedByCount += kf.usedByCount;
      else if (keyframeMap.size < 25) keyframeMap.set(kf.name, { ...kf });
    }
    for (const se of p.scrollEffects) {
      const existing = scrollMap.get(se.type);
      if (existing) existing.count += se.count;
      else scrollMap.set(se.type, { ...se });
    }
    p.animationLibraries.forEach((l) => animLibSet.add(l));
  }

  const ixd: IxDAnalysis = {
    pseudoStates: Array.from(pseudoMap.values()),
    transitions: Array.from(transitionMap.values()),
    keyframes: Array.from(keyframeMap.values()),
    scrollEffects: Array.from(scrollMap.values()),
    animationLibraries: Array.from(animLibSet),
    interactiveElementCount,
  };

  // 4. IA Aggregation
  const inboundCounts = new Map<string, number>();
  for (const p of rawPages) {
    for (const link of p.internalLinks) {
      inboundCounts.set(link.path, (inboundCounts.get(link.path) || 0) + 1);
    }
  }

  const sitemap: SitemapNode[] = rawPages.map((p) => ({
    url: p.url,
    path: p.path,
    title: p.title || p.path,
    archetype: p.archetype,
    depth: p.depth,
    parentPath: p.parentPath,
    inboundLinks: inboundCounts.get(p.path) || (p.depth === 0 ? 1 : 0),
    outboundLinks: p.internalLinks.length,
  }));

  const homeRaw = rawPages[0];
  const ia: IAAnalysis = {
    sitemap,
    primaryNavigation: homeRaw?.primaryNavigation || [],
    footerColumns: homeRaw?.footerColumns || [],
    headingStructures: rawPages.map((p) => p.headingStructure),
  };

  // 5. UX Aggregation
  const ctaMap = new Map<string, CTAEntry>();
  const allForms: FormAuditItem[] = [];
  const allTrustSignals: TrustSignalItem[] = [];
  const trustDedup = new Set<string>();

  for (const p of rawPages) {
    for (const c of p.ctas) {
      const key = `${c.text.toLowerCase()}|${c.placement}`;
      const existing = ctaMap.get(key);
      if (existing) {
        existing.repeatCount += 1;
      } else {
        ctaMap.set(key, { ...c, repeatCount: 1 });
      }
    }
    allForms.push(...p.forms);
    for (const ts of p.trustSignals) {
      const key = `${ts.category}|${ts.label.toLowerCase().slice(0, 40)}`;
      if (!trustDedup.has(key)) {
        trustDedup.add(key);
        allTrustSignals.push(ts);
      }
    }
  }

  const findFlow = (
    name: string,
    archetypes: PageArchetype[],
    ctaRegex: RegExp,
    defaultSteps: number
  ): UserFlowSummary => {
    const matchedPage = rawPages.find((p) => archetypes.includes(p.archetype));
    const matchedCta = Array.from(ctaMap.values()).find((c) => ctaRegex.test(c.text) || ctaRegex.test(c.href));
    const relatedForm = allForms.find((f) =>
      matchedPage ? f.pagePath === matchedPage.path : ctaRegex.test(f.purpose) || ctaRegex.test(f.submitLabel)
    );
    const detected = Boolean(matchedPage || matchedCta || relatedForm);
    return {
      name,
      detected,
      entryPage: matchedCta?.pagePath || '/',
      targetUrl: matchedPage?.url || matchedCta?.href || null,
      estimatedSteps: relatedForm?.isMultiStep ? defaultSteps + 1 : defaultSteps,
      notes: detected
        ? matchedPage
          ? `Dedicated ${matchedPage.archetype} page captured at ${matchedPage.path}${relatedForm ? ` with ${relatedForm.fieldCount} form field(s)` : ''}.`
          : `Initiated via "${matchedCta?.text || 'form action'}" CTA from ${matchedCta?.pagePath || '/'}.`
        : 'Not detected within the crawled page set.',
    };
  };

  const flows: UserFlowSummary[] = [
    findFlow('Signup / Onboarding', ['signup'], /sign\s*up|get\s*started|start\s*free|register|trial|create\s*account/i, 2),
    findFlow('Pricing & Plan Selection', ['pricing'], /pricing|plans|upgrade|subscribe/i, 2),
    findFlow('Checkout / Purchase', ['checkout'], /checkout|cart|buy|order|add\s*to\s*bag/i, 3),
    findFlow('Contact / Sales Inquiry', ['contact'], /contact|demo|sales|talk\s*to/i, 2),
  ];

  const ux: UXAnalysis = {
    flows,
    ctas: Array.from(ctaMap.values())
      .sort((a, b) => b.repeatCount - a.repeatCount)
      .slice(0, 28),
    forms: allForms.slice(0, 20),
    trustSignals: allTrustSignals.slice(0, 18),
    mobileDelta,
  };

  // 6. Accessibility Aggregation & Deterministic Score (0–100)
  const contrastFailures: ContrastFailure[] = [];
  const contrastDedup = new Set<string>();
  let contrastCheckedCount = 0;
  const missingAltImages: MissingAltImage[] = [];
  const altDedup = new Set<string>();
  let totalImagesChecked = 0;

  let hasMain = false;
  let hasNav = false;
  let hasHeader = false;
  let hasFooter = false;
  let unlabeledButtons = 0;
  let unlabeledInputs = 0;
  let ariaAttributesCount = 0;
  let hasSkipLink = false;
  let focusableElementsCount = 0;
  let outlineRemovedWithoutFallback = 0;
  let positiveTabIndexCount = 0;
  let hasLangAttribute = true;
  let langValue = '';
  let hasDocumentTitle = true;
  let headingOrderValid = true;
  let semanticRatioSum = 0;

  for (const p of rawPages) {
    contrastCheckedCount += p.contrastCheckedCount;
    for (const cf of p.contrastFailures) {
      const k = `${cf.foregroundHex}|${cf.backgroundHex}|${cf.textSnippet.slice(0, 25)}`;
      if (!contrastDedup.has(k) && contrastFailures.length < 35) {
        contrastDedup.add(k);
        contrastFailures.push(cf);
      }
    }
    for (const img of p.images) {
      totalImagesChecked++;
      if ((img.alt === null || img.alt.trim() === '') && img.width >= 24 && img.height >= 24) {
        const k = `${p.path}|${img.src}`;
        if (!altDedup.has(k) && missingAltImages.length < 30) {
          altDedup.add(k);
          missingAltImages.push({ src: img.src, pagePath: p.path, width: img.width, height: img.height });
        }
      }
    }

    if (p.ariaStats.hasMainLandmark) hasMain = true;
    if (p.ariaStats.hasNavLandmark) hasNav = true;
    if (p.ariaStats.hasHeaderLandmark) hasHeader = true;
    if (p.ariaStats.hasFooterLandmark) hasFooter = true;
    unlabeledButtons += p.ariaStats.unlabeledButtons;
    unlabeledInputs += p.ariaStats.unlabeledInputs;
    ariaAttributesCount += p.ariaStats.ariaAttributesCount;

    if (p.keyboardFocus.hasSkipLink) hasSkipLink = true;
    focusableElementsCount += p.keyboardFocus.focusableElementsCount;
    outlineRemovedWithoutFallback += p.keyboardFocus.outlineRemovedWithoutFallback;
    positiveTabIndexCount += p.keyboardFocus.positiveTabIndexCount;

    if (!p.semanticHtml.hasLangAttribute) hasLangAttribute = false;
    if (!langValue && p.semanticHtml.langValue) langValue = p.semanticHtml.langValue;
    if (!p.semanticHtml.hasDocumentTitle) hasDocumentTitle = false;
    if (!p.semanticHtml.headingOrderValid) headingOrderValid = false;
    semanticRatioSum += p.semanticHtml.semanticTagsRatio;
  }

  // Deterministic penalty model starting from 100
  let score = 100;
  score -= Math.min(28, contrastFailures.length * 3.5);
  score -= Math.min(18, missingAltImages.length * 3);
  score -= Math.min(14, (unlabeledButtons + unlabeledInputs) * 3.5);
  if (!hasMain) score -= 7;
  if (!hasNav) score -= 4;
  if (!hasLangAttribute) score -= 6;
  if (!hasDocumentTitle) score -= 5;
  if (!headingOrderValid) score -= 6;
  if (!hasSkipLink) score -= 3;
  score -= Math.min(10, outlineRemovedWithoutFallback * 2);
  score -= Math.min(6, positiveTabIndexCount * 2);
  score = Math.max(0, Math.min(100, Math.round(score)));

  const grade: AccessibilityAnalysis['grade'] =
    score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 70 ? 'C' : score >= 55 ? 'D' : 'F';

  const accessibility: AccessibilityAnalysis = {
    score,
    grade,
    contrastFailures,
    contrastCheckedCount,
    missingAltImages,
    totalImagesChecked,
    ariaStats: {
      hasMainLandmark: hasMain,
      hasNavLandmark: hasNav,
      hasHeaderLandmark: hasHeader,
      hasFooterLandmark: hasFooter,
      unlabeledButtons,
      unlabeledInputs,
      ariaAttributesCount,
    },
    keyboardFocus: {
      hasSkipLink,
      focusableElementsCount,
      outlineRemovedWithoutFallback,
      positiveTabIndexCount,
    },
    semanticHtml: {
      hasLangAttribute,
      langValue: langValue || 'missing',
      hasDocumentTitle,
      headingOrderValid,
      semanticTagsRatio: rawPages.length > 0 ? Number((semanticRatioSum / rawPages.length).toFixed(2)) : 0,
    },
  };

  // 7. Tech Stack Aggregation
  const frameworks = new Set<string>();
  const cssApproach = new Set<string>();
  const componentLibraries = new Set<string>();
  const cmsAndHosting = new Set<string>();
  const analyticsAndTools = new Set<string>();
  const scriptUrls = new Set<string>();
  const stylesheetUrls = new Set<string>();
  let inlineStyleCount = 0;

  for (const p of rawPages) {
    p.techSignals.frameworks.forEach((x) => frameworks.add(x));
    p.techSignals.cssApproach.forEach((x) => cssApproach.add(x));
    p.techSignals.componentLibraries.forEach((x) => componentLibraries.add(x));
    p.techSignals.cmsAndHosting.forEach((x) => cmsAndHosting.add(x));
    p.techSignals.analyticsAndTools.forEach((x) => analyticsAndTools.add(x));
    p.techSignals.scriptUrls.forEach((x) => scriptUrls.add(x));
    p.techSignals.stylesheetUrls.forEach((x) => stylesheetUrls.add(x));
    inlineStyleCount += p.techSignals.inlineStyleCount;
  }

  const homeNet = homeRaw?.networkStats || { totalRequests: 0, totalTransferKb: 0, byType: {} };
  const breakdownByType = Object.entries(homeNet.byType)
    .map(([type, stat]) => ({
      type,
      requests: stat.requests,
      sizeKb: Math.round(stat.sizeKb),
    }))
    .sort((a, b) => b.sizeKb - a.sizeKb);

  const techStack: TechStackAnalysis = {
    frameworks: Array.from(frameworks),
    cssApproach: Array.from(cssApproach),
    componentLibraries: Array.from(componentLibraries),
    cmsAndHosting: Array.from(cmsAndHosting),
    analyticsAndTools: Array.from(analyticsAndTools),
    scriptUrls: Array.from(scriptUrls).slice(0, 60),
    stylesheetCount: stylesheetUrls.size,
    inlineStyleCount,
    htmlSizeKb: homeRaw ? Math.round(homeRaw.htmlSizeKb) : 0,
    pageSpeed: {
      domContentLoadedMs: homeRaw?.domContentLoadedMs || 0,
      loadTimeMs: homeRaw?.loadTimeMs || pageSummaries[0]?.loadTimeMs || 0,
      firstContentfulPaintMs: homeRaw?.firstContentfulPaintMs ?? null,
      totalRequests: homeNet.totalRequests,
      totalTransferKb: Math.round(homeNet.totalTransferKb),
      breakdownByType,
    },
  };

  return { ui, components, ixd, ia, ux, accessibility, techStack };
}

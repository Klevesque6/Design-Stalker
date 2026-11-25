import crypto from 'node:crypto';
import fs from 'node:fs';
import { chromium, type Browser, type Page } from 'playwright-core';
import type {
  AuditConfig,
  AuditReport,
  ComponentCategory,
  ComponentInventoryItem,
  CrawledPageSummary,
  CrawlProgressEvent,
  PseudoStateRule,
  ResponsiveMobileDelta,
  ViewportKey,
  ViewportScreenshot,
} from '../src/types/audit.ts';
import {
  aggregateAuditData,
  classifyPageArchetype,
  scoreInternalLinkPriority,
  type RawPageExtraction,
} from './analyzer.ts';
import { generateGroundedAICritique } from './aiCritique.ts';
import { isQuickBlockedUrl, validatePublicTargetUrl } from './urlGuard.ts';

const VIEWPORT_SPECS: Record<ViewportKey, { width: number; height: number; isMobile: boolean }> = {
  desktop: { width: 1440, height: 900, isMobile: false },
  tablet: { width: 768, height: 1024, isMobile: false },
  phone: { width: 390, height: 844, isMobile: true },
};

function findChromiumExecutable(): string | undefined {
  const candidates = [
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    '/ms-playwright/chrome-headless-shell-linux64/chrome-headless-shell',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome',
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return undefined;
}

interface ComponentCandidateDOM {
  category: ComponentCategory;
  name: string;
  selector: string;
  textSnippet: string;
  x: number;
  y: number;
  width: number;
  height: number;
  cssText: string;
  computedStyles: Record<string, string>;
}

interface PageDomEvalResult {
  title: string;
  wordCount: number;
  htmlSizeKb: number;
  htmlPreview: string;
  faviconUrl: string | null;
  domContentLoadedMs: number;
  firstContentfulPaintMs: number | null;
  internalLinks: { href: string; path: string; text: string }[];
  colors: RawPageExtraction['colors'];
  cssVariables: RawPageExtraction['cssVariables'];
  fonts: RawPageExtraction['fonts'];
  typeScaleSamples: RawPageExtraction['typeScaleSamples'];
  spacingValues: RawPageExtraction['spacingValues'];
  radii: string[];
  shadows: string[];
  breakpoints: number[];
  containerMaxWidths: number[];
  gridUsageCount: number;
  flexUsageCount: number;
  inlineSvgCount: number;
  iconLibraries: string[];
  images: RawPageExtraction['images'];
  componentCandidates: ComponentCandidateDOM[];
  pseudoStates: PseudoStateRule[];
  transitions: RawPageExtraction['transitions'];
  keyframes: RawPageExtraction['keyframes'];
  scrollEffects: RawPageExtraction['scrollEffects'];
  animationLibraries: string[];
  interactiveElementCount: number;
  primaryNavigation: RawPageExtraction['primaryNavigation'];
  footerColumns: RawPageExtraction['footerColumns'];
  headingStructure: RawPageExtraction['headingStructure'];
  ctas: RawPageExtraction['ctas'];
  forms: RawPageExtraction['forms'];
  trustSignals: RawPageExtraction['trustSignals'];
  contrastFailures: RawPageExtraction['contrastFailures'];
  contrastCheckedCount: number;
  ariaStats: RawPageExtraction['ariaStats'];
  keyboardFocus: RawPageExtraction['keyboardFocus'];
  semanticHtml: RawPageExtraction['semanticHtml'];
  techSignals: RawPageExtraction['techSignals'];
  desktopH1Px: number | null;
  desktopBodyPx: number | null;
  desktopVisibleCount: number;
  desktopNavLinksCount: number;
}

async function captureViewportScreenshot(
  page: Page,
  viewport: ViewportKey,
  maxClipHeight = 5200
): Promise<ViewportScreenshot> {
  const spec = VIEWPORT_SPECS[viewport];
  await page.setViewportSize({ width: spec.width, height: spec.height });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(280);

  const dims = await page.evaluate(() => ({
    scrollHeight: Math.max(document.documentElement.scrollHeight, document.body?.scrollHeight || 0, 600),
    scrollWidth: Math.max(document.documentElement.scrollWidth, document.body?.scrollWidth || 0),
  }));

  const captureHeight = Math.min(dims.scrollHeight, maxClipHeight);
  const buffer = await page.screenshot({
    type: 'jpeg',
    quality: 74,
    clip: { x: 0, y: 0, width: spec.width, height: captureHeight },
    animations: 'disabled',
  });

  return {
    viewport,
    width: spec.width,
    height: spec.height,
    fullHeight: dims.scrollHeight,
    dataUrl: `data:image/jpeg;base64,${buffer.toString('base64')}`,
  };
}

async function probeLiveHoverStates(page: Page): Promise<PseudoStateRule[]> {
  const results: PseudoStateRule[] = [];
  try {
    const targets = page.locator('a:visible, button:visible');
    const count = Math.min(await targets.count(), 6);

    for (let i = 0; i < count; i++) {
      const el = targets.nth(i);
      const box = await el.boundingBox().catch(() => null);
      if (!box || box.width < 24 || box.height < 18 || box.y > 1200) continue;

      const before = await el
        .evaluate((node) => {
          const cs = getComputedStyle(node);
          const tag = node.tagName.toLowerCase();
          const label = (node.textContent || '').trim().slice(0, 24);
          return {
            selector: label ? `${tag} ("${label}")` : tag,
            backgroundColor: cs.backgroundColor,
            color: cs.color,
            borderColor: cs.borderColor,
            opacity: cs.opacity,
            transform: cs.transform,
            boxShadow: cs.boxShadow,
            textDecorationLine: cs.textDecorationLine,
          };
        })
        .catch(() => null);

      if (!before) continue;

      await el.hover({ timeout: 1200, force: true }).catch(() => undefined);
      await page.waitForTimeout(160);

      const after = await el
        .evaluate((node) => {
          const cs = getComputedStyle(node);
          return {
            backgroundColor: cs.backgroundColor,
            color: cs.color,
            borderColor: cs.borderColor,
            opacity: cs.opacity,
            transform: cs.transform,
            boxShadow: cs.boxShadow,
            textDecorationLine: cs.textDecorationLine,
          };
        })
        .catch(() => null);

      if (!after) continue;
      const diff: Record<string, string> = {};
      const keys = ['backgroundColor', 'color', 'borderColor', 'opacity', 'transform', 'boxShadow', 'textDecorationLine'] as const;
      for (const k of keys) {
        if (before[k] !== after[k]) {
          diff[k] = `${before[k]} → ${after[k]}`;
        }
      }
      if (Object.keys(diff).length > 0) {
        results.push({
          selector: before.selector,
          state: 'hover',
          properties: diff,
        });
      }
    }
    // Reset pointer away from elements
    await page.mouse.move(0, 0).catch(() => undefined);
  } catch {
    // Non-fatal hover probe
  }
  return results;
}

async function extractPageDOM(page: Page, pageUrl: string, pagePath: string, responseHeaders: Record<string, string>): Promise<PageDomEvalResult> {
  await page.evaluate('globalThis.__name = globalThis.__name || function(t) { return t; };');
  return page.evaluate(
    ({ urlStr, pathStr, headers }) => {
      const origin = window.location.origin;

      function parseRgba(str: string): { r: number; g: number; b: number; a: number } | null {
        if (!str || str === 'transparent') return null;
        const m = str.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+))?\s*\)/i);
        if (!m) return null;
        const r = Math.round(Number(m[1]));
        const g = Math.round(Number(m[2]));
        const b = Math.round(Number(m[3]));
        const a = m[4] !== undefined ? Number(m[4]) : 1;
        if (a <= 0.04) return null;
        return { r, g, b, a };
      }

      function rgbToHex(r: number, g: number, b: number): string {
        return (
          '#' +
          [r, g, b]
            .map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0'))
            .join('')
            .toUpperCase()
        );
      }

      function relativeLuminance(r: number, g: number, b: number): number {
        const [rs, gs, bs] = [r, g, b].map((c) => {
          const s = c / 255;
          return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
        });
        return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
      }

      function contrastRatio(c1: { r: number; g: number; b: number }, c2: { r: number; g: number; b: number }): number {
        const l1 = relativeLuminance(c1.r, c1.g, c1.b);
        const l2 = relativeLuminance(c2.r, c2.g, c2.b);
        const lighter = Math.max(l1, l2);
        const darker = Math.min(l1, l2);
        return (lighter + 0.05) / (darker + 0.05);
      }

      function getEffectiveBackground(el: Element): { r: number; g: number; b: number; a: number } {
        let cur: Element | null = el;
        while (cur) {
          const bg = parseRgba(getComputedStyle(cur).backgroundColor);
          if (bg && bg.a >= 0.85) return bg;
          cur = cur.parentElement;
        }
        return { r: 255, g: 255, b: 255, a: 1 };
      }

      function isVisible(el: Element): boolean {
        const style = getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      }

      function shortSelector(el: Element): string {
        const tag = el.tagName.toLowerCase();
        if (el.id) return `${tag}#${el.id.slice(0, 28)}`;
        const cls =
          typeof el.className === 'string'
            ? el.className
                .trim()
                .split(/\s+/)
                .filter((c) => c && !c.includes(':') && c.length < 28)
                .slice(0, 2)
                .join('.')
            : '';
        return cls ? `${tag}.${cls}` : tag;
      }

      // 1. Performance timing
      const navEntry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
      const paintEntries = performance.getEntriesByType('paint');
      const fcpEntry = paintEntries.find((e) => e.name === 'first-contentful-paint');
      const domContentLoadedMs = navEntry ? Math.round(navEntry.domContentLoadedEventEnd) : 0;
      const firstContentfulPaintMs = fcpEntry ? Math.round(fcpEntry.startTime) : null;

      // 2. HTML & Meta basics
      const fullHtml = document.documentElement.outerHTML || '';
      const htmlSizeKb = fullHtml.length / 1024;
      const htmlPreview = fullHtml.slice(0, 6000);
      const faviconEl = document.querySelector('link[rel~="icon"]') as HTMLLinkElement | null;
      const faviconUrl = faviconEl?.href || null;
      const textContent = (document.body?.innerText || '').trim();
      const wordCount = textContent ? textContent.split(/\s+/).length : 0;

      // 3. Google Fonts & loaded web fonts detection
      const googleFontHrefs = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
        .map((l) => (l as HTMLLinkElement).href)
        .filter((h) => /fonts\.googleapis\.com|fonts\.bunny\.net|use\.typekit\.net/i.test(h));
      const loadedWebFontFamilies = new Set<string>();
      if (document.fonts) {
        document.fonts.forEach((f) => {
          if (f.status === 'loaded') {
            loadedWebFontFamilies.add(f.family.replace(/['"]/g, '').toLowerCase());
          }
        });
      }

      const systemFonts = new Set([
        '-apple-system',
        'blinkmacsystemfont',
        'segoe ui',
        'arial',
        'helvetica',
        'helvetica neue',
        'sans-serif',
        'serif',
        'monospace',
        'ui-sans-serif',
        'ui-serif',
        'ui-monospace',
        'system-ui',
        'georgia',
        'times new roman',
      ]);

      // 4. Walk visible elements for colors, fonts, spacing, radii, shadows, layout, transitions, contrast
      const allEls = Array.from(document.querySelectorAll('body, body *')).slice(0, 900);
      const colors: PageDomEvalResult['colors'] = [];
      const fonts: PageDomEvalResult['fonts'] = [];
      const typeScaleSamples: PageDomEvalResult['typeScaleSamples'] = [];
      const spacingValues: PageDomEvalResult['spacingValues'] = [];
      const radii: string[] = [];
      const shadows: string[] = [];
      const containerMaxWidths: number[] = [];
      const transitions: PageDomEvalResult['transitions'] = [];
      const contrastFailures: PageDomEvalResult['contrastFailures'] = [];
      let contrastCheckedCount = 0;
      let gridUsageCount = 0;
      let flexUsageCount = 0;
      let stickyCount = 0;
      let snapCount = 0;
      let parallaxCount = 0;
      let scrollAnimAttrCount = 0;
      let interactiveElementCount = 0;
      let tailwindScore = 0;
      let inlineStyleCount = 0;
      let visibleCount = 0;
      let desktopH1Px: number | null = null;
      let desktopBodyPx: number | null = null;

      const bodyCs = document.body ? getComputedStyle(document.body) : null;
      if (bodyCs) {
        desktopBodyPx = Math.round(parseFloat(bodyCs.fontSize) || 16);
      }

      for (const el of allEls) {
        if (!isVisible(el)) continue;
        visibleCount++;
        const cs = getComputedStyle(el);
        const tag = el.tagName.toLowerCase();
        const rect = el.getBoundingClientRect();

        if (el.hasAttribute('style')) inlineStyleCount++;
        if (typeof el.className === 'string' && /(?:^|\s)(?:flex|grid|px-\d|py-\d|mx-auto|rounded-|text-(?:sm|base|lg|xl)|bg-[a-z]+-\d{2,3})(?:\s|$)/.test(el.className)) {
          tailwindScore++;
        }

        // Layout
        if (cs.display.includes('grid')) gridUsageCount++;
        if (cs.display.includes('flex')) flexUsageCount++;
        if (cs.position === 'sticky' || cs.position === 'fixed') stickyCount++;
        if (cs.scrollSnapType && cs.scrollSnapType !== 'none') snapCount++;
        if (el.hasAttribute('data-aos') || el.hasAttribute('data-scroll') || el.hasAttribute('data-framer-appear-id')) {
          scrollAnimAttrCount++;
        }
        if (cs.willChange.includes('transform') || (cs.backgroundAttachment === 'fixed' && cs.backgroundImage !== 'none')) {
          parallaxCount++;
        }

        const mw = parseFloat(cs.maxWidth);
        if (!Number.isNaN(mw) && mw >= 640 && mw <= 1600) {
          containerMaxWidths.push(Math.round(mw));
        }

        // Colors
        const bg = parseRgba(cs.backgroundColor);
        if (bg) {
          const hex = rgbToHex(bg.r, bg.g, bg.b);
          const isSat = Math.max(bg.r, bg.g, bg.b) - Math.min(bg.r, bg.g, bg.b) > 35;
          const role =
            tag === 'body' || tag === 'html'
              ? 'background'
              : isSat && (tag === 'button' || tag === 'a')
                ? 'accent'
                : 'surface';
          colors.push({ hex, rgb: `rgb(${bg.r}, ${bg.g}, ${bg.b})`, role, sampleUsage: shortSelector(el) });
        }

        const fg = parseRgba(cs.color);
        const directText = Array.from(el.childNodes)
          .filter((n) => n.nodeType === Node.TEXT_NODE)
          .map((n) => (n.textContent || '').trim())
          .join(' ')
          .trim();

        if (fg && directText.length > 0) {
          const hex = rgbToHex(fg.r, fg.g, fg.b);
          const isSat = Math.max(fg.r, fg.g, fg.b) - Math.min(fg.r, fg.g, fg.b) > 40;
          colors.push({
            hex,
            rgb: `rgb(${fg.r}, ${fg.g}, ${fg.b})`,
            role: isSat && tag === 'a' ? 'accent' : 'text',
            sampleUsage: shortSelector(el),
          });

          // Real WCAG 2.1 luminance contrast check
          if (directText.length >= 2 && rect.width >= 8 && rect.height >= 8) {
            contrastCheckedCount++;
            const effBg = getEffectiveBackground(el);
            const ratio = contrastRatio(fg, effBg);
            const fontSizePx = parseFloat(cs.fontSize) || 16;
            const fontWeightNum = parseInt(cs.fontWeight, 10) || 400;
            const isLarge = fontSizePx >= 24 || (fontSizePx >= 18.66 && fontWeightNum >= 700);
            const requiredRatio = isLarge ? 3.0 : 4.5;
            if (ratio < requiredRatio && contrastFailures.length < 25) {
              contrastFailures.push({
                selector: shortSelector(el),
                textSnippet: directText.slice(0, 60),
                foregroundHex: hex,
                backgroundHex: rgbToHex(effBg.r, effBg.g, effBg.b),
                ratio: Number(ratio.toFixed(2)),
                requiredRatio,
                fontSizePx: Math.round(fontSizePx),
                pagePath: pathStr,
              });
            }
          }
        }

        const borderCol = parseRgba(cs.borderTopColor);
        if (borderCol && parseFloat(cs.borderTopWidth) > 0) {
          colors.push({
            hex: rgbToHex(borderCol.r, borderCol.g, borderCol.b),
            rgb: `rgb(${borderCol.r}, ${borderCol.g}, ${borderCol.b})`,
            role: 'border',
            sampleUsage: shortSelector(el),
          });
        }

        // Fonts & Type Scale
        const primaryFont = (cs.fontFamily.split(',')[0] || '').replace(/['"]/g, '').trim();
        if (primaryFont && directText.length > 0) {
          const fLower = primaryFont.toLowerCase();
          const role =
            tag === 'code' || tag === 'pre' || fLower.includes('mono')
              ? 'mono'
              : ['h1', 'h2', 'h3'].includes(tag)
                ? 'display'
                : 'body';
          const source = googleFontHrefs.some((h) => h.toLowerCase().includes(fLower.replace(/\s+/g, '+')))
            ? 'google-fonts'
            : loadedWebFontFamilies.has(fLower) && !systemFonts.has(fLower)
              ? 'custom-webfont'
              : 'system';

          fonts.push({ family: primaryFont, weight: cs.fontWeight, role, source });

          const fontSizePx = Math.round(parseFloat(cs.fontSize) || 16);
          if (tag === 'h1' && desktopH1Px === null) desktopH1Px = fontSizePx;
          const levelMap: Record<string, string> = {
            h1: 'H1',
            h2: 'H2',
            h3: 'H3',
            h4: 'H4',
            p: 'Body',
            button: 'Button',
            small: 'Small',
          };
          if (levelMap[tag] && typeScaleSamples.length < 60) {
            typeScaleSamples.push({
              level: levelMap[tag],
              fontFamily: primaryFont,
              fontSizePx,
              fontWeight: cs.fontWeight,
              lineHeight: cs.lineHeight === 'normal' ? '1.5' : cs.lineHeight,
              letterSpacing: cs.letterSpacing === 'normal' ? '0px' : cs.letterSpacing,
              sampleText: directText.slice(0, 72),
            });
          }
        }

        // Spacing
        const spacingProps: [string, string][] = [
          [cs.paddingTop, 'padding'],
          [cs.paddingLeft, 'padding'],
          [cs.marginBottom, 'margin'],
          [cs.gap, 'gap'],
        ];
        for (const [val, usage] of spacingProps) {
          const px = parseFloat(val);
          if (!Number.isNaN(px) && px >= 4 && px <= 144) {
            spacingValues.push({ valuePx: px, usage });
          }
        }

        // Border radius
        if (cs.borderRadius && cs.borderRadius !== '0px' && rect.width > 16 && rect.height > 16) {
          radii.push(cs.borderRadius);
        }

        // Box shadow
        if (cs.boxShadow && cs.boxShadow !== 'none') {
          shadows.push(cs.boxShadow);
        }

        // Transitions
        if (cs.transitionDuration && cs.transitionDuration !== '0s' && transitions.length < 40) {
          transitions.push({
            selector: shortSelector(el),
            property: cs.transitionProperty,
            duration: cs.transitionDuration,
            timingFunction: cs.transitionTimingFunction,
            delay: cs.transitionDelay,
          });
        }

        if (tag === 'a' || tag === 'button' || tag === 'input' || tag === 'select' || tag === 'textarea' || cs.cursor === 'pointer') {
          interactiveElementCount++;
        }
      }

      // 5. Inspect Stylesheets for CSS Variables, @media Breakpoints, Pseudo-States, @keyframes
      const cssVariables: { name: string; value: string }[] = [];
      const breakpoints: number[] = [];
      const pseudoStates: PseudoStateRule[] = [];
      const keyframes: PageDomEvalResult['keyframes'] = [];
      const stylesheetUrls: string[] = [];

      const pseudoRegex = /:(hover|focus-visible|focus|active)\b/;

      function scanRuleList(rules: CSSRuleList) {
        for (let i = 0; i < rules.length; i++) {
          const rule = rules[i];
          if (rule instanceof CSSStyleRule) {
            const sel = rule.selectorText || '';
            if (sel === ':root' || sel === 'html' || sel.includes(':root')) {
              for (let j = 0; j < rule.style.length; j++) {
                const prop = rule.style[j];
                if (prop.startsWith('--') && cssVariables.length < 80) {
                  cssVariables.push({ name: prop, value: rule.style.getPropertyValue(prop).trim() });
                }
              }
            }
            const m = sel.match(pseudoRegex);
            if (m && pseudoStates.length < 45) {
              const props: Record<string, string> = {};
              for (let j = 0; j < Math.min(rule.style.length, 6); j++) {
                const pName = rule.style[j];
                props[pName] = rule.style.getPropertyValue(pName).trim();
              }
              if (Object.keys(props).length > 0) {
                pseudoStates.push({
                  selector: sel.slice(0, 72),
                  state: m[1] as PseudoStateRule['state'],
                  properties: props,
                });
              }
            }
          } else if (rule instanceof CSSMediaRule) {
            const mediaText = rule.conditionText || rule.media.mediaText || '';
            const matches = mediaText.matchAll(/(?:min|max)-width:\s*(\d+(?:\.\d+)?)px/gi);
            for (const match of matches) {
              const bp = Math.round(Number(match[1]));
              if (bp >= 320 && bp <= 1920) breakpoints.push(bp);
            }
            scanRuleList(rule.cssRules);
          } else if (rule instanceof CSSKeyframesRule) {
            if (keyframes.length < 25) {
              const stepNames = Array.from(rule.cssRules)
                .map((r) => (r as CSSKeyframeRule).keyText)
                .slice(0, 6)
                .join(' → ');
              keyframes.push({
                name: rule.name,
                steps: stepNames || '0% → 100%',
                usedByCount: 1,
              });
            }
          }
        }
      }

      for (let i = 0; i < document.styleSheets.length; i++) {
        const sheet = document.styleSheets[i];
        if (sheet.href) stylesheetUrls.push(sheet.href);
        try {
          if (sheet.cssRules) scanRuleList(sheet.cssRules);
        } catch {
          // Cross-origin stylesheet; skip direct rule access cleanly
        }
      }

      // Scroll effects summary
      const scrollEffects: PageDomEvalResult['scrollEffects'] = [];
      if (getComputedStyle(document.documentElement).scrollBehavior === 'smooth') {
        scrollEffects.push({ type: 'smooth-scroll', detail: 'CSS scroll-behavior: smooth enabled on root', count: 1 });
      }
      if (stickyCount > 0) {
        scrollEffects.push({ type: 'sticky', detail: 'Sticky or fixed viewport-anchored elements detected', count: stickyCount });
      }
      if (snapCount > 0) {
        scrollEffects.push({ type: 'snap', detail: 'CSS Scroll Snap containers detected', count: snapCount });
      }
      if (parallaxCount > 0) {
        scrollEffects.push({ type: 'parallax', detail: 'Transform-promoted or fixed-backdrop scroll layers', count: parallaxCount });
      }
      if (scrollAnimAttrCount > 0) {
        scrollEffects.push({ type: 'scroll-animation', detail: 'Scroll-triggered reveal attributes (AOS / Framer / data-scroll)', count: scrollAnimAttrCount });
      }

      // 6. Icons & Images
      const inlineSvgCount = document.querySelectorAll('svg').length;
      const iconLibraries: string[] = [];
      if (document.querySelector('svg.lucide, [data-lucide]')) iconLibraries.push('Lucide Icons');
      if (document.querySelector('[class*="fa-"], link[href*="fontawesome"]')) iconLibraries.push('Font Awesome');
      if (document.querySelector('.material-icons, .material-symbols-outlined, link[href*="Material+Symbols"]')) {
        iconLibraries.push('Material Symbols / Icons');
      }
      if (document.querySelector('[data-slot="icon"], svg[class*="heroicon"]')) iconLibraries.push('Heroicons');
      if (document.querySelector('[class*="ph-"], script[src*="phosphor"]')) iconLibraries.push('Phosphor Icons');
      if (iconLibraries.length === 0 && inlineSvgCount > 0) iconLibraries.push('Custom Inline SVGs');

      const images = Array.from(document.querySelectorAll('img'))
        .slice(0, 80)
        .map((img) => {
          const src = img.currentSrc || img.src || '';
          let format = 'other';
          if (/\.webp(\?|$)/i.test(src) || src.includes('fm=webp')) format = 'webp';
          else if (/\.avif(\?|$)/i.test(src)) format = 'avif';
          else if (/\.svg(\?|$)/i.test(src) || src.startsWith('data:image/svg')) format = 'svg';
          else if (/\.png(\?|$)/i.test(src)) format = 'png';
          else if (/\.jpe?g(\?|$)/i.test(src)) format = 'jpg';
          return {
            src: src.slice(0, 260),
            alt: img.getAttribute('alt'),
            width: Math.round(img.naturalWidth || img.getBoundingClientRect().width),
            height: Math.round(img.naturalHeight || img.getBoundingClientRect().height),
            format,
            lazy: img.loading === 'lazy',
          };
        });

      // 7. Component Candidates (nav, hero, button, card, form, modal, footer)
      const componentCandidates: ComponentCandidateDOM[] = [];
      const seenElements = new Set<Element>();

      function extractComponentCss(el: Element): { cssText: string; computedStyles: Record<string, string> } {
        const cs = getComputedStyle(el);
        const props: Record<string, string> = {
          display: cs.display,
          'background-color': cs.backgroundColor,
          color: cs.color,
          'font-family': (cs.fontFamily.split(',')[0] || '').replace(/['"]/g, '').trim(),
          'font-size': cs.fontSize,
          'font-weight': cs.fontWeight,
          'line-height': cs.lineHeight,
          padding: cs.padding,
          'border-radius': cs.borderRadius,
          border: cs.borderTopWidth !== '0px' ? `${cs.borderTopWidth} ${cs.borderTopStyle} ${cs.borderTopColor}` : 'none',
          'box-shadow': cs.boxShadow,
          transition: cs.transitionDuration !== '0s' ? `${cs.transitionProperty} ${cs.transitionDuration} ${cs.transitionTimingFunction}` : 'none',
        };
        if (cs.gap && cs.gap !== 'normal') props.gap = cs.gap;
        const lines = Object.entries(props)
          .filter(([, v]) => v && v !== 'none' && v !== '0px' && v !== 'rgba(0, 0, 0, 0)')
          .map(([k, v]) => `  ${k}: ${v};`);
        return {
          cssText: `.${shortSelector(el).replace(/[^a-zA-Z0-9_-]/g, '-')} {\n${lines.join('\n')}\n}`,
          computedStyles: props,
        };
      }

      function addCandidate(el: Element | null, category: ComponentCategory, name: string, maxHeight = 900) {
        if (!el || seenElements.has(el) || !isVisible(el)) return;
        const rect = el.getBoundingClientRect();
        const absY = rect.top + window.scrollY;
        const absX = rect.left + window.scrollX;
        if (rect.width < 32 || rect.height < 20 || absY > 5600) return;
        seenElements.add(el);
        const { cssText, computedStyles } = extractComponentCss(el);
        componentCandidates.push({
          category,
          name,
          selector: shortSelector(el),
          textSnippet: ((el as HTMLElement).innerText || '').trim().replace(/\s+/g, ' ').slice(0, 90),
          x: Math.max(0, Math.round(absX)),
          y: Math.max(0, Math.round(absY)),
          width: Math.min(1440, Math.round(rect.width)),
          height: Math.min(maxHeight, Math.round(rect.height)),
          cssText,
          computedStyles,
        });
      }

      // Nav
      const headerNav = document.querySelector('header, nav');
      addCandidate(headerNav, 'nav', 'Primary Navigation Bar', 220);

      // Hero
      const h1 = document.querySelector('h1');
      const heroContainer = h1?.closest('section, header, main > div, article') || h1?.parentElement || null;
      if (heroContainer && heroContainer !== document.body && heroContainer.getBoundingClientRect().height < 1100) {
        addCandidate(heroContainer, 'hero', 'Hero Section', 760);
      }

      // Buttons (up to 4 visually distinct buttons/CTAs)
      const btnEls = Array.from(document.querySelectorAll('button, a[class*="btn"], a[class*="button"], [role="button"]'))
        .filter((el) => isVisible(el))
        .filter((el) => {
          const r = el.getBoundingClientRect();
          return r.width >= 60 && r.height >= 28 && r.width <= 420 && r.height <= 90;
        });
      const seenBtnStyle = new Set<string>();
      let btnAdded = 0;
      for (const b of btnEls) {
        if (btnAdded >= 4) break;
        const cs = getComputedStyle(b);
        const sig = `${cs.backgroundColor}|${cs.color}|${cs.borderRadius}`;
        if (seenBtnStyle.has(sig)) continue;
        seenBtnStyle.add(sig);
        const label = ((b as HTMLElement).innerText || '').trim().slice(0, 26);
        addCandidate(b, 'button', label ? `Button: ${label}` : `Button Variant ${btnAdded + 1}`, 120);
        btnAdded++;
      }

      // Cards (elements with border or shadow or article/card classes)
      const cardEls = Array.from(document.querySelectorAll('article, [class*="card"], [class*="Card"], li > div, section div'))
        .filter((el) => isVisible(el))
        .filter((el) => {
          const r = el.getBoundingClientRect();
          if (r.width < 200 || r.width > 640 || r.height < 120 || r.height > 620) return false;
          const cs = getComputedStyle(el);
          const hasSurface =
            (cs.boxShadow !== 'none' || parseFloat(cs.borderTopWidth) > 0 || (parseRgba(cs.backgroundColor) !== null)) &&
            el.querySelectorAll('h2, h3, h4, p').length >= 1;
          return hasSurface;
        });
      let cardAdded = 0;
      for (const c of cardEls) {
        if (cardAdded >= 3) break;
        const heading = c.querySelector('h2, h3, h4')?.textContent?.trim().slice(0, 32);
        addCandidate(c, 'card', heading ? `Card: ${heading}` : `Content Card ${cardAdded + 1}`, 560);
        cardAdded++;
      }

      // Forms
      const formEls = Array.from(document.querySelectorAll('form')).filter((el) => isVisible(el));
      formEls.slice(0, 2).forEach((f, idx) => {
        addCandidate(f, 'form', idx === 0 ? 'Primary Form' : `Form #${idx + 1}`, 620);
      });

      // Modals / Dialogs (including open dialogs or dialog elements)
      const modalEls = Array.from(document.querySelectorAll('dialog[open], [role="dialog"], [aria-modal="true"]')).filter(
        (el) => isVisible(el)
      );
      modalEls.slice(0, 2).forEach((m, idx) => {
        addCandidate(m, 'modal', `Modal Dialog ${idx + 1}`, 640);
      });

      // Footer
      const footerEl = document.querySelector('footer');
      addCandidate(footerEl, 'footer', 'Global Site Footer', 720);

      // 8. Information Architecture: Primary Nav, Footer Columns, Headings, Internal Links
      const navEl = document.querySelector('header nav, nav, header');
      const primaryNavigation: PageDomEvalResult['primaryNavigation'] = [];
      let desktopNavLinksCount = 0;
      if (navEl) {
        const topLinks = Array.from(navEl.querySelectorAll(':scope > ul > li, :scope a, :scope button')).slice(0, 20);
        const seenNav = new Set<string>();
        for (const item of topLinks) {
          const anchor = item.tagName === 'A' ? (item as HTMLAnchorElement) : (item.querySelector('a') as HTMLAnchorElement | null);
          const label = (anchor?.textContent || item.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 36);
          if (!label || seenNav.has(label.toLowerCase())) continue;
          seenNav.add(label.toLowerCase());
          desktopNavLinksCount++;
          const subLinks = Array.from(item.querySelectorAll('ul a, [role="menu"] a'))
            .slice(0, 8)
            .map((a) => ({
              label: (a.textContent || '').trim().slice(0, 36),
              href: (a as HTMLAnchorElement).href || '',
            }))
            .filter((x) => x.label && x.label !== label);
          primaryNavigation.push({
            label,
            href: anchor?.href || '',
            children: subLinks,
          });
          if (primaryNavigation.length >= 12) break;
        }
      }

      const footerColumns: PageDomEvalResult['footerColumns'] = [];
      if (footerEl) {
        const cols = Array.from(footerEl.querySelectorAll('div, nav, section'))
          .filter((el) => {
            const links = el.querySelectorAll(':scope > ul a, :scope > a');
            return links.length >= 2 && links.length <= 16;
          })
          .slice(0, 6);
        for (const col of cols) {
          const heading =
            col.querySelector('h2, h3, h4, h5, h6, strong, p')?.textContent?.trim().slice(0, 32) || 'Links';
          const links = Array.from(col.querySelectorAll('a'))
            .slice(0, 10)
            .map((a) => ({
              label: (a.textContent || '').trim().slice(0, 36),
              href: a.href,
            }))
            .filter((l) => l.label);
          if (links.length >= 2) {
            footerColumns.push({ heading, links });
          }
        }
      }

      const headingsRaw = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'))
        .filter((h) => isVisible(h))
        .slice(0, 50);
      const headings: PageDomEvalResult['headingStructure']['headings'] = [];
      const skippedLevels: string[] = [];
      let prevLevel = 0;
      let h1Count = 0;
      for (const h of headingsRaw) {
        const level = Number(h.tagName.slice(1));
        if (level === 1) h1Count++;
        const skipped = prevLevel > 0 && level > prevLevel + 1;
        if (skipped) skippedLevels.push(`H${prevLevel} → H${level}`);
        headings.push({
          level,
          text: (h.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 90),
          hasSkipWarning: skipped,
        });
        prevLevel = level;
      }

      // Internal links
      const internalLinksMap = new Map<string, { href: string; path: string; text: string }>();
      for (const a of Array.from(document.querySelectorAll('a[href]'))) {
        try {
          const u = new URL((a as HTMLAnchorElement).href, urlStr);
          if (u.origin !== origin) continue;
          u.hash = '';
          const cleanPath = u.pathname || '/';
          const normalizedHref = `${u.origin}${cleanPath}${u.search}`;
          if (!internalLinksMap.has(normalizedHref)) {
            internalLinksMap.set(normalizedHref, {
              href: normalizedHref,
              path: cleanPath,
              text: (a.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 50),
            });
          }
        } catch {
          // Ignore malformed href
        }
      }

      // 9. UX: CTAs, Forms, Trust Signals
      const ctas: PageDomEvalResult['ctas'] = [];
      const ctaRegex = /get\s*started|sign\s*up|try|start|demo|buy|shop|order|pricing|subscribe|join|download|contact|book|learn\s*more|create|free/i;
      for (const el of Array.from(document.querySelectorAll('a, button')).slice(0, 200)) {
        if (!isVisible(el)) continue;
        const text = ((el as HTMLElement).innerText || '').trim().replace(/\s+/g, ' ');
        if (!text || text.length > 42) continue;
        const cs = getComputedStyle(el);
        const bg = parseRgba(cs.backgroundColor);
        const fg = parseRgba(cs.color);
        const isStyledBtn = el.tagName === 'BUTTON' || (bg !== null && bg.a > 0.5 && parseFloat(cs.paddingLeft) >= 10);
        if (!isStyledBtn && !ctaRegex.test(text)) continue;
        const rect = el.getBoundingClientRect();
        const absY = rect.top + window.scrollY;
        const inHeader = Boolean(el.closest('header, nav'));
        const inFooter = Boolean(el.closest('footer'));
        const placement = inHeader
          ? 'navigation'
          : inFooter
            ? 'footer'
            : absY < 900
              ? 'above-the-fold'
              : 'mid-page';
        ctas.push({
          text,
          href: (el as HTMLAnchorElement).href || '',
          placement,
          pagePath: pathStr,
          repeatCount: 1,
          backgroundColor: bg ? rgbToHex(bg.r, bg.g, bg.b) : 'transparent',
          textColor: fg ? rgbToHex(fg.r, fg.g, fg.b) : '#000000',
        });
        if (ctas.length >= 25) break;
      }

      const forms: PageDomEvalResult['forms'] = Array.from(document.querySelectorAll('form'))
        .slice(0, 10)
        .map((form) => {
          const inputs = Array.from(form.querySelectorAll('input:not([type="hidden"]), select, textarea'));
          const requiredCount = inputs.filter((i) => i.hasAttribute('required') || i.getAttribute('aria-required') === 'true').length;
          const inputTypes = Array.from(
            new Set(inputs.map((i) => (i.tagName === 'INPUT' ? (i as HTMLInputElement).type || 'text' : i.tagName.toLowerCase())))
          );
          const submitBtn = form.querySelector('button[type="submit"], input[type="submit"], button');
          const submitLabel = (submitBtn?.textContent || (submitBtn as HTMLInputElement)?.value || 'Submit').trim().slice(0, 32);
          const formText = (form.textContent || '').toLowerCase();
          const isMultiStep = /step\s*1|next\s*step|progress|1\s*of\s*\d/i.test(formText);
          const purpose = /search/i.test(formText + submitLabel)
            ? 'Site Search'
            : /newsletter|subscribe|updates/i.test(formText + submitLabel)
              ? 'Newsletter Signup'
              : /sign\s*in|log\s*in|password/i.test(formText + submitLabel)
                ? 'Authentication / Signup'
                : /contact|message|demo|sales/i.test(formText + submitLabel)
                  ? 'Contact / Lead Capture'
                  : 'General Form';
          return {
            pagePath: pathStr,
            purpose,
            fieldCount: inputs.length,
            requiredCount,
            inputTypes,
            isMultiStep,
            submitLabel,
          };
        })
        .filter((f) => f.fieldCount > 0);

      const trustSignals: PageDomEvalResult['trustSignals'] = [];
      const bodyLower = textContent.toLowerCase();
      if (/trusted by|used by|loved by|customers include|teams at/i.test(bodyLower)) {
        trustSignals.push({ category: 'logos', label: 'Customer Logo Proof Strip', evidence: 'Detected "trusted by / used by" customer section', pagePath: pathStr });
      }
      if (/soc\s*2|gdpr|hipaa|iso\s*27001|pci|256-bit|ssl|encrypted/i.test(bodyLower)) {
        const match = textContent.match(/soc\s*2|gdpr|hipaa|iso\s*27001|pci|256-bit|encrypted/i);
        trustSignals.push({ category: 'security-badge', label: 'Security & Compliance Credentials', evidence: `Mentions ${match?.[0] || 'security compliance'}`, pagePath: pathStr });
      }
      if (/4\.\d\s*\/\s*5|5\s*stars|g2|trustpilot|capterra|reviews|testimonials/i.test(bodyLower) || document.querySelector('blockquote')) {
        trustSignals.push({ category: 'reviews', label: 'Testimonials / Ratings', evidence: document.querySelector('blockquote') ? 'Quotes/blockquotes present on page' : 'Review or rating copy detected', pagePath: pathStr });
      }
      if (/money-back|no credit card|free forever|cancel anytime|sla|99\.9%/i.test(bodyLower)) {
        const match = textContent.match(/money-back|no credit card|free forever|cancel anytime|99\.9%/i);
        trustSignals.push({ category: 'guarantee', label: 'Risk-Reversal / Uptime Guarantee', evidence: `Includes "${match?.[0] || 'risk reversal'}" copy`, pagePath: pathStr });
      }

      // 10. Accessibility: Landmarks, ARIA, Keyboard Focus, Semantic HTML
      const buttonsAll = Array.from(document.querySelectorAll('button, [role="button"]')).filter((b) => isVisible(b));
      const unlabeledButtons = buttonsAll.filter((b) => {
        const text = (b.textContent || '').trim();
        const aria = b.getAttribute('aria-label') || b.getAttribute('aria-labelledby') || b.getAttribute('title');
        return !text && !aria;
      }).length;

      const inputsAll = Array.from(document.querySelectorAll('input:not([type="hidden"]), select, textarea')).filter((i) => isVisible(i));
      const unlabeledInputs = inputsAll.filter((inp) => {
        const id = inp.id;
        const hasLabelEl = id ? Boolean(document.querySelector(`label[for="${CSS.escape(id)}"]`)) : false;
        const wrappedInLabel = Boolean(inp.closest('label'));
        const aria = inp.getAttribute('aria-label') || inp.getAttribute('aria-labelledby');
        return !hasLabelEl && !wrappedInLabel && !aria;
      }).length;

      const ariaAttributesCount = document.querySelectorAll('[aria-label], [aria-labelledby], [aria-describedby], [aria-expanded], [role]').length;
      const focusables = Array.from(document.querySelectorAll('a[href], button, input, select, textarea, [tabindex]')).filter((el) => isVisible(el));
      const positiveTabIndexCount = focusables.filter((el) => Number(el.getAttribute('tabindex') || '0') > 0).length;
      const outlineRemovedWithoutFallback = focusables.slice(0, 60).filter((el) => {
        const cs = getComputedStyle(el);
        return cs.outlineStyle === 'none' && cs.boxShadow === 'none';
      }).length;
      const hasSkipLink = Boolean(
        Array.from(document.querySelectorAll('a[href^="#"]'))
          .slice(0, 6)
          .find((a) => /skip\s+to/i.test(a.textContent || ''))
      );

      const semanticTagsCount = document.querySelectorAll('header, nav, main, article, section, aside, footer, figure').length;
      const divSpanCount = Math.max(1, document.querySelectorAll('div, span').length);
      const semanticTagsRatio = Math.min(1, semanticTagsCount / (semanticTagsCount + divSpanCount * 0.15));

      // 11. Tech Stack & Animation Libraries Detection
      const scriptUrls = Array.from(document.querySelectorAll('script[src]')).map((s) => (s as HTMLScriptElement).src);
      const scriptCombined = scriptUrls.join(' ').toLowerCase();
      const htmlLower = fullHtml.toLowerCase();
      const win = window as unknown as Record<string, unknown>;

      const frameworks: string[] = [];
      if (win.__NEXT_DATA__ || document.querySelector('#__next') || scriptCombined.includes('/_next/')) frameworks.push('Next.js');
      if (win.__NUXT__ || document.querySelector('#__nuxt')) frameworks.push('Nuxt.js');
      if (document.querySelector('[data-reactroot], #root') || win.__REACT_DEVTOOLS_GLOBAL_HOOK__ || frameworks.includes('Next.js')) {
        if (!frameworks.includes('React')) frameworks.push('React');
      }
      if (win.__VUE__ || document.querySelector('[data-v-app]')) frameworks.push('Vue.js');
      if (document.querySelector('[class*="svelte-"]') || htmlLower.includes('__sveltekit')) frameworks.push('Svelte / SvelteKit');
      if (document.querySelector('astro-island') || htmlLower.includes('astro-')) frameworks.push('Astro');
      if (document.querySelector('[ng-version]')) frameworks.push('Angular');
      if (htmlLower.includes('webflow') || document.documentElement.hasAttribute('data-wf-site')) frameworks.push('Webflow');
      if (win.Shopify || scriptCombined.includes('cdn.shopify.com')) frameworks.push('Shopify');
      if (htmlLower.includes('wp-content') || htmlLower.includes('wp-includes')) frameworks.push('WordPress');
      if (frameworks.length === 0) frameworks.push('Custom / Server-Rendered HTML');

      const cssApproach: string[] = [];
      if (tailwindScore >= 6) cssApproach.push('Tailwind CSS');
      if (cssVariables.length >= 6) cssApproach.push('CSS Custom Properties (:root tokens)');
      if (document.querySelector('style[data-styled], style[data-styled-version]')) cssApproach.push('Styled Components');
      if (document.querySelector('style[data-emotion]')) cssApproach.push('Emotion CSS-in-JS');
      if (stylesheetUrls.some((u) => u.includes('bootstrap')) || document.querySelector('.container-fluid, .col-md-6')) {
        cssApproach.push('Bootstrap');
      }
      if (cssApproach.length === 0) cssApproach.push('Custom Stylesheets');

      const componentLibraries: string[] = [];
      if (document.querySelector('[data-radix-collection-item], [id^="radix-"]')) componentLibraries.push('Radix UI');
      if (document.querySelector('[class*="MuiBox-"], [class*="MuiButton-"]')) componentLibraries.push('Material UI (MUI)');
      if (document.querySelector('[class*="chakra-"]')) componentLibraries.push('Chakra UI');
      if (document.querySelector('[class*="ant-btn"], [class*="ant-layout"]')) componentLibraries.push('Ant Design');
      if (document.querySelector('[data-headlessui-state]')) componentLibraries.push('Headless UI');

      const cmsAndHosting: string[] = [];
      const genMeta = document.querySelector('meta[name="generator"]')?.getAttribute('content');
      if (genMeta) cmsAndHosting.push(genMeta.slice(0, 48));
      if (headers['x-vercel-id'] || headers['server']?.toLowerCase().includes('vercel')) cmsAndHosting.push('Vercel');
      if (headers['cf-ray'] || headers['server']?.toLowerCase().includes('cloudflare')) cmsAndHosting.push('Cloudflare');
      if (headers['x-nf-request-id'] || headers['server']?.toLowerCase().includes('netlify')) cmsAndHosting.push('Netlify');
      if (htmlLower.includes('contentful')) cmsAndHosting.push('Contentful');
      if (htmlLower.includes('sanity.io') || htmlLower.includes('cdn.sanity.io')) cmsAndHosting.push('Sanity CMS');
      if (htmlLower.includes('wp-content')) cmsAndHosting.push('WordPress CMS');
      if (document.documentElement.hasAttribute('data-wf-site')) cmsAndHosting.push('Webflow CMS');

      const analyticsAndTools: string[] = [];
      if (/googletagmanager\.com|google-analytics\.com|gtag/i.test(scriptCombined + htmlLower)) analyticsAndTools.push('Google Analytics / GTM');
      if (/cdn\.segment\.com|segment\.io/i.test(scriptCombined)) analyticsAndTools.push('Segment');
      if (/posthog/i.test(scriptCombined + htmlLower)) analyticsAndTools.push('PostHog');
      if (/mixpanel/i.test(scriptCombined)) analyticsAndTools.push('Mixpanel');
      if (/plausible\.io/i.test(scriptCombined)) analyticsAndTools.push('Plausible Analytics');
      if (/sentry\.io|browser\.sentry/i.test(scriptCombined)) analyticsAndTools.push('Sentry');
      if (/hotjar\.com/i.test(scriptCombined)) analyticsAndTools.push('Hotjar');
      if (/intercom/i.test(scriptCombined)) analyticsAndTools.push('Intercom');
      if (/js\.stripe\.com/i.test(scriptCombined)) analyticsAndTools.push('Stripe');
      if (/hubspot|hs-scripts/i.test(scriptCombined)) analyticsAndTools.push('HubSpot');

      const animationLibraries: string[] = [];
      if (win.gsap || /gsap|greensock/i.test(scriptCombined)) animationLibraries.push('GSAP');
      if (document.querySelector('[data-framer-appear-id], [style*="transform: translate3d"]') || /framer-motion/i.test(scriptCombined)) {
        animationLibraries.push('Framer Motion / Motion');
      }
      if (document.querySelector('lottie-player, dotlottie-player') || /lottie/i.test(scriptCombined)) {
        animationLibraries.push('Lottie');
      }
      if (document.documentElement.classList.contains('lenis') || /lenis/i.test(scriptCombined)) {
        animationLibraries.push('Lenis Smooth Scroll');
      }
      if (win.THREE || /three\.min\.js|three\.module/i.test(scriptCombined)) {
        animationLibraries.push('Three.js / WebGL');
      }
      if (transitions.length > 0 || keyframes.length > 0) {
        animationLibraries.push('Native CSS Transitions & Keyframes');
      }

      return {
        title: document.title || pathStr,
        wordCount,
        htmlSizeKb,
        htmlPreview,
        faviconUrl,
        domContentLoadedMs,
        firstContentfulPaintMs,
        internalLinks: Array.from(internalLinksMap.values()),
        colors,
        cssVariables,
        fonts,
        typeScaleSamples,
        spacingValues,
        radii,
        shadows,
        breakpoints,
        containerMaxWidths,
        gridUsageCount,
        flexUsageCount,
        inlineSvgCount,
        iconLibraries,
        images,
        componentCandidates,
        pseudoStates,
        transitions,
        keyframes,
        scrollEffects,
        animationLibraries,
        interactiveElementCount,
        primaryNavigation,
        footerColumns,
        headingStructure: {
          pageUrl: urlStr,
          pagePath: pathStr,
          pageTitle: document.title || pathStr,
          headings,
          h1Count,
          skippedLevels,
        },
        ctas,
        forms,
        trustSignals,
        contrastFailures,
        contrastCheckedCount,
        ariaStats: {
          hasMainLandmark: Boolean(document.querySelector('main, [role="main"]')),
          hasNavLandmark: Boolean(document.querySelector('nav, [role="navigation"]')),
          hasHeaderLandmark: Boolean(document.querySelector('header, [role="banner"]')),
          hasFooterLandmark: Boolean(document.querySelector('footer, [role="contentinfo"]')),
          unlabeledButtons,
          unlabeledInputs,
          ariaAttributesCount,
        },
        keyboardFocus: {
          hasSkipLink,
          focusableElementsCount: focusables.length,
          outlineRemovedWithoutFallback,
          positiveTabIndexCount,
        },
        semanticHtml: {
          hasLangAttribute: Boolean(document.documentElement.lang?.trim()),
          langValue: document.documentElement.lang || '',
          hasDocumentTitle: Boolean(document.title?.trim()),
          headingOrderValid: skippedLevels.length === 0 && h1Count <= 1,
          semanticTagsRatio,
        },
        techSignals: {
          frameworks,
          cssApproach,
          componentLibraries,
          cmsAndHosting,
          analyticsAndTools,
          stylesheetUrls,
          scriptUrls,
          inlineStyleCount,
        },
        desktopH1Px,
        desktopBodyPx,
        desktopVisibleCount: visibleCount,
        desktopNavLinksCount,
      };
    },
    { urlStr: pageUrl, pathStr: pagePath, headers: responseHeaders }
  );
}

export async function runWebsiteAudit(
  rawConfig: AuditConfig,
  onProgress: (event: CrawlProgressEvent) => void,
  signal?: AbortSignal
): Promise<AuditReport> {
  const startedAt = Date.now();
  const maxPages = Math.max(1, Math.min(15, Math.round(rawConfig.maxPages || 10)));
  const viewports: ViewportKey[] =
    rawConfig.viewports && rawConfig.viewports.length > 0
      ? rawConfig.viewports.filter((v): v is ViewportKey => v === 'desktop' || v === 'tablet' || v === 'phone')
      : ['desktop', 'tablet', 'phone'];

  const config: AuditConfig = {
    url: rawConfig.url,
    maxPages,
    viewports,
  };

  onProgress({
    type: 'stage',
    stage: 'Validating URL',
    message: `Resolving and verifying public access for ${rawConfig.url}`,
    percent: 4,
    pagesCompleted: 0,
    totalPagesTarget: maxPages,
  });

  const validated = await validatePublicTargetUrl(rawConfig.url);
  const targetOrigin = validated.url.origin;
  const domain = validated.url.hostname.replace(/^www\./, '');

  const executablePath = findChromiumExecutable();
  let browser: Browser | null = null;

  const checkAbort = () => {
    if (signal?.aborted) {
      throw new Error('Crawl cancelled by user.');
    }
  };

  try {
    onProgress({
      type: 'stage',
      stage: 'Launching Browser',
      message: 'Starting headless Chromium session with multi-viewport capture',
      percent: 8,
      pagesCompleted: 0,
      totalPagesTarget: maxPages,
    });

    browser = await chromium.launch({
      headless: true,
      executablePath,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-blink-features=AutomationControlled',
      ],
    });

    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
      ignoreHTTPSErrors: true,
    });

    await context.addInitScript('globalThis.__name = globalThis.__name || function(t) { return t; };');

    // Enforce SSRF protection on all browser requests & navigation redirects
    const verifiedHosts = new Set<string>([validated.url.hostname.toLowerCase()]);
    await context.route('**/*', async (route) => {
      const reqUrl = route.request().url();
      if (reqUrl.startsWith('data:') || reqUrl.startsWith('blob:')) {
        await route.continue();
        return;
      }
      if (isQuickBlockedUrl(reqUrl)) {
        await route.abort('blockedbyclient');
        return;
      }
      if (route.request().isNavigationRequest()) {
        try {
          const parsedNav = new URL(reqUrl);
          const hostKey = parsedNav.hostname.toLowerCase();
          if (!verifiedHosts.has(hostKey)) {
            await validatePublicTargetUrl(reqUrl);
            verifiedHosts.add(hostKey);
          }
        } catch {
          await route.abort('blockedbyclient');
          return;
        }
      }
      await route.continue();
    });

    const page = await context.newPage();
    page.setDefaultNavigationTimeout(18000);
    page.setDefaultTimeout(12000);

    interface QueueEntry {
      url: string;
      path: string;
      depth: number;
      parentPath: string | null;
      priority: number;
      linkText: string;
    }

    const startPath = validated.url.pathname || '/';
    const queue: QueueEntry[] = [
      {
        url: validated.normalized,
        path: startPath,
        depth: 0,
        parentPath: null,
        priority: 1000,
        linkText: 'Home',
      },
    ];
    const visitedPaths = new Set<string>();
    const rawPages: RawPageExtraction[] = [];
    const pageSummaries: CrawledPageSummary[] = [];

    let mobileDelta: ResponsiveMobileDelta = {
      navCollapsedToMenu: false,
      desktopH1Px: null,
      mobileH1Px: null,
      desktopBodyPx: null,
      mobileBodyPx: null,
      horizontalOverflowOnMobile: false,
      hiddenElementsOnMobileCount: 0,
      layoutNotes: [],
    };

    while (queue.length > 0 && rawPages.length < maxPages) {
      checkAbort();
      queue.sort((a, b) => b.priority - a.priority || a.depth - b.depth);
      const next = queue.shift()!;
      const pathKey = next.path.replace(/\/+$/, '') || '/';
      if (visitedPaths.has(pathKey)) continue;
      visitedPaths.add(pathKey);

      const pageIndex = rawPages.length + 1;
      const basePercent = 12 + Math.round(((pageIndex - 1) / maxPages) * 68);

      onProgress({
        type: 'page',
        stage: `Crawling Page ${pageIndex} of ${maxPages}`,
        message: `Loading ${next.path} (${classifyPageArchetype(next.url, next.linkText)})`,
        percent: basePercent,
        pagesCompleted: rawPages.length,
        totalPagesTarget: maxPages,
        currentUrl: next.url,
      });

      // Reset to Desktop viewport before loading page
      await page.setViewportSize({ width: 1440, height: 900 });

      // Track network telemetry for this page
      const netStats = {
        totalRequests: 0,
        totalTransferKb: 0,
        byType: {} as Record<string, { requests: number; sizeKb: number }>,
      };

      const onResponse = async (res: import('playwright-core').Response) => {
        try {
          const type = res.request().resourceType() || 'other';
          const contentLength = Number(res.headers()['content-length'] || '0');
          const sizeKb = contentLength > 0 ? contentLength / 1024 : 4;
          netStats.totalRequests += 1;
          netStats.totalTransferKb += sizeKb;
          if (!netStats.byType[type]) netStats.byType[type] = { requests: 0, sizeKb: 0 };
          netStats.byType[type].requests += 1;
          netStats.byType[type].sizeKb += sizeKb;
        } catch {
          // Ignore response accounting error
        }
      };

      page.on('response', onResponse);

      const navStart = Date.now();
      let statusCode = 200;
      let responseHeaders: Record<string, string> = {};

      try {
        const resp = await page.goto(next.url, { waitUntil: 'domcontentloaded', timeout: 18000 });
        if (resp) {
          statusCode = resp.status();
          responseHeaders = resp.headers();
        }
        // Verify we did not redirect off-origin to a blocked domain
        if (isQuickBlockedUrl(page.url())) {
          page.off('response', onResponse);
          continue;
        }
        await page.waitForLoadState('networkidle', { timeout: 4500 }).catch(() => undefined);
        await page.evaluate(() => document.fonts?.ready).catch(() => undefined);
        await page.waitForTimeout(350);
      } catch (err) {
        page.off('response', onResponse);
        if (pageIndex === 1) {
          throw new Error(
            `Could not load ${validated.normalized}: ${err instanceof Error ? err.message : 'navigation timeout'}`
          );
        }
        continue;
      }

      const loadTimeMs = Date.now() - navStart;
      page.off('response', onResponse);

      const actualUrl = page.url();
      let actualPath = next.path;
      try {
        actualPath = new URL(actualUrl).pathname || '/';
      } catch {
        // Keep next.path
      }

      // Extract full DOM, computed styles, WCAG contrast, IA, UX, and tech stack
      const domData = await extractPageDOM(page, actualUrl, actualPath, responseHeaders);

      // Probe real live :hover states on the first 2 pages
      let liveHovers: PseudoStateRule[] = [];
      if (pageIndex <= 2) {
        liveHovers = await probeLiveHoverStates(page);
      }

      // Capture real component crop screenshots (on first 3 pages so crops are crisp and fast)
      const componentsWithCrops: ComponentInventoryItem[] = [];
      const pageDims = await page.evaluate(() => ({
        w: Math.max(document.documentElement.scrollWidth, 1440),
        h: Math.max(document.documentElement.scrollHeight, 900),
      }));

      for (const cand of domData.componentCandidates) {
        let screenshotDataUrl: string | null = null;
        if (pageIndex <= 3 && cand.width >= 32 && cand.height >= 20) {
          try {
            const clipX = Math.max(0, Math.min(cand.x, pageDims.w - 32));
            const clipY = Math.max(0, Math.min(cand.y, pageDims.h - 20));
            const clipW = Math.min(cand.width, pageDims.w - clipX, 1440);
            const clipH = Math.min(cand.height, pageDims.h - clipY, 820);
            if (clipW >= 32 && clipH >= 20) {
              const buf = await page.screenshot({
                type: 'jpeg',
                quality: 82,
                clip: { x: clipX, y: clipY, width: clipW, height: clipH },
                animations: 'disabled',
              });
              screenshotDataUrl = `data:image/jpeg;base64,${buf.toString('base64')}`;
            }
          } catch {
            screenshotDataUrl = null;
          }
        }
        componentsWithCrops.push({
          id: crypto.randomUUID().slice(0, 10),
          category: cand.category,
          name: cand.name,
          selector: cand.selector,
          pageUrl: actualUrl,
          pagePath: actualPath,
          width: cand.width,
          height: cand.height,
          screenshotDataUrl,
          cssText: cand.cssText,
          computedStyles: cand.computedStyles,
          textSnippet: cand.textSnippet,
          instanceCount: 1,
        });
      }

      // Capture full-page screenshots across requested viewports
      const screenshots: Partial<Record<ViewportKey, ViewportScreenshot>> = {};
      const shouldCaptureAllViewports = pageIndex <= 4 || ['pricing', 'product', 'signup', 'checkout'].includes(classifyPageArchetype(actualUrl, next.linkText));
      const viewportsForPage: ViewportKey[] = shouldCaptureAllViewports
        ? viewports
        : viewports.includes('desktop')
          ? ['desktop']
          : [viewports[0]];

      for (const vp of viewportsForPage) {
        checkAbort();
        try {
          screenshots[vp] = await captureViewportScreenshot(page, vp, pageIndex === 1 ? 5600 : 3800);
        } catch {
          // Skip failed viewport gracefully
        }
      }

      // Measure real Mobile Responsive Delta on the Home page
      if (pageIndex === 1) {
        try {
          await page.setViewportSize({ width: 390, height: 844 });
          await page.waitForTimeout(260);
          const mobileMetrics = await page.evaluate(() => {
            const h1 = document.querySelector('h1');
            const h1Px = h1 ? Math.round(parseFloat(getComputedStyle(h1).fontSize)) : null;
            const bodyPx = document.body ? Math.round(parseFloat(getComputedStyle(document.body).fontSize)) : null;
            const overflow = document.documentElement.scrollWidth > window.innerWidth + 4;
            const visibleCount = Array.from(document.querySelectorAll('body *'))
              .slice(0, 900)
              .filter((el) => {
                const cs = getComputedStyle(el);
                const r = el.getBoundingClientRect();
                return cs.display !== 'none' && cs.visibility !== 'hidden' && r.width > 0 && r.height > 0;
              }).length;
            const header = document.querySelector('header, nav');
            const visibleNavLinks = header
              ? Array.from(header.querySelectorAll('a')).filter((a) => {
                  const r = a.getBoundingClientRect();
                  return r.width > 0 && r.height > 0;
                }).length
              : 0;
            const hasHamburger = Boolean(
              header?.querySelector('button[aria-label*="menu" i], button[aria-label*="nav" i], button svg')
            );
            return { h1Px, bodyPx, overflow, visibleCount, visibleNavLinks, hasHamburger };
          });

          const navCollapsed =
            mobileMetrics.hasHamburger ||
            (domData.desktopNavLinksCount >= 3 && mobileMetrics.visibleNavLinks < domData.desktopNavLinksCount);
          const hiddenDiff = Math.max(0, domData.desktopVisibleCount - mobileMetrics.visibleCount);
          const notes: string[] = [];
          if (navCollapsed) {
            notes.push(`Top navigation adapts from ${domData.desktopNavLinksCount} desktop links into a compact mobile menu.`);
          } else {
            notes.push('Navigation links remain directly visible on mobile without collapsing into a drawer.');
          }
          if (domData.desktopH1Px && mobileMetrics.h1Px && mobileMetrics.h1Px < domData.desktopH1Px) {
            notes.push(`Primary headline scales down from ${domData.desktopH1Px}px on desktop to ${mobileMetrics.h1Px}px on mobile.`);
          }
          if (mobileMetrics.overflow) {
            notes.push('Horizontal overflow detected at 390px viewport width—check wide containers or tables.');
          } else {
            notes.push('No horizontal overflow detected at 390px phone viewport width.');
          }
          if (hiddenDiff > 0) {
            notes.push(`Approximately ${hiddenDiff} desktop DOM elements are hidden or condensed on mobile.`);
          }

          mobileDelta = {
            navCollapsedToMenu: navCollapsed,
            desktopH1Px: domData.desktopH1Px,
            mobileH1Px: mobileMetrics.h1Px,
            desktopBodyPx: domData.desktopBodyPx,
            mobileBodyPx: mobileMetrics.bodyPx,
            horizontalOverflowOnMobile: mobileMetrics.overflow,
            hiddenElementsOnMobileCount: hiddenDiff,
            layoutNotes: notes,
          };
        } catch {
          // Non-fatal mobile measurement
        }
      }

      const archetype = pageIndex === 1 ? 'home' : classifyPageArchetype(actualUrl, next.linkText);

      rawPages.push({
        url: actualUrl,
        path: actualPath,
        title: domData.title,
        archetype,
        depth: next.depth,
        parentPath: next.parentPath,
        statusCode,
        loadTimeMs,
        domContentLoadedMs: domData.domContentLoadedMs,
        firstContentfulPaintMs: domData.firstContentfulPaintMs,
        wordCount: domData.wordCount,
        htmlSizeKb: domData.htmlSizeKb,
        htmlPreview: domData.htmlPreview,
        faviconUrl: domData.faviconUrl,
        internalLinks: domData.internalLinks,
        colors: domData.colors,
        cssVariables: domData.cssVariables,
        fonts: domData.fonts,
        typeScaleSamples: domData.typeScaleSamples,
        spacingValues: domData.spacingValues,
        radii: domData.radii,
        shadows: domData.shadows,
        breakpoints: domData.breakpoints,
        containerMaxWidths: domData.containerMaxWidths,
        gridUsageCount: domData.gridUsageCount,
        flexUsageCount: domData.flexUsageCount,
        inlineSvgCount: domData.inlineSvgCount,
        iconLibraries: domData.iconLibraries,
        images: domData.images,
        components: componentsWithCrops,
        pseudoStates: [...liveHovers, ...domData.pseudoStates],
        transitions: domData.transitions,
        keyframes: domData.keyframes,
        scrollEffects: domData.scrollEffects,
        animationLibraries: domData.animationLibraries,
        interactiveElementCount: domData.interactiveElementCount,
        primaryNavigation: domData.primaryNavigation,
        footerColumns: domData.footerColumns,
        headingStructure: domData.headingStructure,
        ctas: domData.ctas,
        forms: domData.forms,
        trustSignals: domData.trustSignals,
        contrastFailures: domData.contrastFailures,
        contrastCheckedCount: domData.contrastCheckedCount,
        ariaStats: domData.ariaStats,
        keyboardFocus: domData.keyboardFocus,
        semanticHtml: domData.semanticHtml,
        techSignals: domData.techSignals,
        networkStats: netStats,
      });

      pageSummaries.push({
        url: actualUrl,
        path: actualPath,
        title: domData.title,
        archetype,
        depth: next.depth,
        statusCode,
        loadTimeMs,
        internalLinksCount: domData.internalLinks.length,
        wordCount: domData.wordCount,
        screenshots,
      });

      // Enqueue newly discovered same-origin links
      if (rawPages.length < maxPages) {
        for (const link of domData.internalLinks) {
          try {
            const parsedLink = new URL(link.href);
            if (parsedLink.origin !== targetOrigin) continue;
            const normKey = parsedLink.pathname.replace(/\/+$/, '') || '/';
            if (visitedPaths.has(normKey)) continue;
            if (queue.some((q) => (q.path.replace(/\/+$/, '') || '/') === normKey)) continue;
            const priority = scoreInternalLinkPriority(link.href, link.text);
            if (priority < 0) continue;
            queue.push({
              url: link.href,
              path: parsedLink.pathname || '/',
              depth: next.depth + 1,
              parentPath: actualPath,
              priority,
              linkText: link.text,
            });
          } catch {
            // Skip invalid URL
          }
        }
      }
    }

    await browser.close();
    browser = null;

    checkAbort();

    onProgress({
      type: 'stage',
      stage: 'Aggregating Telemetry',
      message: `Computing design tokens, WCAG contrast ratios, sitemap hierarchy, and tech signatures across ${rawPages.length} page(s)`,
      percent: 84,
      pagesCompleted: rawPages.length,
      totalPagesTarget: rawPages.length,
    });

    const aggregated = aggregateAuditData(rawPages, pageSummaries, mobileDelta);
    const homeRaw = rawPages[0];

    const partialReport: Omit<AuditReport, 'aiCritique'> = {
      id: crypto.randomUUID(),
      url: homeRaw?.url || validated.normalized,
      domain,
      siteTitle: homeRaw?.title || domain,
      faviconUrl: homeRaw?.faviconUrl || null,
      createdAt: new Date().toISOString(),
      crawlDurationMs: Date.now() - startedAt,
      config,
      pages: pageSummaries,
      rawArtifacts: {
        homeHtmlPreview: homeRaw?.htmlPreview || '',
        stylesheetUrls: Array.from(new Set(rawPages.flatMap((p) => p.techSignals.stylesheetUrls))).slice(0, 40),
        scriptUrls: aggregated.techStack.scriptUrls,
      },
      ...aggregated,
    };

    onProgress({
      type: 'stage',
      stage: 'Synthesizing AI Critique',
      message: 'Generating grounded design strengths, UX weak spots, and prioritized improvements from extracted metrics',
      percent: 92,
      pagesCompleted: rawPages.length,
      totalPagesTarget: rawPages.length,
    });

    const aiCritique = await generateGroundedAICritique(partialReport);

    const finalReport: AuditReport = {
      ...partialReport,
      crawlDurationMs: Date.now() - startedAt,
      aiCritique,
    };

    onProgress({
      type: 'complete',
      stage: 'Audit Complete',
      message: `Completed analysis of ${domain} (${rawPages.length} pages)`,
      percent: 100,
      pagesCompleted: rawPages.length,
      totalPagesTarget: rawPages.length,
      report: finalReport,
    });

    return finalReport;
  } finally {
    if (browser) {
      await browser.close().catch(() => undefined);
    }
  }
}

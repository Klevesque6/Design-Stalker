import JSZip from 'jszip';
import type { AuditReport } from '../types/audit';

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'item';
}

function dataUrlToBase64(dataUrl: string): string | null {
  const idx = dataUrl.indexOf('base64,');
  if (idx === -1) return null;
  return dataUrl.slice(idx + 7);
}

export function generateTokensJson(report: AuditReport): string {
  const colors: Record<string, { $value: string; $type: string; $description: string }> = {};
  report.ui.colors.slice(0, 16).forEach((c, i) => {
    const key = `${c.role}-${i + 1}`;
    colors[key] = {
      $value: c.hex,
      $type: 'color',
      $description: `${c.percentage}% usage (${c.count} hits) — e.g. ${c.sampleUsage}`,
    };
  });

  const fontFamily: Record<string, { $value: string; $type: string }> = {};
  report.ui.fonts.forEach((f, idx) => {
    const key = f.role === 'other' ? `family-${idx + 1}` : `${f.role}-${idx + 1}`;
    fontFamily[key] = {
      $value: f.family,
      $type: 'fontFamily',
    };
  });

  const typography: Record<
    string,
    {
      $type: string;
      $value: {
        fontFamily: string;
        fontSize: string;
        fontWeight: string;
        lineHeight: string;
        letterSpacing: string;
      };
    }
  > = {};
  report.ui.typeScale.forEach((t) => {
    typography[slugify(t.level)] = {
      $type: 'typography',
      $value: {
        fontFamily: t.fontFamily,
        fontSize: `${t.fontSizePx}px`,
        fontWeight: t.fontWeight,
        lineHeight: t.lineHeight,
        letterSpacing: t.letterSpacing,
      },
    };
  });

  const spacing: Record<string, { $value: string; $type: string }> = {};
  report.ui.spacing.forEach((s) => {
    spacing[`space-${s.valuePx}`] = {
      $value: `${s.valuePx}px`,
      $type: 'dimension',
    };
  });

  const borderRadius: Record<string, { $value: string; $type: string }> = {};
  report.ui.borderRadii.forEach((r, idx) => {
    borderRadius[`radius-${idx + 1}`] = {
      $value: r.value,
      $type: 'dimension',
    };
  });

  const shadow: Record<string, { $value: string; $type: string }> = {};
  report.ui.shadows.forEach((sh, idx) => {
    shadow[`elevation-${idx + 1}`] = {
      $value: sh.value,
      $type: 'shadow',
    };
  });

  const motion: Record<string, { $value: string; $type: string }> = {};
  report.ixd.transitions.slice(0, 8).forEach((t, idx) => {
    motion[`transition-${idx + 1}`] = {
      $value: `${t.property} ${t.duration} ${t.timingFunction}`,
      $type: 'transition',
    };
  });

  const tokens = {
    $metadata: {
      source: report.url,
      domain: report.domain,
      extractedAt: report.createdAt,
      baseSpacingUnit: `${report.ui.layout.baseSpacingUnitPx}px`,
      breakpoints: report.ui.layout.breakpoints.map((b) => `${b}px`),
    },
    color: colors,
    fontFamily,
    typography,
    spacing,
    borderRadius,
    shadow,
    motion,
  };

  return JSON.stringify(tokens, null, 2);
}

export function generateTailwindConfig(report: AuditReport): string {
  const colorEntries = report.ui.colors.slice(0, 12).map((c, idx) => {
    return `        '${c.role}-${idx + 1}': '${c.hex}', // ${c.percentage}% usage`;
  });

  const displayFont = report.ui.fonts.find((f) => f.role === 'display')?.family || report.ui.fonts[0]?.family || 'sans-serif';
  const bodyFont = report.ui.fonts.find((f) => f.role === 'body')?.family || report.ui.fonts[0]?.family || 'sans-serif';
  const monoFont = report.ui.fonts.find((f) => f.role === 'mono')?.family || 'monospace';

  const spacingEntries = report.ui.spacing.slice(0, 12).map((s) => `        '${s.valuePx}': '${s.valuePx}px',`);
  const radiusEntries = report.ui.borderRadii.slice(0, 6).map((r, idx) => `        'token-${idx + 1}': '${r.value}',`);
  const shadowEntries = report.ui.shadows.slice(0, 4).map((sh, idx) => `        'elevation-${idx + 1}': '${sh.value.replace(/'/g, "\\'")}',`);
  const screenEntries = report.ui.layout.breakpoints.slice(0, 6).map((bp, idx) => `        'bp-${idx + 1}': '${bp}px',`);

  return `import type { Config } from 'tailwindcss';

/**
 * Extracted Tailwind Configuration for ${report.domain}
 * Source: ${report.url}
 * Generated: ${new Date(report.createdAt).toLocaleString()}
 */
const config: Config = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
${colorEntries.join('\n') || "        'primary': '#111827',"}
      },
      fontFamily: {
        display: ['"${displayFont}"', 'sans-serif'],
        sans: ['"${bodyFont}"', 'sans-serif'],
        mono: ['"${monoFont}"', 'monospace'],
      },
      spacing: {
${spacingEntries.join('\n') || "        '16': '16px',"}
      },
      borderRadius: {
${radiusEntries.join('\n') || "        'token-1': '8px',"}
      },
      boxShadow: {
${shadowEntries.join('\n') || "        'elevation-1': '0 1px 2px rgba(0, 0, 0, 0.06)',"}
      },${
        screenEntries.length > 0
          ? `
      screens: {
${screenEntries.join('\n')}
      },`
          : ''
      }
    },
  },
  plugins: [],
};

export default config;
`;
}

export function generateDesignMd(report: AuditReport): string {
  const colorRows = report.ui.colors
    .slice(0, 14)
    .map((c) => `| \`${c.hex}\` | \`${c.rgb}\` | ${c.role} | ${c.percentage}% (${c.count}) | \`${c.sampleUsage}\` |`)
    .join('\n');

  const fontLines = report.ui.fonts
    .map((f) => `- **${f.family}** (${f.role}, ${f.source}) — Weights: ${f.weights.join(', ')}`)
    .join('\n');

  const typeRows = report.ui.typeScale
    .map(
      (t) =>
        `| ${t.level} | ${t.fontFamily} | ${t.fontSizePx}px | ${t.fontWeight} | ${t.lineHeight} | ${t.letterSpacing} |`
    )
    .join('\n');

  const spacingList = report.ui.spacing.map((s) => `\`${s.valuePx}px\``).join(', ');
  const radiusList = report.ui.borderRadii.map((r) => `\`${r.value}\` (${r.count}×)`).join(', ');
  const shadowLines = report.ui.shadows.map((s) => `- **${s.tier}**: \`${s.value}\``).join('\n');

  const componentSpecs = report.components
    .slice(0, 14)
    .map(
      (c) => `### ${c.name} (${c.category})
- **Selector**: \`${c.selector}\` (${c.width}×${c.height}px, source: \`${c.pagePath}\`)
\`\`\`css
${c.cssText}
\`\`\``
    )
    .join('\n\n');

  const transitionLines = report.ixd.transitions
    .slice(0, 10)
    .map((t) => `- \`${t.selector}\`: \`${t.property} ${t.duration} ${t.timingFunction}\``)
    .join('\n');

  return `# DESIGN.md — ${report.siteTitle}

> Extracted design system specification for **${report.domain}** (${report.url})  
> Crawled ${report.pages.length} page(s) on ${new Date(report.createdAt).toLocaleDateString()}

## 1. Visual Philosophy

${report.aiCritique.status === 'ready' && report.aiCritique.designPhilosophy ? report.aiCritique.designPhilosophy : `${report.domain} uses a ${report.ui.layout.detectedGridSystem.toLowerCase()} anchored on a ${report.ui.layout.baseSpacingUnitPx}px spacing grid with ${report.ui.fonts[0]?.family || 'system typography'}.`}

## 2. Color System

| Hex | RGB | Role | Usage Share | Sample Selector |
| --- | --- | --- | --- | --- |
${colorRows || '| — | — | — | — | — |'}

## 3. Typography & Scale

### Font Families
${fontLines || '- System font stack'}

### Computed Type Scale
| Level | Family | Size | Weight | Line Height | Tracking |
| --- | --- | --- | --- | --- | --- |
${typeRows || '| Body | System | 16px | 400 | 1.5 | 0px |'}

## 4. Spacing, Layout & Breakpoints

- **Detected Base Unit**: \`${report.ui.layout.baseSpacingUnitPx}px\`
- **Spacing Scale**: ${spacingList || 'Standard 8px increments'}
- **Layout Architecture**: ${report.ui.layout.detectedGridSystem} (Grid instances: ${report.ui.layout.gridUsageCount}, Flex instances: ${report.ui.layout.flexUsageCount})
- **Container Max Widths**: ${report.ui.layout.containerMaxWidths.map((w) => `${w}px`).join(', ') || 'Fluid'}
- **CSS Breakpoints**: ${report.ui.layout.breakpoints.map((b) => `${b}px`).join(', ') || 'None extracted from accessible stylesheets'}

## 5. Elevation, Radii & Media

- **Border Radii**: ${radiusList || 'Sharp 0px corners'}
- **Icons**: ${report.ui.mediaProfile.iconLibraries.join(', ') || 'None detected'} (${report.ui.mediaProfile.inlineSvgCount} inline SVGs)
- **Imagery**: ${report.ui.mediaProfile.imageStyleSummary}

### Shadows
${shadowLines || '- Flat elevation system (no box-shadows detected)'}

## 6. Motion & Interaction Tokens

- **Libraries**: ${report.ixd.animationLibraries.join(', ') || 'Native CSS'}
${transitionLines || '- No explicit CSS transitions extracted'}

## 7. Core Component Specifications

${componentSpecs || '_No component snapshots extracted._'}
`;
}

export function generateMarkdownReport(report: AuditReport): string {
  const aiSection =
    report.aiCritique.status === 'ready'
      ? `## Executive AI Critique

${report.aiCritique.executiveSummary}

### Why the Design Works
${report.aiCritique.whyItWorks.map((w) => `- **${w.title}**: ${w.detail} *(Evidence: ${w.evidence})*`).join('\n')}

### UX & Accessibility Weak Spots
${report.aiCritique.uxWeakSpots.map((w) => `- **${w.title}**: ${w.detail} *(Impact: ${w.impact})*`).join('\n')}

### Prioritized Improvements
${report.aiCritique.improvements.map((imp) => `- **[${imp.priority.toUpperCase()} · ${imp.category}] ${imp.title}**: ${imp.rationale} -> **Action**: ${imp.action}`).join('\n')}
`
      : `## Executive AI Critique\n\n_AI critique unavailable: ${report.aiCritique.errorMessage || 'Not generated'}_\n`;

  return `# UI/UX Audit Report — ${report.siteTitle}

- **URL**: ${report.url}
- **Audited**: ${new Date(report.createdAt).toLocaleString()}
- **Pages Crawled**: ${report.pages.length}
- **Accessibility Score**: ${report.accessibility.score}/100 (Grade ${report.accessibility.grade})
- **Primary Stack**: ${report.techStack.frameworks.join(', ')} · ${report.techStack.cssApproach.join(', ')}

---

${aiSection}

---

## 1. UI Design System Summary
- **Top Colors**: ${report.ui.colors.slice(0, 6).map((c) => `\`${c.hex}\` (${c.percentage}%)`).join(', ')}
- **Fonts**: ${report.ui.fonts.map((f) => f.family).join(', ')}
- **Base Spacing Grid**: ${report.ui.layout.baseSpacingUnitPx}px
- **Breakpoints**: ${report.ui.layout.breakpoints.map((b) => `${b}px`).join(', ') || 'None detected'}

## 2. Components Inventoried (${report.components.length})
${report.components.slice(0, 20).map((c) => `- **${c.name}** (${c.category}) on \`${c.pagePath}\` — ${c.width}×${c.height}px`).join('\n')}

## 3. Interaction Design (IxD)
- **Pseudo-State Rules Captured**: ${report.ixd.pseudoStates.length}
- **Transitions**: ${report.ixd.transitions.length}
- **Keyframes**: ${report.ixd.keyframes.length}
- **Animation Libraries**: ${report.ixd.animationLibraries.join(', ') || 'None'}

## 4. Information Architecture (IA)
${report.ia.sitemap.map((n) => `- \`${n.path}\` (${n.archetype}, depth ${n.depth}) — ${n.title}`).join('\n')}

## 5. UX & Conversion Flows
### Flows
${report.ux.flows.map((f) => `- **${f.name}**: ${f.detected ? 'Detected' : 'Not detected'} — ${f.notes}`).join('\n')}

### Top Calls to Action
${report.ux.ctas.slice(0, 10).map((c) => `- "${c.text}" (${c.placement}, repeated ${c.repeatCount}×)`).join('\n')}

### Mobile Responsive Delta
${report.ux.mobileDelta.layoutNotes.map((n) => `- ${n}`).join('\n')}

## 6. Accessibility Audit (${report.accessibility.score}/100)
- **WCAG Contrast Failures**: ${report.accessibility.contrastFailures.length} (out of ${report.accessibility.contrastCheckedCount} text nodes checked)
- **Images Missing Alt Text**: ${report.accessibility.missingAltImages.length} / ${report.accessibility.totalImagesChecked}
- **Unlabeled Buttons**: ${report.accessibility.ariaStats.unlabeledButtons} · **Unlabeled Inputs**: ${report.accessibility.ariaStats.unlabeledInputs}
- **Skip Link Present**: ${report.accessibility.keyboardFocus.hasSkipLink ? 'Yes' : 'No'}

## 7. Tech Stack & Performance
- **Frameworks**: ${report.techStack.frameworks.join(', ')}
- **CSS Approach**: ${report.techStack.cssApproach.join(', ')}
- **Component Libraries**: ${report.techStack.componentLibraries.join(', ') || 'None detected'}
- **CMS & Hosting**: ${report.techStack.cmsAndHosting.join(', ') || 'Not detected'}
- **Analytics & Tools**: ${report.techStack.analyticsAndTools.join(', ') || 'None detected'}
- **Load Time**: ${report.techStack.pageSpeed.loadTimeMs}ms · **FCP**: ${report.techStack.pageSpeed.firstContentfulPaintMs ?? 'N/A'}ms · **Total Weight**: ${report.techStack.pageSpeed.totalTransferKb} KB (${report.techStack.pageSpeed.totalRequests} requests)
`;
}

export function downloadTextFile(filename: string, content: string, mimeType = 'text/plain;charset=utf-8'): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function downloadZipBundle(report: AuditReport): Promise<void> {
  const zip = new JSZip();
  const rootName = `monograph-${slugify(report.domain)}`;
  const root = zip.folder(rootName)!;

  root.file('DESIGN.md', generateDesignMd(report));
  root.file('tokens.json', generateTokensJson(report));
  root.file('tailwind.config.ts', generateTailwindConfig(report));
  root.file('audit-report.md', generateMarkdownReport(report));

  const pagesDir = root.folder('screenshots/pages')!;
  report.pages.forEach((p, idx) => {
    const pageSlug = `${String(idx + 1).padStart(2, '0')}-${slugify(p.path === '/' ? 'home' : p.path)}`;
    (['desktop', 'tablet', 'phone'] as const).forEach((vp) => {
      const shot = p.screenshots[vp];
      if (shot?.dataUrl) {
        const b64 = dataUrlToBase64(shot.dataUrl);
        if (b64) pagesDir.file(`${pageSlug}-${vp}.jpg`, b64, { base64: true });
      }
    });
  });

  const compDir = root.folder('screenshots/components')!;
  report.components.forEach((c, idx) => {
    if (c.screenshotDataUrl) {
      const b64 = dataUrlToBase64(c.screenshotDataUrl);
      if (b64) {
        compDir.file(`${String(idx + 1).padStart(2, '0')}-${c.category}-${slugify(c.name)}.jpg`, b64, { base64: true });
      }
    }
  });

  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${rootName}-bundle.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

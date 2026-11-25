import { GoogleGenAI, Type } from '@google/genai';
import type { AICritique, AuditReport } from '../src/types/audit.ts';

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'GEMINI_API_KEY is not configured on the server. Add your key in Settings > Secrets to enable AI critique synthesis.'
    );
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function stripDataUrlPrefix(dataUrl: string): { mimeType: string; data: string } | null {
  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(dataUrl);
  if (!match) return null;
  return { mimeType: match[1], data: match[2] };
}

export async function generateGroundedAICritique(
  partialReport: Omit<AuditReport, 'aiCritique'>
): Promise<AICritique> {
  try {
    const ai = getGeminiClient();

    // Build a compact, strictly factual digest so every hex, font, size, and timing is grounded
    const factualDigest = {
      domain: partialReport.domain,
      url: partialReport.url,
      siteTitle: partialReport.siteTitle,
      pagesCrawled: partialReport.pages.map((p) => ({
        path: p.path,
        archetype: p.archetype,
        title: p.title,
        loadTimeMs: p.loadTimeMs,
        wordCount: p.wordCount,
      })),
      ui: {
        topColors: partialReport.ui.colors.slice(0, 10),
        fonts: partialReport.ui.fonts.slice(0, 5),
        typeScale: partialReport.ui.typeScale.slice(0, 8),
        baseSpacingUnitPx: partialReport.ui.layout.baseSpacingUnitPx,
        spacingTokens: partialReport.ui.spacing.slice(0, 8).map((s) => s.valuePx),
        borderRadii: partialReport.ui.borderRadii.slice(0, 6),
        shadowsCount: partialReport.ui.shadows.length,
        breakpoints: partialReport.ui.layout.breakpoints,
        gridSystem: partialReport.ui.layout.detectedGridSystem,
        mediaProfile: partialReport.ui.mediaProfile,
      },
      componentsSummary: partialReport.components.reduce<Record<string, number>>((acc, c) => {
        acc[c.category] = (acc[c.category] || 0) + 1;
        return acc;
      }, {}),
      ixd: {
        pseudoStatesCount: partialReport.ixd.pseudoStates.length,
        sampleTransitions: partialReport.ixd.transitions.slice(0, 6),
        keyframesCount: partialReport.ixd.keyframes.length,
        scrollEffects: partialReport.ixd.scrollEffects,
        animationLibraries: partialReport.ixd.animationLibraries,
      },
      ia: {
        sitemapDepthMax: Math.max(0, ...partialReport.ia.sitemap.map((n) => n.depth)),
        primaryNavItems: partialReport.ia.primaryNavigation.map((n) => n.label),
        footerColumnsCount: partialReport.ia.footerColumns.length,
        headingWarnings: partialReport.ia.headingStructures
          .filter((h) => h.skippedLevels.length > 0 || h.h1Count !== 1)
          .map((h) => ({ path: h.pagePath, h1Count: h.h1Count, skipped: h.skippedLevels })),
      },
      ux: {
        flows: partialReport.ux.flows,
        topCtas: partialReport.ux.ctas.slice(0, 8),
        forms: partialReport.ux.forms.slice(0, 6),
        trustSignalsCount: partialReport.ux.trustSignals.length,
        mobileDelta: partialReport.ux.mobileDelta,
      },
      accessibility: {
        score: partialReport.accessibility.score,
        grade: partialReport.accessibility.grade,
        contrastFailuresCount: partialReport.accessibility.contrastFailures.length,
        sampleContrastFailures: partialReport.accessibility.contrastFailures.slice(0, 5),
        missingAltCount: partialReport.accessibility.missingAltImages.length,
        ariaStats: partialReport.accessibility.ariaStats,
        keyboardFocus: partialReport.accessibility.keyboardFocus,
        semanticHtml: partialReport.accessibility.semanticHtml,
      },
      techStack: {
        frameworks: partialReport.techStack.frameworks,
        cssApproach: partialReport.techStack.cssApproach,
        componentLibraries: partialReport.techStack.componentLibraries,
        cmsAndHosting: partialReport.techStack.cmsAndHosting,
        analytics: partialReport.techStack.analyticsAndTools,
        pageSpeed: partialReport.techStack.pageSpeed,
      },
    };

    const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];

    // Attach real desktop and phone homepage screenshots for multimodal visual grounding
    const homePage = partialReport.pages[0];
    if (homePage?.screenshots?.desktop?.dataUrl) {
      const parsed = stripDataUrlPrefix(homePage.screenshots.desktop.dataUrl);
      if (parsed) parts.push({ inlineData: parsed });
    }
    if (homePage?.screenshots?.phone?.dataUrl) {
      const parsed = stripDataUrlPrefix(homePage.screenshots.phone.dataUrl);
      if (parsed) parts.push({ inlineData: parsed });
    }

    parts.push({
      text: `Analyze the following real extracted front-end telemetry and screenshots for ${partialReport.url}.

STRICT GROUNDING RULES:
- Cite ONLY exact extracted hex codes, pixel sizes, font families, transition timings, contrast ratios, form counts, and load metrics from the JSON below.
- Never invent measurements not present in the data.
- Write in an incisive, senior principal product designer and design-engineer voice—clear, specific, architectural, zero fluff.

EXTRACTED TELEMETRY JSON:
${JSON.stringify(factualDigest)}`,
    });

    let response;
    let lastErr: unknown;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        response = await ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: { parts },
          config: {
            systemInstruction:
              'You are a Principal Design Systems Architect and UX Auditor. Synthesize real extracted browser telemetry and screenshots into a sharp, evidence-backed design critique. Keep every point concrete and directly tied to measured hex values, font sizes, timings, contrast ratios, and layout metrics.',
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                executiveSummary: {
                  type: Type.STRING,
                  description: '2-3 crisp sentences summarizing the site design posture, architecture, and primary takeaway.',
                },
                designPhilosophy: {
                  type: Type.STRING,
                  description: 'A reusable 2-3 sentence architectural statement describing the visual language for DESIGN.md.',
                },
                whyItWorks: {
                  type: Type.ARRAY,
                  description: '3 to 5 specific design/engineering strengths backed by exact extracted values.',
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      title: { type: Type.STRING },
                      detail: { type: Type.STRING },
                      evidence: { type: Type.STRING, description: 'Exact extracted hex, px, ms, or metric citing proof.' },
                    },
                    required: ['title', 'detail', 'evidence'],
                  },
                },
                uxWeakSpots: {
                  type: Type.ARRAY,
                  description: '3 to 5 concrete UX, UI, or Accessibility weak spots found in the crawl.',
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      title: { type: Type.STRING },
                      detail: { type: Type.STRING },
                      impact: { type: Type.STRING, description: 'Concrete user or conversion impact.' },
                    },
                    required: ['title', 'detail', 'impact'],
                  },
                },
                improvements: {
                  type: Type.ARRAY,
                  description: '4 to 6 prioritized, actionable engineering or design improvements.',
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      priority: { type: Type.STRING, enum: ['high', 'medium', 'low'] },
                      category: {
                        type: Type.STRING,
                        enum: ['UI', 'UX', 'IxD', 'IA', 'Accessibility', 'Performance'],
                      },
                      title: { type: Type.STRING },
                      rationale: { type: Type.STRING },
                      action: { type: Type.STRING, description: 'Specific CSS, token, or UX change to apply.' },
                    },
                    required: ['priority', 'category', 'title', 'rationale', 'action'],
                  },
                },
              },
              required: ['executiveSummary', 'designPhilosophy', 'whyItWorks', 'uxWeakSpots', 'improvements'],
            },
          },
        });
        break;
      } catch (err) {
        lastErr = err;
        const msg = err instanceof Error ? err.message : String(err);
        const isTransient = /503|UNAVAILABLE|overloaded|high demand|ECONNRESET|timeout/i.test(msg);
        if (attempt < 2 && isTransient) {
          await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
          continue;
        }
        throw err;
      }
    }

    if (!response) {
      throw lastErr || new Error('Failed to receive response from Gemini.');
    }

    const rawText = (response.text ?? '').trim();
    if (!rawText) {
      throw new Error('The AI model returned an empty critique response.');
    }

    const parsed = JSON.parse(rawText) as Omit<AICritique, 'status'>;
    return {
      status: 'ready',
      executiveSummary: parsed.executiveSummary || '',
      designPhilosophy: parsed.designPhilosophy || '',
      whyItWorks: Array.isArray(parsed.whyItWorks) ? parsed.whyItWorks : [],
      uxWeakSpots: Array.isArray(parsed.uxWeakSpots) ? parsed.uxWeakSpots : [],
      improvements: Array.isArray(parsed.improvements) ? parsed.improvements : [],
    };
  } catch (err: unknown) {
    let message = err instanceof Error ? err.message : 'Failed to generate AI design critique.';
    try {
      const parsedErr = JSON.parse(message) as { error?: { message?: string } };
      if (parsedErr?.error?.message) {
        message = parsedErr.error.message;
      }
    } catch {
      // Keep raw message if not JSON
    }
    return {
      status: 'error',
      errorMessage: message,
      executiveSummary: '',
      designPhilosophy: '',
      whyItWorks: [],
      uxWeakSpots: [],
      improvements: [],
    };
  }
}

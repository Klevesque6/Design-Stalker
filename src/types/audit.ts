export type ViewportKey = 'desktop' | 'tablet' | 'phone';

export type PageArchetype =
  | 'home'
  | 'product'
  | 'pricing'
  | 'signup'
  | 'checkout'
  | 'contact'
  | 'docs'
  | 'about'
  | 'other';

export interface AuditConfig {
  url: string;
  maxPages: number;
  viewports: ViewportKey[];
}

export interface ViewportScreenshot {
  viewport: ViewportKey;
  width: number;
  height: number;
  fullHeight: number;
  dataUrl: string; // image/jpeg or image/png base64 data URL
}

export interface CrawledPageSummary {
  url: string;
  path: string;
  title: string;
  archetype: PageArchetype;
  depth: number;
  statusCode: number;
  loadTimeMs: number;
  internalLinksCount: number;
  wordCount: number;
  screenshots: Partial<Record<ViewportKey, ViewportScreenshot>>;
}

export interface ColorToken {
  hex: string;
  rgb: string;
  count: number;
  percentage: number;
  role: 'background' | 'surface' | 'text' | 'accent' | 'border';
  sampleUsage: string;
}

export interface FontFamilyToken {
  family: string;
  weights: string[];
  usageCount: number;
  role: 'display' | 'body' | 'mono' | 'other';
  source: 'google-fonts' | 'custom-webfont' | 'system';
}

export interface TypeScaleEntry {
  level: string; // e.g., H1, H2, H3, Body, Small, Button
  fontFamily: string;
  fontSizePx: number;
  fontWeight: string;
  lineHeight: string;
  letterSpacing: string;
  sampleText: string;
  count: number;
}

export interface SpacingToken {
  valuePx: number;
  label: string;
  count: number;
  usage: string;
}

export interface RadiusToken {
  value: string;
  count: number;
}

export interface ShadowToken {
  value: string;
  count: number;
  tier: string;
}

export interface LayoutAnalysis {
  breakpoints: number[];
  containerMaxWidths: number[];
  gridUsageCount: number;
  flexUsageCount: number;
  detectedGridSystem: string;
  baseSpacingUnitPx: number;
}

export interface IconAndImageProfile {
  iconLibraries: string[];
  inlineSvgCount: number;
  totalImages: number;
  imageFormats: Record<string, number>;
  lazyLoadedPercent: number;
  dominantAspectRatios: { ratio: string; count: number }[];
  imageStyleSummary: string;
}

export interface UIAnalysis {
  colors: ColorToken[];
  cssVariables: { name: string; value: string }[];
  fonts: FontFamilyToken[];
  typeScale: TypeScaleEntry[];
  spacing: SpacingToken[];
  borderRadii: RadiusToken[];
  shadows: ShadowToken[];
  layout: LayoutAnalysis;
  mediaProfile: IconAndImageProfile;
}

export type ComponentCategory =
  | 'button'
  | 'card'
  | 'nav'
  | 'form'
  | 'modal'
  | 'hero'
  | 'footer';

export interface ComponentInventoryItem {
  id: string;
  category: ComponentCategory;
  name: string;
  selector: string;
  pageUrl: string;
  pagePath: string;
  width: number;
  height: number;
  screenshotDataUrl: string | null;
  cssText: string;
  computedStyles: Record<string, string>;
  textSnippet: string;
  instanceCount: number;
}

export interface PseudoStateRule {
  selector: string;
  state: 'hover' | 'focus' | 'focus-visible' | 'active';
  properties: Record<string, string>;
}

export interface TransitionRule {
  selector: string;
  property: string;
  duration: string;
  timingFunction: string;
  delay: string;
}

export interface KeyframeRule {
  name: string;
  steps: string;
  usedByCount: number;
}

export interface ScrollEffectSignal {
  type: 'sticky' | 'smooth-scroll' | 'parallax' | 'scroll-animation' | 'snap';
  detail: string;
  count: number;
}

export interface IxDAnalysis {
  pseudoStates: PseudoStateRule[];
  transitions: TransitionRule[];
  keyframes: KeyframeRule[];
  scrollEffects: ScrollEffectSignal[];
  animationLibraries: string[];
  interactiveElementCount: number;
}

export interface SitemapNode {
  url: string;
  path: string;
  title: string;
  archetype: PageArchetype;
  depth: number;
  parentPath: string | null;
  inboundLinks: number;
  outboundLinks: number;
}

export interface NavMenuItem {
  label: string;
  href: string;
  children: { label: string; href: string }[];
}

export interface HeadingNode {
  level: number; // 1..6
  text: string;
  hasSkipWarning?: boolean;
}

export interface PageHeadingStructure {
  pageUrl: string;
  pagePath: string;
  pageTitle: string;
  headings: HeadingNode[];
  h1Count: number;
  skippedLevels: string[];
}

export interface IAAnalysis {
  sitemap: SitemapNode[];
  primaryNavigation: NavMenuItem[];
  footerColumns: { heading: string; links: { label: string; href: string }[] }[];
  headingStructures: PageHeadingStructure[];
}

export interface UserFlowSummary {
  name: string; // Signup, Checkout, Contact, Pricing Exploration
  detected: boolean;
  entryPage: string;
  targetUrl: string | null;
  estimatedSteps: number;
  notes: string;
}

export interface CTAEntry {
  text: string;
  href: string;
  placement: 'above-the-fold' | 'mid-page' | 'footer' | 'navigation';
  pagePath: string;
  repeatCount: number;
  backgroundColor: string;
  textColor: string;
}

export interface FormAuditItem {
  pagePath: string;
  purpose: string;
  fieldCount: number;
  requiredCount: number;
  inputTypes: string[];
  isMultiStep: boolean;
  submitLabel: string;
}

export interface TrustSignalItem {
  category: 'reviews' | 'logos' | 'security-badge' | 'metrics' | 'guarantee';
  label: string;
  evidence: string;
  pagePath: string;
}

export interface ResponsiveMobileDelta {
  navCollapsedToMenu: boolean;
  desktopH1Px: number | null;
  mobileH1Px: number | null;
  desktopBodyPx: number | null;
  mobileBodyPx: number | null;
  horizontalOverflowOnMobile: boolean;
  hiddenElementsOnMobileCount: number;
  layoutNotes: string[];
}

export interface UXAnalysis {
  flows: UserFlowSummary[];
  ctas: CTAEntry[];
  forms: FormAuditItem[];
  trustSignals: TrustSignalItem[];
  mobileDelta: ResponsiveMobileDelta;
}

export interface ContrastFailure {
  selector: string;
  textSnippet: string;
  foregroundHex: string;
  backgroundHex: string;
  ratio: number;
  requiredRatio: number;
  fontSizePx: number;
  pagePath: string;
}

export interface MissingAltImage {
  src: string;
  pagePath: string;
  width: number;
  height: number;
}

export interface AccessibilityAnalysis {
  score: number; // 0-100 deterministic score
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  contrastFailures: ContrastFailure[];
  contrastCheckedCount: number;
  missingAltImages: MissingAltImage[];
  totalImagesChecked: number;
  ariaStats: {
    hasMainLandmark: boolean;
    hasNavLandmark: boolean;
    hasHeaderLandmark: boolean;
    hasFooterLandmark: boolean;
    unlabeledButtons: number;
    unlabeledInputs: number;
    ariaAttributesCount: number;
  };
  keyboardFocus: {
    hasSkipLink: boolean;
    focusableElementsCount: number;
    outlineRemovedWithoutFallback: number;
    positiveTabIndexCount: number;
  };
  semanticHtml: {
    hasLangAttribute: boolean;
    langValue: string;
    hasDocumentTitle: boolean;
    headingOrderValid: boolean;
    semanticTagsRatio: number;
  };
}

export interface PageSpeedBasics {
  domContentLoadedMs: number;
  loadTimeMs: number;
  firstContentfulPaintMs: number | null;
  totalRequests: number;
  totalTransferKb: number;
  breakdownByType: {
    type: string;
    requests: number;
    sizeKb: number;
  }[];
}

export interface TechStackAnalysis {
  frameworks: string[];
  cssApproach: string[];
  componentLibraries: string[];
  cmsAndHosting: string[];
  analyticsAndTools: string[];
  scriptUrls: string[];
  stylesheetCount: number;
  inlineStyleCount: number;
  htmlSizeKb: number;
  pageSpeed: PageSpeedBasics;
}

export interface AICritiqueImprovement {
  priority: 'high' | 'medium' | 'low';
  category: 'UI' | 'UX' | 'IxD' | 'IA' | 'Accessibility' | 'Performance';
  title: string;
  rationale: string;
  action: string;
}

export interface AICritique {
  status: 'ready' | 'error';
  errorMessage?: string;
  executiveSummary: string;
  designPhilosophy: string;
  whyItWorks: { title: string; detail: string; evidence: string }[];
  uxWeakSpots: { title: string; detail: string; impact: string }[];
  improvements: AICritiqueImprovement[];
}

export interface AuditReport {
  id: string;
  url: string;
  domain: string;
  siteTitle: string;
  faviconUrl: string | null;
  createdAt: string;
  crawlDurationMs: number;
  config: AuditConfig;
  pages: CrawledPageSummary[];
  rawArtifacts: {
    homeHtmlPreview: string;
    stylesheetUrls: string[];
    scriptUrls: string[];
  };
  ui: UIAnalysis;
  components: ComponentInventoryItem[];
  ixd: IxDAnalysis;
  ia: IAAnalysis;
  ux: UXAnalysis;
  accessibility: AccessibilityAnalysis;
  techStack: TechStackAnalysis;
  aiCritique: AICritique;
}

export interface CrawlProgressEvent {
  type: 'stage' | 'page' | 'metric' | 'complete' | 'error';
  stage?: string;
  message: string;
  percent: number;
  pagesCompleted?: number;
  totalPagesTarget?: number;
  currentUrl?: string;
  report?: AuditReport;
  error?: string;
}

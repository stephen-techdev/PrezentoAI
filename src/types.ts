// Core presentation data model for Prezento AI

export type SlideLayout =
  | 'hero'
  | 'agenda'
  | 'two-column'
  | 'comparison'
  | 'timeline'
  | 'process'
  | 'diagram'
  | 'grid'
  | 'cards'
  | 'quote'
  | 'statistics'
  | 'image-left'
  | 'image-right'
  | 'full-image'
  | 'section-divider'
  | 'table'
  | 'chart'
  | 'thank-you';

export interface SlideBullet {
  id: string;
  text: string;
}

export interface TimelineItem {
  id: string;
  year: string;
  title: string;
  description: string;
}

export interface ProcessStep {
  id: string;
  step: number;
  title: string;
  description: string;
}

export interface StatItem {
  id: string;
  value: string;
  label: string;
  description?: string;
}

export interface CardItem {
  id: string;
  title: string;
  description: string;
  icon?: string;
}

export interface ComparisonRow {
  id: string;
  feature: string;
  optionA: string;
  optionB: string;
}

export interface TableData {
  headers: string[];
  rows: string[][];
}

export interface ChartData {
  chartType: 'bar' | 'line' | 'doughnut' | 'pie';
  labels: string[];
  values: number[];
  title?: string;
}

export type ShapeKind = 'rectangle' | 'circle' | 'triangle' | 'star' | 'heart' | 'hexagon' | 'diamond' | 'arrow' | 'line';

export interface BaseElement {
  id: string;
  x: number; // 0..1 fraction of slide width
  y: number; // 0..1 fraction of slide height
  w: number; // 0..1 fraction of slide width
  h: number; // 0..1 fraction of slide height
  rotation?: number; // degrees
}

export interface TextBoxElement extends BaseElement {
  kind: 'text';
  text: string;
  fontFamily?: FontFamily;
  fontSize?: number; // px at 1280x720
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  color?: string;
  align?: 'left' | 'center' | 'right' | 'justify';
  background?: string;
  borderRadius?: number;
  lineHeight?: number;
  letterSpacing?: number;
  paragraphSpacing?: number;
}

export interface ShapeElement extends BaseElement {
  kind: 'shape';
  shape: ShapeKind;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
}

export interface ImageElement extends BaseElement {
  kind: 'image';
  url: string;
  alt?: string;
  objectFit?: 'cover' | 'contain';
  borderRadius?: number;
  opacity?: number;
}

export type SlideElement = TextBoxElement | ShapeElement | ImageElement;

/** Formatting properties shared by text — used for overlay elements and
 * AI-generated template fields alike so a single toolbar can drive both. */
export interface TextFormat {
  fontFamily?: FontFamily;
  fontSize?: number;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  color?: string;
  align?: 'left' | 'center' | 'right' | 'justify';
  lineHeight?: number;
  letterSpacing?: number;
  paragraphSpacing?: number;
}

/** Key identifying an AI-generated template text field on a slide. */
export type FieldKey = string; // e.g. 'title', 'subtitle', 'body', 'bullets:0', 'cards:1:title'

export interface SlideBackground {
  type: 'solid' | 'gradient';
  color?: string;
  from?: string;
  to?: string;
  angle?: number;
  /** Decorative pattern overlay (dots, grid, lines, blobs). */
  pattern?: 'none' | 'dots' | 'grid' | 'lines' | 'blobs';
  /** Custom background image (data URL or remote URL). */
  imageUrl?: string;
}

export interface Slide {
  id: string;
  layout: SlideLayout;
  title: string;
  subtitle?: string;
  body?: string;
  bullets?: SlideBullet[];
  // layout-specific
  timeline?: TimelineItem[];
  steps?: ProcessStep[];
  stats?: StatItem[];
  cards?: CardItem[];
  comparison?: { leftTitle: string; rightTitle: string; rows: ComparisonRow[] };
  table?: TableData;
  chart?: ChartData;
  quote?: { text: string; author: string };
  image?: { url: string; alt: string; source?: string };
  sectionNumber?: string;
  notes?: string;
  // visual hints
  accentIcon?: string;
  // editor extensions
  elements?: SlideElement[];
  background?: SlideBackground;
  /** Per-field text formatting overrides for AI-generated template text.
   * Keyed by FieldKey (e.g. 'title', 'bullets:0'). Lets the floating toolbar
   * format AI text the same way it formats manually added text elements. */
  fieldStyles?: Record<FieldKey, TextFormat>;
}

export type ThemeId =
  | 'classic'
  | 'modern'
  | 'minimal'
  | 'corporate'
  | 'business'
  | 'education'
  | 'dark'
  | 'creative'
  | 'gradient'
  | 'elegant';

export type BackgroundStyle =
  | 'white'
  | 'black'
  | 'blue'
  | 'green'
  | 'purple'
  | 'gradient'
  | 'abstract'
  | 'geometric'
  | 'glassmorphism'
  | 'custom';

// FontFamily is now an open string type — the full list lives in src/lib/fonts.ts.
// This keeps backward compatibility with existing presentations while allowing
// the expanded 75-font library.
export type FontFamily = string;

export type IconStyle = 'line' | 'solid' | 'duotone' | 'minimal';

export type PresentationStyle =
  | 'formal'
  | 'casual'
  | 'persuasive'
  | 'informative'
  | 'storytelling';

export type Audience = 'school' | 'college' | 'teacher' | 'business' | 'investor';

export type GenerationMode = 'ai_generation' | 'detailed_prompt';

export interface PresentationSettings {
  title: string;
  prompt: string;
  slideCount: number;
  audience: Audience;
  language: string;
  mode: GenerationMode;
  theme: ThemeId;
  background: BackgroundStyle;
  fontFamily: FontFamily;
  primaryColor: string;
  secondaryColor: string;
  iconStyle: IconStyle;
  presentationStyle: PresentationStyle;
  duration: number; // minutes
  speakerNotes: boolean;
  references: boolean;
  images: boolean;
  charts: boolean;
  /** Adds a one-line explanation to very short bullets at generation time. */
  explainPoints: boolean;
}

export interface Presentation {
  id: string;
  settings: PresentationSettings;
  slides: Slide[];
  createdAt: string;
  updatedAt: string;
}

export interface VivaQuestion {
  id: string;
  question: string;
  answer: string;
  followUps: string[];
}

export interface PresentationScore {
  contentQuality: number;
  design: number;
  readability: number;
  visualBalance: number;
  grammar: number;
  flow: number;
  overall: number;
  suggestions: string[];
}

export type RewriteTone =
  | 'rewrite'
  | 'shorten'
  | 'expand'
  | 'simplify'
  | 'professional'
  | 'academic'
  | 'business'
  | 'friendly';

export const DEFAULT_SETTINGS: PresentationSettings = {
  title: '',
  prompt: '',
  slideCount: 10,
  audience: 'college',
  language: 'English',
  mode: 'ai_generation',
  theme: 'modern',
  background: 'white',
  fontFamily: 'inter',
  primaryColor: '#06b6d4',
  secondaryColor: '#6366f1',
  iconStyle: 'line',
  presentationStyle: 'formal',
  duration: 15,
  speakerNotes: true,
  references: true,
  images: true,
  charts: true,
  explainPoints: true,
};

// ─────────────────────────────────────────────────────────────────────────────
// AI Chat Action Engine
//
// Parses natural-language editing instructions into structured actions and
// executes them against the presentation state. Supports two modes:
//   1. AI-powered intent parsing (via backend /api/edit) — broad NLU
//   2. Local regex fallback parser — works offline, covers common commands
//
// The engine is a controlled, safe action system — it never executes
// arbitrary code, accesses auth, or touches anything outside the
// presentation data model.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  Presentation, Slide, PresentationSettings, SlideElement,
  TextBoxElement, ImageElement, SlideBackground,
  ThemeId, FontFamily, SlideLayout, RewriteTone,
  FieldKey, TextFormat,
} from '../types';
import { THEMES, THEME_LIST } from '../themes';
import { uid } from './id';

// ── Action types ─────────────────────────────────────────────────────────────

export type EditAction =
  | { type: 'change_background'; target: SlideTarget; color?: string; gradientFrom?: string; gradientTo?: string }
  | { type: 'change_text'; target: SlideTarget; field: 'title' | 'subtitle' | 'body' | 'notes'; value: string }
  | { type: 'change_text_color'; target: SlideTarget; field: 'title' | 'subtitle' | 'body' | 'bullets'; color: string }
  | { type: 'change_font_size'; target: SlideTarget; field: 'title' | 'subtitle' | 'body' | 'bullets'; delta: number }
  | { type: 'change_font_family'; target: SlideTarget; fontFamily: string }
  | { type: 'toggle_bold'; target: SlideTarget; field: 'title' | 'subtitle' | 'body' | 'bullets' }
  | { type: 'toggle_italic'; target: SlideTarget; field: 'title' | 'subtitle' | 'body' | 'bullets' }
  | { type: 'change_alignment'; target: SlideTarget; align: 'left' | 'center' | 'right' }
  | { type: 'change_layout'; target: SlideTarget; layout: SlideLayout }
  | { type: 'convert_layout'; target: SlideTarget; layout: 'table' | 'cards' | 'process' | 'timeline' | 'statistics' | 'comparison' | 'quote' | 'two-column' }
  | { type: 'add_slide'; afterIndex?: number }
  | { type: 'delete_slide'; index: number }
  | { type: 'duplicate_slide'; index: number }
  | { type: 'reorder_slide'; fromIndex: number; toIndex: number }
  | { type: 'apply_theme'; themeId: ThemeId }
  | { type: 'change_settings'; patch: Partial<PresentationSettings> }
  | { type: 'add_image'; target: SlideTarget; query: string }
  | { type: 'remove_image'; target: SlideTarget }
  | { type: 'replace_image'; target: SlideTarget; query: string }
  | { type: 'change_image_position'; target: SlideTarget; x?: number; y?: number }
  | { type: 'change_image_size'; target: SlideTarget; w?: number; h?: number }
  | { type: 'shorten_text'; target: SlideTarget; field: 'body' | 'bullets' }
  | { type: 'rewrite_text'; target: SlideTarget; field: 'title' | 'subtitle' | 'body' | 'notes'; tone: RewriteTone; value: string }
  | { type: 'add_bullet'; target: SlideTarget; text: string; position?: number }
  | { type: 'remove_bullet'; target: SlideTarget; index: number }
  | { type: 'change_bullet'; target: SlideTarget; index: number; text: string }
  | { type: 'improve_design'; target: SlideTarget }
  | { type: 'copy_style'; fromIndex: number; toIndex: number | 'all' }
  | { type: 'change_slide_title'; target: number; title: string }
  | { type: 'update_field_style'; target: SlideTarget; fieldKey: FieldKey; patch: TextFormat }
  | { type: 'update_selected_element'; patch: Partial<TextBoxElement> }
  | { type: 'update_all_text_style'; target: SlideTarget; patch: TextFormat; headingOnly?: boolean }
  | { type: 'delete_element'; target: SlideTarget; elementId?: string; matchText?: string }
  | { type: 'remove_exact_text'; target: SlideTarget; exactText: string }
  | { type: 'replace_exact_text'; target: SlideTarget; findText: string; replaceText: string };

export type SlideTarget = 'current' | 'all' | number;

export interface ActionResult {
  presentation: Presentation;
  message: string;
  applied: number;
  failed: string[];
  needsConfirmation?: boolean;
}

// ── Context passed to the engine ──────────────────────────────────────────────

export interface EditorContext {
  presentation: Presentation;
  currentSlideIndex: number;
  selectedElementId: string | null;
}

// ── Collect all AI template field keys that exist on a slide ──────────────────

function collectFieldKeys(slide: Slide): FieldKey[] {
  const keys: FieldKey[] = [];
  if (slide.title) keys.push('title');
  if (slide.subtitle) keys.push('subtitle');
  if (slide.body) keys.push('body');
  (slide.bullets || []).forEach((_, i) => keys.push(`bullets:${i}`));
  (slide.cards || []).forEach((_, i) => { keys.push(`cards:${i}:title`); keys.push(`cards:${i}:description`); });
  (slide.stats || []).forEach((_, i) => { keys.push(`stats:${i}:value`); keys.push(`stats:${i}:label`); if (slide.stats![i].description) keys.push(`stats:${i}:description`); });
  (slide.timeline || []).forEach((_, i) => { keys.push(`timeline:${i}:year`); keys.push(`timeline:${i}:title`); keys.push(`timeline:${i}:description`); });
  (slide.steps || []).forEach((_, i) => { keys.push(`steps:${i}:title`); keys.push(`steps:${i}:description`); });
  if (slide.quote) { keys.push('quote:text'); keys.push('quote:author'); }
  return keys;
}

// Heading field keys are 'title', 'subtitle', and card/stat/timeline titles.
function isHeadingField(key: FieldKey): boolean {
  if (key === 'title' || key === 'subtitle') return true;
  if (key.startsWith('cards:') && key.endsWith(':title')) return true;
  if (key.startsWith('stats:') && key.endsWith(':label')) return true;
  if (key.startsWith('timeline:') && key.endsWith(':title')) return true;
  if (key.startsWith('steps:') && key.endsWith(':title')) return true;
  return false;
}

// Map a field word from user input (title/heading/subtitle/body/bullets) to
// the matching fieldStyle key(s).
function fieldWordToKeys(word: string, slide: Slide): FieldKey[] {
  const w = word.toLowerCase();
  if (w === 'title' || w === 'heading' || w === 'name') return slide.title ? ['title'] : [];
  if (w === 'subtitle' || w === 'subheading') return slide.subtitle ? ['subtitle'] : [];
  if (w === 'body' || w === 'paragraph' || w === 'content' || w === 'text') return slide.body ? ['body'] : collectFieldKeys(slide);
  if (w.startsWith('bullet') || w === 'point' || w === 'points') return (slide.bullets || []).map((_, i) => `bullets:${i}`);
  return [];
}

// ── Color name → hex mapping ──────────────────────────────────────────────────

const COLOR_MAP: Record<string, string> = {
  pink: '#ec4899', lightpink: '#fce7f3', hotpink: '#f472b6',
  red: '#ef4444', lightred: '#fee2e2', darkred: '#991b1b',
  orange: '#f97316', lightorange: '#fed7aa', darkorange: '#c2410c',
  yellow: '#f59e0b', lightyellow: '#fef9c3', gold: '#eab308',
  green: '#10b981', lightgreen: '#d1fae5', darkgreen: '#047857', emerald: '#10b981',
  blue: '#3b82f6', lightblue: '#dbeafe', darkblue: '#1e40af', navy: '#1e3a8a',
  cyan: '#06b6d4', lightcyan: '#cffafe', teal: '#14b8a6',
  purple: '#8b5cf6', lightpurple: '#ede9fe', darkpurple: '#6d28d9',
  violet: '#8b5cf6', indigo: '#6366f1', magenta: '#d946ef',
  white: '#ffffff', black: '#0b1120', gray: '#6b7280', grey: '#6b7280',
  darkgray: '#374151', lightgray: '#f3f4f6', slate: '#64748b',
  brown: '#92400e', cream: '#fffbeb', beige: '#fef3c7',
  coral: '#fb7185', mint: '#6ee7b7', lavender: '#ddd6fe',
  sky: '#0ea5e9', rose: '#f43f5e', amber: '#f59e0b', lime: '#84cc16',
};

export function resolveColor(input: string): string | undefined {
  const lower = input.toLowerCase().replace(/\s+/g, '');
  if (/^#[0-9a-f]{6}$/i.test(lower)) return lower;
  if (/^#[0-9a-f]{3}$/i.test(lower)) return lower;
  if (COLOR_MAP[lower]) return COLOR_MAP[lower];
  // Try "light blue" -> "lightblue"
  const noSpace = input.toLowerCase().replace(/\s+/g, '');
  if (COLOR_MAP[noSpace]) return COLOR_MAP[noSpace];
  return undefined;
}

function findColorInText(text: string): string | undefined {
  const lower = text.toLowerCase();
  // Try multi-word colors first: "light blue", "dark red", etc.
  const multiWordPattern = /\b(dark|light|hot|soft|pale|deep|bright)?\s*(pink|red|orange|yellow|green|blue|cyan|teal|purple|violet|indigo|magenta|white|black|gray|grey|brown|cream|beige|coral|mint|lavender|sky|rose|amber|lime|emerald|navy|slate|gold|silver)\b/gi;
  const matches = [...lower.matchAll(multiWordPattern)];
  for (const m of matches) {
    const candidate = (m[1] ? m[1] + ' ' : '') + m[2];
    const resolved = resolveColor(candidate);
    if (resolved) return resolved;
  }
  // Try single-word colors
  for (const [name, hex] of Object.entries(COLOR_MAP)) {
    if (new RegExp(`\b${name}\b`, 'i').test(lower)) return hex;
  }
  return undefined;
}

// ── Theme name matching ──────────────────────────────────────────────────────

function findTheme(query: string): ThemeId | undefined {
  const lower = query.toLowerCase();
  const byId = THEME_LIST.find((t) => t.id === lower);
  if (byId) return byId.id;
  const byName = THEME_LIST.find((t) => t.name.toLowerCase() === lower);
  if (byName) return byName.id;
  const byPartial = THEME_LIST.find((t) => t.name.toLowerCase().includes(lower) || lower.includes(t.name.toLowerCase()));
  if (byPartial) return byPartial.id;
  if (/\bdark\b/.test(lower)) return 'dark';
  if (/\bminimal\b/.test(lower)) return 'minimal';
  if (/\bprofessional\b|\bcorporate\b/.test(lower)) return 'corporate';
  if (/\bbusiness\b/.test(lower)) return 'business';
  if (/\bmodern\b/.test(lower)) return 'modern';
  if (/\bclassic\b|\belegant\b/.test(lower)) return 'elegant';
  if (/\bcreative\b|\bplayful\b/.test(lower)) return 'creative';
  if (/\bgradient\b/.test(lower)) return 'gradient';
  if (/\beducation\b|\bacademic\b|\bschool\b/.test(lower)) return 'education';
  return undefined;
}

// ── Layout name matching ──────────────────────────────────────────────────────

const LAYOUT_KEYWORDS: Record<string, SlideLayout> = {
  'two-column': 'two-column', 'two column': 'two-column', 'twocolumn': 'two-column',
  'hero': 'hero',
  'agenda': 'agenda',
  'cards': 'cards', 'card': 'cards', 'grid': 'grid',
  'comparison': 'comparison', 'compare': 'comparison',
  'timeline': 'timeline',
  'process': 'process', 'steps': 'process', 'workflow': 'process',
  'statistics': 'statistics', 'stats': 'statistics',
  'table': 'table',
  'chart': 'chart', 'graph': 'chart',
  'quote': 'quote',
  'section-divider': 'section-divider', 'section divider': 'section-divider',
  'image-left': 'image-left', 'image right': 'image-right', 'image-right': 'image-right',
  'full-image': 'full-image', 'full image': 'full-image',
  'thank-you': 'thank-you', 'thank you': 'thank-you', 'closing': 'thank-you',
  'diagram': 'diagram',
};

function findLayout(query: string): SlideLayout | undefined {
  const lower = query.toLowerCase().trim();
  if (LAYOUT_KEYWORDS[lower]) return LAYOUT_KEYWORDS[lower];
  for (const key of Object.keys(LAYOUT_KEYWORDS)) {
    if (lower.includes(key)) return LAYOUT_KEYWORDS[key];
  }
  return undefined;
}

type VisualLayout = 'table' | 'cards' | 'process' | 'timeline' | 'statistics' | 'comparison' | 'quote' | 'two-column';

const VISUAL_LAYOUT_KEYWORDS: Record<string, VisualLayout> = {
  'table': 'table', 'tables': 'table',
  'card': 'cards', 'cards': 'cards', 'grid': 'cards',
  'timeline': 'timeline',
  'process': 'process', 'steps': 'process', 'step': 'process', 'workflow': 'process',
  'statistics': 'statistics', 'statistic': 'statistics', 'stats': 'statistics', 'stat': 'statistics',
  'comparison': 'comparison', 'compare': 'comparison',
  'quote': 'quote',
  'two-column': 'two-column', 'two column': 'two-column',
  'bullet': 'two-column', 'bullets': 'two-column', 'points': 'two-column', 'list': 'two-column',
};

function findVisualLayout(query: string): VisualLayout | undefined {
  const lower = query.toLowerCase();
  for (const key of Object.keys(VISUAL_LAYOUT_KEYWORDS)) {
    if (lower.includes(key)) return VISUAL_LAYOUT_KEYWORDS[key];
  }
  return undefined;
}

// ── Slide target resolution ────────────────────────────────────────────────────

function resolveSlideIndices(target: SlideTarget, ctx: EditorContext): number[] {
  if (target === 'current') return [ctx.currentSlideIndex];
  if (target === 'all') return ctx.presentation.slides.map((_, i) => i);
  return [target];
}

function parseTarget(value: unknown, _ctx: EditorContext): SlideTarget {
  if (value === 'all' || value === 'current') return value;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const n = parseInt(value, 10);
    if (!isNaN(n)) return n - 1; // AI returns 1-based
  }
  return 'current';
}

// ── Font size helpers ──────────────────────────────────────────────────────────

function adjustFontSize(current: number | undefined, delta: number, min = 10, max = 120): number {
  const base = current ?? 24;
  return Math.max(min, Math.min(max, base + delta));
}

// ── Text helpers ────────────────────────────────────────────────────────────────

function shortenText(text: string): string {
  const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean);
  if (sentences.length <= 1) {
    const words = text.split(/\s+/);
    if (words.length <= 10) return text;
    return words.slice(0, Math.ceil(words.length * 0.6)).join(' ') + '…';
  }
  return sentences.slice(0, Math.max(1, Math.ceil(sentences.length * 0.6))).join(' ');
}

function shortenBullets(bullets: { id: string; text: string }[]): { id: string; text: string }[] {
  return bullets.map((b) => ({ ...b, text: shortenText(b.text) }));
}

// ── Design improvement ────────────────────────────────────────────────────────

function slideTextItems(slide: Slide): string[] {
  const items: string[] = [];
  if (slide.body) items.push(slide.body);
  for (const b of slide.bullets || []) items.push(b.text);
  if (slide.subtitle && items.length === 0) items.push(slide.subtitle);
  return items.map((t) => t.trim()).filter(Boolean);
}

function splitLabelValue(text: string): [string, string] | null {
  const idx = text.indexOf(':');
  if (idx > 0 && idx < 40) {
    return [text.substring(0, idx).trim(), text.substring(idx + 1).trim()];
  }
  const dash = text.indexOf('—');
  if (dash > 0 && dash < 40) {
    return [text.substring(0, dash).trim(), text.substring(dash + 1).trim()];
  }
  return null;
}

/** Rebuild a slide's content into a visual layout (table/cards/process/…).
 * Used by `convert_layout`: turns bullet walls into real presentation
 * structures instead of just relabeling the layout. */
function restructureSlideForLayout(
  slide: Slide,
  layout: 'table' | 'cards' | 'process' | 'timeline' | 'statistics' | 'comparison' | 'quote' | 'two-column',
): Slide {
  const items = slideTextItems(slide);
  const base: Slide = {
    ...slide,
    layout,
    bullets: undefined,
    cards: undefined,
    steps: undefined,
    timeline: undefined,
    stats: undefined,
    comparison: undefined,
    table: undefined,
    quote: undefined,
    chart: undefined,
  };

  switch (layout) {
    case 'table': {
      const rows: string[][] = items.map((t) => {
        const lv = splitLabelValue(t);
        return lv && lv[1] ? lv : [t, ''];
      });
      return { ...base, table: { headers: ['Item', 'Details'], rows } };
    }
    case 'cards': {
      const cards = items.slice(0, 6).map((t, i) => {
        const lv = splitLabelValue(t);
        return {
          id: uid('cd'),
          title: (lv ? lv[0] : t.substring(0, 30)) || `Point ${i + 1}`,
          description: lv && lv[1] ? lv[1] : t,
        };
      });
      return { ...base, cards };
    }
    case 'process': {
      const steps = items.slice(0, 6).map((t, i) => {
        const clean = t.replace(/^\d+[.):]\s+/, '').trim();
        const lv = splitLabelValue(clean);
        return {
          id: uid('ps'),
          step: i + 1,
          title: (lv ? lv[0] : clean.substring(0, 40)) || `Step ${i + 1}`,
          description: lv && lv[1] ? lv[1] : clean,
        };
      });
      return { ...base, steps };
    }
    case 'timeline': {
      const timeline = items.slice(0, 6).map((t, i) => {
        const m = t.match(/^(\d{4}s?|Q[1-4]|Phase\s*\d+|[A-Za-z]+\s*\d{4})\s*[:\-–]\s*(.*)$/);
        const year = m ? m[1] : `Phase ${i + 1}`;
        const rest = (m ? m[2] : t).trim();
        const ci = rest.indexOf(':');
        return {
          id: uid('tl'),
          year,
          title: (ci > 0 && ci < 40 ? rest.substring(0, ci).trim() : rest.substring(0, 50)) || rest.substring(0, 50),
          description: ci > 0 && ci < 40 ? rest.substring(ci + 1).trim() : rest,
        };
      });
      return { ...base, timeline };
    }
    case 'statistics': {
      const stats = items.slice(0, 4).map((t, i) => {
        const m = t.match(/([\d,.]+\s*(?:%|percent|x|X|\+|M|K|B|\$|₹|€|£)?)/);
        const value = m ? m[1].trim() : `${i + 1}`;
        const label = (m ? t.replace(m[0], '').trim().replace(/^[:\-–\s]+/, '') : t).substring(0, 40) || `Metric ${i + 1}`;
        return { id: uid('st'), value, label };
      });
      return { ...base, stats };
    }
    case 'comparison': {
      const mid = Math.max(1, Math.ceil(items.length / 2));
      const left = items.slice(0, mid);
      const right = items.slice(mid);
      const rows = left.map((l, i) => ({
        id: uid('cr'),
        feature: `Point ${i + 1}`,
        optionA: l,
        optionB: right[i] || '',
      }));
      return {
        ...base,
        comparison: { leftTitle: 'Option A', rightTitle: 'Option B', rows },
      };
    }
    case 'quote': {
      const text = items[0] || slide.title;
      return { ...base, quote: { text, author: items[1] || slide.subtitle || '' } };
    }
    case 'two-column':
    default: {
      return {
        ...base,
        bullets: items.map((t) => ({ id: uid('bl'), text: t })),
      };
    }
  }
}

function improveSlideDesign(slide: Slide, _settings: PresentationSettings): Slide {
  const improved = { ...slide };
  if (!improved.title || improved.title.trim().length === 0) {
    improved.title = 'Untitled Slide';
  }
  if (improved.bullets && improved.bullets.length > 5) {
    improved.bullets = improved.bullets.slice(0, 5);
  }
  if (improved.body && improved.body.length > 200) {
    improved.body = shortenText(improved.body);
  }
  if (improved.bullets) {
    improved.bullets = improved.bullets.map((b) => ({
      ...b,
      text: b.text.length > 100 ? shortenText(b.text) : b.text,
    }));
  }
  return improved;
}

// ── Action execution ──────────────────────────────────────────────────────────

function executeAction(
  action: EditAction,
  presentation: Presentation,
  ctx: EditorContext,
): { presentation: Presentation; success: boolean; error?: string } {
  switch (action.type) {
    case 'change_background': {
      const indices = resolveSlideIndices(action.target, ctx);
      const slides = [...presentation.slides];
      let bg: SlideBackground;
      if (action.gradientFrom && action.gradientTo) {
        bg = { type: 'gradient', from: action.gradientFrom, to: action.gradientTo, angle: 135 };
      } else if (action.color) {
        bg = { type: 'solid', color: action.color };
      } else {
        return { presentation, success: false, error: 'No background color specified' };
      }
      for (const i of indices) {
        if (slides[i]) slides[i] = { ...slides[i], background: bg };
      }
      return { presentation: { ...presentation, slides }, success: true };
    }

    case 'change_text': {
      const indices = resolveSlideIndices(action.target, ctx);
      const slides = [...presentation.slides];
      for (const i of indices) {
        if (slides[i]) slides[i] = { ...slides[i], [action.field]: action.value };
      }
      return { presentation: { ...presentation, slides }, success: true };
    }

    case 'change_text_color': {
      const indices = resolveSlideIndices(action.target, ctx);
      const slides = [...presentation.slides];
      for (const i of indices) {
        if (!slides[i]) continue;
        // Update overlay text elements.
        const elements = (slides[i].elements || []).map((el) => {
          if (el.kind === 'text') return { ...el, color: action.color } as SlideElement;
          return el;
        });
        // Update AI template field styles for the matching field.
        const fieldStyles = { ...(slides[i].fieldStyles || {}) };
        const keys = fieldWordToKeys(action.field, slides[i]);
        for (const k of keys) fieldStyles[k] = { ...fieldStyles[k], color: action.color };
        slides[i] = { ...slides[i], elements, fieldStyles };
      }
      return { presentation: { ...presentation, slides }, success: true };
    }

    case 'change_font_size': {
      const indices = resolveSlideIndices(action.target, ctx);
      const slides = [...presentation.slides];
      for (const i of indices) {
        if (!slides[i]) continue;
        // Update overlay text elements.
        const elements = (slides[i].elements || []).map((el) => {
          if (el.kind === 'text') {
            const textEl = el as TextBoxElement;
            return { ...textEl, fontSize: adjustFontSize(textEl.fontSize, action.delta) } as SlideElement;
          }
          return el;
        });
        // Update AI template field styles.
        const fieldStyles = { ...(slides[i].fieldStyles || {}) };
        const keys = fieldWordToKeys(action.field, slides[i]);
        for (const k of keys) {
          const cur = fieldStyles[k]?.fontSize;
          fieldStyles[k] = { ...fieldStyles[k], fontSize: adjustFontSize(cur, action.delta) };
        }
        slides[i] = { ...slides[i], elements, fieldStyles };
      }
      return { presentation: { ...presentation, slides }, success: true };
    }

    case 'change_font_family': {
      const indices = resolveSlideIndices(action.target, ctx);
      const slides = [...presentation.slides];
      for (const i of indices) {
        if (!slides[i]) continue;
        // Update overlay text elements.
        const elements = (slides[i].elements || []).map((el) => {
          if (el.kind === 'text') {
            return { ...el, fontFamily: action.fontFamily as FontFamily } as SlideElement;
          }
          return el;
        });
        // Update all AI template field styles.
        const fieldStyles = { ...(slides[i].fieldStyles || {}) };
        for (const k of collectFieldKeys(slides[i])) {
          fieldStyles[k] = { ...fieldStyles[k], fontFamily: action.fontFamily as FontFamily };
        }
        slides[i] = { ...slides[i], elements, fieldStyles };
      }
      if (action.target === 'all') {
        return {
          presentation: {
            ...presentation, slides,
            settings: { ...presentation.settings, fontFamily: action.fontFamily as FontFamily },
          },
          success: true,
        };
      }
      return { presentation: { ...presentation, slides }, success: true };
    }

    case 'toggle_bold': {
      const indices = resolveSlideIndices(action.target, ctx);
      const slides = [...presentation.slides];
      for (const i of indices) {
        if (!slides[i]) continue;
        // Update overlay text elements.
        const elements = (slides[i].elements || []).map((el) => {
          if (el.kind === 'text') return { ...el, bold: !el.bold } as SlideElement;
          return el;
        });
        // Update AI template field styles.
        const fieldStyles = { ...(slides[i].fieldStyles || {}) };
        const keys = fieldWordToKeys(action.field, slides[i]);
        for (const k of keys) {
          fieldStyles[k] = { ...fieldStyles[k], bold: !fieldStyles[k]?.bold };
        }
        slides[i] = { ...slides[i], elements, fieldStyles };
      }
      return { presentation: { ...presentation, slides }, success: true };
    }

    case 'toggle_italic': {
      const indices = resolveSlideIndices(action.target, ctx);
      const slides = [...presentation.slides];
      for (const i of indices) {
        if (!slides[i]) continue;
        // Update overlay text elements.
        const elements = (slides[i].elements || []).map((el) => {
          if (el.kind === 'text') return { ...el, italic: !el.italic } as SlideElement;
          return el;
        });
        // Update AI template field styles.
        const fieldStyles = { ...(slides[i].fieldStyles || {}) };
        const keys = fieldWordToKeys(action.field, slides[i]);
        for (const k of keys) {
          fieldStyles[k] = { ...fieldStyles[k], italic: !fieldStyles[k]?.italic };
        }
        slides[i] = { ...slides[i], elements, fieldStyles };
      }
      return { presentation: { ...presentation, slides }, success: true };
    }

    case 'change_alignment': {
      const indices = resolveSlideIndices(action.target, ctx);
      const slides = [...presentation.slides];
      for (const i of indices) {
        if (!slides[i]) continue;
        // Update overlay text elements.
        const elements = (slides[i].elements || []).map((el) => {
          if (el.kind === 'text') return { ...el, align: action.align } as SlideElement;
          return el;
        });
        // Update all AI template field styles.
        const fieldStyles = { ...(slides[i].fieldStyles || {}) };
        for (const k of collectFieldKeys(slides[i])) {
          fieldStyles[k] = { ...fieldStyles[k], align: action.align };
        }
        slides[i] = { ...slides[i], elements, fieldStyles };
      }
      return { presentation: { ...presentation, slides }, success: true };
    }

    case 'change_layout': {
      const indices = resolveSlideIndices(action.target, ctx);
      const slides = [...presentation.slides];
      for (const i of indices) {
        if (slides[i]) slides[i] = { ...slides[i], layout: action.layout };
      }
      return { presentation: { ...presentation, slides }, success: true };
    }

    case 'convert_layout': {
      const indices = resolveSlideIndices(action.target, ctx);
      const slides = [...presentation.slides];
      let converted = 0;
      for (const i of indices) {
        if (!slides[i]) continue;
        if (slideTextItems(slides[i]).length === 0) continue;
        slides[i] = restructureSlideForLayout(slides[i], action.layout);
        converted++;
      }
      if (converted === 0) {
        return { presentation, success: false, error: 'No text content to convert on the target slide(s)' };
      }
      return { presentation: { ...presentation, slides }, success: true };
    }

    case 'add_slide': {
      const newSlide: Slide = {
        id: uid('sl'),
        layout: 'two-column',
        title: 'New Slide',
        subtitle: 'Click to edit',
        bullets: [
          { id: uid('bl'), text: 'First point' },
          { id: uid('bl'), text: 'Second point' },
        ],
        body: 'Add your content here.',
        notes: 'Speaker notes for this slide.',
      };
      const slides = [...presentation.slides];
      const insertAt = action.afterIndex !== undefined ? action.afterIndex + 1 : ctx.currentSlideIndex + 1;
      slides.splice(insertAt, 0, newSlide);
      return { presentation: { ...presentation, slides }, success: true };
    }

    case 'delete_slide': {
      if (presentation.slides.length <= 1) {
        return { presentation, success: false, error: 'Cannot delete the only slide' };
      }
      if (action.index < 0 || action.index >= presentation.slides.length) {
        return { presentation, success: false, error: 'Invalid slide number' };
      }
      const slides = presentation.slides.filter((_, i) => i !== action.index);
      return { presentation: { ...presentation, slides }, success: true };
    }

    case 'duplicate_slide': {
      if (action.index < 0 || action.index >= presentation.slides.length) {
        return { presentation, success: false, error: 'Invalid slide number' };
      }
      const original = presentation.slides[action.index];
      const copy: Slide = {
        ...JSON.parse(JSON.stringify(original)),
        id: uid('sl'),
        title: original.title + ' (Copy)',
      };
      copy.bullets = (copy.bullets || []).map((b) => ({ ...b, id: uid('bl') }));
      copy.cards = (copy.cards || []).map((c) => ({ ...c, id: uid('cd') }));
      copy.stats = (copy.stats || []).map((s) => ({ ...s, id: uid('st') }));
      copy.timeline = (copy.timeline || []).map((t) => ({ ...t, id: uid('tl') }));
      copy.steps = (copy.steps || []).map((s) => ({ ...s, id: uid('ps') }));
      copy.elements = (copy.elements || []).map((e) => ({ ...e, id: uid('el') }));
      const slides = [...presentation.slides];
      slides.splice(action.index + 1, 0, copy);
      return { presentation: { ...presentation, slides }, success: true };
    }

    case 'reorder_slide': {
      const { fromIndex, toIndex } = action;
      if (fromIndex < 0 || fromIndex >= presentation.slides.length ||
          toIndex < 0 || toIndex >= presentation.slides.length) {
        return { presentation, success: false, error: 'Invalid slide number' };
      }
      const slides = [...presentation.slides];
      const [moved] = slides.splice(fromIndex, 1);
      slides.splice(toIndex, 0, moved);
      return { presentation: { ...presentation, slides }, success: true };
    }

    case 'apply_theme': {
      const theme = THEMES[action.themeId];
      if (!theme) return { presentation, success: false, error: 'Unknown theme' };
      return {
        presentation: {
          ...presentation,
          settings: {
            ...presentation.settings,
            theme: action.themeId,
            primaryColor: theme.primary,
            secondaryColor: theme.secondary,
            fontFamily: theme.bodyFont,
          },
        },
        success: true,
      };
    }

    case 'change_settings': {
      return {
        presentation: {
          ...presentation,
          settings: { ...presentation.settings, ...action.patch },
        },
        success: true,
      };
    }

    case 'add_image': {
      const indices = resolveSlideIndices(action.target, ctx);
      const slides = [...presentation.slides];
      const imgEl: ImageElement = {
        id: uid('el'),
        kind: 'image',
        x: 0.55, y: 0.15, w: 0.35, h: 0.5,
        url: `https://images.pexels.com/photos/1181271/pexels-photo-1181271.jpeg?auto=compress&cs=tinysrgb&w=600`,
        alt: action.query,
        objectFit: 'cover',
        borderRadius: 12,
      };
      for (const i of indices) {
        if (slides[i]) {
          const elements = [...(slides[i].elements || []), imgEl];
          slides[i] = { ...slides[i], elements };
        }
      }
      return { presentation: { ...presentation, slides }, success: true };
    }

    case 'remove_image': {
      const indices = resolveSlideIndices(action.target, ctx);
      const slides = [...presentation.slides];
      for (const i of indices) {
        if (!slides[i]) continue;
        const elements = (slides[i].elements || []).filter((e) => e.kind !== 'image');
        slides[i] = { ...slides[i], elements, image: undefined };
      }
      return { presentation: { ...presentation, slides }, success: true };
    }

    case 'replace_image': {
      const indices = resolveSlideIndices(action.target, ctx);
      const slides = [...presentation.slides];
      const newUrl = `https://images.pexels.com/photos/1181271/pexels-photo-1181271.jpeg?auto=compress&cs=tinysrgb&w=600`;
      for (const i of indices) {
        if (!slides[i]) continue;
        // Replace image element URLs and slide.image
        const elements = (slides[i].elements || []).map((el) => {
          if (el.kind === 'image') return { ...el, url: newUrl, alt: action.query } as SlideElement;
          return el;
        });
        const image = slides[i].image ? { ...slides[i].image, url: newUrl, alt: action.query } : undefined;
        slides[i] = { ...slides[i], elements, image };
      }
      return { presentation: { ...presentation, slides }, success: true };
    }

    case 'change_image_position': {
      const indices = resolveSlideIndices(action.target, ctx);
      const slides = [...presentation.slides];
      for (const i of indices) {
        if (!slides[i]) continue;
        const elements = (slides[i].elements || []).map((el) => {
          if (el.kind === 'image') {
            return {
              ...el,
              x: action.x !== undefined ? action.x : el.x,
              y: action.y !== undefined ? action.y : el.y,
            } as SlideElement;
          }
          return el;
        });
        slides[i] = { ...slides[i], elements };
      }
      return { presentation: { ...presentation, slides }, success: true };
    }

    case 'change_image_size': {
      const indices = resolveSlideIndices(action.target, ctx);
      const slides = [...presentation.slides];
      for (const i of indices) {
        if (!slides[i]) continue;
        const elements = (slides[i].elements || []).map((el) => {
          if (el.kind === 'image') {
            return {
              ...el,
              w: action.w !== undefined ? action.w : el.w,
              h: action.h !== undefined ? action.h : el.h,
            } as SlideElement;
          }
          return el;
        });
        slides[i] = { ...slides[i], elements };
      }
      return { presentation: { ...presentation, slides }, success: true };
    }

    case 'shorten_text': {
      const indices = resolveSlideIndices(action.target, ctx);
      const slides = [...presentation.slides];
      for (const i of indices) {
        if (!slides[i]) continue;
        if (action.field === 'body' && slides[i].body) {
          slides[i] = { ...slides[i], body: shortenText(slides[i].body!) };
        } else if (action.field === 'bullets' && slides[i].bullets) {
          slides[i] = { ...slides[i], bullets: shortenBullets(slides[i].bullets!) };
        }
      }
      return { presentation: { ...presentation, slides }, success: true };
    }

    case 'rewrite_text': {
      const indices = resolveSlideIndices(action.target, ctx);
      const slides = [...presentation.slides];
      for (const i of indices) {
        if (slides[i]) slides[i] = { ...slides[i], [action.field]: action.value };
      }
      return { presentation: { ...presentation, slides }, success: true };
    }

    case 'add_bullet': {
      const indices = resolveSlideIndices(action.target, ctx);
      const slides = [...presentation.slides];
      for (const i of indices) {
        if (!slides[i]) continue;
        const bullets = [...(slides[i].bullets || [])];
        const newBullet = { id: uid('bl'), text: action.text };
        if (action.position !== undefined && action.position >= 0 && action.position <= bullets.length) {
          bullets.splice(action.position, 0, newBullet);
        } else {
          bullets.push(newBullet);
        }
        slides[i] = { ...slides[i], bullets };
      }
      return { presentation: { ...presentation, slides }, success: true };
    }

    case 'remove_bullet': {
      const indices = resolveSlideIndices(action.target, ctx);
      const slides = [...presentation.slides];
      for (const i of indices) {
        if (!slides[i]) continue;
        const existing = slides[i].bullets || [];
        let idx = action.index;
        if (idx >= existing.length) idx = existing.length - 1;
        if (idx < 0 || idx >= existing.length) {
          return { presentation, success: false, error: 'No bullet found at that position' };
        }
        const bullets = existing.filter((_, bi) => bi !== idx);
        slides[i] = { ...slides[i], bullets };
      }
      return { presentation: { ...presentation, slides }, success: true };
    }

    case 'change_bullet': {
      const indices = resolveSlideIndices(action.target, ctx);
      const slides = [...presentation.slides];
      for (const i of indices) {
        if (!slides[i]) continue;
        const bullets = [...(slides[i].bullets || [])];
        if (action.index >= 0 && action.index < bullets.length) {
          bullets[action.index] = { ...bullets[action.index], text: action.text };
        }
        slides[i] = { ...slides[i], bullets };
      }
      return { presentation: { ...presentation, slides }, success: true };
    }

    case 'improve_design': {
      const indices = resolveSlideIndices(action.target, ctx);
      const slides = [...presentation.slides];
      for (const i of indices) {
        if (slides[i]) slides[i] = improveSlideDesign(slides[i], presentation.settings);
      }
      return { presentation: { ...presentation, slides }, success: true };
    }

    case 'copy_style': {
      const from = presentation.slides[action.fromIndex];
      if (!from) return { presentation, success: false, error: 'Source slide not found' };
      const slides = [...presentation.slides];
      const targets = action.toIndex === 'all'
        ? slides.map((_, i) => i).filter((i) => i !== action.fromIndex)
        : [action.toIndex];
      for (const i of targets) {
        if (slides[i] && i !== action.fromIndex) {
          slides[i] = {
            ...slides[i],
            layout: from.layout,
            background: from.background ? { ...from.background } : undefined,
            accentIcon: from.accentIcon,
          };
        }
      }
      return { presentation: { ...presentation, slides }, success: true };
    }

    case 'change_slide_title': {
      const slides = [...presentation.slides];
      if (action.target >= 0 && action.target < slides.length) {
        slides[action.target] = { ...slides[action.target], title: action.title };
      }
      return { presentation: { ...presentation, slides }, success: true };
    }

    case 'update_field_style': {
      const indices = resolveSlideIndices(action.target, ctx);
      const slides = [...presentation.slides];
      for (const i of indices) {
        if (!slides[i]) continue;
        const fieldStyles = { ...(slides[i].fieldStyles || {}) };
        fieldStyles[action.fieldKey] = { ...fieldStyles[action.fieldKey], ...action.patch };
        if (action.patch.fontSize !== undefined) {
          fieldStyles[action.fieldKey].fontSize = Math.max(8, Math.min(120, action.patch.fontSize));
        }
        slides[i] = { ...slides[i], fieldStyles };
      }
      return { presentation: { ...presentation, slides }, success: true };
    }

    case 'remove_exact_text': {
      const indices = resolveSlideIndices(action.target, ctx);
      const slides = [...presentation.slides];
      let changed = false;
      for (const i of indices) {
        if (!slides[i]) continue;
        const slide = slides[i];
        const exactText: string = (action as any).exactText;
        const exactLower = exactText.toLowerCase();
        const exactTrimmed = exactText.trim();

        // Helper: try to find and remove the exact text from a string field.
        // Returns the new string or undefined if not found.
        function tryRemoveFromText(text: string): string | undefined {
          // Exact match
          const idx = text.indexOf(exactText);
          if (idx !== -1) {
            let result = text.slice(0, idx) + text.slice(idx + exactText.length);
            // Clean up double spaces left behind
            result = result.replace(/\s{2,}/g, ' ').trim();
            return result;
          }
          // Case-insensitive match
          const lower = text.toLowerCase();
          const ciIdx = lower.indexOf(exactLower);
          if (ciIdx !== -1) {
            let result = text.slice(0, ciIdx) + text.slice(ciIdx + exactText.length);
            result = result.replace(/\s{2,}/g, ' ').trim();
            return result;
          }
          // Trimmed + collapsed-whitespace match
          const collapsed = text.replace(/\s+/g, ' ').trim();
          const collapsedLower = collapsed.toLowerCase();
          const trimLower = exactTrimmed.toLowerCase();
          const cIdx = collapsedLower.indexOf(trimLower);
          if (cIdx !== -1) {
            let result = collapsed.slice(0, cIdx) + collapsed.slice(cIdx + exactTrimmed.length);
            result = result.replace(/\s{2,}/g, ' ').trim();
            return result;
          }
          return undefined;
        }

        let slideChanged = false;
        const updated: Slide = { ...slide };

        // Check template fields: title, subtitle, body
        if (slide.title) {
          const newVal = tryRemoveFromText(slide.title);
          if (newVal !== undefined) { updated.title = newVal; slideChanged = true; }
        }
        if (slide.subtitle && !slideChanged) {
          const newVal = tryRemoveFromText(slide.subtitle);
          if (newVal !== undefined) { updated.subtitle = newVal; slideChanged = true; }
        }
        if (slide.body && !slideChanged) {
          const newVal = tryRemoveFromText(slide.body);
          if (newVal !== undefined) { updated.body = newVal; slideChanged = true; }
        }
        // Check bullets
        if (slide.bullets && !slideChanged) {
          for (let bi = 0; bi < slide.bullets.length; bi++) {
            const newVal = tryRemoveFromText(slide.bullets[bi].text);
            if (newVal !== undefined) {
              const newBullets = [...slide.bullets];
              if (newVal.length === 0) {
                newBullets.splice(bi, 1);
              } else {
                newBullets[bi] = { ...newBullets[bi], text: newVal };
              }
              updated.bullets = newBullets;
              slideChanged = true;
              break;
            }
          }
        }
        // Check overlay text elements
        if (!slideChanged && slide.elements) {
          for (const el of slide.elements) {
            if (el.kind === 'text') {
              const textEl = el as TextBoxElement;
              const newVal = tryRemoveFromText(textEl.text);
              if (newVal !== undefined) {
                const newElements = slide.elements.map((e) => {
                  if (e.id === textEl.id && e.kind === 'text') {
                    if (newVal.length === 0) return null;
                    return { ...e, text: newVal } as SlideElement;
                  }
                  return e;
                }).filter(Boolean) as SlideElement[];
                updated.elements = newElements;
                slideChanged = true;
                break;
              }
            }
          }
        }

        if (slideChanged) {
          slides[i] = updated;
          changed = true;
        }
      }
      if (!changed) return { presentation, success: false, error: `I couldn't find the exact text "${action.exactText}" on this slide.` };
      return { presentation: { ...presentation, slides }, success: true };
    }

    case 'replace_exact_text': {
      const indices = resolveSlideIndices(action.target, ctx);
      const slides = [...presentation.slides];
      let changed = false;
      for (const i of indices) {
        if (!slides[i]) continue;
        const slide = slides[i];
        const findText: string = (action as any).findText;
        const replaceText: string = (action as any).replaceText;
        const findLower = findText.toLowerCase();
        const findTrimmed = findText.trim();

        function tryReplaceInText(text: string): string | undefined {
          const idx = text.indexOf(findText);
          if (idx !== -1) {
            return text.slice(0, idx) + replaceText + text.slice(idx + findText.length);
          }
          const lower = text.toLowerCase();
          const ciIdx = lower.indexOf(findLower);
          if (ciIdx !== -1) {
            return text.slice(0, ciIdx) + replaceText + text.slice(ciIdx + findText.length);
          }
          const collapsed = text.replace(/\s+/g, ' ').trim();
          const collapsedLower = collapsed.toLowerCase();
          const trimLower = findTrimmed.toLowerCase();
          const cIdx = collapsedLower.indexOf(trimLower);
          if (cIdx !== -1) {
            return collapsed.slice(0, cIdx) + replaceText + collapsed.slice(cIdx + findTrimmed.length);
          }
          return undefined;
        }

        let slideChanged = false;
        const updated: Slide = { ...slide };

        if (slide.title) {
          const newVal = tryReplaceInText(slide.title);
          if (newVal !== undefined) { updated.title = newVal; slideChanged = true; }
        }
        if (slide.subtitle && !slideChanged) {
          const newVal = tryReplaceInText(slide.subtitle);
          if (newVal !== undefined) { updated.subtitle = newVal; slideChanged = true; }
        }
        if (slide.body && !slideChanged) {
          const newVal = tryReplaceInText(slide.body);
          if (newVal !== undefined) { updated.body = newVal; slideChanged = true; }
        }
        if (slide.bullets && !slideChanged) {
          for (let bi = 0; bi < slide.bullets.length; bi++) {
            const newVal = tryReplaceInText(slide.bullets[bi].text);
            if (newVal !== undefined) {
              const newBullets = [...slide.bullets];
              newBullets[bi] = { ...newBullets[bi], text: newVal };
              updated.bullets = newBullets;
              slideChanged = true;
              break;
            }
          }
        }
        if (!slideChanged && slide.elements) {
          for (const el of slide.elements) {
            if (el.kind === 'text') {
              const textEl = el as TextBoxElement;
              const newVal = tryReplaceInText(textEl.text);
              if (newVal !== undefined) {
                const newElements = slide.elements.map((e) => {
                  if (e.id === textEl.id && e.kind === 'text') {
                    return { ...e, text: newVal } as SlideElement;
                  }
                  return e;
                });
                updated.elements = newElements;
                slideChanged = true;
                break;
              }
            }
          }
        }

        if (slideChanged) {
          slides[i] = updated;
          changed = true;
        }
      }
      if (!changed) return { presentation, success: false, error: `I couldn't find the exact text "${action.findText}" on this slide.` };
      return { presentation: { ...presentation, slides }, success: true };
    }

    case 'delete_element': {
      const indices = resolveSlideIndices(action.target, ctx);
      const slides = [...presentation.slides];
      let deleted = false;
      for (const i of indices) {
        if (!slides[i]) continue;
        const elements = slides[i].elements || [];
        // Priority 1: explicit elementId
        if (action.elementId) {
          const filtered = elements.filter((e) => e.id !== action.elementId);
          if (filtered.length !== elements.length) {
            slides[i] = { ...slides[i], elements: filtered };
            deleted = true;
          }
          continue;
        }
        // Priority 2: selected element
        if (ctx.selectedElementId) {
          const filtered = elements.filter((e) => e.id !== ctx.selectedElementId);
          if (filtered.length !== elements.length) {
            slides[i] = { ...slides[i], elements: filtered };
            deleted = true;
          }
          continue;
        }
        // Priority 3: match by text content
        if (action.matchText) {
          const matchLower = action.matchText.toLowerCase();
          const filtered = elements.filter((e) => {
            if (e.kind === 'text') {
              return !((e as TextBoxElement).text.toLowerCase().includes(matchLower));
            }
            return true;
          });
          if (filtered.length !== elements.length) {
            slides[i] = { ...slides[i], elements: filtered };
            deleted = true;
          }
          continue;
        }
      }
      if (!deleted) return { presentation, success: false, error: 'No matching element found to delete' };
      return { presentation: { ...presentation, slides }, success: true };
    }

    case 'update_selected_element': {
      if (!ctx.selectedElementId) {
        return { presentation, success: false, error: 'No element selected' };
      }
      const slides = [...presentation.slides];
      const i = ctx.currentSlideIndex;
      if (!slides[i]) return { presentation, success: false, error: 'Invalid slide' };
      const elements = (slides[i].elements || []).map((el) => {
        if (el.id === ctx.selectedElementId && el.kind === 'text') {
          return { ...el, ...action.patch } as SlideElement;
        }
        return el;
      });
      slides[i] = { ...slides[i], elements };
      return { presentation: { ...presentation, slides }, success: true };
    }

    case 'update_all_text_style': {
      const indices = resolveSlideIndices(action.target, ctx);
      const slides = [...presentation.slides];
      for (const i of indices) {
        if (!slides[i]) continue;
        const elements = (slides[i].elements || []).map((el) => {
          if (el.kind === 'text') return { ...el, ...action.patch } as SlideElement;
          return el;
        });
        const fieldStyles = { ...(slides[i].fieldStyles || {}) };
        for (const k of collectFieldKeys(slides[i])) {
          if (action.headingOnly && !isHeadingField(k)) continue;
          fieldStyles[k] = { ...fieldStyles[k], ...action.patch };
        }
        slides[i] = { ...slides[i], elements, fieldStyles };
      }
      return { presentation: { ...presentation, slides }, success: true };
    }

    default:
      return { presentation, success: false, error: 'Unsupported action' };
  }
}

// ── Local regex-based NLU (fallback) ───────────────────────────────────────────

function extractSlideNumber(text: string): number | null {
  const m = text.match(/\bslide\s*(?:number\s*)?(\d+)\b/i);
  if (m) return parseInt(m[1], 10) - 1;
  return null;
}

function isAllSlides(text: string): boolean {
  return /\b(all\s+slides?|every\s+slide|each\s+slide|entire\s+presentation|whole\s+presentation|all\s+of\s+(?:them|the\s+slides)|all\s+the\s+slides?|all\s+backgrounds?)\b/i.test(text);
}

// ── Multilingual intent normalization ────────────────────────────────────────
// Real-world editing: users write in any language. The local regex parser is
// English-based, so first map well-known action words from major languages to
// English canonical tokens. This is intentionally lightweight (keyword-level,
// not translation): language-independent signals (numbers, "slide N", hex
// colors, quoted text) already work in every language; this layer adds the
// verbs/nouns for: Spanish, French, German, Portuguese, Italian, Dutch,
// Hindi (Devanagari + transliterated), Tamil (Tamil script + transliterated),
// Arabic (Arabic script + transliterated).
const MULTILINGUAL_MAP: [RegExp, string][] = [
  // — delete / remove —
  [/\b(eliminar|borrar|quitar|suprimir)\b/gi, 'delete'],
  [/\b(supprimer|effacer|enlever|retirer)\b/gi, 'delete'],
  [/\b(löschen|lösche|entfernen|entferne)\b/gi, 'delete'],
  [/\b(excluir|remover|apagar|deletar)\b/gi, 'delete'],
  [/\b(elimina|rimuovi|cancella)\b/gi, 'delete'],
  [/\b(verwijder|verwijderen)\b/gi, 'delete'],
  [/(हटाओ|मिटाओ|हटाइए|डिलीट)/gu, 'delete'],
  [/\b(hat[aā]o|mita[oā]|delete)\b/gi, 'delete'],
  [/(நீக்கு|அழி)/gu, 'delete'],
  [/\b(neekku|nee?kku|azhi)\b/gi, 'delete'],
  [/(احذف|امسح)/gu, 'delete'],
  [/\b(ehzef|emsah|ihzef)\b/gi, 'delete'],
  // — add / create slide —
  [/\b(agregar|añadir|crear|insertar|nuevo)\b/gi, 'add'],
  [/\b(ajouter|créer|insérer|nouveau|nouvelle)\b/gi, 'add'],
  [/\b(hinzufügen|erstellen|einfügen|neu)\b/gi, 'add'],
  [/\b(adicionar|criar|inserir|novo|nova)\b/gi, 'add'],
  [/\b(aggiungi|crea|inserisci|nuovo|nuova)\b/gi, 'add'],
  [/\b(toevoegen|nieuwe|maken)\b/gi, 'add'],
  [/(जोड़ो|नया|स्लाइड)/gu, 'add slide'],
  [/\b(jodo|naya)\b/gi, 'add'],
  [/(बनाओ|बना)/gu, 'make'],
  [/(செய்|பண்ணு)/gu, 'make'],
  [/(اعمل|سوي|اصنع)/gu, 'make'],
  [/(சேர்|புதிய|உருவாக்கு)/gu, 'add slide'],
  [/\b(ser|pudiya|uruvakku)\b/gi, 'add'],
  [/(أضف|أنشئ|جديد)/gu, 'add slide'],
  [/\b(adif|anshe|jadid)\b/gi, 'add'],
  // — slide noun —
  [/\b(diapositiva|diapositivas)\b/gi, 'slide'],
  [/\b(diapositive|diapositives)\b/gi, 'slide'],
  [/\b(folie|folien)\b/gi, 'slide'],
  [/(स्लाइड)/gu, 'slide'],
  [/(ஸ்லைடு)/gu, 'slide'],
  [/(شريحة)/gu, 'slide'],
  // — background —
  [/\b(fondo)\b/gi, 'background'],
  [/\b(fond|arrière-plan)\b/gi, 'background'],
  [/\b(hintergrund)\b/gi, 'background'],
  [/\b(fundo)\b/gi, 'background'],
  [/\b(sfondo)\b/gi, 'background'],
  [/(पृष्ठभूमि|बैकग्राउंड)/gu, 'background'],
  [/(பின்னணி)/gu, 'background'],
  [/(خلفية)/gu, 'background'],
  // — color —
  [/\b(color|couleur|farbe|cor|colore|kleur)\b/gi, 'color'],
  [/(रंग|कलर)/gu, 'color'],
  [/(நிறம்|கலர்)/gu, 'color'],
  [/(لون)/gu, 'color'],
  // — text / title —
  [/\b(texto|título|titulo)\b/gi, 'text title'],
  [/\b(texte|titre)\b/gi, 'text title'],
  [/\b(text|titel|überschrift)\b/gi, 'text title'],
  [/\b(texto|título)\b/gi, 'text title'],
  [/\b(testo|titolo)\b/gi, 'text title'],
  [/(शीर्षक|पाठ|टाइटल)/gu, 'title'],
  [/(தலைப்பு|உரை)/gu, 'title'],
  [/(عنوان|نص)/gu, 'title'],
  // — bigger / smaller —
  [/\b(más grande|agrandar|más pequeño|achicar|grande|pequeño)\b/gi, 'bigger'],
  [/\b(plus grand|agrandir|plus petit|réduire|grand|petit)\b/gi, 'bigger'],
  [/\b(größer|größer|vergrößern|kleiner|verkleinern|groß|klein)\b/gi, 'bigger'],
  [/\b(maior|menor|aumentar|diminuir|grande|pequeno)\b/gi, 'bigger'],
  [/\b(più grande|ingrandisci|più piccolo|rimpicciolisci)\b/gi, 'bigger'],
  [/(बड़ा|छोटा|बड़ा करो|छोटा करो)/gu, 'bigger'],
  [/(பெரிய|சிறிய|பெரிதாக்கு)/gu, 'bigger'],
  [/(كبير|صغير|كبّر)/gu, 'bigger'],
  // — bold —
  [/\b(negrita)\b/gi, 'bold'],
  [/\b(gras)\b/gi, 'bold'],
  [/\b(fett)\b/gi, 'bold'],
  [/\b(negrito)\b/gi, 'bold'],
  [/\b(grassetto)\b/gi, 'bold'],
  [/(मोटा|बोल्ड)/gu, 'bold'],
  [/(தடித்த)/gu, 'bold'],
  [/(عريض)/gu, 'bold'],
  // — center / align —
  [/\b(centrar|centro|centrado|alinear|izquierda|derecha)\b/gi, 'center'],
  [/\b(centrer|centre|centré|aligner|gauche|droite)\b/gi, 'center'],
  [/\b(zentrieren|mitte|links|rechts|ausrichten)\b/gi, 'center'],
  [/\b(centralizar|centro|esquerda|direita|alinhar)\b/gi, 'center'],
  [/\b(centra|centro|sinistra|destra|allinea)\b/gi, 'center'],
  [/(बीच|मध्य|बाएं|दाएं|केंद्र)/gu, 'center'],
  [/(மையம்|இடது|வலது)/gu, 'center'],
  [/(وسط|يسار|يمين|توسيط)/gu, 'center'],
  // — theme / style —
  [/\b(tema|estilo|diseño|diseno)\b/gi, 'theme'],
  [/\b(thème|style|design)\b/gi, 'theme'],
  [/\b(thema|stil|design)\b/gi, 'theme'],
  [/\b(tema|estilo)\b/gi, 'theme'],
  [/(थीम|शैली|डिज़ाइन)/gu, 'theme'],
  [/(தீம்|ஸ்டைல்)/gu, 'theme'],
  [/(سمة|نمط|تصميم)/gu, 'theme'],
  // — image / picture —
  [/\b(imagen|foto|fotografía|fotografia|ilustración|ilustracion)\b/gi, 'image'],
  [/\b(image|photo|illustration)\b/gi, 'image'],
  [/\b(bild|foto|illustration)\b/gi, 'image'],
  [/\b(imagem|foto|ilustração|ilustracao)\b/gi, 'image'],
  [/\b(immagine|foto|illustrazione)\b/gi, 'image'],
  [/(छवि|तस्वीर|फोटो)/gu, 'image'],
  [/(படம்|புகைப்படம்)/gu, 'image'],
  [/(صورة)/gu, 'image'],
  // — table —
  [/\b(tabla|tablas|tableau|tableaux|tabelle|tabelas|tabella|tabelle|tabel)\b/gi, 'table'],
  [/(तालिका)/gu, 'table'],
  [/(அட்டவணை)/gu, 'table'],
  [/(جدول)/gu, 'table'],
  // — convert / turn into —
  [/\b(convertir|convierte|convierta|cambiar|cambia|transformar|transforma|convertire|converti|cambiare|cambia|trasformare|converter|converte|mudar|muda|transformar|umwandeln|wandel|ändern|ändere|convertern|converteer|verander)\b/gi, 'convert'],
  [/\b(haz|hacer|hace|fais|faire|faites|mach|machen|mache|faz|fazer|faça|fai|fare|fate|maak|maken|banao|bana)\b/gi, 'make'],
  [/(बदलो|रूपांतरित)/gu, 'convert'],
  [/(மாற்று)/gu, 'convert'],
  [/(حول|غيّر)/gu, 'convert'],
  // — visual / redesign —
  [/\b(visuel|visuelle|visuell|visuale|visueel|rediseñar|rediseño|refonte|neugestalten|modernizar|modernizzare)\b/gi, 'visual redesign'],
  [/(दृश्य|पुनर्डिज़ाइन)/gu, 'visual redesign'],
  [/(காட்சி|மறுவடிவமைப்பு)/gu, 'visual redesign'],
  [/(مرئي|أعد التصميم)/gu, 'visual redesign'],
];

function toCanonicalEnglish(message: string): string {
  let out = message;
  for (const [re, replacement] of MULTILINGUAL_MAP) {
    out = out.replace(re, replacement);
  }
  return out;
}

/** Split "do X then do Y" style messages into sequential commands.
 * Splits only on strong separators (;, newlines, then/also/after that) so a
 * plain "and" inside one instruction ("blue and modern") never breaks. */
function splitCommands(message: string): string[] {
  return message
    .split(/\s*(?:;|\n|\band then\b|\bthen\b|\balso\b|\bafter that\b|\bfollowed by\b)\s*/i)
    .map((s) => s.trim())
    .filter((s) => s.length > 1);
}

function parseLocalActions(message: string, ctx: EditorContext): EditAction[] {
  const clauses = splitCommands(message);
  if (clauses.length > 1) {
    const out: EditAction[] = [];
    for (const clause of clauses) {
      out.push(...parseSingleCommand(clause, ctx));
    }
    return out;
  }
  return parseSingleCommand(message, ctx);
}

function parseSingleCommand(message: string, ctx: EditorContext): EditAction[] {
  const actions: EditAction[] = [];
  // First map any-language keywords to English, then normalize misspellings.
  const canonical = toCanonicalEnglish(message);
  const normalized = canonical
    .replace(/\bgrammer\b/gi, 'grammar')
    .replace(/\bcorect\b/gi, 'correct')
    .replace(/\bcolour\b/gi, 'color')
    .replace(/\bbackgroud\b/gi, 'background')
    .replace(/\bbackround\b/gi, 'background')
    .replace(/\bbackgound\b/gi, 'background')
    .replace(/\bheadings\b/gi, 'heading')
    .replace(/\btitles\b/gi, 'title')
    .replace(/\bpoints\b/gi, 'point')
    .replace(/\bbullets\b/gi, 'bullet');
  const lower = normalized.toLowerCase().trim();
  const slide = ctx.presentation.slides[ctx.currentSlideIndex];
  const hasSelection = !!ctx.selectedElementId;

  // ── Helper: resolve target (slide number / all / current) ──
  const target: SlideTarget = isAllSlides(normalized) ? 'all' : (extractSlideNumber(normalized) ?? 'current');
  // Detect "this slide" / "current slide" explicitly
  const isCurrentOnly = /\b(this|current)\s+slide\b/i.test(normalized) && !isAllSlides(normalized);
  const resolvedTarget: SlideTarget = isCurrentOnly ? 'current' : target;

  // ── Helper: detect field word from message ──
  const fieldWordMatch = lower.match(/\b(title|heading|subtitle|subheading|body|paragraph|bullets?|points?|name)\b/);
  const fieldWord = fieldWordMatch?.[1] || '';
  const isAllHeadings = /\b(all\s+heading|every\s+heading|all\s+title)\b/i.test(normalized);

  // ── Helper: map field word to canonical field name ──
  const toField = (w: string): 'title' | 'subtitle' | 'body' | 'bullets' => {
    if (w.startsWith('bullet') || w === 'point' || w === 'points') return 'bullets';
    if (w === 'subtitle' || w === 'subheading') return 'subtitle';
    if (w === 'body' || w === 'paragraph') return 'body';
    return 'title';
  };

  // ── Slide management ──
  // Delete slide: "delete this slide", "delete slide 3", "remove last slide"
  if (/\b(delete|remove)\s+(this\s+)?slide\b/i.test(normalized) || /\b(delete|remove)\s+slide\s*(\d+)/i.test(normalized)) {
    const numMatch = normalized.match(/\bslide\s*(\d+)/i);
    if (numMatch) {
      actions.push({ type: 'delete_slide', index: parseInt(numMatch[1], 10) - 1 });
    } else {
      actions.push({ type: 'delete_slide', index: ctx.currentSlideIndex });
    }
  }
  if (/\b(duplicate|copy)\s+(this\s+)?slide\b/i.test(normalized) || /\b(duplicate|copy)\s+slide\s*(\d+)/i.test(normalized)) {
    const numMatch = normalized.match(/\bslide\s*(\d+)/i);
    if (numMatch) {
      actions.push({ type: 'duplicate_slide', index: parseInt(numMatch[1], 10) - 1 });
    } else {
      actions.push({ type: 'duplicate_slide', index: ctx.currentSlideIndex });
    }
  }
  if (/\b(add|create|insert)\s+(a\s+)?(new\s+)?slide\b/i.test(normalized)) {
    const afterMatch = normalized.match(/\bafter\s+slide\s*(\d+)/i);
    actions.push({ type: 'add_slide', afterIndex: afterMatch ? parseInt(afterMatch[1], 10) - 1 : undefined });
  }
  // Move slide up/down: "move this slide up", "move slide 2 down"
  if (/\b(move|reorder)\s+slide\s*(\d+)\s*(before|after|to)\s+slide\s*(\d+)/i.test(normalized)) {
    const m = normalized.match(/\b(?:move|reorder)\s+slide\s*(\d+)\s*(?:before|after|to)\s*slide\s*(\d+)/i);
    if (m) actions.push({ type: 'reorder_slide', fromIndex: parseInt(m[1], 10) - 1, toIndex: parseInt(m[2], 10) - 1 });
  } else if (/\bmove\s+(this\s+)?slide\s*(up|down)\b/i.test(normalized)) {
    const dir = normalized.match(/\b(up|down)\b/i)?.[1];
    const idx = ctx.currentSlideIndex;
    if (dir === 'up' && idx > 0) actions.push({ type: 'reorder_slide', fromIndex: idx, toIndex: idx - 1 });
    if (dir === 'down' && idx < ctx.presentation.slides.length - 1) actions.push({ type: 'reorder_slide', fromIndex: idx, toIndex: idx + 1 });
  }
  // Change slide title: "change slide 3 title to X"
  if (/\b(change|set|rename)\s+slide\s*(\d+)\s*(title|name|heading)\s*(?:to\s+)?(.+)/i.test(normalized)) {
    const m = normalized.match(/\b(?:change|set|rename)\s+slide\s*(\d+)\s*(?:title|name|heading)\s*(?:to\s+)?(.+)/i);
    if (m) actions.push({ type: 'change_slide_title', target: parseInt(m[1], 10) - 1, title: m[2].trim() });
  }
  // "change slide 2 heading" without a value — ask for the new title.
  if (/\b(change|set|rename)\s+slide\s*(\d+)\s*(title|name|heading)\s*$/i.test(normalized) && actions.length === 0) {
    // No value provided — will fall through to clarification message.
  }
  // "correct grammar" / "fix grammar" — trigger improve_design which cleans up text.
  if (/\b(correct|fix|check)\s+(grammar|spelling|typo|typos)\b/i.test(normalized) || /\bgrammar\b/i.test(normalized) && /\b(fix|correct|check|improve)\b/i.test(normalized)) {
    actions.push({ type: 'improve_design', target: resolvedTarget });
  }
  // Change text content: "change the title to X", "set the subtitle to Y"
  if (/\b(change|set|make|update)\s+(?:(?:the|this|its|current)\s+)?(title|subtitle|body|heading|name)\s*(?:to|:)\s*(.+)/i.test(normalized)) {
    const m = normalized.match(/\b(?:change|set|make|update)\s+(?:(?:the|this|its|current)\s+)?(title|subtitle|body|heading|name)\s*(?:to|:)\s*(.+)/i);
    if (m) {
      const field = (m[1] === 'heading' || m[1] === 'name') ? 'title' : m[1] as 'title' | 'subtitle' | 'body';
      actions.push({ type: 'change_text', target: resolvedTarget, field, value: m[2].trim() });
    }
  }

  // ── Theme ──
  if (/\b(theme|style|look)\b/i.test(normalized) && /\b(change|switch|apply|use|make)\b/i.test(normalized)) {
    const themeId = findTheme(normalized);
    if (themeId) actions.push({ type: 'apply_theme', themeId });
  }

  // ── Background ──
  if (/\b(background|bg|colour|color)\b/i.test(normalized) && /\b(change|make|set|use|switch|apply|turn|give|put)\b/i.test(normalized)) {
    // Only treat as background if "slide" or "background" word is present, not just "text color"
    const isBgContext = /\b(slide|background|bg)\b/i.test(normalized);
    const isTextContext = /\b(text|title|heading|subtitle|body|bullet|font|letter)\b/i.test(normalized);
    if (isBgContext || (!isTextContext && /\b(colour|color)\b/i.test(normalized) && !/\b(text|title|heading|subtitle|body|bullet)\b/i.test(normalized))) {
      const gradientMatch = normalized.match(/\bgradient\s+(?:from\s+)?(\w+)\s+to\s+(\w+)/i);
      if (gradientMatch) {
        const from = resolveColor(gradientMatch[1]);
        const to = resolveColor(gradientMatch[2]);
        if (from && to) actions.push({ type: 'change_background', target: resolvedTarget, gradientFrom: from, gradientTo: to });
      } else {
        const color = findColorInText(normalized);
        if (color) actions.push({ type: 'change_background', target: resolvedTarget, color });
      }
    }
  }

  // ── Text color: "make this text red", "change title color blue" ──
  const colorInMsg = findColorInText(normalized);
  if (colorInMsg && /\b(text|title|heading|subtitle|body|bullet|font|this|it|that)\b/i.test(normalized) && /\b(color|colour|red|blue|green|yellow|orange|purple|pink|white|black|gray|grey|cyan|teal|emerald|navy|brown|coral|sky|rose|amber|lime|gold)\b/i.test(normalized)) {
    // Distinguish from background color
    const isBgExplicit = /\b(background|bg|slide\s+colour|slide\s+color)\b/i.test(normalized);
    if (!isBgExplicit || /\btext\b/i.test(normalized)) {
      const field = toField(fieldWord || 'title');
      if (hasSelection && /\b(this|it|that|selected)\b/i.test(normalized) && !fieldWord) {
        actions.push({ type: 'update_selected_element', patch: { color: colorInMsg } as Partial<TextBoxElement> });
      } else {
        actions.push({ type: 'change_text_color', target: resolvedTarget, field, color: colorInMsg });
      }
    }
  }

  // ── Font size: "make title big", "increase font", "make it bigger", "reduce font size" ──
  const isBigger = /\b(bigger|larger|increase|big\b|more\s+size|enlarge|grow)\b/i.test(normalized);
  const isSmaller = /\b(smaller|reduce|decrease|shrink|less\s+size|tiny|small\b)\b/i.test(normalized);
  if ((isBigger || isSmaller) && /\b(title|text|heading|font|subtitle|body|bullet|it|that|this|point|content)\b/i.test(normalized)) {
    // "a little" / "little" = smaller delta
    const little = /\b(little|bit|slightly|a\s+bit|a\s+little)\b/i.test(normalized);
    const delta = (isBigger ? 1 : -1) * (little ? 2 : 4);
    if (hasSelection && /\b(this|it|that|selected)\b/i.test(normalized) && !fieldWord) {
      // Update the selected overlay element.
      actions.push({ type: 'update_selected_element', patch: { fontSize: adjustFontSize(
        ((slide.elements || []).find((e) => e.id === ctx.selectedElementId && e.kind === 'text') as any)?.fontSize,
        delta,
      ) } as Partial<TextBoxElement> });
    } else if (isAllHeadings) {
      for (const k of collectFieldKeys(slide)) {
        if (!isHeadingField(k)) continue;
        const cur = slide.fieldStyles?.[k]?.fontSize;
        actions.push({ type: 'update_field_style', target: resolvedTarget, fieldKey: k, patch: { fontSize: adjustFontSize(cur, delta) } });
      }
    } else {
      const field = toField(fieldWord || 'title');
      actions.push({ type: 'change_font_size', target: resolvedTarget, field, delta });
    }
  }

  // ── Font family ──
  if (/\bfont\s+(family|style|type)\b/i.test(normalized) || /\bchange\s+(the\s+)?font\b/i.test(normalized) || /\b(use|set)\s+(the\s+)?font\s+to\b/i.test(normalized)) {
    const fontMatch = normalized.match(/\b(?:to|use|family|style|font)\s+(\w+)/i);
    if (fontMatch) actions.push({ type: 'change_font_family', target: resolvedTarget, fontFamily: fontMatch[1].toLowerCase() });
  }

  // ── Bold ──
  if (/\bbold\b/i.test(normalized) && /\b(make|toggle|set|all|heading|title)\b/i.test(normalized)) {
    if (isAllHeadings || /\ball\b/i.test(normalized)) {
      actions.push({ type: 'update_all_text_style', target: resolvedTarget, patch: { bold: true }, headingOnly: true });
    } else if (hasSelection && /\b(this|it|that|selected)\b/i.test(normalized) && !fieldWord) {
      actions.push({ type: 'update_selected_element', patch: { bold: true } as Partial<TextBoxElement> });
    } else {
      const field = toField(fieldWord || 'title');
      actions.push({ type: 'toggle_bold', target: resolvedTarget, field });
    }
  }

  // ── Italic ──
  if (/\bitalic|italics\b/i.test(normalized) && /\b(make|toggle|set|all|heading|title)\b/i.test(normalized)) {
    if (hasSelection && /\b(this|it|that|selected)\b/i.test(normalized) && !fieldWord) {
      actions.push({ type: 'update_selected_element', patch: { italic: true } as Partial<TextBoxElement> });
    } else {
      const field = toField(fieldWord || 'title');
      actions.push({ type: 'toggle_italic', target: resolvedTarget, field });
    }
  }

  // ── Underline ──
  if (/\bunderline\b/i.test(normalized) && /\b(make|toggle|set|add)\b/i.test(normalized)) {
    if (hasSelection && /\b(this|it|that|selected)\b/i.test(normalized) && !fieldWord) {
      actions.push({ type: 'update_selected_element', patch: { underline: true } as Partial<TextBoxElement> });
    }
    // No toggle_underline action type exists, but update_all_text_style covers it.
    if (isAllHeadings || /\ball\b/i.test(normalized)) {
      actions.push({ type: 'update_all_text_style', target: resolvedTarget, patch: { underline: true }, headingOnly: true });
    }
  }

  // ── Alignment ──
  const alignMatch = lower.match(/\b(center|centre|left|right|justify)\b/);
  if (alignMatch && /\b(align|center|centre|move|position|text|title|this|it)\b/i.test(normalized)) {
    const align = alignMatch[1] === 'centre' ? 'center' : alignMatch[1] as 'left' | 'center' | 'right';
    if (hasSelection && /\b(this|it|that|selected)\b/i.test(normalized) && !fieldWord) {
      actions.push({ type: 'update_selected_element', patch: { align } as Partial<TextBoxElement> });
    } else {
      actions.push({ type: 'change_alignment', target: resolvedTarget, align });
    }
  }

  // ── Convert bullets/body into a visual layout (table/cards/process/…) ──
  // "make this a table", "convert to cards", "show as timeline", "turn into steps"
  if (/\b(convert|change|turn|transform|make|show|display|reformat|restructure|switch)\b/i.test(normalized)
      && /\b(tables?|cards?|grids?|timelines?|process|steps?|workflows?|statistics|stats?|comparisons?|quotes?|two-?columns?|bullets?|points?|lists?)\b/i.test(normalized)) {
    const layout = findVisualLayout(normalized);
    if (layout) actions.push({ type: 'convert_layout', target: resolvedTarget, layout });
  }

  // ── Make visual / redesign ──
  // "make it visual", "redesign this slide", "modernize", "less boring"
  if (/\b(visual|visualize|visualise|visuals|redesign|modernize|modernise|revamp|more\s+visual|less\s+boring|eye-?catching|stunning)\b/i.test(normalized)) {
    actions.push({ type: 'improve_design', target: resolvedTarget });
    // Auto-convert bullet walls into cards so the slide actually looks visual
    const idx = typeof resolvedTarget === 'number' ? resolvedTarget : ctx.currentSlideIndex;
    const slide = ctx.presentation.slides[idx];
    const items = slide ? slideTextItems(slide) : [];
    if (slide && items.length >= 3 && slide.layout !== 'cards' && slide.layout !== 'table' && slide.layout !== 'process') {
      actions.push({ type: 'convert_layout', target: resolvedTarget, layout: items.length <= 6 ? 'cards' : 'table' });
    }
  }

  // ── Layout ──
  if (/\blayout\b/i.test(normalized) && /\b(change|use|switch|set|make)\b/i.test(normalized)) {
    const layout = findLayout(normalized);
    if (layout) actions.push({ type: 'change_layout', target: resolvedTarget, layout });
  }

  // ── Shorten / simplify text ──
  if (/\b(shorten|condense|trim|simple|simplify|less\s+word|concise|brief)\b/i.test(normalized) && /\b(text|body|bullet|content|this|it|that|point|paragraph)\b/i.test(normalized)) {
    const field = fieldWord?.startsWith('bullet') ? 'bullets' : 'body';
    actions.push({ type: 'shorten_text', target: resolvedTarget, field });
  }

  // ── Improve design / make professional ──
  if (/\b(professional|improve|better|less\s+crowded|clean\s+up|polish|spac(e|ing)|make\s+it\s+(better|nice|good))\b/i.test(normalized)) {
    actions.push({ type: 'improve_design', target: resolvedTarget });
  }

  // ── Add image ──
  if (/\b(add|insert|include|put)\s+(an?\s+)?(image|illustration|picture|photo)\b/i.test(normalized)) {
    const queryMatch = normalized.match(/\b(?:about|of|related\s+to|on|showing|with)\s+(.+?)(?:\s+(?:on|to|in)\s+slide|$)/i);
    const query = queryMatch ? queryMatch[1].trim() : 'illustration';
    actions.push({ type: 'add_image', target: resolvedTarget, query });
  }

  // ── Remove image ──
  // "remove all images" / "delete all images" / "remove every image" → target all slides
  if (/\b(remove|delete|take\s+out)\s+(all\s+|every\s+)?(image|illustration|picture|photo)s?\b/i.test(normalized)) {
    const isAllImages = /\b(all\s+|every\s+)(image|illustration|picture|photo)s?\b/i.test(normalized);
    actions.push({ type: 'remove_image', target: isAllImages ? 'all' : resolvedTarget });
  }

  // ── Replace/change image ──
  if (/\b(replace|change|swap|update)\s+(the\s+|this\s+)?(image|illustration|picture|photo)\b/i.test(normalized)) {
    const queryMatch = normalized.match(/\b(?:with|to|about|of|related\s+to)\s+(.+?)(?:\s+(?:on|to|in)\s+slide|$)/i);
    const query = queryMatch ? queryMatch[1].trim() : 'illustration';
    actions.push({ type: 'replace_image', target: resolvedTarget, query });
  }

  // ── Move image ──
  if (/\bmove\s+(the\s+)?(image|illustration|picture|photo)\b/i.test(normalized)) {
    let x: number | undefined;
    let y: number | undefined;
    if (/\bright/i.test(normalized)) x = 0.6;
    if (/\bleft/i.test(normalized)) x = 0.05;
    if (/\btop/i.test(normalized)) y = 0.05;
    if (/\bbottom/i.test(normalized)) y = 0.7;
    if (/\bcenter/i.test(normalized)) { x = 0.3; y = 0.3; }
    actions.push({ type: 'change_image_position', target: resolvedTarget, x, y });
  }

  // ── Resize image ──
  if (/\b(make\s+)?(the\s+)?(image|illustration|picture|photo)\s+(smaller|larger|bigger|big)\b/i.test(normalized)) {
    const smaller = /\bsmaller\b/i.test(normalized);
    actions.push({ type: 'change_image_size', target: resolvedTarget, w: smaller ? 0.25 : 0.45, h: smaller ? 0.35 : 0.6 });
  }

  // ── Add bullet/point ──
  if (/\b(add|include)\s+(a\s+)?(bullet|point|more\s+info|more\s+explanation|more\s+detail)\b/i.test(normalized) || /\badd\s+more\s+(info|explanation|detail|content)\b/i.test(normalized)) {
    const textMatch = normalized.match(/\b(?:saying|with\s+text|that\s+says|text)\s*[:"]\s*(.+)/i);
    const text = textMatch ? textMatch[1].trim() : 'New point';
    actions.push({ type: 'add_bullet', target: resolvedTarget, text });
  }

  // ── Quoted-text commands: remove "X", delete "X", erase "X", replace "X" with "Y", change "X" to "Y" ──
  const quotedStrings = normalized.match(/[""']([^""']+)[""']/g);
  if (quotedStrings) {
    const unquote = (s: string) => s.replace(/^[""']|[""']$/g, '').trim();
    const isRemoveCmd = /\b(remove|delete|erase|take\s+out|get\s+rid\s+of|clear)\b/i.test(normalized);
    const isReplaceCmd = /\b(replace|change|swap)\b/i.test(normalized) && /\b(with|to)\b/i.test(normalized);

    if (isReplaceCmd && quotedStrings.length >= 2) {
      const findText = unquote(quotedStrings[0]);
      const replaceText = unquote(quotedStrings[1]);
      if (findText.length > 0) {
        actions.push({ type: 'replace_exact_text', target: resolvedTarget, findText, replaceText });
      }
    } else if (isRemoveCmd && quotedStrings.length >= 1) {
      const exactText = unquote(quotedStrings[0]);
      if (exactText.length > 0) {
        actions.push({ type: 'remove_exact_text', target: resolvedTarget, exactText });
      }
    }
  }

  // ── Delete/remove heading or title element ──
  // "delete this heading", "remove this title", "delete selected text", "delete the heading X"
  if (/\b(delete|remove|erase|clear|get\s+rid\s+of|take\s+out)\b/i.test(normalized)
      && !/\bslide\b/i.test(normalized)
      && !/\b(image|illustration|picture|photo)\b/i.test(normalized)) {
    // "delete the heading X" — match by text content
    const byNameMatch = normalized.match(/\b(?:heading|title|text|element)\s+(?:called\s+|named\s+)?[""']?(.+?)[""']?\s*$/i);
    if (byNameMatch && byNameMatch[1] && byNameMatch[1].length > 1) {
      actions.push({ type: 'delete_element', target: resolvedTarget, matchText: byNameMatch[1].trim() });
    }
    // "delete this heading", "remove this title", "delete selected text", "remove this text"
    else if (/\b(this|selected|that)\s+(heading|title|text|element|subtitle)\b/i.test(normalized) || /\bdelete\s+(this|that|selected)\s*$/i.test(normalized) || /\bremove\s+(this|that|selected)\s*$/i.test(normalized)) {
      if (hasSelection) {
        actions.push({ type: 'delete_element', target: resolvedTarget, elementId: ctx.selectedElementId! });
      } else {
        actions.push({ type: 'delete_element', target: resolvedTarget });
      }
    }
    // "delete heading", "remove title" (no "this" but mentions heading/title)
    else if (/\b(heading|title)\b/i.test(normalized) && !/\b(add|change|set|make|update|bold|italic|underline|color|colour|bigger|larger|smaller|reduce|decrease|increase|font|size|align)\b/i.test(normalized)) {
      if (hasSelection) {
        actions.push({ type: 'delete_element', target: resolvedTarget, elementId: ctx.selectedElementId! });
      } else {
        actions.push({ type: 'delete_element', target: resolvedTarget });
      }
    }
  }

  // ── Remove bullet: "remove last point", "remove 2nd bullet", "delete this point" ──
  if (/\b(remove|delete)\s+(the\s+)?(last|first|second|third|fourth|fifth|\d+(?:st|nd|rd|th)?)\s*(bullet|point)\b/i.test(normalized) || /\b(remove|delete)\s+(this\s+)?(bullet|point)\b/i.test(normalized) || /\bremove\s+last\s+point\b/i.test(normalized)) {
    const ordMatch = normalized.match(/\b(first|second|third|fourth|fifth|last)\b/i);
    const numMatch = normalized.match(/\b(\d+)(?:st|nd|rd|th)?\s*(?:bullet|point)\b/i);
    let index = 0;
    if (numMatch) index = parseInt(numMatch[1], 10) - 1;
    else if (ordMatch) {
      const ordMap: Record<string, number> = { first: 0, second: 1, third: 2, fourth: 3, fifth: 4, last: 999 };
      index = ordMap[ordMatch[1]];
    }
    actions.push({ type: 'remove_bullet', target: resolvedTarget, index });
  }

  // ── Copy style ──
  if (/\b(make|copy|apply)\s+slide\s*(\d+)\s*(look|style)\s*(like|same)\s*slide\s*(\d+)/i.test(normalized)) {
    const m = normalized.match(/\b(?:make|copy|apply)\s+slide\s*(\d+)\s*(?:look|style)\s*(?:like|same)\s*slide\s*(\d+)/i);
    if (m) actions.push({ type: 'copy_style', fromIndex: parseInt(m[2], 10) - 1, toIndex: parseInt(m[1], 10) - 1 });
  }

  // ── Spacing: "increase spacing", "more spacing", "line spacing" ──
  if (/\b(spacing|line\s+height|letter\s+spacing)\b/i.test(normalized) && /\b(increase|more|bigger|larger|less|reduce|decrease|smaller|change)\b/i.test(normalized)) {
    const increase = /\b(increase|more|bigger|larger|wider|add)\b/i.test(normalized);
    if (/\bline\b/i.test(normalized)) {
      const patch: TextFormat = { lineHeight: increase ? 1.8 : 1.2 };
      actions.push({ type: 'update_all_text_style', target: resolvedTarget, patch });
    } else if (/\bletter\b/i.test(normalized)) {
      const patch: TextFormat = { letterSpacing: increase ? 1 : 0 };
      actions.push({ type: 'update_all_text_style', target: resolvedTarget, patch });
    } else {
      const patch: TextFormat = { lineHeight: increase ? 1.8 : 1.2 };
      actions.push({ type: 'update_all_text_style', target: resolvedTarget, patch });
    }
  }

  return actions;
}

// ── Convert AI-returned raw action objects to typed EditActions ──────────────────

function coerceAiAction(raw: Record<string, unknown>, ctx: EditorContext): EditAction | null {
  const type = raw.type as string;
  if (!type) return null;

  const target = parseTarget(raw.target, ctx);

  switch (type) {
    case 'change_background':
      return {
        type: 'change_background',
        target,
        color: raw.color as string | undefined,
        gradientFrom: raw.gradientFrom as string | undefined,
        gradientTo: raw.gradientTo as string | undefined,
      };
    case 'change_text':
      return { type: 'change_text', target, field: raw.field as 'title' | 'subtitle' | 'body' | 'notes', value: raw.value as string };
    case 'change_text_color':
      return { type: 'change_text_color', target, field: raw.field as 'title' | 'subtitle' | 'body' | 'bullets', color: raw.color as string };
    case 'change_font_size':
      return { type: 'change_font_size', target, field: raw.field as 'title' | 'subtitle' | 'body' | 'bullets', delta: raw.delta as number };
    case 'change_font_family':
      return { type: 'change_font_family', target, fontFamily: raw.fontFamily as string };
    case 'toggle_bold':
      return { type: 'toggle_bold', target, field: raw.field as 'title' | 'subtitle' | 'body' | 'bullets' };
    case 'toggle_italic':
      return { type: 'toggle_italic', target, field: raw.field as 'title' | 'subtitle' | 'body' | 'bullets' };
    case 'change_alignment':
      return { type: 'change_alignment', target, align: raw.align as 'left' | 'center' | 'right' };
    case 'change_layout':
      return { type: 'change_layout', target, layout: raw.layout as SlideLayout };
    case 'convert_layout':
      return { type: 'convert_layout', target, layout: raw.layout as 'table' | 'cards' | 'process' | 'timeline' | 'statistics' | 'comparison' | 'quote' | 'two-column' };
    case 'add_slide':
      return { type: 'add_slide', afterIndex: raw.afterIndex as number | undefined };
    case 'delete_slide':
      return { type: 'delete_slide', index: raw.index as number };
    case 'duplicate_slide':
      return { type: 'duplicate_slide', index: raw.index as number };
    case 'reorder_slide':
      return { type: 'reorder_slide', fromIndex: raw.fromIndex as number, toIndex: raw.toIndex as number };
    case 'apply_theme':
      return { type: 'apply_theme', themeId: raw.themeId as ThemeId };
    case 'change_settings':
      return { type: 'change_settings', patch: raw.patch as Partial<PresentationSettings> };
    case 'add_image':
      return { type: 'add_image', target, query: raw.query as string };
    case 'remove_image':
      return { type: 'remove_image', target };
    case 'replace_image':
      return { type: 'replace_image', target, query: raw.query as string };
    case 'change_image_position':
      return { type: 'change_image_position', target, x: raw.x as number | undefined, y: raw.y as number | undefined };
    case 'change_image_size':
      return { type: 'change_image_size', target, w: raw.w as number | undefined, h: raw.h as number | undefined };
    case 'shorten_text':
      return { type: 'shorten_text', target, field: raw.field as 'body' | 'bullets' };
    case 'rewrite_text':
      return { type: 'rewrite_text', target, field: raw.field as 'title' | 'subtitle' | 'body' | 'notes', tone: raw.tone as RewriteTone, value: raw.value as string };
    case 'add_bullet':
      return { type: 'add_bullet', target, text: raw.text as string, position: raw.position as number | undefined };
    case 'remove_bullet':
      return { type: 'remove_bullet', target, index: raw.index as number };
    case 'change_bullet':
      return { type: 'change_bullet', target, index: raw.index as number, text: raw.text as string };
    case 'improve_design':
      return { type: 'improve_design', target };
    case 'copy_style':
      return { type: 'copy_style', fromIndex: raw.fromIndex as number, toIndex: (raw.toIndex === 'all' ? 'all' : raw.toIndex as number) };
    case 'change_slide_title':
      return { type: 'change_slide_title', target: typeof target === 'number' ? target : ctx.currentSlideIndex, title: raw.title as string };
    case 'update_field_style':
      return { type: 'update_field_style', target, fieldKey: raw.fieldKey as FieldKey, patch: raw.patch as TextFormat };
    case 'update_selected_element':
      return { type: 'update_selected_element', patch: raw.patch as Partial<TextBoxElement> };
    case 'update_all_text_style':
      return { type: 'update_all_text_style', target, patch: raw.patch as TextFormat, headingOnly: raw.headingOnly as boolean | undefined };
    case 'delete_element':
      return { type: 'delete_element', target, elementId: raw.elementId as string | undefined, matchText: raw.matchText as string | undefined };
    case 'remove_exact_text':
      return { type: 'remove_exact_text', target, exactText: raw.exactText as string };
    case 'replace_exact_text':
      return { type: 'replace_exact_text', target, findText: raw.findText as string, replaceText: raw.replaceText as string };
    default:
      return null;
  }
}

// ── Execute a list of actions (used by both AI and local paths) ────────────────

export function executeActions(
  actions: EditAction[],
  ctx: EditorContext,
): { presentation: Presentation; applied: number; failed: string[]; labels: string[] } {
  let presentation = ctx.presentation;
  const failed: string[] = [];
  let applied = 0;
  const labels: string[] = [];

  for (const action of actions) {
    const result = executeAction(action, presentation, ctx);
    if (result.success) {
      presentation = result.presentation;
      applied++;
      labels.push(getActionLabel(action));
    } else if (result.error) {
      failed.push(result.error);
    }
  }

  return { presentation, applied, failed, labels };
}

// ── Local (offline) entry point ───────────────────────────────────────────────

export function processChatMessage(
  message: string,
  ctx: EditorContext,
): ActionResult {
  const actions = parseLocalActions(message, ctx);

  if (actions.length === 0) {
    // Check if it's an undo/redo request
    if (/\b(undo|revert|go back|rollback)\b/i.test(message)) {
      return { presentation: ctx.presentation, message: 'Use the undo button in the toolbar (or Ctrl/Cmd+Z) to revert your last change.', applied: 0, failed: [] };
    }
    // Check if the user is asking what the AI can do
    if (/\b(what can you do|help|how do you work|what do you do|capabilities)\b/i.test(message)) {
      return { presentation: ctx.presentation, message: 'I can restyle, restructure, and rewrite your deck — in any language. Try "make this slide a table", "convert bullets to cards", "redesign all slides", "change the background to blue then make the title bigger", "add a slide about pricing", or "make the text more professional".', applied: 0, failed: [] };
    }
    return {
      presentation: ctx.presentation,
      message: "I couldn't understand that request. Try something like 'make this slide a table', 'convert to cards', 'redesign the slide', 'change background to blue', or 'add a slide'. You can chain commands with “then”, e.g. 'add a slide then change its title to Pricing'.",
      applied: 0,
      failed: [],
    };
  }

  const { presentation, applied, failed, labels } = executeActions(actions, ctx);

  let msg: string;
  if (applied === 0) {
    msg = failed.length > 0 ? `I couldn't do that — ${failed[0]}.` : "I can't perform that edit in the current editor yet.";
  } else {
    msg = `Done — ${labels.join(', ')}.`;
    if (failed.length > 0) msg += ` However, ${failed.length} action(s) couldn't be completed.`;
  }

  return { presentation, message: msg, applied, failed };
}

// ── AI-returned action execution ───────────────────────────────────────────────

export function processAiActions(
  rawActions: Record<string, unknown>[],
  aiMessage: string,
  ctx: EditorContext,
): ActionResult {
  const actions: EditAction[] = [];
  for (const raw of rawActions) {
    const coerced = coerceAiAction(raw, ctx);
    if (coerced) actions.push(coerced);
  }

  if (actions.length === 0) {
    return {
      presentation: ctx.presentation,
      message: aiMessage || "I couldn't understand that request. Could you rephrase it?",
      applied: 0,
      failed: [],
    };
  }

  const { presentation, applied, failed, labels } = executeActions(actions, ctx);

  let msg: string;
  if (applied === 0) {
    msg = failed.length > 0 ? `I couldn't do that — ${failed[0]}.` : (aiMessage || "I can't perform that edit yet.");
  } else {
    msg = aiMessage || `Done — ${labels.join(', ')}.`;
    if (failed.length > 0) msg += ` However, ${failed.length} action(s) couldn't be completed.`;
  }

  return { presentation, message: msg, applied, failed };
}

// ── Action labels ──────────────────────────────────────────────────────────────

function getActionLabel(action: EditAction): string {
  switch (action.type) {
    case 'change_background': return 'changed the background';
    case 'change_text': return 'updated the text';
    case 'change_text_color': return 'changed the text color';
    case 'change_font_size': return 'adjusted the font size';
    case 'change_font_family': return 'changed the font';
    case 'toggle_bold': return 'toggled bold';
    case 'toggle_italic': return 'toggled italic';
    case 'change_alignment': return 'changed the alignment';
    case 'change_layout': return 'changed the layout';
    case 'convert_layout': return `converted the slide to ${action.layout}`;
    case 'add_slide': return 'added a slide';
    case 'delete_slide': return 'deleted the slide';
    case 'duplicate_slide': return 'duplicated the slide';
    case 'reorder_slide': return 'reordered the slides';
    case 'apply_theme': return 'applied the theme';
    case 'change_settings': return 'updated the settings';
    case 'add_image': return 'added an image';
    case 'remove_image': return action.target === 'all' ? 'removed all images' : 'removed the image';
    case 'replace_image': return 'replaced the image';
    case 'change_image_position': return 'moved the image';
    case 'change_image_size': return 'resized the image';
    case 'shorten_text': return 'shortened the text';
    case 'rewrite_text': return 'rewrote the text';
    case 'add_bullet': return 'added a bullet';
    case 'remove_bullet': return 'removed a bullet';
    case 'change_bullet': return 'updated a bullet';
    case 'improve_design': return 'improved the slide design';
    case 'copy_style': return 'copied the slide style';
    case 'change_slide_title': return 'changed the slide title';
    case 'update_field_style': return 'updated the text formatting';
    case 'update_selected_element': return 'updated the selected text';
    case 'update_all_text_style': return action.headingOnly ? 'updated all headings' : 'updated all text styles';
    case 'delete_element': return 'deleted the element';
    case 'remove_exact_text': return `removed "${action.exactText}"`;
    case 'replace_exact_text': return `replaced "${action.findText}" with "${action.replaceText}"`;
    default: return 'made changes';
  }
}

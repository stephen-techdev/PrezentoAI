import PptxGenJS from 'pptxgenjs';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import type {
  Presentation,
  Slide,
  SlideLayout,
  PresentationSettings,
  ChartData,
  FieldKey,
} from '../types';
import { getTheme, FONT_STACK } from '../themes';
import { SlideRenderer } from '../components/SlideRenderer';
import { createRoot } from 'react-dom/client';
import { createElement } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// Prezento AI exporter.
//
// PPTX export uses pptxgenjs — a mature, well-maintained library that emits
// valid OOXML PowerPoint files openable in Microsoft PowerPoint, LibreOffice
// Impress, Google Slides, and Keynote without repair warnings.
//
// PDF export uses jsPDF + html2canvas to produce a standards-compliant PDF
// file that downloads directly (no popup, no print dialog). Each slide is
// rendered off-screen at 1280×720 (16:9) using the real SlideRenderer DOM,
// rasterized at 2× scale for crisp output, then embedded as a full-bleed
// image. Charts (Chart.js canvas) and images are captured natively.
// ─────────────────────────────────────────────────────────────────────────────

// Slide dimensions in inches (16:9 widescreen).
const SLIDE_W = 13.333;
const SLIDE_H = 7.5;
const MARGIN_X = 0.8; // ~6% horizontal padding
const MARGIN_TOP = 0.5;
const CONTENT_W = SLIDE_W - MARGIN_X * 2;

// ── Color helpers ─────────────────────────────────────────────────────────────

function isColorDark(color: string): boolean {
  if (color.startsWith('linear-gradient') || color.startsWith('radial-gradient')) {
    const m = color.match(/#([0-9a-f]{6})/i);
    if (m) return isColorDark('#' + m[1]);
    return true;
  }
  const hex = color.replace('#', '');
  if (hex.length !== 6) return false;
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 < 0.5;
}

/** pptxgenjs expects hex colors without the leading '#'. */
function hexNoHash(hex: string): string {
  return hex.replace('#', '').padEnd(6, '0').slice(0, 6);
}

// ── Background resolution (mirrors SlideRenderer) ────────────────────────────

interface ResolvedBackground {
  /** Solid color (hex) used as the slide background. */
  solid: string;
  /** Optional gradient stops for a gradient fill. */
  gradient?: { from: string; to: string };
  /** True when the background is dark (drives text color choice). */
  dark: boolean;
}

function resolveBackground(settings: PresentationSettings, theme: ReturnType<typeof getTheme>): ResolvedBackground {
  const primary = settings.primaryColor || theme.primary;
  const secondary = settings.secondaryColor || theme.secondary;
  switch (settings.background) {
    case 'white':
      return { solid: '#ffffff', dark: false };
    case 'black':
      return { solid: '#0b1120', dark: true };
    case 'blue':
      return { solid: '#1e3a8a', dark: true };
    case 'green':
      return { solid: '#064e3b', dark: true };
    case 'purple':
      return { solid: '#4c1d95', dark: true };
    case 'gradient':
      return { solid: primary, gradient: { from: primary, to: secondary }, dark: isColorDark(primary) };
    case 'abstract':
    case 'geometric':
    case 'glassmorphism':
      return { solid: theme.background, dark: isColorDark(theme.background) };
    case 'custom':
      return { solid: settings.primaryColor || theme.background, dark: isColorDark(settings.primaryColor || theme.background) };
    default:
      return { solid: theme.background, dark: isColorDark(theme.background) };
  }
}

// ── Image fetching with CORS fallback ─────────────────────────────────────────

interface FetchedImage {
  /** base64 data URL ready for pptxgenjs `data` field, or undefined on failure. */
  dataUrl?: string;
  /** When dataUrl is unavailable, fall back to the original URL (path). */
  path: string;
}

const _imageCache = new Map<string, FetchedImage>();

/**
 * Fetch an image and convert to base64. Tries CORS-aware fetch first, then
 * no-cors fetch (opaque response — may fail), then falls back to the raw URL
 * so pptxgenjs can attempt a direct download. Never throws.
 */
async function fetchImage(url: string): Promise<FetchedImage> {
  if (!url) return { path: url };
  const cached = _imageCache.get(url);
  if (cached) return cached;

  const result: FetchedImage = { path: url };

  // Data URLs pass through directly.
  if (url.startsWith('data:')) {
    result.dataUrl = url;
    _imageCache.set(url, result);
    return result;
  }

  // Try a normal CORS fetch first.
  try {
    const res = await fetch(url, { mode: 'cors' });
    if (res.ok) {
      const blob = await res.blob();
      const dataUrl = await blobToDataUrl(blob);
      if (dataUrl) {
        result.dataUrl = dataUrl;
        _imageCache.set(url, result);
        return result;
      }
    }
  } catch (e) {
    console.warn(`[exporter] CORS fetch failed for ${url}:`, e);
  }

  // Try no-cors as a last-ditch effort. The resulting opaque response can't be
  // read, so we just fall through to the path-based download.
  try {
    const res = await fetch(url, { mode: 'no-cors' });
    if (res.type === 'opaque') {
      // Can't read the body — let pptxgenjs try the URL directly.
      _imageCache.set(url, result);
      return result;
    }
  } catch (e) {
    console.warn(`[exporter] no-cors fetch failed for ${url}:`, e);
  }

  _imageCache.set(url, result);
  return result;
}

function blobToDataUrl(blob: Blob): Promise<string | null> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null);
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(blob);
  });
}

// ── PPTX export ──────────────────────────────────────────────────────────────

export async function exportPPTX(presentation: Presentation): Promise<void> {
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE'; // 13.333" x 7.5" (16:9 widescreen)
  pptx.author = 'Prezento AI';
  pptx.company = 'Prezento AI';
  pptx.title = presentation.settings.title || 'Presentation';

  const theme = getTheme(presentation.settings.theme);
  const bodyFont = FONT_STACK[theme.bodyFont].replace(/'/g, '').split(',')[0].trim();
  pptx.theme = { bodyFontFace: bodyFont };

  // Pre-fetch all images in parallel so slides can embed them synchronously.
  const imageUrls = new Set<string>();
  for (const slide of presentation.slides) {
    if (slide.image?.url) imageUrls.add(slide.image.url);
  }
  await Promise.all([...imageUrls].map((url) => fetchImage(url).catch(() => null)));

  for (let i = 0; i < presentation.slides.length; i++) {
    const slide = presentation.slides[i];
    try {
      await renderSlide(pptx, slide, presentation.settings, i, presentation.slides.length);
    } catch (e) {
      // Continue exporting remaining slides even if one fails.
      console.error(`[exporter] Slide ${i + 1} failed:`, e);
      try {
        renderFallbackSlide(pptx, slide);
      } catch (e2) {
        console.error(`[exporter] Fallback slide ${i + 1} also failed:`, e2);
      }
    }
  }

  const filename = sanitizeFilename(presentation.settings.title || 'presentation') + '.pptx';
  await pptx.writeFile({ fileName: filename });
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '') || 'presentation';
}

// ── Per-slide rendering ──────────────────────────────────────────────────────

async function renderSlide(
  pptx: PptxGenJS,
  slide: Slide,
  settings: PresentationSettings,
  index: number,
  total: number,
): Promise<void> {
  const theme = getTheme(settings.theme);
  // Per-slide background override takes precedence over the global setting.
  const bg = slide.background ? resolveSlideBackgroundExport(slide.background) : resolveBackground(settings, theme);
  const accent = settings.primaryColor || theme.primary;
  const headingFont = FONT_STACK[theme.headingFont].replace(/'/g, '').split(',')[0].trim();
  const bodyFont = FONT_STACK[theme.bodyFont].replace(/'/g, '').split(',')[0].trim();

  const textColor = bg.dark ? '#f1f5f9' : theme.text;
  const mutedColor = bg.dark ? 'rgba(241, 245, 249, 0.7)' : theme.muted;
  const surfaceColor = bg.dark ? '#0f172a' : theme.surface;
  const borderColor = bg.dark ? '#1e293b' : theme.border;

  const pptxSlide = pptx.addSlide();

  // Background fill.
  if (bg.gradient) {
    pptxSlide.background = { color: hexNoHash(bg.gradient.from) };
  } else {
    pptxSlide.background = { color: hexNoHash(bg.solid) };
  }

  // Gradient overlay (if any) as a full-bleed rectangle.
  if (bg.gradient) {
    pptxSlide.addShape('rect', {
      x: 0, y: 0, w: SLIDE_W, h: SLIDE_H,
      fill: { color: hexNoHash(bg.gradient.to), transparency: 60 },
      line: { type: 'none' },
    });
  }

  // Custom background image (if any) as a full-bleed cover, dimmed for readability.
  const bgImageUrl = slide.background?.imageUrl;
  if (bgImageUrl) {
    try {
      const bgImg = await fetchImage(bgImageUrl);
      pptxSlide.addImage({
        x: 0, y: 0, w: SLIDE_W, h: SLIDE_H,
        ...(bgImg.dataUrl ? { data: bgImg.dataUrl } : { path: bgImg.path }),
        sizing: { type: 'cover', w: SLIDE_W, h: SLIDE_H },
      });
      pptxSlide.addShape('rect', {
        x: 0, y: 0, w: SLIDE_W, h: SLIDE_H,
        fill: { color: bg.dark ? '020617' : 'FFFFFF', transparency: bg.dark ? 45 : 28 },
        line: { type: 'none' },
      });
    } catch (e) {
      console.warn(`[exporter] Background image failed on slide "${slide.title}":`, e);
    }
  }

  // Speaker notes.
  if (slide.notes) {
    pptxSlide.addNotes(slide.notes);
  }

  // Slide number (bottom-right).
  pptxSlide.addText(`${index + 1} / ${total}`, {
    x: SLIDE_W - 1.2, y: SLIDE_H - 0.45, w: 1, h: 0.3,
    fontSize: 9, color: hexNoHash(mutedColor), align: 'right', fontFace: bodyFont,
  });

  const ctx: SlideContext = {
    pptx,
    slide: pptxSlide,
    data: slide,
    settings,
    theme,
    accent,
    headingFont,
    bodyFont,
    textColor,
    mutedColor,
    surfaceColor,
    borderColor,
    bgDark: bg.dark,
  };

  renderLayout(ctx);

  // Render overlay elements on top of the layout content.
  await renderOverlays(ctx);
}

function resolveSlideBackgroundExport(bg: NonNullable<Slide['background']>): ResolvedBackground {
  if (bg.type === 'solid') {
    return { solid: bg.color || '#ffffff', dark: isColorDark(bg.color || '#ffffff') };
  }
  return { solid: bg.from || '#06b6d4', gradient: { from: bg.from || '#06b6d4', to: bg.to || '#6366f1' }, dark: isColorDark(bg.from || '#06b6d4') };
}

async function renderOverlays(ctx: SlideContext): Promise<void> {
  const elements = ctx.data.elements || [];
  for (const el of elements) {
    const x = el.x * SLIDE_W;
    const y = el.y * SLIDE_H;
    const w = el.w * SLIDE_W;
    const h = el.h * SLIDE_H;

    if (el.kind === 'text') {
      const fontFace = el.fontFamily
        ? FONT_STACK[el.fontFamily].replace(/'/g, '').split(',')[0].trim()
        : ctx.bodyFont;
      ctx.slide.addText(el.text, {
        x, y, w, h,
        fontSize: (el.fontSize || 24) * 0.75,
        bold: !!el.bold,
        italic: !!el.italic,
        underline: el.underline ? { style: 'sng' } : undefined,
        color: hexNoHash(el.color || ctx.textColor),
        fontFace,
        align: el.align || 'left',
        valign: 'top',
        wrap: true,
        fill: el.background ? { color: hexNoHash(el.background) } : undefined,
        lineSpacingMultiple: el.lineHeight,
        charSpacing: el.letterSpacing ? Math.round(el.letterSpacing * 100) : undefined,
        paraSpaceAfter: el.paragraphSpacing ? Math.round(el.paragraphSpacing * 0.75) : undefined,
      });
    } else if (el.kind === 'shape') {
      const fill = el.fill ? { color: hexNoHash(el.fill) } : undefined;
      const line = el.stroke ? { color: hexNoHash(el.stroke), pt: el.strokeWidth || 1 } : { type: 'none' as const };
      if (el.shape === 'rectangle') {
        ctx.slide.addShape('roundRect', { x, y, w, h, fill, line, rectRadius: 0.04 });
      } else if (el.shape === 'circle') {
        ctx.slide.addShape('ellipse', { x, y, w, h, fill, line });
      } else if (el.shape === 'line') {
        ctx.slide.addShape('line', { x, y: y + h / 2, w, h: 0, line: { color: hexNoHash(el.stroke || '#0f172a'), pt: el.strokeWidth || 2 } });
      } else if (el.shape === 'arrow') {
        ctx.slide.addShape('line', { x, y: y + h / 2, w, h: 0, line: { color: hexNoHash(el.stroke || el.fill || '#0f172a'), pt: el.strokeWidth || 3, endArrowType: 'triangle' } });
      } else if (el.shape === 'triangle' || el.shape === 'star' || el.shape === 'heart' || el.shape === 'hexagon' || el.shape === 'diamond') {
        // Complex shapes are rendered as rounded rectangles in PPTX (they render correctly in web view)
        ctx.slide.addShape('roundRect', { x, y, w, h, fill, line, rectRadius: 0.08 });
      }
    } else if (el.kind === 'image') {
      try {
        const img = await fetchImage(el.url);
        const imageOpts: PptxGenJS.ImageProps = {
          x, y, w, h,
          altText: el.alt || '',
          sizing: { type: el.objectFit === 'contain' ? 'contain' : 'cover', w, h },
        };
        if (img.dataUrl) imageOpts.data = img.dataUrl;
        else imageOpts.path = img.path;
        ctx.slide.addImage(imageOpts);
      } catch (e) {
        console.warn('[exporter] Overlay image failed:', e);
      }
    }
  }
}

interface SlideContext {
  pptx: PptxGenJS;
  slide: PptxGenJS.Slide;
  data: Slide;
  settings: PresentationSettings;
  theme: ReturnType<typeof getTheme>;
  accent: string;
  headingFont: string;
  bodyFont: string;
  textColor: string;
  mutedColor: string;
  surfaceColor: string;
  borderColor: string;
  bgDark: boolean;
}

/** Merge per-field style overrides (from the floating toolbar) into PPTX text
 * options. Only properties the user actually changed are overridden. */
function applyFieldStyle(ctx: SlideContext, key: FieldKey, opts: PptxGenJS.TextPropsOptions): PptxGenJS.TextPropsOptions {
  const fs = ctx.data.fieldStyles?.[key];
  if (!fs) return opts;
  const merged: PptxGenJS.TextPropsOptions = { ...opts };
  if (fs.bold !== undefined) merged.bold = fs.bold;
  if (fs.italic !== undefined) merged.italic = fs.italic;
  if (fs.underline !== undefined) merged.underline = fs.underline ? { style: 'sng' } : undefined;
  if (fs.fontSize !== undefined) merged.fontSize = fs.fontSize * 0.75; // px→pt scale
  if (fs.color !== undefined) merged.color = hexNoHash(fs.color);
  if (fs.align !== undefined) merged.align = fs.align;
  if (fs.fontFamily !== undefined) {
    merged.fontFace = FONT_STACK[fs.fontFamily].replace(/'/g, '').split(',')[0].trim();
  }
  if (fs.lineHeight !== undefined) merged.lineSpacingMultiple = fs.lineHeight;
  if (fs.letterSpacing !== undefined) merged.charSpacing = Math.round(fs.letterSpacing * 100);
  if (fs.paragraphSpacing !== undefined) merged.paraSpaceAfter = Math.round(fs.paragraphSpacing * 0.75);
  return merged;
}

// ── Layout dispatcher ─────────────────────────────────────────────────────────

function renderLayout(ctx: SlideContext): void {
  const layout = ctx.data.layout as SlideLayout;
  switch (layout) {
    case 'hero':
      renderHero(ctx);
      break;
    case 'thank-you':
      renderThankYou(ctx);
      break;
    case 'section-divider':
      renderSectionDivider(ctx);
      break;
    case 'agenda':
      renderAgenda(ctx);
      break;
    case 'two-column':
    case 'image-left':
    case 'image-right':
    case 'full-image':
      renderTwoColumn(ctx);
      break;
    case 'cards':
    case 'grid':
    case 'diagram':
      renderCards(ctx);
      break;
    case 'statistics':
      renderStatistics(ctx);
      break;
    case 'timeline':
      renderTimeline(ctx);
      break;
    case 'process':
      renderProcess(ctx);
      break;
    case 'comparison':
      renderComparison(ctx);
      break;
    case 'table':
      renderTable(ctx);
      break;
    case 'chart':
      renderChart(ctx);
      break;
    case 'quote':
      renderQuote(ctx);
      break;
    default:
      renderTwoColumn(ctx);
  }
}

// ── Shared header (accent bar + title + subtitle) ────────────────────────────

function addHeader(ctx: SlideContext, titleSize = 28): number {
  // Accent bar.
  ctx.slide.addShape('rect', {
    x: MARGIN_X, y: MARGIN_TOP, w: 0.6, h: 0.08,
    fill: { color: hexNoHash(ctx.accent) },
    line: { type: 'none' },
  });

  // Title.
  ctx.slide.addText(ctx.data.title || '', applyFieldStyle(ctx, 'title', {
    x: MARGIN_X, y: MARGIN_TOP + 0.2, w: CONTENT_W, h: 0.7,
    fontSize: titleSize, bold: true, color: hexNoHash(ctx.textColor),
    fontFace: ctx.headingFont, align: 'left', valign: 'top',
    fit: 'shrink', wrap: true,
  }));

  let nextY = MARGIN_TOP + 0.95;
  if (ctx.data.subtitle) {
    ctx.slide.addText(ctx.data.subtitle, applyFieldStyle(ctx, 'subtitle', {
      x: MARGIN_X, y: nextY, w: CONTENT_W, h: 0.4,
      fontSize: 14, color: hexNoHash(ctx.mutedColor),
      fontFace: ctx.bodyFont, align: 'left', valign: 'top', wrap: true,
    }));
    nextY += 0.5;
  }
  return nextY + 0.1;
}

// ── Hero ─────────────────────────────────────────────────────────────────────

function renderHero(ctx: SlideContext): void {
  // Accent bar.
  ctx.slide.addShape('rect', {
    x: MARGIN_X, y: SLIDE_H / 2 - 1.5, w: 0.8, h: 0.1,
    fill: { color: hexNoHash(ctx.accent) },
    line: { type: 'none' },
  });

  ctx.slide.addText(ctx.data.title || '', applyFieldStyle(ctx, 'title', {
    x: MARGIN_X, y: SLIDE_H / 2 - 1.3, w: CONTENT_W, h: 1.4,
    fontSize: 44, bold: true, color: hexNoHash(ctx.textColor),
    fontFace: ctx.headingFont, align: 'left', valign: 'top',
    fit: 'shrink', wrap: true,
  }));

  if (ctx.data.subtitle) {
    ctx.slide.addText(ctx.data.subtitle, applyFieldStyle(ctx, 'subtitle', {
      x: MARGIN_X, y: SLIDE_H / 2 + 0.2, w: CONTENT_W * 0.7, h: 0.8,
      fontSize: 18, color: hexNoHash(ctx.mutedColor),
      fontFace: ctx.bodyFont, align: 'left', valign: 'top', wrap: true,
    }));
  }

  // Audience + duration meta line.
  const meta = `${capitalize(ctx.settings.audience)} · ${ctx.settings.duration} min`;
  ctx.slide.addText(meta, {
    x: MARGIN_X, y: SLIDE_H / 2 + 1.2, w: 4, h: 0.3,
    fontSize: 11, color: hexNoHash(ctx.mutedColor),
    fontFace: ctx.bodyFont, align: 'left',
  });
  ctx.slide.addShape('ellipse', {
    x: MARGIN_X - 0.25, y: SLIDE_H / 2 + 1.25, w: 0.12, h: 0.12,
    fill: { color: hexNoHash(ctx.accent) },
    line: { type: 'none' },
  });
}

// ── Thank you ────────────────────────────────────────────────────────────────

function renderThankYou(ctx: SlideContext): void {
  ctx.slide.addShape('rect', {
    x: SLIDE_W / 2 - 0.4, y: SLIDE_H / 2 - 1.6, w: 0.8, h: 0.1,
    fill: { color: hexNoHash(ctx.accent) },
    line: { type: 'none' },
  });

  ctx.slide.addText(ctx.data.title || 'Thank You', applyFieldStyle(ctx, 'title', {
    x: 1, y: SLIDE_H / 2 - 1.3, w: SLIDE_W - 2, h: 1.2,
    fontSize: 54, bold: true, color: hexNoHash(ctx.textColor),
    fontFace: ctx.headingFont, align: 'center', valign: 'top',
    fit: 'shrink', wrap: true,
  }));

  if (ctx.data.subtitle) {
    ctx.slide.addText(ctx.data.subtitle, applyFieldStyle(ctx, 'subtitle', {
      x: 1, y: SLIDE_H / 2 + 0.1, w: SLIDE_W - 2, h: 0.6,
      fontSize: 18, color: hexNoHash(ctx.mutedColor),
      fontFace: ctx.bodyFont, align: 'center', valign: 'top', wrap: true,
    }));
  }

  ctx.slide.addText('Generated with Prezento AI', {
    x: 1, y: SLIDE_H / 2 + 1.0, w: SLIDE_W - 2, h: 0.3,
    fontSize: 11, color: hexNoHash(ctx.mutedColor),
    fontFace: ctx.bodyFont, align: 'center',
  });
}

// ── Section divider ──────────────────────────────────────────────────────────

function renderSectionDivider(ctx: SlideContext): void {
  if (ctx.data.sectionNumber) {
    ctx.slide.addText(ctx.data.sectionNumber, {
      x: MARGIN_X, y: SLIDE_H / 2 - 2.2, w: 4, h: 1.6,
      fontSize: 96, bold: true, color: hexNoHash(ctx.accent),
      fontFace: ctx.headingFont, align: 'left', valign: 'top',
      transparency: 75,
    });
  }

  ctx.slide.addText(ctx.data.title || '', applyFieldStyle(ctx, 'title', {
    x: MARGIN_X, y: SLIDE_H / 2 - 0.5, w: CONTENT_W, h: 1,
    fontSize: 36, bold: true, color: hexNoHash(ctx.textColor),
    fontFace: ctx.headingFont, align: 'left', valign: 'top',
    fit: 'shrink', wrap: true,
  }));

  if (ctx.data.subtitle) {
    ctx.slide.addText(ctx.data.subtitle, applyFieldStyle(ctx, 'subtitle', {
      x: MARGIN_X, y: SLIDE_H / 2 + 0.6, w: CONTENT_W, h: 0.5,
      fontSize: 16, color: hexNoHash(ctx.mutedColor),
      fontFace: ctx.bodyFont, align: 'left', valign: 'top', wrap: true,
    }));
  }
}

// ── Agenda ───────────────────────────────────────────────────────────────────

function renderAgenda(ctx: SlideContext): void {
  const contentY = addHeader(ctx);
  const bullets = ctx.data.bullets || [];
  if (bullets.length === 0) return;

  const cols = 2;
  const rows = Math.ceil(bullets.length / cols);
  const cardW = (CONTENT_W - 0.3) / cols;
  const cardH = Math.min(1.0, (SLIDE_H - contentY - 0.4) / rows);
  const gapY = 0.15;

  bullets.forEach((b, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = MARGIN_X + col * (cardW + 0.3);
    const y = contentY + row * (cardH + gapY);

    ctx.slide.addShape('roundRect', {
      x, y, w: cardW, h: cardH,
      fill: { color: hexNoHash(ctx.surfaceColor) },
      line: { color: hexNoHash(ctx.borderColor), pt: 1 },
      rectRadius: 0.08,
    });

    // Number badge.
    ctx.slide.addShape('roundRect', {
      x: x + 0.15, y: y + (cardH - 0.5) / 2, w: 0.5, h: 0.5,
      fill: { color: hexNoHash(ctx.accent) },
      line: { type: 'none' },
      rectRadius: 0.08,
    });
    ctx.slide.addText(String(i + 1), {
      x: x + 0.15, y: y + (cardH - 0.5) / 2, w: 0.5, h: 0.5,
      fontSize: 16, bold: true, color: 'FFFFFF',
      fontFace: ctx.bodyFont, align: 'center', valign: 'middle',
    });

    ctx.slide.addText(b.text, applyFieldStyle(ctx, `bullets:${i}`, {
      x: x + 0.8, y: y, w: cardW - 0.95, h: cardH,
      fontSize: 13, color: hexNoHash(ctx.textColor),
      fontFace: ctx.bodyFont, align: 'left', valign: 'middle', wrap: true,
    }));
  });
}

// ── Two-column / image layouts ───────────────────────────────────────────────

async function renderTwoColumn(ctx: SlideContext): Promise<void> {
  const contentY = addHeader(ctx);
  const data = ctx.data;
  const isFullImage = data.layout === 'full-image';
  const isImageLeft = data.layout === 'image-left';
  const colW = isFullImage ? CONTENT_W : (CONTENT_W - 0.4) / 2;
  const imageColX = isImageLeft ? MARGIN_X : MARGIN_X + colW + 0.4;
  const textColX = isImageLeft ? MARGIN_X + colW + 0.4 : MARGIN_X;
  const contentH = SLIDE_H - contentY - 0.4;

  // Text column.
  const textX = isFullImage ? MARGIN_X : textColX;
  const textW = isFullImage ? CONTENT_W : colW;
  const textY = contentY;
  const textParts: PptxGenJS.TextProps[] = [];

  if (data.body) {
    textParts.push({
      text: data.body,
      options: applyFieldStyle(ctx, 'body', { fontSize: 13, color: hexNoHash(ctx.textColor), fontFace: ctx.bodyFont, breakLine: true, paraSpaceAfter: 8 }),
    });
  }
  if (data.bullets && data.bullets.length) {
    data.bullets.forEach((b, i) => {
      textParts.push({
        text: b.text,
        options: applyFieldStyle(ctx, `bullets:${i}`, {
          fontSize: 13, color: hexNoHash(ctx.textColor), fontFace: ctx.bodyFont,
          bullet: { code: '2022', indent: 18 }, breakLine: true, paraSpaceAfter: 6,
        }),
      });
    });
  }

  if (textParts.length > 0) {
    ctx.slide.addText(textParts, {
      x: textX, y: textY, w: textW, h: contentH,
      align: 'left', valign: 'top', wrap: true, fit: 'shrink',
    });
  }

  // Image column.
  if (!isFullImage) {
    ctx.slide.addShape('roundRect', {
      x: imageColX, y: contentY, w: colW, h: contentH,
      fill: { color: hexNoHash(ctx.surfaceColor) },
      line: { color: hexNoHash(ctx.borderColor), pt: 1 },
      rectRadius: 0.08,
    });

    if (data.image?.url) {
      try {
        const img = await fetchImage(data.image.url);
        const imageOpts: PptxGenJS.ImageProps = {
          x: imageColX + 0.05, y: contentY + 0.05,
          w: colW - 0.1, h: contentH - 0.1,
          altText: data.image.alt || '',
          sizing: { type: 'contain', w: colW - 0.1, h: contentH - 0.1 },
        };
        if (img.dataUrl) {
          imageOpts.data = img.dataUrl;
        } else {
          imageOpts.path = img.path;
        }
        ctx.slide.addImage(imageOpts);
      } catch (e) {
        console.warn(`[exporter] Image failed on slide "${data.title}":`, e);
        renderImagePlaceholder(ctx, imageColX, contentY, colW, contentH);
      }
    } else {
      renderImagePlaceholder(ctx, imageColX, contentY, colW, contentH);
    }
  }
}

function renderImagePlaceholder(ctx: SlideContext, x: number, y: number, w: number, h: number): void {
  ctx.slide.addShape('roundRect', {
    x, y, w, h,
    fill: { color: hexNoHash(ctx.surfaceColor) },
    line: { color: hexNoHash(ctx.borderColor), width: 1, dashType: 'dash' },
    rectRadius: 0.06,
  });
}

// ── Cards / grid / diagram ────────────────────────────────────────────────────

function renderCards(ctx: SlideContext): void {
  const contentY = addHeader(ctx);
  const cards = ctx.data.cards || [];
  if (cards.length === 0) return;

  const cols = cards.length <= 3 ? cards.length : cards.length <= 4 ? 2 : 3;
  const rows = Math.ceil(cards.length / cols);
  const gap = 0.2;
  const cardW = (CONTENT_W - gap * (cols - 1)) / cols;
  const cardH = Math.min(2.2, (SLIDE_H - contentY - 0.3 - gap * (rows - 1)) / rows);

  cards.forEach((c, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = MARGIN_X + col * (cardW + gap);
    const y = contentY + row * (cardH + gap);

    // Card body.
    ctx.slide.addShape('roundRect', {
      x, y, w: cardW, h: cardH,
      fill: { color: hexNoHash(ctx.surfaceColor) },
      line: { color: hexNoHash(ctx.borderColor), pt: 1 },
      rectRadius: 0.06,
    });

    // Top accent border.
    ctx.slide.addShape('rect', {
      x, y, w: cardW, h: 0.05,
      fill: { color: hexNoHash(ctx.accent) },
      line: { type: 'none' },
    });

    // Icon badge.
    ctx.slide.addShape('roundRect', {
      x: x + 0.2, y: y + 0.25, w: 0.5, h: 0.5,
      fill: { color: hexNoHash(ctx.accent), transparency: 88 },
      line: { type: 'none' },
      rectRadius: 0.06,
    });

    // Title.
    ctx.slide.addText(c.title, applyFieldStyle(ctx, `cards:${i}:title`, {
      x: x + 0.85, y: y + 0.25, w: cardW - 1.05, h: 0.5,
      fontSize: 14, bold: true, color: hexNoHash(ctx.textColor),
      fontFace: ctx.headingFont, align: 'left', valign: 'middle', wrap: true, fit: 'shrink',
    }));

    // Description.
    ctx.slide.addText(c.description, applyFieldStyle(ctx, `cards:${i}:description`, {
      x: x + 0.2, y: y + 0.9, w: cardW - 0.4, h: cardH - 1.1,
      fontSize: 11, color: hexNoHash(ctx.mutedColor),
      fontFace: ctx.bodyFont, align: 'left', valign: 'top', wrap: true, fit: 'shrink',
    }));
  });
}

// ── Statistics ───────────────────────────────────────────────────────────────

function renderStatistics(ctx: SlideContext): void {
  const contentY = addHeader(ctx);
  const stats = ctx.data.stats || [];
  if (stats.length === 0) return;

  const cols = Math.min(4, stats.length);
  const gap = 0.25;
  const cardW = (CONTENT_W - gap * (cols - 1)) / cols;
  const cardH = Math.min(2.8, SLIDE_H - contentY - 0.4);

  stats.slice(0, 4).forEach((st, i) => {
    const x = MARGIN_X + i * (cardW + gap);
    const y = contentY + (SLIDE_H - contentY - 0.4 - cardH) / 2;

    ctx.slide.addShape('roundRect', {
      x, y, w: cardW, h: cardH,
      fill: { color: hexNoHash(ctx.surfaceColor) },
      line: { color: hexNoHash(ctx.borderColor), pt: 1 },
      rectRadius: 0.08,
    });

    ctx.slide.addText(st.value, applyFieldStyle(ctx, `stats:${i}:value`, {
      x: x + 0.2, y: y + 0.4, w: cardW - 0.4, h: 0.9,
      fontSize: 40, bold: true, color: hexNoHash(ctx.accent),
      fontFace: ctx.headingFont, align: 'center', valign: 'middle',
      fit: 'shrink',
    }));

    ctx.slide.addText(st.label, applyFieldStyle(ctx, `stats:${i}:label`, {
      x: x + 0.2, y: y + 1.4, w: cardW - 0.4, h: 0.4,
      fontSize: 13, bold: true, color: hexNoHash(ctx.textColor),
      fontFace: ctx.bodyFont, align: 'center', valign: 'top', wrap: true,
    }));

    if (st.description) {
      ctx.slide.addText(st.description, applyFieldStyle(ctx, `stats:${i}:description`, {
        x: x + 0.2, y: y + 1.85, w: cardW - 0.4, h: 0.6,
        fontSize: 10, color: hexNoHash(ctx.mutedColor),
        fontFace: ctx.bodyFont, align: 'center', valign: 'top', wrap: true,
      }));
    }
  });
}

// ── Timeline ─────────────────────────────────────────────────────────────────

function renderTimeline(ctx: SlideContext): void {
  const contentY = addHeader(ctx);
  const items = ctx.data.timeline || [];
  if (items.length === 0) return;

  const cols = Math.min(items.length, 5);
  const gap = 0.25;
  const colW = (CONTENT_W - gap * (cols - 1)) / cols;
  const cardH = Math.min(2.5, SLIDE_H - contentY - 1.0);
  const lineY = contentY + 0.25;

  // Horizontal connector line.
  ctx.slide.addShape('line', {
    x: MARGIN_X + 0.25, y: lineY, w: CONTENT_W - 0.5, h: 0,
    line: { color: hexNoHash(ctx.accent), pt: 1.5, transparency: 60 },
  });

  items.slice(0, 5).forEach((t, i) => {
    const x = MARGIN_X + i * (colW + gap);
    const y = contentY;

    // Number badge.
    ctx.slide.addShape('ellipse', {
      x: x + 0.1, y, w: 0.5, h: 0.5,
      fill: { color: hexNoHash(ctx.accent) },
      line: { type: 'none' },
    });
    ctx.slide.addText(String(i + 1), {
      x: x + 0.1, y, w: 0.5, h: 0.5,
      fontSize: 12, bold: true, color: 'FFFFFF',
      fontFace: ctx.bodyFont, align: 'center', valign: 'middle',
    });

    // Card.
    const cardY = y + 0.7;
    ctx.slide.addShape('roundRect', {
      x, y: cardY, w: colW, h: cardH,
      fill: { color: hexNoHash(ctx.surfaceColor) },
      line: { color: hexNoHash(ctx.borderColor), pt: 1 },
      rectRadius: 0.06,
    });

    ctx.slide.addText(t.year, applyFieldStyle(ctx, `timeline:${i}:year`, {
      x: x + 0.15, y: cardY + 0.15, w: colW - 0.3, h: 0.3,
      fontSize: 12, bold: true, color: hexNoHash(ctx.accent),
      fontFace: ctx.bodyFont, align: 'left', valign: 'top',
    }));

    ctx.slide.addText(t.title, applyFieldStyle(ctx, `timeline:${i}:title`, {
      x: x + 0.15, y: cardY + 0.5, w: colW - 0.3, h: 0.4,
      fontSize: 13, bold: true, color: hexNoHash(ctx.textColor),
      fontFace: ctx.bodyFont, align: 'left', valign: 'top', wrap: true, fit: 'shrink',
    }));

    ctx.slide.addText(t.description, applyFieldStyle(ctx, `timeline:${i}:description`, {
      x: x + 0.15, y: cardY + 0.95, w: colW - 0.3, h: cardH - 1.1,
      fontSize: 10, color: hexNoHash(ctx.mutedColor),
      fontFace: ctx.bodyFont, align: 'left', valign: 'top', wrap: true,
    }));
  });
}

// ── Process ──────────────────────────────────────────────────────────────────

function renderProcess(ctx: SlideContext): void {
  const contentY = addHeader(ctx);
  const steps = ctx.data.steps || [];
  if (steps.length === 0) return;

  const cols = Math.min(steps.length, 5);
  const gap = 0.25;
  const colW = (CONTENT_W - gap * (cols - 1)) / cols;
  const cardH = Math.min(2.8, SLIDE_H - contentY - 0.4);

  steps.slice(0, 5).forEach((s, i) => {
    const x = MARGIN_X + i * (colW + gap);
    const y = contentY;

    ctx.slide.addShape('roundRect', {
      x, y, w: colW, h: cardH,
      fill: { color: hexNoHash(ctx.surfaceColor) },
      line: { color: hexNoHash(ctx.borderColor), pt: 1 },
      rectRadius: 0.06,
    });

    // Top accent border.
    ctx.slide.addShape('rect', {
      x, y, w: colW, h: 0.06,
      fill: { color: hexNoHash(ctx.accent) },
      line: { type: 'none' },
    });

    ctx.slide.addText(String(s.step).padStart(2, '0'), {
      x: x + 0.2, y: y + 0.25, w: colW - 0.4, h: 0.7,
      fontSize: 32, bold: true, color: hexNoHash(ctx.accent),
      fontFace: ctx.headingFont, align: 'left', valign: 'top',
    });

    ctx.slide.addText(s.title, applyFieldStyle(ctx, `steps:${i}:title`, {
      x: x + 0.2, y: y + 1.05, w: colW - 0.4, h: 0.4,
      fontSize: 13, bold: true, color: hexNoHash(ctx.textColor),
      fontFace: ctx.bodyFont, align: 'left', valign: 'top', wrap: true, fit: 'shrink',
    }));

    ctx.slide.addText(s.description, applyFieldStyle(ctx, `steps:${i}:description`, {
      x: x + 0.2, y: y + 1.5, w: colW - 0.4, h: cardH - 1.7,
      fontSize: 10, color: hexNoHash(ctx.mutedColor),
      fontFace: ctx.bodyFont, align: 'left', valign: 'top', wrap: true,
    }));

    // Arrow between steps.
    if (i < cols - 1) {
      ctx.slide.addText('\u2192', {
        x: x + colW - 0.05, y: y + cardH / 2 - 0.2, w: 0.35, h: 0.4,
        fontSize: 18, bold: true, color: hexNoHash(ctx.accent),
        fontFace: ctx.bodyFont, align: 'center', valign: 'middle',
      });
    }
  });
}

// ── Comparison ───────────────────────────────────────────────────────────────

function renderComparison(ctx: SlideContext): void {
  const contentY = addHeader(ctx);
  const cmp = ctx.data.comparison;
  if (!cmp) return;

  const rows = cmp.rows;
  const colW = (CONTENT_W - 0.4) / 3;
  const tableX = MARGIN_X;
  const tableW = CONTENT_W;
  const headerH = 0.5;
  const rowH = Math.min(0.5, (SLIDE_H - contentY - headerH - 0.4) / Math.max(rows.length, 1));

  // Header row.
  const headerCells: PptxGenJS.TableRow = [
    { text: 'Feature', options: { fill: { color: hexNoHash(ctx.surfaceColor) }, color: hexNoHash(ctx.mutedColor), bold: true, fontSize: 12, fontFace: ctx.bodyFont, align: 'left' } },
    { text: cmp.leftTitle, options: { fill: { color: hexNoHash(ctx.surfaceColor) }, color: hexNoHash(ctx.mutedColor), bold: true, fontSize: 12, fontFace: ctx.bodyFont, align: 'left' } },
    { text: cmp.rightTitle, options: { fill: { color: hexNoHash(ctx.accent) }, color: 'FFFFFF', bold: true, fontSize: 12, fontFace: ctx.bodyFont, align: 'left' } },
  ];

  const tableRows: PptxGenJS.TableRow[] = [headerCells];
  rows.forEach((r, i) => {
    tableRows.push([
      { text: r.feature, options: applyFieldStyle(ctx, `comparison:${i}:feature`, { fill: { color: hexNoHash(ctx.surfaceColor) }, color: hexNoHash(ctx.textColor), fontSize: 11, fontFace: ctx.bodyFont, align: 'left' }) },
      { text: r.optionA, options: applyFieldStyle(ctx, `comparison:${i}:optionA`, { fill: { color: hexNoHash(ctx.surfaceColor) }, color: hexNoHash(ctx.mutedColor), fontSize: 11, fontFace: ctx.bodyFont, align: 'left' }) },
      { text: r.optionB, options: applyFieldStyle(ctx, `comparison:${i}:optionB`, { color: hexNoHash(ctx.textColor), bold: true, fontSize: 11, fontFace: ctx.bodyFont, align: 'left' }) },
    ]);
  });

  ctx.slide.addTable(tableRows, {
    x: tableX, y: contentY, w: tableW,
    colW: [colW, colW, colW],
    rowH,
    border: { type: 'solid', color: hexNoHash(ctx.borderColor), pt: 1 },
    margin: [5, 8, 5, 8] as PptxGenJS.Margin,
  });
}

// ── Table ────────────────────────────────────────────────────────────────────

function renderTable(ctx: SlideContext): void {
  const contentY = addHeader(ctx);
  const tbl = ctx.data.table;
  if (!tbl) return;

  const colW = CONTENT_W / tbl.headers.length;
  const headerH = 0.5;
  const rowH = Math.min(0.45, (SLIDE_H - contentY - headerH - 0.4) / Math.max(tbl.rows.length, 1));

  const headerCells: PptxGenJS.TableRow = tbl.headers.map((h) => ({
    text: h,
    options: {
      fill: { color: hexNoHash(ctx.accent) },
      color: 'FFFFFF', bold: true, fontSize: 12,
      fontFace: ctx.bodyFont, align: 'left',
    },
  }));

  const tableRows: PptxGenJS.TableRow[] = [headerCells];
  tbl.rows.forEach((r, i) => {
    const rowFill = i % 2 === 0 ? undefined : { color: hexNoHash(ctx.surfaceColor) };
    tableRows.push(r.map((c) => ({
      text: c,
      options: {
        fill: rowFill,
        color: hexNoHash(ctx.mutedColor), fontSize: 11,
        fontFace: ctx.bodyFont, align: 'left',
      },
    })));
  });

  ctx.slide.addTable(tableRows, {
    x: MARGIN_X, y: contentY, w: CONTENT_W,
    colW,
    rowH,
    border: { type: 'solid', color: hexNoHash(ctx.borderColor), pt: 1 },
    margin: [5, 8, 5, 8] as PptxGenJS.Margin,
  });
}

// ── Chart ─────────────────────────────────────────────────────────────────────

function renderChart(ctx: SlideContext): void {
  const contentY = addHeader(ctx);
  const chart = ctx.data.chart;
  if (!chart) return;

  const chartH = SLIDE_H - contentY - 0.4;
  const chartW = CONTENT_W;

  // Card background.
  ctx.slide.addShape('roundRect', {
    x: MARGIN_X, y: contentY, w: chartW, h: chartH,
    fill: { color: hexNoHash(ctx.surfaceColor) },
    line: { color: hexNoHash(ctx.borderColor), pt: 1 },
    rectRadius: 0.06,
  });

  const data: PptxGenJS.OptsChartData[] = [{
    name: chart.title || 'Series 1',
    labels: chart.labels,
    values: chart.values,
  }];

  const opts: PptxGenJS.IChartOpts = {
    x: MARGIN_X + 0.15, y: contentY + 0.15,
    w: chartW - 0.3, h: chartH - 0.3,
    showLegend: chart.chartType === 'doughnut' || chart.chartType === 'pie',
    legendPos: 'b',
    legendFontSize: 10,
    showValue: false,
    showTitle: !!chart.title,
    title: chart.title || '',
    titleFontSize: 12,
    titleColor: hexNoHash(ctx.textColor),
    chartColors: chartPalette(ctx.accent),
    valGridLine: { color: hexNoHash(ctx.borderColor), style: 'solid', size: 0.5 },
    catGridLine: { color: hexNoHash(ctx.borderColor), style: 'solid', size: 0.5 },
    dataLabelColor: hexNoHash(ctx.textColor),
    dataLabelFontSize: 9,
  };

  const chartType = mapChartType(chart.chartType);
  ctx.slide.addChart(chartType, data, opts);
}

function mapChartType(t: ChartData['chartType']): PptxGenJS.CHART_NAME {
  switch (t) {
    case 'bar': return 'bar';
    case 'line': return 'line';
    case 'doughnut': return 'doughnut';
    case 'pie': return 'pie';
    default: return 'bar';
  }
}

function chartPalette(accent: string): string[] {
  const a = hexNoHash(accent);
  return [a, '6366f1', '10b981', 'f59e0b', 'ec4899', '8b5cf6', '06b6d4', 'ef4444'];
}

// ── Quote ────────────────────────────────────────────────────────────────────

function renderQuote(ctx: SlideContext): void {
  const q = ctx.data.quote;
  if (!q) return;

  // Large opening quote mark.
  ctx.slide.addText('"', {
    x: MARGIN_X, y: SLIDE_H / 2 - 2.2, w: 2, h: 1.5,
    fontSize: 96, bold: true, color: hexNoHash(ctx.accent),
    fontFace: ctx.headingFont, align: 'left', valign: 'top',
  });

  ctx.slide.addText(q.text, applyFieldStyle(ctx, 'quote:text', {
    x: MARGIN_X + 0.5, y: SLIDE_H / 2 - 1.2, w: CONTENT_W - 1, h: 1.8,
    fontSize: 28, italic: true, color: hexNoHash(ctx.textColor),
    fontFace: ctx.headingFont, align: 'left', valign: 'top',
    fit: 'shrink', wrap: true,
  }));

  ctx.slide.addText(`\u2014 ${q.author}`, applyFieldStyle(ctx, 'quote:author', {
    x: MARGIN_X + 0.5, y: SLIDE_H / 2 + 0.8, w: CONTENT_W - 1, h: 0.4,
    fontSize: 14, color: hexNoHash(ctx.mutedColor),
    fontFace: ctx.bodyFont, align: 'left', valign: 'top',
  }));
}

// ── Fallback slide (used if the main renderer throws) ────────────────────────

function renderFallbackSlide(pptx: PptxGenJS, slide: Slide): void {
  const s = pptx.addSlide();
  s.background = { color: 'FFFFFF' };
  s.addText(slide.title || '(untitled slide)', {
    x: 0.5, y: 0.5, w: SLIDE_W - 1, h: 1,
    fontSize: 28, bold: true, color: '1f2937',
    fontFace: 'Arial', align: 'left', valign: 'top', wrap: true,
  });
  if (slide.subtitle) {
    s.addText(slide.subtitle, {
      x: 0.5, y: 1.6, w: SLIDE_W - 1, h: 0.5,
      fontSize: 14, color: '6b7280',
      fontFace: 'Arial', align: 'left', valign: 'top', wrap: true,
    });
  }
  if (slide.notes) s.addNotes(slide.notes);
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ── PDF export (jsPDF + html2canvas) ──────────────────────────────────────────
//
// Renders each slide off-screen at 1280×720 px (16:9) using the real
// SlideRenderer DOM, rasterizes it with html2canvas at 2× scale, then embeds
// the canvas as a full-bleed image in a landscape jsPDF document. The result
// is a standards-compliant PDF that downloads directly — no popup, no print
// dialog, no browser dependency beyond canvas support.

const PDF_RENDER_W = 1280;
const PDF_RENDER_H = 720;
const PDF_SCALE = 2;

export async function exportPDF(presentation: Presentation): Promise<void> {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'pt',
    format: [PDF_RENDER_W * 0.75, PDF_RENDER_H * 0.75],
    compress: true,
  });

  const filename = sanitizeFilename(presentation.settings.title || 'presentation') + '.pdf';

  // Off-screen render container.
  const host = document.createElement('div');
  host.style.cssText = `position:fixed;left:-99999px;top:0;width:${PDF_RENDER_W}px;height:${PDF_RENDER_H}px;z-index:-1;pointer-events:none;`;
  document.body.appendChild(host);

  const root = createRoot(host);

  try {
    for (let i = 0; i < presentation.slides.length; i++) {
      const slide = presentation.slides[i];
      root.render(
        createElement('div', {
          style: { width: PDF_RENDER_W, height: PDF_RENDER_H },
        },
        createElement(SlideRenderer, {
          slide,
          settings: presentation.settings,
        })),
      );

      // Wait for fonts and images to settle.
      await waitForRender(host);
      await waitForFonts();
      await waitForImages(host);

      let canvas: HTMLCanvasElement;
      try {
        canvas = await html2canvas(host.firstElementChild as HTMLElement, {
          scale: PDF_SCALE,
          width: PDF_RENDER_W,
          height: PDF_RENDER_H,
          useCORS: true,
          allowTaint: false,
          backgroundColor: '#ffffff',
          logging: false,
          imageTimeout: 15000,
        });
      } catch (e) {
        console.warn(`[exporter] Slide ${i + 1} rasterize failed, inserting blank page:`, e);
        canvas = document.createElement('canvas');
        canvas.width = PDF_RENDER_W * PDF_SCALE;
        canvas.height = PDF_RENDER_H * PDF_SCALE;
      }

      if (i > 0) doc.addPage();

      const imgData = canvas.toDataURL('image/jpeg', 0.92);
      doc.addImage(imgData, 'JPEG', 0, 0, doc.internal.pageSize.getWidth(), doc.internal.pageSize.getHeight());
    }

    doc.save(filename);
  } finally {
    root.unmount();
    host.remove();
  }
}

function waitForRender(_el: HTMLElement): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

function waitForFonts(): Promise<void> {
  if (!document.fonts || !document.fonts.ready) return Promise.resolve();
  return Promise.race([
    document.fonts.ready,
    new Promise<void>((r) => setTimeout(r, 3000)),
  ]).then(() => undefined);
}

function waitForImages(container: HTMLElement): Promise<void> {
  const imgs = Array.from(container.querySelectorAll('img'));
  if (imgs.length === 0) return Promise.resolve();
  return Promise.all(
    imgs.map((img) => {
      if (img.complete && img.naturalWidth > 0) return Promise.resolve();
      return new Promise<void>((resolve) => {
        const done = () => resolve();
        img.addEventListener('load', done, { once: true });
        img.addEventListener('error', done, { once: true });
        setTimeout(done, 10000);
      });
    }),
  ).then(() => undefined);
}

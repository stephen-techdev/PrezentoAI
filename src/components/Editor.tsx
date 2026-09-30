import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Sparkles, Download, Palette, Plus, Copy, Trash2, ChevronUp, ChevronDown,
  Wand2, X, FileText, FileImage, Sun, Moon,
  Home, Edit3, Eye, Loader2, Check, ArrowLeft,
  ArrowRight, Maximize, Type, Undo2, Redo2, GripVertical,
  PanelRightOpen, PanelRightClose, MessageSquare,
  ZoomIn, ZoomOut, MoreHorizontal, AlertTriangle,
} from 'lucide-react';
import type {
  Presentation, Slide, PresentationSettings, FontFamily, BackgroundStyle,
  SlideElement, TextBoxElement, ShapeKind, ShapeElement, ImageElement, SlideBackground,
  FieldKey, TextFormat,
} from '../types';
import { SlideRenderer } from './SlideRenderer';
import { AIPanel } from './AIPanel';
import { AIChatPanel } from './AIChatPanel';
import { PropertiesPanel, CustomColorInput } from './PropertiesPanel';
import { ImageCropModal } from './ImageCropModal';
import { DropdownPortal } from './DropdownPortal';
import { FloatingTextToolbar } from './FloatingTextToolbar';
import { THEME_LIST, FONT_OPTIONS, shadeHex } from '../themes';
import { exportPDF, exportPPTX } from '../lib/exporter';
import { regenerateSlide } from '../lib/generator';
import { useHistory, useKeyboardShortcuts } from '../lib/useHistory';
import { uid } from '../lib/id';
import { savePresentation } from '../lib/presentationStore';

interface Props {
  presentation: Presentation;
  onPresentationChange: (p: Presentation) => void;
  onHome: () => void;
  dark: boolean;
  onToggleDark: () => void;
  startPresenting?: boolean;
}

type PanelTab = 'ai' | 'chat' | 'theme' | 'export' | 'properties' | null;
type AITab = 'rewrite' | 'notes' | 'viva' | 'score';

export function Editor({ presentation: incoming, onPresentationChange, onHome, dark, onToggleDark, startPresenting }: Props) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [panel, setPanel] = useState<PanelTab>(null);
  const [aiTab, setAiTab] = useState<AITab>('rewrite');
  const [editing, setEditing] = useState(true);
  const [presenting, setPresenting] = useState(!!startPresenting);
  const [exporting, setExporting] = useState<'pptx' | 'pdf' | null>(null);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [selectedField, setSelectedField] = useState<FieldKey | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const [cropMode, setCropMode] = useState<{ elementId: string } | null>(null);
  const [stripOpen, setStripOpen] = useState(false);
  const [slideZoom, setSlideZoom] = useState(100);
  const [exportError, setExportError] = useState<string | null>(null);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const stripRef = useRef<HTMLDivElement>(null);
  const moreBtnRef = useRef<HTMLButtonElement>(null);
  const slideFrameRef = useRef<HTMLDivElement>(null);
  const [toolbarPos, setToolbarPos] = useState<{ top: number; left: number } | null>(null);
  const [detectedFontSize, setDetectedFontSize] = useState<number | null>(null);

  // History (undo/redo). The incoming presentation is the source of truth that
  // the parent holds; we keep a local history and push changes up.
  const hist = useHistory<Presentation>(incoming);
  const presentation = hist.state;

  // When the parent hands us a new presentation (e.g. regenerate-all), reset.
  useEffect(() => {
    if (incoming !== presentation) {
      hist.reset(incoming);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incoming]);

  const commit = useCallback((p: Presentation) => {
    hist.set(p);
    onPresentationChange(p);
  }, [hist, onPresentationChange]);

  // Debounced auto-save to database
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (incoming === presentation) return;
    setSaveState('saving');
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      const { error } = await savePresentation(presentation);
      if (error) {
        console.error('Auto-save failed:', error);
        setSaveState('error');
      } else {
        setSaveState('saved');
        setTimeout(() => setSaveState('idle'), 1500);
      }
    }, 1000);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presentation]);

  const slide = presentation.slides[currentIdx];

  useEffect(() => {
    if (stripRef.current) {
      const active = stripRef.current.children[currentIdx] as HTMLElement;
      if (active) active.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [currentIdx]);

  // Clamp current index when slide count changes.
  useEffect(() => {
    if (currentIdx >= presentation.slides.length) {
      setCurrentIdx(Math.max(0, presentation.slides.length - 1));
    }
  }, [presentation.slides.length, currentIdx]);

  const updateSlide = useCallback((newSlide: Slide) => {
    const slides = [...presentation.slides];
    slides[currentIdx] = newSlide;
    commit({ ...presentation, slides, updatedAt: new Date().toISOString() });
  }, [presentation, currentIdx, commit]);

  const updateSettings = (patch: Partial<PresentationSettings>) => {
    commit({ ...presentation, settings: { ...presentation.settings, ...patch }, updatedAt: new Date().toISOString() });
  };

  // ── Field style operations (AI-generated template text) ──
  const updateFieldStyle = useCallback((key: FieldKey, patch: TextFormat) => {
    const fieldStyles = { ...(slide.fieldStyles || {}) };
    fieldStyles[key] = { ...fieldStyles[key], ...patch };
    updateSlide({ ...slide, fieldStyles });
  }, [slide, updateSlide]);

  // Select a single element, or clear selection when id is null.
  const handleSelectElement = useCallback((id: string | null) => {
    setSelectedElementId(id);
    setSelectedField(null);
  }, []);

  const handleSelectField = useCallback((key: FieldKey | null) => {
    setSelectedField(key);
    if (key) setSelectedElementId(null);
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedElementId(null);
    setSelectedField(null);
  }, []);

  // Detect actual computed font size of the selected template field so the
  // toolbar shows the real value instead of falling back to 24.
  useEffect(() => {
    if (!selectedField || !editing) { setDetectedFontSize(null); return; }
    const frame = slideFrameRef.current;
    if (!frame) return;
    const el = frame.querySelector(`[data-field-key="${selectedField}"]`) as HTMLElement | null;
    if (!el) return;
    const px = parseFloat(window.getComputedStyle(el).fontSize);
    if (!Number.isNaN(px)) setDetectedFontSize(px);
  }, [selectedField, slide, currentIdx, editing, slideZoom]);

  // Clear text selection when navigating slides or opening a panel
  useEffect(() => {
    clearSelection();
  }, [currentIdx, clearSelection]);

  useEffect(() => {
    if (panel) clearSelection();
  }, [panel, clearSelection]);

  // ── Element operations ──
  const updateElement = useCallback((id: string, patch: Partial<SlideElement>) => {
    const elements = [...(slide.elements || [])];
    const idx = elements.findIndex((e) => e.id === id);
    if (idx < 0) return;
    elements[idx] = { ...elements[idx], ...patch } as SlideElement;
    updateSlide({ ...slide, elements });
  }, [slide, updateSlide]);

  // Apply a formatting patch to the single selected text target — either an
  // overlay text element or an AI template field — and commit to slide state.
  const applyTextFormat = useCallback((patch: TextFormat) => {
    if (selectedElementId) {
      const elements = [...(slide.elements || [])];
      const idx = elements.findIndex((e) => e.id === selectedElementId);
      if (idx < 0) return;
      const el = elements[idx] as TextBoxElement;
      const elPatch: Partial<TextBoxElement> = { ...patch };
      if (patch.fontSize !== undefined) {
        elPatch.fontSize = Math.max(8, Math.min(120, patch.fontSize));
      }
      elements[idx] = { ...el, ...elPatch } as SlideElement;
      updateSlide({ ...slide, elements });
    } else if (selectedField) {
      const fieldStyles = { ...(slide.fieldStyles || {}) };
      fieldStyles[selectedField] = { ...fieldStyles[selectedField], ...patch };
      if (patch.fontSize !== undefined) {
        fieldStyles[selectedField].fontSize = Math.max(8, Math.min(120, patch.fontSize));
      }
      updateSlide({ ...slide, fieldStyles });
    }
  }, [selectedElementId, selectedField, slide, updateSlide]);

  // Detach a template field (title / subtitle / body / one bullet) into a free
  // floating text box that can be dragged anywhere on the slide, Canva-style.
  // The template copy is cleared so the sentence lives in exactly one place.
  const detachSelectedField = useCallback(() => {
    if (!selectedField) return;
    const fs = slide.fieldStyles?.[selectedField] || {};
    const fieldStyles = { ...(slide.fieldStyles || {}) };
    delete fieldStyles[selectedField];
    let text = '';
    let patch: Partial<Slide> = { fieldStyles };
    const bulletMatch = selectedField.match(/^bullets:(\d+)$/);
    if (selectedField === 'title') {
      text = slide.title;
      patch = { ...patch, title: '' };
    } else if (selectedField === 'subtitle') {
      text = slide.subtitle || '';
      patch = { ...patch, subtitle: undefined };
    } else if (selectedField === 'body') {
      text = slide.body || '';
      patch = { ...patch, body: undefined };
    } else if (bulletMatch) {
      const idx = parseInt(bulletMatch[1], 10);
      const bullets = [...(slide.bullets || [])];
      if (idx < 0 || idx >= bullets.length) return;
      text = bullets[idx].text;
      bullets.splice(idx, 1);
      // Reindex remaining bullet field styles (bullets:3 → bullets:2, …)
      const reindexed: typeof fieldStyles = {};
      for (const [key, style] of Object.entries(fieldStyles)) {
        const m = key.match(/^bullets:(\d+)$/);
        if (m) {
          const n = parseInt(m[1], 10);
          if (n > idx) reindexed[`bullets:${n - 1}`] = style;
          else if (n < idx) reindexed[key] = style;
        } else {
          reindexed[key] = style;
        }
      }
      patch = { ...patch, bullets, fieldStyles: reindexed };
    } else {
      return;
    }
    if (!text.trim()) return;
    const el: TextBoxElement = {
      id: uid('el'),
      kind: 'text',
      x: 0.3, y: 0.35, w: 0.4, h: 0.12,
      text: text.trim(),
      fontFamily: fs.fontFamily,
      fontSize: fs.fontSize ?? detectedFontSize ?? 20,
      bold: fs.bold,
      italic: fs.italic,
      underline: fs.underline,
      color: fs.color,
      align: fs.align || 'left',
      lineHeight: fs.lineHeight,
      letterSpacing: fs.letterSpacing,
      paragraphSpacing: fs.paragraphSpacing,
    };
    const elements = [...(slide.elements || []), el];
    updateSlide({ ...slide, ...patch, elements });
    setSelectedField(null);
    setSelectedElementId(el.id);
  }, [selectedField, slide, updateSlide, detectedFontSize]);

  const canDetachField = !!selectedField && /^(title|subtitle|body|bullets:\d+)$/.test(selectedField);

  const addElement = useCallback((el: SlideElement) => {
    const elements = [...(slide.elements || []), el];
    updateSlide({ ...slide, elements });
    setSelectedElementId(el.id);
  }, [slide, updateSlide]);

  const addText = () => {
    const el: TextBoxElement = {
      id: uid('el'),
      kind: 'text',
      x: 0.1, y: 0.1, w: 0.4, h: 0.12,
      text: 'New text',
      fontSize: 24,
      color: '#0f172a',
      align: 'left',
    };
    addElement(el);
    setSelectedField(null);
  };

  const selectedElement = (slide.elements || []).find((e) => e.id === selectedElementId) as SlideElement | undefined;

  // A unified text-format descriptor for the floating toolbar. When a template
  // field is selected we synthesize a TextBoxElement-like object from the
  // field's style overrides so the existing toolbar component works unchanged.
  const toolbarElement: TextBoxElement | null = (() => {
    if (selectedElement && selectedElement.kind === 'text') return selectedElement as TextBoxElement;
    if (selectedField) {
      const fs = slide.fieldStyles?.[selectedField] || {};
      return {
        id: `field:${selectedField}`, kind: 'text', x: 0, y: 0, w: 0.4, h: 0.1, text: '',
        fontFamily: fs.fontFamily, fontSize: fs.fontSize ?? detectedFontSize ?? 24, bold: fs.bold, italic: fs.italic,
        underline: fs.underline, color: fs.color, align: fs.align,
        lineHeight: fs.lineHeight, letterSpacing: fs.letterSpacing, paragraphSpacing: fs.paragraphSpacing,
      };
    }
    return null;
  })();

  // Reposition the floating text toolbar so it sits just above the selected
  // text element or template field within the slide canvas.
  useEffect(() => {
    const frame = slideFrameRef.current;
    if (!frame || !editing) { setToolbarPos(null); return; }
    if (!toolbarElement) { setToolbarPos(null); return; }

    if (selectedField) {
      const el = frame.querySelector(`[data-field-key="${selectedField}"]`) as HTMLElement | null;
      if (el) {
        const rect = el.getBoundingClientRect();
        setToolbarPos({
          left: rect.left + rect.width / 2 - 180,
          top: Math.max(0, rect.top - 48),
        });
        return;
      }
    }

    const rect = frame.getBoundingClientRect();
    const scaleX = rect.width / 1280;
    const scaleY = rect.height / 720;
    const elX = toolbarElement.x * scaleX;
    const elW = toolbarElement.w * scaleX;
    const elTop = toolbarElement.y * scaleY;
    setToolbarPos({
      left: rect.left + Math.max(0, Math.min(rect.width - 360, elX + elW / 2 - 180)),
      top: rect.top + Math.max(0, elTop - 48),
    });
  }, [toolbarElement, editing, slideZoom, currentIdx, slide, selectedField]);

  const addShape = (shape: ShapeKind) => {
    // Default colors based on shape type
    const defaultColors: Record<ShapeKind, { fill?: string; stroke?: string }> = {
      rectangle: { fill: '#06b6d4' },
      circle: { fill: '#8b5cf6' },
      triangle: { fill: '#f97316' },
      star: { fill: '#fbbf24' },
      heart: { fill: '#ec4899' },
      hexagon: { fill: '#10b981' },
      diamond: { fill: '#3b82f6' },
      arrow: { stroke: '#0f172a' },
      line: { stroke: '#0f172a' },
    };
    const defaults = defaultColors[shape];
    const el: ShapeElement = {
      id: uid('el'),
      kind: 'shape',
      shape,
      x: 0.3, y: 0.3, w: 0.2, h: 0.15,
      fill: defaults.fill,
      stroke: defaults.stroke,
      strokeWidth: shape === 'line' || shape === 'arrow' ? 3 : undefined,
    };
    addElement(el);
  };

  const duplicateElement = () => {
    if (!selectedElementId) return;
    const el = (slide.elements || []).find((e) => e.id === selectedElementId);
    if (!el) return;
    const copy: SlideElement = {
      ...JSON.parse(JSON.stringify(el)),
      id: uid('el'),
      x: Math.min(0.9 - el.w, el.x + 0.04),
      y: Math.min(0.9 - el.h, el.y + 0.04),
    };
    addElement(copy);
  };

  const deleteElement = () => {
    if (!selectedElementId) return;
    const elements = (slide.elements || []).filter((e) => e.id !== selectedElementId);
    updateSlide({ ...slide, elements });
    setSelectedElementId(null);
    setSelectedField(null);
  };

  const changeBackground = (bg: SlideBackground) => {
    updateSlide({ ...slide, background: bg });
  };

  // ── Element layering ──
  const bringElementForward = () => {
    if (!selectedElementId) return;
    const elements = [...(slide.elements || [])];
    const idx = elements.findIndex((e) => e.id === selectedElementId);
    if (idx < 0 || idx >= elements.length - 1) return;
    [elements[idx], elements[idx + 1]] = [elements[idx + 1], elements[idx]];
    updateSlide({ ...slide, elements });
  };

  const sendElementBackward = () => {
    if (!selectedElementId) return;
    const elements = [...(slide.elements || [])];
    const idx = elements.findIndex((e) => e.id === selectedElementId);
    if (idx <= 0) return;
    [elements[idx], elements[idx - 1]] = [elements[idx - 1], elements[idx]];
    updateSlide({ ...slide, elements });
  };

  // ── Image upload from device (new element) ──
  const uploadImage = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const url = reader.result as string;
      const img = new Image();
      img.onload = () => {
        const ratio = img.height / img.width;
        const w = 0.35;
        addElement({
          id: uid('el'),
          kind: 'image',
          x: 0.325, y: 0.3, w, h: Math.min(0.6, w * ratio),
          url,
          alt: file.name,
          objectFit: 'contain',
          borderRadius: 8,
          opacity: 1,
        } as ImageElement);
      };
      img.src = url;
    };
    reader.readAsDataURL(file);
  };

  // ── Logo upload: small image pinned top-right of the current slide ──
  const uploadLogo = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const url = reader.result as string;
      const elements = [...(slide.elements || [])].filter((e) => !(e.kind === 'image' && (e as ImageElement).alt === '__logo__'));
      const img = new Image();
      img.onload = () => {
        const ratio = img.height / img.width;
        const w = 0.12;
        updateSlide({
          ...slide,
          elements: [...elements, {
            id: uid('el'),
            kind: 'image',
            x: 0.85, y: 0.03, w, h: w * ratio,
            url,
            alt: '__logo__',
            objectFit: 'contain',
            borderRadius: 4,
            opacity: 1,
          } as ImageElement],
        });
        setSelectedElementId(elements.length > 0 ? elements[elements.length - 1].id : null);
      };
      img.src = url;
    };
    reader.readAsDataURL(file);
  };

  // ── Image replace ──
  const replaceImage = (file: File) => {
    if (!selectedElementId) return;
    const el = (slide.elements || []).find((e) => e.id === selectedElementId);
    if (!el || el.kind !== 'image') return;
    const reader = new FileReader();
    reader.onload = () => {
      const url = reader.result as string;
      updateElement(selectedElementId, { url } as Partial<ImageElement>);
    };
    reader.readAsDataURL(file);
  };

  // ── Image crop (opens crop modal) ──
  const startImageCrop = () => {
    if (!selectedElementId) return;
    const el = (slide.elements || []).find((e) => e.id === selectedElementId);
    if (!el || el.kind !== 'image') return;
    setCropMode({ elementId: selectedElementId });
  };

  const applyCrop = (crop: { x: number; y: number; w: number; h: number }) => {
    if (!cropMode) return;
    updateElement(cropMode.elementId, {
      x: crop.x,
      y: crop.y,
      w: crop.w,
      h: crop.h,
    });
    setCropMode(null);
  };

  // ── Slide operations ──
  const addSlide = () => {
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
    slides.splice(currentIdx + 1, 0, newSlide);
    commit({ ...presentation, slides, updatedAt: new Date().toISOString() });
    setCurrentIdx(currentIdx + 1);
    setSelectedElementId(null);
    setSelectedField(null);
  };

  const duplicateSlide = () => {
    const slides = [...presentation.slides];
    const copy: Slide = {
      ...JSON.parse(JSON.stringify(slide)),
      id: uid('sl'),
      title: slide.title + ' (Copy)',
    };
    copy.bullets = (copy.bullets || []).map((b) => ({ ...b, id: uid('bl') }));
    copy.cards = (copy.cards || []).map((c) => ({ ...c, id: uid('cd') }));
    copy.stats = (copy.stats || []).map((s) => ({ ...s, id: uid('st') }));
    copy.timeline = (copy.timeline || []).map((t) => ({ ...t, id: uid('tl') }));
    copy.steps = (copy.steps || []).map((s) => ({ ...s, id: uid('ps') }));
    copy.elements = (copy.elements || []).map((e) => ({ ...e, id: uid('el') }));
    slides.splice(currentIdx + 1, 0, copy);
    commit({ ...presentation, slides, updatedAt: new Date().toISOString() });
    setCurrentIdx(currentIdx + 1);
  };

  const deleteSlide = () => {
    if (presentation.slides.length <= 1) return;
    const slides = presentation.slides.filter((_, i) => i !== currentIdx);
    commit({ ...presentation, slides, updatedAt: new Date().toISOString() });
    setCurrentIdx(Math.max(0, currentIdx - 1));
    setSelectedElementId(null);
    setSelectedField(null);
  };

  const moveSlide = (dir: -1 | 1) => {
    const newIdx = currentIdx + dir;
    if (newIdx < 0 || newIdx >= presentation.slides.length) return;
    const slides = [...presentation.slides];
    [slides[currentIdx], slides[newIdx]] = [slides[newIdx], slides[currentIdx]];
    commit({ ...presentation, slides, updatedAt: new Date().toISOString() });
    setCurrentIdx(newIdx);
  };

  // ── Drag-and-drop slide reordering ──
  const dragSrcIdx = useRef<number | null>(null);

  const onSlideDragStart = (i: number) => {
    dragSrcIdx.current = i;
  };

  const onSlideDragOver = (e: React.DragEvent, i: number) => {
    e.preventDefault();
    setDragOverIdx(i);
  };

  const onSlideDrop = (i: number) => {
    const src = dragSrcIdx.current;
    if (src === null || src === i) {
      dragSrcIdx.current = null;
      setDragOverIdx(null);
      return;
    }
    const slides = [...presentation.slides];
    const [moved] = slides.splice(src, 1);
    slides.splice(i, 0, moved);
    commit({ ...presentation, slides, updatedAt: new Date().toISOString() });
    setCurrentIdx(i);
    dragSrcIdx.current = null;
    setDragOverIdx(null);
  };

  const regenerateEntire = () => {
    const slides = presentation.slides.map((s) => {
      const regen = regenerateSlide(s, presentation.settings, Math.floor(Math.random() * 1000));
      return { ...regen, id: s.id };
    });
    commit({ ...presentation, slides, updatedAt: new Date().toISOString() });
  };

  const handleExport = async (format: 'pptx' | 'pdf') => {
    setExporting(format);
    setExportError(null);
    await new Promise((r) => setTimeout(r, 100));
    try {
      if (format === 'pdf') await exportPDF(presentation);
      else await exportPPTX(presentation);
    } catch (e) {
      console.error(`${format.toUpperCase()} export failed:`, e);
      setExportError(format === 'pdf'
        ? 'PDF export failed. Please try again.'
        : 'PPTX export failed. Please try again.');
    }
    setExporting(null);
  };

  // ── Keyboard shortcuts ──
  useKeyboardShortcuts({
    'mod+z': () => hist.undo(),
    'mod+shift+z': () => hist.redo(),
    'mod+y': () => hist.redo(),
    'mod+d': () => { if (selectedElementId) duplicateElement(); else duplicateSlide(); },
    'delete': () => { if (selectedElementId) deleteElement(); },
    'backspace': () => { if (selectedElementId) deleteElement(); },
    'escape': () => { setSelectedElementId(null); setSelectedField(null); },
  });

  // Propagate undo/redo (and any local history change) to the parent so the
  // exported presentation always reflects the latest edits. Skipped when the
  // parent already holds the same reference (e.g. right after commit()).
  useEffect(() => {
    if (incoming !== presentation) {
      onPresentationChange(presentation);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presentation]);

  if (presenting) {
    return <PresentMode presentation={presentation} idx={currentIdx} onExit={() => setPresenting(false)} onIdx={setCurrentIdx} />;
  }

  return (
    <div className="h-screen flex flex-col bg-slate-50 dark:bg-slate-950 overflow-hidden">
      {/* Top bar */}
      <header className="h-14 shrink-0 glass-strong border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-2 sm:px-4 z-30 gap-1">
        <div className="flex items-center gap-1 sm:gap-2 min-w-0 flex-1">
          <button onClick={onHome} className="p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition shrink-0" title="Home">
            <Home className="w-4 h-4" />
          </button>
          <button
            onClick={() => setStripOpen(!stripOpen)}
            className="lg:hidden p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition shrink-0"
            title="Slides"
          >
            <PanelRightOpen className="w-4 h-4" />
          </button>
          <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 hidden sm:block" />
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-brand-400 to-indigo-500 flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <input
              value={presentation.settings.title}
              onChange={(e) => updateSettings({ title: e.target.value })}
              className="bg-transparent text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-brand-400 rounded px-1 py-0.5 min-w-0 flex-1 max-w-[80px] sm:max-w-xs truncate"
            />
            {saveState === 'saving' && (
              <span className="hidden sm:inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 shrink-0">
                <Loader2 className="w-3 h-3 animate-spin" /> Saving...
              </span>
            )}
            {saveState === 'saved' && (
              <span className="hidden sm:inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 shrink-0">
                <Check className="w-3 h-3" /> Saved
              </span>
            )}
            {saveState === 'error' && (
              <span className="hidden sm:inline-flex items-center gap-1 text-xs text-rose-600 dark:text-rose-400 shrink-0">
                Save failed
              </span>
            )}
          </div>
        </div>

        {/* Desktop controls */}
        <div className="hidden md:flex items-center gap-1 shrink-0">
          <button
            onClick={() => hist.undo()}
            disabled={!hist.canUndo}
            className="p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 transition"
            title="Undo (Ctrl/Cmd+Z)"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => hist.redo()}
            disabled={!hist.canRedo}
            className="p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 transition"
            title="Redo (Ctrl/Cmd+Shift+Z)"
          >
            <Redo2 className="w-4 h-4" />
          </button>
          <div className="w-px h-6 bg-slate-200 dark:bg-slate-700" />
          <button
            onClick={() => { clearSelection(); setEditing(!editing); }}
            className={`hidden lg:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition ${
              editing ? 'bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            {editing ? <Edit3 className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            {editing ? 'Editing' : 'Preview'}
          </button>
          <button
            onClick={() => setPanel(panel === 'theme' ? null : 'theme')}
            className={`p-2 rounded-lg transition ${panel === 'theme' ? 'bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
            title="Themes"
          >
            <Palette className="w-4 h-4" />
          </button>
          <button
            onClick={() => { setAiTab('rewrite'); setPanel(panel === 'ai' ? null : 'ai'); }}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition ${
              panel === 'ai' ? 'bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Wand2 className="w-3.5 h-3.5" /> <span className="hidden lg:inline">AI</span>
          </button>
          <button
            onClick={() => { setPanel(panel === 'chat' ? null : 'chat'); }}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition ${
              panel === 'chat' ? 'bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
            title="AI Chat Assistant"
          >
            <MessageSquare className="w-3.5 h-3.5" /> <span className="hidden lg:inline">Chat</span>
          </button>
          <button
            onClick={() => setPanel(panel === 'properties' ? null : 'properties')}
            className={`p-2 rounded-lg transition ${panel === 'properties' ? 'bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
            title="Properties"
          >
            {panel === 'properties' ? <PanelRightClose className="w-4 h-4" /> : <PanelRightOpen className="w-4 h-4" />}
          </button>
          <button
            onClick={() => setPanel(panel === 'export' ? null : 'export')}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition ${
              panel === 'export' ? 'bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Download className="w-3.5 h-3.5" /> <span className="hidden lg:inline">Export</span>
          </button>
          <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1" />
          <button
            onClick={() => { clearSelection(); setPresenting(true); }}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <Maximize className="w-3.5 h-3.5" /> <span className="hidden lg:inline">Present</span>
          </button>
          <button
            onClick={onToggleDark}
            className="p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>

        {/* Mobile: primary actions + More menu */}
        <div className="flex md:hidden items-center gap-0.5 shrink-0">
          <button
            onClick={() => { setAiTab('rewrite'); setPanel(panel === 'ai' ? null : 'ai'); }}
            className={`p-2 rounded-lg transition ${panel === 'ai' ? 'bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
            title="AI"
          >
            <Wand2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => { setPanel(panel === 'chat' ? null : 'chat'); }}
            className={`p-2 rounded-lg transition ${panel === 'chat' ? 'bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
            title="Chat"
          >
            <MessageSquare className="w-4 h-4" />
          </button>
          <button
            ref={moreBtnRef}
            onClick={() => setMoreMenuOpen(!moreMenuOpen)}
            className={`p-2 rounded-lg transition ${moreMenuOpen ? 'bg-slate-100 dark:bg-slate-800' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
            title="More"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>
          <DropdownPortal open={moreMenuOpen} onClose={() => setMoreMenuOpen(false)} anchorRef={moreBtnRef} placement="bottom-end" width={220}>
            <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-card-lg py-1">
              <button onClick={() => { hist.undo(); setMoreMenuOpen(false); }} disabled={!hist.canUndo} className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 text-left">
                <Undo2 className="w-4 h-4" /> Undo
              </button>
              <button onClick={() => { hist.redo(); setMoreMenuOpen(false); }} disabled={!hist.canRedo} className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 text-left">
                <Redo2 className="w-4 h-4" /> Redo
              </button>
              <div className="h-px bg-slate-200 dark:bg-slate-700 my-1" />
              <button onClick={() => { clearSelection(); setEditing(!editing); setMoreMenuOpen(false); }} className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 text-left">
                {editing ? <Eye className="w-4 h-4" /> : <Edit3 className="w-4 h-4" />} {editing ? 'Preview' : 'Editing'}
              </button>
              <button onClick={() => { setPanel(panel === 'theme' ? null : 'theme'); setMoreMenuOpen(false); }} className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm text-left ${panel === 'theme' ? 'text-brand-700 dark:text-brand-300' : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
                <Palette className="w-4 h-4" /> Themes
              </button>
              <button onClick={() => { setPanel(panel === 'properties' ? null : 'properties'); setMoreMenuOpen(false); }} className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm text-left ${panel === 'properties' ? 'text-brand-700 dark:text-brand-300' : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
                {panel === 'properties' ? <PanelRightClose className="w-4 h-4" /> : <PanelRightOpen className="w-4 h-4" />} Properties
              </button>
              <button onClick={() => { setPanel(panel === 'export' ? null : 'export'); setMoreMenuOpen(false); }} className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm text-left ${panel === 'export' ? 'text-brand-700 dark:text-brand-300' : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
                <Download className="w-4 h-4" /> Export
              </button>
              <div className="h-px bg-slate-200 dark:bg-slate-700 my-1" />
              <button onClick={() => { clearSelection(); setPresenting(true); setMoreMenuOpen(false); }} className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 text-left">
                <Maximize className="w-4 h-4" /> Present
              </button>
              <button onClick={() => { onToggleDark(); setMoreMenuOpen(false); }} className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 text-left">
                {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />} {dark ? 'Light mode' : 'Dark mode'}
              </button>
            </div>
          </DropdownPortal>
        </div>
      </header>

      {/* Body */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Slide strip — desktop: sidebar, mobile: overlay drawer */}
        <aside
          className={`w-44 sm:w-52 shrink-0 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col
            lg:relative lg:translate-x-0 lg:flex
            absolute inset-y-0 left-0 z-20 transition-transform duration-200
            ${stripOpen ? 'translate-x-0 shadow-2xl lg:shadow-none' : '-translate-x-full lg:translate-x-0 lg:flex'}
            ${stripOpen ? 'flex' : 'hidden lg:flex'}`}
        >
          <div className="p-2 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 px-1">
              {presentation.slides.length} slides
            </span>
            <div className="flex items-center gap-1">
              <button onClick={addSlide} className="p-1 rounded text-slate-500 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/30 transition" title="Add slide">
                <Plus className="w-4 h-4" />
              </button>
              <button onClick={() => setStripOpen(false)} className="lg:hidden p-1 rounded text-slate-500 hover:text-slate-900 dark:hover:text-white transition" title="Close">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div ref={stripRef} className="flex-1 overflow-y-auto p-2 space-y-2 no-scrollbar">
            {presentation.slides.map((s, i) => (
              <div
                key={s.id}
                draggable={editing}
                onDragStart={() => onSlideDragStart(i)}
                onDragOver={(e) => onSlideDragOver(e, i)}
                onDrop={() => onSlideDrop(i)}
                onDragEnd={() => { dragSrcIdx.current = null; setDragOverIdx(null); }}
                className={`relative group ${dragOverIdx === i && dragSrcIdx.current !== null ? 'ring-2 ring-brand-400 rounded-lg' : ''}`}
              >
                <button
                  onClick={() => { setCurrentIdx(i); setSelectedElementId(null); setSelectedField(null); setStripOpen(false); }}
                  className={`relative w-full rounded-lg overflow-hidden border-2 transition block ${
                    i === currentIdx ? 'border-brand-400 shadow-glow' : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                  style={{ aspectRatio: '16 / 9' }}
                >
                  <div className="absolute top-1 left-1 z-10 text-[10px] font-mono font-semibold bg-slate-900/70 text-white rounded px-1 py-0.5">
                    {i + 1}
                  </div>
                  {editing && (
                    <div className="absolute top-1 right-1 z-10 text-slate-400/80 cursor-grab" title="Drag to reorder">
                      <GripVertical className="w-3 h-3" />
                    </div>
                  )}
                  <div className="absolute top-0 left-0 origin-top-left pointer-events-none" style={{ width: '425%', height: '425%', transform: 'scale(0.2353)' }}>
                    <SlideRenderer slide={s} settings={presentation.settings} />
                  </div>
                </button>
              </div>
            ))}
          </div>
        </aside>
        {/* Mobile backdrop for slide strip */}
        {stripOpen && (
          <div className="lg:hidden absolute inset-0 bg-black/30 z-10" onClick={() => setStripOpen(false)} />
        )}

        {/* Main canvas */}
        <main className="flex-1 flex flex-col overflow-hidden bg-slate-100 dark:bg-slate-950">
          <div className="flex-1 overflow-auto p-2 sm:p-4 lg:p-8">
            <div className="mx-auto" style={{ width: `min(${slideZoom}%, 100%)`, maxWidth: '1280px' }}>
              <div
                ref={slideFrameRef}
                className="slide-frame rounded-2xl shadow-card-lg overflow-hidden ring-1 ring-slate-200 dark:ring-slate-800 bg-white"
                onPointerDown={() => {
                  if (!editing) return;
                  // Clear selection on any pointer down that reaches the frame.
                  // Overlay elements call e.stopPropagation() so they won't reach here.
                  // ContentEditable fields re-select via onFocus after this fires.
                  setSelectedElementId(null);
                  setSelectedField(null);
                }}
              >
                <SlideRenderer
                  slide={slide}
                  settings={presentation.settings}
                  editable={editing}
                  onChange={updateSlide}
                  selectedElementId={selectedElementId}
                  onSelectElement={handleSelectElement}
                  onChangeElement={updateElement}
                  selectedField={selectedField}
                  onSelectField={handleSelectField}
                  onChangeFieldStyle={updateFieldStyle}
                />
              </div>
              {/* Slide controls */}
              <div className="mt-3 sm:mt-4 flex flex-wrap items-center justify-center gap-1.5 sm:gap-2">
                {/* + Add Text — the ONLY action that creates a new text box */}
                <button
                  onClick={addText}
                  disabled={!editing}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition"
                  title="Add a new text box"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Text</span>
                </button>

                <div className="flex items-center gap-1.5 sm:gap-2">
                  <button
                    onClick={() => setCurrentIdx(Math.max(0, currentIdx - 1))}
                    disabled={currentIdx === 0}
                    className="p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 disabled:opacity-40 transition"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <span className="text-xs font-mono text-slate-500 dark:text-slate-400 px-2">
                    {currentIdx + 1} / {presentation.slides.length}
                  </span>
                  <button
                    onClick={() => setCurrentIdx(Math.min(presentation.slides.length - 1, currentIdx + 1))}
                    disabled={currentIdx === presentation.slides.length - 1}
                    className="p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 disabled:opacity-40 transition"
                  >
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
                <div className="w-px h-5 bg-slate-300 dark:bg-slate-700 mx-0.5 hidden sm:block" />
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <button onClick={() => moveSlide(-1)} disabled={currentIdx === 0} className="p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 disabled:opacity-40 transition" title="Move up">
                    <ChevronUp className="w-4 h-4" />
                  </button>
                  <button onClick={() => moveSlide(1)} disabled={currentIdx === presentation.slides.length - 1} className="p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 disabled:opacity-40 transition" title="Move down">
                    <ChevronDown className="w-4 h-4" />
                  </button>
                  <button onClick={addSlide} className="p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 transition" title="Add slide">
                    <Plus className="w-4 h-4" />
                  </button>
                  <button onClick={duplicateSlide} className="p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 transition" title="Duplicate slide">
                    <Copy className="w-4 h-4" />
                  </button>
                  <button onClick={deleteSlide} disabled={presentation.slides.length <= 1} className="p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-900/30 disabled:opacity-40 transition" title="Delete slide">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="w-px h-5 bg-slate-300 dark:bg-slate-700 mx-0.5 hidden sm:block" />
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <button
                    onClick={() => setSlideZoom(Math.max(25, slideZoom - 25))}
                    className="p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 transition"
                    title="Zoom out"
                  >
                    <ZoomOut className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setSlideZoom(100)}
                    className="text-xs font-mono text-slate-500 dark:text-slate-400 px-2 hover:text-slate-900 dark:hover:text-white transition"
                    title="Reset zoom"
                  >
                    {slideZoom}%
                  </button>
                  <button
                    onClick={() => setSlideZoom(Math.min(200, slideZoom + 25))}
                    className="p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 transition"
                    title="Zoom in"
                  >
                    <ZoomIn className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </main>

        {/* Right panel — desktop: sidebar, mobile: full-width overlay */}
        {panel && (
          <>
          {/* Mobile backdrop */}
          <div className="lg:hidden absolute inset-0 bg-black/30 z-20" onClick={() => setPanel(null)} />
          <aside className="w-full sm:w-80 lg:w-80 shrink-0 border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 animate-slide-in overflow-hidden absolute lg:relative inset-y-0 right-0 z-30 lg:z-auto">
            {panel === 'chat' && (
              <AIChatPanel
                presentation={presentation}
                currentSlideIndex={currentIdx}
                selectedElementId={selectedElementId}
                onPresentationChange={commit}
                onClose={() => setPanel(null)}
              />
            )}
            {panel === 'ai' && (
              <AIPanel
                presentation={presentation}
                slide={slide}
                onSlideChange={updateSlide}
                onClose={() => setPanel(null)}
                initialTab={aiTab}
              />
            )}
            {panel === 'theme' && (
              <ThemePanel presentation={presentation} onSettingsChange={updateSettings} onClose={() => setPanel(null)} />
            )}
            {panel === 'export' && (
              <ExportPanel
                presentation={presentation}
                onExport={handleExport}
                exporting={exporting}
                onRegenerate={regenerateEntire}
                onClose={() => setPanel(null)}
              />
            )}
            {panel === 'properties' && editing && (
              <PropertiesPanel
                slide={slide}
                selectedElement={selectedElement || null}
                selectedElementId={selectedElementId}
                onElementChange={updateElement}
                onElementDuplicate={duplicateElement}
                onElementDelete={deleteElement}
                onElementBringForward={bringElementForward}
                onElementSendBackward={sendElementBackward}
                onBackgroundChange={changeBackground}
                onImageReplace={replaceImage}
                onImageCrop={startImageCrop}
                onImageUpload={uploadImage}
                onLogoUpload={uploadLogo}
                onRemoveSlideImage={() => updateSlide({ ...slide, image: undefined })}
                onAddText={addText}
                onAddShape={addShape}
                onClose={() => setPanel(null)}
                accent={presentation.settings.primaryColor}
              />
            )}
          </aside>
          </>
        )}
      </div>

      {/* Floating Canva-style text toolbar, positioned above the selected text element or field */}
      {toolbarPos && toolbarElement && editing && (
        <div
          className="fixed z-40 animate-fade-up"
          style={{ left: toolbarPos.left, top: toolbarPos.top }}
        >
          <FloatingTextToolbar
            element={toolbarElement}
            onChange={(patch) => applyTextFormat(patch)}
            onDetach={canDetachField ? detachSelectedField : undefined}
          />
        </div>
      )}

      {/* Image crop modal */}
      {cropMode && selectedElement && selectedElement.kind === 'image' && (
        <ImageCropModal
          imageUrl={(selectedElement as ImageElement).url}
          initialCrop={{ x: selectedElement.x, y: selectedElement.y, w: selectedElement.w, h: selectedElement.h }}
          onApply={applyCrop}
          onCancel={() => setCropMode(null)}
        />
      )}

      {/* Export error toast (replaces window.alert) */}
      {exportError && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 max-w-md w-full px-4 animate-fade-up">
          <div className="flex items-center gap-3 rounded-xl bg-red-600 text-white px-4 py-3 shadow-2xl">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <p className="text-sm flex-1">{exportError}</p>
            <button onClick={() => setExportError(null)} className="p-1 rounded hover:bg-white/20 transition" aria-label="Dismiss">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Theme switcher panel ──────────────────────────────────────────────────────

function ThemePanel({
  presentation, onSettingsChange, onClose,
}: {
  presentation: Presentation;
  onSettingsChange: (p: Partial<PresentationSettings>) => void;
  onClose: () => void;
}) {
  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-4 h-12 border-b border-slate-200 dark:border-slate-800 shrink-0">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
          <Palette className="w-4 h-4" /> Theme Switcher
        </div>
        <button onClick={onClose} className="p-1 rounded text-slate-400 hover:text-slate-900 dark:hover:text-white">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="flex-1 overflow-auto p-4 space-y-5">
        <div>
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">Themes</div>
          <div className="grid grid-cols-2 gap-2">
            {THEME_LIST.map((t) => {
              const active = presentation.settings.theme === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => onSettingsChange({ theme: t.id, primaryColor: t.primary, secondaryColor: t.secondary })}
                  className={`p-2.5 rounded-xl border text-left transition ${active ? 'border-brand-400 ring-2 ring-brand-200 dark:ring-brand-900' : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'}`}
                >
                  <div className="flex gap-1 mb-1.5">
                    <div className="w-4 h-4 rounded-full" style={{ background: t.primary }} />
                    <div className="w-4 h-4 rounded-full" style={{ background: t.secondary }} />
                    <div className="w-4 h-4 rounded-full" style={{ background: t.accent }} />
                  </div>
                  <div className="text-xs font-semibold text-slate-900 dark:text-white">{t.name}</div>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">Theme Color</div>
          <CustomColorInput
            label="One color styles the whole deck — secondary shade auto-matched"
            value={presentation.settings.primaryColor}
            onChange={(c) => {
              const color = c || '#06b6d4';
              onSettingsChange({ primaryColor: color, secondaryColor: shadeHex(color, -22) });
            }}
          />
        </div>

        <div>
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
            <Type className="w-3.5 h-3.5" /> Font
          </div>
          <select
            value={presentation.settings.fontFamily}
            onChange={(e) => onSettingsChange({ fontFamily: e.target.value as FontFamily })}
            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-400"
          >
            {FONT_OPTIONS.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </div>

        <div>
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">Background</div>
          <select
            value={presentation.settings.background}
            onChange={(e) => onSettingsChange({ background: e.target.value as BackgroundStyle })}
            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-400"
          >
            <option value="white">White</option>
            <option value="black">Black</option>
            <option value="blue">Blue</option>
            <option value="green">Green</option>
            <option value="purple">Purple</option>
            <option value="gradient">Gradient</option>
            <option value="abstract">Abstract Shapes</option>
            <option value="geometric">Geometric</option>
            <option value="glassmorphism">Glassmorphism</option>
            <option value="custom">Custom Color</option>
          </select>
        </div>

        <p className="text-xs text-slate-400 leading-relaxed">
          Switching themes updates the design instantly — your content stays the same.
        </p>
      </div>
    </div>
  );
}

// ── Export panel ──────────────────────────────────────────────────────────────

function ExportPanel({
  onExport, exporting, onRegenerate, onClose,
}: {
  presentation: Presentation;
  onExport: (format: 'pptx' | 'pdf') => void;
  exporting: 'pptx' | 'pdf' | null;
  onRegenerate: () => void;
  onClose: () => void;
}) {
  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-4 h-12 border-b border-slate-200 dark:border-slate-800 shrink-0">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
          <Download className="w-4 h-4" /> Export
        </div>
        <button onClick={onClose} className="p-1 rounded text-slate-400 hover:text-slate-900 dark:hover:text-white">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="flex-1 overflow-auto p-4 space-y-4">
        <button
          onClick={() => onExport('pptx')}
          disabled={exporting !== null}
          className="w-full flex items-center gap-3 p-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/20 disabled:opacity-50 transition text-left"
        >
          <div className="w-10 h-10 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
            {exporting === 'pptx' ? <Loader2 className="w-5 h-5 animate-spin text-orange-600" /> : <FileText className="w-5 h-5 text-orange-600" />}
          </div>
          <div>
            <div className="text-sm font-semibold text-slate-900 dark:text-white">PowerPoint (.pptx)</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">Editable in PowerPoint, Keynote, Google Slides</div>
          </div>
        </button>

        <button
          onClick={() => onExport('pdf')}
          disabled={exporting !== null}
          className="w-full flex items-center gap-3 p-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/20 disabled:opacity-50 transition text-left"
        >
          <div className="w-10 h-10 rounded-lg bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center">
            {exporting === 'pdf' ? <Loader2 className="w-5 h-5 animate-spin text-rose-600" /> : <FileImage className="w-5 h-5 text-rose-600" />}
          </div>
          <div>
            <div className="text-sm font-semibold text-slate-900 dark:text-white">PDF Document</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">Print-ready, preserves formatting</div>
          </div>
        </button>

        <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
            Regenerate Entire Presentation
          </div>
          <button
            onClick={onRegenerate}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-medium hover:opacity-90 transition"
          >
            <Wand2 className="w-4 h-4" /> Regenerate All Slides
          </button>
          <p className="mt-2 text-xs text-slate-400">
            Generates fresh content for every slide while keeping the layout structure.
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Present mode ─────────────────────────────────────────────────────────────

function PresentMode({
  presentation, idx, onExit, onIdx,
}: {
  presentation: Presentation;
  idx: number;
  onExit: () => void;
  onIdx: (i: number) => void;
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onExit();
      if (e.key === 'ArrowRight' || e.key === ' ') onIdx(Math.min(presentation.slides.length - 1, idx + 1));
      if (e.key === 'ArrowLeft') onIdx(Math.max(0, idx - 1));
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [idx, presentation.slides.length, onExit, onIdx]);

  return (
    <div className="fixed inset-0 bg-black z-50 flex items-center justify-center">
      <div className="w-full h-full max-w-[177vh] max-h-[100vh] mx-auto aspect-video">
        <SlideRenderer slide={presentation.slides[idx]} settings={presentation.settings} />
      </div>
      <button
        onClick={onExit}
        className="absolute top-4 right-4 p-2 rounded-lg bg-white/10 text-white hover:bg-white/20 transition"
      >
        <X className="w-5 h-5" />
      </button>
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 text-white text-sm">
        <button onClick={() => onIdx(Math.max(0, idx - 1))} className="p-1 hover:bg-white/10 rounded">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <span className="font-mono text-xs px-2">{idx + 1} / {presentation.slides.length}</span>
        <button onClick={() => onIdx(Math.min(presentation.slides.length - 1, idx + 1))} className="p-1 hover:bg-white/10 rounded">
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

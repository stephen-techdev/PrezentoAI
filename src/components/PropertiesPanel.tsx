import { useState, useRef } from 'react';
import {
  X, Type, Palette, Image as ImageIcon, Square, Circle, ArrowRight, Minus,
  AlignLeft, AlignCenter, AlignRight, AlignJustify, Bold, Italic, Underline,
  ChevronDown, ChevronUp, Trash2, Copy, Move, Scissors, Replace,
  Triangle, Star, Heart, Hexagon, Diamond, ZoomIn, ZoomOut, WrapText,
} from 'lucide-react';
import type {
  SlideElement, TextBoxElement, ShapeElement, ImageElement,
  ShapeKind, FontFamily, Slide, SlideBackground,
} from '../types';
import { FONT_OPTIONS, FONT_STACK } from '../themes';
import { DropdownPortal } from './DropdownPortal';

interface Props {
  slide: Slide;
  selectedElement: SlideElement | null;
  selectedElementId: string | null;
  onElementChange: (id: string, patch: Partial<SlideElement>) => void;
  onElementDuplicate: () => void;
  onElementDelete: () => void;
  onElementBringForward: () => void;
  onElementSendBackward: () => void;
  onBackgroundChange: (bg: SlideBackground) => void;
  onImageReplace: (file: File) => void;
  onImageCrop: () => void;
  onImageUpload: (file: File) => void;
  onLogoUpload: (file: File) => void;
  onRemoveSlideImage: () => void;
  onAddText: () => void;
  onAddShape: (shape: ShapeKind) => void;
  onClose: () => void;
  accent: string;
}

type Tab = 'element' | 'slide';

// ── Reusable custom color picker: presets + native picker + hex + recents ──

const COLOR_PRESETS = [
  '#0f172a', '#334155', '#64748b', '#ffffff',
  '#06b6d4', '#0891b2', '#6366f1', '#8b5cf6',
  '#ec4899', '#f43f5e', '#ef4444', '#f97316',
  '#fbbf24', '#84cc16', '#10b981', '#14b8a6',
  '#0ea5e9', '#1e3a8a', '#4c1d95', '#7c2d12',
];

function getRecentColors(): string[] {
  try {
    return JSON.parse(localStorage.getItem('prezento-recent-colors') || '[]');
  } catch {
    return [];
  }
}

function saveRecentColor(color: string) {
  try {
    const list = getRecentColors().filter((c) => c.toLowerCase() !== color.toLowerCase());
    localStorage.setItem('prezento-recent-colors', JSON.stringify([color, ...list].slice(0, 8)));
  } catch { /* ignore */ }
}

export function CustomColorInput({
  label,
  value,
  onChange,
  allowClear,
}: {
  label: string;
  value: string;
  onChange: (color: string | undefined) => void;
  allowClear?: boolean;
}) {
  const [recent, setRecent] = useState<string[]>(getRecentColors());
  const commit = (c: string | undefined) => {
    if (c && /^#[0-9a-fA-F]{6}$/.test(c)) {
      saveRecentColor(c);
      setRecent(getRecentColors());
    }
    onChange(c);
  };
  return (
    <div>
      <label className="text-[10px] text-slate-500 mb-1 block">{label}</label>
      <div className="flex items-center gap-2 mb-1.5">
        <input
          type="color"
          value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : '#0f172a'}
          onChange={(e) => commit(e.target.value)}
          className="w-8 h-8 rounded border border-slate-200 dark:border-slate-700 cursor-pointer bg-transparent shrink-0"
          title="Pick custom color"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => commit(e.target.value)}
          placeholder="#000000"
          spellCheck={false}
          className="flex-1 min-w-0 rounded border border-slate-200 dark:border-slate-700 bg-transparent px-2 py-1 text-xs font-mono text-slate-900 dark:text-white"
        />
        {allowClear && (
          <button
            onClick={() => onChange(undefined)}
            className="text-[10px] text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 shrink-0"
          >
            Clear
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-1">
        {COLOR_PRESETS.map((c) => (
          <button
            key={c}
            onClick={() => commit(c)}
            className={`w-5 h-5 rounded-full border transition hover:scale-110 ${value.toLowerCase() === c ? 'ring-2 ring-brand-400 border-transparent' : 'border-slate-200 dark:border-slate-700'}`}
            style={{ background: c }}
            title={c}
          />
        ))}
      </div>
      {recent.length > 0 && (
        <div className="mt-1.5">
          <div className="text-[9px] text-slate-400 mb-1">Recent</div>
          <div className="flex flex-wrap gap-1">
            {recent.map((c) => (
              <button
                key={c}
                onClick={() => commit(c)}
                className="w-5 h-5 rounded-full border border-dashed border-slate-300 dark:border-slate-600 hover:scale-110 transition"
                style={{ background: c }}
                title={c}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const SHAPE_OPTIONS: { kind: ShapeKind; icon: React.ReactNode; label: string }[] = [
  { kind: 'rectangle', icon: <Square className="w-4 h-4" />, label: 'Rectangle' },
  { kind: 'circle', icon: <Circle className="w-4 h-4" />, label: 'Circle' },
  { kind: 'triangle', icon: <Triangle className="w-4 h-4" />, label: 'Triangle' },
  { kind: 'star', icon: <Star className="w-4 h-4" />, label: 'Star' },
  { kind: 'heart', icon: <Heart className="w-4 h-4" />, label: 'Heart' },
  { kind: 'hexagon', icon: <Hexagon className="w-4 h-4" />, label: 'Hexagon' },
  { kind: 'diamond', icon: <Diamond className="w-4 h-4" />, label: 'Diamond' },
  { kind: 'arrow', icon: <ArrowRight className="w-4 h-4" />, label: 'Arrow' },
  { kind: 'line', icon: <Minus className="w-4 h-4" />, label: 'Line' },
];

export function PropertiesPanel({
  slide,
  selectedElement,
  selectedElementId,
  onElementChange,
  onElementDuplicate,
  onElementDelete,
  onElementBringForward,
  onElementSendBackward,
  onBackgroundChange,
  onImageReplace,
  onImageCrop,
  onImageUpload,
  onLogoUpload,
  onRemoveSlideImage,
  onAddText,
  onAddShape,
  onClose,
  accent,
}: Props) {
  const [tab, setTab] = useState<Tab>('element');
  const [fontMenu, setFontMenu] = useState(false);
  const [shapeMenu, setShapeMenu] = useState(false);
  const shapeBtnRef = useRef<HTMLButtonElement>(null);

  const isText = selectedElement?.kind === 'text';
  const isShape = selectedElement?.kind === 'shape';
  const isImage = selectedElement?.kind === 'image';

  return (
    <div className="h-full flex flex-col bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800">
      {/* Header */}
      <div className="flex items-center justify-between px-4 h-12 border-b border-slate-200 dark:border-slate-800 shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setTab('element')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              tab === 'element'
                ? 'bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            Element
          </button>
          <button
            onClick={() => setTab('slide')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              tab === 'slide'
                ? 'bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            Slide
          </button>
        </div>
        <button onClick={onClose} className="p-1 rounded text-slate-400 hover:text-slate-900 dark:hover:text-white">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {tab === 'element' && (
          <>
            {selectedElement ? (
              <div className="p-4 space-y-5">
                {/* Position & Size */}
                <PositionSizeSection
                  element={selectedElement}
                  onChange={(patch) => selectedElementId && onElementChange(selectedElementId, patch)}
                />

                {/* Element-specific controls */}
                {isText && selectedElement && (
                  <TextPropertiesSection
                    element={selectedElement as TextBoxElement}
                    onChange={(patch) => selectedElementId && onElementChange(selectedElementId, patch)}
                    fontMenu={fontMenu}
                    setFontMenu={setFontMenu}
                  />
                )}

                {isShape && selectedElement && (
                  <ShapePropertiesSection
                    element={selectedElement as ShapeElement}
                    onChange={(patch) => selectedElementId && onElementChange(selectedElementId, patch)}
                  />
                )}

                {isImage && selectedElement && (
                  <ImagePropertiesSection
                    element={selectedElement as ImageElement}
                    onChange={(patch) => selectedElementId && onElementChange(selectedElementId, patch)}
                    onReplace={onImageReplace}
                    onCrop={onImageCrop}
                  />
                )}

                {/* Actions */}
                <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-2">
                  <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-2">Actions</div>
                  <div className="grid grid-cols-4 gap-1">
                    <button
                      onClick={onElementDuplicate}
                      className="flex flex-col items-center gap-1 p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                      title="Duplicate"
                    >
                      <Copy className="w-4 h-4" />
                      <span className="text-[10px]">Duplicate</span>
                    </button>
                    <button
                      onClick={onElementBringForward}
                      className="flex flex-col items-center gap-1 p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                      title="Bring Forward"
                    >
                      <ChevronUp className="w-4 h-4" />
                      <span className="text-[10px]">Forward</span>
                    </button>
                    <button
                      onClick={onElementSendBackward}
                      className="flex flex-col items-center gap-1 p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                      title="Send Backward"
                    >
                      <ChevronDown className="w-4 h-4" />
                      <span className="text-[10px]">Backward</span>
                    </button>
                    <button
                      onClick={onElementDelete}
                      className="flex flex-col items-center gap-1 p-2 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30 transition"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span className="text-[10px]">Delete</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4">
                <div className="text-sm text-slate-500 dark:text-slate-400 text-center py-8">
                  Select an element to edit its properties
                </div>
                <div className="space-y-3">
                  <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Add New</div>
                  <button
                    onClick={onAddText}
                    className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                  >
                    <Type className="w-4 h-4" />
                    <span className="text-sm">Add text box</span>
                  </button>
                  {/* Upload image / logo from device */}
                  <label className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer">
                    <ImageIcon className="w-4 h-4" />
                    <span className="text-sm">Upload image</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) onImageUpload(f);
                        e.target.value = '';
                      }}
                    />
                  </label>
                  <label className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg border border-dashed border-brand-300 dark:border-brand-700 text-slate-700 dark:text-slate-200 hover:bg-brand-50 dark:hover:bg-brand-900/20 transition cursor-pointer">
                    <Star className="w-4 h-4 text-brand-500" />
                    <span className="text-sm">Upload logo <span className="text-[10px] text-slate-400">(pinned top-right)</span></span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) onLogoUpload(f);
                        e.target.value = '';
                      }}
                    />
                  </label>
                  <div className="relative">
                    <button
                      ref={shapeBtnRef}
                      onClick={() => setShapeMenu(!shapeMenu)}
                      className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                    >
                      <span className="flex items-center gap-2">
                        <Square className="w-4 h-4" />
                        <span className="text-sm">Add shape</span>
                      </span>
                      <ChevronDown className="w-4 h-4" />
                    </button>
                    <DropdownPortal open={shapeMenu} onClose={() => setShapeMenu(false)} anchorRef={shapeBtnRef} width={224}>
                      <div className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-card-lg">
                        <div className="grid grid-cols-3 gap-1">
                          {SHAPE_OPTIONS.map((opt) => (
                            <button
                              key={opt.kind}
                              onClick={() => { onAddShape(opt.kind); setShapeMenu(false); }}
                              className="flex flex-col items-center gap-1 p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                            >
                              {opt.icon}
                              <span className="text-[10px]">{opt.label}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    </DropdownPortal>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {tab === 'slide' && (
          <SlidePropertiesSection
            background={slide.background}
            slideImage={slide.image}
            onBackgroundChange={onBackgroundChange}
            onRemoveSlideImage={onRemoveSlideImage}
            accent={accent}
          />
        )}
      </div>
    </div>
  );
}

// ── Position & Size Section ──────────────────────────────────────────────────────

function PositionSizeSection({
  element,
  onChange,
}: {
  element: SlideElement;
  onChange: (patch: Partial<SlideElement>) => void;
}) {
  const xPercent = Math.round(element.x * 100);
  const yPercent = Math.round(element.y * 100);
  const wPercent = Math.round(element.w * 100);
  const hPercent = Math.round(element.h * 100);

  return (
    <div>
      <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
        <Move className="w-3.5 h-3.5" /> Position & Size
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] text-slate-500 mb-1 block">X (%)</label>
          <input
            type="number"
            min={0}
            max={100}
            step={1}
            value={xPercent}
            onChange={(e) => onChange({ x: Number(e.target.value) / 100 })}
            className="w-full rounded border border-slate-200 dark:border-slate-700 bg-transparent px-2 py-1.5 text-xs text-slate-900 dark:text-white"
          />
        </div>
        <div>
          <label className="text-[10px] text-slate-500 mb-1 block">Y (%)</label>
          <input
            type="number"
            min={0}
            max={100}
            step={1}
            value={yPercent}
            onChange={(e) => onChange({ y: Number(e.target.value) / 100 })}
            className="w-full rounded border border-slate-200 dark:border-slate-700 bg-transparent px-2 py-1.5 text-xs text-slate-900 dark:text-white"
          />
        </div>
        <div>
          <label className="text-[10px] text-slate-500 mb-1 block">Width (%)</label>
          <input
            type="number"
            min={4}
            max={100}
            step={1}
            value={wPercent}
            onChange={(e) => onChange({ w: Number(e.target.value) / 100 })}
            className="w-full rounded border border-slate-200 dark:border-slate-700 bg-transparent px-2 py-1.5 text-xs text-slate-900 dark:text-white"
          />
        </div>
        <div>
          <label className="text-[10px] text-slate-500 mb-1 block">Height (%)</label>
          <input
            type="number"
            min={4}
            max={100}
            step={1}
            value={hPercent}
            onChange={(e) => onChange({ h: Number(e.target.value) / 100 })}
            className="w-full rounded border border-slate-200 dark:border-slate-700 bg-transparent px-2 py-1.5 text-xs text-slate-900 dark:text-white"
          />
        </div>
      </div>
      <div className="mt-2">
        <label className="text-[10px] text-slate-500 mb-1 block">Rotation (°)</label>
        <input
          type="range"
          min={-180}
          max={180}
          value={element.rotation || 0}
          onChange={(e) => onChange({ rotation: Number(e.target.value) })}
          className="w-full"
        />
        <div className="flex justify-between text-[10px] text-slate-400">
          <span>-180°</span>
          <span className="font-mono">{element.rotation || 0}°</span>
          <span>180°</span>
        </div>
      </div>
    </div>
  );
}

// ── Text Properties Section ─────────────────────────────────────────────────────

function TextPropertiesSection({
  element,
  onChange,
  fontMenu,
  setFontMenu,
}: {
  element: TextBoxElement;
  onChange: (patch: Partial<TextBoxElement>) => void;
  fontMenu: boolean;
  setFontMenu: (v: boolean) => void;
}) {
  const fontBtnRef = useRef<HTMLButtonElement>(null);

  return (
    <div className="space-y-4">
      {/* Typography */}
      <div>
        <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
          <Type className="w-3.5 h-3.5" /> Typography
        </div>

        {/* Font family */}
        <div className="relative mb-2">
          <button
            ref={fontBtnRef}
            onClick={() => setFontMenu(!fontMenu)}
            className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-700 dark:text-slate-200 hover:border-slate-300 dark:hover:border-slate-600 transition"
          >
            <span style={{ fontFamily: FONT_STACK[element.fontFamily || 'inter'] }}>
              {FONT_OPTIONS.find((f) => f.id === element.fontFamily)?.name || 'Select font'}
            </span>
            <ChevronDown className="w-4 h-4" />
          </button>
          <DropdownPortal open={fontMenu} onClose={() => setFontMenu(false)} anchorRef={fontBtnRef} width={224}>
            <div className="max-h-48 overflow-auto rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-card-lg">
              {FONT_OPTIONS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => { onChange({ fontFamily: f.id as FontFamily }); setFontMenu(false); }}
                  className={`w-full px-3 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800 ${
                    element.fontFamily === f.id ? 'bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300' : 'text-slate-700 dark:text-slate-200'
                  }`}
                  style={{ fontFamily: f.sample }}
                >
                  {f.name}
                </button>
              ))}
            </div>
          </DropdownPortal>
        </div>

        {/* Font size */}
        <div className="flex items-center gap-2 mb-2">
          <label className="text-[10px] text-slate-500 w-12">Size</label>
          <div className="flex items-center gap-1 flex-1">
            <button
              onClick={() => onChange({ fontSize: Math.max(8, (element.fontSize || 24) - 2) })}
              className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <input
              type="number"
              min={8}
              max={120}
              value={element.fontSize || 24}
              onChange={(e) => onChange({ fontSize: Math.max(8, Math.min(120, Number(e.target.value) || 24)) })}
              className="flex-1 rounded border border-slate-200 dark:border-slate-700 bg-transparent px-2 py-1 text-xs text-center text-slate-900 dark:text-white"
            />
            <button
              onClick={() => onChange({ fontSize: Math.min(120, (element.fontSize || 24) + 2) })}
              className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Bold, Italic, Underline */}
        <div className="flex items-center gap-1 mb-2">
          <button
            onClick={() => onChange({ bold: !element.bold })}
            className={`p-2 rounded-lg transition ${element.bold ? 'bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
            title="Bold"
          >
            <Bold className="w-4 h-4" />
          </button>
          <button
            onClick={() => onChange({ italic: !element.italic })}
            className={`p-2 rounded-lg transition ${element.italic ? 'bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
            title="Italic"
          >
            <Italic className="w-4 h-4" />
          </button>
          <button
            onClick={() => onChange({ underline: !element.underline })}
            className={`p-2 rounded-lg transition ${element.underline ? 'bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
            title="Underline"
          >
            <Underline className="w-4 h-4" />
          </button>
        </div>

        {/* Alignment */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => onChange({ align: 'left' })}
            className={`p-2 rounded-lg transition ${(element.align === 'left' || !element.align) ? 'bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
            title="Align left"
          >
            <AlignLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => onChange({ align: 'center' })}
            className={`p-2 rounded-lg transition ${element.align === 'center' ? 'bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
            title="Align center"
          >
            <AlignCenter className="w-4 h-4" />
          </button>
          <button
            onClick={() => onChange({ align: 'right' })}
            className={`p-2 rounded-lg transition ${element.align === 'right' ? 'bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
            title="Align right"
          >
            <AlignRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => onChange({ align: 'justify' })}
            className={`p-2 rounded-lg transition ${element.align === 'justify' ? 'bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
            title="Justify"
          >
            <AlignJustify className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Colors */}
      <div>
        <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
          <Palette className="w-3.5 h-3.5" /> Colors
        </div>
        <div className="grid grid-cols-1 gap-3">
          <CustomColorInput label="Text" value={element.color || '#0f172a'} onChange={(c) => onChange({ color: c || '#0f172a' })} />
          <CustomColorInput label="Background" value={element.background || '#ffffff'} onChange={(c) => onChange({ background: c })} allowClear />
        </div>
      </div>

      {/* Border radius */}
      <div>
        <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-2">Corner Radius</div>
        <input
          type="range"
          min={0}
          max={32}
          value={element.borderRadius || 0}
          onChange={(e) => onChange({ borderRadius: Number(e.target.value) })}
          className="w-full"
        />
        <div className="flex justify-between text-[10px] text-slate-400">
          <span>0px</span>
          <span className="font-mono">{element.borderRadius || 0}px</span>
          <span>32px</span>
        </div>
      </div>

      {/* Spacing */}
      <SpacingSection element={element} onChange={onChange} />
    </div>
  );
}

// ── Spacing Section ─────────────────────────────────────────────────────────

function SpacingSection({
  element, onChange,
}: {
  element: TextBoxElement;
  onChange: (patch: Partial<TextBoxElement>) => void;
}) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const LINE_HEIGHTS = [1.0, 1.15, 1.25, 1.5, 1.75, 2.0];

  return (
    <div>
      <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
        <WrapText className="w-3.5 h-3.5" /> Spacing
      </div>
      <button
        ref={btnRef}
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-700 dark:text-slate-200 hover:border-slate-300 dark:hover:border-slate-600 transition"
      >
        <span>Line {element.lineHeight ?? 1.5} · Letter {element.letterSpacing ?? 0}px · Para {element.paragraphSpacing ?? 0}px</span>
        <ChevronDown className="w-4 h-4" />
      </button>
      <DropdownPortal open={open} onClose={() => setOpen(false)} anchorRef={btnRef} width={240}>
        <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-card-lg space-y-4">
          {/* Line height */}
          <div>
            <label className="text-[10px] font-semibold text-slate-500 uppercase mb-1.5 block">Line Spacing</label>
            <div className="flex flex-wrap gap-1">
              {LINE_HEIGHTS.map((lh) => (
                <button
                  key={lh}
                  onClick={() => onChange({ lineHeight: lh })}
                  className={`px-2 py-1 rounded text-xs font-mono transition ${(element.lineHeight ?? 1.5) === lh ? 'bg-brand-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
                >
                  {lh.toFixed(2)}
                </button>
              ))}
            </div>
          </div>
          {/* Letter spacing */}
          <div>
            <label className="text-[10px] font-semibold text-slate-500 uppercase mb-1.5 block">Letter Spacing</label>
            <div className="flex items-center gap-2">
              <button
                onClick={() => onChange({ letterSpacing: Math.max(-5, (element.letterSpacing ?? 0) - 0.5) })}
                className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <input
                type="number"
                min={-5}
                max={20}
                step={0.5}
                value={element.letterSpacing ?? 0}
                onChange={(e) => onChange({ letterSpacing: Math.max(-5, Math.min(20, Number(e.target.value) || 0)) })}
                className="flex-1 rounded border border-slate-200 dark:border-slate-700 bg-transparent px-2 py-1 text-xs text-center text-slate-900 dark:text-white"
              />
              <button
                onClick={() => onChange({ letterSpacing: Math.min(20, (element.letterSpacing ?? 0) + 0.5) })}
                className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          {/* Paragraph spacing */}
          <div>
            <label className="text-[10px] font-semibold text-slate-500 uppercase mb-1.5 block">Paragraph Spacing</label>
            <div className="flex items-center gap-2">
              <button
                onClick={() => onChange({ paragraphSpacing: Math.max(0, (element.paragraphSpacing ?? 0) - 2) })}
                className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <input
                type="number"
                min={0}
                max={48}
                step={1}
                value={element.paragraphSpacing ?? 0}
                onChange={(e) => onChange({ paragraphSpacing: Math.max(0, Math.min(48, Number(e.target.value) || 0)) })}
                className="flex-1 rounded border border-slate-200 dark:border-slate-700 bg-transparent px-2 py-1 text-xs text-center text-slate-900 dark:text-white"
              />
              <button
                onClick={() => onChange({ paragraphSpacing: Math.min(48, (element.paragraphSpacing ?? 0) + 2) })}
                className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </DropdownPortal>
    </div>
  );
}

// ── Shape Properties Section ───────────────────────────────────────────────────

function ShapePropertiesSection({
  element,
  onChange,
}: {
  element: ShapeElement;
  onChange: (patch: Partial<ShapeElement>) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
          <Palette className="w-3.5 h-3.5" /> Fill & Stroke
        </div>
        <div className="grid grid-cols-1 gap-3 mb-2">
          <CustomColorInput label="Fill" value={element.fill || '#06b6d4'} onChange={(c) => onChange({ fill: c || '#06b6d4' })} />
          <CustomColorInput label="Stroke" value={element.stroke || '#0f172a'} onChange={(c) => onChange({ stroke: c || '#0f172a' })} />
        </div>
        <div>
          <label className="text-[10px] text-slate-500 mb-1 block">Stroke Width</label>
          <input
            type="range"
            min={1}
            max={20}
            value={element.strokeWidth || 2}
            onChange={(e) => onChange({ strokeWidth: Number(e.target.value) })}
            className="w-full"
          />
          <div className="flex justify-between text-[10px] text-slate-400">
            <span>1px</span>
            <span className="font-mono">{element.strokeWidth || 2}px</span>
            <span>20px</span>
          </div>
        </div>
      </div>

      {/* Quick colors */}
      <div>
        <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-2">Quick Colors</div>
        <div className="flex flex-wrap gap-1.5">
          {['#06b6d4', '#6366f1', '#8b5cf6', '#ec4899', '#f97316', '#10b981', '#fbbf24', '#ef4444', '#0f172a', '#ffffff'].map((c) => (
            <button
              key={c}
              onClick={() => onChange({ fill: c })}
              className="w-6 h-6 rounded-full border border-slate-200 dark:border-slate-700 hover:ring-2 ring-brand-400 transition"
              style={{ background: c }}
              title={c}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Image Properties Section ──────────────────────────────────────────────────

function ImagePropertiesSection({
  element,
  onChange,
  onReplace,
  onCrop,
}: {
  element: ImageElement;
  onChange: (patch: Partial<ImageElement>) => void;
  onReplace: (file: File) => void;
  onCrop: () => void;
}) {
  return (
    <div className="space-y-4">
      {/* Image preview */}
      <div>
        <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
          <ImageIcon className="w-3.5 h-3.5" /> Image
        </div>
        <div className="aspect-video rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-800 mb-2">
          <img src={element.url} alt={element.alt || ''} className="w-full h-full object-contain" />
        </div>
        <div className="flex gap-2">
          <label className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer">
            <Replace className="w-4 h-4" />
            <span className="text-xs">Replace</span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onReplace(f);
                e.target.value = '';
              }}
            />
          </label>
          <button
            onClick={onCrop}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
          >
            <Scissors className="w-4 h-4" />
            <span className="text-xs">Crop</span>
          </button>
        </div>
      </div>

      {/* Fit & Opacity */}
      <div>
        <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-2">Fit & Opacity</div>
        <div className="mb-2">
          <label className="text-[10px] text-slate-500 mb-1 block">Object Fit</label>
          <select
            value={element.objectFit || 'cover'}
            onChange={(e) => onChange({ objectFit: e.target.value as 'cover' | 'contain' })}
            className="w-full rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1.5 text-xs text-slate-900 dark:text-white"
          >
            <option value="cover">Cover</option>
            <option value="contain">Contain</option>
          </select>
        </div>
        <div>
          <label className="text-[10px] text-slate-500 mb-1 block">Opacity</label>
          <input
            type="range"
            min={0}
            max={100}
            value={(element.opacity ?? 1) * 100}
            onChange={(e) => onChange({ opacity: Number(e.target.value) / 100 })}
            className="w-full"
          />
          <div className="flex justify-between text-[10px] text-slate-400">
            <span>0%</span>
            <span className="font-mono">{Math.round((element.opacity ?? 1) * 100)}%</span>
            <span>100%</span>
          </div>
        </div>
      </div>

      {/* Border radius */}
      <div>
        <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-2">Corner Radius</div>
        <input
          type="range"
          min={0}
          max={64}
          value={element.borderRadius || 0}
          onChange={(e) => onChange({ borderRadius: Number(e.target.value) })}
          className="w-full"
        />
        <div className="flex justify-between text-[10px] text-slate-400">
          <span>0px</span>
          <span className="font-mono">{element.borderRadius || 0}px</span>
          <span>64px</span>
        </div>
      </div>
    </div>
  );
}

// ── Slide Properties Section ──────────────────────────────────────────────────

// ── Slide Properties Section ──────────────────────────────────────────────────

function SolidBackgroundPicker({
  onBackgroundChange,
}: {
  onBackgroundChange: (bg: SlideBackground) => void;
}) {
  const [hex, setHex] = useState('#ffffff');
  const [recent, setRecent] = useState<string[]>(getRecentColors());
  const apply = (c: string) => {
    onBackgroundChange({ type: 'solid', color: c });
    saveRecentColor(c);
    setRecent(getRecentColors());
  };
  return (
    <div className="mb-1">
      <div className="flex items-center gap-2 mb-1.5">
        <input
          type="color"
          value={/^#[0-9a-fA-F]{6}$/.test(hex) ? hex : '#ffffff'}
          onChange={(e) => { setHex(e.target.value); apply(e.target.value); }}
          className="w-8 h-8 rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer bg-transparent shrink-0"
          title="Pick any custom color"
        />
        <input
          type="text"
          value={hex}
          onChange={(e) => setHex(e.target.value)}
          onBlur={() => { if (/^#[0-9a-fA-F]{6}$/.test(hex)) apply(hex); }}
          onKeyDown={(e) => { if (e.key === 'Enter' && /^#[0-9a-fA-F]{6}$/.test(hex)) apply(hex); }}
          placeholder="#000000"
          spellCheck={false}
          className="flex-1 min-w-0 rounded border border-slate-200 dark:border-slate-700 bg-transparent px-2 py-1 text-xs font-mono"
        />
      </div>
      <div className="flex flex-wrap gap-1.5">
        {[...COLOR_PRESETS, ...recent.filter((c) => !COLOR_PRESETS.includes(c.toLowerCase()))].slice(0, 28).map((c) => (
          <button
            key={c}
            onClick={() => apply(c)}
            className="w-8 h-8 rounded-lg border border-slate-200 dark:border-slate-700 hover:ring-2 ring-brand-400 transition"
            style={{ background: c }}
            title={c}
          />
        ))}
      </div>
    </div>
  );
}

function GradientBackgroundPicker({
  onBackgroundChange,
}: {
  onBackgroundChange: (bg: SlideBackground) => void;
}) {
  const [from, setFrom] = useState('#06b6d4');
  const [to, setTo] = useState('#6366f1');
  const [angle, setAngle] = useState(135);
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-2.5 space-y-2">
      <div
        className="h-12 rounded-lg border border-slate-200 dark:border-slate-700"
        style={{ background: `linear-gradient(${angle}deg, ${from}, ${to})` }}
      />
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] text-slate-500 mb-1 block">From</label>
          <div className="flex items-center gap-1.5">
            <input type="color" value={from} onChange={(e) => setFrom(e.target.value)} className="w-7 h-7 rounded cursor-pointer bg-transparent" />
            <input type="text" value={from} onChange={(e) => setFrom(e.target.value)} spellCheck={false} className="flex-1 min-w-0 rounded border border-slate-200 dark:border-slate-700 bg-transparent px-1.5 py-1 text-[11px] font-mono" />
          </div>
        </div>
        <div>
          <label className="text-[10px] text-slate-500 mb-1 block">To</label>
          <div className="flex items-center gap-1.5">
            <input type="color" value={to} onChange={(e) => setTo(e.target.value)} className="w-7 h-7 rounded cursor-pointer bg-transparent" />
            <input type="text" value={to} onChange={(e) => setTo(e.target.value)} spellCheck={false} className="flex-1 min-w-0 rounded border border-slate-200 dark:border-slate-700 bg-transparent px-1.5 py-1 text-[11px] font-mono" />
          </div>
        </div>
      </div>
      <div>
        <label className="text-[10px] text-slate-500 mb-1 block">Angle: {angle}°</label>
        <input type="range" min={0} max={360} value={angle} onChange={(e) => setAngle(Number(e.target.value))} className="w-full" />
      </div>
      <button
        onClick={() => onBackgroundChange({ type: 'gradient', from, to, angle })}
        className="w-full px-3 py-2 rounded-lg bg-brand-500 text-white text-xs font-medium hover:bg-brand-600 transition"
      >
        Apply Gradient
      </button>
    </div>
  );
}

function patternPreview(pattern: 'dots' | 'grid' | 'lines' | 'blobs'): React.CSSProperties {
  const dot = 'rgba(100,116,139,0.55)';
  switch (pattern) {
    case 'dots':
      return { backgroundImage: `radial-gradient(${dot} 1.2px, transparent 1.3px)`, backgroundSize: '10px 10px' };
    case 'grid':
      return { backgroundImage: `linear-gradient(${dot} 1px, transparent 1px), linear-gradient(90deg, ${dot} 1px, transparent 1px)`, backgroundSize: '12px 12px' };
    case 'lines':
      return { backgroundImage: `repeating-linear-gradient(135deg, rgba(100,116,139,0.25) 0 2px, transparent 2px 8px)` };
    case 'blobs':
      return { background: 'radial-gradient(circle at 25% 30%, rgba(6,182,212,0.5), transparent 55%), radial-gradient(circle at 75% 70%, rgba(99,102,241,0.5), transparent 55%)' };
  }
}

function SlidePropertiesSection({
  background,
  slideImage,
  onBackgroundChange,
  onRemoveSlideImage,
}: {
  background?: SlideBackground;
  slideImage?: { url: string; alt: string } | null;
  onBackgroundChange: (bg: SlideBackground) => void;
  onRemoveSlideImage: () => void;
  accent?: string;
}) {
  const base: SlideBackground = background?.type === 'gradient'
    ? { type: 'gradient', from: background.from || '#06b6d4', to: background.to || '#6366f1', angle: background.angle ?? 135, pattern: background.pattern, imageUrl: background.imageUrl }
    : { type: 'solid', color: background?.color || '#ffffff', pattern: background?.pattern, imageUrl: background?.imageUrl };
  const setPattern = (pattern: SlideBackground['pattern']) => onBackgroundChange({ ...base, pattern });
  const uploadBgImage = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => onBackgroundChange({ ...base, imageUrl: reader.result as string });
    reader.readAsDataURL(file);
  };
  return (
    <div className="p-4 space-y-4">
      <div>
        <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
          <Palette className="w-3.5 h-3.5" /> Slide Background
        </div>

        {/* Solid colors */}
        <div className="text-[10px] text-slate-500 mb-1.5">Solid Colors</div>
        <SolidBackgroundPicker onBackgroundChange={onBackgroundChange} />
        <div className="text-[10px] text-slate-500 mb-1.5 mt-3">Custom Gradient</div>
        <GradientBackgroundPicker onBackgroundChange={onBackgroundChange} />

        {/* Designs: patterns */}
        <div className="text-[10px] text-slate-500 mb-1.5 mt-3">Designs</div>
        <div className="grid grid-cols-5 gap-1.5 mb-3">
          {([
            { id: 'none', label: 'None' },
            { id: 'dots', label: 'Dots' },
            { id: 'grid', label: 'Grid' },
            { id: 'lines', label: 'Lines' },
            { id: 'blobs', label: 'Blobs' },
          ] as const).map((p) => (
            <button
              key={p.id}
              onClick={() => setPattern(p.id === 'none' ? undefined : p.id)}
              title={p.label}
              className={`h-10 rounded-lg border text-[10px] font-medium transition ${(base.pattern || 'none') === p.id ? 'border-brand-500 ring-2 ring-brand-300 text-brand-700 dark:text-brand-300' : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:border-brand-300'} ${p.id === 'none' ? '' : 'bg-slate-50 dark:bg-slate-800'}`}
              style={p.id === 'none' ? undefined : patternPreview(p.id)}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Custom background image */}
        <div className="text-[10px] text-slate-500 mb-1.5">Custom Image</div>
        {base.imageUrl ? (
          <div className="space-y-2">
            <div className="h-20 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700">
              <img src={base.imageUrl} alt="" className="w-full h-full object-cover" />
            </div>
            <button
              onClick={() => onBackgroundChange({ ...base, imageUrl: undefined })}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition"
            >
              Remove image
            </button>
          </div>
        ) : (
          <label className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border border-dashed border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:border-brand-400 hover:text-brand-600 transition cursor-pointer text-xs">
            <ImageIcon className="w-4 h-4" /> Upload background image
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) uploadBgImage(f);
                e.target.value = '';
              }}
            />
          </label>
        )}

        {/* Gradients */}
        <div className="text-[10px] text-slate-500 mb-1.5">Gradients</div>
        <div className="grid grid-cols-2 gap-1.5">
          {[
            { from: '#06b6d4', to: '#6366f1', angle: 135 },
            { from: '#f97316', to: '#ec4899', angle: 135 },
            { from: '#10b981', to: '#0ea5e9', angle: 135 },
            { from: '#8b5cf6', to: '#ec4899', angle: 135 },
            { from: '#0f172a', to: '#1e3a8a', angle: 135 },
            { from: '#fbbf24', to: '#f97316', angle: 135 },
            { from: '#ef4444', to: '#f97316', angle: 135 },
            { from: '#6366f1', to: '#8b5cf6', angle: 135 },
          ].map((g, i) => (
            <button
              key={i}
              onClick={() => onBackgroundChange({ type: 'gradient', from: g.from, to: g.to, angle: g.angle })}
              className="h-10 rounded-lg border border-slate-200 dark:border-slate-700 hover:ring-2 ring-brand-400 transition"
              style={{ background: `linear-gradient(${g.angle}deg, ${g.from}, ${g.to})` }}
            />
          ))}
        </div>
      </div>

      {/* Slide image (added by default — remove per slide here) */}
      <div>
        <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
          <ImageIcon className="w-3.5 h-3.5" /> Slide Image
        </div>
        {slideImage?.url ? (
          <div className="space-y-2">
            <div className="h-20 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700">
              <img src={slideImage.url} alt="" className="w-full h-full object-cover" />
            </div>
            <button
              onClick={onRemoveSlideImage}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition"
            >
              Remove image from this slide
            </button>
          </div>
        ) : (
          <p className="text-xs text-slate-400">No image on this slide. Images are added automatically at generation.</p>
        )}
      </div>

      {/* Transparent */}
      <div>
        <button
          onClick={() => onBackgroundChange({ type: 'solid', color: 'transparent' })}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
          style={{ background: 'repeating-conic-gradient(#808080 0% 25%, #fff 0% 50%) 50% / 12px 12px' }}
        >
          <span className="text-xs bg-white dark:bg-slate-900 px-1 rounded">Transparent</span>
        </button>
      </div>
    </div>
  );
}

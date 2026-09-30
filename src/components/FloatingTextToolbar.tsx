import { useState, useRef } from 'react';
import {
  Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight, AlignJustify,
  Type, ChevronDown, ZoomIn, ZoomOut, WrapText, Move,
} from 'lucide-react';
import type { TextBoxElement, FontFamily } from '../types';
import { FONT_OPTIONS, FONT_STACK } from '../themes';
import { DropdownPortal } from './DropdownPortal';

interface Props {
  element: TextBoxElement;
  onChange: (patch: Partial<TextBoxElement>) => void;
  /** When set (template text selected), detaches the text into a free
   * floating box that can be dragged anywhere like Canva. */
  onDetach?: () => void;
}

const LINE_HEIGHT_PRESETS = [1.0, 1.15, 1.25, 1.5, 1.75, 2.0, 2.5, 3.0, 4.0, 5.0];

export function FloatingTextToolbar({ element, onChange, onDetach }: Props) {
  const [fontMenu, setFontMenu] = useState(false);
  const [spacingOpen, setSpacingOpen] = useState(false);
  const fontBtnRef = useRef<HTMLButtonElement>(null);
  const spacingBtnRef = useRef<HTMLButtonElement>(null);

  const fontSize = element.fontSize ?? 24;
  const currentSize = String(fontSize);

  return (
    <div
      // Prevent the contentEditable from blurring (and committing) when the
      // user clicks a toolbar control mid-edit.
      onMouseDown={(e) => e.preventDefault()}
      className="flex items-center gap-0.5 px-1.5 py-1 rounded-xl glass-strong border border-slate-200 dark:border-slate-700 shadow-card-lg"
    >
      {/* Font family */}
      <button
        ref={fontBtnRef}
        onClick={() => setFontMenu(!fontMenu)}
        className="inline-flex items-center gap-1 h-7 px-2 rounded-lg text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition max-w-[120px] truncate"
        title="Font family"
      >
        <Type className="w-3.5 h-3.5 shrink-0" />
        <span className="truncate" style={{ fontFamily: FONT_STACK[element.fontFamily || 'inter'] }}>
          {FONT_OPTIONS.find((f) => f.id === element.fontFamily)?.name?.split(' ')[0] || 'Font'}
        </span>
        <ChevronDown className="w-3 h-3 shrink-0" />
      </button>
      <DropdownPortal open={fontMenu} onClose={() => setFontMenu(false)} anchorRef={fontBtnRef} width={176}>
        <div className="max-h-56 overflow-auto rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-card-lg py-1">
          {FONT_OPTIONS.map((f) => (
            <button
              key={f.id}
              onClick={() => { onChange({ fontFamily: f.id as FontFamily }); setFontMenu(false); }}
              className={`w-full px-3 py-1.5 text-xs text-left hover:bg-slate-100 dark:hover:bg-slate-800 ${element.fontFamily === f.id ? 'text-brand-600 dark:text-brand-300 font-semibold' : 'text-slate-700 dark:text-slate-200'}`}
              style={{ fontFamily: f.sample }}
            >
              {f.name}
            </button>
          ))}
        </div>
      </DropdownPortal>

      {/* Font size: [-] N [+] */}
      <div className="flex items-center gap-0.5">
        <button
          onClick={() => onChange({ fontSize: Math.max(8, fontSize - 2) })}
          className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          title="Decrease font size"
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </button>
        <input
          key={currentSize}
          type="number"
          min={8}
          max={120}
          defaultValue={currentSize}
          onChange={(e) => {
            const v = Number(e.target.value);
            if (!Number.isNaN(v)) onChange({ fontSize: Math.max(8, Math.min(120, v)) });
          }}
          className="w-10 h-7 rounded-md border border-slate-200 dark:border-slate-700 bg-transparent px-1 text-xs text-center text-slate-900 dark:text-white"
          title="Font size"
        />
        <button
          onClick={() => onChange({ fontSize: Math.min(120, fontSize + 2) })}
          className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          title="Increase font size"
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="w-px h-5 bg-slate-200 dark:bg-slate-700" />

      {/* Bold / Italic / Underline */}
      <button
        onClick={() => onChange({ bold: !element.bold })}
        className={`p-1.5 rounded-lg transition ${element.bold ? 'bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
        title="Bold"
      >
        <Bold className="w-3.5 h-3.5" />
      </button>
      <button
        onClick={() => onChange({ italic: !element.italic })}
        className={`p-1.5 rounded-lg transition ${element.italic ? 'bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
        title="Italic"
      >
        <Italic className="w-3.5 h-3.5" />
      </button>
      <button
        onClick={() => onChange({ underline: !element.underline })}
        className={`p-1.5 rounded-lg transition ${element.underline ? 'bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
        title="Underline"
      >
        <Underline className="w-3.5 h-3.5" />
      </button>

      <div className="w-px h-5 bg-slate-200 dark:bg-slate-700" />

      {/* Color */}
      <label
        className="relative inline-flex items-center justify-center w-7 h-7 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
        title="Text color"
      >
        <span
          className="w-3.5 h-3.5 rounded-sm border border-slate-300 dark:border-slate-600"
          style={{ background: element.color || '#0f172a' }}
        />
        <input
          type="color"
          value={element.color || '#0f172a'}
          onChange={(e) => onChange({ color: e.target.value })}
          className="absolute inset-0 opacity-0 cursor-pointer"
        />
      </label>

      <div className="w-px h-5 bg-slate-200 dark:bg-slate-700" />

      {/* Alignment */}
      <button
        onClick={() => onChange({ align: 'left' })}
        className={`p-1.5 rounded-lg transition ${(element.align === 'left' || !element.align) ? 'bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
        title="Align left"
      >
        <AlignLeft className="w-3.5 h-3.5" />
      </button>
      <button
        onClick={() => onChange({ align: 'center' })}
        className={`p-1.5 rounded-lg transition ${element.align === 'center' ? 'bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
        title="Align center"
      >
        <AlignCenter className="w-3.5 h-3.5" />
      </button>
      <button
        onClick={() => onChange({ align: 'right' })}
        className={`p-1.5 rounded-lg transition ${element.align === 'right' ? 'bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
        title="Align right"
      >
        <AlignRight className="w-3.5 h-3.5" />
      </button>
      <button
        onClick={() => onChange({ align: 'justify' })}
        className={`p-1.5 rounded-lg transition ${element.align === 'justify' ? 'bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
        title="Justify"
      >
        <AlignJustify className="w-3.5 h-3.5" />
      </button>

      <div className="w-px h-5 bg-slate-200 dark:bg-slate-700" />

      {/* Spacing */}
      <button
        ref={spacingBtnRef}
        onClick={() => setSpacingOpen(!spacingOpen)}
        className="inline-flex items-center gap-1 h-7 px-2 rounded-lg text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
        title="Spacing"
      >
        <WrapText className="w-3.5 h-3.5" />
        <ChevronDown className="w-3 h-3" />
      </button>
      {/* Detach into a free floating box (Canva-style move) */}
      {onDetach && (
        <>
          <div className="w-px h-5 bg-slate-200 dark:bg-slate-700" />
          <button
            onClick={onDetach}
            className="inline-flex items-center gap-1 h-7 px-2 rounded-lg text-xs text-brand-700 dark:text-brand-300 hover:bg-brand-50 dark:hover:bg-brand-900/30 transition whitespace-nowrap"
            title="Detach into a free text box you can drag anywhere on the slide"
          >
            <Move className="w-3.5 h-3.5" />
            Move freely
          </button>
        </>
      )}
      <DropdownPortal open={spacingOpen} onClose={() => setSpacingOpen(false)} anchorRef={spacingBtnRef} width={248}>
        <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-card-lg space-y-4">
          {/* Line spacing */}
          <div>
            <label className="text-[10px] font-semibold text-slate-500 uppercase mb-1.5 block">Line Spacing</label>
            <div className="flex flex-wrap gap-1 mb-1.5">
              {LINE_HEIGHT_PRESETS.map((lh) => (
                <button
                  key={lh}
                  onClick={() => onChange({ lineHeight: lh })}
                  className={`px-2 py-1 rounded text-xs font-mono transition ${(element.lineHeight ?? 1.5) === lh ? 'bg-brand-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
                >
                  {lh.toFixed(2)}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => onChange({ lineHeight: Math.max(0.5, (element.lineHeight ?? 1.5) - 0.25) })}
                className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <input
                type="number"
                min={0.5}
                max={5}
                step={0.25}
                value={element.lineHeight ?? 1.5}
                onChange={(e) => onChange({ lineHeight: Math.max(0.5, Math.min(5, Number(e.target.value) || 1.5)) })}
                className="flex-1 rounded border border-slate-200 dark:border-slate-700 bg-transparent px-2 py-1 text-xs text-center text-slate-900 dark:text-white"
              />
              <button
                onClick={() => onChange({ lineHeight: Math.min(5, (element.lineHeight ?? 1.5) + 0.25) })}
                className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          {/* Letter spacing */}
          <div>
            <label className="text-[10px] font-semibold text-slate-500 uppercase mb-1.5 block">Letter Spacing</label>
            <div className="flex items-center gap-2">
              <button
                onClick={() => onChange({ letterSpacing: Math.max(-10, (element.letterSpacing ?? 0) - 0.5) })}
                className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <input
                type="number"
                min={-10}
                max={50}
                step={0.5}
                value={element.letterSpacing ?? 0}
                onChange={(e) => onChange({ letterSpacing: Math.max(-10, Math.min(50, Number(e.target.value) || 0)) })}
                className="flex-1 rounded border border-slate-200 dark:border-slate-700 bg-transparent px-2 py-1 text-xs text-center text-slate-900 dark:text-white"
              />
              <button
                onClick={() => onChange({ letterSpacing: Math.min(50, (element.letterSpacing ?? 0) + 0.5) })}
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
                max={50}
                step={1}
                value={element.paragraphSpacing ?? 0}
                onChange={(e) => onChange({ paragraphSpacing: Math.max(0, Math.min(50, Number(e.target.value) || 0)) })}
                className="flex-1 rounded border border-slate-200 dark:border-slate-700 bg-transparent px-2 py-1 text-xs text-center text-slate-900 dark:text-white"
              />
              <button
                onClick={() => onChange({ paragraphSpacing: Math.min(50, (element.paragraphSpacing ?? 0) + 2) })}
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

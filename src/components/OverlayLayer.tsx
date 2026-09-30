import { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import type { SlideElement, TextBoxElement, ShapeElement, ImageElement, Slide } from '../types';
import { FONT_STACK } from '../themes';

interface Props {
  slide: Slide;
  editable: boolean;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onChange: (id: string, patch: Partial<SlideElement>) => void;
  /** Slide pixel size (used to convert fractional coords to px). */
  width: number;
  height: number;
}

type DragMode =
  | { kind: 'move'; startX: number; startY: number; origX: number; origY: number }
  | { kind: 'resize'; handle: ResizeHandle; startX: number; startY: number; origX: number; origY: number; origW: number; origH: number }
  | { kind: 'rotate'; startX: number; startY: number; origRot: number; cx: number; cy: number };

type ResizeHandle = 'nw' | 'ne' | 'se' | 'sw' | 'n' | 's' | 'e' | 'w';

export function OverlayLayer({ slide, editable, selectedId, onSelect, onChange, width, height }: Props) {
  const elements = useMemo(() => slide.elements || [], [slide.elements]);
  const containerRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<DragMode | null>(null);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);

  const onPointerMove = useCallback((e: PointerEvent) => {
    if (!drag) return;
    const dx = (e.clientX - drag.startX) / width;
    const dy = (e.clientY - drag.startY) / height;
    const el = elements.find((x) => x.id === selectedId);
    if (!el) return;

    if (drag.kind === 'move') {
      const nx = Math.max(0, Math.min(1 - el.w, drag.origX + dx));
      const ny = Math.max(0, Math.min(1 - el.h, drag.origY + dy));
      onChange(el.id, { x: nx, y: ny });
    } else if (drag.kind === 'resize') {
      const { origX, origY, origW, origH } = drag;
      let nx = origX, ny = origY, nw = origW, nh = origH;
      const h = drag.handle;
      if (h.includes('e')) nw = Math.max(0.04, origW + dx);
      if (h.includes('s')) nh = Math.max(0.04, origH + dy);
      if (h.includes('w')) { nw = Math.max(0.04, origW - dx); nx = origX + (origW - nw); }
      if (h.includes('n')) { nh = Math.max(0.04, origH - dy); ny = origY + (origH - nh); }
      onChange(el.id, { x: nx, y: ny, w: nw, h: nh });
    } else if (drag.kind === 'rotate') {
      const angle = Math.atan2(e.clientY - drag.cy, e.clientX - drag.cx) * 180 / Math.PI + 90;
      onChange(el.id, { rotation: Math.round(angle) });
    }
  }, [drag, elements, selectedId, onChange, width, height]);

  const onPointerUp = useCallback(() => {
    setDrag(null);
  }, []);

  useEffect(() => {
    if (!drag) return;
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };
  }, [drag, onPointerMove, onPointerUp]);

  const startMove = (e: React.PointerEvent, el: SlideElement) => {
    if (!editable || editingTextId === el.id) return;
    e.stopPropagation();
    onSelect(el.id);
    setDrag({ kind: 'move', startX: e.clientX, startY: e.clientY, origX: el.x, origY: el.y });
  };

  const startResize = (e: React.PointerEvent, el: SlideElement, handle: ResizeHandle) => {
    if (!editable) return;
    e.stopPropagation();
    e.preventDefault();
    onSelect(el.id);
    setDrag({ kind: 'resize', handle, startX: e.clientX, startY: e.clientY, origX: el.x, origY: el.y, origW: el.w, origH: el.h });
  };

  const startRotate = (e: React.PointerEvent, el: SlideElement) => {
    if (!editable) return;
    e.stopPropagation();
    e.preventDefault();
    onSelect(el.id);
    const rect = containerRef.current?.getBoundingClientRect();
    const cx = rect ? rect.left + (el.x + el.w / 2) * width : e.clientX;
    const cy = rect ? rect.top + (el.y + el.h / 2) * height : e.clientY;
    setDrag({ kind: 'rotate', startX: e.clientX, startY: e.clientY, origRot: el.rotation || 0, cx, cy });
  };

  return (
    <div
      ref={containerRef}
      className="absolute inset-0"
      style={{ pointerEvents: editable ? 'auto' : 'none' }}
      onPointerDown={(e) => { if (editable && e.target === e.currentTarget) onSelect(null); }}
    >
      {elements.map((el) => (
        <ElementView
          key={el.id}
          el={el}
          editable={editable}
          selected={selectedId === el.id}
          editing={editingTextId === el.id}
          width={width}
          height={height}
          onPointerDown={(e) => startMove(e, el)}
          onDoubleClick={() => {
            if (el.kind === 'text' && editable) {
              setEditingTextId(el.id);
              onSelect(el.id);
            }
          }}
          onTextChange={(text) => onChange(el.id, { text } as Partial<TextBoxElement>)}
          onTextBlur={() => setEditingTextId(null)}
          onStartResize={(e, h) => startResize(e, el, h)}
          onStartRotate={(e) => startRotate(e, el)}
        />
      ))}
    </div>
  );
}

function ElementView({
  el, editable, selected, editing, width, height,
  onPointerDown, onDoubleClick, onTextChange, onTextBlur, onStartResize, onStartRotate,
}: {
  el: SlideElement;
  editable: boolean;
  selected: boolean;
  editing: boolean;
  width: number;
  height: number;
  onPointerDown: (e: React.PointerEvent) => void;
  onDoubleClick: () => void;
  onTextChange: (text: string) => void;
  onTextBlur: () => void;
  onStartResize: (e: React.PointerEvent, h: ResizeHandle) => void;
  onStartRotate: (e: React.PointerEvent) => void;
}) {
  const left = el.x * width;
  const top = el.y * height;
  const w = el.w * width;
  const h = el.h * height;
  const rot = el.rotation || 0;

  const baseStyle: React.CSSProperties = {
    position: 'absolute',
    left, top, width: w, height: h,
    transform: rot ? `rotate(${rot}deg)` : undefined,
    cursor: editable ? 'move' : 'default',
  };

  const ring = selected && editable
    ? 'outline outline-2 outline-brand-400'
    : '';

  const handles: ResizeHandle[] = ['nw', 'ne', 'se', 'sw', 'n', 's', 'e', 'w'];

  return (
    <div
      style={baseStyle}
      className={ring}
      onPointerDown={onPointerDown}
      onDoubleClick={onDoubleClick}
    >
      {el.kind === 'text' && (
        <TextElementView el={el} editing={editing} onChange={onTextChange} onBlur={onTextBlur} />
      )}
      {el.kind === 'shape' && <ShapeElementView el={el} />}
      {el.kind === 'image' && <ImageElementView el={el} />}

      {selected && editable && (
        <>
          <div
            onPointerDown={onStartRotate}
            className="absolute -top-6 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-white border-2 border-brand-400 cursor-grab"
            title="Rotate"
          />
          {handles.map((hd) => (
            <div
              key={hd}
              onPointerDown={(e) => onStartResize(e, hd)}
              className={handleClass(hd)}
              style={handleStyle(hd)}
            />
          ))}
        </>
      )}
    </div>
  );
}

function TextElementView({
  el, editing, onChange, onBlur,
}: {
  el: TextBoxElement;
  editing: boolean;
  onChange: (text: string) => void;
  onBlur: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const fontFamily = el.fontFamily ? FONT_STACK[el.fontFamily] : undefined;

  useEffect(() => {
    if (editing && ref.current) {
      ref.current.focus();
      const range = document.createRange();
      range.selectNodeContents(ref.current);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
    }
  }, [editing]);

  if (editing) {
    return (
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onBlur={(e) => { onChange(e.currentTarget.innerText); onBlur(); }}
        className="w-full h-full outline-none"
        style={{
          fontFamily,
          fontSize: el.fontSize,
          fontWeight: el.bold ? 700 : 400,
          fontStyle: el.italic ? 'italic' : 'normal',
          textDecoration: el.underline ? 'underline' : 'none',
          color: el.color,
          textAlign: el.align || 'left',
          background: el.background || 'transparent',
          borderRadius: el.borderRadius,
          padding: 4,
          cursor: 'text',
          lineHeight: el.lineHeight,
          letterSpacing: el.letterSpacing ? `${el.letterSpacing}px` : undefined,
        }}
        dangerouslySetInnerHTML={{
          __html: el.text.split('\n').map((para, i, arr) =>
            `<div style="white-space:pre-wrap;${i < arr.length - 1 && el.paragraphSpacing ? `margin-bottom:${el.paragraphSpacing}px;` : ''}">${escapeHtml(para) || '\u200B'}</div>`
          ).join('')
        }}
      />
    );
  }

  return (
    <div
      className="w-full h-full"
      style={{
        fontFamily,
        fontSize: el.fontSize,
        fontWeight: el.bold ? 700 : 400,
        fontStyle: el.italic ? 'italic' : 'normal',
        textDecoration: el.underline ? 'underline' : 'none',
        color: el.color,
        textAlign: el.align || 'left',
        background: el.background || 'transparent',
        borderRadius: el.borderRadius,
        padding: 4,
        overflow: 'hidden',
        lineHeight: el.lineHeight,
        letterSpacing: el.letterSpacing ? `${el.letterSpacing}px` : undefined,
      }}
    >
      {el.text.split('\n').map((para, i, arr) => (
        <div
          key={i}
          style={{
            whiteSpace: 'pre-wrap',
            marginBottom: i < arr.length - 1 && el.paragraphSpacing ? `${el.paragraphSpacing}px` : undefined,
          }}
        >
          {para || '\u200B'}
        </div>
      ))}
    </div>
  );
}

function ShapeElementView({ el }: { el: ShapeElement }) {
  if (el.shape === 'line') {
    return (
      <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
        <line
          x1="0" y1="50" x2="100" y2="50"
          stroke={el.stroke || '#0f172a'}
          strokeWidth={el.strokeWidth || 2}
        />
      </svg>
    );
  }
  if (el.shape === 'arrow') {
    return (
      <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
        <defs>
          <marker id={`arrow-${el.id}`} markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto">
            <path d="M0,0 L10,5 L0,10 z" fill={el.stroke || el.fill || '#0f172a'} />
          </marker>
        </defs>
        <line
          x1="0" y1="50" x2="100" y2="50"
          stroke={el.stroke || el.fill || '#0f172a'}
          strokeWidth={el.strokeWidth || 3}
          markerEnd={`url(#arrow-${el.id})`}
        />
      </svg>
    );
  }
  if (el.shape === 'triangle') {
    return (
      <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
        <polygon
          points="50,10 90,90 10,90"
          fill={el.fill || '#06b6d4'}
          stroke={el.stroke || 'none'}
          strokeWidth={el.strokeWidth || 1}
        />
      </svg>
    );
  }
  if (el.shape === 'star') {
    return (
      <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
        <polygon
          points="50,5 61,40 98,40 68,62 79,97 50,75 21,97 32,62 2,40 39,40"
          fill={el.fill || '#fbbf24'}
          stroke={el.stroke || 'none'}
          strokeWidth={el.strokeWidth || 1}
        />
      </svg>
    );
  }
  if (el.shape === 'heart') {
    return (
      <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
        <path
          d="M50,88 C20,60 5,40 15,25 C25,10 40,10 50,25 C60,10 75,10 85,25 C95,40 80,60 50,88 Z"
          fill={el.fill || '#ec4899'}
          stroke={el.stroke || 'none'}
          strokeWidth={el.strokeWidth || 1}
        />
      </svg>
    );
  }
  if (el.shape === 'hexagon') {
    return (
      <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
        <polygon
          points="50,5 93,25 93,75 50,95 7,75 7,25"
          fill={el.fill || '#8b5cf6'}
          stroke={el.stroke || 'none'}
          strokeWidth={el.strokeWidth || 1}
        />
      </svg>
    );
  }
  if (el.shape === 'diamond') {
    return (
      <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
        <polygon
          points="50,5 95,50 50,95 5,50"
          fill={el.fill || '#10b981'}
          stroke={el.stroke || 'none'}
          strokeWidth={el.strokeWidth || 1}
        />
      </svg>
    );
  }
  if (el.shape === 'circle') {
    return (
      <div
        className="w-full h-full"
        style={{
          background: el.fill || '#06b6d4',
          border: el.stroke ? `${el.strokeWidth || 1}px solid ${el.stroke}` : 'none',
          borderRadius: '50%',
        }}
      />
    );
  }
  return (
    <div
      className="w-full h-full"
      style={{
        background: el.fill || '#06b6d4',
        border: el.stroke ? `${el.strokeWidth || 1}px solid ${el.stroke}` : 'none',
        borderRadius: 4,
      }}
    />
  );
}

function ImageElementView({ el }: { el: ImageElement }) {
  return (
    <img
      src={el.url}
      alt={el.alt || ''}
      className="w-full h-full"
      style={{
        objectFit: el.objectFit || 'cover',
        borderRadius: el.borderRadius,
        opacity: el.opacity ?? 1,
      }}
      draggable={false}
    />
  );
}

function handleClass(_h: ResizeHandle): string {
  return 'absolute w-2.5 h-2.5 rounded-full bg-white border-2 border-brand-400';
}

function handleStyle(h: ResizeHandle): React.CSSProperties {
  const s: React.CSSProperties = {};
  if (h.includes('n')) s.top = -5;
  if (h.includes('s')) s.bottom = -5;
  if (h.includes('w')) s.left = -5;
  if (h.includes('e')) s.right = -5;
  if (h === 'n' || h === 's') { s.left = '50%'; s.marginLeft = -5; s.cursor = 'ns-resize'; }
  if (h === 'e' || h === 'w') { s.top = '50%'; s.marginTop = -5; s.cursor = 'ew-resize'; }
  if (h === 'nw' || h === 'se') s.cursor = 'nwse-resize';
  if (h === 'ne' || h === 'sw') s.cursor = 'nesw-resize';
  return s;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

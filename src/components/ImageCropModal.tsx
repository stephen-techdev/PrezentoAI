import { useState, useRef, useEffect, useCallback } from 'react';
import { X, Check, RotateCcw } from 'lucide-react';

interface Props {
  imageUrl: string;
  initialCrop: { x: number; y: number; w: number; h: number };
  onApply: (crop: { x: number; y: number; w: number; h: number }) => void;
  onCancel: () => void;
}

export function ImageCropModal({ imageUrl, initialCrop, onApply, onCancel }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [crop, setCrop] = useState(initialCrop);
  const [containerSize, setContainerSize] = useState({ w: 600, h: 400 });
  const [dragging, setDragging] = useState<'move' | 'resize-nw' | 'resize-ne' | 'resize-sw' | 'resize-se' | null>(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0, crop: crop });

  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setContainerSize({
          w: containerRef.current.clientWidth,
          h: containerRef.current.clientHeight - 60,
        });
      }
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  const toPercent = (val: number, dim: 'w' | 'h') => {
    const max = dim === 'w' ? 1 : 1;
    return Math.max(0.05, Math.min(max, val));
  };

  const handlePointerDown = (e: React.PointerEvent, mode: typeof dragging) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(mode);
    setDragStart({ x: e.clientX, y: e.clientY, crop });
  };

  const handlePointerMove = useCallback((e: PointerEvent) => {
    if (!dragging) return;
    const dx = (e.clientX - dragStart.x) / 100;
    const dy = (e.clientY - dragStart.y) / 100;

    if (dragging === 'move') {
      setCrop({
        x: toPercent(dragStart.crop.x + dx, 'w'),
        y: toPercent(dragStart.crop.y + dy, 'h'),
        w: dragStart.crop.w,
        h: dragStart.crop.h,
      });
    } else if (dragging === 'resize-se') {
      setCrop({
        x: dragStart.crop.x,
        y: dragStart.crop.y,
        w: toPercent(dragStart.crop.w + dx, 'w'),
        h: toPercent(dragStart.crop.h + dy, 'h'),
      });
    } else if (dragging === 'resize-sw') {
      setCrop({
        x: toPercent(dragStart.crop.x + dx, 'w'),
        y: dragStart.crop.y,
        w: toPercent(dragStart.crop.w - dx, 'w'),
        h: toPercent(dragStart.crop.h + dy, 'h'),
      });
    } else if (dragging === 'resize-ne') {
      setCrop({
        x: dragStart.crop.x,
        y: toPercent(dragStart.crop.y + dy, 'h'),
        w: toPercent(dragStart.crop.w + dx, 'w'),
        h: toPercent(dragStart.crop.h - dy, 'h'),
      });
    } else if (dragging === 'resize-nw') {
      setCrop({
        x: toPercent(dragStart.crop.x + dx, 'w'),
        y: toPercent(dragStart.crop.y + dy, 'h'),
        w: toPercent(dragStart.crop.w - dx, 'w'),
        h: toPercent(dragStart.crop.h - dy, 'h'),
      });
    }
  }, [dragging, dragStart]);

  const handlePointerUp = useCallback(() => {
    setDragging(null);
  }, []);

  useEffect(() => {
    if (!dragging) return;
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [dragging, handlePointerMove, handlePointerUp]);

  const resetCrop = () => setCrop({ x: 0, y: 0, w: 1, h: 1 });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80" style={{ backdropFilter: 'blur(4px)' }}>
      <div
        ref={containerRef}
        className="relative w-full max-w-4xl h-[80vh] bg-slate-900 rounded-xl overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 h-12 bg-slate-800 border-b border-slate-700">
          <span className="text-white text-sm font-medium">Crop Image</span>
          <div className="flex items-center gap-2">
            <button
              onClick={resetCrop}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-slate-300 hover:bg-slate-700 transition"
            >
              <RotateCcw className="w-4 h-4" /> Reset
            </button>
            <button
              onClick={onCancel}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Crop area */}
        <div className="flex-1 relative overflow-hidden bg-slate-950">
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div className="relative" style={{ width: '100%', maxWidth: containerSize.w, height: containerSize.h }}>
              {/* Background image (dimmed) */}
              <img
                src={imageUrl}
                alt="Crop preview"
                className="absolute inset-0 w-full h-full object-contain opacity-40"
                draggable={false}
              />

              {/* Crop overlay */}
              <div className="absolute inset-0">
                {/* Top dim */}
                <div
                  className="absolute bg-black/60"
                  style={{
                    top: 0,
                    left: 0,
                    right: 0,
                    height: `${crop.y * 100}%`,
                  }}
                />
                {/* Bottom dim */}
                <div
                  className="absolute bg-black/60"
                  style={{
                    top: `${(crop.y + crop.h) * 100}%`,
                    left: 0,
                    right: 0,
                    bottom: 0,
                  }}
                />
                {/* Left dim */}
                <div
                  className="absolute bg-black/60"
                  style={{
                    top: `${crop.y * 100}%`,
                    left: 0,
                    width: `${crop.x * 100}%`,
                    height: `${crop.h * 100}%`,
                  }}
                />
                {/* Right dim */}
                <div
                  className="absolute bg-black/60"
                  style={{
                    top: `${crop.y * 100}%`,
                    right: 0,
                    width: `${(1 - crop.x - crop.w) * 100}%`,
                    height: `${crop.h * 100}%`,
                  }}
                />

                {/* Crop box */}
                <div
                  className="absolute border-2 border-white cursor-move"
                  style={{
                    top: `${crop.y * 100}%`,
                    left: `${crop.x * 100}%`,
                    width: `${crop.w * 100}%`,
                    height: `${crop.h * 100}%`,
                  }}
                  onPointerDown={(e) => handlePointerDown(e, 'move')}
                >
                  {/* Corner handles */}
                  <div
                    className="absolute -top-2 -left-2 w-4 h-4 bg-white rounded-full border-2 border-slate-800 cursor-nwse-resize"
                    onPointerDown={(e) => handlePointerDown(e, 'resize-nw')}
                  />
                  <div
                    className="absolute -top-2 -right-2 w-4 h-4 bg-white rounded-full border-2 border-slate-800 cursor-nesw-resize"
                    onPointerDown={(e) => handlePointerDown(e, 'resize-ne')}
                  />
                  <div
                    className="absolute -bottom-2 -left-2 w-4 h-4 bg-white rounded-full border-2 border-slate-800 cursor-nesw-resize"
                    onPointerDown={(e) => handlePointerDown(e, 'resize-sw')}
                  />
                  <div
                    className="absolute -bottom-2 -right-2 w-4 h-4 bg-white rounded-full border-2 border-slate-800 cursor-nwse-resize"
                    onPointerDown={(e) => handlePointerDown(e, 'resize-se')}
                  />

                  {/* Grid lines */}
                  <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute top-1/3 left-0 right-0 h-px bg-white/30" />
                    <div className="absolute top-2/3 left-0 right-0 h-px bg-white/30" />
                    <div className="absolute left-1/3 top-0 bottom-0 w-px bg-white/30" />
                    <div className="absolute left-2/3 top-0 bottom-0 w-px bg-white/30" />
                  </div>
                </div>
              </div>

              {/* Foreground image in crop area */}
              <div
                className="absolute overflow-hidden"
                style={{
                  top: `${crop.y * 100}%`,
                  left: `${crop.x * 100}%`,
                  width: `${crop.w * 100}%`,
                  height: `${crop.h * 100}%`,
                }}
              >
                <img
                  src={imageUrl}
                  alt="Cropped"
                  className="absolute"
                  style={{
                    top: `-${crop.y * 100 / crop.w}%`,
                    left: `-${crop.x * 100 / crop.w}%`,
                    width: `${10000 / crop.w}%`,
                    height: `${10000 / crop.h}%`,
                    maxWidth: 'none',
                    objectFit: 'cover',
                  }}
                  draggable={false}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 h-14 bg-slate-800 border-t border-slate-700">
          <div className="text-xs text-slate-400">
            <span className="font-mono">{Math.round(crop.x * 100)}%, {Math.round(crop.y * 100)}%</span>
            <span className="mx-2">|</span>
            <span className="font-mono">{Math.round(crop.w * 100)}% × {Math.round(crop.h * 100)}%</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onCancel}
              className="px-4 py-2 rounded-lg text-sm text-slate-300 hover:bg-slate-700 transition"
            >
              Cancel
            </button>
            <button
              onClick={() => onApply(crop)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-brand-500 hover:bg-brand-600 text-white transition"
            >
              <Check className="w-4 h-4" /> Apply Crop
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

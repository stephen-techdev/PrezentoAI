import { useState, useEffect, useRef, useCallback, useLayoutEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface Props {
  open: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLElement | null>;
  children: ReactNode;
  /** Preferred placement relative to anchor. Defaults to bottom-start. */
  placement?: 'bottom-start' | 'bottom-end' | 'right-start';
  /** Extra gap between anchor and dropdown in px. */
  gap?: number;
  /** Min width for the dropdown. Defaults to anchor width. */
  minWidth?: number;
  /** Fixed width for the dropdown. */
  width?: number;
  className?: string;
}

export function DropdownPortal({
  open, onClose, anchorRef, children,
  placement = 'bottom-start', gap = 4, minWidth, width, className = '',
}: Props) {
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const compute = useCallback(() => {
    const anchor = anchorRef.current;
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    const dd = dropdownRef.current;
    const ddH = dd?.offsetHeight || 200;
    const ddW = dd?.offsetWidth || (width || rect.width);

    let top = rect.bottom + gap;
    let left = rect.left;

    if (placement === 'bottom-end') left = rect.right - ddW;
    if (placement === 'right-start') { top = rect.top; left = rect.right + gap; }

    // Flip up if not enough space below
    if (top + ddH > window.innerHeight - 8 && rect.top > ddH + gap) {
      top = rect.top - ddH - gap;
    }
    // Clamp horizontally
    left = Math.max(8, Math.min(left, window.innerWidth - ddW - 8));

    setPos({ top, left });
  }, [anchorRef, placement, gap, width]);

  useLayoutEffect(() => {
    if (!open) { setPos(null); return; }
    // First pass: position using anchor rect (dropdownRef may be null on first render).
    compute();
    // Second pass: recompute after the portal is painted so offsetHeight is accurate.
    const raf = requestAnimationFrame(() => compute());
    return () => cancelAnimationFrame(raf);
  }, [open, compute]);

  useEffect(() => {
    if (!open) return;
    const onResize = () => compute();
    const onScroll = () => { compute(); };
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [open, compute]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (dropdownRef.current?.contains(target)) return;
      if (anchorRef.current?.contains(target)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose, anchorRef]);

  if (!open) return null;

  const style: React.CSSProperties = {
    position: 'fixed',
    top: pos?.top ?? -9999,
    left: pos?.left ?? -9999,
    zIndex: 9999,
    minWidth: width ? undefined : (minWidth ?? anchorRef.current?.getBoundingClientRect().width ?? 0),
    width: width,
  };

  return createPortal(
    <div ref={dropdownRef} style={style} className={className}>
      {children}
    </div>,
    document.body,
  );
}

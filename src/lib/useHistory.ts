import { useState, useCallback, useRef, useEffect } from 'react';

interface HistoryState<T> {
  past: T[];
  present: T;
  future: T[];
}

const MAX_HISTORY = 100;

export function useHistory<T>(initial: T) {
  const [state, setState] = useState<HistoryState<T>>({
    past: [],
    present: initial,
    future: [],
  });

  const skipNext = useRef(false);

  const set = useCallback((updater: T | ((prev: T) => T), record = true) => {
    setState((s) => {
      const next = typeof updater === 'function' ? (updater as (p: T) => T)(s.present) : updater;
      if (next === s.present) return s;
      if (!record || skipNext.current) {
        skipNext.current = false;
        return { ...s, present: next };
      }
      const past = [...s.past, s.present].slice(-MAX_HISTORY);
      return { past, present: next, future: [] };
    });
  }, []);

  const undo = useCallback(() => {
    setState((s) => {
      if (s.past.length === 0) return s;
      const previous = s.past[s.past.length - 1];
      const past = s.past.slice(0, -1);
      const future = [s.present, ...s.future].slice(0, MAX_HISTORY);
      skipNext.current = true;
      return { past, present: previous, future };
    });
  }, []);

  const redo = useCallback(() => {
    setState((s) => {
      if (s.future.length === 0) return s;
      const next = s.future[0];
      const future = s.future.slice(1);
      const past = [...s.past, s.present].slice(-MAX_HISTORY);
      skipNext.current = true;
      return { past, present: next, future };
    });
  }, []);

  const reset = useCallback((value: T) => {
    skipNext.current = true;
    setState({ past: [], present: value, future: [] });
  }, []);

  const canUndo = state.past.length > 0;
  const canRedo = state.future.length > 0;

  return { state: state.present, set, undo, redo, reset, canUndo, canRedo };
}

export function useKeyboardShortcuts(handlers: Record<string, () => void>) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.isContentEditable || target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) {
        return;
      }
      const key = `${e.ctrlKey || e.metaKey ? 'mod+' : ''}${e.shiftKey ? 'shift+' : ''}${e.key.toLowerCase()}`;
      const handler = handlers[key];
      if (handler) {
        e.preventDefault();
        handler();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handlers]);
}

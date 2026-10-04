import { useEffect, useRef } from 'react';

/** Calls `handler` when Escape is pressed. Used by the finance modals so every dialog is keyboard-dismissible. */
export function useEscape(handler: () => void) {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') ref.current(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);
}

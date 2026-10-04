'use client';

import { useTheme } from 'next-themes';
import { useCallback, useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

/**
 * Thin wrapper over the app's existing next-themes provider (see app/providers.tsx). Used by the Home header
 * toggle and the Dashboard sidebar toggle so both flip the same persisted theme.
 * While switching, a short-lived `theme-transition` class on <html> lets colours fade (see globals.css).
 */
export function useThemeSwitch() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const isDark = mounted ? resolvedTheme === 'dark' : false;

  const toggle = useCallback(() => {
    const root = document.documentElement;
    root.classList.add('theme-transition');
    setTheme(isDark ? 'light' : 'dark');
    window.setTimeout(() => root.classList.remove('theme-transition'), 450);
  }, [isDark, setTheme]);

  return { isDark, mounted, toggle };
}

export function ThemeToggle({ className = '' }: { className?: string }) {
  const { isDark, mounted, toggle } = useThemeSwitch();
  const label = isDark ? 'Switch to light theme' : 'Switch to dark theme';
  return (
    <button
      type="button"
      className={`theme-toggle ${className}`.trim()}
      aria-label={label}
      title={label}
      aria-pressed={isDark}
      onClick={toggle}
      data-ready={mounted ? 'true' : 'false'}
    >
      <Sun size={17} className="theme-toggle-sun" aria-hidden="true" />
      <Moon size={17} className="theme-toggle-moon" aria-hidden="true" />
    </button>
  );
}

'use client';

import Link from 'next/link';
import { useId } from 'react';

/**
 * The Finova brand mark (gradient glyph). Single source of truth: used by the Home page header, the
 * floating hero card and the Dashboard sidebar. Geometry and gradient colours are the original Home logo's.
 */
export function FinovaMark({ size = 34 }: { size?: number }) {
  // Unique gradient ids so several marks can live on one page without clashing.
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const top = `fm-top-${uid}`;
  const bot = `fm-bot-${uid}`;
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <defs>
        <linearGradient id={top} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#b25cf5" />
          <stop offset="1" stopColor="#6d5cf6" />
        </linearGradient>
        <linearGradient id={bot} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#5b8cff" />
          <stop offset="1" stopColor="#3fa3ff" />
        </linearGradient>
      </defs>
      <path d="M8 2h18a5 5 0 0 1 0 10H14a4 4 0 0 0-4 4v1H2V8a6 6 0 0 1 6-6Z" fill={`url(#${top})`} />
      <rect x="2" y="20" width="9" height="10" rx="4" fill={`url(#${bot})`} />
    </svg>
  );
}

/**
 * Mark + "Finova" wordmark. The wordmark inherits `currentColor`, so it follows the active theme's
 * foreground colour (light text on dark, dark text on light) while the gradient mark is theme-neutral.
 * Sizes/typography live in `.finova-logo` (globals.css) so Home and Dashboard render it identically.
 */
export function FinovaLogo({ className = '', href = '/' }: { className?: string; href?: string }) {
  return (
    <Link href={href} className={`finova-logo ${className}`.trim()} aria-label="Finova home">
      <FinovaMark />
      <span className="finova-logo-text">Finova</span>
    </Link>
  );
}

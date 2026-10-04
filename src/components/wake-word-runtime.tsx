'use client';
import { useEffect } from 'react';
import { installWakeWordRuntime, setWakeEnabled } from '@/lib/voice/wake-word';
export function WakeWordRuntime() {
  useEffect(() => {
    const cleanup = installWakeWordRuntime();
    if (localStorage.getItem('finova-hands-free') !== 'false') setWakeEnabled(true);
    return cleanup;
  }, []);
  return null;
}

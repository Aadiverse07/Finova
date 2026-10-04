'use client';

import { useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { I18nProvider } from '@/lib/i18n';
import { GlobalVoiceAssistant } from '@/components/global-voice-assistant';

/**
 * Provider order is frozen across every QuikIT app: SessionProvider -> QueryClientProvider -> ThemeProvider.
 * SessionProvider comes from `next-auth/react` and is added when the shared auth packages are wired in
 * (it must remain the OUTERMOST provider). Do not reorder.
 */
export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000 } } }));
  return (
    <I18nProvider>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
        {children}
        <GlobalVoiceAssistant />
      </ThemeProvider>
    </QueryClientProvider>
    </I18nProvider>
  );
}

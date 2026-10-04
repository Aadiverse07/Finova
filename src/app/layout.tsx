import './globals.css';
import type { Metadata } from 'next';
import { Lora, Source_Sans_3 } from 'next/font/google';
import { Providers } from './providers';

// Elegant serif for headings and figures, highly legible humanist sans for body text.
const display = Lora({ subsets: ['latin'], variable: '--font-display', display: 'swap' });
const body = Source_Sans_3({ subsets: ['latin'], variable: '--font-body', display: 'swap' });

export const metadata: Metadata = { title: 'Finova - Accounting', description: 'Double-entry accounting workspace' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN" dir="ltr" className={`${display.variable} ${body.variable}`} suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

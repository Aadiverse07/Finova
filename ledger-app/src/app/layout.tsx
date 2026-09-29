import './globals.css';
import type { Metadata } from 'next';
export const metadata:Metadata={title:'Ledger — Accounting',description:'Double-entry accounting workspace'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en" suppressHydrationWarning><body>{children}</body></html>}

'use client';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { FinovaLogo } from '@/components/finova-logo';
import { ThemeToggle } from '@/components/theme-toggle';
import { AssistantLauncher } from '@/components/assistant-launcher';
export function PublicContentPage({ title, eyebrow, text, children }: { title:string; eyebrow:string; text:string; children:React.ReactNode }) { return <main className="public-page"><header className="public-header"><Link href="/"><FinovaLogo/></Link><nav><Link href="/dashboard">Workspace</Link><AssistantLauncher home/><ThemeToggle/></nav></header><section className="public-hero"><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p>{text}</p></section><section className="public-content">{children}</section><footer className="public-footer"><Link href="/">Finova</Link><span>Need assistance?</span><Link href="/support">Support <ArrowRight size={14}/></Link></footer></main> }

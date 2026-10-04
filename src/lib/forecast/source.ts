'use client';
import type { Workspace } from '@/lib/assistant/engine';
export function forecastUsesLiveClientData() { return process.env.NEXT_PUBLIC_DATA_SOURCE !== 'prisma'; }
export function workspaceFromStore(s: Workspace): Workspace { return { accounts: s.accounts, entries: s.entries, invoices: s.invoices, expenses: s.expenses }; }

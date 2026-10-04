'use client';

import { useEffect, useState } from 'react';
import { z } from 'zod';

export type AuthUser = { id: string; name: string; email: string; role: string };
export type AuthResult = { ok: true; message: string; user?: AuthUser } | { ok: false; message: string; code?: 'DUPLICATE' | 'NOT_FOUND' | 'INVALID_PASSWORD' | 'LOCKED' };

export const ALLOWED_EMAIL_DOMAINS = ['gmail.com', 'outlook.com', 'icloud.com', 'aol.com'] as const;
const ALLOWED_EMAIL_DOMAIN_SET = new Set<string>(ALLOWED_EMAIL_DOMAINS);
const EMAIL_PATTERN = /^[^\s@]+@([^\s@]+)$/;
const ACCOUNTS_KEY = 'finova-demo-accounts-v3';
const SESSION_KEY = 'finova-demo-session-v2';
const CHANGE_EVENT = 'finova:session-changed';
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function serverAuthAttempt(email: string): Promise<AuthResult | null> {
  try {
    const response = await fetch('/api/auth/attempt', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }), credentials: 'same-origin' });
    if (response.status === 429) {
      const payload = await response.json().catch(() => null) as { error?: string } | null;
      return { ok: false, code: 'LOCKED', message: payload?.error || 'Too many authentication attempts. Please wait one minute and try again.' };
    }
    return null;
  } catch { return null; }
}

export const signInSchema = z.object({ email: z.string().trim().email(), password: z.string().min(1) });
export const registrationSchema = z.object({ name: z.string().trim().min(2).max(80), email: z.string().trim().email(), password: z.string().min(6), confirmPassword: z.string().min(1), terms: z.literal(true) }).refine((v) => v.password === v.confirmPassword, { path: ['confirmPassword'], message: 'Passwords do not match.' });

type StoredAccount = AuthUser & { passwordHash: string; passwordSalt: string; createdAt: string };

export function normalizeEmail(email: string): string { return email.trim().toLowerCase(); }
export function passwordStrength(password: string): { score: number; label: string } {
  let score = 0;
  if (password.length >= 8) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/[a-z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  return { score, label: score <= 1 ? 'Weak' : score <= 3 ? 'Fair' : 'Strong' };
}

async function digest(password: string, salt: string): Promise<string> {
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: new TextEncoder().encode(salt), iterations: 120_000, hash: 'SHA-256' }, material, 256);
  return Array.from(new Uint8Array(bits)).map((x) => x.toString(16).padStart(2, '0')).join('');
}

function readAccounts(): StoredAccount[] {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem(ACCOUNTS_KEY) ?? '[]') as StoredAccount[]; } catch { return []; }
}
function writeAccounts(accounts: StoredAccount[]) { localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts)); }
function emitSession() { window.dispatchEvent(new Event(CHANGE_EVENT)); }
export function readSession(): AuthUser | null {
  if (typeof window === 'undefined') return null;
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) ?? 'null') as AuthUser | null; } catch { return null; }
}
export function initialsFor(user: Pick<AuthUser, 'name' | 'email'>): string {
  const source = user.name.trim() || user.email.split('@')[0] || 'User';
  const bits = source.split(/\s+/).filter(Boolean);
  return (bits.length >= 2 ? `${bits[0]![0]}${bits[bits.length - 1]![0]}` : source.slice(0, 2)).toUpperCase();
}
export function signOut() { if (typeof window === 'undefined') return; localStorage.removeItem(SESSION_KEY); emitSession(); }

export interface AuthAdapter {
  readonly isDemo: boolean;
  validateName(name: string): string | null;
  validateEmail(email: string): string | null;
  validatePassword(password: string): string | null;
  loginWithEmail(email: string, password: string): Promise<AuthResult>;
  register(name: string, email: string, password: string): Promise<AuthResult>;
}

const attempts = new Map<string, { count: number; resetAt: number }>();
function limited(key: string): boolean {
  const now = Date.now();
  const b = attempts.get(key);
  if (!b || b.resetAt <= now) { attempts.set(key, { count: 1, resetAt: now + 60_000 }); return false; }
  b.count += 1;
  return b.count > 5;
}

export const demoAuthAdapter: AuthAdapter = {
  isDemo: true,
  validateName(name) { const n = name.trim(); if (!n) return 'Name is required.'; return n.length < 2 ? 'Enter at least 2 characters.' : n.length > 80 ? 'Name is too long.' : null; },
  validateEmail(email) {
    const value = normalizeEmail(email);
    if (!value) return 'Email is required.';
    const match = value.match(EMAIL_PATTERN);
    if (!match) return 'Enter a valid email address.';
    if (!ALLOWED_EMAIL_DOMAIN_SET.has(match[1]!)) return 'Please use a Gmail, Outlook, iCloud, or AOL email address.';
    return null;
  },
  validatePassword(password) { if (!password) return 'Password is required.'; return password.length < 6 ? 'Password must contain at least 6 characters.' : null; },
  async loginWithEmail(email, password) {
    const normalizedEmail = normalizeEmail(email);
    const problem = this.validateEmail(normalizedEmail) ?? this.validatePassword(password);
    if (problem) return { ok: false, message: problem };
    const serverLimit = await serverAuthAttempt(normalizedEmail);
    if (serverLimit) return serverLimit;
    if (limited(`login:${normalizedEmail}`)) return { ok: false, code: 'LOCKED', message: 'Too many sign-in attempts. Please wait one minute and try again.' };
    await wait(250);
    const account = readAccounts().find((x) => x.email === normalizedEmail);
    if (!account) return { ok: false, code: 'NOT_FOUND', message: 'No account was found for this email.' };
    const hash = await digest(password, account.passwordSalt);
    if (hash !== account.passwordHash) return { ok: false, code: 'INVALID_PASSWORD', message: 'The password is incorrect.' };
    localStorage.setItem(SESSION_KEY, JSON.stringify({ id: account.id, name: account.name, email: account.email, role: account.role } satisfies AuthUser));
    emitSession();
    return { ok: true, message: 'Signed in successfully.', user: readSession() ?? undefined };
  },
  async register(name, email, password) {
    const nameProblem = this.validateName(name);
    const emailProblem = this.validateEmail(email);
    const passwordProblem = this.validatePassword(password);
    const problem = nameProblem ?? emailProblem ?? passwordProblem;
    if (problem) return { ok: false, message: problem };
    const normalizedEmail = normalizeEmail(email);
    const serverLimit = await serverAuthAttempt(normalizedEmail);
    if (serverLimit) return serverLimit;
    if (limited(`register:${normalizedEmail}`)) return { ok: false, code: 'LOCKED', message: 'Too many account-creation attempts. Please wait one minute and try again.' };
    const accounts = readAccounts();
    if (accounts.some((x) => x.email === normalizedEmail)) return { ok: false, code: 'DUPLICATE', message: 'An account with this email is already registered.' };
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const saltText = Array.from(salt).map((x) => x.toString(16).padStart(2, '0')).join('');
    const account: StoredAccount = { id: `user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, name: name.trim(), email: normalizedEmail, role: 'Administrator', passwordSalt: saltText, passwordHash: await digest(password, saltText), createdAt: new Date().toISOString() };
    accounts.push(account); writeAccounts(accounts);
    localStorage.setItem(SESSION_KEY, JSON.stringify({ id: account.id, name: account.name, email: account.email, role: account.role } satisfies AuthUser));
    emitSession();
    return { ok: true, message: 'Account created and signed in.', user: readSession() ?? undefined };
  },
};

export const authAdapter: AuthAdapter = demoAuthAdapter;

export function useSession() {
  const [user, setUser] = useState<AuthUser | null>(null);
  useEffect(() => {
    let cancelled = false;
    const quikitEnabled = process.env.NEXT_PUBLIC_QUIKIT_AUTH_ENABLED === 'true';
    const syncDemo = () => setUser(readSession());
    if (!quikitEnabled) {
      syncDemo();
      window.addEventListener(CHANGE_EVENT, syncDemo);
      window.addEventListener('storage', syncDemo);
    } else {
      fetch('/api/session', { cache: 'no-store' })
        .then((res) => res.json() as Promise<{ data?: { user?: AuthUser | null } }>)
        .then((payload) => { if (!cancelled) setUser(payload.data?.user ?? null); })
        .catch(() => { if (!cancelled) setUser(null); });
    }
    return () => {
      cancelled = true;
      if (!quikitEnabled) {
        window.removeEventListener(CHANGE_EVENT, syncDemo);
        window.removeEventListener('storage', syncDemo);
      }
    };
  }, []);
  return { user, signedIn: Boolean(user) };
}

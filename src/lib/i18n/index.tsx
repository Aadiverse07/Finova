'use client';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { LANGUAGES, messages, type Language } from './translations';

type I18nContextValue = { language: Language; setLanguage: (language: Language) => void; t: (key: string) => string; languages: typeof LANGUAGES };
const Ctx = createContext<I18nContextValue | null>(null);
const getNested = (obj: unknown, path: string) => path.split('.').reduce<unknown>((v, k) => (v && typeof v === 'object' ? (v as Record<string, unknown>)[k] : undefined), obj);
const detect = (): Language => {
  if (typeof navigator === 'undefined') return 'en';
  const l = navigator.language.toLowerCase();
  return l.startsWith('hi') ? 'hi' : 'en';
};
export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>('en');
  useEffect(() => {
    const saved = localStorage.getItem('finova-language') as Language | null;
    const follow = localStorage.getItem('finova-follow-device') === 'true';
    setLanguageState(saved && LANGUAGES.some((x) => x.code === saved) ? saved : follow ? detect() : 'en');
  }, []);
  const setLanguage = (next: Language) => { setLanguageState(next); localStorage.setItem('finova-language', next); document.documentElement.lang = next === 'hi' ? 'hi-IN' : 'en-IN'; document.documentElement.dir = 'ltr'; };
  const value = useMemo<I18nContextValue>(() => ({ language, setLanguage, languages: LANGUAGES, t: (key) => { const v = getNested(messages[language], key) ?? getNested(messages.en, key); if (v === undefined) { if (process.env.NODE_ENV !== 'production') console.warn(`[Finova i18n] Missing translation: ${key}`); return key; } return String(v); } }), [language]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
export function useI18n() { const v = useContext(Ctx); if (!v) throw new Error('useI18n must be used inside I18nProvider'); return v; }

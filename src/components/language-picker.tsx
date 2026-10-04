'use client';
import { Languages } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
export function LanguagePicker({ compact = false }: { compact?: boolean }) {
  const { language, setLanguage, languages, t } = useI18n();
  return <label className="language-picker" title={t('language.title')}><Languages size={16} /><span className="sr-only">{t('language.title')}</span><select aria-label={t('language.title')} value={language} onChange={(e) => setLanguage(e.target.value as typeof language)}>{languages.map((l) => <option key={l.code} value={l.code}>{l.nativeName} — {l.englishName}</option>)}</select>{compact ? null : <span className="language-label">{t('language.title')}</span>}</label>;
}

'use client';
import { FinanceModuleShell } from '@/components/finance-module-shell';
import { LanguagePicker } from '@/components/language-picker';
import { useI18n } from '@/lib/i18n';
export default function LanguageSettingsPage() {
  const { t } = useI18n();
  return <FinanceModuleShell active="dashboard"><div className="module-page"><div className="page-header"><div><span className="eyebrow">Finova</span><h1>{t('language.title')}</h1><p>Choose the language for Finova&apos;s interface and financial assistant.</p></div></div><div className="panel" style={{maxWidth:720}}><h2>{t('language.title')}</h2><p className="muted">English, हिन्दी and Hinglish are available now. More Indian languages can be added through translation configuration.</p><LanguagePicker /><div className="notice" style={{marginTop:20}}>Your language preference is stored locally for instant switching. Production user-profile persistence can be connected to the authenticated user settings API.</div></div></div></FinanceModuleShell>;
}

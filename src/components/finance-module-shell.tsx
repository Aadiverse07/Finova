'use client';

import Link from 'next/link';
import { Activity, ArrowDownRight, Bell, Users, BarChart3, BookOpen, CircleHelp, Home, LayoutDashboard, Moon, Receipt, Settings, Sun, WalletCards } from 'lucide-react';
import { FinovaLogo } from '@/components/finova-logo';
import { useThemeSwitch } from '@/components/theme-toggle';
import { useEffect, useState, type ReactNode } from 'react';
import { LoginModal } from '@/components/login-modal';
import { NOTIFICATION_TRIGGER_ATTR, NotificationsPanel, useNotificationStore } from '@/components/notifications-panel';
import { HelpPanel, SettingsPanel } from '@/components/support-panels';
import { GlobalSearch } from '@/components/global-search';
import { AssistantLauncher } from '@/components/assistant-launcher';
import { AccountMenu } from '@/components/account-menu';
import { useI18n } from '@/lib/i18n';

export type ShellModule = 'dashboard' | 'journal' | 'invoices' | 'expenses' | 'reports' | 'accounts' | 'forecast' | 'customers' | 'bank';
type NavHref = '/' | '/dashboard' | '/journal' | '/invoices' | '/expenses' | '/reports' | '/accounts' | '/forecast' | '/customers' | '/bank';
const NAV: { key: ShellModule | 'home'; href: NavHref; labelKey: string; fallback: string; icon: typeof Home }[] = [
  { key: 'home', href: '/', labelKey: 'nav.home', fallback: 'Home', icon: Home },
  { key: 'dashboard', href: '/dashboard', labelKey: 'nav.dashboard', fallback: 'Dashboard', icon: LayoutDashboard },
  { key: 'journal', href: '/journal', labelKey: 'nav.journal', fallback: 'Transactions', icon: WalletCards },
  { key: 'invoices', href: '/invoices', labelKey: 'nav.invoices', fallback: 'Invoices', icon: Receipt },
  { key: 'expenses', href: '/expenses', labelKey: 'nav.expenses', fallback: 'Expenses', icon: ArrowDownRight },
  { key: 'reports', href: '/reports', labelKey: 'nav.reports', fallback: 'Reports', icon: BarChart3 },
  { key: 'accounts', href: '/accounts', labelKey: 'nav.accounts', fallback: 'Chart of Accounts', icon: BookOpen },
  { key: 'forecast', href: '/forecast', labelKey: 'nav.forecast', fallback: 'Cash Forecast', icon: Activity },
  { key: 'customers', href: '/customers', labelKey: 'nav.customers', fallback: 'Customers', icon: Users },
  { key: 'bank', href: '/bank', labelKey: 'nav.bank', fallback: 'Banking', icon: WalletCards },
];

export function FinanceModuleShell({ active, children }: { active: ShellModule; children: ReactNode }) {
  const { isDark, toggle } = useThemeSwitch(); const { t } = useI18n();
  const [showLogin, setShowLogin] = useState(false); const [loginMode, setLoginMode] = useState<'signin' | 'signup'>('signin');
  const [showNotifications, setShowNotifications] = useState(false); const [showSettings, setShowSettings] = useState(false); const [showHelp, setShowHelp] = useState(false);
  const { unread, inApp } = useNotificationStore();
  useEffect(() => { const open = () => setShowNotifications(true); window.addEventListener('finova:open-notifications', open); return () => window.removeEventListener('finova:open-notifications', open); }, []);
  const bellProps = { [NOTIFICATION_TRIGGER_ATTR]: '' };
  const openLogin = (mode: 'signin' | 'signup' = 'signin') => { setLoginMode(mode); setShowLogin(true); };
  return <main className="finova-shell">
    <aside className="sidebar">
      <div className="brand"><FinovaLogo /><div className="brand-tagline">{t('brand.tagline')}</div></div>
      <div className="shell-language"><span className="shell-language-caption">{t('language.appLanguage')}</span><Link href="/settings/language" className="language-settings-link">{t('language.manage')}</Link></div>
      <nav className="side-nav" aria-label={t('nav.primary')}>{NAV.map(({ key, href, labelKey, fallback, icon: Icon }) => <Link key={key} href={href} className={`nav-item ${active === key ? 'active' : ''}`} aria-current={active === key ? 'page' : undefined}><Icon size={19} /><span>{t(labelKey) === labelKey ? fallback : t(labelKey)}</span></Link>)}</nav>
      <div className="nav-divider" />
      <nav className="side-nav" aria-label={t('nav.secondary')}>
        <button type="button" className="nav-item nav-button" onClick={() => setShowSettings(true)}><Settings size={19}/><span>{t('nav.settings')}</span></button>
        <button type="button" className="nav-item nav-button" onClick={() => setShowHelp(true)}><CircleHelp size={19}/><span>{t('nav.help')}</span></button>
        <button type="button" className="nav-item nav-button theme-nav-button" onClick={toggle} title={isDark ? t('nav.light') : t('nav.dark')} aria-label={isDark ? t('nav.light') : t('nav.dark')} aria-pressed={isDark}>{isDark ? <Sun size={19}/> : <Moon size={19}/>}<span>{isDark ? t('nav.light') : t('nav.dark')}</span><span className="theme-status-dot" aria-hidden="true"/></button>
      </nav>
      <div className="sidebar-promo"><div className="promo-icon"><Activity size={17}/></div><strong>{t('promo.titleLine1')}<br/>{t('promo.titleLine2')}</strong><span>{t('promo.body')}</span><div className="promo-line"/></div>
    </aside>
    <section className="content">
      <header className="topbar"><div className="topbar-search-group"><GlobalSearch onOpenSettings={() => setShowSettings(true)} onOpenHelp={() => setShowHelp(true)} /><AssistantLauncher /></div><div className="top-actions">
        <button type="button" className="icon-button notification" aria-label={inApp && unread ? `${t('notifications.label')}, ${unread} ${t('notifications.unread')}` : t('notifications.label')} aria-haspopup="dialog" aria-expanded={showNotifications} {...bellProps} onClick={() => setShowNotifications((open) => !open)}><Bell size={20}/>{inApp && unread > 0 && <i/>}</button><div className="profile-divider"/><AccountMenu onLogin={openLogin} onSettings={() => setShowSettings(true)} />
      </div></header>
      {children}
    </section>
    {showNotifications && <NotificationsPanel onClose={() => setShowNotifications(false)}/>} {showSettings && <SettingsPanel onClose={() => setShowSettings(false)}/>} {showHelp && <HelpPanel onClose={() => setShowHelp(false)}/>} {showLogin && <LoginModal initialMode={loginMode} onClose={() => setShowLogin(false)}/>} 
  </main>;
}

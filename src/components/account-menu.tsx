'use client';
import { ChevronDown, LogIn, LogOut, Settings, UserRound, UsersRound } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { initialsFor, signOut, useSession } from '@/lib/demo-auth';
import { useI18n } from '@/lib/i18n';

export function AccountMenu({ onLogin, onSettings }: { onLogin: (mode?: 'signin' | 'signup') => void; onSettings: () => void }) {
  const { user } = useSession();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (!open) return; const onKey = (e: KeyboardEvent) => { const items = menuRef.current?.querySelectorAll<HTMLButtonElement>('button'); if (!items?.length) return; if (e.key === 'Escape') { e.preventDefault(); setOpen(false); triggerRef.current?.focus(); } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); const arr = [...items]; const i = arr.indexOf(document.activeElement as HTMLButtonElement); const next = e.key === 'ArrowDown' ? (i + 1 + arr.length) % arr.length : (i - 1 + arr.length) % arr.length; arr[next]?.focus(); } }; document.addEventListener('keydown', onKey); return () => document.removeEventListener('keydown', onKey); }, [open]);
  useEffect(() => { if (!open) return; const onPointer = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node) && triggerRef.current && !triggerRef.current.contains(e.target as Node)) setOpen(false); }; document.addEventListener('mousedown', onPointer); return () => document.removeEventListener('mousedown', onPointer); }, [open]);
  const label = user?.name || user?.email || t('account.account');
  if (!user) return <button type="button" className="account-login-button" onClick={() => onLogin('signin')}><LogIn size={17} /> <span>{t('account.login')}</span></button>;
  return <div className="account-menu-wrap" ref={menuRef}>
    <button ref={triggerRef} type="button" className="account-trigger" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((x) => !x)}>
      <span className="avatar">{initialsFor(user)}</span><span className="profile"><strong>{label}</strong><span>{user.role}</span></span><ChevronDown size={16} aria-hidden="true" />
    </button>
    {open && <div className="account-menu" role="menu">
      <button type="button" role="menuitem" onClick={() => { setOpen(false); onSettings(); }}><Settings size={16} /> {t('account.profileSettings')}</button>
      <button type="button" role="menuitem" onClick={() => { setOpen(false); signOut(); setTimeout(() => onLogin('signin'), 0); }}><UsersRound size={16} /> {t('account.switchAccount')}</button>
      <button type="button" role="menuitem" onClick={() => { setOpen(false); signOut(); }}><LogOut size={16} /> {t('account.signOut')}</button>
      <span className="account-menu-email"><UserRound size={14} /> {user.email}</span>
    </div>}
  </div>;
}

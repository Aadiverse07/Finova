'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type CSSProperties, type RefObject } from 'react';
import {
  ArrowDownRight,
  ArrowLeftRight,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Box,
  Check,
  ChevronDown,
  CreditCard,
  Globe,
  LayoutGrid,
  Asterisk,
  Play,
  Receipt,
  Send,
  ShieldCheck,
  Loader2,
  Menu,
  ShoppingBag,
  TrendingUp,
  WalletCards,
  X,
  Zap,
} from 'lucide-react';
import { FinovaLogo, FinovaMark } from '@/components/finova-logo';
import { ThemeToggle } from '@/components/theme-toggle';
import { CardActionModal, type CardAction } from '@/components/card-action-modals';
import { LoginModal } from '@/components/login-modal';
import { AssistantLauncher } from '@/components/assistant-launcher';
import { HomeSections, NAV } from '@/components/home-sections';
import './home.css';
import './home-sections.css';

/* ---------- data ---------- */

const FEATURES = [
  { icon: ShieldCheck, title: 'Secure by design', text: 'Your money and data are protected with industry-leading security.' },
  { icon: Zap, title: 'Built for speed', text: 'Move money instantly, anytime, anywhere.' },
  { icon: TrendingUp, title: 'Grow with confidence', text: 'Tools and insights to help you reach your goals.' },
  { icon: Globe, title: 'Global ready', text: 'Send, receive, and spend across borders with ease.' },
];

const STEPS = [
  { title: 'Set up in minutes', text: 'Create your chart of accounts and connect the way you already work.' },
  { title: 'Record every movement', text: 'Invoices, expenses and journal entries post to a balanced double-entry ledger.' },
  { title: 'See the whole picture', text: 'Live dashboards and reports show cash flow, balances and what needs attention.' },
];

const MONTHS = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'];

/* ---------- helpers ---------- */

function smoothPath(pts: [number, number][]) {
  const first = pts[0];
  if (!first) return '';
  let d = `M${first[0]},${first[1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p1 = pts[i] ?? first;
    const p0 = pts[i - 1] ?? p1;
    const p2 = pts[i + 1] ?? p1;
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2[0]},${p2[1]}`;
  }
  return d;
}

type Tone = 'green' | 'red' | 'blue' | 'purple';

function buildChart(pts: [number, number][]) {
  const line = smoothPath(pts);
  const end: [number, number] = pts[pts.length - 1] ?? [0, 132];
  return { line, area: `${line} L${end[0]},132 L0,132 Z`, end };
}

/** Demo figures. Net Balance = Total Income - Total Expenses. */
const CARDS = [
  {
    key: 'income', label: 'Total Income', value: '₹ 2,48,500', change: '12%', up: true, tone: 'green' as Tone, icon: ArrowUpRight,
    tip: '₹2.49L', from: '#8a5cf6', to: '#10d7a2',
    chart: buildChart([[0, 118], [28, 108], [56, 100], [84, 104], [112, 110], [140, 92], [168, 76], [196, 80], [222, 86], [250, 66], [278, 50], [306, 46], [336, 42], [372, 36]]),
  },
  {
    key: 'expenses', label: 'Total Expenses', value: '₹ 1,36,200', change: '8%', up: false, tone: 'red' as Tone, icon: ArrowDownRight,
    tip: '₹1.36L', from: '#ff9a5c', to: '#ff5f79',
    chart: buildChart([[0, 96], [28, 90], [56, 98], [84, 84], [112, 88], [140, 74], [168, 80], [196, 66], [222, 72], [250, 62], [278, 68], [306, 54], [336, 58], [372, 48]]),
  },
  {
    key: 'outstanding', label: 'Outstanding Invoice', value: '₹ 64,800', change: '5%', up: true, tone: 'blue' as Tone, icon: Receipt,
    tip: '₹64.8K', from: '#6d7bff', to: '#4f9bff',
    chart: buildChart([[0, 100], [28, 104], [56, 92], [84, 96], [112, 82], [140, 88], [168, 96], [196, 84], [222, 70], [250, 76], [278, 66], [306, 72], [336, 60], [372, 56]]),
  },
  {
    key: 'net', label: 'Net Balance', value: '₹ 1,12,300', change: '15%', up: true, tone: 'purple' as Tone, icon: WalletCards,
    tip: '₹1.12L', from: '#8a5cf6', to: '#b184ff',
    chart: buildChart([[0, 120], [28, 112], [56, 104], [84, 108], [112, 96], [140, 98], [168, 84], [196, 78], [222, 82], [250, 64], [278, 58], [306, 50], [336, 44], [372, 34]]),
  },
];

/** Smoothly eases CSS vars --px/--py (-1..1) toward the mouse position. Mouse + motion-OK devices only. */
function useParallax(ref: RefObject<HTMLElement>) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!fine || reduce) return;

    let tx = 0, ty = 0, cx = 0, cy = 0, raf = 0;
    const tick = () => {
      cx += (tx - cx) * 0.07;
      cy += (ty - cy) * 0.07;
      el.style.setProperty('--px', cx.toFixed(4));
      el.style.setProperty('--py', cy.toFixed(4));
      raf = Math.abs(tx - cx) > 0.001 || Math.abs(ty - cy) > 0.001 ? requestAnimationFrame(tick) : 0;
    };
    const kick = () => { if (!raf) raf = requestAnimationFrame(tick); };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      tx = (e.clientX / window.innerWidth - 0.5) * 2;
      ty = (e.clientY / window.innerHeight - 0.5) * 2;
      kick();
    };
    const onLeave = () => { tx = 0; ty = 0; kick(); };

    window.addEventListener('pointermove', onMove, { passive: true });
    document.documentElement.addEventListener('mouseleave', onLeave);
    return () => {
      window.removeEventListener('pointermove', onMove);
      document.documentElement.removeEventListener('mouseleave', onLeave);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [ref]);
}

function SlideCard({ card, index }: { card: (typeof CARDS)[number]; index: number }) {
  const { chart } = card;
  const id = `lp-${card.key}`;
  return (
    <div className={`lp-slide tone-${card.tone}`} style={{ '--i': index } as CSSProperties}>
      <div className="lp-card-head">
        <div>
          <span className="lp-card-label">{card.label}</span>
          <strong className="lp-card-amount">{card.value}</strong>
          <span className="lp-card-delta">
            <b>{card.up ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />} {card.change}</b>
            <em>vs last month</em>
          </span>
        </div>
        <span className="lp-card-icon"><card.icon size={20} /></span>
      </div>

      <div className="lp-chart">
        <svg viewBox="0 0 400 150" preserveAspectRatio="xMidYMid meet">
          <defs>
            <linearGradient id={`${id}-line`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor={card.from} />
              <stop offset="1" stopColor={card.to} />
            </linearGradient>
            <linearGradient id={`${id}-area`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={card.to} stopOpacity="0.4" />
              <stop offset="1" stopColor={card.to} stopOpacity="0" />
            </linearGradient>
            <linearGradient id={`${id}-drop`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={card.to} stopOpacity="0.9" />
              <stop offset="1" stopColor={card.to} stopOpacity="0" />
            </linearGradient>
          </defs>
          {[40, 100, 160, 220, 280, 340].map((x) => (
            <line key={x} x1={x} y1="20" x2={x} y2="132" className="lp-grid-line" strokeDasharray="2 4" />
          ))}
          <path d={chart.area} fill={`url(#${id}-area)`} className="lp-area" />
          <path d={chart.line} fill="none" stroke={`url(#${id}-line)`} strokeWidth="3" strokeLinecap="round" pathLength={1} className="lp-stroke" />
          <rect x={chart.end[0] - 1} y={chart.end[1]} width="2" height={132 - chart.end[1]} fill={`url(#${id}-drop)`} />
          <circle cx={chart.end[0]} cy={chart.end[1]} r="9" fill={card.to} opacity="0.22" />
          <circle cx={chart.end[0]} cy={chart.end[1]} r="4.5" fill={card.to} className="lp-dot-ring" strokeWidth="1.5" />
          <rect x="336" y="2" width="60" height="24" rx="7" fill="rgba(20,28,70,.9)" stroke="rgba(150,165,255,.35)" />
          <text x="366" y="18" textAnchor="middle" fontSize="13" fontWeight="600" fill="#fff">{card.tip}</text>
        </svg>
        <div className="lp-months">
          {MONTHS.map((m) => <span key={m}>{m}</span>)}
        </div>
      </div>
    </div>
  );
}

/* ---------- page ---------- */

export default function HomePage() {
  const [open, setOpen] = useState<string | null>(null);
  const [showHow, setShowHow] = useState(false);
  const [action, setAction] = useState<CardAction | null>(null);
  const [loadingNav, setLoadingNav] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const router = useRouter();
  useEffect(() => {
    const reset = () => setLoadingNav(false);
    window.addEventListener('pageshow', reset);
    return () => window.removeEventListener('pageshow', reset);
  }, []);
  const goAnalytics = () => { setLoadingNav(true); router.push('/reports'); };
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileGroup, setMobileGroup] = useState<string | null>(null);
  const closeAll = () => { setOpen(null); setMobileOpen(false); };
  const navRef = useRef<HTMLElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  const visualRef = useRef<HTMLDivElement>(null);
  useParallax(visualRef);
  useEffect(() => {
    const focusHash = () => { const id = window.location.hash.slice(1); if (!id) return; const target = document.getElementById(id); if (target) { target.setAttribute('tabindex', '-1'); window.requestAnimationFrame(() => target.focus({ preventScroll: true })); } };
    focusHash(); window.addEventListener('hashchange', focusHash); return () => window.removeEventListener('hashchange', focusHash);
  }, []);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) setOpen(null);
      if (headerRef.current && !headerRef.current.contains(e.target as Node)) setMobileOpen(false);
    };
    const onResize = () => { if (window.innerWidth > 860) setMobileOpen(false); };
    window.addEventListener('resize', onResize);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(null);
        setMobileOpen(false);
        setShowHow(false);
        setAction(null);
      }
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  return (
    <main className="lp">
      <div className="lp-glow lp-glow-a" aria-hidden="true" />
      <div className="lp-glow lp-glow-b" aria-hidden="true" />

      {/* top bar */}
      <header className="lp-header" ref={headerRef}>
        <FinovaLogo className="lp-logo" />

        <nav className="lp-nav" ref={navRef} aria-label="Main navigation">
          {NAV.map((entry) =>
            entry.items ? (
              <div className="lp-nav-group" key={entry.label}>
                <button
                  type="button"
                  className={`lp-nav-link ${open === entry.label ? 'is-open' : ''}`}
                  aria-expanded={open === entry.label}
                  aria-haspopup="true"
                  onClick={() => setOpen(open === entry.label ? null : entry.label)}
                >
                  {entry.label} <ChevronDown size={15} />
                </button>
                <div className={`lp-menu ${open === entry.label ? 'is-open' : ''}`} role="menu" aria-hidden={open !== entry.label}>
                  {entry.items.map((item) => (
                    <a
                      key={item.label}
                      href={item.href}
                      role="menuitem"
                      tabIndex={open === entry.label ? 0 : -1}
                      className="lp-menu-item"
                      onClick={closeAll}
                    >
                      <span className="lp-menu-icon"><item.icon size={17} /></span>
                      <span>
                        <strong>{item.label}</strong>
                        <small>{item.desc}</small>
                      </span>
                    </a>
                  ))}
                </div>
              </div>
            ) : (
              <a href={entry.href} className="lp-nav-link" key={entry.label} onClick={closeAll}>
                {entry.label}
              </a>
            ),
          )}
        </nav>

        <div className="lp-header-actions">
          <button type="button" className="lp-login-btn" onClick={() => { setMobileOpen(false); setShowLogin(true); }}>Login</button>
          <Link href="/dashboard" className="lp-cta lp-cta-sm">Get Started</Link>
          <AssistantLauncher home />
          <ThemeToggle />
          <button
            type="button"
            className="lp-burger"
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileOpen}
            aria-controls="lp-mobile-nav"
            onClick={() => setMobileOpen((v) => !v)}
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        <nav id="lp-mobile-nav" className={`lp-mobile ${mobileOpen ? 'is-open' : ''}`} aria-label="Mobile navigation" aria-hidden={!mobileOpen}>
          {NAV.map((entry) =>
            entry.items ? (
              <div key={entry.label} className="lp-mobile-group">
                <button
                  type="button"
                  className={`lp-mobile-link ${mobileGroup === entry.label ? 'is-open' : ''}`}
                  aria-expanded={mobileGroup === entry.label}
                  tabIndex={mobileOpen ? 0 : -1}
                  onClick={() => setMobileGroup(mobileGroup === entry.label ? null : entry.label)}
                >
                  {entry.label} <ChevronDown size={16} />
                </button>
                <div className={`lp-mobile-sub ${mobileGroup === entry.label ? 'is-open' : ''}`}>
                  <div>
                    {entry.items.map((item) => (
                      <a key={item.label} href={item.href} tabIndex={mobileOpen && mobileGroup === entry.label ? 0 : -1} onClick={closeAll}>
                        <item.icon size={16} /> {item.label}
                      </a>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <a key={entry.label} href={entry.href} className="lp-mobile-link" tabIndex={mobileOpen ? 0 : -1} onClick={closeAll}>
                {entry.label}
              </a>
            ),
          )}
        </nav>
      </header>

      {/* hero */}
      <section className="lp-hero">
        <div className="lp-hero-copy">
          <p className="lp-eyebrow">A BRIGHTER FINANCIAL TOMORROW</p>
          <h1>
            Smart money,<br />
            <span className="lp-grad">beautifully</span> simple.
          </h1>
          <p className="lp-lead">
            Finova helps individuals and businesses manage, grow,<br className="lp-br" />
            and move money with confidence.
          </p>

          <div className="lp-buttons">
            <Link href="/dashboard" className="lp-cta lp-cta-lg">
              Get Started Free <ArrowRight size={17} />
            </Link>
            <button type="button" className="lp-ghost" onClick={() => setShowHow(true)}>
              <Play size={15} /> See How It Works
            </button>
          </div>

          <ul className="lp-checks">
            <li><Check size={15} /> No hidden fees</li>
            <li><Check size={15} /> Bank-level security</li>
            <li><Check size={15} /> Set up in minutes</li>
          </ul>
        </div>

        {/* product preview (decorative): floating metric card with mouse parallax */}
        <div className={`lp-visual ${action || showHow ? 'is-paused' : ''}`} ref={visualRef}>
          <div className="lp-scene">
            <div className="lp-layer lp-layer-ring" aria-hidden="true"><div className="lp-ring" /></div>

            <div className="lp-layer lp-layer-back" aria-hidden="true">
              <div className="lp-card-back">
                <FinovaMark size={30} />
                <p>Better money brighter days.</p>
                <span />
              </div>
            </div>

            <div className="lp-layer lp-layer-main">
              <div className="lp-tilt">
                <div className="lp-slides" aria-hidden="true">
                  {CARDS.map((card, i) => <SlideCard key={card.key} card={card} index={i} />)}
                </div>
                <div className="lp-actions" role="group" aria-label="Quick actions">
                  <button type="button" onClick={() => setAction('send')}><span><Send size={18} /></span>Send</button>
                  <button type="button" onClick={() => setAction('exchange')}><span><ArrowLeftRight size={18} /></span>Exchange</button>
                  <button type="button" onClick={goAnalytics} disabled={loadingNav} aria-busy={loadingNav}>
                    <span>{loadingNav ? <Loader2 size={18} className="lp-spin" /> : <BarChart3 size={18} />}</span>
                    {loadingNav ? 'Opening…' : 'Analytics'}
                  </button>
                  <button type="button" onClick={() => setAction('cards')}><span><CreditCard size={18} /></span>Cards</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* feature cards */}
      <section className="lp-features" aria-label="Why Finova">
        {FEATURES.map((f) => (
          <article className="lp-feature" key={f.title}>
            <f.icon size={30} strokeWidth={1.6} />
            <h3>{f.title}</h3>
            <p>{f.text}</p>
          </article>
        ))}
      </section>

      {/* trusted by (placeholder marks) */}
      <section className="lp-trusted" aria-label="Trusted by">
        <p>TRUSTED BY INDIVIDUALS AND BUSINESSES WORLDWIDE</p>
        <div className="lp-logos">
          <span className="w-stripe">stripe</span>
          <span className="w-shopify"><ShoppingBag size={22} />shopify</span>
          <span className="w-coinbase">coinbase</span>
          <span className="w-notion"><b>N</b>Notion</span>
          <span className="w-slack"><LayoutGrid size={20} />Slack</span>
          <span className="w-dropbox"><Box size={20} />Dropbox</span>
          <span className="w-revolut">revolut</span>
          <span className="w-loom"><Asterisk size={24} />loom</span>
        </div>
      </section>

      <HomeSections />

      {action && <CardActionModal kind={action} onClose={() => setAction(null)} />}
      {showLogin && <LoginModal onClose={() => setShowLogin(false)} />}

      {/* how it works modal */}
      {showHow && (
        <div className="lp-modal-wrap" onMouseDown={() => setShowHow(false)}>
          <div
            className="lp-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="lp-how-title"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <button type="button" className="lp-modal-x" aria-label="Close" onClick={() => setShowHow(false)}>
              <X size={18} />
            </button>
            <h2 id="lp-how-title">How Finova works</h2>
            <ol>
              {STEPS.map((s, i) => (
                <li key={s.title}>
                  <span>{i + 1}</span>
                  <div><strong>{s.title}</strong><p>{s.text}</p></div>
                </li>
              ))}
            </ol>
            <Link href="/dashboard" className="lp-cta lp-cta-lg">
              Open Dashboard <ArrowRight size={17} />
            </Link>
          </div>
        </div>
      )}
    </main>
  );
}

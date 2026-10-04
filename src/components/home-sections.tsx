import Link from 'next/link';
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  Briefcase,
  Check,
  Compass,
  FileText,
  LayoutDashboard,
  LifeBuoy,
  Mail,
  PieChart,
  Receipt,
  Rocket,
  ShoppingBag,
  Sprout,
  Target,
  Users,
  Activity,
  Scale,
  type LucideIcon,
} from 'lucide-react';
import { FinovaLogo } from '@/components/finova-logo';

/* ---------- shared nav data (used by the header, the mobile menu and the footer) ---------- */

export type NavItem = { label: string; desc: string; href: string; icon: LucideIcon };
export type NavEntry = { label: string; href: string; items?: NavItem[] };

export const NAV: NavEntry[] = [
  {
    label: 'Product',
    href: '#product',
    items: [
      { label: 'Accounting Dashboard', desc: 'Your financial workspace', href: '#product-dashboard', icon: LayoutDashboard },
      { label: 'Double-Entry Accounting', desc: 'Balanced journal & ledger', href: '#product-double-entry', icon: Scale },
      { label: 'Invoicing', desc: 'Bill and track payments', href: '#product-invoicing', icon: Receipt },
      { label: 'Expense Management', desc: 'Record business spend', href: '#product-expenses', icon: ShoppingBag },
      { label: 'Financial Reports', desc: 'P&L, balance sheet, more', href: '#product-reports', icon: FileText },
      { label: 'Chart of Accounts', desc: 'Organise your books', href: '#product-accounts', icon: BookOpen },
      { label: 'Financial Analytics', desc: 'Trends and cash-flow insight', href: '#product-analytics', icon: BarChart3 },
    ],
  },
  {
    label: 'Solutions',
    href: '#solutions',
    items: [
      { label: 'Small Businesses', desc: 'Books that keep up with you', href: '#solution-small-business', icon: Briefcase },
      { label: 'Startups', desc: 'Investor-ready from day one', href: '#solution-startups', icon: Rocket },
      { label: 'Freelancers', desc: 'Invoices and expenses, simplified', href: '#solution-freelancers', icon: Sprout },
      { label: 'Finance Teams', desc: 'Controls, audit trail, close', href: '#solution-finance-teams', icon: Users },
      { label: 'Growing Businesses', desc: 'Scale without re-platforming', href: '#solution-growing', icon: Target },
    ],
  },
  { label: 'Pricing', href: '#pricing' },
  {
    label: 'Company',
    href: '#company',
    items: [
      { label: 'About Finova', desc: 'Who we are', href: '/about', icon: Compass },
      { label: 'Mission', desc: 'Why we build', href: '/mission', icon: Target },
      { label: 'Product Vision', desc: 'Where Finova is heading', href: '/vision', icon: Rocket },
      { label: 'Contact', desc: 'Get in touch', href: '/contact', icon: Mail },
      { label: 'Support', desc: 'Docs and help', href: '/support', icon: LifeBuoy },
    ],
  },
];

/* ---------- content ---------- */

const PRODUCTS = [
  { id: 'product-dashboard', icon: LayoutDashboard, title: 'Accounting Dashboard', text: 'Income, expenses, cash position and what needs attention, in one live workspace.', href: '/dashboard', cta: 'Open dashboard' },
  { id: 'product-double-entry', icon: Scale, title: 'Double-Entry Accounting', text: 'Every entry must balance before it posts, so debits always equal credits and your books stay trustworthy.', href: '/journal', cta: 'Open journal' },
  { id: 'product-invoicing', icon: Receipt, title: 'Invoicing', text: 'Create invoices, track what is outstanding and post revenue straight to the ledger.', href: '/invoices', cta: 'Open invoices' },
  { id: 'product-expenses', icon: ShoppingBag, title: 'Expense Management', text: 'Record business spend by category so costs land in the right accounts automatically.', href: '/expenses', cta: 'Open expenses' },
  { id: 'product-reports', icon: FileText, title: 'Financial Reports', text: 'Profit & loss, balance sheet and trial balance generated from the same ledger you work in.', href: '/reports', cta: 'Open reports' },
  { id: 'product-accounts', icon: BookOpen, title: 'Chart of Accounts', text: 'Organise assets, liabilities, equity, income and expenses in a structure that fits your business.', href: '/accounts', cta: 'Open accounts' },
  { id: 'product-analytics', icon: PieChart, title: 'Financial Analytics', text: 'Trends, comparisons and cash-flow views that turn bookkeeping into decisions.', href: '/dashboard', cta: 'See analytics' },
];

const SOLUTIONS = [
  { id: 'solution-small-business', icon: Briefcase, title: 'Small Businesses', text: 'Replace spreadsheets with a ledger that balances itself. Invoice customers, log expenses and see profit at a glance without an accounting degree.' },
  { id: 'solution-startups', icon: Rocket, title: 'Startups', text: 'Keep clean, double-entry books from the first transaction so fundraising, audits and diligence never turn into a clean-up project.' },
  { id: 'solution-freelancers', icon: Sprout, title: 'Freelancers', text: 'Send professional invoices, track who has paid and separate business spend from personal, with reports ready at tax time.' },
  { id: 'solution-finance-teams', icon: Users, title: 'Finance Teams', text: 'Role-based access, an audit trail on every change and consistent reports give your team control over the month-end close.' },
  { id: 'solution-growing', icon: Target, title: 'Growing Businesses', text: 'A flexible chart of accounts and organisation-level separation let you add entities, teams and volume without switching tools.' },
];

type Plan = { name: string; price: string; period: string; blurb: string; features: string[]; cta: string; featured?: boolean };

/** DEMO / EXAMPLE pricing only. Finova has no published commercial price list. */
const PLANS: Plan[] = [
  { name: 'Starter', price: '₹0', period: '/month', blurb: 'For individuals getting organised.', features: ['Accounting dashboard', 'Chart of accounts', 'Up to 25 invoices / month', 'Basic reports'], cta: 'Get Started' },
  { name: 'Growth', price: '₹999', period: '/month', blurb: 'For small teams that need the full books.', features: ['Everything in Starter', 'Unlimited invoices & expenses', 'Double-entry journal', 'Full financial reports'], cta: 'Choose Plan', featured: true },
  { name: 'Business', price: '₹2,499', period: '/month', blurb: 'For finance teams that need control.', features: ['Everything in Growth', 'Multiple users & roles', 'Audit trail', 'Financial analytics'], cta: 'Choose Plan' },
];

const SUPPORT = [
  { icon: BookOpen, title: 'API documentation', text: 'Interactive reference for the Finova API.', href: '/support#api-docs', cta: 'Open API docs' },
  { icon: Activity, title: 'System status', text: 'Live health check of the Finova service.', href: '/status', cta: 'View status' },
  { icon: LayoutDashboard, title: 'Try the workspace', text: 'Explore the dashboard to see Finova in action.', href: '/dashboard', cta: 'Open dashboard' },
];

/* ---------- sections ---------- */

function Head({ id, eyebrow, title, text }: { id: string; eyebrow: string; title: string; text?: string }) {
  return (
    <div className="lp-sec-head">
      <p className="lp-eyebrow">{eyebrow}</p>
      <h2 id={id}>{title}</h2>
      {text && <p className="lp-sec-lead">{text}</p>}
    </div>
  );
}

export function HomeSections() {
  return (
    <>
      <section id="product" className="lp-sec" aria-labelledby="product-title">
        <Head id="product-title" eyebrow="PRODUCT" title="Everything your books need" text="One connected double-entry system, from the first invoice to the final report." />
        <div className="lp-grid lp-grid-prod">
          {PRODUCTS.map((p) => (
            <article id={p.id} key={p.id} className="lp-card">
              <span className="lp-card-ico"><p.icon size={22} strokeWidth={1.7} /></span>
              <h3>{p.title}</h3>
              <p>{p.text}</p>
              <Link href={p.href} className="lp-link">{p.cta} <ArrowRight size={15} /></Link>
            </article>
          ))}
        </div>
      </section>

      <section id="solutions" className="lp-sec" aria-labelledby="solutions-title">
        <Head id="solutions-title" eyebrow="SOLUTIONS" title="Built for the way you work" text="Whoever keeps the books, Finova adapts to the job." />
        <div className="lp-grid lp-grid-sol">
          {SOLUTIONS.map((s) => (
            <article id={s.id} key={s.id} className="lp-card">
              <span className="lp-card-ico"><s.icon size={22} strokeWidth={1.7} /></span>
              <h3>{s.title}</h3>
              <p>{s.text}</p>
              <Link href="/dashboard" className="lp-link">Get started <ArrowRight size={15} /></Link>
            </article>
          ))}
        </div>
      </section>

      <section id="pricing" className="lp-sec" aria-labelledby="pricing-title">
        <Head id="pricing-title" eyebrow="PRICING" title="Simple, example pricing" />
        <p className="lp-demo-note" role="note">
          <strong>Demo pricing.</strong> These plans and prices are illustrative examples only, not real commercial pricing.
        </p>
        <div className="lp-grid lp-grid-plans">
          {PLANS.map((p) => (
            <article key={p.name} className={`lp-card lp-plan ${p.featured ? 'is-featured' : ''}`}>
              {p.featured && <span className="lp-badge">Most popular</span>}
              <h3>{p.name}</h3>
              <p className="lp-plan-blurb">{p.blurb}</p>
              <p className="lp-price"><strong>{p.price}</strong><span>{p.period}</span></p>
              <ul>
                {p.features.map((f) => <li key={f}><Check size={15} /> {f}</li>)}
              </ul>
              <Link href="/dashboard" className={p.featured ? 'lp-cta lp-cta-lg' : 'lp-ghost lp-plan-btn'}>{p.cta}</Link>
            </article>
          ))}
        </div>
      </section>

      <section id="company" className="lp-sec" aria-labelledby="company-title">
        <Head id="company-title" eyebrow="COMPANY" title="About Finova" />
        <div className="lp-grid lp-grid-co">
          <article id="about" className="lp-card">
            <span className="lp-card-ico"><Compass size={22} strokeWidth={1.7} /></span>
            <h3>About Finova</h3>
            <p>Finova is an accounting workspace built on proper double-entry bookkeeping, designed to feel simple enough for anyone to use.</p>
          </article>
          <article id="mission" className="lp-card">
            <span className="lp-card-ico"><Target size={22} strokeWidth={1.7} /></span>
            <h3>Mission</h3>
            <p>Give every business accurate, understandable books, so owners spend their time growing instead of reconciling.</p>
          </article>
          <article id="vision" className="lp-card">
            <span className="lp-card-ico"><Rocket size={22} strokeWidth={1.7} /></span>
            <h3>Product Vision</h3>
            <p>One trusted ledger at the centre, with invoicing, expenses, reports and analytics all reading from the same source of truth.</p>
          </article>
        </div>
      </section>

      <section id="contact" className="lp-sec lp-sec-tight" aria-label="Contact and support">
        <div className="lp-grid lp-grid-two">
          <article className="lp-card lp-contact">
            <span className="lp-card-ico"><Mail size={22} strokeWidth={1.7} /></span>
            <h3>Contact</h3>
            <p>Questions about Finova? Send us a note and we will point you in the right direction.</p>
            {/* Placeholder address on a reserved example domain; replace with the real contact. */}
            <a href={`mailto:${process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'support@finova.example'}`} className="lp-link">{process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'support@finova.example'} <ArrowRight size={15} /></a>
            <small>Support contact is configured through NEXT_PUBLIC_SUPPORT_EMAIL.</small>
          </article>
          <article id="support" className="lp-card">
            <span className="lp-card-ico"><LifeBuoy size={22} strokeWidth={1.7} /></span>
            <h3>Support</h3>
            <ul className="lp-support">
              {SUPPORT.map((s) => (
                <li key={s.title}>
                  <s.icon size={17} />
                  <div><strong>{s.title}</strong><span>{s.text}</span></div>
                  <Link href={s.href} className="lp-link">{s.cta}</Link>
                </li>
              ))}
            </ul>
          </article>
        </div>
      </section>

      <footer className="lp-footer">
        <div className="lp-footer-top">
          <FinovaLogo className="lp-logo" />
          <nav aria-label="Footer navigation" className="lp-footer-nav">
            {NAV.map((g) => (
              <Link key={g.label} href={g.href}>{g.label}</Link>
            ))}
            <Link href="/dashboard">Dashboard</Link>
          </nav>
        </div>
        <p>© {new Date().getFullYear()} Finova. Pricing shown is for demonstration only.</p>
      </footer>
    </>
  );
}

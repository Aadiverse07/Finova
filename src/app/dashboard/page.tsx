'use client';

import Link from 'next/link';
import { FinanceModuleShell } from '@/components/finance-module-shell';
import { useSession } from '@/lib/demo-auth';
import { useI18n } from '@/lib/i18n';
import { AlertsStrip } from '@/components/alerts/alerts-strip';
import { ArrowDownRight, ArrowUpRight, ChevronDown, ChevronRight, FileBarChart, FileText, LayoutDashboard, Plus, Receipt, Landmark, Sparkles, Activity, ShoppingBag, SlidersHorizontal } from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const cashFlow = [
  { month: 'Apr', income: 95000, expenses: 52000 },
  { month: 'May', income: 145000, expenses: 82000 },
  { month: 'Jun', income: 118000, expenses: 72000 },
  { month: 'Jul', income: 165000, expenses: 98000 },
  { month: 'Aug', income: 205000, expenses: 132000 },
  { month: 'Sep', income: 235000, expenses: 165000 },
];

const expenseBreakdown = [
  { name: 'Rent', value: 32, color: '#4f8cff' },
  { name: 'Salaries', value: 24, color: '#8b5cf6' },
  { name: 'Utilities', value: 12, color: '#10b981' },
  { name: 'Marketing', value: 10, color: '#fbbf24' },
  { name: 'Other', value: 22, color: '#94a3b8' },
];

const accounts = [
  { name: 'HDFC Bank', type: 'Current Account', value: '₹ 1,24,560', icon: 'H' },
  { name: 'ICICI Bank', type: 'Savings Account', value: '₹ 86,230', icon: 'I' },
  { name: 'Axis Bank', type: 'Business Account', value: '₹ 43,750', icon: 'A' },
  { name: 'Cash in Hand', type: 'Petty Cash', value: '₹ 12,600', icon: '₹' },
];

const activity = [
  { title: 'Invoice #INV-0042', sub: 'ABC Enterprises', amount: '+ ₹ 45,000', time: 'Today, 10:24 AM', kind: 'income' },
  { title: 'Expense: Office Supplies', sub: 'Amazon', amount: '- ₹ 2,850', time: 'Today, 09:12 AM', kind: 'expense' },
  { title: 'Journal Entry', sub: 'Adjustment', amount: '- ₹ 5,000', time: 'Yesterday, 04:36 PM', kind: 'journal' },
  { title: 'Invoice #INV-0041', sub: 'XYZ Traders', amount: '+ ₹ 28,500', time: 'Yesterday, 11:20 AM', kind: 'income' },
];

function money(value: number) {
  return `₹ ${value.toLocaleString('en-IN')}`;
}

function StatCard({
  title,
  value,
  change,
  icon,
  tone,
}: {
  title: string;
  value: string;
  change: string;
  icon: React.ReactNode;
  tone: 'green' | 'red' | 'blue' | 'purple';
}) {
  return (
    <div className={`stat-card stat-${tone}`}>
      <div className="stat-top">
        <span className="icon-bubble">{icon}</span>
        <button type="button" className="more-button" aria-label={`${title} options (coming soon)`} disabled>•••</button>
      </div>
      <p className="stat-title">{title}</p>
      <p className="stat-value">{value}</p>
      <div className="stat-bottom">
        <span className="change-pill"><ArrowUpRight size={13} /> {change}</span>
        <span>vs last month</span>
      </div>
      <div className="sparkline"><span /></div>
    </div>
  );
}

function ActivityIcon({ kind }: { kind: string }) {
  if (kind === 'expense') return <ShoppingBag size={17} />;
  if (kind === 'journal') return <FileText size={17} />;
  return <Receipt size={17} />;
}

export default function DashboardPage() {
  const { user } = useSession();
  const { language } = useI18n();
  const hour = new Date().getHours();
  const greeting = hour < 12 ? (language === 'hi' ? 'सुप्रभात' : language === 'hinglish' ? 'Good morning' : 'Good morning') : hour < 17 ? (language === 'hi' ? 'नमस्कार' : language === 'hinglish' ? 'Good afternoon' : 'Good afternoon') : (language === 'hi' ? 'शुभ संध्या' : language === 'hinglish' ? 'Good evening' : 'Good evening');
  const displayName = user?.name || user?.email?.split('@')[0] || (language === 'hi' ? 'आपके खाते' : language === 'hinglish' ? 'aapke account' : 'your account');
  return (
    <FinanceModuleShell active="dashboard">
        <div className="page">
          <div className="hero-row">
            <div>
              <p className="eyebrow"><LayoutDashboard size={15} /> Financial workspace</p>
              <h1>{greeting}, {displayName}</h1>
              <p className="hero-subtitle">Here&apos;s what&apos;s happening with your business today.</p>
            </div>
            <Link href="/journal" className="primary-button"><Plus size={19} /> New Transaction</Link>
          </div>

          <AlertsStrip />
          <div className="dashboard-grid">
            <section className="main-column">
              <div className="stats-grid">
                <StatCard title="Total Income" value="₹ 2,48,500" change="12%" tone="green" icon={<ArrowUpRight size={20} />} />
                <StatCard title="Total Expenses" value="₹ 1,32,750" change="8%" tone="red" icon={<ArrowDownRight size={20} />} />
                <StatCard title="Outstanding Invoices" value="₹ 86,400" change="15%" tone="blue" icon={<Receipt size={20} />} />
                <StatCard title="Net Balance" value="₹ 1,15,750" change="20%" tone="purple" icon={<Landmark size={20} />} />
              </div>

              <section className="panel cash-panel">
                <div className="panel-header">
                  <div className="panel-title">
                    <span className="section-icon blue"><Activity size={17} /></span>
                    <div><h2>Cash Flow Overview</h2><p>Income vs expenses across the last six months</p></div>
                  </div>
                  <button type="button" className="select-button" disabled title="Fixed range in demo data">Last 6 Months <ChevronDown size={15} /></button>
                </div>
                <div className="legend">
                  <span><i className="dot income-dot" />Income</span>
                  <span><i className="dot expense-dot" />Expenses</span>
                </div>
                <div className="chart-wrap">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={cashFlow} margin={{ top: 8, right: 8, left: -15, bottom: 0 }}>
                      <defs>
                        <linearGradient id="incomeFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#10d7a2" stopOpacity={0.25} />
                          <stop offset="100%" stopColor="#10d7a2" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="expenseFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#4f8cff" stopOpacity={0.18} />
                          <stop offset="100%" stopColor="#4f8cff" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="rgba(148,163,184,.12)" vertical={false} />
                      <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: 'currentColor', fontSize: 13 }} />
                      <YAxis tickFormatter={(v) => `₹${v / 1000}k`} axisLine={false} tickLine={false} tick={{ fill: 'currentColor', fontSize: 13 }} />
                      <Tooltip
                        contentStyle={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 12, color: 'var(--foreground)' }}
                        formatter={(value) => money(Number(value))}
                      />
                      <Area type="monotone" dataKey="income" stroke="#10d7a2" strokeWidth={3} fill="url(#incomeFill)" />
                      <Area type="monotone" dataKey="expenses" stroke="#4f8cff" strokeWidth={3} fill="url(#expenseFill)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </section>

              <div className="bottom-grid">
                <section className="panel">
                  <div className="panel-header compact">
                    <div className="panel-title">
                      <span className="section-icon purple"><FileBarChart size={17} /></span>
                      <h2>Expense Breakdown</h2>
                    </div>
                    <button type="button" className="more-button" aria-label="Expense breakdown options (coming soon)" disabled>•••</button>
                  </div>
                  <div className="donut-row">
                    <div className="donut">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={expenseBreakdown} dataKey="value" nameKey="name" innerRadius={49} outerRadius={73} paddingAngle={2} stroke="none">
                            {expenseBreakdown.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="donut-label"><span>Total Expenses</span><strong>₹ 1,32,750</strong></div>
                    </div>
                    <div className="breakdown-list">
                      {expenseBreakdown.map((item) => (
                        <div key={item.name}><span><i style={{ background: item.color }} />{item.name}</span><strong>{item.value}%</strong></div>
                      ))}
                    </div>
                  </div>
                </section>

                <section className="panel">
                  <div className="panel-header compact">
                    <div className="panel-title">
                      <span className="section-icon blue"><Landmark size={17} /></span>
                      <h2>Top Accounts</h2>
                    </div>
                    <Link href="/accounts" className="view-all">View All</Link>
                  </div>
                  <div className="accounts-list">
                    {accounts.map((account) => (
                      <Link href="/accounts" className="account-row" key={account.name}>
                        <span className="account-logo">{account.icon}</span>
                        <span className="account-copy"><strong>{account.name}</strong><small>{account.type}</small></span>
                        <strong className="account-value">{account.value}</strong>
                        <ChevronRight size={15} />
                      </Link>
                    ))}
                  </div>
                </section>
              </div>
            </section>

            <aside className="right-column">
              <Link href="/invoices" className="quick-action"><span className="quick-icon green"><Receipt size={18} /></span><span><strong>Create Invoice</strong><small>Generate a new invoice</small></span><ChevronRight /></Link>
              <Link href="/expenses" className="quick-action"><span className="quick-icon red"><ShoppingBag size={18} /></span><span><strong>Add Expense</strong><small>Record a business expense</small></span><ChevronRight /></Link>
              <Link href="/forecast" className="quick-action"><span className="quick-icon blue"><Activity size={18} /></span><span><strong>Cash Forecast</strong><small>See where your cash is heading</small></span><ChevronRight /></Link>
              <Link href="/journal" className="quick-action"><span className="quick-icon blue"><FileText size={18} /></span><span><strong>Add Journal Entry</strong><small>Manual ledger entry</small></span><ChevronRight /></Link>

              <section className="panel activity-panel">
                <div className="panel-header compact">
                  <div><h2>Recent Activity</h2><p>Latest transactions and adjustments</p></div>
                  <Link href="/journal" className="view-all">View All</Link>
                </div>
                <div className="activity-list">
                  {activity.map((item) => (
                    <div className="activity-row" key={item.title + item.time}>
                      <span className={`activity-icon ${item.kind}`}><ActivityIcon kind={item.kind} /></span>
                      <span className="activity-copy"><strong>{item.title}</strong><small>{item.sub}</small></span>
                      <span className="activity-meta"><strong className={item.kind === 'expense' || item.kind === 'journal' ? 'negative' : 'positive'}>{item.amount}</strong><small>{item.time}</small></span>
                    </div>
                  ))}
                </div>
              </section>

              <div className="insight-card">
                <div className="insight-top"><Sparkles size={17} /><span>Finova Insight</span></div>
                <strong>Keep your books<br />moving forward.</strong>
                <p>Review open invoices and keep your cash position healthy.</p>
                <Link href="/invoices" className="insight-link"><SlidersHorizontal size={15} /> Review now</Link>
              </div>
            </aside>
          </div>
        </div>

        <footer className="footer"><span>▣ Finova &nbsp; v1.0.0</span><span>Secure · Reliable · Built for You</span><span>Powered by Smart Accounting</span></footer>
    </FinanceModuleShell>
  );
}

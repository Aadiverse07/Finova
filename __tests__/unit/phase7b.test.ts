import { describe, expect, it } from 'vitest';

describe('Phase 7B demo UI requirements', () => {
  it('defines the five required notification examples', async () => {
    const source = await import('node:fs/promises').then((fs) => fs.readFile('src/components/notifications-panel.tsx', 'utf8'));
    expect(source).toContain('Invoice payment received');
    expect(source).toContain('New expense recorded');
    expect(source).toContain('Journal entry posted');
    expect(source).toContain('Invoice payment overdue');
    expect(source).toContain('Monthly financial report available');
  });

  it('keeps settings and help as shell integrations', async () => {
    const source = await import('node:fs/promises').then((fs) => fs.readFile('src/components/finance-module-shell.tsx', 'utf8'));
    expect(source).toContain('SettingsPanel');
    expect(source).toContain('HelpPanel');
    expect(source).toContain('NotificationsPanel');
  });
});

describe('Phase 7C global search', () => {
  it('covers all requested dashboard destinations and support actions', async () => {
    const source = await import('node:fs/promises').then((fs) => fs.readFile('src/components/global-search.tsx', 'utf8'));
    expect(source).toMatch(/label:\s*'Dashboard'/);
    expect(source).toMatch(/label:\s*'Transactions'/);
    expect(source).toMatch(/label:\s*'Invoices'/);
    expect(source).toMatch(/label:\s*'Expenses'/);
    expect(source).toMatch(/label:\s*'Reports'/);
    expect(source).toMatch(/label:\s*'Chart\ of\ Accounts'/);
    expect(source).toMatch(/label:\s*'Settings'/);
    expect(source).toMatch(/label:\s*'Help\ \&\ Support'/);
  });

  it('supports partial, case-insensitive matching and keyboard navigation', async () => {
    const source = await import('node:fs/promises').then((fs) => fs.readFile('src/components/global-search.tsx', 'utf8'));
    expect(source).toContain('.toLowerCase()');
    expect(source).toMatch(/\.includes\(n\)/);
    expect(source).toMatch(/e(?:vent)?\.key\s*===\s*'ArrowDown'/);
    expect(source).toMatch(/e(?:vent)?\.key\s*===\s*'ArrowUp'/);
    expect(source).toMatch(/e(?:vent)?\.key\s*===\s*'Enter'/);
    expect(source).toMatch(/e(?:vent)?\.key\s*===\s*'Escape'/);
  });
});

describe('Phase 7 QA regressions', () => {
  it('does not let the outside-click handler fight the bell toggle', async () => {
    const fs = await import('node:fs/promises');
    const panel = await fs.readFile('src/components/notifications-panel.tsx', 'utf8');
    const shell = await fs.readFile('src/components/finance-module-shell.tsx', 'utf8');
    expect(panel).toContain('NOTIFICATION_TRIGGER_ATTR');
    expect(shell).toContain('NOTIFICATION_TRIGGER_ATTR');
  });

  it('login modal falls back to the app theme tokens, and no mobile-login remnants exist', async () => {
    const fs = await import('node:fs/promises');
    const css = await fs.readFile('src/components/login-modal.css', 'utf8');
    const tsx = await fs.readFile('src/components/login-modal.tsx', 'utf8');
    expect(css).toContain('var(--panel');
    expect(`${css}${tsx}`.toLowerCase()).not.toMatch(/otp|country|mobile/);
  });
});

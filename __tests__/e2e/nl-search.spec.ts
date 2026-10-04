import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('NL search opens filtered expense records and has no serious accessibility violations', async ({ page }) => {
  await page.goto('/expenses');
  const search = page.getByRole('combobox', { name: /global search and financial questions/i });
  await search.fill('Show me everything I spent on marketing during September');
  await expect(page.getByRole('button', { name: /Ask:/i })).toBeVisible();
  await page.getByRole('button', { name: /Ask:/i }).click();
  await expect(page.getByText(/Understood as/i)).toBeVisible();
  const axe = await new AxeBuilder({ page }).analyze();
  expect(axe.violations.filter((violation) => violation.impact === 'critical' || violation.impact === 'serious')).toEqual([]);
  await page.getByRole('button', { name: /Open all/i }).first().click();
  await expect(page).toHaveURL(/\/expenses/);
  await expect(page.getByText(/Showing Expenses from your search/i)).toBeVisible();
});

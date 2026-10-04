import { expect, test } from '@playwright/test';

test('forecast renders populated KPIs and a chart in mock mode', async ({ page }) => {
  await page.goto('/forecast');
  await expect(page.getByText('Using demo data')).toBeVisible();
  await expect(page.locator('.forecast-card')).toHaveCount(4);
  await expect(page.getByText('Opening cash')).toBeVisible();
  await expect(page.getByText('Expected incoming')).toBeVisible();
  await expect(page.getByText('Expected outgoing')).toBeVisible();
  await expect(page.getByText('Projected balance')).toBeVisible();
  await expect(page.locator('.forecast-chart').first().locator('svg')).toBeVisible();
});

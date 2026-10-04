import path from 'node:path';
import { expect, test } from '@playwright/test';

test('receipt fixture reaches review state', async ({ page }) => {
  await page.goto('/receipt-scanner');
  const input = page.locator('input[type="file"]');
  await input.setInputFiles(path.join(process.cwd(), '__tests__/fixtures/receipt.png'));
  await expect(page.getByText(/Ready for review|Receipt extracted/i)).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText('Confirm extracted data')).toBeVisible();
});

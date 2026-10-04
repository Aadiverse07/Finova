import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('customer and banking surfaces follow in-app dark theme', async ({ page }) => {
  for (const route of ['/customers','/bank']) {
    await page.goto(route);
    await page.evaluate(() => document.documentElement.classList.add('dark'));
    await expect(page.locator('body')).not.toHaveCSS('background-color', 'rgb(255, 255, 255)');
    const results = await new AxeBuilder({ page }).include('body').analyze();
    expect(results.violations.filter((v) => v.id === 'color-contrast')).toEqual([]);
    await page.screenshot({ path: `test-results/${route.slice(1)}-dark.png`, fullPage: true });
  }
});

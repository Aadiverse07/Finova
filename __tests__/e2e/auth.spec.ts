import { expect, test } from '@playwright/test';

test('login modal exposes sign-in and account-creation modes', async ({ page }) => {
  await page.goto('/dashboard');
  const login = page.getByRole('button', { name: /^Login$/ }).first();
  if (await login.isVisible()) await login.click();
  else { await page.getByRole('button', { name: /Profile|Account/ }).click(); await page.getByRole('menuitem', { name: 'Sign out' }).click(); await page.getByRole('button', { name: /^Login$/ }).click(); }
  await expect(page.getByRole('tab', { name: 'Sign in' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Create new account' })).toBeVisible();
  await page.getByRole('tab', { name: 'Create new account' }).click();
  await expect(page.getByLabel('Full name')).toBeVisible();
  await expect(page.getByLabel('Confirm password')).toBeVisible();
});

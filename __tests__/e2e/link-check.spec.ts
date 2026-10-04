import { expect, test } from '@playwright/test';

test('home Company and Support destinations are real pages', async ({ page }) => {
  await page.goto('/');
  for (const [text, path] of [['About Finova','/about'],['Mission','/mission'],['Product Vision','/vision'],['Contact','/contact'],['Support','/support']] as const) {
    await page.getByRole('button', { name: /Company/ }).click();
    await page.getByRole('menuitem', { name: text }).click();
    await expect(page).toHaveURL(new RegExp(`${path.replace('/','\\/')}(#.*)?$`));
    await page.goBack();
  }
  await page.goto('/');
  await page.getByRole('link', { name: 'Open API docs' }).click();
  await expect(page).toHaveURL(/\/support#api-docs$/);
  await expect(page.locator('#api-docs')).toBeVisible();
  await page.goto('/support');
  await page.getByRole('link', { name: 'View status' }).click();
  await expect(page).toHaveURL(/\/status$/);
  await expect(page.getByRole('heading', { name: 'Service status' })).toBeVisible();
});

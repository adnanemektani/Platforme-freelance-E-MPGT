import { expect, test } from '@playwright/test';
import { credentials, login } from './helpers';

// Affichage mobile : pas de défilement horizontal, menus accessibles, deux entrées visibles.

async function noHorizontalScroll(page: import('@playwright/test').Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
}

test('accueil et inscription sur mobile', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('link', { name: /Je suis une entreprise/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /Je suis freelance/ })).toBeVisible();
  await noHorizontalScroll(page);
  await page.getByRole('button', { name: 'Menu' }).click();
  await expect(page.locator('#menu-mobile').getByRole('link', { name: 'Fonctionnement' })).toBeVisible();
  await page.goto('/inscription/freelance');
  await noHorizontalScroll(page);
});

test('espace freelance sur mobile', async ({ page }) => {
  const creds = credentials('FREELANCER');
  test.skip(!creds, 'Identifiants freelance non fournis');
  await login(page, creds!.email, creds!.password);
  await page.goto('/freelance/paiements', { waitUntil: 'networkidle' });
  await expect(page.locator('h1').first()).toBeVisible();
  await noHorizontalScroll(page);
  await page.getByRole('button', { name: 'Menu' }).click();
  await expect(page.locator('#menu-espace').getByRole('link', { name: 'Activité / CRA' })).toBeVisible();
});

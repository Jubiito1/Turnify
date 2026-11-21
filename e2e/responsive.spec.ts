import { expect, test } from '@playwright/test';
import { accounts, login } from './helpers';

test.describe('mobile layout', () => {
  test('public pages work without horizontal overflow', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Turnos sin vueltas');
    await page.getByRole('link', { name: 'Explorar' }).click();
    await page.getByRole('link', { name: /estudio lumen/i }).click();
    await expect(page.getByRole('heading', { name: 'Estudio Lumen', level: 1 })).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test('admin panel navigation collapses into a drawer', async ({ page }) => {
    await login(page, accounts.admin);
    await page.getByRole('button', { name: 'Abrir menú' }).click();
    const drawer = page.getByRole('dialog', { name: 'Menú' });
    await drawer.getByRole('link', { name: 'Clientes' }).click();
    await expect(page.getByRole('heading', { name: 'Clientes' })).toBeVisible();
  });
});

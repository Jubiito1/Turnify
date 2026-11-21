import { expect, test } from '@playwright/test';
import { login, logout, registerClient } from './helpers';

test.describe('authentication', () => {
  test('registers a client, logs out and logs back in', async ({ page }) => {
    const email = await registerClient(page);
    await expect(page.getByRole('heading', { name: 'Mis reservas' })).toBeVisible();

    await logout(page);
    await login(page, email, 'e2eTurnify1');
    await expect(page).toHaveURL(/\/mis-reservas/);
  });

  test('rejects wrong credentials with a clear message', async ({ page }) => {
    await page.goto('/ingresar');
    await page.getByLabel('Email').fill('cliente@turnify.demo');
    await page.getByLabel('Contraseña').fill('wrong-password-1');
    await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
    await expect(page.getByRole('alert')).toHaveText('Email o contraseña incorrectos');
  });

  test('protects panels and redirects back after login (RN-024)', async ({ page }) => {
    await page.goto('/admin/servicios');
    await expect(page).toHaveURL(/\/ingresar\?next=%2Fadmin%2Fservicios/);
    await page.getByRole('button', { name: 'Administrador' }).click();
    await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
    await expect(page).toHaveURL(/\/admin\/servicios/);
    await expect(page.getByRole('heading', { name: 'Servicios', level: 1 })).toBeVisible();
  });

  test('sends a client away from the admin panel', async ({ page }) => {
    await login(page, 'cliente@turnify.demo');
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/mis-reservas/);
  });
});

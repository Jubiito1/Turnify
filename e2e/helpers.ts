import { expect, type Page } from '@playwright/test';

export const DEMO_PASSWORD = 'Demo1234';
export const accounts = {
  client: 'cliente@turnify.demo',
  admin: 'admin@turnify.demo',
  pro: 'pro@turnify.demo',
};

export const uniqueEmail = (prefix: string) =>
  `${prefix}.${Date.now()}.${Math.floor(Math.random() * 1e4)}@e2e.test`;

/** Logs in through the real login form. */
export async function login(page: Page, email: string, password = DEMO_PASSWORD) {
  await page.goto('/ingresar');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Contraseña').fill(password);
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
  await expect(page).not.toHaveURL(/\/ingresar/);
}

/** Registers a brand new client account through the UI and returns its email. */
export async function registerClient(page: Page, name = 'Cliente E2E') {
  const email = uniqueEmail('cliente');
  await page.goto('/registro');
  await page.getByLabel(/nombre y apellido/i).fill(name);
  await page.getByLabel(/^email/i).fill(email);
  await page.getByLabel(/^contraseña/i).fill('e2eTurnify1');
  await page.getByRole('button', { name: 'Crear cuenta' }).click();
  await expect(page).toHaveURL(/\/mis-reservas/);
  return email;
}

export async function logout(page: Page) {
  await page
    .getByRole('button', { name: /cliente e2e|valeria|lucía|juan/i })
    .first()
    .click();
  await page.getByRole('menuitem', { name: 'Cerrar sesión' }).click();
  await expect(page).toHaveURL('/');
}

import { expect, test } from '@playwright/test';
import { accounts, login } from './helpers';

test.describe('business administration', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, accounts.admin);
    await expect(page.getByRole('heading', { name: 'Resumen' })).toBeVisible();
  });

  test('creates a service and a professional with schedule, visible on the public page', async ({
    page,
  }) => {
    const serviceName = `Peinado de fiesta ${Date.now()}`;
    await page.getByRole('link', { name: 'Servicios' }).click();
    await page.getByRole('button', { name: 'Nuevo servicio' }).click();
    const serviceDialog = page.getByRole('dialog', { name: 'Nuevo servicio' });
    await serviceDialog.getByLabel('Nombre').fill(serviceName);
    await serviceDialog.getByLabel('Duración').selectOption('60');
    await serviceDialog.getByLabel('Precio (ARS)').fill('25000');
    await serviceDialog.getByRole('button', { name: 'Guardar' }).click();
    await expect(page.getByRole('heading', { name: serviceName })).toBeVisible();

    await page.getByRole('link', { name: 'Profesionales' }).click();
    await page.getByRole('button', { name: 'Nuevo profesional' }).click();
    const proDialog = page.getByRole('dialog', { name: 'Nuevo profesional' });
    await proDialog.getByLabel('Nombre visible').fill('Ana Playwright');
    await proDialog.getByRole('button', { name: 'Crear' }).click();
    await expect(page.getByRole('heading', { name: 'Ana Playwright', level: 1 })).toBeVisible();

    await page.getByRole('checkbox', { name: new RegExp(serviceName) }).check();
    await page.getByRole('button', { name: 'Guardar servicios' }).click();
    await expect(page.getByText('Servicios asignados')).toBeVisible();

    await page.getByRole('button', { name: 'Agregar franja el Lunes' }).click();
    await page.getByRole('button', { name: 'Copiar lunes a martes–viernes' }).click();
    await page.getByRole('button', { name: 'Guardar horario' }).click();
    await expect(page.getByText('Horario guardado')).toBeVisible();

    await page.goto('/negocios/estudio-lumen');
    await expect(page.getByRole('link', { name: `Reservar ${serviceName}` })).toBeVisible();
    await expect(page.getByText('Ana Playwright')).toBeVisible();
  });

  test('confirms a pending booking from the bookings table', async ({ page }) => {
    await page.getByRole('link', { name: 'Reservas' }).click();
    await page.getByLabel('Estado').selectOption('PENDING');
    const firstRow = page.locator('tbody tr').first();
    await expect(firstRow).toContainText('Pendiente');
    await firstRow.getByRole('button').click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: 'Confirmar' }).click();
    await expect(page.getByText('Estado actualizado')).toBeVisible();
  });

  test('shows the agenda in week and month views', async ({ page }) => {
    await page.getByRole('link', { name: 'Calendario' }).click();
    await expect(page.getByRole('heading', { name: 'Calendario' })).toBeVisible();
    await expect(page.getByRole('listitem').first()).toBeVisible();
    await page.getByRole('tab', { name: 'Mes' }).click();
    await expect(page.getByRole('button', { name: /turnos$/ }).first()).toBeVisible();
  });

  test('exports bookings as CSV', async ({ page }) => {
    await page.getByRole('link', { name: 'Reservas' }).click();
    const download = page.waitForEvent('download');
    await page.getByRole('link', { name: /exportar csv/i }).click();
    const file = await download;
    expect(file.suggestedFilename()).toMatch(/^reservas-\d{4}-\d{2}-\d{2}\.csv$/);
  });
});

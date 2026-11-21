import { expect, test } from '@playwright/test';
import { DateTime } from 'luxon';
import { accounts, login } from './helpers';

test.describe('professional panel', () => {
  test('shows the own agenda and manages blocks (RN-033)', async ({ page }) => {
    await login(page, accounts.pro);
    await expect(page.getByRole('heading', { name: 'Mi agenda' })).toBeVisible();
    await expect(page.getByText('Turnos de hoy')).toBeVisible();

    await page.getByRole('link', { name: 'Bloqueos' }).click();
    await page.getByRole('button', { name: 'Nuevo bloqueo' }).click();
    const dialog = page.getByRole('dialog', { name: 'Nuevo bloqueo' });
    // A day beyond the seeded bookings, so the block does not collide with active bookings (RN-029).
    const day = DateTime.now()
      .setZone('America/Argentina/Buenos_Aires')
      .plus({ days: 40 })
      .toISODate()!;
    await dialog.getByText('Días completos').click();
    await dialog.getByLabel('Desde el día').fill(day);
    await dialog.getByLabel('Hasta el día').fill(day);
    await dialog.getByLabel('Motivo (opcional)').fill('Vacaciones E2E');
    await dialog.getByRole('button', { name: 'Crear bloqueo' }).click();
    await expect(page.getByText('Lucía Fernández · Vacaciones E2E')).toBeVisible();
  });
});

import { expect, test, type Page } from '@playwright/test';
import { registerClient } from './helpers';

/** Walks the wizard up to the time step for "Corte y peinado" at Estudio Lumen. */
async function openWizardAtDay(page: Page, dayIndex: number) {
  await page.goto('/negocios/estudio-lumen');
  await page.getByRole('link', { name: 'Reservar Corte y peinado' }).click();
  await page.getByRole('button', { name: /cualquiera disponible/i }).click();
  // Days with free slots; pick one a few days ahead so it is outside the 12 h cancellation window.
  const days = page.getByRole('button', { name: /horarios libres/ });
  await days.nth(dayIndex).click();
}

const slotButtons = (scope: Page | ReturnType<Page['getByRole']>) =>
  scope.getByRole('button', { name: /\(\d+ profesional(es)? libres?\)/ });

test.describe('booking lifecycle', () => {
  test('books, reschedules and cancels a booking end to end', async ({ page }) => {
    await registerClient(page);
    await openWizardAtDay(page, 2);
    await slotButtons(page).first().click();
    await expect(page.getByRole('heading', { name: /confirma tu reserva/i })).toBeVisible();
    await page.getByLabel(/notas para el negocio/i).fill('Reserva creada por Playwright');
    await page.getByRole('button', { name: 'Confirmar reserva' }).click();
    await expect(page.getByRole('heading', { name: '¡Reserva registrada!' })).toBeVisible();

    await page.getByRole('link', { name: 'Ver mis reservas' }).click();
    const card = page.getByRole('listitem').filter({ hasText: 'Corte y peinado' });
    await expect(card).toContainText('Pendiente');

    // Reschedule (RN-016): pick another free slot of the same professional.
    await card.getByRole('button', { name: 'Reprogramar' }).click();
    const dialog = page.getByRole('dialog', { name: 'Reprogramar turno' });
    // Another day well ahead, so the booking stays outside the cancellation window (RN-013).
    await dialog
      .getByRole('button', { name: /horarios libres/ })
      .nth(3)
      .click();
    await slotButtons(dialog).last().click();
    await dialog.getByRole('button', { name: /mover a las/i }).click();
    await expect(page.getByText('Turno reprogramado')).toBeVisible();

    // Cancel with the confirmation step; the booking moves to the history (RN-012).
    await page
      .getByRole('listitem')
      .filter({ hasText: 'Corte y peinado' })
      .getByRole('button', { name: 'Cancelar' })
      .click();
    const confirm = page.getByRole('dialog', { name: /cancelar esta reserva/i });
    await confirm.getByLabel(/motivo/i).fill('Cambio de planes');
    await confirm.getByRole('button', { name: 'Sí, cancelar' }).click();
    await expect(page.getByText('No tienes turnos próximos')).toBeVisible();
    await page.getByRole('tab', { name: 'Historial' }).click();
    await expect(page.getByText('Motivo de cancelación: Cambio de planes')).toBeVisible();
  });

  test('a slot taken by someone else is rejected and the user picks again (RN-006)', async ({
    browser,
  }) => {
    const first = await browser.newPage();
    const second = await browser.newPage();
    await registerClient(first, 'Cliente Uno');
    await registerClient(second, 'Cliente Dos');

    // Both clients stand on the same slot of the same professional.
    await openWizardAtDay(second, 3);
    await second.getByRole('button', { name: 'Cambiar' }).nth(1).click();
    await second.getByRole('button', { name: 'Martín Paz' }).click();
    await second
      .getByRole('button', { name: /horarios libres/ })
      .nth(3)
      .click();
    const slot = slotButtons(second).first();
    const label = (await slot.getAttribute('aria-label'))!.slice(0, 5);
    await slot.click();
    await expect(second.getByRole('button', { name: 'Confirmar reserva' })).toBeVisible();

    await first.goto(second.url());
    await first.getByRole('button', { name: 'Confirmar reserva' }).click();
    await expect(first.getByRole('heading', { name: '¡Reserva registrada!' })).toBeVisible();

    await second.getByRole('button', { name: 'Confirmar reserva' }).click();
    await expect(second.getByText(/acaba de ser reservado/i)).toBeVisible();
    await expect(second.getByRole('heading', { name: '3. Fecha y hora' })).toBeVisible();
    await expect(slotButtons(second).filter({ hasText: label })).toHaveCount(0);
  });
});

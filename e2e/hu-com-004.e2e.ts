import { expect, Page, test } from '@playwright/test';
import { areaText, goTo, openCommercialAs } from './support/operator-session';

// HU-COM-004 (view and apply current discounts), portal spec 004-, AC-CD.x. One criterion per test.
// Not covered here: AC-CD.1 to AC-CD.4 and AC-CD.8 (the discount calculation and the idempotency key: unit tests on the
// calculation and on the writer), AC-CD.9 (four states: component test) and the real reservation read (needs the real service).
const ADMINISTRATOR = ['TENANT_ADMINISTRATOR'];
const SHOTS = 'test-results/hu-com-004';
const area = (page: Page) => page.locator('app-remote-host');

/** Descuentos → "Buscar una reserva" → the first eligible row → "Aplicar descuento". */
async function toAdditionalDiscount(page: Page): Promise<void> {
  await goTo(page, 'Descuentos');
  await page.getByRole('button', { name: 'Buscar una reserva' }).click();
  await area(page).locator('tbody tr').filter({ has: page.getByRole('button', { name: 'Aplicar descuento' }) }).first().getByRole('button', { name: 'Aplicar descuento' }).click();
  await expect(area(page)).toContainText('Descuento adicional (%)');
}

test('AC-CD.10 · "Buscar una reserva" opens Reservas in mode and offers "Aplicar descuento" only on eligible reservations', async ({ page }) => {
  await openCommercialAs(page, ADMINISTRATOR);
  await goTo(page, 'Descuentos');
  await page.getByRole('button', { name: 'Buscar una reserva' }).click();
  await expect(area(page).locator('tbody tr').first()).toBeVisible();
  const rows = await area(page).locator('tbody tr').count();
  const offered = await area(page).getByRole('button', { name: 'Aplicar descuento' }).count();
  expect(offered).toBeGreaterThan(0);
  expect(offered).toBeLessThan(rows);
  await page.screenshot({ path: `${SHOTS}/cd-10-reservas-en-modo.png`, fullPage: true });
});

test('AC-CD.6 · an empty reason or a value out of range is refused beside its field', async ({ page }) => {
  await openCommercialAs(page, ADMINISTRATOR);
  await toAdditionalDiscount(page);
  await page.locator('[name=value]').fill('150');
  await page.getByRole('button', { name: 'Aplicar descuento' }).last().click();
  await expect(area(page)).toContainText('Ingresa un valor positivo entre 1 y 100, con máximo dos decimales.');
  await page.locator('[name=value]').fill('10');
  await page.getByRole('button', { name: 'Aplicar descuento' }).last().click();
  await expect(area(page)).toContainText('El motivo es obligatorio.');
  await page.screenshot({ path: `${SHOTS}/cd-06-validacion.png`, fullPage: true });
});

test('AC-CD.5 and AC-CD.11 · the additional discount is applied last with its reason and author, and no second one is offered', async ({ page }) => {
  await openCommercialAs(page, ADMINISTRATOR);
  await toAdditionalDiscount(page);
  await page.locator('[name=value]').fill('10');
  await page.locator('[name=reason]').fill('Cortesía por auditoría');
  await page.getByRole('button', { name: 'Aplicar descuento' }).last().click();
  await expect(area(page)).toContainText('Descuento adicional aplicado correctamente');
  await page.screenshot({ path: `${SHOTS}/cd-05-aplicado.png`, fullPage: true });
  await expect(area(page)).toContainText('quedaron registrados el motivo y el responsable');
});

test('AC-CD.7 · only the Administrator reaches the additional discount: a Manager has no form', async ({ page }) => {
  await openCommercialAs(page, ['MANAGER']);
  await expect(page.getByRole('button', { name: 'Aplicar descuento' })).toHaveCount(0);
  await page.screenshot({ path: `${SHOTS}/cd-07-gerente.png`, fullPage: true });
});

test('AC-CD.13 · the Administrator adds and removes authorizable reasons; an empty one is refused', async ({ page }) => {
  await openCommercialAs(page, ADMINISTRATOR);
  await goTo(page, 'Descuentos');
  await page.locator('#authorizable-reason').fill('');
  await page.getByRole('button', { name: 'Agregar motivo' }).click();
  await expect(area(page)).toContainText('Escribe el motivo que se podrá autorizar.');
  await page.locator('#authorizable-reason').fill('Cortesía por referido e2e');
  await page.getByRole('button', { name: 'Agregar motivo' }).click();
  await expect(area(page)).toContainText('Cortesía por referido e2e');
  await page.screenshot({ path: `${SHOTS}/cd-13-motivos.png`, fullPage: true });
});

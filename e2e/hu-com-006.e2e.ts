import { expect, Page, test } from '@playwright/test';
import { areaText, openTourDetail, openCommercialAs } from './support/operator-session';

// HU-COM-006 (browse the offer from the digital channel), portal spec 006-, AC-PO.x. One criterion per test.
// The selectors are those of the teacher's scenarios S19 to S22, which passed against develop on 2026-11-09.
// Not covered here: AC-PO.1 for a visitor without a token (the public catalog needs the real service and the
// public route of the container) and the real departures with seats (needs the real service).
const CUSTOMER = ['FINAL_CUSTOMER'];
const SHOTS = 'test-results/hu-com-006';
const area = (page: Page) => page.locator('app-remote-host');
const press = async (page: Page, name: string | RegExp, exact = false) => {
  await page.getByRole('button', { name, exact }).first().click();
  await page.waitForTimeout(400);
};

test('AC-PO.6 · the customer lands on the customer portal without the operator menu', async ({ page }) => {
  await openCommercialAs(page, CUSTOMER);
  const text = await areaText(page);
  expect(text).toContain('Hola, bienvenido');
  expect(text).not.toMatch(/ADMINISTRADOR DEL TENANT|Catálogos|Titular y acompañantes|Crear reserva/);
  await page.screenshot({ path: `${SHOTS}/po-06-panel-cliente.png`, fullPage: true });
});

test('AC-PO.2 · only active tours are offered and the date filter keeps them', async ({ page }) => {
  await openCommercialAs(page, CUSTOMER);
  await press(page, 'Tours', true);
  const before = await areaText(page);
  expect(before).toContain('Desierto de la Tatacoa');
  expect(before).not.toContain('Nevado del Huila');
  const date = area(page).locator('input[type=date]').first();
  await date.fill('2026-11-21');
  await expect(area(page)).toContainText('Desierto de la Tatacoa');
  await page.screenshot({ path: `${SHOTS}/po-02-tours.png`, fullPage: true });
});

test('AC-PO.3 · the tour detail shows its transport', async ({ page }) => {
  await openCommercialAs(page, CUSTOMER);
  await press(page, 'Tours', true);
  await page.getByRole('button', { name: 'Ver detalle' }).nth(3).click();
  await expect(area(page)).toContainText('San Agustín');
  await expect(area(page)).toContainText(/[Tt]ransporte|traslado/);
  await page.screenshot({ path: `${SHOTS}/po-03-detalle-transporte.png`, fullPage: true });
});

test('AC-PO.5 and AC-PO.8 · lodging and restaurants list only active establishments', async ({ page }) => {
  await openCommercialAs(page, CUSTOMER);
  await press(page, 'Alojamiento asociado');
  const lodging = await areaText(page);
  expect(lodging).toContain('Hotel Casa Neiva');
  expect(lodging).not.toContain('Hostal La Tatacoa');
  await page.screenshot({ path: `${SHOTS}/po-05-alojamiento.png`, fullPage: true });
  await page.reload().catch(() => undefined);
  await openCommercialAs(page, CUSTOMER);
  await press(page, 'Restaurantes asociados');
  const food = await areaText(page);
  expect(food).toContain('Sabores del Huila');
  expect(food).not.toContain('Café Altura');
  await page.screenshot({ path: `${SHOTS}/po-05-gastronomia.png`, fullPage: true });
});

test('AC-PO.4 · the tour card shows the value with the discount in force', async ({ page }) => {
  await openCommercialAs(page, CUSTOMER);
  await expect(area(page)).toContainText('20% de descuento');
  await expect(area(page)).toContainText('Desierto de la Tatacoa al atardecer');
  await page.screenshot({ path: `${SHOTS}/po-04-descuento.png`, fullPage: true });
});

test('AC-PO.7 · the customer opens the reservation from a tour detail with the "Reservar tour" button', async ({ page }) => {
  await openCommercialAs(page, CUSTOMER);
  await openTourDetail(page);
  await press(page, 'Elegir salida y reservar');
  await expect(area(page)).toContainText('Continuar reserva');
  await page.screenshot({ path: `${SHOTS}/po-07-reservar-tour.png`, fullPage: true });
});

import { expect, Page, test } from '@playwright/test';
import { areaText, openCommercialAs } from './support/operator-session';

// HU-COM-014 (consult my reservations and my supports), portal spec 014-, AC-MP.x. One criterion per test.
// Not covered here: AC-MP.5 and AC-MP.12 (filter and read by the real customer: the demo maps every final customer to one
// demo customer), AC-MP.7 (the support download waits for the API and the database), AC-MP.6 (static test) and AC-MP.8 (four
// states: component test).
const CUSTOMER = ['FINAL_CUSTOMER'];
const SHOTS = 'test-results/hu-com-014';
const area = (page: Page) => page.locator('app-remote-host');
const press = async (page: Page, name: string | RegExp) => {
  await page.getByRole('button', { name }).first().click();
  await page.waitForTimeout(500);
};

/** Customer panel → quick action "Mis pagos". */
async function toMyPayments(page: Page): Promise<void> {
  await press(page, /^Mis pagos/);
  await expect(area(page)).toContainText('Estado económico de mis reservas y saldo a favor');
}

test('AC-MP.1 · Mis pagos shows type, medium, proof state, financial situation, validated values and balance of each reservation', async ({ page }) => {
  await openCommercialAs(page, CUSTOMER);
  await toMyPayments(page);
  const text = await areaText(page);
  for (const label of ['Tipo de pago', 'Medio de pago', 'Estado del comprobante', 'Situación financiera', 'Valores validados', 'Saldo pendiente']) expect(text).toContain(label);
  expect(text).toContain('RES-1842');
  await page.screenshot({ path: `${SHOTS}/mp-01-mis-pagos.png`, fullPage: true });
});

test('AC-MP.2 · "Ver mis reservas" adds the economic lines to the card of the reservation', async ({ page }) => {
  await openCommercialAs(page, CUSTOMER);
  await press(page, 'Ver mis reservas');
  const text = await areaText(page);
  expect(text).toContain('RES-1842');
  expect(text).toMatch(/Estado del comprobante/);
  expect(text).toMatch(/Saldo/);
  await page.screenshot({ path: `${SHOTS}/mp-02-mis-reservas.png`, fullPage: true });
});

test('AC-MP.9 · each card lists its receipts and the credit balance slot', async ({ page }) => {
  await openCommercialAs(page, CUSTOMER);
  await toMyPayments(page);
  const text = await areaText(page);
  expect(text).toContain('Comprobantes');
  expect(text).toMatch(/Saldo a favor/);
  await page.screenshot({ path: `${SHOTS}/mp-09-comprobantes.png`, fullPage: true });
});

test('AC-MP.6 · Mis pagos and Mis reservas offer no modify, cancel, reschedule, validate or reject action', async ({ page }) => {
  await openCommercialAs(page, CUSTOMER);
  await toMyPayments(page);
  const labels = (await page.getByRole('button').allInnerTexts()).map((l) => l.trim());
  expect(labels.some((l) => /^(Cancelar reserva|Modificar|Reprogramar|Editar|Validar|Aprobar|Rechazar)/.test(l))).toBe(false);
  await page.screenshot({ path: `${SHOTS}/mp-06-sin-acciones.png`, fullPage: true });
});

test('AC-MP.5 · a visitor with an unknown role lands on the public offer with no entry to Mis pagos', async ({ page }) => {
  await openCommercialAs(page, ['ROL_DESCONOCIDO_E2E']);
  await expect(page.getByRole('button', { name: /^Mis pagos/ })).toHaveCount(0);
  await page.screenshot({ path: `${SHOTS}/mp-05-visitante.png`, fullPage: true });
});

test('AC-MP.4 · "Continuar pago" on a reservation card of Mis reservas opens the screen to complete its payment', async ({ page }) => {
  await openCommercialAs(page, CUSTOMER);
  await press(page, 'Ver mis reservas');
  await press(page, 'Continuar pago');
  await expect(area(page)).toContainText('Completar el pago de la reserva');
  await page.screenshot({ path: `${SHOTS}/mp-04-continuar-pago.png`, fullPage: true });
});

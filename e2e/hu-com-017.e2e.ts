import { expect, Page, test } from '@playwright/test';
import { areaText, goTo, openCommercialAs } from './support/operator-session';

// HU-COM-017 (record and apply a credit balance), portal spec 017-, AC-CB.x. One criterion per test. Seeded: RES-1821 (cancelled for
// non-payment, $1.200.000 validated, its treatment decision still open), and the credit balances of three customers on "Saldo a favor".
// Not covered yet: AC-CB.4 and AC-CB.5 (apply part of the balance and the amount above the available one): written, the controls are reached
// but the confirmation texts are still to be read from the screen in the next window.
// Not covered here: the atomic application with the held seat and the cash movement of a refund (real service, cash-reporting: other
// team), the 24-hour default refund (a job: the demo clock only marks) and AC-CB.x on notifications.
const SHOTS = 'test-results/hu-com-017';
const area = (page: Page) => page.locator('app-remote-host');
const RECORD = 'Registrar saldo a favor del 100 %';

/** Reservas (every reservation, cancelled ones included) → the row → "Ver detalle". */
async function toDetail(page: Page, code: string): Promise<void> {
  await goTo(page, 'Reservas');
  const toggle = page.getByRole('button', { name: /Ver todas las reservas|Ver reservas activas/ }).first();
  await toggle.waitFor();
  if (/todas/.test(await toggle.innerText())) await toggle.click();
  await area(page).locator('tbody tr', { hasText: `#${code}` }).first().getByRole('button', { name: 'Ver detalle' }).click();
  await expect(area(page)).toContainText('Detalle de reserva');
}

/** 10A → "Gestionar devolución" → "Abrir decisión": the screen of the pending treatment. */
async function toTreatment(page: Page, code: string): Promise<void> {
  await toDetail(page, code);
  await page.getByRole('button', { name: 'Gestionar devolución' }).or(page.getByRole('link', { name: 'Gestionar devolución' })).first().click();
  await page.getByRole('button', { name: 'Abrir decisión' }).or(page.getByRole('link', { name: 'Abrir decisión' })).first().click();
  await expect(area(page)).toContainText(/Tratamiento pendiente de devolución/i);
}

test('AC-CB.1 · the Administrator records the credit balance of 100 % of a pending treatment and both decision buttons close', async ({ page }) => {
  await openCommercialAs(page, ['TENANT_ADMINISTRATOR']);
  await toTreatment(page, 'RES-1821');
  await expect(area(page)).toContainText('$1.200.000');
  await page.getByLabel(/Motivo de la decisión/).fill('Decisión del administrador (e2e)');
  await page.getByRole('button', { name: RECORD, exact: true }).click();
  await expect(area(page)).toContainText(/quedó registrado como saldo a favor/i);
  await expect(page.getByRole('button', { name: RECORD, exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Registrar devolución del 100 %', exact: true })).toHaveCount(0);
  await page.screenshot({ path: `${SHOTS}/cb-01-saldo-registrado.png`, fullPage: true });
});

test('AC-CB.2 · a Collaborator does not get the button to record the credit balance', async ({ page }) => {
  await openCommercialAs(page, ['OPERATIONAL_COLLABORATOR']);
  await toDetail(page, 'RES-1821');
  await expect(page.getByRole('button', { name: RECORD, exact: true })).toHaveCount(0);
  await page.screenshot({ path: `${SHOTS}/cb-02-colaborador.png`, fullPage: true });
});

test('AC-CB.3 · Saldo a favor lists the customers with their available balance, the origin of each balance and the history', async ({ page }) => {
  await openCommercialAs(page, ['TENANT_ADMINISTRATOR']);
  await goTo(page, 'Pagos', 'Pagos pendientes');
  await page.getByText('Saldo a favor', { exact: true }).first().click();
  await expect(area(page)).toContainText('Saldo disponible del tenant');
  const text = await areaText(page);
  expect(text).toContain('Disponible $300.000');
  expect(text.toLowerCase()).toContain('reserva de origen');
  expect(text).toMatch(/Historial de aplicaciones y devoluciones \(\d+\)/);
  await page.screenshot({ path: `${SHOTS}/cb-03-saldo-a-favor.png`, fullPage: true });
});

test('AC-CB.6 · an Analyst has no application controls on Saldo a favor', async ({ page }) => {
  await openCommercialAs(page, ['ANALYST']);
  await goTo(page, 'Pagos');
  await expect(page.getByRole('button', { name: 'Aplicar como pago validado' })).toHaveCount(0);
  await page.screenshot({ path: `${SHOTS}/cb-06-analista.png`, fullPage: true });
});

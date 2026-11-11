import { expect, Page, test } from '@playwright/test';
import { areaText, fillHolder, openTourDetail, goTo, openCommercialAs, setDemoNow, setDemoQuery } from './support/operator-session';

// HU-COM-009 (register a payment or a partial payment), portal spec 009-, AC-PY.x. One criterion per test.
// AC-PY.12 follows DP-PY5 as decided in the portal on develop: a deposit below the minimum is registered and the reservation stays
// Parcial (it is confirmed when the validated value reaches the minimum); nothing is refused.
// Not covered here: AC-PY.13 (a forged amount in the navigation parameters: unit test), AC-PY.16 and AC-PY.19 (cash
// income and the credit balance rule: unit tests on the payment rules), AC-PY.17 (the payment parameters of the tenant
// are read from the real service) and the real cash session (HU-COM-009 depends on cash-reporting, other team).
const SHOTS = 'test-results/hu-com-009';
const area = (page: Page) => page.locator('app-remote-host');
const PDF = { name: 'comprobante-e2e.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 demo') };
const press = async (page: Page, name: string | RegExp, exact = false) => {
  await page.getByRole('button', { name, exact }).first().click();
  await page.waitForTimeout(500);
};

/** Reservas → the row of the reservation → "Ver detalle" (10A) → "Gestionar pago" (13). */
async function toPayment(page: Page, code: string): Promise<void> {
  await goTo(page, 'Reservas');
  await area(page).locator('tbody tr', { hasText: `#${code}` }).first().getByRole('button', { name: 'Ver detalle' }).click();
  await press(page, 'Gestionar pago');
  await expect(area(page)).toContainText('Gestión de pago');
}

/** Customer: Tours → Tatacoa → Reservar tour → Continuar reserva (21). */
async function toFinish(page: Page): Promise<void> {
  await openTourDetail(page);
  await press(page, 'Elegir salida y reservar');
  await press(page, 'Continuar reserva');
}

test('AC-PY.2 · on 21 the note of the medium shows as soon as it is chosen, before creating the reservation', async ({ page }) => {
  await openCommercialAs(page, ['FINAL_CUSTOMER']);
  await toFinish(page);
  await page.selectOption('[name=paymentMethod]', 'CASH_AT_OFFICE');
  await expect(area(page)).toContainText(/oficina|efectivo/i);
  await page.screenshot({ path: `${SHOTS}/py-02-nota-efectivo.png`, fullPage: true });
  await page.selectOption('[name=paymentMethod]', 'BANK_TRANSFER');
  await expect(area(page)).toContainText(/transferencia/i);
  await page.screenshot({ path: `${SHOTS}/py-02-nota-transferencia.png`, fullPage: true });
});

test('AC-PY.3 · a proof above 5 MB is refused before storing and nothing is registered', async ({ page }) => {
  await openCommercialAs(page, ['FINAL_CUSTOMER']);
  await toFinish(page);
  await page.selectOption('[name=paymentMethod]', 'BANK_TRANSFER');
  await page.check('input[name=paymentType][value=TOTAL]');
  await page.check('[name=conditions]');
  await page.check('[name=terms]');
  await fillHolder(page);
  await press(page, /Confirmar reserva|Crear reserva/);
  await press(page, 'Continuar al pago');
  await page.setInputFiles('#crp-transfer-proof', { name: 'grande.pdf', mimeType: 'application/pdf', buffer: Buffer.alloc(6 * 1024 * 1024, 1) });
  await press(page, 'Enviar comprobante para validación');
  await expect(area(page)).toContainText(/5 MB/);
  await expect(area(page)).not.toContainText('Comprobante recibido');
  await page.screenshot({ path: `${SHOTS}/py-03-archivo-grande.png`, fullPage: true });
});

test('AC-PY.4 · the operator pays in cash with the cash session closed and it is refused, with no payment line', async ({ page }) => {
  await openCommercialAs(page, ['TENANT_ADMINISTRATOR']);
  await setDemoQuery(page, { fixtures: ['closed-cash-session'] });
  await toPayment(page, 'RES-1841');
  await page.locator('[name=amount]').fill('100000');
  await press(page, /Registrar pago recibido/);
  await expect(area(page)).toContainText(/caja/i);
  await page.screenshot({ path: `${SHOTS}/py-04-caja-cerrada.png`, fullPage: true });
});

test('AC-PY.5 · the first payment on a departure with no seats is refused', async ({ page }) => {
  await openCommercialAs(page, ['TENANT_ADMINISTRATOR']);
  await setDemoQuery(page, { fixtures: ['full-departure'] });
  await toPayment(page, 'RES-1842');
  await page.locator('[name=amount]').fill('100000');
  await press(page, /Registrar/);
  await expect(area(page)).toContainText(/cupo/i);
  await page.screenshot({ path: `${SHOTS}/py-05-sin-cupo.png`, fullPage: true });
});

test('AC-PY.7 · from the scheduled start of the departure no payment is accepted', async ({ page }) => {
  await openCommercialAs(page, ['TENANT_ADMINISTRATOR']);
  await toPayment(page, 'RES-1842');
  await setDemoNow(page, '2026-12-05T08:00:00-05:00');
  await page.locator('[name=amount]').fill('100000');
  await press(page, /Registrar/);
  await expect(area(page)).toContainText(/salida|inicio/i);
  await page.screenshot({ path: `${SHOTS}/py-07-salida-iniciada.png`, fullPage: true });
});

test('AC-PY.1 and AC-PY.8 · the Collaborator registers cash and the line shows who registered it, with no change of state', async ({ page }) => {
  await openCommercialAs(page, ['OPERATIONAL_COLLABORATOR']);
  await toPayment(page, 'RES-1841');
  await page.locator('[name=amount]').fill('300000');
  await press(page, /Registrar pago recibido/);
  await expect(area(page)).toContainText('Registrado por');
  await expect(area(page)).toContainText('$300.000');
  await page.screenshot({ path: `${SHOTS}/py-08-efectivo-colaborador.png`, fullPage: true });
});

test('AC-PY.9 · the Analyst gets no "Gestionar pago" and no register action', async ({ page }) => {
  await openCommercialAs(page, ['ANALYST']);
  await goTo(page, 'Reservas');
  await area(page).locator('tbody tr').first().getByRole('button', { name: 'Ver detalle' }).click();
  await expect(area(page)).toContainText('Detalle de reserva');
  await expect(page.getByRole('button', { name: 'Gestionar pago' })).toHaveCount(0);
  await page.screenshot({ path: `${SHOTS}/py-09-analista.png`, fullPage: true });
});

test('AC-PY.9 · an unknown role lands on the customer offer and has no operator menu or payment action', async ({ page }) => {
  await openCommercialAs(page, ['ROL_DESCONOCIDO_E2E']);
  await expect(page.getByRole('button', { name: 'Gestionar pago' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Pagos', exact: true })).toHaveCount(0);
  await page.screenshot({ path: `${SHOTS}/py-09-rol-desconocido.png`, fullPage: true });
});

test('AC-PY.10 and AC-PY.11 · an empty amount is marked beside the field and a double click registers one payment', async ({ page }) => {
  await openCommercialAs(page, ['TENANT_ADMINISTRATOR']);
  await toPayment(page, 'RES-1841');
  await press(page, /Registrar pago recibido/);
  expect(await areaText(page)).toMatch(/monto|Indica/i);
  await page.locator('[name=amount]').fill('100000');
  const submit = page.getByRole('button', { name: /Registrar pago recibido/ }).first();
  await submit.dblclick();
  await page.waitForTimeout(800);
  expect((await areaText(page)).match(/\$100\.000 · Efectivo/g)?.length ?? 1).toBe(1);
  await page.screenshot({ path: `${SHOTS}/py-10-un-pago.png`, fullPage: true });
});

test('AC-PY.12 · a first deposit below the minimum is registered and the reservation stays Parcial until the validated value reaches the minimum (DP-PY5, the PDR path)', async ({ page }) => {
  await openCommercialAs(page, ['TENANT_ADMINISTRATOR']);
  await goTo(page, 'Reservas');
  await area(page).locator('tbody tr', { hasText: '#RES-1841' }).first().getByRole('button', { name: 'Gestionar pago' }).click();
  await expect(area(page)).toContainText('Abono mínimo para confirmar la reserva');
  await page.locator('[name=amount]').fill('1000');
  await page.getByRole('button', { name: /Registrar pago recibido|Registrar comprobante/ }).first().click();
  await expect(area(page)).toContainText('Registrado por');
  await expect(area(page)).toContainText('Parcial');
  await expect(area(page)).toContainText('Pendiente de pago');
  expect(await areaText(page)).not.toContain('El abono debe ser como mínimo');
  await page.screenshot({ path: `${SHOTS}/py-12-abono-bajo-queda-parcial.png`, fullPage: true });
});

test('AC-PY.1 and AC-PY.14 · the customer pays a partial transfer and the proof lands En validación', async ({ page }) => {
  await openCommercialAs(page, ['FINAL_CUSTOMER']);
  await toFinish(page);
  await page.selectOption('[name=paymentMethod]', 'BANK_TRANSFER');
  await page.check('input[name=paymentType][value=PARTIAL]');
  await page.fill('[name=deposit]', '100000');
  await page.check('[name=conditions]');
  await page.check('[name=terms]');
  await fillHolder(page);
  await press(page, /Confirmar reserva|Crear reserva/);
  await expect(area(page)).toContainText(/Reserva creada: RES-\d+/);
  await press(page, 'Continuar al pago');
  await page.setInputFiles('#crp-transfer-proof', PDF);
  await press(page, 'Enviar comprobante para validación');
  await expect(area(page)).toContainText('Comprobante recibido');
  await expect(area(page)).toContainText('En validación');
  await page.screenshot({ path: `${SHOTS}/py-14-comprobante-recibido.png`, fullPage: true });
});

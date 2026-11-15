import { expect, Page, test } from '@playwright/test';
import { areaText, fillHolder, goTo, openCommercialAs, openTourDetail } from './support/operator-session';

// HU-COM-010 (validate or reject a payment proof), the criteria that proof-review.e2e.ts does not cover: approve and reject with a reason,
// the reservation untouched by a rejection, the proof history, the read-only roles, one decision on a double click, the review limit on
// the customer screen 24, and the links from Pagos, the list and 10A. The texts are those of the portal on develop ("comprobante").
// Not covered here: AC-PV.2 on the cash movement (the approval moves no money to cash: real service of cash-reporting, other team) and
// AC-PV.14 (approval on a cancelled reservation: component tests); the proof file itself (real storage).
const ADMINISTRATOR = ['TENANT_ADMINISTRATOR'];
const SHOTS = 'test-results/proof-review-decisions';
const area = (page: Page) => page.locator('app-remote-host');
const PDF = { name: 'comprobante-e2e.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 demo') };
const press = async (page: Page, name: string | RegExp) => {
  await page.getByRole('button', { name }).first().click();
  await page.waitForTimeout(500);
};

/** Pagos → the row of the reservation that still has a decision → its first button. */
async function openProof(page: Page, code: string): Promise<void> {
  await goTo(page, 'Pagos', 'Pagos pendientes');
  await area(page).locator('tbody tr', { hasText: `#${code}` }).filter({ has: page.getByRole('button', { name: /Validar comprobante|Ver comprobante/ }) }).first().getByRole('button').first().click();
  await expect(page.locator('[name=verifiedAmount]')).toBeVisible();
}

/** Reservas → the row of the reservation → "Ver detalle" (10A). */
async function openDetail(page: Page, code: string): Promise<void> {
  await goTo(page, 'Reservas');
  await area(page).locator('tbody tr', { hasText: `#${code}` }).first().getByRole('button', { name: 'Ver detalle' }).click();
  await expect(area(page)).toContainText('Detalle de reserva');
}

test('AC-PV.1 and AC-PV.6 · a rejection with a reason leaves the reservation unchanged and a new proof from 13 is a second attempt in the history', async ({ page }) => {
  await openCommercialAs(page, ADMINISTRATOR);
  await openProof(page, 'RES-1833');
  await page.locator('[name=reason]').fill('Imagen ilegible');
  await page.getByRole('button', { name: 'Rechazar comprobante', exact: true }).click();
  await expect(area(page)).toContainText('Comprobante rechazado. La reserva conserva su estado, sus pagos validados y su saldo pendiente.');
  await page.screenshot({ path: `${SHOTS}/pv-01-rechazado.png`, fullPage: true });
  await openDetail(page, 'RES-1833');
  expect(await areaText(page)).toMatch(/Pendiente de pago/);
  await press(page, 'Gestionar pago');
  await page.locator('[name=amount]').fill('100000');
  await page.setInputFiles('[name=proof]', PDF);
  await press(page, /Registrar comprobante/);
  await expect(area(page)).toContainText('Historial: En validación → Rechazado: Imagen ilegible → En validación.');
  await page.screenshot({ path: `${SHOTS}/pv-06-historial.png`, fullPage: true });
});

test('AC-PV.2 and AC-PV.3 · approving the proof of RES-1833 confirms the reservation as Abono recibido', async ({ page }) => {
  await openCommercialAs(page, ADMINISTRATOR);
  await openProof(page, 'RES-1833');
  await expect(page.locator('[name=verifiedAmount]')).toHaveValue('$100.000');
  await page.locator('[name=reason]').fill('Comprobante legible y monto verificado');
  await page.getByRole('button', { name: 'Aprobar comprobante', exact: true }).click();
  await expect(area(page)).toContainText('Comprobante aprobado por $100.000 aplicados.');
  await expect(area(page)).toContainText('Abono recibido');
  await openDetail(page, 'RES-1833');
  expect(await areaText(page)).toMatch(/Confirmada/);
  await page.screenshot({ path: `${SHOTS}/pv-02-aprobado.png`, fullPage: true });
});

test('AC-PV.4 · rejecting the second proof of a reservation with validated payments leaves the validated total and the balance unchanged', async ({ page }) => {
  await openCommercialAs(page, ADMINISTRATOR);
  await openDetail(page, 'RES-1834');
  const before = await areaText(page);
  expect(before).toMatch(/Abono Transferencia En validación Abono recibido \$100\.000 \$200\.000/);
  await openProof(page, 'RES-1834');
  await page.locator('[name=reason]').fill('El valor no coincide con el extracto');
  await page.getByRole('button', { name: 'Rechazar comprobante', exact: true }).click();
  await expect(area(page)).toContainText('Comprobante rechazado.');
  await openDetail(page, 'RES-1834');
  expect(await areaText(page)).toMatch(/Abono Transferencia Rechazado Abono recibido \$100\.000 \$200\.000/);
  await page.screenshot({ path: `${SHOTS}/pv-04-validados-intactos.png`, fullPage: true });
});

for (const [role, label] of [['OPERATIONAL_COLLABORATOR', 'Collaborator without the permission'], ['ANALYST', 'Analyst']] as const) {
  test(`AC-PV.7 · ${label} reads the proof as read-only with no reason field and no decision buttons`, async ({ page }) => {
    await openCommercialAs(page, [role]);
    await openProof(page, 'RES-1833');
    await expect(area(page)).toContainText('Consulta de solo lectura: tu usuario no tiene el permiso Validar comprobantes.');
    await expect(page.locator('[name=reason]')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Aprobar comprobante|Rechazar comprobante/ })).toHaveCount(0);
    await page.screenshot({ path: `${SHOTS}/pv-07-${role.toLowerCase()}.png`, fullPage: true });
  });
}

test('AC-PV.9 and AC-PV.10 · a double click records one decision and the decided proof is no longer listed in Pagos', async ({ page }) => {
  await openCommercialAs(page, ADMINISTRATOR);
  await openProof(page, 'RES-1833');
  await page.locator('[name=reason]').fill('Comprobante legible');
  await page.getByRole('button', { name: 'Aprobar comprobante', exact: true }).dblclick();
  await page.waitForTimeout(900);
  expect((await areaText(page)).split('Comprobante aprobado por').length).toBe(2);
  await expect(page.getByRole('button', { name: 'Aprobar comprobante', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Rechazar comprobante', exact: true })).toBeDisabled();
  await goTo(page, 'Pagos', 'Pagos pendientes');
  await expect(area(page).locator('tbody tr', { hasText: '#RES-1833' }).filter({ has: page.getByRole('button', { name: 'Validar comprobante' }) })).toHaveCount(0);
  await page.screenshot({ path: `${SHOTS}/pv-09-una-decision.png`, fullPage: true });
});

test('AC-PV.3 · the list of reservations and 10A offer "Validar comprobante" only where a proof is En validación', async ({ page }) => {
  await openCommercialAs(page, ADMINISTRATOR);
  await goTo(page, 'Reservas');
  const withProof = area(page).locator('tbody tr', { hasText: '#RES-1833' }).first();
  await expect(withProof.getByRole('button', { name: 'Validar comprobante' })).toBeVisible();
  await expect(area(page).locator('tbody tr', { hasText: '#RES-1842' }).first().getByRole('button', { name: 'Validar comprobante' })).toHaveCount(0);
  await openDetail(page, 'RES-1833');
  await page.getByRole('button', { name: 'Validar comprobante' }).first().click();
  await expect(page.locator('[name=verifiedAmount]')).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/pv-03-enlaces.png`, fullPage: true });
});

test('AC-PV.11 · the customer reads the review limit of 24 hours on the transfer payment screen', async ({ page }) => {
  await openCommercialAs(page, ['FINAL_CUSTOMER']);
  await openTourDetail(page);
  await press(page, 'Elegir salida y reservar');
  await press(page, 'Continuar reserva');
  await expect(area(page)).toContainText('Cliente titular');
  await fillHolder(page);
  await page.selectOption('[name=paymentMethod]', 'BANK_TRANSFER');
  await page.check('input[name=paymentType][value=PARTIAL]');
  await page.fill('[name=deposit]', '100000');
  await page.check('[name=conditions]');
  await page.check('[name=terms]');
  await press(page, /Confirmar reserva|Crear reserva/);
  await expect(area(page)).toContainText(/Reserva creada: RES-\d+/);
  await press(page, 'Continuar al pago');
  await expect(area(page)).toContainText('Plazo máximo de revisión: 24 horas.');
  await page.screenshot({ path: `${SHOTS}/pv-11-plazo.png`, fullPage: true });
});

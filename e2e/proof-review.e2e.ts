import { expect, Page, test } from '@playwright/test';
import { areaText, goTo as open, openCommercialAs, seededInstant, setDemoNow } from './support/operator-session';

// HU-COM-010 (validate or reject a payment proof), scenarios E-010-12 to E-010-14 of the portal spec tasks.md.
// The texts are those of the portal on develop (proof-review-copy.ts, payments-copy.ts): "comprobante", never "soporte".
const ADMINISTRATOR = ['TENANT_ADMINISTRATOR'];
const SHOTS = 'test-results/proof-review';

/** Pagos → the row of the reservation → its first button ("Validar comprobante"). */
async function openProof(page: Page, code: string): Promise<void> {
  await open(page, 'Pagos', 'Pagos pendientes');
  // A reservation can list several proofs (RES-1834 has an approved one): the row that still offers the decision.
  await page.locator('app-payments-page tbody tr', { hasText: `#${code}` }).filter({ has: page.getByRole('button', { name: 'Validar comprobante' }) }).first().getByRole('button', { name: 'Validar comprobante' }).click();
  await expect(page.locator('[name=verifiedAmount]')).toBeVisible();
}

/** Reservas → the row of the reservation → "Ver detalle" (screen 10A). */
async function openDetail(page: Page, code: string): Promise<void> {
  await open(page, 'Reservas');
  await page.locator('app-reservations-page tbody tr', { hasText: `#${code}` }).first().getByRole('button', { name: 'Ver detalle' }).click();
  await expect(page.locator('app-remote-host')).toContainText('Comprobantes presentados');
}

test('E-010-12 · approving above the pending balance applies the balance and registers the excess as credit balance (AC-PV.8)', async ({ page }) => {
  await openCommercialAs(page, ADMINISTRATOR);
  await openProof(page, 'RES-1833');
  await page.locator('[name=verifiedAmount]').fill('400000');
  await page.locator('[name=reason]').fill('Transferencia por un valor mayor');
  await page.screenshot({ path: `${SHOTS}/e010-12a-decision.png`, fullPage: true });
  await page.getByRole('button', { name: 'Aprobar comprobante', exact: true }).click();
  const result = 'Comprobante aprobado por $300.000 aplicados. Situación financiera: Pago completo. La reserva quedó Confirmada. El excedente de $100.000 se registró como saldo a favor del cliente.';
  await expect(page.locator('app-remote-host')).toContainText(result);
  await page.screenshot({ path: `${SHOTS}/e010-12b-aprobado.png`, fullPage: true });

  await openDetail(page, 'RES-1833');
  expect(await areaText(page)).toMatch(/Abono Transferencia Aprobado Pago completo \$300\.000 \$0/);

  await open(page, 'Pagos', 'Pagos pendientes');
  await page.getByText('Saldo a favor', { exact: true }).first().click();
  await expect(page.locator('app-remote-host')).toContainText('Disponible $100.000');
  // The origin of the credit is in the history of the customer, a closed <details> until it is opened.
  await page.locator('app-remote-host details', { hasText: 'RES-1833' }).first().locator('summary').click();
  await expect(page.locator('app-remote-host')).toContainText('Excedente de comprobante aprobado');
  await page.screenshot({ path: `${SHOTS}/e010-12c-saldo-a-favor.png`, fullPage: true });
});

test('E-010-13 · the reason is asked only for a rejection or a difference with the declared amount (AC-PV.12)', async ({ page }) => {
  await openCommercialAs(page, ADMINISTRATOR);
  await openProof(page, 'RES-1833');
  const area = page.locator('app-remote-host');

  // (a) a verified amount different from the declared $100.000 and no reason: refused beside the field, nothing recorded.
  await page.locator('[name=verifiedAmount]').fill('90000');
  await page.getByRole('button', { name: 'Aprobar comprobante', exact: true }).click();
  await expect(area).toContainText('El monto verificado es distinto al declarado en el comprobante: registra el motivo de la diferencia.');
  await expect(area).not.toContainText('Comprobante aprobado por');
  await expect(page.locator('[name=reason]')).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/e010-13a-diferencia-sin-motivo.png`, fullPage: true });

  // (b) the declared amount and no reason: the approval is recorded without asking for one.
  await page.locator('[name=verifiedAmount]').fill('100000');
  await page.getByRole('button', { name: 'Aprobar comprobante', exact: true }).click();
  await expect(area).toContainText('Comprobante aprobado por $100.000 aplicados.');
  await expect(area).not.toContainText('registra el motivo');
  await page.screenshot({ path: `${SHOTS}/e010-13b-monto-declarado.png`, fullPage: true });

  // (c) another proof: a rejection with no reason is refused beside the field, nothing recorded.
  await page.getByRole('button', { name: 'Volver a pagos' }).first().click();
  await openProof(page, 'RES-1834');
  await page.getByRole('button', { name: 'Rechazar comprobante', exact: true }).click();
  await expect(area).toContainText('Registra el motivo obligatorio del rechazo.');
  await expect(area).not.toContainText('Comprobante rechazado.');
  await page.screenshot({ path: `${SHOTS}/e010-13c-rechazo-sin-motivo.png`, fullPage: true });
});

test('E-010-14 · the detail of the reservation lists every proof presented with its decision (AC-PV.13)', async ({ page }) => {
  await openCommercialAs(page, ADMINISTRATOR);
  await openProof(page, 'RES-1833');
  await page.locator('[name=reason]').fill('Ilegible');
  await page.getByRole('button', { name: 'Rechazar comprobante', exact: true }).click();
  await expect(page.locator('app-remote-host')).toContainText('Comprobante rechazado.');

  await openDetail(page, 'RES-1833');
  const history = page.locator('app-remote-host table', { hasText: 'Valor declarado' }).filter({ hasText: 'Decisión' }).last();
  await expect(history.locator('thead th')).toHaveText(['Presentado', 'Valor declarado', 'Monto verificado', 'Estado', 'Decisión']);
  const rejected = history.locator('tbody tr', { hasText: 'Rechazado' }).first();
  await expect(rejected).toContainText('Ilegible');
  expect((await rejected.innerText()).replace(/\s+/g, ' ')).toMatch(/Ilegible$/);
  expect((await areaText(page)).toLowerCase()).toContain('histórico');
  await page.screenshot({ path: `${SHOTS}/e010-14a-comprobantes-presentados.png`, fullPage: true });

  // A proof still En validación reads "Pendiente de decisión" in the same column.
  await openDetail(page, 'RES-1834');
  const pending = page.locator('app-remote-host table', { hasText: 'Valor declarado' }).filter({ hasText: 'Decisión' }).last();
  await expect(pending.locator('tbody tr', { hasText: 'En validación' }).first()).toContainText('Pendiente de decisión');
  await page.screenshot({ path: `${SHOTS}/e010-14b-pendiente-de-decision.png`, fullPage: true });
});

test('E-010-04 · a proof over 24 hours is marked Revisión vencida with its notice and changes no state (AC-PV.5)', async ({ page }) => {
  await openCommercialAs(page, ADMINISTRATOR);
  const row = () => page.locator('app-payments-page tbody tr', { hasText: '#RES-1833' }).first();
  // RES-1833 was presented at the seeded moment of 13 oct 09:00 (moved to today by the demo): one minute short of 24 hours it carries no mark.
  const presented = seededInstant('2026-10-13T09:00:00-05:00');
  await setDemoNow(page, new Date(presented + 24 * 3_600_000 - 60_000).toISOString());
  await open(page, 'Pagos', 'Pagos pendientes');
  await expect(row()).toContainText('En validación');
  await expect(row()).not.toContainText('Revisión vencida');
  await page.screenshot({ path: `${SHOTS}/e010-04a-23h59.png`, fullPage: true });

  // At 24 hours the row is marked, the list shows the notice, and the status stays En validación.
  await setDemoNow(page, new Date(presented + 24 * 3_600_000).toISOString());
  await open(page, 'Reservas');
  await open(page, 'Pagos', 'Pagos pendientes');
  await expect(row()).toContainText('Revisión vencida');
  await expect(row()).toContainText('En validación');
  await expect(page.locator('app-remote-host')).toContainText('con revisión vencida (más de 24 horas corridas En validación)');
  await page.screenshot({ path: `${SHOTS}/e010-04b-24h.png`, fullPage: true });
});

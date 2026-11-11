import { expect, Page, test } from '@playwright/test';
import { areaText, goTo, openCommercialAs } from './support/operator-session';

// HU-COM-016 (authorize and execute a refund), portal spec 016-, AC-RF.x. One criterion per test. The seeded refunds are those of
// src/app/demo/refunds-demo.ts: RES-1819 (customer cancellation, $300.000, pending authorization), RES-1818 (non-payment, authorized,
// its cash step fails), RES-1817 (not attributable to the customer, $850.000) and RES-1816 (rescheduling refused, $418.000).
// Not covered here: the execution against the real cash movement (cash-reporting, other team), the 24-hour automatic determination
// and the five business days expiry (jobs of the real service: the demo clock only marks), AC-RF.x on notifications and mail.
const SHOTS = 'test-results/hu-com-016';
const area = (page: Page) => page.locator('app-remote-host');
const norm = (t: string) => t.replace(/\s+/g, ' ').trim();

/** Pagos → "Consultar solicitudes" → the list of refund requests. */
async function toRequests(page: Page): Promise<void> {
  await goTo(page, 'Pagos', 'Pagos pendientes');
  await page.getByRole('button', { name: 'Consultar solicitudes', exact: true }).click();
  await expect(page.locator('app-refund-requests-page')).toBeVisible();
}

/** The list → the code of the reservation → the detail of the refund. */
async function toDetail(page: Page, code: string): Promise<void> {
  await toRequests(page);
  await page.locator('app-refund-requests-page tbody tr', { hasText: `#${code}` }).first().getByRole('button', { name: `#${code}` }).click();
  await expect(page.locator('app-refund-detail-page [data-state="data"]').first()).toBeVisible();
}

const field = async (page: Page, label: string): Promise<string> =>
  norm(await page.locator('app-refund-detail-page dl div', { has: page.locator('dt', { hasText: label }) }).first().locator('dd').innerText());

test('AC-RF.1 and AC-RF.2 · the Administrator authorizes with a reason and executes: the refund ends Ejecutada with its amount and cash movement', async ({ page }) => {
  await openCommercialAs(page, ['TENANT_ADMINISTRATOR']);
  await toRequests(page);
  const row = page.locator('app-refund-requests-page tbody tr', { hasText: '#RES-1819' }).first();
  const listed = norm(await row.innerText());
  expect(listed).toContain('Pendiente de autorización');
  expect(listed).toContain('$300.000');
  await row.getByRole('button', { name: 'Autorizar devolución' }).click();
  await page.locator('#crp-refunds-reason').fill('El cliente presentó la solicitud (e2e)');
  await page.getByRole('button', { name: 'Autorizar devolución', exact: true }).click();
  await expect(area(page)).toContainText('Devolución autorizada correctamente.');
  await page.locator('#crp-refunds-outflow').selectOption('yes');
  await page.locator('#crp-refunds-method').selectOption('BANK_TRANSFER');
  await page.getByRole('button', { name: 'Registrar ejecución de devolución', exact: true }).click();
  await expect(area(page)).toContainText('Ejecución registrada correctamente.');
  expect(await field(page, 'Estado actual')).toBe('Ejecutada');
  expect(await field(page, 'Monto')).toBe('$300.000');
  expect(await field(page, 'Movimiento de caja asociado')).toMatch(/^MC-/);
  await page.screenshot({ path: `${SHOTS}/rf-01-ejecutada.png`, fullPage: true });
});

test('AC-RF.3 · a Collaborator sees a refund pending authorization without the decision panel', async ({ page }) => {
  await openCommercialAs(page, ['OPERATIONAL_COLLABORATOR']);
  await goTo(page, 'Pagos', 'Pagos pendientes');
  await expect(page.locator('app-refunds-panel').first()).toContainText(/Devoluciones autorizadas/i);
  await toDetail(page, 'RES-1817');
  await expect(page.locator('#crp-refunds-reason')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Autorizar devolución', exact: true })).toHaveCount(0);
  expect(await field(page, 'Estado actual')).toBe('Pendiente de autorización');
  await page.screenshot({ path: `${SHOTS}/rf-03-colaborador.png`, fullPage: true });
});

test('AC-RF.4 · without authorization there is no execution panel; with authorization the Collaborator has it', async ({ page }) => {
  await openCommercialAs(page, ['OPERATIONAL_COLLABORATOR']);
  await toDetail(page, 'RES-1816');
  await expect(page.locator('#crp-refunds-outflow')).toHaveCount(0);
  await toDetail(page, 'RES-1818');
  await expect(page.locator('#crp-refunds-outflow')).toHaveCount(1);
  await page.screenshot({ path: `${SHOTS}/rf-04-ejecucion-colaborador.png`, fullPage: true });
});

test('AC-RF.5 · when the cash step fails the refund stays Autorizada and never Ejecutada', async ({ page }) => {
  await openCommercialAs(page, ['TENANT_ADMINISTRATOR']);
  await toDetail(page, 'RES-1818');
  await page.locator('#crp-refunds-outflow').selectOption('yes');
  await page.getByRole('button', { name: 'Registrar ejecución de devolución', exact: true }).click();
  await expect(area(page)).toContainText('La salida de dinero no quedó registrada en caja: la devolución sigue autorizada.');
  expect(await field(page, 'Estado actual')).toBe('Autorizada');
  expect(await field(page, 'Movimiento de caja asociado')).toBe('No aplica');
  await page.screenshot({ path: `${SHOTS}/rf-05-caja-fallida.png`, fullPage: true });
});

test('AC-RF.6 · an empty reason is marked beside the field and a double click registers one decision', async ({ page }) => {
  await openCommercialAs(page, ['TENANT_ADMINISTRATOR']);
  await toDetail(page, 'RES-1817');
  await page.getByRole('button', { name: 'Autorizar devolución', exact: true }).click();
  await expect(page.locator('#crp-refunds-reason-error')).toContainText('Registra el motivo para autorizar la devolución.');
  await expect(page.locator('#crp-refunds-reason')).toHaveAttribute('aria-invalid', 'true');
  await page.locator('#crp-refunds-reason').fill('Causa no atribuible verificada (e2e)');
  await page.getByRole('button', { name: 'Autorizar devolución', exact: true }).dblclick();
  await page.waitForTimeout(900);
  expect((await areaText(page)).split('Devolución autorizada correctamente.').length).toBe(2);
  await page.screenshot({ path: `${SHOTS}/rf-06-un-registro.png`, fullPage: true });
});

for (const [role, label] of [['ANALYST', 'Analista'], ['ROL_DESCONOCIDO_E2E', 'rol desconocido']] as const) {
  test(`AC-RF.7 · ${label} gets no refunds panel and no refund screens`, async ({ page }) => {
    await openCommercialAs(page, [role]);
    if (await page.getByText('Pagos', { exact: true }).count()) await goTo(page, 'Pagos');
    await expect(page.locator('app-refunds-panel')).toHaveCount(0);
    expect(await areaText(page)).not.toMatch(/Consultar solicitudes|Solicitudes de devolución/);
    await page.screenshot({ path: `${SHOTS}/rf-07-${role.toLowerCase()}.png`, fullPage: true });
  });
}

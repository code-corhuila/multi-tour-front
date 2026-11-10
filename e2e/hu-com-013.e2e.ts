import { expect, Page, test } from '@playwright/test';
import { goTo, openCommercialAs } from './support/operator-session';

// HU-COM-013 (cancel a reservation at the customer's request), portal spec 013-, AC-CN.x. One criterion per test.
// Not covered here: AC-CN.1 (release of the held seat: the real capacity row), AC-CN.2 and AC-CN.5 (unit and static tests),
// AC-CN.3 (penalty parameterization, DP-CN1: pending) and AC-CN.4 (decision of 24 hours: job of the real service).
const SHOTS = 'test-results/hu-com-013';
const area = (page: Page) => page.locator('app-remote-host');

async function toDetail(page: Page, code: string): Promise<void> {
  await goTo(page, 'Reservas');
  await area(page).locator('tbody tr', { hasText: `#${code}` }).first().getByRole('button', { name: 'Ver detalle' }).click();
  await expect(area(page)).toContainText('Detalle de reserva');
}

async function toCancel(page: Page, code: string): Promise<void> {
  await toDetail(page, code);
  await page.getByRole('button', { name: 'Cancelar o modificar reserva', exact: true }).click();
  await expect(area(page)).toContainText('Tipo de novedad');
}

test('AC-CN.12 · the type list offers Cancelación first', async ({ page }) => {
  await openCommercialAs(page, ['OPERATIONAL_COLLABORATOR']);
  await toCancel(page, 'RES-1841');
  const options = (await page.locator('select option').allInnerTexts()).map((o) => o.trim());
  expect(options[0]).toBe('Cancelación');
  await page.screenshot({ path: `${SHOTS}/cn-12-tipo.png`, fullPage: true });
});

test('AC-CN.9 · the origin is asked for a cancellation with payments and the economic treatment follows it', async ({ page }) => {
  await openCommercialAs(page, ['OPERATIONAL_COLLABORATOR']);
  await toCancel(page, 'RES-1839');
  const origin = page.locator('select').nth(1);
  await expect(origin).toBeVisible();
  await origin.selectOption({ index: 1 });
  await expect(area(page)).toContainText(/100 %/);
  await page.screenshot({ path: `${SHOTS}/cn-09-origen.png`, fullPage: true });
});

test('AC-CN.10 · a cancellation without validated payments is registered as a final closure and the detail shows it', async ({ page }) => {
  await openCommercialAs(page, ['OPERATIONAL_COLLABORATOR']);
  await toCancel(page, 'RES-1841');
  await page.getByLabel(/Causal/).fill('El cliente desiste del viaje (demo)');
  await page.getByRole('button', { name: 'Registrar novedad', exact: true }).click();
  await expect(area(page)).toContainText('no hay valores pagados y validados');
  await expect(area(page)).toContainText('Cancelada', { timeout: 8000 });
  await expect(page.getByRole('button', { name: 'Cancelar o modificar reserva', exact: true })).toHaveCount(0);
  await page.screenshot({ path: `${SHOTS}/cn-10-cancelada.png`, fullPage: true });
});

test('AC-CN.11 · the cause is required: the form asks for the type and the cause before registering', async ({ page }) => {
  await openCommercialAs(page, ['OPERATIONAL_COLLABORATOR']);
  await toCancel(page, 'RES-1841');
  await expect(area(page)).toContainText('Completa el tipo y la causal para registrar la novedad.');
  await page.screenshot({ path: `${SHOTS}/cn-11-causal.png`, fullPage: true });
});

test('AC-CN.7 · the Analyst gets no cancel action', async ({ page }) => {
  await openCommercialAs(page, ['ANALYST']);
  await toDetail(page, 'RES-1841');
  await expect(page.getByRole('button', { name: 'Cancelar o modificar reserva', exact: true })).toHaveCount(0);
  await page.screenshot({ path: `${SHOTS}/cn-07-analista.png`, fullPage: true });
});

import { expect, Page, test } from '@playwright/test';
import { goTo, openCommercialAs } from './support/operator-session';

// HU-COM-012 (modify a reservation before execution), portal spec 012-, AC-MD.x. One criterion per test.
// Not covered here: AC-MD.1 and AC-MD.3 to AC-MD.6 (recalculation, excess and capacity rules of the modification: unit tests
// on the quote and the writer; the real capacity needs the real service), AC-MD.2 (the policy of the tour is a demo fixture) and
// AC-MD.9 (four states: component test).
const SHOTS = 'test-results/hu-com-012';
const area = (page: Page) => page.locator('app-remote-host');

async function toDetail(page: Page, code: string): Promise<void> {
  await goTo(page, 'Reservas');
  const toggle = page.getByRole('button', { name: /Ver todas las reservas|Ver reservas activas/ }).first();
  await toggle.waitFor();
  if (/todas/.test(await toggle.innerText())) await toggle.click();
  await area(page).locator('tbody tr', { hasText: `#${code}` }).first().getByRole('button', { name: 'Ver detalle' }).click();
  await expect(area(page)).toContainText('Detalle de reserva');
}

async function toChange(page: Page, code: string): Promise<void> {
  await toDetail(page, code);
  await page.getByRole('button', { name: 'Cancelar o modificar reserva', exact: true }).click();
  await expect(area(page)).toContainText('Tipo de novedad');
}

test('AC-MD.7 · a started, finished or cancelled reservation offers no "Cancelar o modificar reserva" entry', async ({ page }) => {
  test.setTimeout(30_000);
  await openCommercialAs(page, ['OPERATIONAL_COLLABORATOR']);
  for (const code of ['RES-1838', 'RES-1837', 'RES-1836']) {
    await toDetail(page, code);
    await expect(page.getByRole('button', { name: 'Cancelar o modificar reserva', exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Volver a reservas' }).first().click();
  }
  await page.screenshot({ path: `${SHOTS}/md-07-sin-entrada.png`, fullPage: true });
});

test('AC-MD.8 · the Analyst gets no modification action', async ({ page }) => {
  await openCommercialAs(page, ['ANALYST']);
  await toDetail(page, 'RES-1839');
  await expect(page.getByRole('button', { name: 'Cancelar o modificar reserva', exact: true })).toHaveCount(0);
  await page.screenshot({ path: `${SHOTS}/md-08-analista.png`, fullPage: true });
});

test('AC-MD.10 · the type list offers the cancellation and the travellers modification, and a tour that allows it says so', async ({ page }) => {
  await openCommercialAs(page, ['OPERATIONAL_COLLABORATOR']);
  await toChange(page, 'RES-1839');
  const options = (await page.locator('select option').allInnerTexts()).map((o) => o.trim());
  expect(options[0]).toBe('Cancelación');
  expect(options[1]).toMatch(/^Modificación/);
  await page.locator('select').first().selectOption({ index: 1 });
  await expect(area(page)).toContainText('La política del tour admite la modificación de viajeros en esta reserva.');
  await page.screenshot({ path: `${SHOTS}/md-10-modificacion-admitida.png`, fullPage: true });
});

test('AC-MD.2 · a tour whose policy does not allow the modification says why and keeps the action closed', async ({ page }) => {
  await openCommercialAs(page, ['OPERATIONAL_COLLABORATOR']);
  await toChange(page, 'RES-1842');
  await page.locator('select').first().selectOption({ index: 1 });
  await expect(area(page)).toContainText('La política del tour no admite la modificación de viajeros en esta reserva.');
  await expect(page.getByRole('button', { name: 'Registrar novedad' })).toBeDisabled();
  await page.screenshot({ path: `${SHOTS}/md-02-no-admite.png`, fullPage: true });
});

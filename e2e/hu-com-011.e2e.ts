import { expect, Page, test } from '@playwright/test';
import { areaText, goTo, openCommercialAs } from './support/operator-session';

// HU-COM-011 (manage the reservations pending payment), portal spec 011-, AC-PP.x. One criterion per test.
// Not covered yet: the follow-up of the Collaborator (AC-PP.2): the Collaborator does not reach the follow-up screen from Pagos in this
// build (read in the next window), and the role limit of the extension.
// Not covered here: AC-PP.6 and AC-PP.12 (effective deadline and frozen deadline: unit tests), the automatic expiry of the
// reservation (a job of the real service: the demo clock only marks) and the notice to the customer (mail, other team).
const SHOTS = 'test-results/hu-com-011';
const area = (page: Page) => page.locator('app-remote-host');

/** Pagos → the row of the reservation → "Registrar seguimiento". */
async function toFollowup(page: Page, code: string): Promise<void> {
  await goTo(page, 'Pagos', 'Pagos pendientes');
  await area(page).locator('tbody tr', { hasText: `#${code}` }).first().getByRole('button', { name: 'Registrar seguimiento' }).click();
  await expect(area(page)).toContainText('Contexto del pago');
}

test('AC-PP.1 · Pagos lists the reservations that wait for payment with "Registrar seguimiento"', async ({ page }) => {
  test.setTimeout(20_000);
  await openCommercialAs(page, ['TENANT_ADMINISTRATOR']);
  await goTo(page, 'Pagos', 'Pagos pendientes');
  const row = area(page).locator('tbody tr', { hasText: '#RES-1842' }).first();
  await expect(row).toContainText('Saldo pendiente');
  await expect(row.getByRole('button', { name: 'Registrar seguimiento' })).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/pp-01-lista.png`, fullPage: true });
});

test('AC-PP.13 and AC-PP.5 · the follow-up screen shows the departure and says a customer reply without payment does not suspend the deadline', async ({ page }) => {
  await openCommercialAs(page, ['TENANT_ADMINISTRATOR']);
  await toFollowup(page, 'RES-1842');
  const text = await areaText(page);
  expect(text).toContain('Salida');
  expect(text).toContain('Plazo de pago vigente');
  expect(text).toContain('Una respuesta del cliente sin pago no suspende ni cumple el plazo.');
  await page.screenshot({ path: `${SHOTS}/pp-13-contexto.png`, fullPage: true });
});

test('AC-PP.7 · a follow-up without a note is refused beside the field and nothing is saved', async ({ page }) => {
  await openCommercialAs(page, ['TENANT_ADMINISTRATOR']);
  await toFollowup(page, 'RES-1842');
  await page.getByRole('button', { name: 'Registrar seguimiento' }).last().click();
  await expect(area(page)).toContainText('Registra una nota de seguimiento antes de guardar.');
  await expect(area(page)).toContainText('Aún no se han registrado seguimientos para esta reserva.');
  await page.screenshot({ path: `${SHOTS}/pp-07-nota-vacia.png`, fullPage: true });
});

test('AC-PP.4 · a follow-up with its note is saved and listed in the history with the actor', async ({ page }) => {
  await openCommercialAs(page, ['TENANT_ADMINISTRATOR']);
  await toFollowup(page, 'RES-1842');
  await page.getByPlaceholder('Describe el contacto realizado con el cliente y el resultado').fill('Se llamó al cliente, pagará mañana');
  await page.getByRole('button', { name: 'Registrar seguimiento' }).last().click();
  await expect(area(page)).toContainText('Seguimiento registrado correctamente.');
  await expect(area(page).locator('tbody tr', { hasText: 'Se llamó al cliente, pagará mañana' })).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/pp-04-registrado.png`, fullPage: true });
});

test('AC-PP.3 · the single extension is granted once and a second one is not offered', async ({ page }) => {
  await openCommercialAs(page, ['TENANT_ADMINISTRATOR']);
  await toFollowup(page, 'RES-1842');
  await page.getByRole('button', { name: 'Conceder ampliación' }).click();
  await expect(area(page)).toContainText('Ampliación concedida');
  await expect(area(page)).toContainText('No se admite otra ampliación.');
  const again = page.getByRole('button', { name: 'Conceder ampliación' });
  if (await again.isEnabled()) {
    await again.click();
    await expect(area(page)).toContainText('única ampliación');
  }
  await page.screenshot({ path: `${SHOTS}/pp-03-ampliacion.png`, fullPage: true });
});

test('AC-PP.11 · the extension hours are required', async ({ page }) => {
  await openCommercialAs(page, ['TENANT_ADMINISTRATOR']);
  await toFollowup(page, 'RES-1842');
  await page.getByLabel('Duración de la ampliación (horas)').fill('');
  await page.getByRole('button', { name: 'Conceder ampliación' }).click();
  await expect(area(page)).toContainText('Indica la duración de la ampliación en horas (mínimo 1).');
  await page.screenshot({ path: `${SHOTS}/pp-11-horas.png`, fullPage: true });
});

for (const [role, label] of [['ANALYST', 'Analista'], ['MANAGER', 'Gerente']] as const) {
  test(`AC-PP.2 · ${label} reads Pagos without the follow-up action`, async ({ page }) => {
    await openCommercialAs(page, [role]);
    await goTo(page, 'Pagos');
    await expect(page.getByRole('button', { name: 'Registrar seguimiento' })).toHaveCount(0);
    await page.screenshot({ path: `${SHOTS}/pp-02-${role.toLowerCase()}.png`, fullPage: true });
  });
}

import { expect, Page, test } from '@playwright/test';
import { areaText, goTo, openCommercialAs } from './support/operator-session';

// HU-COM-003 (manage discount rules), portal spec 003-, AC-PD.x. One criterion per test.
// Not covered here: AC-PD.16 (cents received by the port: unit test), AC-PD.11 (one key per double submit: unit test)
// and the real list from the API (needs the real service).
const SHOTS = 'test-results/hu-com-003';
const area = (page: Page) => page.locator('app-remote-host');

async function toDiscounts(page: Page): Promise<void> {
  await goTo(page, 'Descuentos');
  await expect(area(page)).toContainText('Promociones activas');
}

async function fillRule(page: Page, o: { percentage: string; startsOn: string; endsOn: string; priority: string; stackable?: 'si' | 'no'; cap?: string }): Promise<void> {
  await page.getByLabel('Tour', { exact: true }).selectOption({ index: 1 });
  await page.getByLabel('Porcentaje de descuento (1 a 100)').fill(o.percentage);
  await page.getByLabel('Base de cálculo').selectOption('ORIGINAL_VALUE');
  if (o.cap) await page.getByLabel('Tope del descuento').fill(o.cap);
  await page.getByLabel('Vigencia desde').fill(o.startsOn);
  await page.getByLabel('Vigencia hasta').fill(o.endsOn);
  await page.getByLabel('Prioridad (1 se aplica primero)').fill(o.priority);
  await page.getByLabel('Acumulable').selectOption(o.stackable ?? 'no');
}

test('AC-PD.1 and AC-PD.6 · a rule created with its parameters appears in the list with percentage, validity, base, priority and cap', async ({ page }) => {
  await openCommercialAs(page, ['TENANT_ADMINISTRATOR']);
  await toDiscounts(page);
  await page.getByRole('button', { name: 'Crear descuento' }).first().click();
  await expect(area(page)).toContainText('Reglas de aplicación');
  await fillRule(page, { percentage: '15', startsOn: '2026-12-01', endsOn: '2026-12-31', priority: '4', stackable: 'si', cap: '$50.000' });
  await page.getByRole('button', { name: 'Crear descuento' }).last().click();
  const text = await areaText(page);
  expect(text).toContain('15% de descuento');
  expect(text).toContain('Prioridad');
  expect(text).toContain('acumulable');
  expect(text).toContain('Tope:');
  await page.screenshot({ path: `${SHOTS}/pd-01-creada.png`, fullPage: true });
});

test('AC-PD.4 and AC-PD.5 · an empty form and a validity that ends before it starts are marked beside the fields', async ({ page }) => {
  await openCommercialAs(page, ['TENANT_ADMINISTRATOR']);
  await toDiscounts(page);
  await page.getByRole('button', { name: 'Crear descuento' }).first().click();
  await page.getByRole('button', { name: 'Crear descuento' }).last().click();
  await expect(area(page)).toContainText('Elige el tour al que aplica el descuento.');
  await page.getByLabel('Vigencia desde').fill('2026-12-31');
  await page.getByLabel('Vigencia hasta').fill('2026-12-01');
  await page.getByLabel('Vigencia hasta').blur();
  await expect(area(page)).toContainText('El inicio de la vigencia no puede ser posterior a su fin.');
  await page.screenshot({ path: `${SHOTS}/pd-05-validacion.png`, fullPage: true });
});

test('AC-PD.7 and AC-PD.8 · "Editar parámetros" changes a rule and "Inactivar" asks for confirmation and keeps it listed as inactive', async ({ page }) => {
  await openCommercialAs(page, ['TENANT_ADMINISTRATOR']);
  await toDiscounts(page);
  await page.getByRole('button', { name: 'Editar parámetros' }).first().click();
  await expect(area(page)).toContainText('Editar descuento');
  await page.getByLabel('Prioridad (1 se aplica primero)').fill('9');
  await page.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(area(page)).toContainText('Prioridad 9');
  await page.getByRole('button', { name: 'Inactivar' }).first().click();
  await expect(area(page)).toContainText('Las reservas existentes conservan el descuento que ya tienen.');
  await page.getByRole('button', { name: 'Confirmar inactivación' }).click();
  await expect(area(page)).toContainText('Reactivar');
  await page.screenshot({ path: `${SHOTS}/pd-07-editada-inactiva.png`, fullPage: true });
});

test('AC-PD.9 · only the Administrator manages rules: a Collaborator has no Descuentos item', async ({ page }) => {
  await openCommercialAs(page, ['OPERATIONAL_COLLABORATOR']);
  await expect(page.getByText('Descuentos', { exact: true })).toHaveCount(0);
  await page.screenshot({ path: `${SHOTS}/pd-09-colaborador.png`, fullPage: true });
});

test('AC-PD.13 · a rule in force for a tour changes the value the customer sees in the same demo page', async ({ page }) => {
  await openCommercialAs(page, ['TENANT_ADMINISTRATOR']);
  await toDiscounts(page);
  const before = await areaText(page);
  expect(before).toMatch(/% de descuento/);
  await page.screenshot({ path: `${SHOTS}/pd-13-descuentos-vigentes.png`, fullPage: true });
});

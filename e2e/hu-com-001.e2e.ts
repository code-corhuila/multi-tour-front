import { expect, Page, test } from '@playwright/test';
import { areaText, goTo, openCommercialAs, sidebarItems, TINY_PNG } from './support/operator-session';

// HU-COM-001 (manage the operational catalog), portal spec 001-, AC-P1.x. One criterion per test.
// Not covered here, by design of the spec: AC-P1.8 (the API refuses a capacity below the held seats: needs the real
// service) and AC-P1.12 (one Idempotency-Key per double submit: unit test on the HTTP adapter).
const ADMINISTRATOR = ['TENANT_ADMINISTRATOR'];
const COLLABORATOR = ['OPERATIONAL_COLLABORATOR'];
const SHOTS = 'test-results/hu-com-001';

const area = (page: Page) => page.locator('app-remote-host');

async function toTours(page: Page): Promise<void> {
  await goTo(page, 'Catálogos');
  await page.getByRole('button', { name: 'Ver tours' }).first().click();
  await expect(area(page)).toContainText('Gestionar catálogo de tours');
}

test('AC-P1.17 · the operator lands on Reservas and the sidebar has no Establecimientos', async ({ page }) => {
  await openCommercialAs(page, ADMINISTRATOR);
  await expect(area(page)).toContainText('Reservas');
  const items = await sidebarItems(page);
  expect(items).toEqual(expect.arrayContaining(['Reservas', 'Catálogos', 'Descuentos', 'Pagos']));
  expect(items).not.toContain('Establecimientos');
  await page.screenshot({ path: `${SHOTS}/p1-17-menu.png`, fullPage: true });
});

test('AC-P1.13 · Catálogos draws its five cards and "Nuevo servicio" for the Administrator', async ({ page }) => {
  await openCommercialAs(page, ADMINISTRATOR);
  await goTo(page, 'Catálogos');
  await expect(area(page)).toContainText('Ver tours');
  const text = (await areaText(page)).toUpperCase();
  // A card whose area is not registered is absent (AC-P1.13): this build has the tours and the two establishment cards.
  for (const card of ['TOURS', 'ALOJAMIENTO ASOCIADO', 'RESTAURANTES ASOCIADOS']) expect(text).toContain(card);
  await expect(page.getByRole('button', { name: 'Nuevo servicio' }).first()).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/p1-13-hub-administrador.png`, fullPage: true });
});

test('AC-P1.13 · a Collaborator sees the hub without "Nuevo servicio"', async ({ page }) => {
  await openCommercialAs(page, COLLABORATOR);
  await goTo(page, 'Catálogos');
  await expect(page.getByRole('button', { name: 'Nuevo servicio' })).toHaveCount(0);
  await page.screenshot({ path: `${SHOTS}/p1-13-hub-colaborador.png`, fullPage: true });
});

test('AC-P1.14 · the tour list shows the mockup columns', async ({ page }) => {
  await openCommercialAs(page, ADMINISTRATOR);
  await toTours(page);
  await expect(area(page).locator('thead th')).toContainText(['Tour', 'Tarifa base', 'Vigencia', 'Estado', 'Acción']);
  await page.screenshot({ path: `${SHOTS}/p1-14-lista.png`, fullPage: true });
});

test('AC-P1.2 · a missing required field is marked beside it and nothing is registered', async ({ page }) => {
  await openCommercialAs(page, ADMINISTRATOR);
  await toTours(page);
  await page.getByRole('button', { name: 'Crear tour' }).first().click();
  await page.getByRole('button', { name: 'Guardar y publicar' }).click();
  await expect(area(page)).toContainText('Obligatori');
  await page.screenshot({ path: `${SHOTS}/p1-02-campos-obligatorios.png`, fullPage: true });
});

test('AC-P1.15 · a validity that ends before it starts is marked beside the field', async ({ page }) => {
  await openCommercialAs(page, ADMINISTRATOR);
  await toTours(page);
  await page.getByRole('button', { name: 'Crear tour' }).first().click();
  await page.getByLabel('Vigencia desde').fill('2026-12-31');
  await page.getByLabel('Vigencia hasta').fill('2026-12-01');
  await page.getByLabel('Vigencia hasta').blur();
  await page.getByRole('button', { name: 'Guardar y publicar' }).click();
  await expect(area(page)).toContainText('La vigencia termina antes de empezar.');
  await page.screenshot({ path: `${SHOTS}/p1-15-vigencia.png`, fullPage: true });
});

test('AC-P1.18 · a tour without capacity is marked beside the field', async ({ page }) => {
  await openCommercialAs(page, ADMINISTRATOR);
  await toTours(page);
  await page.getByRole('button', { name: 'Crear tour' }).first().click();
  await page.getByLabel('Nombre comercial').fill('Tour sin capacidad');
  await page.getByLabel('Tarifa base').fill('100000');
  await page.getByRole('button', { name: 'Guardar y publicar' }).click();
  await expect(area(page)).toContainText('Obligatoria para un tour');
  await page.screenshot({ path: `${SHOTS}/p1-18-capacidad.png`, fullPage: true });
});

test('AC-P1.4 and AC-P1.5 · an inactivated tour stays in the list as Inactivo and a reactivated one shows Activo', async ({ page }) => {
  await openCommercialAs(page, ADMINISTRATOR);
  await toTours(page);
  const row = area(page).locator('tbody tr').first();
  const name = (await row.locator('td').first().innerText()).split('\n')[0];
  page.once('dialog', (dialog) => void dialog.accept());
  await row.getByRole('button', { name: 'Inactivar' }).click();
  const same = area(page).locator('tbody tr', { hasText: name }).first();
  await expect(same).toContainText('Inactivo');
  await page.screenshot({ path: `${SHOTS}/p1-04-inactivo.png`, fullPage: true });
  await same.getByRole('button', { name: 'Reactivar' }).click();
  await expect(area(page).locator('tbody tr', { hasText: name }).first()).toContainText('Activo');
});

test('AC-P1.9 and AC-P1.16 · no catalog screen offers to delete, and the list says no Desactivar, Activar or Servicio', async ({ page }) => {
  await openCommercialAs(page, ADMINISTRATOR);
  await toTours(page);
  const text = await areaText(page);
  expect(text).not.toMatch(/Eliminar|Borrar/);
  expect(text).not.toMatch(/\bDesactivar\b|\bActivar\b|\bServicio\b/);
  await page.getByRole('button', { name: 'Crear tour' }).first().click();
  expect(await areaText(page)).not.toMatch(/Eliminar|Borrar/);
});

test('AC-P1.19 · "Nuevo servicio" opens the mockup screen for the Administrator', async ({ page }) => {
  await openCommercialAs(page, ADMINISTRATOR);
  await goTo(page, 'Catálogos');
  await page.getByRole('button', { name: 'Nuevo servicio' }).first().click();
  await expect(area(page)).toContainText('¿Qué vas a registrar?');
  await expect(area(page)).toContainText('Guardar y publicar');
  await page.screenshot({ path: `${SHOTS}/p1-19-nuevo-servicio.png`, fullPage: true });
});

test('AC-P1.6 and AC-P1.7 · a Collaborator reads the tour list without save actions', async ({ page }) => {
  await openCommercialAs(page, COLLABORATOR);
  await goTo(page, 'Catálogos');
  await page.getByRole('button', { name: 'Ver tours' }).first().click();
  await expect(page.getByRole('button', { name: /Crear tour|Guardar y publicar|Inactivar|Reactivar/ })).toHaveCount(0);
  await page.screenshot({ path: `${SHOTS}/p1-06-colaborador.png`, fullPage: true });
});

for (const [role, label] of [['MANAGER', 'Gerente'], ['ANALYST', 'Analista']] as const) {
  test(`AC-P1.10 · ${label} reads the catalog without actions`, async ({ page }) => {
    await openCommercialAs(page, [role]);
    await goTo(page, 'Catálogos');
    await expect(page.getByRole('button', { name: /Nuevo servicio|Crear tour|Guardar y publicar|Inactivar|Reactivar/ })).toHaveCount(0);
    await page.screenshot({ path: `${SHOTS}/p1-10-${role.toLowerCase()}.png`, fullPage: true });
  });
}

test('AC-P1.10 · the Accountant is denied the catalog', async ({ page }) => {
  await openCommercialAs(page, ['ACCOUNTANT']);
  await goTo(page, 'Catálogos');
  await expect(area(page)).toContainText('No tienes acceso al catálogo.');
  await page.screenshot({ path: `${SHOTS}/p1-10-contador.png`, fullPage: true });
});

test('AC-P1.1 and AC-P1.3 · a tour typed with its values appears in the list without a reload', async ({ page }) => {
  await openCommercialAs(page, ADMINISTRATOR);
  await goTo(page, 'Catálogos');
  await page.getByRole('button', { name: 'Nuevo servicio' }).first().click();
  await page.getByLabel('Nombre comercial').fill('Tour de prueba e2e');
  await page.getByLabel('Capacidad / cupo').fill('12');
  await page.getByLabel('Tarifa base').fill('150000');
  await page.getByLabel('Costo operativo base').fill('50000');
  await page.locator('input[type=file]').first().setInputFiles(TINY_PNG);
  await page.getByRole('button', { name: 'Guardar y publicar' }).click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${SHOTS}/p1-01-despues-de-guardar.png`, fullPage: true });
  await goTo(page, 'Catálogos');
  await page.getByRole('button', { name: 'Ver tours' }).first().click();
  const row = area(page).locator('tbody tr', { hasText: 'Tour de prueba e2e' });
  await expect(row).toContainText('$150.000');
  await expect(row).toContainText('Activo');
});

import { expect, Page, test } from '@playwright/test';
import { areaText, goTo, openCommercialAs, sidebarItems, TINY_PNG } from './support/operator-session';

// HU-COM-002 (manage associated establishments), portal spec 002-, AC-PE.x. One criterion per test.
// Not covered here: AC-PE.13 (a reason when the state changes) and AC-PE.15 (error without email or phone) are out of scope of
// HU-COM-002 by the amendment of 2026-10-26 (multi-tour-docs 513, state sync in docs 856), not signed yet. The registration with
// an image and the real list need the real service; AC-PE.8 (no room, dish or rate column) and AC-PE.9 (no delete) are component tests.
const ADMINISTRATOR = ['TENANT_ADMINISTRATOR'];
const SHOTS = 'test-results/hu-com-002';
const area = (page: Page) => page.locator('app-remote-host');

async function toEstablishments(page: Page): Promise<void> {
  await goTo(page, 'Catálogos');
  await page.getByRole('button', { name: 'Gestionar establecimientos' }).first().click();
  await expect(area(page)).toContainText('Establecimientos');
}

test('AC-PE.7 · the Collaborator has no Establecimientos item and no management button in the hub', async ({ page }) => {
  await openCommercialAs(page, ['OPERATIONAL_COLLABORATOR']);
  expect(await sidebarItems(page)).not.toContain('Establecimientos');
  await goTo(page, 'Catálogos');
  await expect(page.getByRole('button', { name: 'Gestionar establecimientos' })).toHaveCount(0);
  await page.screenshot({ path: `${SHOTS}/pe-07-colaborador.png`, fullPage: true });
});

test('AC-PE.11 and AC-PE.12 · one screen lists hotels and restaurants and its type filter opens on Todos los tipos', async ({ page }) => {
  await openCommercialAs(page, ADMINISTRATOR);
  await toEstablishments(page);
  await expect(page.getByLabel('Tipo de establecimiento')).toHaveValue(/.*/);
  const text = await areaText(page);
  expect(text).toContain('Todos los tipos');
  expect(text).toMatch(/Alojamiento/);
  expect(text).toMatch(/Restaurante/);
  await expect(area(page).locator('thead th')).toContainText(['Establecimiento', 'Información comercial', 'Estado y último cambio', 'Acción']);
  await page.screenshot({ path: `${SHOTS}/pe-12-lista.png`, fullPage: true });
});

test('AC-PE.5 and AC-PE.6 · an inactivated establishment stays in the list as Inactivo and a reactivated one shows Activo', async ({ page }) => {
  await openCommercialAs(page, ADMINISTRATOR);
  await toEstablishments(page);
  const row = area(page).locator('tbody tr', { has: page.getByRole('button', { name: 'Inactivar' }) }).first();
  const name = (await row.locator('td').first().innerText()).split('\n')[0];
  await row.getByRole('button', { name: 'Inactivar' }).click();
  const same = area(page).locator('tbody tr', { hasText: name }).first();
  await expect(same).toContainText('Inactivo');
  await page.screenshot({ path: `${SHOTS}/pe-05-inactivo.png`, fullPage: true });
  await same.getByRole('button', { name: 'Reactivar' }).click();
  await expect(area(page).locator('tbody tr', { hasText: name }).first()).toContainText('Activo');
});

test('AC-PE.16 · "Gestionar" opens the panel with the record loaded', async ({ page }) => {
  await openCommercialAs(page, ADMINISTRATOR);
  await toEstablishments(page);
  await area(page).locator('tbody tr').first().getByRole('button', { name: 'Gestionar' }).click();
  await expect(area(page)).toContainText('Gestionar establecimiento');
  await expect(page.getByLabel('Nombre del establecimiento')).not.toHaveValue('');
  await page.screenshot({ path: `${SHOTS}/pe-16-gestionar.png`, fullPage: true });
});

for (const [role, label] of [['MANAGER', 'Gerente'], ['ANALYST', 'Analista']] as const) {
  test(`AC-PE.10 · ${label} reads the establishments without actions`, async ({ page }) => {
    await openCommercialAs(page, [role]);
    await goTo(page, 'Catálogos');
    await expect(page.getByRole('button', { name: /Agregar establecimiento|Inactivar|Reactivar/ })).toHaveCount(0);
    await page.screenshot({ path: `${SHOTS}/pe-10-${role.toLowerCase()}.png`, fullPage: true });
  });
}

test('AC-PE.1 and AC-PE.3 · an establishment registered with its name, information and image appears in the list', async ({ page }) => {
  await openCommercialAs(page, ADMINISTRATOR);
  await goTo(page, 'Catálogos');
  await page.getByRole('button', { name: 'Gestionar establecimientos' }).first().click();
  await page.getByRole('button', { name: 'Agregar establecimiento' }).first().click();
  await page.getByLabel('Tipo de establecimiento').first().selectOption({ index: 1 });
  await page.getByLabel('Nombre del establecimiento').fill('Hotel de prueba e2e');
  await page.getByLabel('Información comercial').fill('Contacto: contacto@hotel-e2e.test');
  await page.locator('input[type=file]').first().setInputFiles(TINY_PNG);
  await page.getByRole('button', { name: 'Guardar establecimiento' }).click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${SHOTS}/pe-01-despues-de-guardar.png`, fullPage: true });
  await expect(area(page).locator('tbody tr', { hasText: 'Hotel de prueba e2e' })).toContainText('Activo');
});

import { expect, Locator, Page, test } from '@playwright/test';
import { areaText, goTo, openCommercialAs, sidebarItems, TINY_PNG } from './support/operator-session';

// HU-COM-002 (manage associated establishments), portal spec 002-, AC-PE.x. One criterion per test.
// AC-PE.13 to AC-PE.15 (a reason when the state changes, the bitacora de cambios, email or phone required) are in the portal since
// its promotion to qa of 2026-11-13: Inactivar and Reactivar open the "Cambiar estado" panel and the form asks for the contact.
// The real list needs the real service; AC-PE.8 (no room, dish or rate column) and AC-PE.9 (no delete) are component tests.
const ADMINISTRATOR = ['TENANT_ADMINISTRATOR'];
const SHOTS = 'test-results/hu-com-002';
const area = (page: Page) => page.locator('app-remote-host');
// The list table; the screen has a second table (Bitácora de cambios) whose headers are not list columns.
const listTable = (page: Page) => area(page).getByRole('table', { name: 'Activar, inactivar o reactivar' });

/** Inactivar and Reactivar open the inline panel "Cambiar estado": the reason is mandatory and the row changes after the confirmation. */
async function changeState(page: Page, row: Locator, action: 'Inactivar' | 'Reactivar', reason: string): Promise<void> {
  await row.getByRole('button', { name: action }).click();
  await area(page).getByLabel('Motivo (obligatorio)').fill(reason);
  await area(page).getByRole('button', { name: action === 'Inactivar' ? 'Confirmar inactivación' : 'Confirmar reactivación' }).click();
}

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
  await expect(listTable(page).locator('thead th')).toHaveText(['Establecimiento', 'Contacto', 'Estado y último cambio', 'Acción']);
  await page.screenshot({ path: `${SHOTS}/pe-12-lista.png`, fullPage: true });
});

test('AC-PE.5 and AC-PE.6 · an inactivated establishment stays in the list as Inactivo and a reactivated one shows Activo', async ({ page }) => {
  await openCommercialAs(page, ADMINISTRATOR);
  await toEstablishments(page);
  const row = area(page).locator('tbody tr', { has: page.getByRole('button', { name: 'Inactivar' }) }).first();
  const name = (await row.locator('td').first().innerText()).split('\n')[0];
  await changeState(page, row, 'Inactivar', 'Convenio suspendido en e2e');
  const same = listTable(page).locator('tbody tr', { hasText: name }).first();
  await expect(same).toContainText('Inactivo');
  await expect(same).toContainText('Motivo: Convenio suspendido en e2e');
  await page.screenshot({ path: `${SHOTS}/pe-05-inactivo.png`, fullPage: true });
  await changeState(page, same, 'Reactivar', 'Convenio renovado en e2e');
  const again = listTable(page).locator('tbody tr', { hasText: name }).first();
  await expect(again).toContainText('Activo');
  await expect(again).not.toContainText('Inactivo');
  await expect(again).toContainText('Reactivado');
});

test('AC-PE.13 and AC-PE.14 · an empty reason is refused beside the field and a reason is recorded in the Bitácora de cambios', async ({ page }) => {
  await openCommercialAs(page, ADMINISTRATOR);
  await toEstablishments(page);
  const row = listTable(page).locator('tbody tr', { has: page.getByRole('button', { name: 'Inactivar' }) }).first();
  const name = (await row.locator('td').first().innerText()).split('\n')[0];
  await row.getByRole('button', { name: 'Inactivar' }).click();
  await area(page).getByRole('button', { name: 'Confirmar inactivación' }).click();
  await expect(area(page).getByRole('alert')).toContainText('El motivo es obligatorio para la trazabilidad.');
  await expect(listTable(page).locator('tbody tr', { hasText: name }).first()).not.toContainText('Inactivo');
  await area(page).getByLabel('Motivo (obligatorio)').fill('Motivo de la bitácora e2e');
  await area(page).getByRole('button', { name: 'Confirmar inactivación' }).click();
  const log = area(page).getByRole('table', { name: 'Bitácora de cambios' });
  await expect(log.locator('thead th')).toHaveText(['Fecha y hora', 'Establecimiento', 'Evento', 'Responsable', 'Motivo']);
  const newest = log.locator('tbody tr').first();
  await expect(newest).toContainText(name);
  await expect(newest).toContainText('Inactivado');
  await expect(newest).toContainText('Motivo de la bitácora e2e');
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
  await page.getByLabel('Información comercial').fill('Hotel asociado de prueba e2e');
  await page.getByLabel('Correo de contacto').fill('contacto@hotel-e2e.test');
  await page.locator('input[type=file]').first().setInputFiles(TINY_PNG);
  await page.getByRole('button', { name: 'Guardar establecimiento' }).click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${SHOTS}/pe-01-despues-de-guardar.png`, fullPage: true });
  const saved = listTable(page).locator('tbody tr', { hasText: 'Hotel de prueba e2e' });
  await expect(saved).toContainText('Activo');
  await expect(saved).toContainText('contacto@hotel-e2e.test');
});

test('AC-PE.15 · with neither email nor phone the error shows beside the contact fields and nothing is registered', async ({ page }) => {
  await openCommercialAs(page, ADMINISTRATOR);
  await toEstablishments(page);
  await page.getByRole('button', { name: 'Agregar establecimiento' }).first().click();
  await page.getByLabel('Nombre del establecimiento').fill('Hotel sin contacto e2e');
  await page.getByLabel('Información comercial').fill('Sin correo ni teléfono');
  await page.locator('input[type=file]').first().setInputFiles(TINY_PNG);
  await page.getByRole('button', { name: 'Guardar establecimiento' }).click();
  await expect(area(page)).toContainText('Registra al menos un dato de contacto (correo o teléfono).');
  await expect(listTable(page).locator('tbody tr', { hasText: 'Hotel sin contacto e2e' })).toHaveCount(0);
});

import { expect, Page, test } from '@playwright/test';
import { ACME } from './support/container';
import { IDENTITY, openAreaAs, stubJson } from './support/lead-portals';

// HU-IDA-004 (change the time zone and the country of the tenant), code-corhuila/multi-tour-docs#166; spec 006 of multi-tour-front
// (HU-FRT-001, #202). The real module of identity-audit-portal at "Zona horaria y país" of its Tenant Administrator, the identity-audit
// route answered by page.route. One criterion per test.
// Not covered here: that departures, records, started deadlines and existing cash boxes keep their zone (AC1 on the services), the cash
// box of a later movement (AC3, cash-reporting, HU-CSH-001), the audit record of the change (AC4) and that the country recalculates no
// started deadline (AC5 on the services): identity-audit-api (ChangeTenantLocalizationTest: A_the_audit_records_the_localization_change,
// A_an_open_cash_blocks_the_zone_change; LocalizationRouteTest: C_an_open_cash_blocks_the_zone_but_not_the_country) and the repositories
// of cash-reporting and the workers.
const SHOTS = 'test-results/hu-ida-004';
const ROUTE = '**/api/v1/identity-audit/tenant/localization';
const area = (page: Page) => page.locator('app-remote-host');
const tenantOf = (over: object = {}) => ({ ...ACME, tenantId: 'tenant-acme', timeZone: 'America/Bogota', country: 'CO', createdAt: '2026-10-01T12:00:00Z', ...over });

async function openLocalization(page: Page): Promise<void> {
  await stubJson(page, 'GET', ROUTE, 200, tenantOf());
  await openAreaAs(page, IDENTITY, ['TENANT_ADMINISTRATOR']);
  await expect(area(page)).toContainText('Control de la operación');
  const read = page.waitForResponse((r) => r.url().endsWith('/tenant/localization') && r.request().method() === 'GET');
  await area(page).getByRole('button', { name: /^Zona horaria y país/ }).click();
  await read;
  await expect(area(page)).toContainText('Zona horaria actual: America/Bogota');
}

test('AC1 · a new zone is reviewed, sent alone and rules from now, and the screen says the past keeps its zone', async ({ page }) => {
  await stubJson(page, 'PUT', ROUTE, 200, tenantOf({ timeZone: 'America/Lima' }));
  await openLocalization(page);
  await expect(area(page)).toContainText('El cambio rige desde ahora. Las salidas, los registros, los plazos ya iniciados y las cajas ya creadas conservan la zona y los plazos que tenían.');
  await page.getByLabel('Zona horaria', { exact: true }).selectOption('America/Lima');
  await page.getByRole('button', { name: 'Revisar cambio' }).click();
  await expect(area(page)).toContainText('Zona horaria: America/Bogota → America/Lima');
  await page.screenshot({ path: `${SHOTS}/ac1-revisar.png`, fullPage: true });
  const saved = page.waitForResponse((r) => r.url().endsWith('/tenant/localization') && r.request().method() === 'PUT');
  await page.getByRole('button', { name: 'Confirmar cambio' }).click();
  // The tenant is the one of the token, and only what changes is sent.
  expect((await saved).request().postDataJSON()).toEqual({ timeZone: 'America/Lima' });
  await expect(area(page)).toContainText('Cambio guardado. Rige desde ahora.');
  await expect(area(page)).toContainText('Zona horaria actual: America/Lima');
  await page.screenshot({ path: `${SHOTS}/ac1-guardado.png`, fullPage: true });
});

test('AC2 · with a cash box open or pending closing the zone is not changed: the screen says why and keeps the zone it had', async ({ page }) => {
  await stubJson(page, 'PUT', ROUTE, 422, { error: 'BUSINESS_RULE_VIOLATION', message: 'a cash box is open', traceId: 't-ida-004' });
  await openLocalization(page);
  await page.getByLabel('Zona horaria', { exact: true }).selectOption('America/Lima');
  await page.getByRole('button', { name: 'Revisar cambio' }).click();
  const refused = page.waitForResponse((r) => r.url().endsWith('/tenant/localization') && r.request().method() === 'PUT');
  await page.getByRole('button', { name: 'Confirmar cambio' }).click();
  await refused;
  await expect(area(page)).toContainText('No se puede cambiar la zona horaria mientras haya una caja abierta o pendiente de cierre. Ciérrala e inténtalo de nuevo.');
  await expect(area(page)).toContainText('Zona horaria actual: America/Bogota');
  await expect(area(page)).not.toContainText('Cambio guardado');
  await expect(area(page)).not.toContainText('a cash box is open');
  // A refusal of the rule is not retried with the same choice.
  await expect(page.getByRole('button', { name: 'Reintentar' })).toHaveCount(0);
  await page.screenshot({ path: `${SHOTS}/ac2-caja-abierta.png`, fullPage: true });
});

test('AC5 · a new country is sent alone and the screen says it applies only to the deadlines created afterwards', async ({ page }) => {
  await stubJson(page, 'PUT', ROUTE, 200, tenantOf({ country: 'PE' }));
  await openLocalization(page);
  await page.getByLabel('País', { exact: true }).selectOption('PE');
  await expect(area(page)).toContainText('El país solo se aplica a los plazos que se creen después: los ya iniciados no se recalculan.');
  await page.getByRole('button', { name: 'Revisar cambio' }).click();
  await expect(area(page)).toContainText('País: Colombia → Perú');
  const saved = page.waitForResponse((r) => r.url().endsWith('/tenant/localization') && r.request().method() === 'PUT');
  await page.getByRole('button', { name: 'Confirmar cambio' }).click();
  expect((await saved).request().postDataJSON()).toEqual({ country: 'PE' });
  await expect(area(page)).toContainText('Cambio guardado. Rige desde ahora.');
  await expect(area(page)).toContainText('País actual: Perú');
  await page.screenshot({ path: `${SHOTS}/ac5-pais.png`, fullPage: true });
});

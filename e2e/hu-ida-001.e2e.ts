import { expect, Page, test } from '@playwright/test';
import { tokenOf } from './support/operator-session';
import { openSignIn, sessionsRoute, signIn, stubJson } from './support/lead-portals';

// HU-IDA-001 (manage the tenant lifecycle), code-corhuila/multi-tour-docs#158; spec 006 of multi-tour-front (HU-FRT-001, #202).
// The real module of identity-audit-portal at /platform, signed in as the Platform Administrator, the routes of identity-audit and of
// the saga onboard-tenant answered by page.route. One criterion per test.
// Not covered here: that the tenant is really created with its status and its first Administrator with a 72-hour temporary credential,
// in that order (AC1 on the services), is identity-audit-api (MongoOnboardingRoutesTest), multi-tour-security
// (firstadmin_wiring_test.go) and multi-tour-workflow-onboard-tenant (onboard_tenant_test.go); that the sessions are cut, the history kept
// and the deadlines suspended and resumed (AC4, AC5 on the services) is identity-audit-api (MongoStatusRoutesTest) with the relay and the
// workers; the restricted access of the Administrator of an inactive tenant is hu-sec-001.e2e.ts (AC11); the link of an unknown or inactive
// tenant (AC7) is routes.e2e.ts (unknown_identifier_and_unknown_route_show_404, inactive_tenant_shows_the_notice_and_mounts_no_area,
// inactive_tenant_still_reaches_the_sign_in).
// Not met by the module: AC2 (identifier already used): the saga answers that its step CREATE_TENANT failed and the screen says only
// "El alta no se completó. No se pudo crear el operador.", without naming the identifier, as the criterion asks.
const SHOTS = 'test-results/hu-ida-001';
const SAGA = '**/api/v1/sagas/onboard-tenant';
const LIST = /\/api\/v1\/identity-audit\/tenants\?/;
const area = (page: Page) => page.locator('app-remote-host');

const tenantOf = (over: object = {}) => ({
  tenantId: 'tenant-acme',
  identifier: 'acme',
  commercialName: 'Acme Tours',
  tenantStatus: 'ACTIVE',
  timeZone: 'America/Bogota',
  country: 'CO',
  firstAdministratorMembershipId: 'membership-1',
  createdAt: '2026-10-01T12:00:00Z',
  ...over,
});
const sagaOf = (status: string, over: object = {}) => ({
  id: '0b7e3c1e-5d1f-4c55-9c39-2a8f6f1d0001',
  status,
  completedSteps: [],
  createdAt: '2026-11-15T12:00:00Z',
  updatedAt: '2026-11-15T12:00:01Z',
  ...over,
});

/** Signs in at /platform as the Platform Administrator, with the list of tenants answering `tenants` (every page and filter). */
async function openPlatform(page: Page, tenants: object[] = [tenantOf()]): Promise<void> {
  await stubJson(page, 'POST', sessionsRoute(), 200, { accessToken: tokenOf(['PLATFORM_ADMINISTRATOR'], 'e2e-admin'), tokenType: 'Bearer', expiresIn: 900 });
  await page.route(LIST, (route) => route.fulfill({ json: { data: tenants, meta: { page: 1, limit: 20, total: tenants.length, totalPages: 1 } } }));
  await openSignIn(page, null);
  await signIn(page);
  await expect(area(page)).toContainText('Operadores bajo control');
}

async function fillOperator(page: Page, { email = 'ana@example.test' }: { email?: string } = {}): Promise<void> {
  await page.getByLabel('Nombre comercial').fill('Nueva Ruta');
  await page.getByLabel('Identificador único').fill('nueva-ruta');
  await page.getByLabel('Estado inicial').selectOption('ACTIVE');
  await page.getByLabel('Nombre completo').fill('Ana Prueba');
  await page.getByLabel('Correo electrónico').fill(email);
  await page.getByLabel('Contraseña inicial').fill('Clave-de-prueba-1');
  await page.getByLabel('Confirmar contraseña').fill('Clave-de-prueba-1');
}

async function openDetail(page: Page, tenant: object): Promise<void> {
  await stubJson(page, 'GET', '**/api/v1/identity-audit/tenants/tenant-acme', 200, tenant);
  await page.getByRole('navigation', { name: 'Navegación de plataforma' }).getByRole('button', { name: 'Operadores' }).click();
  const read = page.waitForResponse((r) => r.url().endsWith('/tenants/tenant-acme'));
  await area(page).getByRole('button', { name: 'Ver detalle' }).click();
  await read;
}

test('AC1 · the Platform Administrator registers the tenant with its first Administrator and is told the password is a 72-hour temporary one', async ({ page }) => {
  await stubJson(page, 'POST', SAGA, 201, sagaOf('RUNNING', { completedSteps: ['CREATE_TENANT'] }));
  await stubJson(page, 'GET', `${SAGA}/*`, 200, sagaOf('COMPLETED', { completedSteps: ['CREATE_TENANT', 'CREATE_ACCOUNT', 'APPLY_STATUS'], tenantId: 'tenant-nueva' }));
  await openPlatform(page);
  await area(page).getByRole('button', { name: 'Crear operador' }).first().click();
  await expect(area(page)).toContainText('Primer Administrador');
  await fillOperator(page);
  const started = page.waitForRequest((r) => r.url().endsWith('/sagas/onboard-tenant') && r.method() === 'POST');
  await page.getByRole('button', { name: 'Crear operador y asignar Administrador' }).click();
  const request = await started;
  expect(request.postDataJSON()).toEqual({
    identifier: 'nueva-ruta',
    commercialName: 'Nueva Ruta',
    timeZone: 'America/Bogota',
    country: 'CO',
    initialStatus: 'ACTIVE',
    administrator: { fullName: 'Ana Prueba', email: 'ana@example.test', password: 'Clave-de-prueba-1' },
  });
  expect(request.headers()['idempotency-key']).toMatch(/^.{8,128}$/);
  // The saga is followed until it completes.
  await expect(area(page)).toContainText('El operador fue registrado.', { timeout: 10_000 });
  await expect(area(page)).toContainText('La contraseña del administrador es una credencial temporal válida por 72 horas; debe reemplazarla en su primer acceso.');
  await page.screenshot({ path: `${SHOTS}/ac1-registrado.png`, fullPage: true });
});

test('AC1 · a password and its confirmation that differ are marked beside the field and nothing is sent', async ({ page }) => {
  const sent: string[] = [];
  await page.route(SAGA, (route) => (sent.push(route.request().method()), route.fulfill({ status: 500, json: {} })));
  await openPlatform(page);
  await area(page).getByRole('button', { name: 'Crear operador' }).first().click();
  await fillOperator(page);
  await page.getByLabel('Confirmar contraseña').fill('Otra-clave-2');
  await page.getByRole('button', { name: 'Crear operador y asignar Administrador' }).click();
  await expect(area(page).locator('#create-admin-password-confirm-error')).toHaveText('Las contraseñas no coinciden.');
  expect(sent).toEqual([]);
});

test('AC3 · when the first Administrator is not created the screen names that step, and fixing the e-mail retries with a new key', async ({ page }) => {
  const keys: string[] = [];
  await page.route(SAGA, (route) => {
    keys.push(route.request().headers()['idempotency-key']);
    const failed = sagaOf('COMPENSATED', { completedSteps: ['CREATE_TENANT'], failedStep: 'CREATE_ACCOUNT' });
    return route.fulfill({ status: 201, json: keys.length === 1 ? failed : sagaOf('COMPLETED', { completedSteps: ['CREATE_TENANT', 'CREATE_ACCOUNT', 'APPLY_STATUS'] }) });
  });
  await openPlatform(page);
  await area(page).getByRole('button', { name: 'Crear operador' }).first().click();
  await fillOperator(page, { email: 'ana@example' });
  const first = page.waitForResponse((r) => r.url().endsWith('/sagas/onboard-tenant'));
  await page.getByRole('button', { name: 'Crear operador y asignar Administrador' }).click();
  await first;
  await expect(area(page)).toContainText('El alta no se completó. No se pudo crear la cuenta del primer administrador.');
  await expect(area(page)).not.toContainText('El operador fue registrado.');
  await page.screenshot({ path: `${SHOTS}/ac3-fallo-cuenta.png`, fullPage: true });
  // The person can retry: the form stays, the password is typed again and the corrected data is a new attempt.
  await page.getByLabel('Correo electrónico').fill('ana@example.test');
  await page.getByLabel('Contraseña inicial').fill('Clave-de-prueba-1');
  await page.getByLabel('Confirmar contraseña').fill('Clave-de-prueba-1');
  const second = page.waitForResponse((r) => r.url().endsWith('/sagas/onboard-tenant'));
  await page.getByRole('button', { name: 'Crear operador y asignar Administrador' }).click();
  await second;
  await expect(area(page)).toContainText('El operador fue registrado.');
  expect(keys).toHaveLength(2);
  expect(keys[1]).not.toBe(keys[0]);
});

test('AC4 · inactivating an active tenant asks for a reason and a confirmation that lists what it does, and then shows it inactive', async ({ page }) => {
  await openPlatform(page);
  await openDetail(page, tenantOf());
  await expect(area(page)).toContainText('Operador activo');
  await page.getByRole('button', { name: 'Inactivar operador' }).click();
  await expect(area(page)).toContainText('Ingresa el motivo de la inactivación.');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByLabel('Motivo de la inactivación').fill('Contrato terminado');
  await page.getByRole('button', { name: 'Inactivar operador' }).click();
  const dialog = page.getByRole('dialog', { name: '¿Inactivar a Acme Tours?' });
  await expect(dialog).toContainText('Se revocan de inmediato los accesos de operación normal de sus usuarios; sus sesiones se cierran.');
  await expect(dialog).toContainText('No se aceptan nuevas autenticaciones ni reservas; el historial y la auditoría se conservan.');
  await expect(dialog).toContainText('El Administrador del tenant conserva un acceso restringido para atender obligaciones pendientes.');
  await page.screenshot({ path: `${SHOTS}/ac4-confirmar.png`, fullPage: true });
  await page.route('**/api/v1/identity-audit/tenants/tenant-acme/inactivate', (route) =>
    route.fulfill({ json: tenantOf({ tenantStatus: 'INACTIVE', statusReason: 'Contrato terminado', statusChangedBy: 'e2e-admin', statusChangedAt: '2026-11-15T12:00:00Z' }) }),
  );
  const sent = page.waitForRequest((r) => r.url().endsWith('/tenants/tenant-acme/inactivate'));
  await dialog.getByRole('button', { name: 'Confirmar inactivación' }).click();
  expect((await sent).postDataJSON()).toEqual({ reason: 'Contrato terminado' });
  await expect(area(page)).toContainText('Operador inactivo');
  await expect(area(page)).toContainText('Motivo registrado: Contrato terminado');
  await page.screenshot({ path: `${SHOTS}/ac4-inactivo.png`, fullPage: true });
});

test('AC5 · reactivating an inactive tenant is explicit, with a reason, and shows who and when changed it', async ({ page }) => {
  await openPlatform(page, [tenantOf({ tenantStatus: 'INACTIVE' })]);
  await openDetail(page, tenantOf({ tenantStatus: 'INACTIVE', statusReason: 'Contrato terminado' }));
  await expect(area(page)).toContainText('Operador inactivo');
  await page.getByLabel('Motivo de la reactivación').fill('Contrato renovado');
  await page.getByRole('button', { name: 'Reactivar operador' }).click();
  const dialog = page.getByRole('dialog', { name: '¿Reactivar a Acme Tours?' });
  await expect(dialog).toContainText('Cada plazo operativo continúa con el tiempo restante que tenía al inactivarse el tenant.');
  await page.route('**/api/v1/identity-audit/tenants/tenant-acme/reactivate', (route) =>
    route.fulfill({ json: tenantOf({ statusReason: 'Contrato renovado', statusChangedBy: 'e2e-admin', statusChangedAt: '2026-11-15T12:00:00Z' }) }),
  );
  const sent = page.waitForRequest((r) => r.url().endsWith('/tenants/tenant-acme/reactivate'));
  await dialog.getByRole('button', { name: 'Confirmar reactivación' }).click();
  expect((await sent).postDataJSON()).toEqual({ reason: 'Contrato renovado' });
  await expect(area(page)).toContainText('Operador activo');
  await expect(area(page)).toContainText('Motivo registrado: Contrato renovado');
  await expect(area(page)).toContainText('Responsable: e2e-admin ·');
  await page.screenshot({ path: `${SHOTS}/ac5-reactivado.png`, fullPage: true });
});

test('AC6 · an inactive tenant offers only the explicit reactivation, and a change the service refuses leaves it inactive', async ({ page }) => {
  await openPlatform(page, [tenantOf({ tenantStatus: 'INACTIVE' })]);
  await openDetail(page, tenantOf({ tenantStatus: 'INACTIVE' }));
  await expect(page.getByRole('button', { name: 'Inactivar operador' })).toHaveCount(0);
  await stubJson(page, 'POST', '**/api/v1/identity-audit/tenants/tenant-acme/reactivate', 422, { error: 'INVALID_STATUS_TRANSITION', message: 'already active', traceId: 't-ida-001' });
  await page.getByLabel('Motivo de la reactivación').fill('Soporte');
  await page.getByRole('button', { name: 'Reactivar operador' }).click();
  const refused = page.waitForResponse((r) => r.url().endsWith('/reactivate'));
  await page.getByRole('button', { name: 'Confirmar reactivación' }).click();
  await refused;
  await expect(area(page).getByRole('alert')).toContainText('El estado del operador ya cambió.');
  await expect(area(page)).toContainText('Operador inactivo');
  await expect(area(page)).not.toContainText('already active');
});

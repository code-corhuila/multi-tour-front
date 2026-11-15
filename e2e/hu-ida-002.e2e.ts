import { expect, Page, test } from '@playwright/test';
import { tokenOf } from './support/operator-session';
import { openSignIn, sessionsRoute, signIn, stubJson } from './support/lead-portals';

// HU-IDA-002 (record and consult the audit of sensitive actions), code-corhuila/multi-tour-docs#163; spec 006 of multi-tour-front
// (HU-FRT-001, #202). The real module of identity-audit-portal at the audit of the platform (/platform), the identity-audit
// routes answered by page.route. One criterion per test (or per group of criteria one screen shows).
// Not covered here: that every service really sends its audited actions and that the record keeps them (AC1, AC2 on the services:
// the events of commercial-reservation and cash-reporting, still open in the issue); that the service gives each reader only what it
// may read and refuses the rest with 403 (AC3, AC4, AC5 on the server), and AC8 (the audit across tenants refused with 403 to a user
// of a tenant), is identity-audit-api (MongoAuditListRouteTest:
// C_only_the_platform_administrator_reads_the_audit_across_tenants, C_a_tenant_audit_is_read_by_its_administrator_and_by_an_enabled_role_only);
// that the change of an access is recorded with who, when and for whom (AC6 on the server) is MongoAuditAccessRouteTest; a repeated
// event keeping one record (AC7) is MongoAuditEventRouteTest (C_a_repeated_event_is_200_and_keeps_one_record).
// Not met by the module in the composed platform: AC4 (the Tenant Administrator reads the audit of its own tenant), and AC5 (a role
// without the access is told so) and AC6 (the Administrator switches the access of a role), both of the optional roles (Gerente,
// Contador, Analista). The module draws those screens behind "Auditoría" and "Colaboradores" of its own sidebar, but the container
// hides that sidebar (identity-chrome-adapter.ts) and its own entries "Auditoría" and "Colaboradores" open the blank screen
// areas/pendiente (operator-nav.ts, `fixed: true`), because the portal does not read the area it is opened at: no person can reach them.
const SHOTS = 'test-results/hu-ida-002';
const ALL = /\/api\/v1\/identity-audit\/audit-records\?/;
const area = (page: Page) => page.locator('app-remote-host');
const pageOf = (data: object[]) => ({ data, meta: { page: 1, limit: 20, total: data.length, totalPages: 1 } });

const recordOf = (over: object = {}) => ({
  auditRecordId: 'a-1',
  tenantId: 'tenant-acme',
  actorId: 'e2e-admin',
  action: 'TENANT_INACTIVATED',
  affectedRecordId: 'tenant-acme',
  reason: 'Contrato terminado',
  previousValue: { tenantStatus: 'ACTIVE' },
  newValue: { tenantStatus: 'INACTIVE' },
  channelOrModule: 'identity-audit-portal',
  functionalProcessReference: 'tenant-lifecycle-77',
  recordedAt: '2026-11-15T12:30:00Z',
  ...over,
});
const tenants = [
  { tenantId: 'tenant-acme', identifier: 'acme', commercialName: 'Acme Tours', tenantStatus: 'ACTIVE', timeZone: 'America/Bogota', country: 'CO', createdAt: '2026-10-01T12:00:00Z' },
  { tenantId: 'tenant-andes', identifier: 'andes', commercialName: 'Andes Viajes', tenantStatus: 'ACTIVE', timeZone: 'America/Bogota', country: 'CO', createdAt: '2026-10-02T12:00:00Z' },
];

/** Signs in at /platform as the Platform Administrator and opens "Auditoría", whose records are `records`. */
async function openPlatformAudit(page: Page, records: object[]): Promise<void> {
  await stubJson(page, 'POST', sessionsRoute(), 200, { accessToken: tokenOf(['PLATFORM_ADMINISTRATOR'], 'e2e-admin'), tokenType: 'Bearer', expiresIn: 900 });
  await page.route(/\/api\/v1\/identity-audit\/tenants\?/, (route) => route.fulfill({ json: pageOf(tenants) }));
  await page.route(ALL, (route) => route.fulfill({ json: pageOf(records) }));
  await openSignIn(page, null);
  await signIn(page);
  await expect(area(page)).toContainText('Operadores bajo control');
  const read = page.waitForResponse((r) => ALL.test(r.url()));
  await page.getByRole('navigation', { name: 'Navegación de plataforma' }).getByRole('button', { name: 'Auditoría' }).click();
  await read;
  await expect(area(page)).toContainText('Auditoría de plataforma');
}

test('AC1 and AC2 · a record shows user, tenant, date, action and reason, and its detail the record, both values, the channel and the reference', async ({ page }) => {
  await openPlatformAudit(page, [recordOf()]);
  const row = area(page).locator('tbody tr').first();
  for (const text of ['2026-11-15 12:30 UTC', 'Operador inactivado', 'Acme Tours', 'Activo → Inactivo', 'e2e-admin', 'Contrato terminado']) {
    await expect(row).toContainText(text);
  }
  await row.getByRole('button', { name: 'Detalle' }).click();
  const detail = page.getByRole('dialog', { name: 'Detalle de auditoría' });
  await expect(detail).toBeVisible();
  for (const [label, value] of [
    ['Registro afectado', 'tenant-acme'],
    ['Valor anterior', '"tenantStatus": "ACTIVE"'],
    ['Valor nuevo', '"tenantStatus": "INACTIVE"'],
    ['Canal o módulo', 'identity-audit-portal'],
    ['Referencia funcional', 'tenant-lifecycle-77'],
  ]) {
    await expect(detail.locator('div').filter({ has: page.locator('dt', { hasText: label }) }).locator('dd')).toContainText(value);
  }
  await page.screenshot({ path: `${SHOTS}/ac1-ac2-detalle.png`, fullPage: true });
});

test('AC3 · the Platform Administrator sees the records of every tenant, and of the platform, in one list', async ({ page }) => {
  await openPlatformAudit(page, [
    recordOf(),
    recordOf({ auditRecordId: 'a-2', tenantId: 'tenant-andes', action: 'AUDIT_ACCESS_ENABLED', actorId: 'admin-andes', reason: null, previousValue: null, newValue: null }),
    recordOf({ auditRecordId: 'a-3', tenantId: null, action: 'ACCOUNT_BLOCKED', actorId: 'security', reason: null, previousValue: null, newValue: null }),
  ]);
  // The names of the operators come from their own read: wait for them before reading the column.
  await expect(area(page).locator('tbody')).toContainText('Andes Viajes');
  const operators = await area(page).locator('tbody tr').evaluateAll((rows) => rows.map((r) => r.querySelectorAll('td')[2]?.textContent));
  expect(operators).toEqual(['Acme Tours', 'Andes Viajes', 'Plataforma']);
  await page.screenshot({ path: `${SHOTS}/ac3-transversal.png`, fullPage: true });
});

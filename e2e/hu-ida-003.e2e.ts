import { expect, Page, test } from '@playwright/test';
import { ACME, serveTenantProfile } from './support/container';
import { IDENTITY, requireModule, sessionOf, sessionsRoute, signIn, stubJson } from './support/lead-portals';

// HU-IDA-003 (maintain the tenant's visual identity), code-corhuila/multi-tour-docs#165; spec 006 of multi-tour-front (HU-FRT-001, #202).
// The real module of identity-audit-portal at "Identidad visual" of its Tenant Administrator, the identity-audit route answered by
// page.route. One criterion per test.
// Not covered here: the container painting the colors of the public profile on the landing and keeping the platform look without them
// (AC1 and AC4 at the container) is e2e/visual-identity.e2e.ts, with a stub portal; that the service stores the colors only for the
// tenant of the token and refuses another tenant or an undeclared field (AC2, AC3) is identity-audit-api
// (VisualIdentityRouteTest: C_visual_identity_changes_only_the_tokens_tenant, C_visual_identity_with_a_tenant_id_in_the_body_is_400,
// C_visual_identity_with_an_undeclared_field_is_400).
const SHOTS = 'test-results/hu-ida-003';
const ROUTE = '**/api/v1/identity-audit/tenant/visual-identity';
const area = (page: Page) => page.locator('app-remote-host');
const accent = (page: Page, name: string) =>
  page.locator('app-tenant-shell').evaluate((el, n) => getComputedStyle(el).getPropertyValue(n).trim(), name);

/**
 * openAreaAs of lead-portals, with the public profile the container reads at sign-in given here: the route of the profile has to be
 * set after serveTenantProfile and before the page loads.
 */
async function openVisualIdentity(page: Page, profile: object = {}): Promise<void> {
  await requireModule(page, IDENTITY);
  await serveTenantProfile(page);
  await page.route('**/api/v1/identity-audit/public/tenants/acme', (route) => route.fulfill({ json: { ...ACME, ...profile } }));
  await stubJson(page, 'POST', sessionsRoute('acme'), 200, sessionOf(['TENANT_ADMINISTRATOR'], { tenantId: 'tenant-acme' }));
  await page.goto(`/t/acme/ingresar?returnUrl=${encodeURIComponent(`/t/acme/areas/${IDENTITY}`)}`);
  await signIn(page, { team: 'Administrador' });
  await expect(area(page)).toContainText('Control de la operación');
  await area(page).getByRole('button', { name: /^Identidad visual/ }).click();
  await expect(area(page).getByRole('heading', { name: 'Identidad visual' })).toBeVisible();
}

test('AC1 · the two colors saved by the Administrator are sent and the page of the tenant takes them at once, without a reload', async ({ page }) => {
  await stubJson(page, 'PUT', ROUTE, 200, { ...ACME, tenantId: 'tenant-acme', visualIdentity: { primaryColor: '#C0392B', secondaryColor: '#7B241C' } });
  await openVisualIdentity(page);
  await page.evaluate(() => ((window as unknown as { marker: string }).marker = 'same-page'));
  await page.getByLabel('Color principal', { exact: true }).fill('#c0392b');
  await page.getByLabel('Color secundario', { exact: true }).fill('#7b241c');
  const answered = page.waitForResponse((r) => r.url().endsWith('/tenant/visual-identity') && r.request().method() === 'PUT');
  await page.getByRole('button', { name: 'Guardar identidad visual' }).click();
  // AC2: the tenant is the one of the token: the body carries the two colors and nothing that names a tenant.
  expect((await answered).request().postDataJSON()).toEqual({ primaryColor: '#c0392b', secondaryColor: '#7b241c' });
  await expect(area(page)).toContainText('Identidad visual guardada. Tus clientes verán estos colores.');
  await expect.poll(() => accent(page, '--accent')).toBe('#C0392B');
  expect(await accent(page, '--accent-strong')).toBe('#7B241C');
  expect(await page.evaluate(() => (window as unknown as { marker: string }).marker)).toBe('same-page');
  await page.screenshot({ path: `${SHOTS}/ac1-guardada.png`, fullPage: true });
});

test('AC3 · only the two colors can be set: a value that is not #RRGGBB is marked beside its field and nothing is sent', async ({ page }) => {
  const sent: string[] = [];
  await page.route(ROUTE, (route) => (sent.push(route.request().method()), route.fulfill({ status: 500, json: {} })));
  await openVisualIdentity(page);
  // The screen offers the two colors (a text and a picker each) and no other parameter of the design.
  await expect(area(page).locator('input:not([type=file])')).toHaveCount(4);
  await page.getByLabel('Color principal', { exact: true }).fill('0B6E4F');
  await page.getByRole('button', { name: 'Guardar identidad visual' }).click();
  await expect(page.getByLabel('Color principal', { exact: true })).toHaveAttribute('aria-invalid', 'true');
  await expect(area(page).locator('#visual-primary-error')).toHaveText('Escribe el color como #RRGGBB.');
  await expect(page.getByLabel('Color secundario', { exact: true })).not.toHaveAttribute('aria-invalid', 'true');
  expect(sent).toEqual([]);
  await page.screenshot({ path: `${SHOTS}/ac3-color-invalido.png`, fullPage: true });
});

test('AC3 · a color the service refuses by field is shown beside that field, with the words of the screen', async ({ page }) => {
  await stubJson(page, 'PUT', ROUTE, 400, {
    error: 'VALIDATION_ERROR',
    message: 'the request is not valid',
    details: [{ field: 'secondaryColor', message: 'must be #RRGGBB' }],
    traceId: 't-ida-003',
  });
  await openVisualIdentity(page);
  const answered = page.waitForResponse((r) => r.url().endsWith('/tenant/visual-identity'));
  await page.getByRole('button', { name: 'Guardar identidad visual' }).click();
  await answered;
  await expect(area(page).locator('#visual-secondary-error')).toHaveText('Escribe el color como #RRGGBB.');
  await expect(area(page)).not.toContainText('must be #RRGGBB');
  await expect(area(page)).not.toContainText('Identidad visual guardada');
});

test('AC4 · a tenant that has not set one is told it uses the default identity of Multitour and starts from its colors', async ({ page }) => {
  await openVisualIdentity(page, { visualIdentity: null });
  await expect(area(page)).toContainText('Tu empresa usa la identidad por defecto de Multitour.');
  await expect(page.getByLabel('Color principal', { exact: true })).toHaveValue('#2f6b57');
  await expect(page.getByLabel('Color secundario', { exact: true })).toHaveValue('#1f4d3d');
  await page.screenshot({ path: `${SHOTS}/ac4-por-defecto.png`, fullPage: true });
});

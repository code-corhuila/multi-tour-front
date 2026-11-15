import { expect, Page, test } from '@playwright/test';
import { DORMANT } from './support/container';
import { tokenOf } from './support/operator-session';
import { IDENTITY, openSignIn, sessionOf, sessionsRoute, signIn, stubJson } from './support/lead-portals';

// HU-SEC-001 (sign in and receive a token), code-corhuila/multi-tour-docs#156; spec 006 of multi-tour-front (HU-FRT-001, #202).
// The real module of identity-audit-portal at its sign-in, the security routes answered by page.route. One criterion per test.
// Not covered here: the second half of AC4 (an internal user reaches only their own tenant), AC6 (what the token carries, its
// 15 minutes and that every service verifies it), each renewal used once (AC7) and the credential already issued stopping
// within 15 minutes (AC8), and the block being audited (AC9): they are decisions of the security service, covered end to end
// against PostgreSQL in multi-tour-security (cmd/security/wiring_test.go, refresh_wiring_test.go) as the issue lists.
const SHOTS = 'test-results/hu-sec-001';
const REFUSED = 'Correo o contraseña incorrectos';
const area = (page: Page) => page.locator('app-remote-host');
const refusal = (message: string) => ({ error: 'UNAUTHORIZED', message, traceId: 't-sec-001' });
// A link inside the page (no reload: the session lives in memory), so the guard of the container decides.
const followLink = (page: Page, path: string) =>
  page.evaluate((p) => {
    history.pushState({}, '', p);
    dispatchEvent(new PopStateEvent('popstate'));
  }, path);

test('AC1 · the right credentials of an operator at the link of the tenant land in the identity area of that tenant', async ({ page }) => {
  await stubJson(page, 'POST', sessionsRoute('acme'), 200, sessionOf(['TENANT_ADMINISTRATOR'], { tenantId: 'tenant-acme' }));
  await openSignIn(page);
  const sent = page.waitForRequest((r) => r.url().includes('/security/public/tenants/acme/sessions') && r.method() === 'POST');
  await signIn(page, { team: 'Administrador' });
  // The tenant comes only from the link: the body carries the credentials and the side, never a tenant.
  expect((await sent).postDataJSON()).toEqual({ email: 'persona@example.test', password: 'Clave-de-prueba-1', context: 'TEAM' });
  await expect(page).toHaveURL(new RegExp(`/t/acme/areas/${IDENTITY}$`));
  await expect(area(page)).toContainText('Control de la operación');
  await page.screenshot({ path: `${SHOTS}/ac1-operador.png`, fullPage: true });
});

test('AC1 · the right credentials of a final customer open the customer home of the tenant', async ({ page }) => {
  await stubJson(page, 'POST', sessionsRoute('acme'), 200, sessionOf(['FINAL_CUSTOMER'], { tenantId: 'tenant-acme' }));
  await openSignIn(page);
  await signIn(page);
  await expect(area(page)).toContainText('Portal cliente');
  await expect(page.getByLabel('Correo electrónico')).toHaveCount(0);
  await page.screenshot({ path: `${SHOTS}/ac1-cliente.png`, fullPage: true });
});

test('AC2, AC3, AC4, AC5 (expired) and AC9 · every refusal shows the same generic error, names no field and grants no access', async ({ page }) => {
  await openSignIn(page);
  const causes = ['wrong password', 'account only in another tenant', 'inactive account', 'expired temporary credential', 'blocked after five attempts'];
  for (const cause of causes) {
    await page.unroute(sessionsRoute('acme'));
    await stubJson(page, 'POST', sessionsRoute('acme'), 401, refusal(cause));
    await signIn(page);
    await expect(area(page).locator('.auth-feedback')).toHaveText(REFUSED);
    // The answer of the service never reaches the screen, and no field is marked as the wrong one.
    await expect(area(page)).not.toContainText(cause);
    await expect(page.locator('[aria-invalid="true"]')).toHaveCount(0);
    await expect(page).toHaveURL(/\/t\/acme\/ingresar$/);
  }
  await page.screenshot({ path: `${SHOTS}/ac2-rechazo.png`, fullPage: true });
});

test('AC5 · a temporary credential opens only the screen to choose a password; the areas stay closed', async ({ page }) => {
  await stubJson(page, 'POST', sessionsRoute('acme'), 200, sessionOf(['OPERATIONAL_COLLABORATOR'], { tenantId: 'tenant-acme', access: 'password-change' }));
  await stubJson(page, 'PUT', '**/api/v1/security/sessions/password', 204, null);
  await openSignIn(page);
  await signIn(page, { team: 'Colaborador' });
  await expect(area(page)).toContainText('Definir nueva contraseña');
  await followLink(page, `/t/acme/areas/${IDENTITY}`);
  await expect(page).toHaveURL(/\/t\/acme\/ingresar\?returnUrl=/);
  await expect(area(page)).toContainText('Definir nueva contraseña');
  await page.screenshot({ path: `${SHOTS}/ac5-primera-contrasena.png`, fullPage: true });
  await page.getByLabel('Nueva contraseña').fill('Nueva-Clave-9');
  await page.getByLabel('Confirmar contraseña').fill('Nueva-Clave-9');
  await page.getByRole('button', { name: 'Guardar contraseña' }).click();
  // Then the normal sign-in comes back, with the notice to use the new password.
  await expect(area(page)).toContainText('Contraseña guardada. Inicia sesión con ella.');
  await expect(page.getByLabel('Correo electrónico')).toBeVisible();
});

test('AC7 · an open session renews its credential by itself, without the password, sending the last renewal credential', async ({ page }) => {
  // expiresIn 61 s: the container renews 60 s before the end, never sooner than 5 s, so each renewal comes about 5 s later.
  await stubJson(page, 'POST', sessionsRoute('acme'), 200, sessionOf(['TENANT_ADMINISTRATOR'], { tenantId: 'tenant-acme' }, { expiresIn: 61, refreshToken: 'renewal-1' }));
  const sent: string[] = [];
  await page.route('**/api/v1/security/public/sessions/refresh', (route) => {
    sent.push(route.request().postDataJSON().refreshToken);
    return route.fulfill({ json: { ...sessionOf(['TENANT_ADMINISTRATOR'], { tenantId: 'tenant-acme' }), expiresIn: 61, refreshToken: `renewal-${sent.length + 1}` } });
  });
  await openSignIn(page);
  await signIn(page, { team: 'Administrador' });
  await expect(area(page)).toContainText('Control de la operación');
  await expect.poll(() => sent, { timeout: 15_000 }).toEqual(['renewal-1', 'renewal-2']);
  await expect(area(page)).toContainText('Control de la operación');
  await expect(page.getByLabel('Contraseña', { exact: true })).toHaveCount(0);
});

test('AC8 · a session whose renewal is refused is closed: the next area asks to sign in again', async ({ page }) => {
  await stubJson(page, 'POST', sessionsRoute('acme'), 200, sessionOf(['TENANT_ADMINISTRATOR'], { tenantId: 'tenant-acme' }, { expiresIn: 61, refreshToken: 'renewal-1' }));
  await stubJson(page, 'POST', '**/api/v1/security/public/sessions/refresh', 401, refusal('session revoked'));
  const refused = page.waitForResponse((r) => r.url().includes('/sessions/refresh'));
  await openSignIn(page);
  await signIn(page, { team: 'Administrador' });
  await expect(area(page)).toContainText('Control de la operación');
  await refused;
  await followLink(page, '/t/acme/areas/operations-cost-portal');
  await expect(page).toHaveURL(/\/t\/acme\/ingresar\?returnUrl=/);
  await expect(page.getByLabel('Correo electrónico')).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/ac8-revocada.png`, fullPage: true });
});

test('AC10 · the Platform Administrator signs in at /platform with e-mail and password and gets the platform, with no tenant', async ({ page }) => {
  await stubJson(page, 'POST', sessionsRoute(), 200, { accessToken: tokenOf(['PLATFORM_ADMINISTRATOR'], 'e2e-admin'), tokenType: 'Bearer', expiresIn: 900 });
  await openSignIn(page, null);
  await expect(area(page)).toContainText('Acceso de plataforma');
  await expect(page.getByRole('button', { name: 'Equipo del operador' })).toHaveCount(0);
  const sent = page.waitForRequest((r) => r.url().endsWith('/security/public/platform/sessions'));
  await signIn(page);
  expect((await sent).postDataJSON()).toEqual({ email: 'persona@example.test', password: 'Clave-de-prueba-1' });
  await expect(area(page)).toContainText('Operadores bajo control');
  await page.screenshot({ path: `${SHOTS}/ac10-plataforma.png`, fullPage: true });
});

test('AC11 · at an inactive tenant its Administrator gets the restricted access and any other user the generic refusal', async ({ page }) => {
  await openSignIn(page, DORMANT.identifier);
  await stubJson(page, 'POST', sessionsRoute(DORMANT.identifier), 401, refusal('tenant inactive'));
  await signIn(page, { team: 'Colaborador' });
  await expect(area(page).locator('.auth-feedback')).toHaveText(REFUSED);
  await page.unroute(sessionsRoute(DORMANT.identifier));
  await stubJson(page, 'POST', sessionsRoute(DORMANT.identifier), 200, sessionOf(['TENANT_ADMINISTRATOR'], { tenantId: 'tenant-dormant', access: 'restricted' }));
  await signIn(page, { team: 'Administrador' });
  await expect(area(page)).toContainText('La empresa está inactiva. Solo puedes atender las obligaciones pendientes.');
  await page.screenshot({ path: `${SHOTS}/ac11-restringido.png`, fullPage: true });
});

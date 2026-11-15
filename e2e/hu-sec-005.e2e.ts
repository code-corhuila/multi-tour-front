import { expect, Page, test } from '@playwright/test';
import { openSignIn, sessionOf, sessionsRoute, signIn, stubJson } from './support/lead-portals';

// HU-SEC-005 (manage the tenant's internal users), code-corhuila/multi-tour-docs#161; spec 006 of multi-tour-front (HU-FRT-001,
// #202). The real module of identity-audit-portal at the sign-in of a tenant link, the security routes answered by page.route.
// What a registered internal user meets at the first access; one criterion per test. The areas closed to a temporary credential
// are in e2e/hu-sec-001.e2e.ts (AC5); here the contract of the PUT is checked ({newPassword} only, and the Authorization header).
// Not met by the module: AC1 and AC2 from the screen of the Administrator, AC4, AC5 and AC6, and the Administrator side of AC7.
// On the platform the entry "Colaboradores" of the container opens its blank screen (areas/pendiente?area=colaboradores: the
// identity portal does not read the area yet), so no screen of the team is reached; and inside the module "Registrar
// colaborador" is visual only ("Esta vista es solo visual en esta versión: el colaborador no se registra.", it sends nothing),
// the list reads test data only in a development build, and no screen inactivates, reactivates or issues a new temporary
// credential. The tests are left out, not weakened.
// Not covered here: what the account is (the 72 hours, the role held, the refusals, the revoked sessions, the last Administrator,
// the authority to issue a credential and the user kept inactive, AC1 to AC8 server side): decisions of the security service,
// covered end to end against PostgreSQL in multi-tour-security (cmd/security/users_wiring_test.go, users_status_wiring_test.go,
// users_credential_wiring_test.go) as the issue lists. The inactive user refused at the sign-in is in e2e/hu-sec-001.e2e.ts (AC2).
const SHOTS = 'test-results/hu-sec-005';
const PASSWORD = '**/api/v1/security/sessions/password';
const area = (page: Page) => page.locator('app-remote-host');

/** Signs in at the operator tab with the temporary credential the Administrator gave: the token carries the password-change mark. */
async function signInWithTemporaryCredential(page: Page): Promise<void> {
  await stubJson(page, 'POST', sessionsRoute('acme'), 200, sessionOf(['OPERATIONAL_COLLABORATOR'], { tenantId: 'tenant-acme', access: 'password-change' }));
  await openSignIn(page);
  await signIn(page, { team: 'Colaborador' });
  await expect(area(page)).toContainText('Definir nueva contraseña');
}

async function choosePassword(page: Page): Promise<void> {
  await page.getByLabel('Nueva contraseña').fill('Nueva-Clave-9');
  await page.getByLabel('Confirmar contraseña').fill('Nueva-Clave-9');
}

test('AC1 (first access) · the temporary credential opens only the screen to replace it, which sends only the new password', async ({ page }) => {
  await stubJson(page, 'PUT', PASSWORD, 204, null);
  await signInWithTemporaryCredential(page);
  // The areas of the team are not offered: the screen holds only the new password, its confirmation and the policy.
  await expect(area(page)).not.toContainText('Control de la operación');
  await expect(area(page)).toContainText('Mínimo 8 caracteres');
  await page.screenshot({ path: `${SHOTS}/ac1-primer-acceso.png`, fullPage: true });
  await choosePassword(page);
  const sent = page.waitForRequest((r) => r.url().endsWith('/security/sessions/password') && r.method() === 'PUT');
  const answered = page.waitForResponse((r) => r.url().endsWith('/security/sessions/password'));
  await page.getByRole('button', { name: 'Guardar contraseña' }).click();
  // The confirmation is checked on the screen and never sent; the credential goes in the header the container attaches.
  const request = await sent;
  expect(request.postDataJSON()).toEqual({ newPassword: 'Nueva-Clave-9' });
  expect(request.headers()['authorization']).toMatch(/^Bearer /);
  await answered;
  await expect(area(page)).toContainText('Contraseña guardada. Inicia sesión con ella.');
  await expect(page.getByLabel('Correo electrónico')).toBeVisible();
});

test('AC7 (the person) · a temporary credential that expired before the first access sends the person to ask for a new one', async ({ page }) => {
  await stubJson(page, 'PUT', PASSWORD, 401, { error: 'UNAUTHORIZED', message: 'temporary credential expired', traceId: 't-sec-005' });
  await signInWithTemporaryCredential(page);
  await choosePassword(page);
  const answered = page.waitForResponse((r) => r.url().endsWith('/security/sessions/password'));
  await page.getByRole('button', { name: 'Guardar contraseña' }).click();
  await answered;
  await expect(area(page).getByRole('alert')).toHaveText('La credencial temporal ya no es válida. Pide una nueva a tu administrador.');
  // The form is not offered again: the expired credential cannot be fixed here.
  await expect(page.getByLabel('Nueva contraseña')).toHaveCount(0);
  await expect(area(page)).not.toContainText('temporary credential expired');
  await page.screenshot({ path: `${SHOTS}/ac7-credencial-vencida.png`, fullPage: true });
  await page.getByRole('button', { name: 'Volver al inicio de sesión' }).click();
  await expect(page.getByLabel('Correo electrónico')).toBeVisible();
});

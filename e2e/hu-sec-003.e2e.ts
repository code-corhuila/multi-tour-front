import { expect, Page, test } from '@playwright/test';
import { serveTenantProfile } from './support/container';
import { IDENTITY, openSignIn, requireModule, sessionsRoute, signIn, stubJson } from './support/lead-portals';

// HU-SEC-003 (verify the Final Customer's e-mail), code-corhuila/multi-tour-docs#160; spec 006 of multi-tour-front (HU-FRT-001,
// #202). The real module of identity-audit-portal at the sign-in, the sign-up notice and the page behind the link of the e-mail,
// the security routes answered by page.route. One criterion per test.
// Not covered here: that the security service sends the link and keeps the account pending (AC1, AC2 server side), the link to
// a customer registered by the staff (AC4) and the refusal of an unverified match (AC5), and the failed send being recorded with
// the account unchanged (AC6 server side): decisions of the security service and of commercial-reservation, covered in
// multi-tour-security (cmd/security/verification_wiring_test.go) and in the tests of commercial-reservation the issue lists.
const SHOTS = 'test-results/hu-sec-003';
const LINK = 'A'.repeat(21) + '_' + 'b'.repeat(21);
const CONFIRM = '**/api/v1/security/public/tenants/acme/email-verifications/confirmations';
const REQUEST = '**/api/v1/security/public/tenants/acme/email-verifications';
const area = (page: Page) => page.locator('app-remote-host');
const answerOf = (path: string) => (r: { url(): string; request(): { method(): string } }) => r.url().endsWith(path) && r.request().method() === 'POST';

/** Opens the page behind the link of the e-mail, as the person does from the mail: the link travels in the fragment. */
async function openLink(page: Page, token: string): Promise<void> {
  await requireModule(page, IDENTITY);
  await serveTenantProfile(page);
  await page.goto(`/t/acme/verificar-correo#token=${token}`);
}

test('AC1 · a pending account is refused at the sign-in, with no session and the way to ask for a new link', async ({ page }) => {
  await stubJson(page, 'POST', sessionsRoute('acme'), 403, {
    error: 'FORBIDDEN',
    message: 'pending account',
    details: [{ field: 'email', message: 'EMAIL_NOT_VERIFIED' }],
    traceId: 't-sec-003',
  });
  await openSignIn(page);
  const answered = page.waitForResponse(answerOf('/security/public/tenants/acme/sessions'));
  await signIn(page);
  await answered;
  await expect(area(page).locator('.auth-feedback')).toHaveText('Tu cuenta aún está inactiva: verifica tu correo con el enlace que te enviamos.');
  await expect(page.getByRole('button', { name: 'Pedir un nuevo enlace' })).toBeVisible();
  await expect(page).toHaveURL(/\/t\/acme\/ingresar$/);
  await page.screenshot({ path: `${SHOTS}/ac1-pendiente.png`, fullPage: true });
});

test('AC2 · the link of the e-mail and the password of the account activate it; the link leaves the address', async ({ page }) => {
  await stubJson(page, 'POST', CONFIRM, 204, null);
  await openLink(page, LINK);
  await expect(area(page)).toContainText('Para activar tu cuenta, confirma la contraseña con la que la creaste.');
  // The link is read once and taken out of the address and the history.
  await expect(page).toHaveURL(/\/t\/acme\/verificar-correo$/);
  await page.getByLabel('Contraseña', { exact: true }).fill('Clave-de-prueba-1');
  const sent = page.waitForRequest((r) => r.url().endsWith('/email-verifications/confirmations'));
  const answered = page.waitForResponse(answerOf('/email-verifications/confirmations'));
  await page.getByRole('button', { name: 'Verificar correo' }).click();
  expect((await sent).postDataJSON()).toEqual({ token: LINK, password: 'Clave-de-prueba-1' });
  await answered;
  await expect(area(page)).toContainText('Correo verificado');
  await expect(area(page)).toContainText('Tu correo quedó verificado y tu cuenta está activa.');
  await page.screenshot({ path: `${SHOTS}/ac2-verificado.png`, fullPage: true });
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page.getByLabel('Correo electrónico')).toBeVisible();
});

test('AC3 · a used or expired link does nothing and the person asks for a new one with the same answer for any e-mail', async ({ page }) => {
  await stubJson(page, 'POST', CONFIRM, 422, { error: 'BUSINESS_RULE_VIOLATION', message: 'link used', traceId: 't-sec-003' });
  await stubJson(page, 'POST', REQUEST, 202, null);
  await openLink(page, LINK);
  await page.getByLabel('Contraseña', { exact: true }).fill('Clave-de-prueba-1');
  const refused = page.waitForResponse(answerOf('/email-verifications/confirmations'));
  await page.getByRole('button', { name: 'Verificar correo' }).click();
  await refused;
  await expect(area(page)).toContainText('Este enlace ya no funciona');
  await expect(area(page)).toContainText('Pudo vencer o ya se usó. Pide uno nuevo para activar tu cuenta.');
  await expect(area(page)).not.toContainText('Correo verificado');
  await page.screenshot({ path: `${SHOTS}/ac3-enlace-usado.png`, fullPage: true });
  await page.getByRole('button', { name: 'Pedir un nuevo enlace' }).click();
  await page.getByLabel('Correo electrónico').fill('ana@example.test');
  const sent = page.waitForRequest((r) => r.url().endsWith('/email-verifications') && r.method() === 'POST');
  const answered = page.waitForResponse(answerOf('/email-verifications'));
  await page.getByRole('button', { name: 'Enviar enlace' }).click();
  expect((await sent).postDataJSON()).toEqual({ email: 'ana@example.test' });
  await answered;
  await expect(area(page).locator('.auth-feedback')).toHaveText(
    'Si tu cuenta está pendiente de verificación, te enviamos un nuevo enlace. Revisa tu correo, también la carpeta de spam.',
  );
  await page.screenshot({ path: `${SHOTS}/ac3-nuevo-enlace.png`, fullPage: true });
});

test('AC3 · a malformed link is not sent anywhere and shows at once that it no longer works', async ({ page }) => {
  let sent = 0;
  await page.route(CONFIRM, (route) => {
    sent += 1;
    return route.fulfill({ status: 204 });
  });
  await openLink(page, 'corto');
  await expect(area(page)).toContainText('Este enlace ya no funciona');
  await expect(page.getByLabel('Contraseña', { exact: true })).toHaveCount(0);
  expect(sent).toBe(0);
});

test('AC6 · after registering, the person asks for a new link from the notice and gets the same answer', async ({ page }) => {
  await stubJson(page, 'POST', '**/api/v1/security/public/tenants/acme/accounts', 201, {});
  await stubJson(page, 'POST', REQUEST, 202, null);
  await openSignIn(page);
  await page.getByRole('link', { name: 'Crear cuenta' }).click();
  await page.getByLabel('Nombre', { exact: true }).fill('Ana');
  await page.getByLabel('Apellido', { exact: true }).fill('Prueba');
  await page.getByLabel('Correo electrónico').fill('ana@example.test');
  await page.getByLabel('Número de teléfono').fill('3001112233');
  await page.getByLabel('Contraseña', { exact: true }).fill('Clave-de-prueba-1');
  await page.getByLabel('Confirmar contraseña').fill('Clave-de-prueba-1');
  await page.getByRole('button', { name: 'Registrarse' }).click();
  await expect(area(page)).toContainText('Verifica tu correo');
  const sent = page.waitForRequest((r) => r.url().endsWith('/email-verifications') && r.method() === 'POST');
  const answered = page.waitForResponse(answerOf('/email-verifications'));
  await page.getByRole('button', { name: 'Reenviar enlace' }).click();
  expect((await sent).postDataJSON()).toEqual({ email: 'ana@example.test' });
  await answered;
  await expect(area(page).locator('.auth-feedback')).toHaveText(
    'Si tu cuenta está pendiente de verificación, te enviamos un nuevo enlace. Revisa tu correo, también la carpeta de spam.',
  );
  await page.screenshot({ path: `${SHOTS}/ac6-reenviar.png`, fullPage: true });
});

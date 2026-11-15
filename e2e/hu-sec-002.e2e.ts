import { expect, Page, test } from '@playwright/test';
import { DORMANT } from './support/container';
import { openSignIn, stubJson } from './support/lead-portals';

// HU-SEC-002 (create a Final Customer account), code-corhuila/multi-tour-docs#159; spec 006 of multi-tour-front (HU-FRT-001, #202).
// The real module of identity-audit-portal at the sign-up of a tenant link, the security route answered by page.route. One
// criterion per test.
// Not covered here: AC5 (the same e-mail in another tenant is another account, with isolated histories and reservations) and
// what the account is once created (pending, its policy, its unique key): decisions of the security service, covered end to end
// against PostgreSQL in multi-tour-security (cmd/security/accounts_wiring_test.go, verification_wiring_test.go) as the issue lists.
const SHOTS = 'test-results/hu-sec-002';
const ROUTE = '**/api/v1/security/public/tenants/*/accounts';
const area = (page: Page) => page.locator('app-remote-host');
const refusal = (status: number, details?: { field: string; message: string }[]) => ({
  error: status === 400 ? 'VALIDATION_ERROR' : 'BUSINESS_RULE_VIOLATION',
  message: 'refused by the service',
  ...(details && { details }),
  traceId: 't-sec-002',
});
const isSignUp = (r: { url(): string; method(): string }) => r.url().includes('/accounts') && r.method() === 'POST';

async function openSignUp(page: Page, tenant = 'acme'): Promise<void> {
  await openSignIn(page, tenant);
  await page.getByRole('link', { name: 'Crear cuenta' }).click();
  await expect(area(page)).toContainText('Datos personales');
}

async function fillSignUp(page: Page, { password = 'Clave-de-prueba-1', confirmation = password } = {}): Promise<void> {
  await page.getByLabel('Nombre', { exact: true }).fill('Ana');
  await page.getByLabel('Apellido', { exact: true }).fill('Prueba');
  await page.getByLabel('Correo electrónico').fill('ana@example.test');
  await page.getByLabel('Número de teléfono').fill('3001112233');
  await page.getByLabel('Contraseña', { exact: true }).fill(password);
  await page.getByLabel('Confirmar contraseña').fill(confirmation);
}

/** Sends the form and waits for the answer of the service, then for the button to come back. */
async function sendAndWait(page: Page): Promise<void> {
  const answered = page.waitForResponse((r) => isSignUp(r.request()));
  await page.getByRole('button', { name: 'Registrarse' }).click();
  await answered;
  await expect(page.getByRole('button', { name: 'Registrarse' })).toBeEnabled();
}

test('AC1 · the complete form at the link of an active tenant creates the account there and says it waits for the e-mail', async ({ page }) => {
  await stubJson(page, 'POST', ROUTE, 201, { accountId: '7b0c6f1e-0000-4000-8000-000000000001' });
  await openSignUp(page);
  await fillSignUp(page);
  const sent = page.waitForRequest((r) => isSignUp(r));
  await page.getByRole('button', { name: 'Registrarse' }).click();
  const request = await sent;
  // The tenant comes only from the link; the body carries the six fields and nothing else, with a key for the repeat.
  expect(request.url()).toContain('/security/public/tenants/acme/accounts');
  expect(request.postDataJSON()).toEqual({
    firstName: 'Ana',
    lastName: 'Prueba',
    email: 'ana@example.test',
    phone: '3001112233',
    password: 'Clave-de-prueba-1',
    passwordConfirmation: 'Clave-de-prueba-1',
  });
  expect(request.headers()['idempotency-key']).toMatch(/^.{8,128}$/);
  await expect(area(page)).toContainText('Verifica tu correo');
  await expect(area(page)).toContainText('Creamos tu cuenta en Acme Tours y enviamos un enlace de verificación a ana@example.test');
  await expect(area(page)).toContainText('Tu cuenta permanece inactiva');
  await page.screenshot({ path: `${SHOTS}/ac1-cuenta-creada.png`, fullPage: true });
});

test('AC2 · a confirmation that differs creates nothing and the form says so beside the field', async ({ page }) => {
  let sent = 0;
  await page.route(ROUTE, (route) => {
    sent += 1;
    return route.fulfill({ status: 201, json: {} });
  });
  await openSignUp(page);
  await fillSignUp(page, { confirmation: 'Clave-distinta-2' });
  await page.getByRole('button', { name: 'Registrarse' }).click();
  await expect(page.getByLabel('Confirmar contraseña')).toHaveAttribute('aria-invalid', 'true');
  await expect(area(page).locator('#signup-password-confirm-error')).toHaveText('Las contraseñas no coinciden.');
  expect(sent).toBe(0);
  await expect(area(page)).not.toContainText('Verifica tu correo');
  await page.screenshot({ path: `${SHOTS}/ac2-no-coinciden.png`, fullPage: true });
});

test('AC3 · a password the policy refuses is rejected beside the field, with the rules of the policy on the form', async ({ page }) => {
  await stubJson(page, 'POST', ROUTE, 400, refusal(400, [{ field: 'password', message: 'common password' }]));
  await openSignUp(page);
  await expect(area(page)).toContainText('Mínimo 8 caracteres');
  await expect(area(page)).toContainText('Al menos un carácter especial');
  await fillSignUp(page, { password: 'Password1!' });
  await sendAndWait(page);
  await expect(page.getByLabel('Contraseña', { exact: true })).toHaveAttribute('aria-invalid', 'true');
  await expect(area(page).locator('#signup-password-error')).toHaveText('La contraseña no cumple los requisitos.');
  await expect(area(page)).not.toContainText('common password');
  await expect(area(page)).not.toContainText('Verifica tu correo');
  await page.screenshot({ path: `${SHOTS}/ac3-politica.png`, fullPage: true });
});

test('AC4 · an e-mail that already has an account in the tenant is refused saying it is in use there', async ({ page }) => {
  await stubJson(page, 'POST', ROUTE, 422, refusal(422, [{ field: 'email', message: 'already in use' }]));
  await openSignUp(page);
  await fillSignUp(page);
  await sendAndWait(page);
  await expect(page.getByLabel('Correo electrónico')).toHaveAttribute('aria-invalid', 'true');
  await expect(area(page).locator('#signup-email-error')).toHaveText('Este correo ya está en uso en esta empresa');
  await expect(area(page)).not.toContainText('Verifica tu correo');
  await page.screenshot({ path: `${SHOTS}/ac4-correo-en-uso.png`, fullPage: true });
});

test('AC6 · at the link of an inactive tenant the registration creates nothing and says it is not available there', async ({ page }) => {
  await stubJson(page, 'POST', ROUTE, 422, refusal(422));
  await openSignUp(page, DORMANT.identifier);
  await fillSignUp(page);
  const sent = page.waitForRequest((r) => isSignUp(r));
  await sendAndWait(page);
  expect((await sent).url()).toContain(`/security/public/tenants/${DORMANT.identifier}/accounts`);
  await expect(area(page).locator('.auth-feedback')).toHaveText('El registro no está disponible para esta empresa');
  await expect(page.locator('[aria-invalid="true"]')).toHaveCount(0);
  await expect(area(page)).not.toContainText('Verifica tu correo');
  await page.screenshot({ path: `${SHOTS}/ac6-tenant-inactivo.png`, fullPage: true });
});

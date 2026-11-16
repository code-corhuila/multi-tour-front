import { expect, Page, test } from '@playwright/test';
import { openSignIn, stubJson } from './support/lead-portals';

// HU-SEC-004 (recover the password), code-corhuila/multi-tour-docs#157; spec 006 of multi-tour-front (HU-FRT-001, #202).
// The real module of identity-audit-portal at the recovery of a tenant link and of the platform, the security routes answered by
// page.route. One criterion per test.
// Not covered here: that a code is sent only to an existing account, its 30 minutes, single use and replacement (AC1, AC2 server
// side), the count of five wrong tries and three codes per hour (AC4), the sessions cut by a reset and no other tenant touched
// (AC3 server side), and the audit and notice of an administrative account (AC5): decisions of the security service and of
// worker-notifications, covered in multi-tour-security end to end in cmd/security/recovery_wiring_test.go
// (TestC_ACustomerAsksForACodeResetsThePasswordAndEverySessionEnds, TestC_ThreeCodesAnHourAndNoMoreAndTheNewestIsTheOnlyOneThatWorks,
// TestC_TheFifthWrongTryRetiresTheCodeAndTheRightOneNoLongerWorks, TestC_AFailedResetOfAnAdministratorIsAFactAndTheSuccessfulOneToo),
// in the store tests of internal/adapter/postgres/recovery_codes_test.go (TestI_ANewCodeRetiresTheEarlierOnes,
// TestI_AnAccountReceivesThreeCodesAnHourAndTheFourthWritesNothing, TestI_AWrongTryCountsAndTheFifthRetiresTheCode,
// TestI_AResetWithAUsedRetiredOrExpiredCodeChangesNothing, TestI_AResetChangesThePasswordCutsTheSessionsLiftsTheBlockAndWritesTheFacts,
// TestI_TheCodeOfAnotherAccountResetsNothing, TestI_TheFactOfAFailedResetIsWrittenOnlyForAnAdministrativeAccount), and in
// worker-notifications PR 15.
const SHOTS = 'test-results/hu-sec-004';
const SENT = 'Si existe una cuenta con ese correo, enviamos un código. Revisa tu bandeja y escríbelo en la siguiente pantalla.';
const REFUSED = 'El código no es válido o venció. Pide uno nuevo.';
const recoveries = (tenant?: string) =>
  tenant === undefined ? '**/api/v1/security/public/platform/password-recoveries' : `**/api/v1/security/public/tenants/${tenant}/password-recoveries`;
const area = (page: Page) => page.locator('app-remote-host');
const isPost = (end: string) => (r: { url(): string; method(): string }) => r.url().endsWith(end) && r.method() === 'POST';

/** From the sign-in of the tenant (or of the platform, with null) to the screen that asks for a code. */
async function openRecovery(page: Page, tenant: string | null = 'acme'): Promise<void> {
  await openSignIn(page, tenant);
  await page.getByRole('button', { name: '¿Olvidaste tu contraseña?' }).click();
  await expect(area(page)).toContainText('Recuperar acceso');
}

/** Asks for a code for the e-mail and waits for the answer of the service. */
async function askCode(page: Page, email: string): Promise<void> {
  await page.getByLabel('Correo electrónico registrado').fill(email);
  const answered = page.waitForResponse((r) => isPost('/password-recoveries')(r.request()));
  await page.getByRole('button', { name: 'Enviar código' }).click();
  await answered;
  await expect(page.getByRole('button', { name: 'Enviar código' })).toBeEnabled();
}

/** From the screen that asks for a code to the screen that resets the password, with the code and the new password. */
async function fillReset(page: Page, { code = '12345678', password = 'Nueva-Clave-9', confirmation = password } = {}): Promise<void> {
  await page.getByRole('button', { name: 'Ya tengo el código' }).click();
  await expect(area(page)).toContainText('Escribe el código que recibiste');
  await page.getByLabel('Código', { exact: true }).fill(code);
  await page.getByLabel('Nueva contraseña').fill(password);
  await page.getByLabel('Confirmar contraseña').fill(confirmation);
}

async function sendReset(page: Page): Promise<void> {
  const answered = page.waitForResponse((r) => isPost('/password-recoveries/resets')(r.request()));
  await page.getByRole('button', { name: 'Guardar nueva contraseña' }).click();
  await answered;
  await expect(page.getByRole('button', { name: 'Guardar nueva contraseña' })).toBeEnabled();
}

test('AC1 · at the link of the tenant the answer is the same whether or not the e-mail has an account there', async ({ page }) => {
  // The service answers 202 with no body in both cases: the screen must not tell them apart.
  await stubJson(page, 'POST', recoveries('acme'), 202, null);
  await openRecovery(page);
  const bodies: unknown[] = [];
  page.on('request', (r) => {
    if (isPost('/tenants/acme/password-recoveries')(r)) bodies.push(r.postDataJSON());
  });
  await askCode(page, 'ana@example.test');
  await expect(area(page).locator('.auth-feedback')).toHaveText(SENT);
  const first = await area(page).innerText();
  await askCode(page, 'nadie@example.test');
  await expect(area(page).locator('.auth-feedback')).toHaveText(SENT);
  expect(await area(page).innerText()).toBe(first);
  // The tenant comes only from the link: the body carries the e-mail and nothing else.
  expect(bodies).toEqual([{ email: 'ana@example.test' }, { email: 'nadie@example.test' }]);
  await page.screenshot({ path: `${SHOTS}/ac1-solicitud.png`, fullPage: true });
});

test('AC1 · at /platform the request goes to the platform route, with no tenant', async ({ page }) => {
  await stubJson(page, 'POST', recoveries(), 202, null);
  await openRecovery(page, null);
  const sent = page.waitForRequest(isPost('/security/public/platform/password-recoveries'));
  await askCode(page, 'admin@example.test');
  expect((await sent).postDataJSON()).toEqual({ email: 'admin@example.test' });
  await expect(area(page).locator('.auth-feedback')).toHaveText(SENT);
});

test('AC2 and AC4 · a code that expired, was used, was replaced or was retired after five wrong tries is refused with one text', async ({ page }) => {
  await stubJson(page, 'POST', recoveries('acme'), 202, null);
  await openRecovery(page);
  await askCode(page, 'ana@example.test');
  await fillReset(page);
  const causes = ['code expired', 'code already used', 'code replaced by a newer one', 'code retired after five wrong tries'];
  for (const cause of causes) {
    await page.unroute(`${recoveries('acme')}/resets`);
    await stubJson(page, 'POST', `${recoveries('acme')}/resets`, 422, { error: 'BUSINESS_RULE_VIOLATION', message: cause, traceId: 't-sec-004' });
    await page.getByLabel('Nueva contraseña').fill('Nueva-Clave-9');
    await page.getByLabel('Confirmar contraseña').fill('Nueva-Clave-9');
    await sendReset(page);
    await expect(area(page).locator('.auth-feedback')).toHaveText(REFUSED);
    await expect(area(page)).not.toContainText(cause);
  }
  await page.screenshot({ path: `${SHOTS}/ac2-codigo-rechazado.png`, fullPage: true });
  // The way out is a new code.
  await page.getByRole('button', { name: 'Pedir un código nuevo' }).click();
  await expect(area(page)).toContainText('Recuperar acceso');
});

test('AC2 · a code that does not have eight digits is not sent', async ({ page }) => {
  let sent = 0;
  await stubJson(page, 'POST', recoveries('acme'), 202, null);
  await page.route(`${recoveries('acme')}/resets`, (route) => {
    sent += 1;
    return route.fulfill({ status: 204 });
  });
  await openRecovery(page);
  await askCode(page, 'ana@example.test');
  await fillReset(page, { code: '1234' });
  await page.getByRole('button', { name: 'Guardar nueva contraseña' }).click();
  await expect(area(page).locator('#reset-code-error')).toHaveText('El código tiene 8 dígitos.');
  expect(sent).toBe(0);
});

test('AC3 · a valid code with a new password and its confirmation replaces it and says every session was closed', async ({ page }) => {
  await stubJson(page, 'POST', recoveries('acme'), 202, null);
  await stubJson(page, 'POST', `${recoveries('acme')}/resets`, 204, null);
  await openRecovery(page);
  await askCode(page, 'ana@example.test');
  await fillReset(page);
  // The e-mail of the request starts the form; the body carries the four fields and no tenant.
  await expect(page.getByLabel('Correo electrónico registrado')).toHaveValue('ana@example.test');
  const sent = page.waitForRequest(isPost('/tenants/acme/password-recoveries/resets'));
  const answered = page.waitForResponse((r) => isPost('/password-recoveries/resets')(r.request()));
  await page.getByRole('button', { name: 'Guardar nueva contraseña' }).click();
  expect((await sent).postDataJSON()).toEqual({ email: 'ana@example.test', code: '12345678', newPassword: 'Nueva-Clave-9', newPasswordConfirmation: 'Nueva-Clave-9' });
  await answered;
  await expect(area(page).getByRole('status')).toHaveText('Tu contraseña cambió y se cerraron todas tus sesiones. Inicia sesión con la nueva contraseña.');
  await page.screenshot({ path: `${SHOTS}/ac3-restablecida.png`, fullPage: true });
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page.getByLabel('Correo electrónico')).toBeVisible();
});

test('AC6 · a new password the policy refuses, or a confirmation that differs, does not change it and says so beside the field', async ({ page }) => {
  let sent = 0;
  await stubJson(page, 'POST', recoveries('acme'), 202, null);
  await page.route(`${recoveries('acme')}/resets`, (route) => {
    sent += 1;
    return route.fulfill({ status: 400, json: { error: 'VALIDATION_ERROR', message: 'weak', details: [{ field: 'newPassword', message: 'weak' }], traceId: 't-sec-004' } });
  });
  await openRecovery(page);
  await askCode(page, 'ana@example.test');
  await fillReset(page, { confirmation: 'Otra-Clave-8' });
  await page.getByRole('button', { name: 'Guardar nueva contraseña' }).click();
  await expect(area(page).locator('#reset-password-confirm-error')).toHaveText('Las contraseñas no coinciden.');
  expect(sent).toBe(0);
  await page.getByLabel('Nueva contraseña').fill('debil');
  await page.getByLabel('Confirmar contraseña').fill('debil');
  await sendReset(page);
  expect(sent).toBe(1);
  await expect(area(page).locator('#reset-password-error')).toHaveText('La contraseña no cumple los requisitos.');
  await expect(area(page)).not.toContainText('Tu contraseña cambió');
  await page.screenshot({ path: `${SHOTS}/ac6-politica.png`, fullPage: true });
});

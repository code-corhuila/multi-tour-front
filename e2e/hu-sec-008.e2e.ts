import { expect, Page, test } from '@playwright/test';
import { openSignIn, sessionOf, sessionsRoute, signIn } from './support/lead-portals';

// HU-SEC-008 (give the internal role to a Final Customer account), code-corhuila/multi-tour-docs#687; spec 006 of multi-tour-front
// (HU-FRT-001, #202). The real module of identity-audit-portal at the sign-in of a tenant link, the security route answered by
// page.route: one account that holds the customer role and an internal role. One criterion per test.
// Not met by the module: AC1 from the screen of the Administrator and the inactivation of AC3. On the platform the entry
// "Colaboradores" of the container opens its blank screen (areas/pendiente?area=colaboradores), and inside the module "Registrar
// colaborador" is visual only (it sends nothing) and no screen inactivates a user. The tests are left out, not weakened.
// Not covered here: the role added to the same account with no new password (AC1 server side), the roles the credential carries
// for each context (AC2 server side), the team side cut while the customer side stays (AC3 server side) and the customer record
// untouched (AC4): decisions of the security service and of commercial-reservation, covered in multi-tour-security and in the
// tests of commercial-reservation the issue lists.
const SHOTS = 'test-results/hu-sec-008';
const area = (page: Page) => page.locator('app-remote-host');
const isSignIn = (r: { url(): string; method(): string }) => r.url().endsWith('/security/public/tenants/acme/sessions') && r.method() === 'POST';

/** The service answers each side with the roles of that side only, as it does for an account that holds both. */
async function stubBothSides(page: Page, team: number = 200): Promise<void> {
  await page.route(sessionsRoute('acme'), (route) => {
    const side = route.request().postDataJSON().context;
    if (side === 'CUSTOMER') return route.fulfill({ json: sessionOf(['FINAL_CUSTOMER'], { tenantId: 'tenant-acme' }) });
    if (team !== 200) return route.fulfill({ status: team, json: { error: 'UNAUTHORIZED', message: 'internal user inactive', traceId: 't-sec-008' } });
    return route.fulfill({ json: sessionOf(['OPERATIONAL_COLLABORATOR'], { tenantId: 'tenant-acme' }) });
  });
}

test('AC2 · from the customer tab the person says they work as customer and gets only the customer home', async ({ page }) => {
  await stubBothSides(page);
  await openSignIn(page);
  const sent = page.waitForRequest(isSignIn);
  await signIn(page);
  expect((await sent).postDataJSON()).toEqual({ email: 'persona@example.test', password: 'Clave-de-prueba-1', context: 'CUSTOMER' });
  await expect(area(page)).toContainText('Portal cliente');
  await expect(area(page)).not.toContainText('Control de la operación');
  await page.screenshot({ path: `${SHOTS}/ac2-cliente.png`, fullPage: true });
});

test('AC2 · from the team tab the same account says it works as team member and gets only the team home', async ({ page }) => {
  await stubBothSides(page);
  await openSignIn(page);
  const sent = page.waitForRequest(isSignIn);
  await signIn(page, { team: 'Colaborador' });
  expect((await sent).postDataJSON()).toEqual({ email: 'persona@example.test', password: 'Clave-de-prueba-1', context: 'TEAM' });
  await expect(area(page)).toContainText('Control de la operación');
  await expect(area(page)).not.toContainText('Portal cliente');
  await page.screenshot({ path: `${SHOTS}/ac2-equipo.png`, fullPage: true });
});

test('AC3 (sign-in) · with the internal user inactivated the team side is refused and the customer side still opens', async ({ page }) => {
  await stubBothSides(page, 401);
  await openSignIn(page);
  const refused = page.waitForResponse((r) => isSignIn(r.request()));
  await signIn(page, { team: 'Colaborador' });
  await refused;
  await expect(page.getByRole('button', { name: /^Iniciar sesión/ })).toBeEnabled();
  await expect(area(page).locator('.auth-feedback')).toHaveText('Correo o contraseña incorrectos');
  await expect(page).toHaveURL(/\/t\/acme\/ingresar$/);
  await page.getByRole('button', { name: 'Cliente', exact: true }).click();
  const opened = page.waitForResponse((r) => isSignIn(r.request()));
  await signIn(page);
  await opened;
  await expect(area(page)).toContainText('Portal cliente');
  await page.screenshot({ path: `${SHOTS}/ac3-lado-cliente.png`, fullPage: true });
});

import { expect, Page, test } from '@playwright/test';
import { ACME, serveTenantProfile } from './support/container';
import { TINY_PNG } from './support/operator-session';
import { IDENTITY, requireModule, sessionOf, sessionsRoute, signIn, stubJson } from './support/lead-portals';

// HU-IDA-005 (maintain the tenant's logo and commercial images), code-corhuila/multi-tour-docs#683; spec 006 of multi-tour-front
// (HU-FRT-001, #202). The real module of identity-audit-portal at "Logo e imágenes" of its Tenant Administrator and the band of the
// container, the identity-audit routes answered by page.route. One criterion per test.
// Not covered here: that the service stores the files only for the tenant of the token, proves the kind by the bytes and keeps the
// previous file on a refusal (AC3, AC4 on the server) is identity-audit-api (MongoTenantImagesRouteTest:
// C_the_tenant_is_the_one_of_the_token_and_a_body_that_names_one_is_a_400, C_a_file_that_is_not_allowed_is_400_and_the_previous_one_stays);
// which paths the band accepts and that a broken picture is hidden is front tenant-brand-band.spec.ts.
const SHOTS = 'test-results/hu-ida-005';
const FILES = '/api/v1/identity-audit/public/tenants/acme';
const area = (page: Page) => page.locator('app-remote-host');
const band = (page: Page) => page.getByRole('region', { name: 'Company logo and images' });
const slot = (page: Page, name: string) => area(page).getByRole('group', { name, exact: true });
const GIF = { name: 'logo.gif', mimeType: 'image/gif', buffer: Buffer.from('R0lGODlhAQABAAAAACw=', 'base64') };

/** The public profile the container reads again after a save, and the public files it then loads into its band. */
async function serveProfile(page: Page, profile: object): Promise<void> {
  await page.route(`**${FILES}`, (route) => route.fulfill({ json: { ...ACME, ...profile } }));
  await page.route(`**${FILES}/{logo,images/*}*`, (route) => route.fulfill({ body: TINY_PNG.buffer, contentType: 'image/png' }));
}

/**
 * openAreaAs of lead-portals, with the public profile the container reads at sign-in given here (a saved logo, or none): the route of
 * the profile has to be set after serveTenantProfile and before the page loads.
 */
async function openBranding(page: Page, profile: object = {}): Promise<void> {
  await requireModule(page, IDENTITY);
  await serveTenantProfile(page);
  await serveProfile(page, profile);
  await stubJson(page, 'POST', sessionsRoute('acme'), 200, sessionOf(['TENANT_ADMINISTRATOR'], { tenantId: 'tenant-acme' }));
  await page.goto(`/t/acme/ingresar?returnUrl=${encodeURIComponent(`/t/acme/areas/${IDENTITY}`)}`);
  await signIn(page, { team: 'Administrador' });
  await expect(area(page)).toContainText('Control de la operación');
  await area(page).getByRole('button', { name: /^Logo e imágenes/ }).click();
  await expect(area(page).getByRole('heading', { name: 'Logo e imágenes' })).toBeVisible();
}

test('AC1 · a logo saved by the Administrator is sent and the band of the tenant shows it, without a reload', async ({ page }) => {
  await stubJson(page, 'PUT', '**/api/v1/identity-audit/tenant/logo', 200, { ...ACME, logoUrl: `${FILES}/logo?v=1a2b` });
  await openBranding(page);
  await expect(band(page)).toHaveCount(0);
  await serveProfile(page, { logoUrl: `${FILES}/logo?v=1a2b` });
  await slot(page, 'Logo').getByLabel('Elegir logo').setInputFiles(TINY_PNG);
  const saved = page.waitForResponse((r) => r.url().endsWith('/tenant/logo') && r.request().method() === 'PUT');
  const reread = page.waitForResponse((r) => r.url().endsWith(FILES));
  await slot(page, 'Logo').getByRole('button', { name: 'Guardar logo' }).click();
  // AC3: the tenant is the one of the token: the route names none and the body is only the file.
  expect((await saved).request().postDataJSON()).toEqual({ contentType: 'image/png', data: TINY_PNG.buffer.toString('base64') });
  await reread;
  await expect(slot(page, 'Logo')).toContainText('Cambio guardado.');
  await expect(band(page).locator('img.tenant-brand-logo')).toHaveAttribute('src', `${FILES}/logo?v=1a2b`);
  await page.screenshot({ path: `${SHOTS}/ac1-logo.png`, fullPage: true });
});

test('AC2 · the commercial images saved by the Administrator go to their place and the band shows them in order', async ({ page }) => {
  const sent: string[] = [];
  await page.route('**/api/v1/identity-audit/tenant/images/*', (route) => {
    sent.push(new URL(route.request().url()).pathname);
    return route.fulfill({ json: ACME });
  });
  await openBranding(page);
  await serveProfile(page, { images: [{ position: 1, url: `${FILES}/images/1` }, { position: 0, url: `${FILES}/images/0` }] });
  for (const place of ['Imagen 2', 'Imagen 1']) {
    await slot(page, place).getByLabel('Elegir imagen').setInputFiles(TINY_PNG);
    const reread = page.waitForResponse((r) => r.url().endsWith(FILES));
    await slot(page, place).getByRole('button', { name: 'Guardar imagen' }).click();
    await reread;
    await expect(slot(page, place)).toContainText('Cambio guardado.');
  }
  expect(sent).toEqual(['/api/v1/identity-audit/tenant/images/1', '/api/v1/identity-audit/tenant/images/0']);
  await expect(band(page).locator('.tenant-brand-images img')).toHaveCount(2);
  expect(await band(page).locator('.tenant-brand-images img').evaluateAll((all) => all.map((img) => img.getAttribute('src')))).toEqual([
    `${FILES}/images/0`,
    `${FILES}/images/1`,
  ]);
  await page.screenshot({ path: `${SHOTS}/ac2-imagenes.png`, fullPage: true });
});

test('AC4 · a file of a kind that is not allowed is refused on the screen, nothing is sent and the saved logo stays', async ({ page }) => {
  const sent: string[] = [];
  await page.route('**/api/v1/identity-audit/tenant/logo', (route) => (sent.push(route.request().method()), route.fulfill({ json: ACME })));
  await openBranding(page, { logoUrl: `${FILES}/logo` });
  await expect(slot(page, 'Logo').getByRole('img', { name: 'Logo', exact: true })).toHaveAttribute('src', `${FILES}/logo`);
  await slot(page, 'Logo').getByLabel('Elegir logo').setInputFiles(GIF);
  await expect(slot(page, 'Logo')).toContainText('Este archivo no se puede usar: elige una imagen PNG, JPEG o WebP.');
  await expect(slot(page, 'Logo').getByRole('button', { name: 'Guardar logo' })).toBeDisabled();
  await expect(slot(page, 'Logo').getByRole('img', { name: 'Logo', exact: true })).toHaveAttribute('src', `${FILES}/logo`);
  expect(sent).toEqual([]);
  await page.screenshot({ path: `${SHOTS}/ac4-tipo-no-permitido.png`, fullPage: true });
});

test('AC4 · a file the service refuses is told with the words of the screen and the saved logo stays', async ({ page }) => {
  await stubJson(page, 'PUT', '**/api/v1/identity-audit/tenant/logo', 400, { error: 'VALIDATION_ERROR', message: 'the bytes are not an allowed image', traceId: 't-ida-005' });
  await openBranding(page, { logoUrl: `${FILES}/logo` });
  await slot(page, 'Logo').getByLabel('Elegir logo').setInputFiles(TINY_PNG);
  const answered = page.waitForResponse((r) => r.url().endsWith('/tenant/logo'));
  await slot(page, 'Logo').getByRole('button', { name: 'Guardar logo' }).click();
  await answered;
  await expect(slot(page, 'Logo')).toContainText('El servicio no aceptó este archivo. Elige una imagen PNG, JPEG o WebP del tamaño permitido.');
  await expect(area(page)).not.toContainText('the bytes are not an allowed image');
  await expect(slot(page, 'Logo').getByRole('img', { name: 'Logo', exact: true })).toHaveAttribute('src', `${FILES}/logo`);
  await expect(band(page).locator('img.tenant-brand-logo')).toHaveAttribute('src', `${FILES}/logo`);
});

test('AC5 · a tenant that has set neither shows no band and each place says the platform identity is shown', async ({ page }) => {
  await openBranding(page);
  await expect(band(page)).toHaveCount(0);
  await expect(slot(page, 'Logo')).toContainText('Aún no tienes un logo: se muestra la identidad de la plataforma.');
  for (const n of [1, 2, 3, 4, 5]) await expect(slot(page, `Imagen ${n}`)).toContainText('Sin imagen: se muestra la identidad de la plataforma.');
  await page.screenshot({ path: `${SHOTS}/ac5-sin-archivos.png`, fullPage: true });
});

import { mkdirSync, statSync } from 'node:fs';
import { expect, Page, test } from '@playwright/test';
import { serveStubs, serveTenantProfile, SHIPPED_MANIFEST } from './support/container';

const IDENTITY = 'identity-audit-portal';
const AREAS = 'test-results/areas';

/** Opens a portal's area with its shipped module; the identity portal is the sign-in, the others need a session. */
async function openArea(page: Page, name: string) {
  await serveTenantProfile(page);
  await serveStubs(page, { [name]: SHIPPED_MANIFEST[name] });
  if (name === IDENTITY) return page.goto('/t/acme/ingresar');
  await page.goto(`/t/acme/areas/${name}`);
  await expect(page.getByText('Stub sign-in')).toBeVisible();
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(new RegExp(`/t/acme/areas/${name}$`));
}

test('E2E·container_serves_the_production_shell', async ({ page, request }) => {
  await serveTenantProfile(page);
  const home = await request.get('/');
  expect(home.status()).toBe(200);
  expect(home.headers()['content-security-policy']).toContain("script-src 'self'");
  // The production build swaps the development sign-in out: its path is the common 404.
  await page.goto('/dev-sign-in');
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
  expect((await request.get('/stubs/identity-audit-portal.js')).headers()['content-type']).not.toMatch(/javascript/);
});

for (const [name, path] of Object.entries(SHIPPED_MANIFEST)) {
  test(`E2E·mounted_portal_shows_its_own_screen · ${name}`, async ({ page, request }) => {
    const module = await request.get(`/${path}`);
    test.skip(!module.ok(), `${path} is not copied into portals/ of this image (answers ${module.status()})`);
    await openArea(page, name);
    await expect(page.locator('app-remote-host [data-remote]')).not.toBeEmpty();
    await expect(page.getByText(`${name} is not available right now`)).toHaveCount(0);
    await expect(page.getByText('Stub sign-in')).toHaveCount(0);
  });
}

test('E2E·area_screenshots_are_kept', async ({ browser, baseURL }) => {
  mkdirSync(AREAS, { recursive: true });
  for (const name of Object.keys(SHIPPED_MANIFEST)) {
    // A fresh context per area: no session carried from the previous one.
    const context = await browser.newContext({ baseURL });
    const page = await context.newPage();
    await openArea(page, name);
    await expect(page.getByText('Loading…')).toHaveCount(0);
    const file = `${AREAS}/${name}.png`;
    await page.screenshot({ path: file, fullPage: true });
    expect(statSync(file).size, file).toBeGreaterThan(0);
    await context.close();
  }
});

import { expect, test } from '@playwright/test';
import { ACME, serveStubs, serveTenantProfile } from './support/container';

const COLORED = { ...ACME, visualIdentity: { primaryColor: '#c0392b', secondaryColor: '#7b241c' } };

test.beforeEach(async ({ page }) => {
  await serveStubs(page);
  await serveTenantProfile(page);
});

const accent = (page: import('@playwright/test').Page, name: string) =>
  page.locator('app-tenant-shell').evaluate((el, n) => getComputedStyle(el).getPropertyValue(n).trim(), name);

test('E2E landing_paints_the_colors_of_the_tenant_profile', async ({ page }) => {
  await page.route('**/api/v1/identity-audit/public/tenants/acme', (route) => route.fulfill({ json: COLORED }));
  await page.goto('/t/acme');
  await expect(page.locator('.mth-btn-primary')).toHaveCSS('background-color', 'rgb(192, 57, 43)');
  expect(await accent(page, '--accent')).toBe('#c0392b');
});

test('E2E landing_keeps_the_platform_look_without_visual_identity', async ({ page }) => {
  await page.goto('/t/acme');
  await expect(page.locator('.mth-btn-primary')).toHaveCSS('background-color', 'rgb(233, 120, 93)');
});

test('E2E portal_callback_updates_the_colors_without_a_reload', async ({ page }) => {
  await page.route('**/api/v1/identity-audit/public/tenants/acme', (route) => route.fulfill({ json: COLORED }));
  await page.goto('/t/acme/ingresar');
  await expect(page.getByText('Stub sign-in')).toBeVisible();
  expect(await accent(page, '--accent')).toBe('#c0392b');
  await page.evaluate(() => ((window as unknown as { marker: string }).marker = 'same-page'));
  await page.getByRole('button', { name: 'Save colors' }).click();
  await expect.poll(() => accent(page, '--accent')).toBe('#112233');
  expect(await accent(page, '--accent-strong')).toBe('#445566');
  expect(await page.evaluate(() => (window as unknown as { marker: string }).marker)).toBe('same-page');
});

test('E2E general_login_and_platform_get_no_visual_identity_callback', async ({ page }) => {
  await page.goto('/ingresar');
  await expect(page.getByText('Stub sign-in')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save colors' })).toHaveCount(0);
  await page.goto('/platform');
  await expect(page.getByText('Stub sign-in')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save colors' })).toHaveCount(0);
});
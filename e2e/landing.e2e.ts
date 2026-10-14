import { expect, test } from '@playwright/test';
import { serveStubs, serveTenantProfile } from './support/container';

test.beforeEach(async ({ page }) => {
  await serveStubs(page);
  await serveTenantProfile(page);
});

test('E2E landing_is_the_public_home_of_the_tenant_without_a_session', async ({ page }) => {
  await page.goto('/t/acme');
  await expect(page.getByRole('heading', { level: 1, name: /Destinos que valen la pena vivir/ })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Ver catálogo' })).toBeVisible();
  await expect(page).toHaveURL(/\/t\/acme$/);
});

test('E2E landing_ingresar_and_operator_links_reach_the_sign_in_route', async ({ page }) => {
  await page.goto('/t/acme');
  await page.locator('header.mth-header').getByRole('link', { name: 'Ingresar' }).click();
  await expect(page).toHaveURL(/\/t\/acme\/ingresar$/);
  await page.goto('/t/acme');
  await page.locator('header.mth-header').getByRole('link', { name: 'Equipo del operador' }).click();
  await expect(page).toHaveURL(/\/t\/acme\/ingresar\?tab=operador$/);
});
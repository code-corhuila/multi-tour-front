import { expect, test } from '@playwright/test';
import { serveStubs, serveTenantProfile } from './support/container';

test.beforeEach(async ({ page }) => {
  await serveStubs(page);
  await serveTenantProfile(page);
});

test('E2E root_shows_the_welcome_and_ingresar_reaches_the_tenant_login', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: /Destinos que valen la pena vivir/ })).toBeVisible();
  await page.locator('header.mth-header').getByRole('link', { name: 'Ingresar' }).click();
  await expect(page).toHaveURL(/\/t\/travesia-natural\/ingresar$/);
  await expect(page.getByText('Stub sign-in')).toBeVisible();
  await expect(page.locator('app-root > header')).toHaveCount(0);
});

test('E2E operator_links_at_the_root_go_to_the_tenant_login_with_the_operator_tab', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Acceder al equipo del operador' }).click();
  await expect(page).toHaveURL(/\/t\/travesia-natural\/ingresar\?tab=operador$/);
  await page.goto('/');
  await page.locator('header.mth-header').getByRole('link', { name: 'Equipo del operador' }).click();
  await expect(page).toHaveURL(/\/t\/travesia-natural\/ingresar\?tab=operador$/);
});

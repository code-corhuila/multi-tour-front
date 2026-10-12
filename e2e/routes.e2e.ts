import { expect, Page, test } from '@playwright/test';
import { serveStubs, serveTenantProfile } from './support/container';

test.beforeEach(async ({ page }) => {
  // The gateway is the page's own origin, so the public profile route can be answered here.
  await serveStubs(page);
  await serveTenantProfile(page);
});

/** The stub identity portal shows a button that opens a session through the props the container gives it. */
async function signInThroughThePortal(page: Page) {
  await expect(page.getByText('Stub sign-in')).toBeVisible();
  await page.getByRole('button', { name: 'Sign in' }).click();
}

test('E2E· protected_route_goes_to_sign_in_and_back', async ({ page }) => {
  await page.goto('/t/acme/areas/stub-react');
  await expect(page).toHaveURL(/\/t\/acme\/ingresar\?returnUrl=%2Ft%2Facme%2Fareas%2Fstub-react/);
  await signInThroughThePortal(page);
  await expect(page).toHaveURL(/\/t\/acme\/areas\/stub-react$/);
  await expect(page.getByText('Stub React remote')).toBeVisible();
});

test('E2E· unknown_identifier_and_unknown_route_show_404', async ({ page }) => {
  await page.goto('/t/nobody');
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
  await page.goto('/no/such/route');
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
});

test('E2E· one_portal_down_only_its_area_fails', async ({ page }) => {
  await page.goto('/t/acme/areas/stub-down');
  await signInThroughThePortal(page);
  await expect(page.getByRole('alert')).toContainText('stub-down is not available right now');
});
test('E2E home_shows_the_company_field_and_goes_to_the_tenant_link', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Ingresa con el enlace de tu empresa.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Administración de la plataforma' })).toBeVisible();
  await page.getByLabel('Identificador de tu empresa').fill('acme');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/t\/acme/);
  await expect(page.getByRole('heading', { name: 'Acme Tours' })).toHaveCount(0);
});
test('E2E old_sign_in_path_is_an_alias_of_ingresar_and_keeps_the_return_url', async ({ page }) => {
  await page.goto('/t/acme/sign-in?returnUrl=%2Ft%2Facme%2Fareas%2Fstub-react');
  await expect(page).toHaveURL(/\/t\/acme\/ingresar\?returnUrl=%2Ft%2Facme%2Fareas%2Fstub-react$/);
  await expect(page.getByText('Stub sign-in')).toBeVisible();
});
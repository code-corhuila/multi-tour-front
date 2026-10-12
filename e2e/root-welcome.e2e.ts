import { expect, test } from '@playwright/test';

test('E2E root_shows_the_welcome_and_ingresar_reaches_the_general_login', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: /Destinos que valen la pena vivir/ })).toBeVisible();
  await page.locator('header.mth-header').getByRole('link', { name: 'Ingresar' }).click();
  await expect(page).toHaveURL(/\/ingresar$/);
  await expect(page.getByText('Stub sign-in')).toBeVisible();
  await expect(page.locator('app-root > header')).toHaveCount(0);
});

test('E2E operator_links_at_the_root_go_to_the_general_login_with_the_operator_tab', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Acceder al equipo del operador' }).click();
  await expect(page).toHaveURL(/\/ingresar\?tab=operador$/);
  await page.goto('/');
  await page.locator('header.mth-header').getByRole('link', { name: 'Equipo del operador' }).click();
  await expect(page).toHaveURL(/\/ingresar\?tab=operador$/);
});

test('E2E general_login_session_survives_the_navigation_to_the_tenant_area', async ({ page }) => {
  await page.route('**/api/v1/identity-audit/public/tenants/*', (route) =>
    route.fulfill({ json: { identifier: 'acme', commercialName: 'Acme Tours', tenantStatus: 'ACTIVE' } }),
  );
  await page.goto('/ingresar');
  await page.getByRole('button', { name: 'Sign in for acme' }).click();
  // The guard of the area lets the person in: the session was kept under `acme` and the page was not reloaded.
  await expect(page).toHaveURL(/\/t\/acme\/areas\/stub-react$/);
  await expect(page.getByText('Stub React remote')).toBeVisible();
});
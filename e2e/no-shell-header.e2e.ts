import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('**/api/v1/identity-audit/public/tenants/*', (route) =>
    route.fulfill({ json: { identifier: 'acme', commercialName: 'Acme Tours', tenantStatus: 'ACTIVE' } }),
  );
});

/** The portals draw full-bleed screens with their own brand: the shell adds no header or tenant name. */
for (const path of ['/t/acme/ingresar', '/platform', '/platform/ingresar']) {
  test(`E2E shell_draws_no_header_on_${path.replace(/\W+/g, '_')}`, async ({ page }) => {
    await page.goto(path);
    await expect(page.getByText('Stub sign-in')).toBeVisible();
    await expect(page.locator('app-root > header')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Multitour', level: 1 })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Acme Tours' })).toHaveCount(0);
  });
}

test('E2E unavailable_portal_still_shows_its_area_error_without_a_shell_header', async ({ page }) => {
  await page.goto('/t/acme/areas/stub-down');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('alert')).toContainText('stub-down is not available right now');
  await expect(page.locator('app-root > header')).toHaveCount(0);
});
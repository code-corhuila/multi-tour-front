import { expect, Page, test } from '@playwright/test';

const PROFILE = { identifier: 'acme', commercialName: 'Acme Tours', tenantStatus: 'ACTIVE' };

test.beforeEach(async ({ page }) => {
  // The gateway is the page's own origin, so the public profile route can be answered here.
  await page.route('**/api/v1/identity-audit/public/tenants/*', (route) => {
    const identifier = route.request().url().split('/').pop();
    return identifier === 'acme'
      ? route.fulfill({ json: PROFILE })
      : route.fulfill({ status: 404, json: { error: 'NOT_FOUND', message: 'Not found', traceId: 't-1' } });
  });
});

/** The stub identity portal shows a button that opens a session through the props the container gives it. */
async function signInThroughThePortal(page: Page) {
  await expect(page.getByText('Stub sign-in')).toBeVisible();
  await page.getByRole('button', { name: 'Sign in' }).click();
}

test('E2E· protected_route_goes_to_sign_in_and_back', async ({ page }) => {
  await page.goto('/t/acme/areas/stub-react');
  await expect(page).toHaveURL(/\/t\/acme\/sign-in\?returnUrl=%2Ft%2Facme%2Fareas%2Fstub-react/);
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
  await expect(page.getByRole('heading', { name: 'Multitour', level: 1 })).toBeVisible();
  await expect(page.getByText('Acme Tours')).toBeVisible();
});
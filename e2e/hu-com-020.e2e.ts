import { expect, test } from '@playwright/test';
import { openCommercialAs, sidebarItems } from './support/operator-session';

// HU-COM-020 (handle the obligations of an inactive tenant), front slice: the restricted access of the Administrator.
// Spec: 07-api/specs/transversal/multi-tour-front/004- (DP-FRT-5) and the comment of the owner on HU-COM-020.
// The tenant `dormant` is the inactive one of the container fixtures; the token carries `access: restricted`.
// Not covered here: the refusal of the API outside the regularization work and the frozen deadlines (AC1 to AC6: real service),
// and the banner "Operador inactivo: acceso restringido" of the mockup (the portal has no authorized screen for it, portal spec 020-).
const ADMINISTRATOR = ['TENANT_ADMINISTRATOR'];
const RESTRICTED = { claims: { access: 'restricted' }, tenant: 'dormant' };

test('E-HU-COM-020-01 · the restricted Administrator of an inactive tenant reaches the commercial area with only Reservas and Pagos in the sidebar', async ({ page }) => {
  await openCommercialAs(page, ADMINISTRATOR, RESTRICTED);
  expect(await sidebarItems(page)).toEqual(['Reservas', 'Pagos']);
  await page.screenshot({ path: 'test-results/hu-com-020/it-01-sidebar-restringido.png', fullPage: true });
});

test('E-HU-COM-020-02 · the notice of the inactive tenant stays above the area and the areas outside the regularization work are not drawn', async ({ page }) => {
  await openCommercialAs(page, ADMINISTRATOR, RESTRICTED);
  await expect(page.getByText('Dormant Tours is not active')).toBeVisible();
  const items = await sidebarItems(page);
  for (const outside of ['Catálogos', 'Descuentos', 'Salidas', 'Caja']) expect(items).not.toContain(outside);
  await page.screenshot({ path: 'test-results/hu-com-020/it-02-aviso.png', fullPage: true });
});

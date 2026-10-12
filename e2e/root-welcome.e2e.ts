import { expect, test } from '@playwright/test';

test('E2E root_shows_the_welcome_and_ingresar_reaches_the_company_selector', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: /Destinos que valen la pena vivir/ })).toBeVisible();
  await expect(page.locator('header.mth-header').getByRole('link', { name: 'Equipo del operador' })).toBeVisible();
  await page.locator('header.mth-header').getByRole('link', { name: 'Ingresar' }).click();
  await expect(page).toHaveURL(/\/ingresar$/);
  await expect(page.getByLabel('Identificador de tu empresa')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Volver al inicio' })).toBeVisible();
});

test('E2E operator_panel_at_the_root_goes_to_the_platform', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Acceder al equipo del operador' }).click();
  await expect(page).toHaveURL(/\/platform$/);
});
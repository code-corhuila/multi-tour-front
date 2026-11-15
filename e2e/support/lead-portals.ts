import { expect, Page, test } from '@playwright/test';
import { serveTenantProfile, SHIPPED_MANIFEST } from './container';
import { tokenOf } from './operator-session';

/**
 * The identity-audit and operations-cost stories walk the real modules the platform under test serves (spec 006 of
 * multi-tour-front, plan D-01): the manifest is not replaced and every answer of the API comes from page.route in the test.
 */
export const IDENTITY = 'identity-audit-portal';
export const OPERATIONS = 'operations-cost-portal';

/** The security route that signs in at the link of a tenant, or at the platform without one. */
export const sessionsRoute = (tenant?: string): string =>
  tenant === undefined ? '**/api/v1/security/public/platform/sessions' : `**/api/v1/security/public/tenants/${tenant}/sessions`;

/** Answers one method on one route with a fixed status and JSON body; any other method goes on. */
export async function stubJson(page: Page, method: string, url: string, status: number, body: unknown): Promise<void> {
  await page.route(url, (route) =>
    route.request().method() === method ? route.fulfill({ status, json: body }) : route.fallback(),
  );
}

/** The answer of a good sign-in: a token (alg none, only the claims the container reads) with the given roles. */
export const sessionOf = (roles: string[], claims: object = {}, extra: object = {}) => ({
  accessToken: tokenOf(roles, 'e2e-user', claims),
  tokenType: 'Bearer',
  expiresIn: 900,
  ...extra,
});

/** Skips the test when the platform does not serve the real module (the bare image of the front ships none, or answers html). */
export async function requireModule(page: Page, portal: string): Promise<void> {
  const path = SHIPPED_MANIFEST[portal];
  if (!path) throw new Error(`${portal} is not in the manifest the front ships (public/federation.manifest.json)`);
  const module = await page.request.get(`/${path}`);
  const javascript = (module.headers()['content-type'] ?? '').includes('javascript');
  test.skip(!module.ok() || !javascript, `the platform under test does not serve the module of ${portal}`);
}

/** Opens the sign-in of the identity portal at the link of a tenant (acme by default) or, with null, at the platform. */
export async function openSignIn(page: Page, tenant: string | null = 'acme', query = ''): Promise<void> {
  await requireModule(page, IDENTITY);
  await serveTenantProfile(page);
  await page.goto(tenant === null ? `/platform/ingresar${query}` : `/t/${tenant}/ingresar${query}`);
  await expect(page.getByLabel('Correo electrónico')).toBeVisible();
}

/** Fills the sign-in screen and sends it; `team` picks the operator tab and its profile. */
export async function signIn(page: Page, { team }: { team?: 'Administrador' | 'Colaborador' } = {}): Promise<void> {
  if (team) {
    await page.getByRole('button', { name: 'Equipo del operador' }).click();
    await page.getByRole('button', { name: team, exact: true }).click();
  }
  await page.getByLabel('Correo electrónico').fill('persona@example.test');
  await page.getByLabel('Contraseña', { exact: true }).fill('Clave-de-prueba-1');
  await page.getByRole('button', { name: /^(Iniciar sesión|Ingresar a plataforma)/ }).click();
}

/**
 * Opens an area of a tenant with its real module and a session of the given roles. The session lives only in memory and only
 * the identity portal opens it, so the way in is the real sign-in screen with the security route stubbed.
 * Only for team profiles (Administrador or Colaborador, chosen by the roles) in an area of a tenant: not for FINAL_CUSTOMER,
 * whose tab is another one, nor for PLATFORM_ADMINISTRATOR, who signs in at /platform.
 */
export async function openAreaAs(page: Page, portal: string, roles: string[], { tenant = 'acme', claims = {} }: { tenant?: string; claims?: object } = {}): Promise<void> {
  await requireModule(page, portal);
  await stubJson(page, 'POST', sessionsRoute(tenant), 200, sessionOf(roles, { tenantId: `tenant-${tenant}`, ...claims }));
  await openSignIn(page, tenant, `?returnUrl=${encodeURIComponent(`/t/${tenant}/areas/${portal}`)}`);
  await signIn(page, { team: roles.includes('TENANT_ADMINISTRATOR') ? 'Administrador' : 'Colaborador' });
  await expect(page).toHaveURL(new RegExp(`/t/${tenant}/areas/${portal}`));
}

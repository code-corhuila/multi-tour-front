import { existsSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { Page } from '@playwright/test';

/**
 * The image under test is the production one (HU-FRT-001, plan D-03): it has no stub remotes and no
 * development sign-in. The stubs and the test data reach the browser only through these interceptions.
 */
const E2E = join(__dirname, '..');

export const TEST_MANIFEST: Record<string, string> = JSON.parse(
  readFileSync(join(E2E, 'manifest', 'federation.manifest.json'), 'utf8'),
);

/** The manifest the image ships (`public/`), with the modules copied into `portals/`. */
export const SHIPPED_MANIFEST: Record<string, string> = Object.fromEntries(
  Object.entries(
    JSON.parse(readFileSync(join(E2E, '..', 'public', 'federation.manifest.json'), 'utf8')) as Record<string, string | { url: string }>,
  ).map(([name, entry]) => [name, typeof entry === 'string' ? entry : entry.url]),
);

export const ACME = { identifier: 'acme', commercialName: 'Acme Tours', tenantStatus: 'ACTIVE' };
export const DORMANT = { identifier: 'dormant', commercialName: 'Dormant Tours', tenantStatus: 'INACTIVE' };

/** Answers the test manifest (plus `real` entries, served by the image itself) and the stub remotes. */
export async function serveStubs(page: Page, real: Record<string, string> = {}): Promise<void> {
  const manifest = { ...TEST_MANIFEST, ...real };
  await page.route('**/federation.manifest.json', (route) => route.fulfill({ json: manifest }));
  await page.route('**/stubs/*.js', (route) => {
    const file = join(E2E, 'stubs', basename(new URL(route.request().url()).pathname));
    return existsSync(file) ? route.fulfill({ path: file }) : route.fulfill({ status: 404, body: '' });
  });
}

/** The public profile of a tenant: `acme` is active, `dormant` is inactive, any other identifier answers 404. */
export async function serveTenantProfile(page: Page): Promise<void> {
  await page.route('**/api/v1/identity-audit/public/tenants/*', (route) => {
    const identifier = route.request().url().split('/').pop();
    if (identifier === 'dormant') return route.fulfill({ json: DORMANT });
    return identifier === 'acme'
      ? route.fulfill({ json: ACME })
      : route.fulfill({ status: 404, json: { error: 'NOT_FOUND', message: 'Not found', traceId: 't-1' } });
  });
}

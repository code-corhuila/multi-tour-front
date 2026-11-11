import { expect, Page, test } from '@playwright/test';
import { serveStubs, serveTenantProfile, SHIPPED_MANIFEST } from './container';

const COMMERCIAL = 'commercial-reservation-portal';
export const COMMERCIAL_AREA = `/t/acme/areas/${COMMERCIAL}`;
const DAY_MS = 86_400_000;
const dayNumber = (day: string): number => Date.parse(`${day}T00:00:00Z`) / DAY_MS;
/** The day the demo data was written for (portal src/app/demo/demo-fixtures.ts): every seeded date is moved by the whole days to today. */
const ANCHOR_DAY = '2026-10-13';
const tenantToday = (): string => new Date(Date.now() - 5 * 3_600_000).toISOString().slice(0, 10);

/** The instant (ms) a seeded date-time has in the page today: the portal keeps its time of day and moves its day (demoDate). */
export function seededInstant(seeded: string): number {
  const day = new Date((dayNumber(seeded.slice(0, 10)) + dayNumber(tenantToday()) - dayNumber(ANCHOR_DAY)) * DAY_MS).toISOString().slice(0, 10);
  return Date.parse(day + seeded.slice(10));
}

/** The demo clock the proof scenarios use by default: the moment the proofs of RES-1833 and RES-1834 were seeded (13 oct 09:00). */
export const DEMO_NOW = new Date(seededInstant('2026-10-13T09:00:00-05:00')).toISOString();

const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');

/** A development token (alg none, no signature check in the demo build): only the claims the container reads. */
export function tokenOf(roles: string[], sub = 'demo-user', claims: object = {}): string {
  return `${encode({ alg: 'none', typ: 'JWT' })}.${encode({ sub, roles, exp: Math.floor(Date.now() / 1000) + 86_400, ...claims })}.demo`;
}

/** Stands for the identity portal, but opens the session with a token that carries the given roles. */
function identityStubOf(token: string): string {
  return `export function mount(element, props) {
  element.innerHTML = '<p>Stub sign-in</p><button type="button">Sign in</button>';
  const button = element.querySelector('button');
  const signIn = () => props.session.open({ accessToken: ${JSON.stringify(token)}, expiresIn: 3600 });
  button.addEventListener('click', signIn);
  return () => { button.removeEventListener('click', signIn); element.innerHTML = ''; };
}
`;
}

/**
 * Opens the commercial reservation area with its shipped module (the image needs the demo build of the module in
 * `portals/`, see README) and a session whose token carries `roles`. The demo store lives in the page: every test
 * starts from the seeded reservations.
 */
export async function openCommercialAs(page: Page, roles: string[], { claims = {}, tenant = 'acme' }: { claims?: object; tenant?: string } = {}): Promise<void> {
  // Only the demo build of the module has data and reads the demo clock; the CI image ships no module at all.
  const module = await page.request.get(`/${SHIPPED_MANIFEST[COMMERCIAL]}`);
  test.skip(!module.ok() || !(await module.text()).includes('demoFixtures'), 'the image has no demo build of the commercial reservation portal in portals/');
  await serveTenantProfile(page);
  await serveStubs(page, { [COMMERCIAL]: SHIPPED_MANIFEST[COMMERCIAL] });
  await page.route('**/stubs/identity-audit-portal.js', (route) =>
    route.fulfill({ body: identityStubOf(tokenOf(roles, 'demo-user', claims)), contentType: 'text/javascript' }),
  );
  await page.goto(`/t/${tenant}/areas/${COMMERCIAL}`);
  await expect(page.getByText('Stub sign-in')).toBeVisible();
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(new RegExp(`${COMMERCIAL}$`));
  await setDemoNow(page, DEMO_NOW);
}

/**
 * The portal reads ?demoNow (the demo clock) and ?demoFixtures (seeded situations such as closed-cash-session or
 * full-departure) from the address when a rule compares times; the router is not told, so nothing reloads and the
 * session stays. Each call keeps the parameter it does not set.
 */
export const setDemoQuery = (page: Page, set: { now?: string; fixtures?: string[] }): Promise<void> =>
  page.evaluate((s) => {
    const query = new URLSearchParams(location.search);
    if (s.now) query.set('demoNow', s.now);
    if (s.fixtures) query.set('demoFixtures', s.fixtures.join(','));
    history.replaceState(history.state, '', `${location.pathname}?${query.toString()}`);
  }, set);

export const setDemoNow = (page: Page, now: string): Promise<void> => setDemoQuery(page, { now });

/** The text of the area, whitespace collapsed, for assertions that do not depend on the layout. */
export const areaText = async (page: Page): Promise<string> => {
  await page.locator('app-remote-host').locator('h1:visible, h2:visible, h3:visible').first().waitFor();
  await page.waitForTimeout(400);
  return (await page.locator('app-remote-host').innerText()).replace(/\s+/g, ' ').trim();
};

/** Customer: opens "Ver detalle" of the tour card that carries the given name (the first card is not always that tour). */
export async function openTourDetail(page: Page, name = 'Desierto de la Tatacoa'): Promise<void> {
  await page.getByRole('button', { name: 'Tours', exact: true }).first().click();
  const card = page.locator('app-remote-host article, app-remote-host li, app-remote-host div').filter({ hasText: name }).filter({ has: page.getByRole('button', { name: 'Ver detalle' }) }).last();
  await card.getByRole('button', { name: 'Ver detalle' }).first().click();
  await page.waitForTimeout(500);
}

/** Opens an area of the portal from the sidebar, by the label of its item, and waits until the page names it. */
export async function goTo(page: Page, label: string, heading: string = label): Promise<void> {
  await page.getByText(label, { exact: true }).first().click();
  await expect(page.locator('app-remote-host')).toContainText(heading);
}

/** The labels of the sidebar items the shell draws for the signed-in role, in order. */
export const sidebarItems = async (page: Page): Promise<string[]> =>
  (await page.locator('nav').first().innerText()).split('\n').map((s) => s.trim()).filter(Boolean);

/** Customer screen 21: the holder of the reservation (name, document, phone, email, birth date). */
export async function fillHolder(page: Page): Promise<void> {
  await page.getByLabel('Nombre completo').first().fill('Ana Prueba');
  await page.getByLabel('Documento de identidad').first().fill('1012345678');
  await page.getByLabel(/^Teléfono/).first().fill('3001112233');
  await page.getByLabel('Correo electrónico').first().fill('ana@example.test');
  await page.getByLabel('Fecha de nacimiento').first().fill('1990-01-02');
}

/** A 1x1 PNG for the forms that require an image (new service, new establishment). */
export const TINY_PNG = { name: 'imagen-e2e.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64') };

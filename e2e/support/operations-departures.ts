import { expect, Page, Request } from '@playwright/test';
import { OPERATIONS, openAreaAs } from './lead-portals';

/**
 * The departures of the operations-cost portal walked with its real module (spec 006 of multi-tour-front, plan D-01): every call the
 * module makes is answered here, shaped as contract operations-cost.yaml 0.17.0 and the workflows change-departure-vehicles and
 * cancel-departure say. The stubs read the role like the real API does (RouteAuthorization): the routes of the Administrator only
 * answer 403 FORBIDDEN to anyone else.
 */
export const MANAGE = 'MANAGE_DEPARTURE_EXECUTION';
/** The permissions an Administrator holds by profile (the claim `permissions` of its token). */
export const ADMIN_PERMISSIONS = ['MANAGE_CASH', MANAGE, 'VALIDATE_PAYMENT_PROOFS'];
// Ids as the services issue them: UUIDs.
export const ACCOUNT = '3f0c5a52-8f6e-4d0b-9a57-1c2b7e0d4a11';
export const RES_1 = '7b1e6c3a-2d84-4f5b-8c19-5a0e9d3f6b21';
export const RES_2 = '9d4a2f7e-61c3-4b88-a5e0-3c7f1b8d2e32';
export const SAGA = 'c2e8b4d6-0a17-4f39-b6d5-8e1a3c9f7a43';
export const NEW_VEHICLE_ID = '5e9a1c7b-3f20-4d64-8b0e-2a6d4f8c1b54';
export const ZONE = 'America/Bogota';
export const OPS = '/api/v1/operations-cost';
const HOUR = 3_600_000;

// Bogotá keeps UTC-5 all year (no daylight saving time), so its wall clock is plain arithmetic.
/** The wall clock of the tenant (`2026-11-15T08:00`) `hours` from now, rounded down to the minute. */
export const wallIn = (hours: number): string => new Date(Date.now() + hours * HOUR - 5 * HOUR).toISOString().slice(0, 16);
/** The RFC 3339 instant in UTC of a wall clock of the tenant, as the portal sends it. */
export const instantOf = (wall: string): string => new Date(Date.parse(`${wall}:00-05:00`)).toISOString().replace('.000Z', 'Z');

export const pageOf = <T>(data: T[]) => ({ data, meta: { page: 1, limit: 100, total: data.length, totalPages: 1 } });

/** Answers one method on one path (the query is ignored) with a fixed status and JSON body; any other call goes on. */
export async function answer(page: Page, method: string, path: string, status: number, body: unknown): Promise<void> {
  await page.route(
    (url) => url.pathname === path,
    (route) => (route.request().method() === method ? route.fulfill({ status, json: body }) : route.fallback()),
  );
}

/** The next request of one method to one path. */
export const nextRequest = (page: Page, method: string, path: string): Promise<Request> =>
  page.waitForRequest((r) => r.method() === method && new URL(r.url()).pathname === path);

export const refusal = (status: number, error: string) => ({ status, body: { error, message: `stubbed ${error}`, traceId: 't-ops' } });

export interface Tour {
  serviceId: string;
  commercialName: string;
  configuredCapacity: number;
  transportRequired: boolean;
}
export const RIVER: Tour = { serviceId: 'a1f4c8e2-5b73-4e09-9d16-0c8b2a7e3d65', commercialName: 'Caminata al cañón del río', configuredCapacity: 18, transportRequired: true };
export const COFFEE: Tour = { serviceId: 'b6d2e9a3-7c41-4a58-8f03-1e5c9b4d7a76', commercialName: 'Sendero del café', configuredCapacity: 8, transportRequired: false };
export const VAN = { vehicleId: 'd3a7b1f5-9e62-4c80-a4b7-6f2d0e8c5a87', name: 'Van VAN-201', capacity: 12 };
export const BUS = { vehicleId: 'e8c4d2a6-1b95-4f73-9c28-7a3e5b0d1f98', name: 'Bus BUS-301', capacity: 30 };

/** A departure as the service answers it (`GET /departures/{code}`); the list row is derived from it. */
export function departureOf(o: Record<string, unknown> = {}) {
  const start = (o.start as string | undefined) ?? wallIn(24);
  const end = (o.end as string | undefined) ?? wallIn(28);
  const { start: _s, end: _e, ...rest } = o;
  return {
    code: 'SAL-101',
    serviceId: RIVER.serviceId,
    status: 'SCHEDULED',
    scheduledStart: instantOf(start),
    scheduledEnd: instantOf(end),
    timeZone: ZONE,
    capacity: 12,
    booked: 3,
    interrupted: false,
    pendingRegularization: false,
    startAlert: false,
    transportRequired: true,
    tourCapacity: RIVER.configuredCapacity,
    vehicles: [{ vehicleId: VAN.vehicleId, name: VAN.name }],
    reservations: [],
    ...rest,
  };
}
export type DepartureAnswer = ReturnType<typeof departureOf>;

export const rowOf = (d: DepartureAnswer) => ({
  code: d.code,
  serviceId: d.serviceId,
  status: d.status,
  pendingRegularization: d.pendingRegularization,
  startAlert: d.startAlert,
  scheduledStart: d.scheduledStart,
  scheduledEnd: d.scheduledEnd,
  timeZone: d.timeZone,
  capacity: d.capacity,
  booked: d.booked,
  vehicles: d.vehicles.map((v) => ({ vehicleId: v.vehicleId })),
});

export interface Opening {
  roles?: string[];
  permissions?: string[];
  departures?: DepartureAnswer[];
  tours?: Tour[];
  vehicles?: (typeof VAN)[];
}

const unstubbed = new WeakMap<Page, string[]>();

/** The calls to the API that no stub answered, as `METHOD path`; each was answered 404. */
export const unstubbedCalls = (page: Page): string[] => unstubbed.get(page) ?? [];

/** Fails when the module made a call no stub of the test answers: the answers of the test are the whole API the story sees. */
export function expectNoUnstubbedCalls(page: Page): void {
  expect(unstubbedCalls(page)).toEqual([]);
}

const FORBIDDEN = { error: 'FORBIDDEN', message: 'stubbed FORBIDDEN', traceId: 't-ops' };

/**
 * Opens the Salidas area (`?area=departures`) of acme with a session of the given roles and permissions, the list, the catalog, the
 * vehicles and the zone of the tenant stubbed, each departure readable by its code and its (empty) cost sheet.
 * A call no stub answers is recorded (see expectNoUnstubbedCalls) and answered 404.
 */
export async function openDepartures(page: Page, o: Opening = {}): Promise<void> {
  const { roles = ['TENANT_ADMINISTRATOR'], permissions = roles.includes('TENANT_ADMINISTRATOR') ? ADMIN_PERMISSIONS : [MANAGE], departures = [], tours = [RIVER, COFFEE], vehicles = [VAN, BUS] } = o;
  const log: string[] = [];
  unstubbed.set(page, log);
  await page.route(
    (url) => url.pathname.startsWith('/api/v1/'),
    (route) => {
      log.push(`${route.request().method()} ${new URL(route.request().url()).pathname}`);
      return route.fulfill({ status: 404, json: { error: 'NOT_FOUND', message: 'not stubbed', traceId: 't-ops' } });
    },
  );
  await answer(page, 'GET', `${OPS}/departures`, 200, pageOf(departures.map(rowOf)));
  await answer(page, 'GET', '/api/v1/commercial-reservation/catalog/services', 200, pageOf(tours));
  await answer(page, 'GET', `${OPS}/vehicles`, 200, pageOf(vehicles));
  await answer(page, 'GET', '/api/v1/identity-audit/tenant/localization', 200, { timeZone: ZONE });
  for (const d of departures) {
    await answer(page, 'GET', `${OPS}/departures/${d.code}`, 200, d);
    // A departure that starts or is regularized during the test shows its costs next: an empty sheet, unless the test answers its own.
    await answer(page, 'GET', `${OPS}/departures/${d.code}/costs`, 200, { data: [], totalCents: 0, travelersServed: (d as { travelersServed?: number }).travelersServed ?? 0 });
  }
  if (!roles.includes('TENANT_ADMINISTRATOR')) {
    // The routes of the Administrator only: the vehicles, scheduling, adding vehicles and the two sagas (registered last, so they answer first).
    await page.route(
      (url) => url.pathname.startsWith('/api/v1/'),
      (route) => {
        const { pathname } = new URL(route.request().url());
        const post = route.request().method() === 'POST';
        const adminOnly =
          pathname === `${OPS}/vehicles` || pathname.startsWith('/api/v1/sagas/') || (post && (pathname === `${OPS}/departures` || /^\/api\/v1\/operations-cost\/departures\/[^/]+\/vehicles$/.test(pathname)));
        return adminOnly ? route.fulfill({ status: 403, json: FORBIDDEN }) : route.fallback();
      },
    );
  }
  await openAreaAs(page, OPERATIONS, roles, { claims: { permissions } });
  // A link inside the page (no reload: the session lives in memory) to the Salidas area.
  await page.evaluate((path) => {
    history.pushState({}, '', path);
    dispatchEvent(new PopStateEvent('popstate'));
  }, `/t/acme/areas/${OPERATIONS}?area=departures`);
  await expect(area(page).getByRole('heading', { name: 'Salidas', exact: true }).or(area(page).getByText('No tienes acceso a las salidas.'))).toBeVisible();
}

export const area = (page: Page) => page.locator('app-remote-host');

/** Opens the page of one listed departure with the action of its row. */
export async function openDeparture(page: Page, code: string): Promise<void> {
  await area(page).getByRole('row').filter({ hasText: code }).getByRole('button').last().click();
  await expect(area(page).getByRole('heading', { name: 'Registrar ejecución de salida' })).toBeVisible();
  await expect(area(page).getByRole('heading', { name: code })).toBeVisible();
}

/** Replaces the answer of one departure (its page reads it again after a recording): the route added last answers first. */
export const answerDeparture = (page: Page, d: DepartureAnswer & Record<string, unknown>): Promise<void> => answer(page, 'GET', `${OPS}/departures/${d.code}`, 200, d);

import { expect, Page, Request } from '@playwright/test';
import { OPERATIONS, openAreaAs } from './lead-portals';

/**
 * The departures of the operations-cost portal walked with its real module (spec 006 of multi-tour-front, plan D-01): every call the
 * module makes is answered here, shaped as contract operations-cost.yaml 0.16.0 and the workflow change-departure-vehicles say.
 */
export const MANAGE = 'MANAGE_DEPARTURE_EXECUTION';
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
export const RIVER: Tour = { serviceId: 'srv-river', commercialName: 'Caminata al cañón del río', configuredCapacity: 18, transportRequired: true };
export const COFFEE: Tour = { serviceId: 'srv-coffee', commercialName: 'Sendero del café', configuredCapacity: 8, transportRequired: false };
export const VAN = { vehicleId: 'veh-van', name: 'Van VAN-201', capacity: 12 };
export const BUS = { vehicleId: 'veh-bus', name: 'Bus BUS-301', capacity: 30 };

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

/**
 * Opens the Salidas area (`?area=departures`) of acme with a session of the given roles and permissions, the list, the catalog, the
 * vehicles and the zone of the tenant stubbed, and each departure readable by its code. Any other call to the API answers 404: the
 * unsigned token of the test never reaches the services of the shared environment (RN-FE-61).
 */
export async function openDepartures(page: Page, o: Opening = {}): Promise<void> {
  const { roles = ['TENANT_ADMINISTRATOR'], permissions = [MANAGE], departures = [], tours = [RIVER, COFFEE], vehicles = [VAN, BUS] } = o;
  await page.route(
    (url) => url.pathname.startsWith('/api/v1/'),
    (route) => route.fulfill({ status: 404, json: { error: 'NOT_FOUND', message: 'not stubbed', traceId: 't-ops' } }),
  );
  await answer(page, 'GET', `${OPS}/departures`, 200, pageOf(departures.map(rowOf)));
  await answer(page, 'GET', '/api/v1/commercial-reservation/catalog/services', 200, pageOf(tours));
  await answer(page, 'GET', `${OPS}/vehicles`, 200, pageOf(vehicles));
  await answer(page, 'GET', '/api/v1/identity-audit/tenant/localization', 200, { timeZone: ZONE });
  for (const d of departures) await answer(page, 'GET', `${OPS}/departures/${d.code}`, 200, d);
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

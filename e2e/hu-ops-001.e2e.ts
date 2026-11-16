import { expect, test } from '@playwright/test';
import { area, COFFEE, departureOf, expectNoUnstubbedCalls, instantOf, nextRequest, openDepartures, OPS, pageOf, RIVER, rowOf, wallIn, ZONE } from './support/operations-departures';

// HU-OPS-001 (schedule the departures of a tour), code-corhuila/multi-tour-docs#187; spec 006 of multi-tour-front (HU-FRT-001, #202).
// The real module of operations-cost-portal in its Salidas area, the API answered by page.route. One criterion per test.
// Not covered here: AC5 (reservable a few seconds later: the event SalidaScheduled, delivered by job 7 and turned into a reservable
// departure by commercial-reservation; ScheduleDepartureRouteTest of multi-tour-operations-cost-api, multi-tour-worker-event-relay and
// DepartureEventsHttpTest of multi-tour-commercial-reservation-api).
// Not met by the module: AC3 and AC4 (changing the date or the time of a departure). The API does offer it (PUT /departures/{code}/schedule,
// contract 0.17.0), but the portal has no screen to edit a real departure: the Salidas area offers "Editar" only over its test data.
const SHOTS = 'test-results/hu-ops-001';

test('AC1 · the Administrator schedules a departure of a catalog tour with date, start and estimated end, and it is listed as Programada', async ({ page }) => {
  await openDepartures(page);
  await expect(area(page)).toContainText('No hay salidas con este filtro.');
  await area(page).getByRole('button', { name: 'Programar salida' }).click();
  await expect(area(page).getByRole('heading', { name: 'Programar salida' })).toBeVisible();
  const day = wallIn(48).slice(0, 10);
  await page.getByLabel('Tour', { exact: true }).selectOption({ label: COFFEE.commercialName });
  await page.getByLabel('Fecha').fill(day);
  await page.getByLabel('Hora de inicio programada').fill('08:00');
  await page.getByLabel('Hora de finalización estimada').fill('12:00');
  // A new departure starts Programada: the form says so before it is saved.
  await expect(page.getByLabel('Estado')).toHaveValue('Programada');
  const created = departureOf({ code: 'SAL-205', serviceId: COFFEE.serviceId, start: `${day}T08:00`, end: `${day}T12:00`, capacity: 8, booked: 0, vehicles: [], transportRequired: false });
  // The list read after the save has the new departure, as the service would answer it.
  let saved = false;
  await page.route(
    (url) => url.pathname === `${OPS}/departures`,
    (route) => {
      if (route.request().method() === 'POST') {
        saved = true;
        return route.fulfill({ status: 201, json: { code: 'SAL-205', status: 'SCHEDULED', booked: 0, vehicles: [] } });
      }
      return saved ? route.fulfill({ json: pageOf([rowOf(created)]) }) : route.fallback();
    },
  );
  const sent = nextRequest(page, 'POST', `${OPS}/departures`);
  await page.getByRole('button', { name: 'Guardar salida' }).click();
  const request = await sent;
  // The hours travel as instants of the zone of the tenant, with the zone; the tour is the one chosen.
  expect(request.postDataJSON()).toEqual({ serviceId: COFFEE.serviceId, scheduledStart: instantOf(`${day}T08:00`), scheduledEnd: instantOf(`${day}T12:00`), timeZone: ZONE });
  expect(request.headers()['idempotency-key']).toMatch(/^schedule:/);
  await expect(area(page).getByText(/^Salida SAL-205 programada/)).toHaveText(`Salida SAL-205 programada (${COFFEE.commercialName}, ${day} 08:00). Capacidad efectiva: 8.`);
  const row = area(page).getByRole('row').filter({ hasText: 'SAL-205' });
  await expect(row).toContainText('Programada');
  await expect(row).toContainText(`${day} 08:00`);
  await page.screenshot({ path: `${SHOTS}/ac1-programada.png`, fullPage: true });
  expectNoUnstubbedCalls(page);
});

test('AC2 · a departure of a tour without mandatory transport takes the capacity of the tour and asks for no vehicle', async ({ page }) => {
  await openDepartures(page);
  await area(page).getByRole('button', { name: 'Programar salida' }).click();
  await page.getByLabel('Tour', { exact: true }).selectOption({ label: RIVER.commercialName });
  // A tour with transport offers its vehicles; the tour without transport offers none and keeps its own capacity.
  await expect(area(page).getByRole('checkbox')).toHaveCount(2);
  await page.getByLabel('Tour', { exact: true }).selectOption({ label: COFFEE.commercialName });
  await expect(area(page)).toContainText('Este tour no usa transporte: no necesita vehículos.');
  await expect(area(page)).toContainText(`Capacidad de la salida: ${COFFEE.configuredCapacity} viajeros (la del tour).`);
  await expect(area(page).getByRole('checkbox')).toHaveCount(0);
  await page.screenshot({ path: `${SHOTS}/ac2-sin-transporte.png`, fullPage: true });
  expectNoUnstubbedCalls(page);
});

test('AC6 · each state is shown as the service says it, and only Programada and En ejecución open the execution; the others open their record', async ({ page }) => {
  const at = (code: string, status: string) => departureOf({ code, status });
  await openDepartures(page, { departures: [at('SAL-101', 'SCHEDULED'), at('SAL-102', 'IN_EXECUTION'), at('SAL-103', 'FINISHED'), at('SAL-104', 'CANCELLED')] });
  const row = (code: string) => area(page).getByRole('row').filter({ hasText: code });
  await expect(row('SAL-101')).toContainText('Programada');
  await expect(row('SAL-101').getByRole('button')).toHaveText(['Registrar ejecución']);
  await expect(row('SAL-102')).toContainText('En ejecución');
  await expect(row('SAL-102').getByRole('button')).toHaveText(['Gestionar ejecución']);
  await expect(row('SAL-103')).toContainText('Finalizada');
  await expect(row('SAL-103').getByRole('button')).toHaveText(['Ver registro']);
  await expect(row('SAL-104')).toContainText('Cancelada');
  await expect(row('SAL-104').getByRole('button')).toHaveText(['Ver registro']);
  await page.getByLabel('Mostrar').selectOption({ label: 'Programada' });
  await expect(area(page).getByRole('row')).toHaveCount(2);
  await expect(row('SAL-101')).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/ac6-estados.png`, fullPage: true });
  expectNoUnstubbedCalls(page);
});

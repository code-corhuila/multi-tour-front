import { expect, Page, test } from '@playwright/test';
import { answer, area, BUS, COFFEE, departureOf, nextRequest, openDeparture, openDepartures, OPS, pageOf, refusal, RIVER, VAN, wallIn } from './support/operations-departures';

// HU-OPS-002 (assign and change the vehicles of a departure), code-corhuila/multi-tour-docs#188; spec 006 of multi-tour-front
// (HU-FRT-001, #202). The real module of operations-cost-portal, the API and the saga answered by page.route. One criterion per test.
// Not covered here: the order of AC4 (commercial-reservation lowers its ceiling first, operations-cost applies the change, and a
// failure of the second step restores the ceiling): the saga change-departure-vehicles decides it, covered by the tests of
// multi-tour-workflow-change-departure-vehicles; this file walks what the panel sends and shows for each answer of the saga.
// AC5 (the reservation side sees the new capacity): the event SalidaVehiclesChanged, delivered by job 7 and read by
// DepartureEventsHttpTest of multi-tour-commercial-reservation-api.
const SHOTS = 'test-results/hu-ops-002';
const VEHICLE_SAGA = '/api/v1/sagas/change-departure-vehicles';
const panel = (page: Page, name: string) => area(page).getByRole('region', { name, exact: true });

test('AC1 · the Administrator registers a vehicle with its capacity and it is listed, ready to assign', async ({ page }) => {
  await openDepartures(page, { vehicles: [VAN] });
  const vehicles = panel(page, 'Vehículos');
  await expect(vehicles).toContainText(`${VAN.name} · 12 viajeros`);
  // The service lists the new vehicle from then on, as it would.
  const registered = { vehicleId: 'veh-new', name: 'Buseta BUS-410', capacity: 20 };
  const fleet = [VAN];
  await page.route(
    (url) => url.pathname === `${OPS}/vehicles`,
    (route) => {
      if (route.request().method() !== 'POST') return route.fulfill({ json: pageOf(fleet) });
      fleet.push(registered);
      return route.fulfill({ status: 201, json: registered });
    },
  );
  const sent = nextRequest(page, 'POST', `${OPS}/vehicles`);
  await page.getByLabel('Nombre del vehículo').fill('Buseta BUS-410');
  await page.getByLabel('Capacidad (viajeros)').fill('20');
  await page.getByRole('button', { name: 'Registrar vehículo' }).click();
  const request = await sent;
  expect(request.postDataJSON()).toEqual({ name: 'Buseta BUS-410', capacity: 20 });
  expect(request.headers()['idempotency-key']).toMatch(/^vehicle:/);
  await expect(vehicles.getByRole('status')).toHaveText('Vehículo registrado.');
  await expect(vehicles.getByRole('listitem')).toHaveText(['Buseta BUS-410 · 20 viajeros', `${VAN.name} · 12 viajeros`]);
  // The new vehicle is offered at once to a departure of a tour with transport.
  await area(page).getByRole('button', { name: 'Programar salida' }).click();
  await page.getByLabel('Tour', { exact: true }).selectOption({ label: RIVER.commercialName });
  await expect(area(page).getByRole('checkbox', { name: /Buseta BUS-410 · 20 viajeros/ })).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/ac1-vehiculo.png`, fullPage: true });
});

test('AC1 · a capacity out of range and a name already used are told beside their field', async ({ page }) => {
  await openDepartures(page, { vehicles: [VAN] });
  await page.getByLabel('Nombre del vehículo').fill(VAN.name);
  await page.getByLabel('Capacidad (viajeros)').fill('0');
  await page.getByRole('button', { name: 'Registrar vehículo' }).click();
  await expect(page.getByLabel('Capacidad (viajeros)')).toHaveAccessibleDescription('La capacidad es un número entero de 1 a 100.');
  const { status, body } = refusal(422, 'BUSINESS_RULE_VIOLATION');
  await answer(page, 'POST', `${OPS}/vehicles`, status, body);
  const answered = page.waitForResponse((r) => new URL(r.url()).pathname === `${OPS}/vehicles` && r.request().method() === 'POST');
  await page.getByLabel('Capacidad (viajeros)').fill('12');
  await page.getByRole('button', { name: 'Registrar vehículo' }).click();
  await answered;
  await expect(page.getByLabel('Nombre del vehículo')).toHaveAccessibleDescription('Ya existe un vehículo con ese nombre.');
  await expect(page.getByLabel('Nombre del vehículo')).toHaveValue(VAN.name);
  await page.screenshot({ path: `${SHOTS}/ac1-errores.png`, fullPage: true });
});

test('AC2 · while scheduling, the vehicles chosen add up and the effective capacity is the lower of the tour and their total', async ({ page }) => {
  await openDepartures(page);
  await area(page).getByRole('button', { name: 'Programar salida' }).click();
  const day = wallIn(48).slice(0, 10);
  await page.getByLabel('Tour', { exact: true }).selectOption({ label: RIVER.commercialName });
  await page.getByLabel('Fecha').fill(day);
  await page.getByLabel('Hora de inicio programada').fill('08:00');
  await page.getByLabel('Hora de finalización estimada').fill('12:00');
  await area(page).getByRole('checkbox', { name: /Van VAN-201/ }).check();
  await expect(area(page)).toContainText('Capacidad efectiva de la salida: 12 viajeros = menor entre el cupo del tour (18) y la capacidad acumulada de los vehículos (12)');
  await area(page).getByRole('checkbox', { name: /Bus BUS-301/ }).check();
  await expect(area(page)).toContainText('Capacidad efectiva de la salida: 18 viajeros = menor entre el cupo del tour (18) y la capacidad acumulada de los vehículos (42)');
  await answer(page, 'POST', `${OPS}/departures`, 201, { code: 'SAL-206', status: 'SCHEDULED', booked: 0, vehicles: [{ vehicleId: VAN.vehicleId }, { vehicleId: BUS.vehicleId }] });
  const sent = nextRequest(page, 'POST', `${OPS}/departures`);
  await page.getByRole('button', { name: 'Guardar salida' }).click();
  expect((await sent).postDataJSON().vehicleIds).toEqual([VAN.vehicleId, BUS.vehicleId]);
  await expect(area(page).getByText(/^Salida SAL-206 programada/)).toBeVisible();
  await expect(area(page).getByText(/^Salida SAL-206 programada/)).toContainText('Capacidad efectiva: 18.');
  await page.screenshot({ path: `${SHOTS}/ac2-capacidad.png`, fullPage: true });
});

test('AC2 · on a scheduled departure, "Agregar vehículos" adds one and the page shows the effective capacity the service answers', async ({ page }) => {
  const departure = departureOf();
  await openDepartures(page, { departures: [departure] });
  await openDeparture(page, 'SAL-101');
  await expect(area(page)).toContainText('12 cupos · 3 reservados');
  const add = panel(page, 'Agregar vehículos');
  // Only the vehicles not already on the departure are offered.
  await expect(add.getByRole('checkbox')).toHaveCount(1);
  await add.getByRole('checkbox', { name: /Bus BUS-301/ }).check();
  const added = { ...departure, capacity: 18, booked: 0, vehicles: [...departure.vehicles, { vehicleId: BUS.vehicleId, name: BUS.name }] };
  await answer(page, 'POST', `${OPS}/departures/SAL-101/vehicles`, 200, added);
  const sent = nextRequest(page, 'POST', `${OPS}/departures/SAL-101/vehicles`);
  await add.getByRole('button', { name: 'Agregar vehículos' }).click();
  expect((await sent).postDataJSON()).toEqual({ vehicleIds: [BUS.vehicleId] });
  await expect(add.getByRole('status')).toHaveText('Vehículos agregados. Capacidad efectiva: 18.');
  // The seats held stay the ones the page had: the answer of an addition does not read them.
  await expect(area(page)).toContainText('18 cupos · 3 reservados');
  await expect(area(page)).toContainText(`${VAN.name}, ${BUS.name}`);
  await page.screenshot({ path: `${SHOTS}/ac2-agregar.png`, fullPage: true });
});

test('AC3 · a vehicle already on a departure whose interval overlaps is marked and refused; with touching ends it is allowed', async ({ page }) => {
  const day = wallIn(48).slice(0, 10);
  await openDepartures(page, { departures: [departureOf({ start: `${day}T08:00`, end: `${day}T12:00` })] });
  await area(page).getByRole('button', { name: 'Programar salida' }).click();
  await page.getByLabel('Tour', { exact: true }).selectOption({ label: RIVER.commercialName });
  await page.getByLabel('Fecha').fill(day);
  await page.getByLabel('Hora de inicio programada').fill('10:00');
  await page.getByLabel('Hora de finalización estimada').fill('14:00');
  const van = area(page).getByRole('checkbox', { name: /Van VAN-201/ });
  await expect(van).toHaveAccessibleName(`${VAN.name} · 12 viajeros · ocupado en SAL-101`);
  await van.check();
  let posted = 0;
  page.on('request', (r) => r.method() === 'POST' && new URL(r.url()).pathname === `${OPS}/departures` && posted++);
  await page.getByRole('button', { name: 'Guardar salida' }).click();
  await expect(area(page).getByText(`El vehículo ${VAN.name} ya está asignado a SAL-101 en ese horario.`)).toBeVisible();
  expect(posted).toBe(0);
  await page.screenshot({ path: `${SHOTS}/ac3-cruce.png`, fullPage: true });
  // The same vehicle from the end of the other departure: the intervals only touch.
  await page.getByLabel('Hora de inicio programada').fill('12:00');
  await page.getByLabel('Hora de finalización estimada').fill('16:00');
  await expect(van).toHaveAccessibleName(`${VAN.name} · 12 viajeros`);
  await answer(page, 'POST', `${OPS}/departures`, 201, { code: 'SAL-207', status: 'SCHEDULED', booked: 0, vehicles: [{ vehicleId: VAN.vehicleId }] });
  const sent = nextRequest(page, 'POST', `${OPS}/departures`);
  await page.getByRole('button', { name: 'Guardar salida' }).click();
  expect((await sent).postDataJSON().vehicleIds).toEqual([VAN.vehicleId]);
  await expect(area(page).getByText(/^Salida SAL-207 programada/)).toBeVisible();
});

test('AC4 · "Cambiar vehículos" previews the new capacity, asks for at least one vehicle and tells a refusal of the saga: nothing changes', async ({ page }) => {
  await openDepartures(page, { departures: [departureOf({ booked: 10 })] });
  await openDeparture(page, 'SAL-101');
  const change = panel(page, 'Cambiar vehículos');
  await expect(change.getByRole('checkbox', { name: /Van VAN-201/ })).toBeChecked();
  await expect(change).toContainText('Capacidad con el nuevo conjunto: 12');
  await change.getByRole('checkbox', { name: /Van VAN-201/ }).uncheck();
  await change.getByRole('button', { name: 'Confirmar cambio' }).click();
  await expect(change.getByRole('group', { name: 'Vehículos de la salida' })).toHaveAccessibleDescription('Elige al menos un vehículo.');
  await change.getByRole('checkbox', { name: /Bus BUS-301/ }).check();
  await expect(change).toContainText('Capacidad con el nuevo conjunto: 18');
  await answer(page, 'POST', VEHICLE_SAGA, 201, { id: 'saga-veh-1', status: 'COMPENSATED', reason: 'SEATS_HELD' });
  const sent = nextRequest(page, 'POST', VEHICLE_SAGA);
  await change.getByRole('button', { name: 'Confirmar cambio' }).click();
  const request = await sent;
  // The whole new set goes to the saga, with a key of its own.
  expect(request.postDataJSON()).toEqual({ departureCode: 'SAL-101', vehicleIds: [BUS.vehicleId] });
  expect(request.headers()['idempotency-key']).toBeTruthy();
  await expect(change.getByRole('status')).toHaveText('Hay más cupos reservados que la nueva capacidad. No se cambió nada.');
  await expect(area(page)).toContainText('12 cupos · 10 reservados');
  await page.screenshot({ path: `${SHOTS}/ac4-rechazo.png`, fullPage: true });
});

test('AC4 · a change the saga completes shows the departure as it is now, with its new vehicles and capacity', async ({ page }) => {
  const departure = departureOf();
  await openDepartures(page, { departures: [departure] });
  await openDeparture(page, 'SAL-101');
  const change = panel(page, 'Cambiar vehículos');
  await change.getByRole('checkbox', { name: /Van VAN-201/ }).uncheck();
  await change.getByRole('checkbox', { name: /Bus BUS-301/ }).check();
  await answer(page, 'POST', VEHICLE_SAGA, 201, { id: 'saga-veh-2', status: 'COMPLETED' });
  // The departure is read again after the saga answers.
  await answer(page, 'GET', `${OPS}/departures/SAL-101`, 200, { ...departure, capacity: 18, vehicles: [{ vehicleId: BUS.vehicleId, name: BUS.name }] });
  await change.getByRole('button', { name: 'Confirmar cambio' }).click();
  await expect(change.getByRole('status')).toHaveText('Vehículos cambiados. Capacidad efectiva: 18.');
  await expect(area(page)).toContainText('18 cupos · 3 reservados');
  await page.screenshot({ path: `${SHOTS}/ac4-cambiado.png`, fullPage: true });
});

test('AC6 · a scheduled departure of a tour without mandatory transport offers neither adding nor changing vehicles', async ({ page }) => {
  await openDepartures(page, { departures: [departureOf({ serviceId: COFFEE.serviceId, transportRequired: false, tourCapacity: 8, capacity: 8, vehicles: [] })] });
  await openDeparture(page, 'SAL-101');
  await expect(area(page)).toContainText('8 cupos · 3 reservados');
  await expect(area(page).getByRole('region', { name: 'Registrar el inicio real' })).toBeVisible();
  await expect(panel(page, 'Agregar vehículos')).toHaveCount(0);
  await expect(panel(page, 'Cambiar vehículos')).toHaveCount(0);
  await page.screenshot({ path: `${SHOTS}/ac6-sin-transporte.png`, fullPage: true });
});

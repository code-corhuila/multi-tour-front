import { expect, Page, test } from '@playwright/test';
import { answer, area, departureOf, instantOf, nextRequest, openDeparture, openDepartures, OPS, wallIn } from './support/operations-departures';

// HU-OPS-004 (record the delivered and the undelivered services), code-corhuila/multi-tour-docs#190; spec 006 of multi-tour-front
// (HU-FRT-001, #202). The real module of operations-cost-portal on the page of a departure, the API answered by page.route.
// Not covered here: the costs and the reports calculated on the real base (AC4, second half): the service computes the travelers served
// (multi-tour-operations-cost-api) and cash-reporting reads them for its reports (multi-tour-cash-reporting-api); this file walks the real
// base the page shows next to what was reserved and in the cost sheet.
const SHOTS = 'test-results/hu-ops-004';
const panel = (page: Page, name: string) => area(page).getByRole('region', { name, exact: true });
const reservationsOf = (page: Page) => panel(page, 'Lo reservado y lo efectivamente prestado');
const ANA = { reservationId: 'RES-1', customer: 'Ana Ruiz', travelers: 2, state: 'IN_EXECUTION' };
const LUIS = { reservationId: 'RES-2', customer: 'Luis Gómez', travelers: 3, state: 'IN_EXECUTION' };
const running = (o: Record<string, unknown> = {}) =>
  departureOf({ start: wallIn(-2), end: wallIn(2), status: 'IN_EXECUTION', actualStart: instantOf(wallIn(-2)), reservations: [ANA, LUIS], ...o });
const SERVICES = `${OPS}/departures/SAL-101/services`;

test('AC1 · once the departure started, its services are marked delivered with the travelers served; before the start they cannot be', async ({ page }) => {
  await openDepartures(page, { departures: [running(), departureOf({ code: 'SAL-102', reservations: [{ ...ANA, state: 'ELIGIBLE' }] })] });
  await openDeparture(page, 'SAL-102');
  await expect(reservationsOf(page)).toContainText('Ana Ruiz');
  await expect(reservationsOf(page).getByRole('button', { name: 'Guardar servicios' })).toHaveCount(0);
  await area(page).getByRole('button', { name: 'Volver a salidas' }).click();
  await openDeparture(page, 'SAL-101');
  await expect(page.locator('#result-RES-1')).toHaveValue('DELIVERED');
  await expect(page.locator('#served-RES-1')).toHaveValue('2');
  await page.locator('#served-RES-2').fill('3');
  const delivered = running({ reservations: [{ ...ANA, result: 'DELIVERED', travelersServed: 2 }, { ...LUIS, result: 'DELIVERED', travelersServed: 3 }], travelersServed: 5 });
  await answer(page, 'POST', SERVICES, 200, delivered);
  const sent = nextRequest(page, 'POST', SERVICES);
  await page.getByRole('button', { name: 'Guardar servicios' }).click();
  expect((await sent).postDataJSON()).toEqual({
    services: [
      { reservationId: 'RES-1', result: 'DELIVERED', travelersServed: 2 },
      { reservationId: 'RES-2', result: 'DELIVERED', travelersServed: 3 },
    ],
  });
  await expect(reservationsOf(page).getByRole('status')).toHaveText('Servicios guardados.');
  await expect(reservationsOf(page)).toContainText('Reservado: 2 · Ejecutado: 2');
  await expect(reservationsOf(page)).toContainText('Reservado: 3 · Ejecutado: 3');
  await page.screenshot({ path: `${SHOTS}/ac1-prestados.png`, fullPage: true });
});

test('AC2 · the page tells the tolerance of up to 10 minutes, and a no-show without notice is sent as such and stays charged', async ({ page }) => {
  await openDepartures(page, { departures: [running()] });
  await openDeparture(page, 'SAL-101');
  await expect(reservationsOf(page)).toContainText('el guía puede conceder hasta 10 minutos antes de iniciar; transcurridos, el servicio se mantiene cobrado.');
  await page.locator('#noshow-RES-2').check();
  await expect(reservationsOf(page)).toContainText('El servicio se mantiene cobrado.');
  await page.locator('#cause-RES-2').fill('No se presentó y no avisó');
  const recorded = running({ reservations: [{ ...ANA, result: 'DELIVERED', travelersServed: 2 }, { ...LUIS, result: 'NOT_DELIVERED', travelersServed: 0, noShow: true, cause: 'No se presentó y no avisó' }] });
  await answer(page, 'POST', SERVICES, 200, recorded);
  const sent = nextRequest(page, 'POST', SERVICES);
  await page.getByRole('button', { name: 'Guardar servicios' }).click();
  expect((await sent).postDataJSON().services[1]).toEqual({ reservationId: 'RES-2', result: 'NOT_DELIVERED', travelersServed: 0, noShow: true, cause: 'No se presentó y no avisó' });
  await expect(reservationsOf(page)).toContainText('Reservado: 3 · Ejecutado: 0 · No prestado: No se presentó y no avisó · Sin aviso: el servicio se mantiene cobrado');
  await page.screenshot({ path: `${SHOTS}/ac2-no-show.png`, fullPage: true });
});

test('AC3 · an undelivered service needs its cause, and once recorded it stays visible with that cause', async ({ page }) => {
  await openDepartures(page, { departures: [running()] });
  await openDeparture(page, 'SAL-101');
  await page.locator('#result-RES-2').selectOption('NOT_DELIVERED');
  await page.getByRole('button', { name: 'Guardar servicios' }).click();
  await expect(page.locator('#cause-RES-2')).toHaveAccessibleDescription('La causal es obligatoria para un servicio no prestado.');
  await page.locator('#cause-RES-2').fill('Lancha averiada en el muelle');
  const recorded = running({ reservations: [{ ...ANA, result: 'DELIVERED', travelersServed: 2 }, { ...LUIS, result: 'NOT_DELIVERED', travelersServed: 0, cause: 'Lancha averiada en el muelle' }] });
  await answer(page, 'POST', SERVICES, 200, recorded);
  const sent = nextRequest(page, 'POST', SERVICES);
  await page.getByRole('button', { name: 'Guardar servicios' }).click();
  expect((await sent).postDataJSON().services[1]).toEqual({ reservationId: 'RES-2', result: 'NOT_DELIVERED', travelersServed: 0, cause: 'Lancha averiada en el muelle' });
  await expect(reservationsOf(page)).toContainText('Reservado: 3 · Ejecutado: 0 · No prestado: Lancha averiada en el muelle');
  await page.screenshot({ path: `${SHOTS}/ac3-no-prestado.png`, fullPage: true });
});

test('AC4 · the real base is what was delivered: the page shows the travelers served next to the reserved ones and in the cost sheet', async ({ page }) => {
  const departure = running({
    reservations: [{ ...ANA, result: 'DELIVERED', travelersServed: 2 }, { ...LUIS, result: 'DELIVERED', travelersServed: 1, cause: 'Dos viajeros no continuaron' }],
    travelersServed: 3,
  });
  await openDepartures(page, { departures: [departure] });
  await answer(page, 'GET', `${OPS}/departures/SAL-101/costs`, 200, { data: [], totalCents: 0, travelersServed: 3, baseCostCents: 2_000_000 });
  await openDeparture(page, 'SAL-101');
  await expect(panel(page, 'SAL-101')).toContainText('Atendidos 3 de 5 reservados');
  await expect(reservationsOf(page)).toContainText('Reservado: 3 · Ejecutado: 1');
  const costs = panel(page, 'Registro real de la ejecución');
  await expect(costs).toContainText('Viajeros atendidos: 3');
  await expect(costs).toContainText('Costo parametrizado × viajeros atendidos: $ 20.000 × 3 = $ 60.000');
  await page.screenshot({ path: `${SHOTS}/ac4-base-real.png`, fullPage: true });
});

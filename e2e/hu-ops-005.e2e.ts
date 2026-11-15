import { expect, Page, test } from '@playwright/test';
import { ACCOUNT, answer, area, departureOf, expectNoUnstubbedCalls, instantOf, MANAGE, nextRequest, openDeparture, openDepartures, OPS, refusal, RES_1, wallIn } from './support/operations-departures';

// HU-OPS-005 (block ordinary adjustments and record an extraordinary cancellation), code-corhuila/multi-tour-docs#191; spec 006 of
// multi-tour-front (HU-FRT-001, #202). The real module of operations-cost-portal on the page of a departure, the API answered by page.route.
// Not covered here: blocking a change of the tour or of the number of people of a reservation En ejecución (AC1) and of its companions or
// associated services (AC2): the reservation is changed in commercial-reservation, which refuses it (HU-COM-012, its tests in
// multi-tour-commercial-reservation-api); this file walks the transport of the departure, which this portal changes. The decision to
// reschedule or to refund after an extraordinary cancellation (AC3) is taken in commercial-reservation (HU-COM-015, HU-COM-016).
const SHOTS = 'test-results/hu-ops-005';
const panel = (page: Page, name: string) => area(page).getByRole('region', { name, exact: true });
const ANA = { reservationId: RES_1, customer: 'Ana Ruiz', travelers: 2, state: 'IN_EXECUTION' };
const running = (o: Record<string, unknown> = {}) =>
  departureOf({ start: wallIn(-2), end: wallIn(2), status: 'IN_EXECUTION', actualStart: instantOf(wallIn(-2)), reservations: [ANA], ...o });
const CANCELLATION = `${OPS}/departures/SAL-101/reservations/${RES_1}/extraordinary-cancellation`;
const WHY = 'Fractura del viajero en el sendero, atendido por la ambulancia';

test('AC1 · once the departure is in execution, its transport is no longer offered to change and the page says no ordinary adjustment is allowed', async ({ page }) => {
  await openDepartures(page, { departures: [departureOf({ code: 'SAL-102' }), running()] });
  // A scheduled departure of the same tour still offers its vehicles; the one in execution does not.
  await openDeparture(page, 'SAL-102');
  await expect(panel(page, 'Cambiar vehículos')).toBeVisible();
  await area(page).getByRole('button', { name: 'Volver a salidas' }).click();
  await openDeparture(page, 'SAL-101');
  await expect(panel(page, 'SAL-101')).toContainText('En ejecución');
  await expect(panel(page, 'Agregar vehículos')).toHaveCount(0);
  await expect(panel(page, 'Cambiar vehículos')).toHaveCount(0);
  await expect(panel(page, 'Cancelar salida')).toHaveCount(0);
  await expect(panel(page, 'Lo reservado y lo efectivamente prestado')).toContainText('Una vez iniciada la salida no se permiten ajustes ordinarios.');
  await page.screenshot({ path: `${SHOTS}/ac1-en-ejecucion.png`, fullPage: true });
  expectNoUnstubbedCalls(page);
});

test('AC3 · an extraordinary cancellation of a reservation in execution needs its justification and a confirmation, and leaves the decision pending', async ({ page }) => {
  await openDepartures(page, { departures: [running()] });
  await openDeparture(page, 'SAL-101');
  await area(page).getByRole('button', { name: 'Cancelación extraordinaria' }).click();
  const field = page.getByLabel('Justificación de la cancelación extraordinaria');
  await page.getByRole('button', { name: 'Continuar' }).click();
  await expect(field).toHaveAccessibleDescription('Escribe la justificación de la emergencia (1 a 500 caracteres).');
  await field.fill(WHY);
  await page.getByRole('button', { name: 'Continuar' }).click();
  await expect(area(page)).toContainText('Vas a cancelar la reserva de Ana Ruiz. Esta acción no se puede deshacer.');
  const recordedAt = wallIn(0);
  await answer(page, 'POST', CANCELLATION, 200, running({
    reservations: [{ ...ANA, state: 'CANCELLED', extraordinaryCancellation: { justification: WHY, recordedBy: ACCOUNT, recordedAt: instantOf(recordedAt) } }],
  }));
  const sent = nextRequest(page, 'POST', CANCELLATION);
  await page.getByRole('button', { name: 'Confirmar cancelación' }).click();
  const request = await sent;
  expect(request.postDataJSON()).toEqual({ justification: WHY });
  expect(request.headers()['idempotency-key']).toBeTruthy();
  const reservations = panel(page, 'Lo reservado y lo efectivamente prestado');
  await expect(reservations).toContainText('Ana Ruiz · 2 viajeros Cancelada por emergencia (cancelación extraordinaria)');
  await expect(reservations.getByRole('group', { name: 'Cancelación extraordinaria de Ana Ruiz' })).toHaveText(
    `Cancelación extraordinaria: ${WHY} · ${recordedAt.replace('T', ' ')} · cuenta ${ACCOUNT}La decisión de reprogramar o reembolsar queda pendiente.`,
  );
  await expect(area(page).getByRole('button', { name: 'Cancelación extraordinaria' })).toHaveCount(0);
  await page.screenshot({ path: `${SHOTS}/ac3-cancelacion-extraordinaria.png`, fullPage: true });
  expectNoUnstubbedCalls(page);
});

test('AC4 · a collaborator without the permission Gestionar ejecución de salidas cannot reach the departure to cancel', async ({ page }) => {
  await openDepartures(page, { roles: ['OPERATIONAL_COLLABORATOR'], permissions: [], departures: [running()] });
  await expect(area(page)).toContainText('No tienes acceso a las salidas.');
  await expect(area(page).getByRole('button', { name: 'Cancelación extraordinaria' })).toHaveCount(0);
  await page.screenshot({ path: `${SHOTS}/ac4-sin-permiso.png`, fullPage: true });
  expectNoUnstubbedCalls(page);
});

// needs the fix of the portal (loads vehicles only for the Administrator)
test('AC4 · when the service denies the cancellation, the page says the permission is missing and keeps the justification', async ({ page }) => {
  await openDepartures(page, { roles: ['OPERATIONAL_COLLABORATOR'], permissions: [MANAGE], departures: [running()] });
  await openDeparture(page, 'SAL-101');
  await area(page).getByRole('button', { name: 'Cancelación extraordinaria' }).click();
  await page.getByLabel('Justificación de la cancelación extraordinaria').fill(WHY);
  await page.getByRole('button', { name: 'Continuar' }).click();
  const { status, body } = refusal(403, 'FORBIDDEN');
  await answer(page, 'POST', CANCELLATION, status, body);
  const answered = page.waitForResponse((r) => new URL(r.url()).pathname === CANCELLATION);
  await page.getByRole('button', { name: 'Confirmar cancelación' }).click();
  await answered;
  await expect(area(page).getByText('Tu usuario no tiene el permiso Gestionar ejecución de salidas. Tus datos siguen aquí.')).toBeVisible();
  await expect(area(page)).toContainText(`Justificación: ${WHY}`);
  await expect(panel(page, 'Lo reservado y lo efectivamente prestado')).toContainText('Ana Ruiz · 2 viajeros Reserva en ejecución');
  await page.screenshot({ path: `${SHOTS}/ac4-denegada.png`, fullPage: true });
  expectNoUnstubbedCalls(page);
});

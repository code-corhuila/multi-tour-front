import { expect, Page, test } from '@playwright/test';
import { answer, area, departureOf, instantOf, MANAGE, nextRequest, openDeparture, openDepartures, OPS, wallIn } from './support/operations-departures';

// HU-OPS-008 (record a personal emergency during a departure), code-corhuila/multi-tour-docs#194; spec 006 of multi-tour-front
// (HU-FRT-001, #202). The real module of operations-cost-portal on the page of a departure in execution, the API answered by page.route.
// Not covered here: the refundable amount and what follows from it (AC2: calculated at once under the policy of the service; AC3: $0 ends
// the reservation Finalizada with no refund; AC4: above $0 the refund is authorized automatically, pending execution within 5 business
// days): commercial-reservation decides them (HU-COM-016, its tests in multi-tour-commercial-reservation-api); the page does not show the
// amount by design (portal spec 014) and this file walks the record of the incident.
const SHOTS = 'test-results/hu-ops-008';
const panel = (page: Page, name: string) => area(page).getByRole('region', { name, exact: true });
const reservationsOf = (page: Page) => panel(page, 'Lo reservado y lo efectivamente prestado');
const ANA = { reservationId: 'RES-1', customer: 'Ana Ruiz', travelers: 2, state: 'IN_EXECUTION' };
const running = (o: Record<string, unknown> = {}) =>
  departureOf({ start: wallIn(-2), end: wallIn(2), status: 'IN_EXECUTION', actualStart: instantOf(wallIn(-2)), reservations: [ANA], ...o });
const NOVELTIES = `${OPS}/departures/SAL-101/novelties`;
const WHAT = 'Crisis de asma, regresa con un familiar';

/** Records the emergency of one traveler of Ana Ruiz through the form and its confirmation, and returns the request sent. */
async function recordEmergency(page: Page) {
  await reservationsOf(page).getByRole('button', { name: 'Emergencia personal' }).click();
  await page.getByLabel('Viajeros que no pueden continuar').fill('1');
  await page.getByLabel('Qué ocurrió').fill(WHAT);
  await page.getByRole('button', { name: 'Continuar' }).click();
  const sent = nextRequest(page, 'POST', NOVELTIES);
  await page.getByRole('button', { name: 'Confirmar emergencia' }).click();
  return sent;
}

test('AC1 · a personal emergency is recorded as an incident of the execution, after a confirmation, and the reservation is not cancelled', async ({ page }) => {
  await openDepartures(page, { departures: [running()] });
  await openDeparture(page, 'SAL-101');
  await reservationsOf(page).getByRole('button', { name: 'Emergencia personal' }).click();
  await page.getByRole('button', { name: 'Continuar' }).click();
  await expect(page.getByLabel('Viajeros que no pueden continuar')).toHaveAccessibleDescription('Indica cuántos viajeros no pueden continuar (de 1 a 2).');
  await expect(page.getByLabel('Qué ocurrió')).toHaveAccessibleDescription('Escribe qué ocurrió (1 a 1000 caracteres).');
  await page.getByLabel('Viajeros que no pueden continuar').fill('1');
  await page.getByLabel('Qué ocurrió').fill(WHAT);
  await page.getByRole('button', { name: 'Continuar' }).click();
  await expect(area(page)).toContainText(
    'Vas a registrar la emergencia personal de 1 viajero de Ana Ruiz. La reserva no se cancela: el sistema determina el reembolso que corresponda. Esta acción no se puede deshacer.',
  );
  const at = wallIn(0);
  await answer(page, 'POST', NOVELTIES, 201, running({
    novelties: [{ at: instantOf(at), type: 'PERSONAL_EMERGENCY', detail: WHAT, who: 'admin@acme.test', reservationId: 'RES-1', affected: 1 }],
  }));
  const sent = nextRequest(page, 'POST', NOVELTIES);
  await page.getByRole('button', { name: 'Confirmar emergencia' }).click();
  const request = await sent;
  expect(request.postDataJSON()).toEqual({ reservationId: 'RES-1', type: 'PERSONAL_EMERGENCY', detail: WHAT, affected: 1 });
  expect(request.headers()['idempotency-key']).toBeTruthy();
  await expect(reservationsOf(page).getByRole('group', { name: 'Emergencia personal de Ana Ruiz' })).toHaveText(
    `Emergencia personal: ${WHAT} · 1 viajero · ${at.replace('T', ' ')} · cuenta admin@acme.testLa reserva sigue en ejecución; el reembolso que corresponda lo determina el sistema.`,
  );
  await expect(reservationsOf(page)).toContainText('Ana Ruiz · 2 viajeros Reserva en ejecución');
  await expect(reservationsOf(page).getByRole('button', { name: 'Emergencia personal' })).toHaveCount(0);
  await page.screenshot({ path: `${SHOTS}/ac1-emergencia.png`, fullPage: true });
});

test('AC5 · an Administrator whose session lacks the permission Gestionar ejecución de salidas cannot reach the departure to record it', async ({ page }) => {
  await openDepartures(page, { permissions: [], departures: [running()] });
  await expect(area(page)).toContainText('No tienes acceso a las salidas.');
  await expect(area(page).getByRole('button', { name: 'Emergencia personal' })).toHaveCount(0);
  await page.screenshot({ path: `${SHOTS}/ac5-sin-permiso.png`, fullPage: true });
});

test('AC5 · a collaborator who holds the permission is offered the record and sends it; a denial of the service is told keeping the data', async ({ page }) => {
  await openDepartures(page, { roles: ['OPERATIONAL_COLLABORATOR'], permissions: [MANAGE], departures: [running()] });
  await openDeparture(page, 'SAL-101');
  await answer(page, 'POST', NOVELTIES, 403, { error: 'FORBIDDEN', message: 'stubbed FORBIDDEN', traceId: 't-ops' });
  expect((await recordEmergency(page)).postDataJSON()).toEqual({ reservationId: 'RES-1', type: 'PERSONAL_EMERGENCY', detail: WHAT, affected: 1 });
  await expect(area(page).getByText('Tu usuario no tiene el permiso Gestionar ejecución de salidas. Tus datos siguen aquí.')).toBeVisible();
  await expect(area(page)).toContainText(`Qué ocurrió: ${WHAT}`);
  await page.screenshot({ path: `${SHOTS}/ac5-denegada.png`, fullPage: true });
});

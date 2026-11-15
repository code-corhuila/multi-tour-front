import { expect, Page, test } from '@playwright/test';
import { ACCOUNT, answer, answerDeparture, area, departureOf, expectNoUnstubbedCalls, instantOf, MANAGE, nextRequest, openDeparture, openDepartures, OPS, wallIn } from './support/operations-departures';

// HU-OPS-006 (cancel a departure and handle its reservations), code-corhuila/multi-tour-docs#192; spec 006 of multi-tour-front
// (HU-FRT-001, #202). The real module of operations-cost-portal on the page of a departure, the API and the saga answered by page.route.
// Not covered here: the handling of each reservation of a cancelled departure (AC1: rescheduling or a 100 % refund; AC3: a pending
// proposal toward it voided and its seats freed; AC7: retried without duplicates and flagged when it keeps failing): the saga
// cancel-departure and commercial-reservation do it (multi-tour-workflow-cancel-departure, ReschedulingInternalHttpTest and
// VoidReschedulingProposalsTest of multi-tour-commercial-reservation-api); this file walks what the page asks and shows. AC6 (the
// automatic cancellation at an inactive tenant): job 3, multi-tour-worker-departure-deadlines.
// Not met by the module: AC2 (a change of date or time of a departure with reservations): the Salidas area offers "Editar" only over its
// test data, never over a departure of the service.
const SHOTS = 'test-results/hu-ops-006';
const panel = (page: Page, name: string) => area(page).getByRole('region', { name, exact: true });
const SAGA = '/api/v1/sagas/cancel-departure';

test('AC1 · the Administrator cancels a Programada departure after a confirmation that says it is final and how its reservations are handled', async ({ page }) => {
  const scheduled = departureOf();
  await openDepartures(page, { departures: [scheduled] });
  await openDeparture(page, 'SAL-101');
  await panel(page, 'Cancelar salida').getByRole('button', { name: 'Cancelar salida' }).click();
  await expect(panel(page, 'Cancelar salida')).toContainText(
    'Vas a cancelar la salida SAL-101. Esta acción no se puede deshacer. Sus reservas serán reprogramadas o reembolsadas al 100 %, porque la causa no es atribuible al cliente.',
  );
  const cancelledAt = wallIn(0);
  await answer(page, 'POST', SAGA, 201, { id: 'saga-cancel-1', status: 'COMPLETED' });
  // The departure is read again after the saga answers: it says what it is now.
  await answerDeparture(page, { ...scheduled, status: 'CANCELLED', cancellation: { cancelledAt: instantOf(cancelledAt), cancelledBy: ACCOUNT, cause: 'NOT_ATTRIBUTABLE_TO_CUSTOMER' } });
  const sent = nextRequest(page, 'POST', SAGA);
  await page.getByRole('button', { name: 'Confirmar cancelación' }).click();
  const request = await sent;
  expect(request.postDataJSON()).toEqual({ departureCode: 'SAL-101' });
  expect(request.headers()['idempotency-key']).toBeTruthy();
  await expect(panel(page, 'SAL-101')).toContainText('Cancelada');
  const record = panel(page, 'Cancelación');
  await expect(record).toContainText(`Cancelada el ${cancelledAt.replace('T', ' ')}`);
  await expect(record).toContainText(`Solicitada por ${ACCOUNT}`);
  await expect(record).toContainText('Motivo Causa no atribuible al cliente');
  // A cancellation is final: nothing on the page undoes it or starts the departure.
  await expect(panel(page, 'Cancelar salida')).toHaveCount(0);
  await expect(panel(page, 'Registrar el inicio real')).toHaveCount(0);
  await page.screenshot({ path: `${SHOTS}/ac1-cancelada.png`, fullPage: true });
  expectNoUnstubbedCalls(page);
});

test('AC4 · a collaborator, even with the permission Gestionar ejecución de salidas, is not offered to cancel a future Programada departure', async ({ page }) => {
  await openDepartures(page, { roles: ['OPERATIONAL_COLLABORATOR'], permissions: [MANAGE], departures: [departureOf()] });
  await openDeparture(page, 'SAL-101');
  await expect(panel(page, 'Registrar el inicio real')).toBeVisible();
  await expect(panel(page, 'Cancelar salida')).toHaveCount(0);
  await expect(area(page).getByRole('button', { name: 'Cancelar salida' })).toHaveCount(0);
  await page.screenshot({ path: `${SHOTS}/ac4-colaborador.png`, fullPage: true });
  expectNoUnstubbedCalls(page);
});

for (const [who, roles] of [
  ['the Administrator', ['TENANT_ADMINISTRATOR']],
  ['a collaborator with the permission', ['OPERATIONAL_COLLABORATOR']],
] as const) {
  test(`AC5 · ${who} regularizes a past departure that did not take place as not performed, with its cause, and it is Cancelada`, async ({ page }) => {
    const pending = departureOf({ start: wallIn(-6), end: wallIn(-2), pendingRegularization: true });
    await openDepartures(page, { roles: [...roles], permissions: [MANAGE], departures: [pending] });
    await openDeparture(page, 'SAL-101');
    await page.getByLabel('Resultado').selectOption({ label: 'No realizada (queda Cancelada)' });
    await page.getByRole('button', { name: 'Registrar regularización' }).click();
    const cause = page.getByLabel('Causal de la no realización');
    await expect(cause).toHaveAccessibleDescription('Ingresa la causal de la no realización.');
    await cause.fill('Cierre de la vía por la gobernación');
    const path = `${OPS}/departures/SAL-101/regularization`;
    await answer(page, 'POST', path, 200, {
      ...pending,
      status: 'CANCELLED',
      pendingRegularization: false,
      cancellation: { cancelledAt: instantOf(wallIn(0)), cancelledBy: ACCOUNT, cause: 'NOT_CARRIED_OUT', reason: 'Cierre de la vía por la gobernación' },
    });
    const sent = nextRequest(page, 'POST', path);
    await page.getByRole('button', { name: 'Registrar regularización' }).click();
    expect((await sent).postDataJSON()).toEqual({ result: 'NOT_CARRIED_OUT', notCarriedOutCause: 'Cierre de la vía por la gobernación' });
    await expect(panel(page, 'SAL-101')).toContainText('Cancelada');
    await expect(panel(page, 'Cancelación')).toContainText('Motivo Cierre de la vía por la gobernación');
    await page.screenshot({ path: `${SHOTS}/ac5-no-realizada-${roles[0].toLowerCase()}.png`, fullPage: true });
    expectNoUnstubbedCalls(page);
  });
}

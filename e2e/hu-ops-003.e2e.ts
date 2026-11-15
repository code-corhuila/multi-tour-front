import { expect, Page, test } from '@playwright/test';
import { answer, area, departureOf, expectNoUnstubbedCalls, instantOf, MANAGE, nextRequest, openDeparture, openDepartures, OPS, RES_1, RES_2, wallIn } from './support/operations-departures';

// HU-OPS-003 (record the start and the end of a departure), code-corhuila/multi-tour-docs#189; spec 006 of multi-tour-front (HU-FRT-001,
// #202). The real module of operations-cost-portal, the API answered by page.route. One criterion per test.
// Not covered here: which reservations move when the start or the end is recorded (AC1: only Confirmada with Pago completo go to En
// ejecución; AC5: En ejecución become Finalizada) and how the reservations of an interrupted departure are handled (AC6, RN-EJE-002):
// commercial-reservation decides them (HU-COM-010, HU-COM-016, HU-COM-018, its tests in multi-tour-commercial-reservation-api); this file
// walks what the page sends and shows the states the service answers. The audit of a regularization (AC2): gap G-API5-5 of api spec 005.
const SHOTS = 'test-results/hu-ops-003';
const panel = (page: Page, name: string) => area(page).getByRole('region', { name, exact: true });
const shown = (wall: string) => wall.replace('T', ' ');
const ANA = { reservationId: RES_1, customer: 'Ana Ruiz', travelers: 2, state: 'ELIGIBLE' };
const LUIS = { reservationId: RES_2, customer: 'Luis Gómez', travelers: 3, state: 'NOT_ELIGIBLE' };
// A departure whose scheduled start passed two hours ago and whose estimated end is two hours ahead.
const due = (o: Record<string, unknown> = {}) => departureOf({ start: wallIn(-2), end: wallIn(2), reservations: [ANA, LUIS], ...o });
const running = (o: Record<string, unknown> = {}) =>
  due({ status: 'IN_EXECUTION', actualStart: instantOf(wallIn(-2)), reservations: [{ ...ANA, state: 'IN_EXECUTION' }, { ...LUIS, state: 'CANCELLED' }], ...o });

test('AC1 · the real start is sent, and the page shows the departure En ejecución with the reservations as the service moved them', async ({ page }) => {
  await openDepartures(page, { departures: [due()] });
  await openDeparture(page, 'SAL-101');
  const reservations = panel(page, 'Lo reservado y lo efectivamente prestado');
  await expect(reservations).toContainText(`#${RES_1} · Ana Ruiz · 2 viajeros Elegible para iniciar`);
  await expect(reservations).toContainText(`#${RES_2} · Luis Gómez · 3 viajeros No elegible (pago pendiente)`);
  const startedAt = wallIn(-1);
  await answer(page, 'POST', `${OPS}/departures/SAL-101/executions`, 201, running({ actualStart: instantOf(startedAt) }));
  const sent = nextRequest(page, 'POST', `${OPS}/departures/SAL-101/executions`);
  await page.getByLabel('Hora de inicio real').fill(startedAt);
  await page.getByRole('button', { name: 'Registrar inicio real' }).click();
  const request = await sent;
  expect(request.postDataJSON()).toEqual({ startedAt: instantOf(startedAt) });
  expect(request.headers()['idempotency-key']).toBeTruthy();
  await expect(panel(page, 'SAL-101')).toContainText('En ejecución');
  await expect(panel(page, 'SAL-101')).toContainText(`Inicio real ${shown(startedAt)}`);
  await expect(reservations).toContainText('Ana Ruiz · 2 viajeros Reserva en ejecución');
  await expect(reservations).toContainText('Luis Gómez · 3 viajeros Cancelada por incumplimiento de pago');
  await page.screenshot({ path: `${SHOTS}/ac1-inicio.png`, fullPage: true });
  expectNoUnstubbedCalls(page);
});

test('AC2 · a real start earlier than the scheduled one, or in the future, is refused beside the field and nothing is sent', async ({ page }) => {
  await openDepartures(page, { departures: [due()] });
  await openDeparture(page, 'SAL-101');
  let sent = 0;
  page.on('request', (r) => r.method() === 'POST' && r.url().includes('/executions') && sent++);
  const field = page.getByLabel('Hora de inicio real');
  await field.fill(wallIn(-3));
  await page.getByRole('button', { name: 'Registrar inicio real' }).click();
  await expect(field).toHaveAccessibleDescription('El inicio real no puede ser anterior a la hora programada.');
  await field.fill(wallIn(1));
  await page.getByRole('button', { name: 'Registrar inicio real' }).click();
  await expect(field).toHaveAccessibleDescription('El inicio real no puede ser posterior a este momento.');
  expect(sent).toBe(0);
  await page.screenshot({ path: `${SHOTS}/ac2-inicio-anterior.png`, fullPage: true });
  expectNoUnstubbedCalls(page);
});

test('AC2 · in a regularization, a start earlier than the scheduled one is accepted only with its reason, which is sent', async ({ page }) => {
  const pending = departureOf({ start: wallIn(-6), end: wallIn(-2), pendingRegularization: true });
  await openDepartures(page, { departures: [pending] });
  await openDeparture(page, 'SAL-101');
  const startedAt = wallIn(-7);
  const finishedAt = wallIn(-3);
  await page.getByLabel('Resultado').selectOption({ label: 'Ejecutada y finalizada' });
  await page.getByLabel('Hora de inicio real').fill(startedAt);
  await page.getByLabel('Hora de finalización real').fill(finishedAt);
  await page.getByRole('button', { name: 'Registrar regularización' }).click();
  const reason = page.getByLabel('Motivo si la hora real de inicio es anterior a la programada');
  await expect(reason).toHaveAccessibleDescription('Ingresa el motivo: el inicio real es anterior al programado.');
  await reason.fill('El grupo llegó antes y el guía adelantó la salida');
  await answer(page, 'POST', `${OPS}/departures/SAL-101/regularization`, 200, { ...pending, status: 'FINISHED', pendingRegularization: false, actualStart: instantOf(startedAt), actualEnd: instantOf(finishedAt) });
  const sent = nextRequest(page, 'POST', `${OPS}/departures/SAL-101/regularization`);
  await page.getByRole('button', { name: 'Registrar regularización' }).click();
  expect((await sent).postDataJSON()).toEqual({
    result: 'EXECUTED',
    actualStart: instantOf(startedAt),
    actualEnd: instantOf(finishedAt),
    earlyStartReason: 'El grupo llegó antes y el guía adelantó la salida',
  });
  await expect(panel(page, 'SAL-101')).toContainText('Finalizada');
  await page.screenshot({ path: `${SHOTS}/ac2-regularizacion-anticipada.png`, fullPage: true });
  expectNoUnstubbedCalls(page);
});

// needs the fix of the portal (loads vehicles only for the Administrator)
for (const [who, roles] of [
  ['the Administrator', ['TENANT_ADMINISTRATOR']],
  ['a collaborator with the permission', ['OPERATIONAL_COLLABORATOR']],
] as const) {
  test(`AC3 · ${who} sees the alert of a Programada departure whose scheduled start passed, in the list and on its page`, async ({ page }) => {
    await openDepartures(page, { roles: [...roles], permissions: [MANAGE], departures: [due({ startAlert: true })] });
    await expect(area(page).getByRole('row').filter({ hasText: 'SAL-101' })).toContainText('Sin inicio registrado');
    await expect(area(page).getByRole('heading', { name: 'Salidas sin cierre operativo' })).toBeVisible();
    await openDeparture(page, 'SAL-101');
    await expect(panel(page, 'SAL-101').getByRole('alert')).toHaveText(
      'La hora programada de inicio ya pasó y nadie registró el inicio. Registra el inicio real cuando ocurra.',
    );
    await expect(panel(page, 'SAL-101')).toContainText('Programada');
    await page.screenshot({ path: `${SHOTS}/ac3-alerta-${roles[0].toLowerCase()}.png`, fullPage: true });
    expectNoUnstubbedCalls(page);
  });
}

test('AC4 · a departure past its estimated end is marked pending, is not closed by time, and is regularized with its real hours', async ({ page }) => {
  const pending = departureOf({ start: wallIn(-6), end: wallIn(-2), pendingRegularization: true });
  await openDepartures(page, { departures: [pending] });
  const row = area(page).getByRole('row').filter({ hasText: 'SAL-101' });
  await expect(row).toContainText('Programada');
  await expect(row).toContainText('Pendiente de regularizar');
  await expect(row.getByRole('button')).toHaveText(['Regularizar']);
  await openDeparture(page, 'SAL-101');
  await expect(panel(page, 'SAL-101')).toContainText('Pendiente de regularización');
  // The three ways out the story names, and no ordinary start over a departure that is past its end.
  await expect(page.getByLabel('Resultado').locator('option')).toHaveText([
    'Selecciona una opción',
    'Ejecutada y finalizada',
    'Interrumpida (termina Finalizada)',
    'No realizada (queda Cancelada)',
  ]);
  await expect(panel(page, 'Registrar el inicio real')).toHaveCount(0);
  const startedAt = wallIn(-5);
  const finishedAt = wallIn(-2.5);
  await page.getByLabel('Resultado').selectOption({ label: 'Ejecutada y finalizada' });
  await page.getByLabel('Hora de inicio real').fill(startedAt);
  await page.getByLabel('Hora de finalización real').fill(finishedAt);
  await expect(page.getByLabel('Motivo si la hora real de inicio es anterior a la programada')).toHaveCount(0);
  await answer(page, 'POST', `${OPS}/departures/SAL-101/regularization`, 200, { ...pending, status: 'FINISHED', pendingRegularization: false, actualStart: instantOf(startedAt), actualEnd: instantOf(finishedAt) });
  const sent = nextRequest(page, 'POST', `${OPS}/departures/SAL-101/regularization`);
  await page.getByRole('button', { name: 'Registrar regularización' }).click();
  expect((await sent).postDataJSON()).toEqual({ result: 'EXECUTED', actualStart: instantOf(startedAt), actualEnd: instantOf(finishedAt) });
  await expect(panel(page, 'SAL-101')).toContainText('Finalizada');
  await expect(panel(page, 'SAL-101')).toContainText(`Inicio real ${shown(startedAt)}`);
  await expect(panel(page, 'SAL-101')).toContainText(`Finalización real ${shown(finishedAt)}`);
  await page.screenshot({ path: `${SHOTS}/ac4-regularizada.png`, fullPage: true });
  expectNoUnstubbedCalls(page);
});

test('AC5 · the end of a departure in execution is sent, and the page shows it Finalizada with its reservations finished', async ({ page }) => {
  await openDepartures(page, { departures: [running()] });
  await openDeparture(page, 'SAL-101');
  const finishedAt = wallIn(-0.5);
  await answer(page, 'POST', `${OPS}/departures/SAL-101/finish`, 200, running({ status: 'FINISHED', actualEnd: instantOf(finishedAt), reservations: [{ ...ANA, state: 'FINISHED' }, { ...LUIS, state: 'CANCELLED' }] }));
  const sent = nextRequest(page, 'POST', `${OPS}/departures/SAL-101/finish`);
  await page.getByLabel('Hora de finalización real').fill(finishedAt);
  await page.getByRole('button', { name: 'Registrar finalización' }).click();
  expect((await sent).postDataJSON()).toEqual({ finishedAt: instantOf(finishedAt), result: 'FINISHED' });
  await expect(panel(page, 'SAL-101')).toContainText('Finalizada');
  await expect(panel(page, 'SAL-101')).toContainText(`Finalización real ${shown(finishedAt)}`);
  await expect(panel(page, 'Lo reservado y lo efectivamente prestado')).toContainText('Ana Ruiz · 2 viajeros Reserva finalizada');
  await page.screenshot({ path: `${SHOTS}/ac5-finalizada.png`, fullPage: true });
  expectNoUnstubbedCalls(page);
});

test('AC6 · an interruption needs its cause; it is sent and the departure ends Finalizada with the interruption recorded', async ({ page }) => {
  await openDepartures(page, { departures: [running()] });
  await openDeparture(page, 'SAL-101');
  const finishedAt = wallIn(-0.5);
  await page.getByLabel('Hora de finalización real').fill(finishedAt);
  await panel(page, 'Registrar la finalización o la interrupción').getByLabel('Resultado').selectOption({ label: 'Interrumpida (termina Finalizada)' });
  await page.getByRole('button', { name: 'Registrar finalización' }).click();
  const cause = page.getByLabel('Interrupción (causa y evidencia)');
  await expect(cause).toHaveAccessibleDescription('Ingresa la causa y la evidencia de la interrupción.');
  await cause.fill('Derrumbe en la vía, foto del guía');
  await answer(page, 'POST', `${OPS}/departures/SAL-101/finish`, 200, running({ status: 'FINISHED', actualEnd: instantOf(finishedAt), interrupted: true, interruptionCause: 'Derrumbe en la vía, foto del guía' }));
  const sent = nextRequest(page, 'POST', `${OPS}/departures/SAL-101/finish`);
  await page.getByRole('button', { name: 'Registrar finalización' }).click();
  expect((await sent).postDataJSON()).toEqual({ finishedAt: instantOf(finishedAt), result: 'INTERRUPTED', cause: 'Derrumbe en la vía, foto del guía' });
  await expect(panel(page, 'SAL-101')).toContainText('Finalizada');
  await expect(panel(page, 'SAL-101')).toContainText('Marca Interrumpida');
  await expect(panel(page, 'SAL-101')).toContainText('Causa de la interrupción Derrumbe en la vía, foto del guía');
  await page.screenshot({ path: `${SHOTS}/ac6-interrumpida.png`, fullPage: true });
  expectNoUnstubbedCalls(page);
});

// An Administrator with no permissions is not tested: security never issues that token, an Administrator always holds it by profile.
test('AC7 · a collaborator without the permission Gestionar ejecución de salidas cannot open the departures to record a start or an end', async ({ page }) => {
  await openDepartures(page, { roles: ['OPERATIONAL_COLLABORATOR'], permissions: [], departures: [due()] });
  await expect(area(page)).toContainText('No tienes acceso a las salidas.');
  await expect(area(page).getByRole('button', { name: /Registrar ejecución|Gestionar ejecución/ })).toHaveCount(0);
  await page.screenshot({ path: `${SHOTS}/ac7-sin-permiso.png`, fullPage: true });
  expectNoUnstubbedCalls(page);
});

// needs the fix of the portal (loads vehicles only for the Administrator)
test('AC7 · a collaborator who holds the permission records the start, and is not offered to schedule', async ({ page }) => {
  await openDepartures(page, { roles: ['OPERATIONAL_COLLABORATOR'], permissions: [MANAGE], departures: [due()] });
  await expect(area(page).getByRole('button', { name: 'Programar salida' })).toHaveCount(0);
  await openDeparture(page, 'SAL-101');
  const startedAt = wallIn(-1);
  await answer(page, 'POST', `${OPS}/departures/SAL-101/executions`, 201, running({ actualStart: instantOf(startedAt) }));
  const sent = nextRequest(page, 'POST', `${OPS}/departures/SAL-101/executions`);
  await page.getByLabel('Hora de inicio real').fill(startedAt);
  await page.getByRole('button', { name: 'Registrar inicio real' }).click();
  expect((await sent).postDataJSON()).toEqual({ startedAt: instantOf(startedAt) });
  await expect(panel(page, 'SAL-101')).toContainText('En ejecución');
  await page.screenshot({ path: `${SHOTS}/ac7-colaborador-con-permiso.png`, fullPage: true });
  expectNoUnstubbedCalls(page);
});

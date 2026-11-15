import { expect, Page, test } from '@playwright/test';
import { area, departureOf, expectNoUnstubbedCalls, instantOf, MANAGE, nextRequest, openDeparture, openDepartures, OPS, wallIn } from './support/operations-departures';

// HU-OPS-007 (record operational costs), code-corhuila/multi-tour-docs#193; spec 006 of multi-tour-front (HU-FRT-001, #202).
// The real module of operations-cost-portal in the panel "Costos operacionales" of a departure, the API answered by page.route.
// Not covered here: the amount of a calculated cost (AC2) is computed by the service from the parametrization and the travelers served
// (CostRoutesTest and OperationalCostTest of multi-tour-operations-cost-api); this file walks what the panel sends and shows.
const SHOTS = 'test-results/hu-ops-007';
const panel = (page: Page, name: string) => area(page).getByRole('region', { name, exact: true });
const costsOf = (page: Page) => panel(page, 'Registro real de la ejecución');
const COSTS = `${OPS}/departures/SAL-101/costs`;
const running = (o: Record<string, unknown> = {}) =>
  departureOf({ start: wallIn(-2), end: wallIn(2), status: 'IN_EXECUTION', actualStart: instantOf(wallIn(-2)), travelersServed: 4, ...o });
const line = (o: Record<string, unknown>) => ({ costId: 'cost-1', withoutParametrization: false, recordedAt: instantOf(wallIn(0)), ...o });

/** The cost sheet of SAL-101 as the service keeps it: each recorded cost answers 201 and is listed from then on. */
async function serveCosts(page: Page, sheet: { baseCostCents?: number; travelersServed: number }, recorded: Record<string, unknown>): Promise<void> {
  const lines: Record<string, unknown>[] = [];
  await page.route(
    (url) => url.pathname === COSTS,
    (route) => {
      if (route.request().method() === 'POST') {
        lines.push(recorded);
        return route.fulfill({ status: 201, json: recorded });
      }
      const totalCents = lines.reduce((sum, l) => sum + (l.amountCents as number), 0);
      return route.fulfill({ json: { data: lines, totalCents, ...sheet } });
    },
  );
}

test('AC1 · the real cost of a departure that started is recorded apart from the commercial value, and is listed with its total', async ({ page }) => {
  await openDepartures(page, { departures: [running()] });
  await serveCosts(page, { baseCostCents: 2_000_000, travelersServed: 4 }, line({ concept: 'Almuerzo del guía', mode: 'MANUAL', amountCents: 12_500_000 }));
  await openDeparture(page, 'SAL-101');
  const costs = costsOf(page);
  await expect(costs).toContainText('Los costos operacionales se registran para servicios ejecutados y se diferencian del valor comercial vendido.');
  await expect(costs).toContainText('Aún no hay costos registrados para esta salida.');
  await costs.getByLabel('Concepto').fill('Almuerzo del guía');
  await costs.getByLabel('Valor').fill('125.000');
  const sent = nextRequest(page, 'POST', COSTS);
  await costs.getByRole('button', { name: 'Registrar costo' }).click();
  const request = await sent;
  // The value typed in pesos travels as minor units, converted from the text.
  expect(request.postDataJSON()).toEqual({ concept: 'Almuerzo del guía', mode: 'MANUAL', amountCents: 12_500_000 });
  expect(request.headers()['idempotency-key']).toBeTruthy();
  await expect(costs.getByRole('status')).toHaveText('Costo registrado y asociado a la salida SAL-101.');
  await expect(costs.getByRole('row').filter({ hasText: 'Almuerzo del guía' })).toHaveText(/Almuerzo del guía\s*Gasto real\s*\$ 125\.000/);
  await expect(costs).toContainText('Total: $ 125.000');
  await page.screenshot({ path: `${SHOTS}/ac1-gasto-real.png`, fullPage: true });
  expectNoUnstubbedCalls(page);
});

// needs the fix of the portal (loads vehicles only for the Administrator)
test('AC2 · with a parametrized cost, a collaborator calculates it with the real number of travelers served; only the concept is sent', async ({ page }) => {
  await openDepartures(page, { roles: ['OPERATIONAL_COLLABORATOR'], permissions: [MANAGE], departures: [running()] });
  await serveCosts(page, { baseCostCents: 2_000_000, travelersServed: 4 }, line({ concept: 'Entrada al parque', mode: 'CALCULATED', amountCents: 8_000_000, unitCostCents: 2_000_000, travelersServed: 4 }));
  await openDeparture(page, 'SAL-101');
  const costs = costsOf(page);
  await expect(costs).toContainText('Costo parametrizado × viajeros atendidos: $ 20.000 × 4 = $ 80.000');
  await costs.getByLabel('Concepto').fill('Entrada al parque');
  const sent = nextRequest(page, 'POST', COSTS);
  await costs.getByRole('button', { name: 'Calcular con la parametrización' }).click();
  expect((await sent).postDataJSON()).toEqual({ concept: 'Entrada al parque', mode: 'CALCULATED' });
  await expect(costs.getByRole('row').filter({ hasText: 'Entrada al parque' })).toHaveText(/Entrada al parque\s*Calculado\s*\$ 80\.000/);
  await page.screenshot({ path: `${SHOTS}/ac2-calculado.png`, fullPage: true });
  expectNoUnstubbedCalls(page);
});

test('AC3 · without a parametrized cost there is no calculation, and a real expense needs its justification, which is sent', async ({ page }) => {
  await openDepartures(page, { departures: [running()] });
  await serveCosts(page, { travelersServed: 4 }, line({ concept: 'Transporte extra', mode: 'MANUAL', amountCents: 30_000_000, withoutParametrization: true, justification: 'Factura 118 del transportador' }));
  await openDeparture(page, 'SAL-101');
  const costs = costsOf(page);
  await expect(costs).toContainText('Este tour no tiene costo parametrizado: justifica el valor.');
  await expect(costs.getByRole('button', { name: 'Calcular con la parametrización' })).toHaveCount(0);
  await costs.getByLabel('Concepto').fill('Transporte extra');
  await costs.getByLabel('Valor').fill('300000');
  await costs.getByRole('button', { name: 'Registrar costo' }).click();
  await expect(costs.getByLabel('Justificación')).toHaveAccessibleDescription('Justifica el valor: el tour no tiene costo parametrizado.');
  await costs.getByLabel('Justificación').fill('Factura 118 del transportador');
  const sent = nextRequest(page, 'POST', COSTS);
  await costs.getByRole('button', { name: 'Registrar costo' }).click();
  expect((await sent).postDataJSON()).toEqual({ concept: 'Transporte extra', mode: 'MANUAL', amountCents: 30_000_000, justification: 'Factura 118 del transportador' });
  await expect(costs.getByRole('row').filter({ hasText: 'Transporte extra' })).toContainText('Factura 118 del transportador');
  await page.screenshot({ path: `${SHOTS}/ac3-sin-parametrizacion.png`, fullPage: true });
  expectNoUnstubbedCalls(page);
});

test('AC4 · on a departure that has not started no cost is offered, and none is asked of the service', async ({ page }) => {
  let asked = 0;
  page.on('request', (r) => new URL(r.url()).pathname === COSTS && asked++);
  await openDepartures(page, { departures: [departureOf()] });
  await openDeparture(page, 'SAL-101');
  const costs = costsOf(page);
  await expect(costs).toContainText('Disponible cuando la salida haya iniciado.');
  await expect(costs.getByRole('button', { name: 'Registrar costo' })).toHaveCount(0);
  await expect(costs.getByLabel('Valor')).toHaveCount(0);
  expect(asked).toBe(0);
  await page.screenshot({ path: `${SHOTS}/ac4-sin-iniciar.png`, fullPage: true });
  expectNoUnstubbedCalls(page);
});

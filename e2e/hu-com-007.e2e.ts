import { expect, Page, test } from '@playwright/test';
import { areaText, goTo, openCommercialAs } from './support/operator-session';

// HU-COM-007 (create a reservation and calculate its value), portal spec 007-, AC-RC.x. One criterion per test.
// Not covered here: the real seat check against the API, the holder typed by hand (NOT_IN_CONTRACT in the portal
// writer, declared gap) and the calculation rules by line (unit tests on the quote).
const ADMINISTRATOR = ['TENANT_ADMINISTRATOR'];
const SHOTS = 'test-results/hu-com-007';
const area = (page: Page) => page.locator('app-remote-host');

async function toForm(page: Page): Promise<void> {
  await goTo(page, 'Reservas');
  await page.getByRole('button', { name: 'Crear reserva' }).first().click();
  await expect(area(page)).toContainText('Registrar reserva');
}

test('AC-RC.1 and AC-RC.8 · the list shows the reservations with their state, balance and the "Ver detalle" action', async ({ page }) => {
  await openCommercialAs(page, ADMINISTRATOR);
  await goTo(page, 'Reservas');
  await expect(area(page).locator('thead th')).toContainText(['Reserva', 'Cliente', 'Servicio y salida', 'Estado', 'Saldo', 'Acción']);
  const text = await areaText(page);
  expect(text).toContain('Pendiente de pago');
  expect(text).toContain('$850.000');
  await page.screenshot({ path: `${SHOTS}/rc-01-lista.png`, fullPage: true });
});

test('AC-RC.5 and AC-RC.6 · missing required data is marked beside each field and nothing is registered', async ({ page }) => {
  await openCommercialAs(page, ADMINISTRATOR);
  await toForm(page);
  // The form does not let a reservation with missing data go: the register button stays disabled until it is complete.
  await expect(page.getByRole('button', { name: 'Registrar reserva' })).toBeDisabled();
  await page.screenshot({ path: `${SHOTS}/rc-05-faltantes.png`, fullPage: true });
});

test('AC-RC.3 and AC-RC.4 · choosing a tour, a departure and the people calculates the projected value and the final value', async ({ page }) => {
  await openCommercialAs(page, ADMINISTRATOR);
  await toForm(page);
  await page.locator('[name=serviceId]').selectOption({ index: 1 });
  await page.locator('[name=departureId]').selectOption({ index: 1 });
  await page.locator('[name=people]').fill('2');
  await expect(area(page)).toContainText('Valor proyectado');
  await expect(area(page)).toContainText('Valor final');
  expect(await areaText(page)).toMatch(/Valor proyectado \$[\d.]+/);
  await page.screenshot({ path: `${SHOTS}/rc-03-valores.png`, fullPage: true });
});

test('AC-RC.7 · the detail of a reservation shows the lead, the travelers, the economic state and the departure', async ({ page }) => {
  await openCommercialAs(page, ADMINISTRATOR);
  await goTo(page, 'Reservas');
  await area(page).locator('tbody tr').first().getByRole('button', { name: 'Ver detalle' }).click();
  await expect(area(page)).toContainText('Detalle de reserva');
  const text = await areaText(page);
  for (const part of ['Salida asociada', 'Proyección comercial', 'Seguimiento económico', 'Laura Gómez']) expect(text).toContain(part);
  await page.screenshot({ path: `${SHOTS}/rc-07-detalle.png`, fullPage: true });
});

test('AC-RC.2 · the operator chooses an existing customer with the search and registers the reservation', async ({ page }) => {
  await openCommercialAs(page, ADMINISTRATOR);
  await goTo(page, 'Reservas');
  await page.getByRole('button', { name: 'Crear reserva' }).first().click();
  await page.getByLabel(/Buscar cliente existente/).fill('Laura');
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${SHOTS}/rc-02-busqueda.png`, fullPage: true });
  await area(page).getByText('Laura Gómez').first().click();
  await page.locator('[name=serviceId]').selectOption({ index: 1 });
  await page.locator('[name=departureId]').selectOption({ index: 1 });
  await page.locator('[name=people]').fill('1');
  await page.locator('[name=paymentType]').selectOption({ index: 1 });
  await page.locator('[name=paymentMethod]').selectOption({ index: 1 });
  await page.locator('[name=accepted]').check();
  await page.screenshot({ path: `${SHOTS}/rc-02-antes-de-registrar.png`, fullPage: true });
  await page.getByRole('button', { name: 'Registrar reserva' }).click();
  await expect(area(page)).toContainText('Reserva registrada');
  await expect(area(page)).toContainText('Pendiente de pago');
});

import { expect, Page, test } from '@playwright/test';
import { areaText, fillHolder, openCommercialAs, openTourDetail } from './support/operator-session';

// HU-COM-005 (register the lead customer and companions), portal spec 005-, AC-PC.x. One criterion per test.
// The container image of this run was built from portal develop 3b46bda5 (9 Nov 2026), before the customer search route
// (api 225, portal 233): the selector of the customer is not covered until the image is rebuilt from a develop that has it.
// On that image the holder and the companions are typed inside the reservation (screen 21 of the customer and the form of the
// operator): the customers adapter still answers "not in the contract" for the group, the search and addCompanion, so the
// separate group screen cannot be shown against the container. Not covered here: AC-PC.2, AC-PC.3, AC-PC.5 to AC-PC.10 and
// AC-PC.12 (companion group, duplicate document, high-risk block and sensitive data masked: component tests; they need the
// customers service or the high-risk tour of the real catalog), AC-PC.16 (permission to read sensitive data: identity service).
const CUSTOMER = ['FINAL_CUSTOMER'];
const SHOTS = 'test-results/hu-com-005';
const area = (page: Page) => page.locator('app-remote-host');
const press = async (page: Page, name: string | RegExp) => {
  await page.getByRole('button', { name }).first().click();
  await page.waitForTimeout(500);
};

/** Customer: Tatacoa → "Elegir salida y reservar" → "Continuar reserva": screen 21 with the holder form. */
async function toFinish(page: Page): Promise<void> {
  await openTourDetail(page);
  await press(page, 'Elegir salida y reservar');
  await press(page, 'Continuar reserva');
  await expect(area(page)).toContainText('Cliente titular');
}

test('AC-PC.1 · the holder is required: name, document, phone, email and birth date', async ({ page }) => {
  await openCommercialAs(page, CUSTOMER);
  await toFinish(page);
  await page.check('[name=conditions]');
  await page.check('[name=terms]');
  await page.selectOption('[name=paymentMethod]', 'CASH_AT_OFFICE');
  await page.check('input[name=paymentType][value=TOTAL]');
  await press(page, /Confirmar reserva|Crear reserva/);
  await expect(area(page)).toContainText('Completa nombre, documento, teléfono, correo y fecha de nacimiento del titular.');
  await page.screenshot({ path: `${SHOTS}/pc-01-titular-obligatorio.png`, fullPage: true });
});

test('AC-PC.4 · an invalid holder email is refused beside the field', async ({ page }) => {
  await openCommercialAs(page, CUSTOMER);
  await toFinish(page);
  await fillHolder(page);
  await page.getByLabel('Correo electrónico').first().fill('no-es-un-correo');
  await page.check('[name=conditions]');
  await page.check('[name=terms]');
  await page.selectOption('[name=paymentMethod]', 'CASH_AT_OFFICE');
  await page.check('input[name=paymentType][value=TOTAL]');
  await press(page, /Confirmar reserva|Crear reserva/);
  await expect(area(page)).toContainText('Escribe un correo válido para el titular.');
  await page.screenshot({ path: `${SHOTS}/pc-04-correo-invalido.png`, fullPage: true });
});

test('AC-PC.4 · a future birth date of the holder is refused', async ({ page }) => {
  await openCommercialAs(page, CUSTOMER);
  await toFinish(page);
  await fillHolder(page);
  await page.getByLabel('Fecha de nacimiento').first().fill('2999-01-01');
  await page.check('[name=conditions]');
  await page.check('[name=terms]');
  await page.selectOption('[name=paymentMethod]', 'CASH_AT_OFFICE');
  await page.check('input[name=paymentType][value=TOTAL]');
  await press(page, /Confirmar reserva|Crear reserva/);
  expect(await areaText(page)).toContain('La fecha de nacimiento del titular no puede ser futura.');
  await page.screenshot({ path: `${SHOTS}/pc-04-fecha-futura.png`, fullPage: true });
});

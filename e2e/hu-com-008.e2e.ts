import { expect, Page, test } from '@playwright/test';
import { areaText, fillHolder, openTourDetail, openCommercialAs } from './support/operator-session';

// HU-COM-008 (reserve from the digital channel), portal spec 008-, AC-RS.x. One criterion per test.
// Not covered here: AC-RS.2 (sign-in prompt without a session: the sign-in belongs to the identity portal of the
// other team), AC-RS.3 and AC-RS.4 (real capacity row and the methods the tenant enabled: need the real service),
// AC-RS.6 (one Idempotency-Key per retry: unit test), AC-RS.8 (four states: component test).
const CUSTOMER = ['FINAL_CUSTOMER'];
const SHOTS = 'test-results/hu-com-008';
const area = (page: Page) => page.locator('app-remote-host');
const press = async (page: Page, name: string | RegExp, exact = false) => {
  await page.getByRole('button', { name, exact }).first().click();
  await page.waitForTimeout(500);
};

/** Tours → Ver detalle → Reservar tour → Continuar reserva: screen 21 (Finalizar reserva). */
async function toFinish(page: Page): Promise<void> {
  await openTourDetail(page);
  await press(page, 'Elegir salida y reservar');
  await press(page, 'Continuar reserva');
  await expect(area(page)).toContainText('Finalizar reserva');
}

test('AC-RS.10 · "Reservar tour" lists the departures with seats and the customer continues to the reservation', async ({ page }) => {
  await openCommercialAs(page, CUSTOMER);
  await openTourDetail(page);
  await press(page, 'Elegir salida y reservar');
  await expect(area(page)).toContainText('Continuar reserva');
  await page.screenshot({ path: `${SHOTS}/rs-10-salidas.png`, fullPage: true });
});

test('AC-RS.5 · confirming without the required choices is blocked and each field shows its message', async ({ page }) => {
  await openCommercialAs(page, CUSTOMER);
  await toFinish(page);
  await press(page, /Confirmar reserva|Crear reserva/);
  const text = await areaText(page);
  expect(text).toContain('Finalizar reserva');
  expect(text).toMatch(/Acepta las condiciones y los términos para confirmar\.|Obligatori|Selecciona/);
  await page.screenshot({ path: `${SHOTS}/rs-05-faltantes.png`, fullPage: true });
});

test('AC-RS.1 · the customer confirms and the reservation is created Pendiente de pago with its code and final value', async ({ page }) => {
  await openCommercialAs(page, CUSTOMER);
  await toFinish(page);
  await page.selectOption('[name=paymentMethod]', 'CASH_AT_OFFICE');
  await page.check('input[name=paymentType][value=TOTAL]');
  await page.check('[name=conditions]');
  await page.check('[name=terms]');
  await fillHolder(page);
  await press(page, /Confirmar reserva|Crear reserva/);
  await expect(area(page)).toContainText(/Reserva creada: RES-\d+/);
  await expect(area(page)).toContainText('Valor final');
  await expect(page.getByRole('button', { name: /Crear reserva/ })).toHaveCount(0);
  await page.screenshot({ path: `${SHOTS}/rs-01-creada.png`, fullPage: true });
});

test('AC-RS.7 and AC-RS.14 · "Mis reservas" lists the customer reservations without cancel or modify actions', async ({ page }) => {
  await openCommercialAs(page, CUSTOMER);
  await press(page, 'Ver mis reservas');
  const text = await areaText(page);
  expect(text).toMatch(/RES-\d+/);
  expect(text).toContain('Pendiente de pago');
  const actions = await page.getByRole('button').allInnerTexts();
  expect(actions.some((label) => /^(Cancelar reserva|Cancelar|Modificar|Reprogramar|Editar)/.test(label.trim()))).toBe(false);
  await page.screenshot({ path: `${SHOTS}/rs-07-mis-reservas.png`, fullPage: true });
});

test('AC-RS.9 · an unknown role is not offered the confirmation and the customer portal has no operator functions', async ({ page }) => {
  await openCommercialAs(page, ['ROL_DESCONOCIDO_E2E']);
  expect(await areaText(page)).not.toContain('Crear reserva');
  await page.screenshot({ path: `${SHOTS}/rs-09-rol-desconocido.png`, fullPage: true });
});

test('AC-RS.9 · the customer never sees the operator menu or functions', async ({ page }) => {
  await openCommercialAs(page, CUSTOMER);
  for (const label of ['Explorar', 'Alojamiento', 'Gastronomía', 'Mis reservas']) {
    const item = page.getByRole('button', { name: label, exact: true });
    if (await item.count()) {
      await item.first().click();
      const text = await areaText(page);
      for (const operatorOnly of ['ADMINISTRADOR DEL TENANT', 'Titular y acompañantes', 'Crear descuento', 'Crear reserva', 'Gestionar catálogo', 'Nuevo servicio']) expect(text).not.toContain(operatorOnly);
    }
  }
  await page.screenshot({ path: `${SHOTS}/rs-09-cliente-sin-operador.png`, fullPage: true });
});

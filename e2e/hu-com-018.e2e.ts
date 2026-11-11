import { expect, Page, test } from '@playwright/test';
import { areaText, goTo, openCommercialAs } from './support/operator-session';

// HU-COM-018 (reschedule an affected reservation), portal spec 018-, AC-RP.x. One criterion per test. Seeded
// (src/app/demo/rescheduling-seeds.ts): the departure "Ruta Andina" of 16 oct was cancelled; RES-1828 and RES-1829 (the demo customer)
// belong to it, RES-1829 already has a proposal to the departure of 23 oct, RES-1827 has a proof En validación.
// Not covered here: the cancellation of the departure and the change of vehicles (repositories of another team, read-only for this
// story), the notice and the mail to the customer (real service), the 96-hour absolute limit as a clock (a job: the demo clock only marks).
const SHOTS = 'test-results/hu-com-018';
const area = (page: Page) => page.locator('app-remote-host');
const ACCEPTED = 'Propuesta aceptada. La reserva sigue Confirmada con la nueva salida.';
const REJECTED = 'Propuesta rechazada. La reserva queda Cancelada y se devuelve el 100 % de los valores pagados y validados.';

/** Reservas (every reservation) → the row → "Ver detalle" (10A). */
async function toDetail(page: Page, code: string): Promise<void> {
  await goTo(page, 'Reservas');
  const toggle = page.getByRole('button', { name: /Ver todas las reservas|Ver reservas activas/ }).first();
  await toggle.waitFor();
  if (/todas/.test(await toggle.innerText())) await toggle.click();
  await area(page).locator('tbody tr', { hasText: `#${code}` }).first().getByRole('button', { name: 'Ver detalle' }).click();
  await expect(area(page)).toContainText('Detalle de reserva');
}

/** 10A → "Propuesta de reprogramación": the screen of the operator. */
async function toRescheduling(page: Page, code: string): Promise<void> {
  await toDetail(page, code);
  await page.getByRole('button', { name: 'Propuesta de reprogramación', exact: true }).first().click();
  await expect(page.locator('app-rescheduling-page [data-state]').first()).toBeVisible();
}

/** Customer panel → "Responder propuesta de reprogramación": the screen 24A. */
async function toProposal(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Ver mis reservas' }).first().click();
  await page.getByRole('button', { name: 'Responder propuesta', exact: true }).first().click();
  await expect(page.locator('app-rescheduling-proposal-page [data-state]').first()).toBeVisible();
}

test('AC-RP.1 · the Administrator opens the proposal from 10A and sees the episode with its remaining hours and deadlines', async ({ page }) => {
  await openCommercialAs(page, ['TENANT_ADMINISTRATOR']);
  await toRescheduling(page, 'RES-1828');
  const text = await areaText(page);
  expect(text.toLowerCase()).toContain('reserva res-1828');
  expect(text).toMatch(/Episodio: quedan \d+ h/);
  expect(text).toContain('Plazos del episodio');
  expect(text).toContain('el límite absoluto del episodio es 96 horas');
  await page.screenshot({ path: `${SHOTS}/rp-01-plazos.png`, fullPage: true });
  await page.getByRole('button', { name: 'Volver a reservas' }).first().click();
  await expect(area(page)).toContainText('#RES-1828');
});

test('AC-RP.2 · a reservation with a proof En validación cannot be rescheduled until the proof is resolved', async ({ page }) => {
  await openCommercialAs(page, ['TENANT_ADMINISTRATOR']);
  await toRescheduling(page, 'RES-1827');
  await page.getByRole('button', { name: 'Enviar propuesta' }).click();
  await expect(page.locator('#crp-rp-feedback')).toContainText('La reserva tiene un comprobante En validación: no se puede reprogramar hasta resolverlo.');
  await page.screenshot({ path: `${SHOTS}/rp-02-en-validacion.png`, fullPage: true });
});

test('AC-RP.3 · the Analyst gets no "Propuesta de reprogramación" in 10A', async ({ page }) => {
  await openCommercialAs(page, ['ANALYST']);
  await toDetail(page, 'RES-1828');
  await expect(page.getByRole('button', { name: /Propuesta de reprogramación|Enviar propuesta/ })).toHaveCount(0);
  await page.screenshot({ path: `${SHOTS}/rp-03-analista.png`, fullPage: true });
});

test('AC-RP.4 · an unknown role falls to the customer layout with no reschedule action', async ({ page }) => {
  await openCommercialAs(page, ['ROL_DESCONOCIDO_E2E']);
  await expect(page.getByRole('button', { name: /Propuesta de reprogramación|Enviar propuesta|Cancelar con devolución 100 %|Responder propuesta/ })).toHaveCount(0);
  await page.screenshot({ path: `${SHOTS}/rp-04-rol-desconocido.png`, fullPage: true });
});

test('AC-RP.5 · the customer sees the proposal notice on the panel and opens it', async ({ page }) => {
  await openCommercialAs(page, ['FINAL_CUSTOMER']);
  await toProposal(page);
  await page.screenshot({ path: `${SHOTS}/rp-05-propuesta-cliente.png`, fullPage: true });
});

test('AC-RP.6 · the customer accepts the proposal: the reservation keeps its code and stays Confirmada with the new departure', async ({ page }) => {
  await openCommercialAs(page, ['FINAL_CUSTOMER']);
  await toProposal(page);
  await page.getByRole('button', { name: 'Aceptar propuesta' }).dblclick();
  await expect(area(page)).toContainText(ACCEPTED);
  expect((await areaText(page)).split(ACCEPTED).length).toBe(2);
  await page.screenshot({ path: `${SHOTS}/rp-06-aceptada.png`, fullPage: true });
});

test('AC-RP.7 · the customer rejects the proposal: the reservation is cancelled and the 100 % of the validated values goes to refund', async ({ page }) => {
  await openCommercialAs(page, ['FINAL_CUSTOMER']);
  await toProposal(page);
  page.once('dialog', (dialog) => void dialog.accept());
  await page.getByRole('button', { name: 'Rechazar propuesta' }).click();
  await expect(area(page)).toContainText(REJECTED);
  await page.screenshot({ path: `${SHOTS}/rp-07-rechazada.png`, fullPage: true });
});

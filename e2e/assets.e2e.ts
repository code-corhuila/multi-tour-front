import { expect, test } from '@playwright/test';

const FILES: [string, RegExp][] = [
  ['/assets/mountain-hero.jpg', /image\/jpeg/],
  ['/assets/destino-sendero-del-condor.jpg', /image\/jpeg/],
  ['/assets/destino-cascadas-de-iraka.jpg', /image\/jpeg/],
  ['/assets/destino-bahia-esmeralda.jpg', /image\/jpeg/],
  ['/assets/fonts/fraunces.woff2', /font\/woff2|octet-stream/],
  ['/assets/fonts/manrope.woff2', /font\/woff2|octet-stream/],
];

test('E2E assets_are_served_from_the_same_origin', async ({ request }) => {
  for (const [path, type] of FILES) {
    const response = await request.get(path);
    expect(response.ok(), path).toBe(true);
    expect(response.headers()['content-type'], path).toMatch(type);
  }
});

test('E2E fonts_are_declared_and_load_without_a_cdn', async ({ page, baseURL }) => {
  const origin = new URL(baseURL!).origin;
  const external: string[] = [];
  page.on('request', (r) => {
    if (new URL(r.url()).origin !== origin) external.push(r.url());
  });
  await page.goto('/');
  const loaded = await page.evaluate(async () => {
    const faces = [...(await document.fonts.load("600 16px Fraunces")), ...(await document.fonts.load("700 16px Manrope"))];
    return faces.map((f) => `${f.family}:${f.status}`);
  });
  expect(loaded.length).toBeGreaterThan(1);
  expect(external).toEqual([]);
});
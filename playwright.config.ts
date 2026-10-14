import { defineConfig } from '@playwright/test';

// Light run: one browser, against the production image already running (HU-FRT-001, plan D-02).
// Start it first: docker run -d --name front-e2e -p 8080:8080 multi-tour-front; remove it after.
// No development server is started; stubs and test data come from page.route (e2e/support).
export default defineConfig({
  testDir: 'e2e',
  testMatch: '*.e2e.ts',
  timeout: 30_000,
  use: { baseURL: process.env['E2E_BASE_URL'] ?? 'http://localhost:8080' },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
});

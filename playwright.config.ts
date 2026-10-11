import { defineConfig } from '@playwright/test';

// Light run: one browser, the development build (it carries the stub remotes of e2e/stubs).
export default defineConfig({
  testDir: 'e2e',
  testMatch: '*.e2e.ts',
  timeout: 30_000,
  use: { baseURL: 'http://localhost:4300' },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
  webServer: {
    command: 'npx ng serve --configuration development --port 4300',
    url: 'http://localhost:4300',
    timeout: 120_000,
  },
});
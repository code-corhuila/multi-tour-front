// @vitest-environment node
// @ts-expect-error Node fs is available at runtime; this workspace has no @types/node.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Read as text: importing the config would pull Playwright into the unit run.
const config = readFileSync('playwright.config.ts', 'utf8');

describe('playwright configuration (HU-FRT-001 AC-FC.5, RN-FC1)', () => {
  it('U·playwright_config_targets_the_container', () => {
    expect(config).not.toMatch(/webServer/);
    expect(config).not.toMatch(/ng serve|localhost:4300/);
    expect(config).toMatch(/baseURL:\s*process\.env\['E2E_BASE_URL'\]\s*\?\?\s*'http:\/\/localhost:8080'/);
  });
});

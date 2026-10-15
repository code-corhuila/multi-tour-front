// @vitest-environment node
// @ts-expect-error Node fs is available at runtime; this workspace has no @types/node.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const angular = JSON.parse(readFileSync('angular.json', 'utf8'));
const configurations = angular.projects.shell.architect.build.configurations;
const manifest = JSON.parse(readFileSync('public/federation.manifest.json', 'utf8'));

const urlOf = (entry: string | { url: string }): string => (typeof entry === 'string' ? entry : entry.url);

describe('demo configuration', () => {
  it('serves the copied portals', () => {
    expect(configurations.demo?.assets).toContainEqual({
      glob: '**/*', input: 'portals', output: 'portals',
    });
  });

  it('keeps development sign-in available without file replacements', () => {
    expect(configurations.demo).toBeDefined();
    expect(configurations.demo).not.toHaveProperty('fileReplacements');
  });

  it('loads public remotes from portal JavaScript files', () => {
    expect(Object.keys(manifest).length).toBeGreaterThan(0);
    for (const entry of Object.values(manifest)) {
      expect(urlOf(entry as string | { url: string })).toMatch(/^portals\/.*\.js$/);
    }
  });

  // HU-FRT-001 spec 003- plan D-03 and spec 001- T-09: the cash and reports portal is mounted from the shipped manifest.
  it('declares the cash portal with the module next to its stylesheet and the five internal roles', () => {
    const entry = manifest['cash-reporting-portal'];
    expect(urlOf(entry)).toBe('portals/cash-reporting-portal.js');
    expect([...entry.roles].sort()).toEqual(['ACCOUNTANT', 'ANALYST', 'MANAGER', 'OPERATIONAL_COLLABORATOR', 'TENANT_ADMINISTRATOR']);
  });

  it('keeps the entries it already shipped as they are', () => {
    expect(manifest['identity-audit-portal']).toBe('portals/identity-audit-portal.js');
    expect(urlOf(manifest['commercial-reservation-portal'])).toBe('portals/commercial-reservation-portal.js');
  });

  // The container draws the operator sidebar only around the portals that declared they leave it out (RN-FRT-27).
  it('flags only the commercial and the cash portals to get the container sidebar', () => {
    const flagged = Object.keys(manifest).filter((name) => manifest[name].chrome === true);
    expect(flagged.sort()).toEqual(['cash-reporting-portal', 'commercial-reservation-portal']);
  });

  it('continues serving the E2E stubs in development', () => {
    expect(configurations.development.assets).toContainEqual({
      glob: '*.js', input: 'e2e/stubs', output: 'stubs',
    });
  });
});

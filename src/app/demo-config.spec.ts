// @vitest-environment node
// @ts-expect-error Node fs is available at runtime; this workspace has no @types/node.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const angular = JSON.parse(readFileSync('angular.json', 'utf8'));
const configurations = angular.projects.shell.architect.build.configurations;
const manifest = JSON.parse(readFileSync('public/federation.manifest.json', 'utf8'));

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
    for (const path of Object.values(manifest)) {
      expect(path).toMatch(/^portals\/.*\.js$/);
    }
  });

  it('continues serving the E2E stubs in development', () => {
    expect(configurations.development.assets).toContainEqual({
      glob: '*.js', input: 'e2e/stubs', output: 'stubs',
    });
  });
});

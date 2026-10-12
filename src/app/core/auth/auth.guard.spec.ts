import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, convertToParamMap, provideRouter, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CONTAINER_CLIENT } from '../client/container-client.token';
import { createContainerClient } from '../client/container';
import { authGuard } from './auth.guard';

const tokenWith = (claims: object) => `h.${btoa(JSON.stringify(claims))}.s`;

function setup() {
  const client = createContainerClient({ baseUrl: '', fetch: vi.fn() });
  TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: CONTAINER_CLIENT, useValue: client }] });
  const run = (identifier: string | undefined, url: string) =>
    TestBed.runInInjectionContext(() =>
      authGuard(
        { paramMap: convertToParamMap(identifier ? { identifier } : {}) } as ActivatedRouteSnapshot,
        { url } as RouterStateSnapshot,
      ),
    );
  return { client, run, router: TestBed.inject(Router) };
}

describe('authGuard', () => {
  afterEach(() => {
    TestBed.inject(CONTAINER_CLIENT).store.of('acme').close();
    TestBed.inject(CONTAINER_CLIENT).store.of().close();
  });

  it('sends a tenant visitor without a session to the tenant ingresar route, keeping the requested url', () => {
    const { run, router } = setup();
    const result = run('acme', '/t/acme/areas/reports?x=1') as UrlTree;
    expect(router.serializeUrl(result)).toBe('/t/acme/ingresar?returnUrl=%2Ft%2Facme%2Fareas%2Freports%3Fx%3D1');
  });

  it('sends the platform visitor to the platform sign-in', () => {
    const { run, router } = setup();
    expect(router.serializeUrl(run(undefined, '/platform/areas/x') as UrlTree)).toBe(
      '/platform/ingresar?returnUrl=%2Fplatform%2Fareas%2Fx',
    );
  });

  it('lets a signed-in person through', () => {
    const { client, run } = setup();
    client.store.of('acme').open({ accessToken: tokenWith({ roles: ['ADMIN'] }), expiresIn: 900 });
    expect(run('acme', '/t/acme/areas/x')).toBe(true);
  });

  it('does not take the session of another tenant as its own', () => {
    const { client, run } = setup();
    client.store.of('other').open({ accessToken: tokenWith({}), expiresIn: 900 });
    expect(run('acme', '/t/acme/areas/x')).not.toBe(true);
    client.store.of('other').close();
  });

  it('sends a restricted or temporary credential back to sign-in', () => {
    const { client, run } = setup();
    client.store.of('acme').open({ accessToken: tokenWith({ access: 'password-change' }), expiresIn: 900 });
    expect(run('acme', '/t/acme/areas/x')).not.toBe(true);
  });
});
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { createContainerClient } from '../core/client/container';
import { CONTAINER_CLIENT } from '../core/client/container-client.token';
import { MANIFEST_LOADER, REMOTE_IMPORTER } from '../core/federation/remote-loader';
import { PortalPageComponent } from './portal-page.component';

interface Options {
  params?: Record<string, string>;
  remote?: string;
  scope?: string;
  returnUrl?: string;
  manifest?: Record<string, string> | Error;
}

function setup({ params = {}, remote, scope, returnUrl, manifest = { 'identity-audit-portal': '/stubs/id.js' } }: Options) {
  const mount = vi.fn();
  const client = createContainerClient({ baseUrl: '', fetch: vi.fn() });
  const route = {
    paramMap: of(convertToParamMap(params)),
    snapshot: { data: remote ? { remote, ...(scope ? { scope } : {}) } : {}, queryParamMap: convertToParamMap(returnUrl ? { returnUrl } : {}) },
  };
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: ActivatedRoute, useValue: route },
      { provide: CONTAINER_CLIENT, useValue: client },
      { provide: MANIFEST_LOADER, useValue: () => (manifest instanceof Error ? Promise.reject(manifest) : Promise.resolve(manifest)) },
      { provide: REMOTE_IMPORTER, useValue: vi.fn().mockResolvedValue({ mount }) },
    ],
  });
  const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
  const fixture = TestBed.createComponent(PortalPageComponent);
  fixture.detectChanges();
  return { fixture, mount, navigate, client };
}

const until = (fixture: { detectChanges(): void }, check: () => void) =>
  vi.waitFor(() => {
    fixture.detectChanges();
    check();
  });

describe('PortalPageComponent', () => {
  it('mounts the identity portal of a tenant with that tenant\'s client and session', async () => {
    const { fixture, mount, client } = setup({ params: { identifier: 'acme' }, remote: 'identity-audit-portal' });
    await until(fixture, () => expect(mount).toHaveBeenCalledTimes(1));
    const props = mount.mock.calls[0][1];
    expect(props.identifier).toBe('acme');
    props.session.open({ accessToken: 'a.b.c', expiresIn: 900 });
    expect(client.store.of('acme').token).toBe('a.b.c');
    expect(client.store.of().token).toBeNull();
    client.store.of('acme').close();
  });

  it('mounts the same portal for the platform without an identifier', async () => {
    const { fixture, mount } = setup({ remote: 'identity-audit-portal' });
    await until(fixture, () => expect(mount).toHaveBeenCalledTimes(1));
    expect(mount.mock.calls[0][1].identifier).toBeUndefined();
  });

  it('mounts the area named in the route', async () => {
    const { fixture, mount } = setup({ params: { identifier: 'acme', remote: 'billing' }, manifest: { billing: '/stubs/b.js' } });
    await until(fixture, () => expect(mount).toHaveBeenCalledTimes(1));
  });

  it('shows the common 404 for an area that is not in the manifest', async () => {
    const { fixture } = setup({ params: { identifier: 'acme', remote: 'nope' }, manifest: {} });
    await until(fixture, () => expect(fixture.nativeElement.textContent).toContain('Page not found'));
  });

  it('shows only the unavailable area when the identity portal is not in the manifest', async () => {
    const { fixture } = setup({ remote: 'identity-audit-portal', manifest: {} });
    await until(fixture, () => expect(fixture.nativeElement.querySelector('[role="alert"]')).not.toBeNull());
  });

  it('shows the unavailable area when the manifest cannot be loaded', async () => {
    const { fixture } = setup({ remote: 'identity-audit-portal', manifest: new Error('offline') });
    await until(fixture, () => expect(fixture.nativeElement.querySelector('[role="alert"]')).not.toBeNull());
  });

  it('goes back to the requested url after the portal opens a full session', async () => {
    const { fixture, mount, navigate, client } = setup({ params: { identifier: 'acme' }, remote: 'identity-audit-portal', returnUrl: '/t/acme/areas/x' });
    await until(fixture, () => expect(mount).toHaveBeenCalled());
    mount.mock.calls[0][1].session.open({ accessToken: 'a.b.c', expiresIn: 900 });
    expect(navigate).toHaveBeenCalledWith('/t/acme/areas/x');
    client.store.of('acme').close();
  });

  it('never goes back to another site', async () => {
    const { fixture, mount, navigate, client } = setup({ remote: 'identity-audit-portal', returnUrl: '//evil.example/x' });
    await until(fixture, () => expect(mount).toHaveBeenCalled());
    mount.mock.calls[0][1].session.open({ accessToken: 'a.b.c', expiresIn: 900 });
    expect(navigate).not.toHaveBeenCalled();
    client.store.of().close();
  });

  it('mounts the general login with scope general, no identifier and the navigate of the container', async () => {
    const { fixture, mount, navigate } = setup({ remote: 'identity-audit-portal', scope: 'general' });
    await until(fixture, () => expect(mount).toHaveBeenCalledTimes(1));
    const props = mount.mock.calls[0][1];
    expect(props.scope).toBe('general');
    expect('identifier' in props).toBe(false);
    props.navigate('/t/acme');
    expect(navigate).toHaveBeenCalledWith('/t/acme');
  });

  it('passes scope tenant with the identifier, and navigate', async () => {
    const tenant = setup({ params: { identifier: 'acme' }, remote: 'identity-audit-portal' });
    await until(tenant.fixture, () => expect(tenant.mount).toHaveBeenCalledTimes(1));
    expect(tenant.mount.mock.calls[0][1]).toMatchObject({ scope: 'tenant', identifier: 'acme' });
    expect(typeof tenant.mount.mock.calls[0][1].navigate).toBe('function');
  });

  it('passes scope platform without an identifier', async () => {
    const platform = setup({ remote: 'identity-audit-portal' });
    await until(platform.fixture, () => expect(platform.mount).toHaveBeenCalledTimes(1));
    expect(platform.mount.mock.calls[0][1].scope).toBe('platform');
  });

  it('navigate only follows paths of this application', async () => {
    const { fixture, mount, navigate } = setup({ remote: 'identity-audit-portal', scope: 'general' });
    await until(fixture, () => expect(mount).toHaveBeenCalledTimes(1));
    for (const bad of ['//evil.example/x', 'https://evil.example', '/a\\b', 'relative']) mount.mock.calls[0][1].navigate(bad);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('passes the identifier typed in the general login to the session and goes on to the tenant', async () => {
    const { fixture, mount, client } = setup({ remote: 'identity-audit-portal', scope: 'general' });
    await until(fixture, () => expect(mount).toHaveBeenCalledTimes(1));
    mount.mock.calls[0][1].session.open({ accessToken: 'a.b.c', expiresIn: 900 }, 'acme');
    expect(client.store.of('acme').token).toBe('a.b.c');
    client.store.of('acme').close();
  });
});

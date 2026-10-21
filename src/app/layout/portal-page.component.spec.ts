import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { createContainerClient } from '../core/client/container';
import { CONTAINER_CLIENT } from '../core/client/container-client.token';
import { answer, jwt } from '../core/client/test-helpers';
import { MANIFEST_LOADER, REMOTE_IMPORTER } from '../core/federation/remote-loader';
import { TenantVisualIdentity } from '../tenant/tenant-visual-identity';
import { PortalPageComponent } from './portal-page.component';

interface Options {
  params?: Record<string, string>;
  remote?: string;
  scope?: string;
  returnUrl?: string;
  manifest?: Record<string, string> | Error;
  /** Provide the state the tenant shell would provide, started from this profile value. */
  profileColors?: unknown;
  /** The commercial name of the resolved tenant profile (route data, as the tenant shell's resolver sets it). */
  commercialName?: unknown;
}

function setup({ params = {}, remote, scope, returnUrl, profileColors, commercialName, manifest = { 'identity-audit-portal': '/stubs/id.js' } }: Options) {
  const mount = vi.fn();
  const client = createContainerClient({ baseUrl: '', fetch: vi.fn() });
  const route = {
    paramMap: of(convertToParamMap(params)),
    queryParamMap: of(convertToParamMap(returnUrl ? { returnUrl } : {})),
    snapshot: {
      data: remote
        ? {
            remote,
            ...(scope ? { scope } : {}),
            ...(commercialName === undefined ? {} : { tenant: { state: 'active', profile: { identifier: 'acme', commercialName, tenantStatus: 'ACTIVE' } } }),
          }
        : {}, queryParamMap: convertToParamMap(returnUrl ? { returnUrl } : {}) },
  };
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: ActivatedRoute, useValue: route },
      ...(profileColors === undefined ? [] : [TenantVisualIdentity]),
      { provide: CONTAINER_CLIENT, useValue: client },
      { provide: MANIFEST_LOADER, useValue: () => (manifest instanceof Error ? Promise.reject(manifest) : Promise.resolve(manifest)) },
      { provide: REMOTE_IMPORTER, useValue: vi.fn().mockResolvedValue({ mount }) },
    ],
  });
  if (profileColors !== undefined) TestBed.inject(TenantVisualIdentity).start(profileColors);
  const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
  const fixture = TestBed.createComponent(PortalPageComponent);
  fixture.detectChanges();
  return { fixture, mount, navigate, client, identity: profileColors === undefined ? null : TestBed.inject(TenantVisualIdentity) };
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

  // The sign-in route draws no sidebar: an operator who just signed in goes to the identity area, where the container draws the one sidebar.
  it.each(['TENANT_ADMINISTRATOR', 'OPERATIONAL_COLLABORATOR', 'MANAGER', 'ACCOUNTANT', 'ANALYST'])('takes the %s who just signed in to the identity area', async (role) => {
    const { fixture, mount, navigate, client } = setup({ params: { identifier: 'acme' }, remote: 'identity-audit-portal' });
    await until(fixture, () => expect(mount).toHaveBeenCalledTimes(1));
    mount.mock.calls[0][1].session.open(answer(jwt([role])));
    expect(navigate).toHaveBeenCalledWith('/t/acme/areas/identity-audit-portal');
    client.store.of('acme').close();
  });

  it('keeps the requested url over the identity area after the operator signs in', async () => {
    const { fixture, mount, navigate, client } = setup({ params: { identifier: 'acme' }, remote: 'identity-audit-portal', returnUrl: '/t/acme/areas/x' });
    await until(fixture, () => expect(mount).toHaveBeenCalled());
    mount.mock.calls[0][1].session.open(answer(jwt(['TENANT_ADMINISTRATOR'])));
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith('/t/acme/areas/x');
    client.store.of('acme').close();
  });

  it.each([['FINAL_CUSTOMER'], ['PLATFORM_ADMINISTRATOR']])('does not move the %s after the sign-in', async (role) => {
    const { fixture, mount, navigate, client } = setup({ params: { identifier: 'acme' }, remote: 'identity-audit-portal' });
    await until(fixture, () => expect(mount).toHaveBeenCalledTimes(1));
    mount.mock.calls[0][1].session.open(answer(jwt([role])));
    expect(navigate).not.toHaveBeenCalled();
    client.store.of('acme').close();
  });

  it('does not move the platform sign-in either', async () => {
    const { fixture, mount, navigate, client } = setup({ remote: 'identity-audit-portal' });
    await until(fixture, () => expect(mount).toHaveBeenCalledTimes(1));
    mount.mock.calls[0][1].session.open(answer(jwt(['TENANT_ADMINISTRATOR'])));
    expect(navigate).not.toHaveBeenCalled();
    client.store.of().close();
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

  it('U-portal_receives_the_visual_identity_of_the_tenant', async () => {
    const colors = { primaryColor: '#112233', secondaryColor: '#445566' };
    const { fixture, mount } = setup({ params: { identifier: 'acme' }, remote: 'identity-audit-portal', profileColors: colors });
    await until(fixture, () => expect(mount).toHaveBeenCalledTimes(1));
    expect(mount.mock.calls[0][1].visualIdentity).toEqual(colors);
    expect(typeof mount.mock.calls[0][1].onVisualIdentityChange).toBe('function');
  });

  it('U-callback_updates_the_variables_and_ignores_malformed_colors', async () => {
    const { fixture, mount, identity } = setup({
      params: { identifier: 'acme' },
      remote: 'identity-audit-portal',
      profileColors: { primaryColor: '#112233', secondaryColor: '#445566' },
    });
    await until(fixture, () => expect(mount).toHaveBeenCalledTimes(1));
    const props = mount.mock.calls[0][1];
    props.onVisualIdentityChange({ primaryColor: '#aabbcc', secondaryColor: '#ddeeff' });
    expect(identity!.variables()['--accent']).toBe('#aabbcc');
    props.onVisualIdentityChange({ primaryColor: 'nope', secondaryColor: '#ddeeff' });
    expect(identity!.variables()['--accent']).toBe('#aabbcc');
  });

  it('U-platform_and_general_mounts_get_no_visual_identity', async () => {
    const platform = setup({ remote: 'identity-audit-portal', profileColors: null });
    await until(platform.fixture, () => expect(platform.mount).toHaveBeenCalledTimes(1));
    expect('visualIdentity' in platform.mount.mock.calls[0][1]).toBe(false);
    expect('onVisualIdentityChange' in platform.mount.mock.calls[0][1]).toBe(false);
  });

  it('U-a_tenant_without_colors_gets_null', async () => {
    const { fixture, mount } = setup({ params: { identifier: 'acme' }, remote: 'identity-audit-portal', profileColors: null });
    await until(fixture, () => expect(mount).toHaveBeenCalledTimes(1));
    expect(mount.mock.calls[0][1].visualIdentity).toBeNull();
  });

  it('U-portal_without_the_new_props_still_mounts_when_no_shell_provides_them', async () => {
    const { fixture, mount } = setup({ params: { identifier: 'acme' }, remote: 'identity-audit-portal' });
    await until(fixture, () => expect(mount).toHaveBeenCalledTimes(1));
    expect('visualIdentity' in mount.mock.calls[0][1]).toBe(false);
  });

  it('U-portal_receives_the_commercial_name_of_the_tenant_when_it_is_not_blank', async () => {
    const { fixture, mount } = setup({
      params: { identifier: 'acme' },
      remote: 'identity-audit-portal',
      profileColors: null,
      commercialName: 'Acme Tours',
    });
    await until(fixture, () => expect(mount).toHaveBeenCalledTimes(1));
    expect(mount.mock.calls[0][1].commercialName).toBe('Acme Tours');
  });

  it('U-commercial_name_is_omitted_when_blank_or_not_a_string', async () => {
    for (const bad of ['   ', '', 42, null]) {
      const { fixture, mount } = setup({
        params: { identifier: 'acme' },
        remote: 'identity-audit-portal',
        profileColors: null,
        commercialName: bad,
      });
      await until(fixture, () => expect(mount).toHaveBeenCalledTimes(1));
      expect('commercialName' in mount.mock.calls[0][1], String(bad)).toBe(false);
      TestBed.resetTestingModule();
    }
  });

  it('U-platform_and_general_mounts_get_no_commercial_name', async () => {
    const { fixture, mount } = setup({ remote: 'identity-audit-portal', profileColors: null, commercialName: 'Acme Tours' });
    await until(fixture, () => expect(mount).toHaveBeenCalledTimes(1));
    expect('commercialName' in mount.mock.calls[0][1]).toBe(false);
  });

  it('U·container_passes_display_name_when_the_session_has_it (tenant mount)', async () => {
    const { fixture, mount, client } = setup({ params: { identifier: 'acme' }, remote: 'identity-audit-portal' });
    await until(fixture, () => expect(mount).toHaveBeenCalledTimes(1));
    const { session } = mount.mock.calls[0][1];
    expect(session.displayName).toBeUndefined();
    client.store.of('acme').open(answer(jwt(['CLIENT'], { displayName: 'Ana Pérez' })));
    expect(session.displayName).toBe('Ana Pérez');
    client.store.of('acme').close();
  });

  it('U·the_general_login_session_follows_the_name_of_the_session_it_opens', async () => {
    const { fixture, mount, client } = setup({ remote: 'identity-audit-portal', scope: 'general' });
    await until(fixture, () => expect(mount).toHaveBeenCalledTimes(1));
    const { session } = mount.mock.calls[0][1];
    expect(session.displayName).toBeUndefined();
    session.open(answer(jwt(['CLIENT'], { displayName: 'Ana Pérez' })), 'acme');
    expect(session.displayName).toBe('Ana Pérez');
    session.close();
    expect(session.displayName).toBeUndefined();
    client.store.of('acme').close();
  });
});

import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { routes } from '../app.routes';
import { createContainerClient } from '../core/client/container';
import { CONTAINER_CLIENT } from '../core/client/container-client.token';
import { answer, jwt } from '../core/client/test-helpers';
import { MANIFEST_LOADER, ManifestEntry, REMOTE_IMPORTER } from '../core/federation/remote-loader';
import { PortalPageComponent } from './portal-page.component';

const MANIFEST: Record<string, ManifestEntry> = { 'commercial-reservation-portal': { url: '/stubs/com.js', chrome: true } };

interface Options {
  signedIn?: boolean;
  query?: Record<string, string>;
  manifest?: Record<string, ManifestEntry>;
}

function setup({ signedIn = false, query = {}, manifest = MANIFEST }: Options = {}) {
  const mount = vi.fn();
  const client = createContainerClient({ baseUrl: '', fetch: vi.fn() });
  if (signedIn) client.store.of('acme').open(answer(jwt(['TENANT_ADMINISTRATOR'])));
  const map = convertToParamMap(query);
  const route = {
    paramMap: of(convertToParamMap({ identifier: 'acme' })),
    queryParamMap: of(map),
    snapshot: { data: { remote: 'commercial-reservation-portal', anonymous: true, area: 'tours' }, queryParamMap: map },
  };
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: ActivatedRoute, useValue: route },
      { provide: CONTAINER_CLIENT, useValue: client },
      { provide: MANIFEST_LOADER, useValue: () => Promise.resolve(manifest) },
      { provide: REMOTE_IMPORTER, useValue: vi.fn().mockResolvedValue({ mount }) },
    ],
  });
  const fixture = TestBed.createComponent(PortalPageComponent);
  fixture.detectChanges();
  return { fixture, mount, client, el: fixture.nativeElement as HTMLElement, done: () => client.store.of('acme').close() };
}

async function mounted(options?: Options) {
  const ctx = setup(options);
  await vi.waitFor(() => {
    ctx.fixture.detectChanges();
    expect(ctx.mount).toHaveBeenCalledTimes(1);
  });
  return { ...ctx, props: ctx.mount.mock.calls[0][1] };
}

describe('public catalog route (HU-COM-006, G-PUB)', () => {
  it('U·route_catalogo_sits_under_the_tenant_link_without_a_guard_and_before_the_catch_all', () => {
    const children = routes.find((r) => r.path === 't/:identifier')?.children ?? [];
    const catalog = children.find((c) => c.path === 'catalogo');
    expect(catalog).toBeDefined();
    expect(catalog?.canActivate).toBeUndefined();
    expect(catalog?.component).toBe(PortalPageComponent);
    expect(catalog?.data).toMatchObject({ remote: 'commercial-reservation-portal', anonymous: true, area: 'tours' });
    expect(children.indexOf(catalog!)).toBeLessThan(children.findIndex((c) => c.path === '**'));
  });

  it('U·the_platform_has_no_public_catalog', () => {
    expect((routes.find((r) => r.path === 'platform')?.children ?? []).some((c) => c.path === 'catalogo')).toBe(false);
  });

  it('U·it_mounts_the_commercial_portal_with_an_empty_session_and_the_offer_area', async () => {
    const { props } = await mounted();
    expect(props.session.roles).toEqual([]);
    expect(props.scope).toBe('tenant');
    expect(props.identifier).toBe('acme');
    expect(props.initialParams).toEqual({ area: 'tours' });
  });

  it('U·it_draws_no_operator_sidebar_and_sets_no_chrome', async () => {
    const { props, el, done } = await mounted({ signedIn: true });
    expect(props.chrome).toBeUndefined();
    expect(el.querySelector('aside')).toBeNull();
    done();
  });

  it('U·a_signed_in_person_still_gets_an_anonymous_session', async () => {
    const { props, client, done } = await mounted({ signedIn: true });
    expect(props.session.roles).toEqual([]);
    expect(client.store.of('acme').token).not.toBeNull();
    done();
  });

  it('U·a_public_area_can_be_asked_by_query', async () => {
    const { props } = await mounted({ query: { area: 'lodging' } });
    expect(props.initialParams).toEqual({ area: 'lodging' });
  });

  it('U·an_area_that_is_not_public_falls_back_to_the_offer', async () => {
    const { props } = await mounted({ query: { area: 'catalog' } });
    expect(props.initialParams).toEqual({ area: 'tours' });
  });

  it('U·navigate_never_throws_for_an_empty_session', async () => {
    const { props } = await mounted();
    expect(() => props.navigate('/t/acme/ingresar')).not.toThrow();
    expect(() => props.navigate({ portal: 'x', area: 'y' })).not.toThrow();
  });

  it('U·without_the_portal_in_the_manifest_the_mount_does_not_happen', async () => {
    const { fixture, el, mount } = setup({ manifest: {} });
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(el.querySelector('app-remote-unavailable')).not.toBeNull();
    });
    expect(mount).not.toHaveBeenCalled();
  });
});

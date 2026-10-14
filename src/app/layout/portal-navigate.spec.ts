import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { createContainerClient } from '../core/client/container';
import { CONTAINER_CLIENT } from '../core/client/container-client.token';
import { answer, jwt } from '../core/client/test-helpers';
import { MANIFEST_LOADER, ManifestEntry, REMOTE_IMPORTER } from '../core/federation/remote-loader';
import { PortalPageComponent } from './portal-page.component';

const MANIFEST: Record<string, ManifestEntry> = {
  'identity-audit-portal': '/stubs/id.js',
  'cash-reporting-portal': '/stubs/cash.js',
  'commercial-reservation-portal': '/stubs/com.js',
  'restricted-portal': { url: '/stubs/r.js', roles: ['ADMIN'] },
};

interface Options {
  params?: Record<string, string>;
  remote?: string;
  scope?: string;
  area?: string;
}

function setup({ params = {}, remote, scope, area }: Options) {
  const mount = vi.fn();
  const client = createContainerClient({ baseUrl: '', fetch: vi.fn() });
  const route = {
    paramMap: of(convertToParamMap(params)),
    snapshot: {
      data: remote ? { remote, ...(scope ? { scope } : {}) } : {},
      queryParamMap: convertToParamMap(area ? { area } : {}),
    },
  };
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: ActivatedRoute, useValue: route },
      { provide: CONTAINER_CLIENT, useValue: client },
      { provide: MANIFEST_LOADER, useValue: () => Promise.resolve(MANIFEST) },
      { provide: REMOTE_IMPORTER, useValue: vi.fn().mockResolvedValue({ mount }) },
    ],
  });
  const router = TestBed.inject(Router);
  const go = vi.spyOn(router, 'navigate').mockResolvedValue(true);
  const byPath = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
  const fixture = TestBed.createComponent(PortalPageComponent);
  fixture.detectChanges();
  return { fixture, mount, go, byPath, client };
}

const until = (fixture: { detectChanges(): void }, check: () => void) =>
  vi.waitFor(() => {
    fixture.detectChanges();
    check();
  });

async function mounted(options: Options) {
  const ctx = setup(options);
  await until(ctx.fixture, () => expect(ctx.mount).toHaveBeenCalledTimes(1));
  return { ...ctx, props: ctx.mount.mock.calls[0][1] };
}

describe('MountProps.navigate({ portal, area })', () => {
  it('U·navigate_opens_the_target_area_of_another_portal', async () => {
    const { props, go, client } = await mounted({ params: { identifier: 'acme', remote: 'commercial-reservation-portal' } });
    props.navigate({ portal: 'cash-reporting-portal', area: 'cash' });
    expect(go).toHaveBeenCalledWith(['/t', 'acme', 'areas', 'cash-reporting-portal'], { queryParams: { area: 'cash' } });
    client.store.of('acme').close();
  });

  it('U·navigate_keeps_the_platform_prefix_when_there_is_no_tenant', async () => {
    const { props, go } = await mounted({ params: { remote: 'cash-reporting-portal' } });
    props.navigate({ portal: 'commercial-reservation-portal', area: 'reservations' });
    expect(go).toHaveBeenCalledWith(['/platform', 'areas', 'commercial-reservation-portal'], { queryParams: { area: 'reservations' } });
  });

  it('U·the_text_path_navigate_of_the_identity_portal_keeps_working', async () => {
    const { props, byPath, go } = await mounted({ params: { identifier: 'acme' }, remote: 'identity-audit-portal' });
    props.navigate('/t/acme');
    props.navigate('//evil.example');
    expect(byPath).toHaveBeenCalledTimes(1);
    expect(byPath).toHaveBeenCalledWith('/t/acme');
    expect(go).not.toHaveBeenCalled();
  });

  it('U·navigate_to_an_unknown_portal_shows_the_unavailable_area', async () => {
    const { fixture } = setup({ params: { identifier: 'acme', remote: 'ghost-portal' }, area: 'anything' });
    await until(fixture, () => expect(fixture.nativeElement.querySelector('[role="alert"]')).not.toBeNull());
    expect(fixture.nativeElement.textContent).toContain('ghost-portal is not available right now');
  });

  it('U·navigate_to_an_unknown_portal_asks_the_router_and_never_throws', async () => {
    const { props, go } = await mounted({ params: { identifier: 'acme', remote: 'cash-reporting-portal' } });
    expect(() => props.navigate({ portal: 'ghost-portal', area: 'x' })).not.toThrow();
    expect(go).toHaveBeenCalledWith(['/t', 'acme', 'areas', 'ghost-portal'], { queryParams: { area: 'x' } });
    go.mockRejectedValue(new Error('boom'));
    expect(() => props.navigate({ portal: 'cash-reporting-portal', area: 'cash' })).not.toThrow();
  });

  it('U·navigate_to_a_target_the_roles_cannot_use_does_nothing', async () => {
    const { props, go, client } = await mounted({ params: { identifier: 'acme', remote: 'cash-reporting-portal' } });
    client.store.of('acme').open(answer(jwt(['CLIENT'])));
    props.navigate({ portal: 'restricted-portal', area: 'x' });
    expect(go).not.toHaveBeenCalled();
    client.store.of('acme').close();
  });

  it('U·navigate_to_a_target_the_roles_can_use_opens_it', async () => {
    const { props, go, client } = await mounted({ params: { identifier: 'acme', remote: 'cash-reporting-portal' } });
    client.store.of('acme').open(answer(jwt(['ADMIN'])));
    props.navigate({ portal: 'restricted-portal', area: 'x' });
    expect(go).toHaveBeenCalledTimes(1);
    client.store.of('acme').close();
  });

  it('U·navigate_ignores_a_target_that_is_not_a_portal_and_an_area', async () => {
    const { props, go, byPath } = await mounted({ params: { identifier: 'acme', remote: 'cash-reporting-portal' } });
    const bad = [null, undefined, 42, {}, { portal: 'cash-reporting-portal' }, { portal: '', area: 'x' }, { portal: 'p', area: '' }, { portal: 1, area: 'x' }];
    for (const target of bad) expect(() => props.navigate(target)).not.toThrow();
    expect(go).not.toHaveBeenCalled();
    expect(byPath).not.toHaveBeenCalled();
  });

  it('U·the_general_login_has_no_area_to_open_so_a_target_does_nothing', async () => {
    const { props, go } = await mounted({ remote: 'identity-audit-portal', scope: 'general' });
    props.navigate({ portal: 'cash-reporting-portal', area: 'cash' });
    expect(go).not.toHaveBeenCalled();
  });

  it('U·portal_without_navigate_still_mounts', async () => {
    // A portal written before this amendment never calls navigate; the mount is the same.
    const { props } = await mounted({ params: { identifier: 'acme', remote: 'cash-reporting-portal' } });
    expect(props.apiClient).toBeDefined();
    expect(props.session.roles).toEqual([]);
  });

  it('U·a_manifest_entry_with_roles_still_mounts_from_its_url', async () => {
    const { mount } = await mounted({ params: { identifier: 'acme', remote: 'restricted-portal' } });
    expect(mount).toHaveBeenCalledTimes(1);
  });
});

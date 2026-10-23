import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { createContainerClient } from '../core/client/container';
import { CONTAINER_CLIENT } from '../core/client/container-client.token';
import { answer, jwt } from '../core/client/test-helpers';
import { MANIFEST_LOADER, ManifestEntry, REMOTE_IMPORTER } from '../core/federation/remote-loader';
import { PortalPageComponent } from './portal-page.component';

const MANIFEST: Record<string, ManifestEntry> = {
  'identity-audit-portal': { url: '/stubs/id.js', chrome: true },
  'commercial-reservation-portal': { url: '/stubs/com.js', chrome: true },
  'cash-reporting-portal': { url: '/stubs/cash.js', chrome: true },
  'plain-portal': '/stubs/plain.js',
};

interface Options {
  roles?: string[];
  remote?: string;
  /** The login: the identity portal fixed in the route data. */
  fixed?: string;
  platform?: boolean;
  area?: string;
}

function setup({ roles = ['TENANT_ADMINISTRATOR'], remote = 'commercial-reservation-portal', fixed, platform, area }: Options = {}) {
  const mount = vi.fn();
  const client = createContainerClient({ baseUrl: '', fetch: vi.fn() });
  const identifier = platform ? undefined : 'acme';
  if (roles.length) client.store.of(identifier).open(answer(jwt(roles)));
  const query = convertToParamMap(area ? { area } : {});
  const route = {
    paramMap: of(convertToParamMap({ ...(identifier ? { identifier } : {}), ...(fixed ? {} : { remote }) })),
    queryParamMap: of(query),
    snapshot: { data: fixed ? { remote: fixed } : {}, queryParamMap: query },
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
  const fixture = TestBed.createComponent(PortalPageComponent);
  fixture.detectChanges();
  return { fixture, mount, client, identifier, el: fixture.nativeElement as HTMLElement };
}

async function mounted(options?: Options) {
  const ctx = setup(options);
  await vi.waitFor(() => {
    ctx.fixture.detectChanges();
    expect(ctx.mount).toHaveBeenCalledTimes(1);
  });
  return { ...ctx, props: ctx.mount.mock.calls[0][1], done: () => ctx.client.store.of(ctx.identifier).close() };
}

describe('the operator sidebar around a mounted portal', () => {
  it('U·container_sets_chrome_for_an_operator_session_on_a_flagged_portal', async () => {
    const { props, el, done } = await mounted();
    expect(props.chrome).toBe('container');
    expect(el.querySelector('aside nav[aria-label="Navegación del operador"]')).not.toBeNull();
    done();
  });

  it('U·the_sidebar_shell_fills_the_viewport_like_the_mockup', async () => {
    const { el, done } = await mounted();
    expect(getComputedStyle(el.querySelector('.operator-shell') as HTMLElement).minHeight).toBe('100vh');
    done();
  });

  it('U·the_content_area_fills_its_column_up_to_1420px_like_the_mockup_whatever_a_portal_styles', async () => {
    const style = document.createElement('style');
    style.textContent = '.operator-content{width:min(100%,1240px)}';
    document.head.appendChild(style);
    try {
      const { el, done } = await mounted();
      const content = getComputedStyle(el.querySelector('.operator-content') as HTMLElement);
      expect(content.width).toBe('100%');
      expect(content.maxWidth).toBe('1420px');
      expect(getComputedStyle(el.querySelector('.operator-shell') as HTMLElement).background).toContain('#f5f7f7');
      done();
    } finally {
      style.remove();
    }
  });

  it('U·the_collaborator_sees_no_descuentos_nor_colaboradores', async () => {
    const { el, done } = await mounted({ roles: ['OPERATIONAL_COLLABORATOR'] });
    expect(el.textContent).not.toContain('Descuentos');
    expect(el.textContent).not.toContain('Colaboradores');
    expect(el.textContent).toContain('Colaborador operativo');
    done();
  });

  it('U·container_omits_chrome_on_a_portal_without_the_flag', async () => {
    const { props, el, done } = await mounted({ remote: 'plain-portal' });
    expect(props.chrome).toBeUndefined();
    expect(el.querySelector('aside')).toBeNull();
    done();
  });

  // Temporary adapter (identity-chrome-adapter.ts): identity still draws its own aside, so the slot says the container owns the bar.
  it('U·identity_slot_carries_the_chrome_attribute_only_inside_the_container_bar', async () => {
    const { el, props, done } = await mounted({ remote: 'identity-audit-portal' });
    expect(props.chrome).toBe('container');
    expect(el.querySelector('.operator-content[data-chrome="container"]')).not.toBeNull();
    done();
  });

  it('U·other_portals_get_no_chrome_attribute', async () => {
    const { el, done } = await mounted();
    expect(el.querySelector('[data-chrome]')).toBeNull();
    done();
  });

  it('U·the_sign_in_gets_neither_bar_nor_chrome_attribute', async () => {
    const { el } = await mounted({ fixed: 'identity-audit-portal', roles: [] });
    expect(el.querySelector('[data-chrome]')).toBeNull();
    expect(el.querySelector('aside')).toBeNull();
  });

  it('U·container_omits_chrome_on_the_sign_in', async () => {
    const { props, el } = await mounted({ fixed: 'identity-audit-portal', roles: [] });
    expect(props.chrome).toBeUndefined();
    expect(el.querySelector('aside')).toBeNull();
  });

  it('U·container_omits_chrome_for_the_customer', async () => {
    const { props, el, done } = await mounted({ roles: ['FINAL_CUSTOMER'] });
    expect(props.chrome).toBeUndefined();
    expect(el.querySelector('aside')).toBeNull();
    done();
  });

  it('U·container_omits_chrome_under_the_platform', async () => {
    const { props, el, done } = await mounted({ platform: true });
    expect(props.chrome).toBeUndefined();
    expect(el.querySelector('aside')).toBeNull();
    done();
  });

  it('U·the_open_entry_is_marked_and_the_area_reaches_the_portal_as_initial_params', async () => {
    const { props, el, done } = await mounted({ area: 'catalog' });
    expect(props.initialParams).toEqual({ area: 'catalog' });
    expect(el.querySelector('[aria-current="page"]')?.textContent).toContain('Catálogos');
    done();
  });

  it('U·cerrar_sesion_closes_the_session', async () => {
    const { el, client } = await mounted();
    (Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.includes('Cerrar sesión')) as HTMLButtonElement).click();
    expect(client.store.of('acme').token).toBeNull();
  });
});

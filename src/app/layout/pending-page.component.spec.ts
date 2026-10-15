import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { createContainerClient } from '../core/client/container';
import { CONTAINER_CLIENT } from '../core/client/container-client.token';
import { answer, jwt } from '../core/client/test-helpers';
import { MANIFEST_LOADER, ManifestEntry } from '../core/federation/remote-loader';
import { PendingPageComponent } from './pending-page.component';

const MANIFEST: Record<string, ManifestEntry> = {
  'identity-audit-portal': { url: '/stubs/id.js', chrome: true },
  'commercial-reservation-portal': { url: '/stubs/com.js', chrome: true },
};

async function render(area: string | undefined, roles = ['TENANT_ADMINISTRATOR']) {
  const fetch = vi.fn();
  const client = createContainerClient({ baseUrl: '', fetch });
  if (roles.length) client.store.of('acme').open(answer(jwt(roles)));
  const route = {
    paramMap: of(convertToParamMap({ identifier: 'acme' })),
    queryParamMap: of(convertToParamMap(area ? { area } : {})),
    snapshot: { data: {} },
  };
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: ActivatedRoute, useValue: route },
      { provide: CONTAINER_CLIENT, useValue: client },
      { provide: MANIFEST_LOADER, useValue: () => Promise.resolve(MANIFEST) },
    ],
  });
  const fixture = TestBed.createComponent(PendingPageComponent);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return { el: fixture.nativeElement as HTMLElement, fetch, client };
}

describe('blank screen of the pending entries', () => {
  it.each([['salidas', 'Salidas'], ['operacion', 'Operación'], ['colaboradores', 'Colaboradores']])(
    'U·%s_draws_the_single_sidebar_with_the_entry_active_and_an_empty_content',
    async (area, label) => {
      const { el, fetch } = await render(area);
      expect(el.querySelector('aside nav[aria-label="Navegación del operador"]')).not.toBeNull();
      expect(el.querySelector('aside [aria-current="page"]')?.textContent).toContain(label);
      const content = el.querySelector('.operator-content') as HTMLElement;
      expect(content.querySelector('h1.visually-hidden')?.textContent?.trim()).toBe(label);
      expect(content.textContent?.trim()).toBe(label);
      expect(fetch).not.toHaveBeenCalled();
    },
  );

  it('U·an_unknown_area_is_not_found', async () => {
    const { el } = await render('inventada');
    expect(el.querySelector('aside')).toBeNull();
  });

  it('U·a_missing_area_is_not_found', async () => {
    const { el } = await render(undefined);
    expect(el.querySelector('aside')).toBeNull();
  });

  it('U·the_customer_never_gets_the_operator_sidebar', async () => {
    const { el } = await render('salidas', ['FINAL_CUSTOMER']);
    expect(el.querySelector('aside')).toBeNull();
  });

  it('U·cerrar_sesion_closes_the_session', async () => {
    const { el, client } = await render('salidas');
    (Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.includes('Cerrar sesión')) as HTMLButtonElement).click();
    expect(client.store.of('acme').token).toBeNull();
  });
});

describe('route of the blank screen', () => {
  it('U·areas_pendiente_is_protected_and_declared_before_the_generic_area_route', async () => {
    const { routes } = await import('../app.routes');
    const tenant = routes.find((r) => r.path === 't/:identifier');
    const paths = (tenant?.children ?? []).map((r) => r.path);
    expect(paths.indexOf('areas/pendiente')).toBeGreaterThanOrEqual(0);
    expect(paths.indexOf('areas/pendiente')).toBeLessThan(paths.indexOf('areas/:remote'));
    expect(tenant?.children?.find((r) => r.path === 'areas/pendiente')?.canActivate?.length).toBe(1);
  });
});

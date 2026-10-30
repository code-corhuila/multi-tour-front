import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { createContainerClient } from '../core/client/container';
import { CONTAINER_CLIENT } from '../core/client/container-client.token';
import { answer, jwt } from '../core/client/test-helpers';
import { MANIFEST_LOADER, ManifestEntry, REMOTE_IMPORTER } from '../core/federation/remote-loader';
import { initialParamsOf, navigationParams } from './initial-params';
import { PortalPageComponent } from './portal-page.component';

const MANIFEST: Record<string, ManifestEntry> = {
  'commercial-reservation-portal': { url: '/stubs/com.js', chrome: true },
  'plain-portal': '/stubs/plain.js',
};

function setup(query: Record<string, string | string[]>, remote = 'commercial-reservation-portal') {
  const mount = vi.fn();
  const client = createContainerClient({ baseUrl: '', fetch: vi.fn() });
  client.store.of('acme').open(answer(jwt(['TENANT_ADMINISTRATOR'])));
  const map = convertToParamMap(query);
  const route = {
    paramMap: of(convertToParamMap({ identifier: 'acme', remote })),
    queryParamMap: of(map),
    snapshot: { data: {}, queryParamMap: map },
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
  const go = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  const fixture = TestBed.createComponent(PortalPageComponent);
  fixture.detectChanges();
  return { fixture, mount, go, done: () => client.store.of('acme').close() };
}

async function mounted(query: Record<string, string | string[]>, remote?: string) {
  const ctx = setup(query, remote);
  await vi.waitFor(() => {
    ctx.fixture.detectChanges();
    expect(ctx.mount).toHaveBeenCalledTimes(1);
  });
  return { ...ctx, props: ctx.mount.mock.calls[0][1] };
}

describe('initialParams from the address (HU-COM-008)', () => {
  it('U·the_area_and_the_other_query_values_reach_the_portal', async () => {
    const { props, done } = await mounted({ area: 'reserve', tour: 't-1', reservation: 'r-7' });
    expect(props.initialParams).toEqual({ area: 'reserve', tour: 't-1', reservation: 'r-7' });
    done();
  });

  it('U·only_the_area_keeps_the_old_shape', async () => {
    const { props, done } = await mounted({ area: 'catalog' });
    expect(props.initialParams).toEqual({ area: 'catalog' });
    done();
  });

  it('U·no_query_means_no_initial_params', async () => {
    const { props, done } = await mounted({});
    expect(props.initialParams).toBeUndefined();
    done();
  });

  it('U·a_portal_without_chrome_gets_them_too', async () => {
    const { props, done } = await mounted({ area: 'reserve', tour: 't-1' }, 'plain-portal');
    expect(props.initialParams).toEqual({ area: 'reserve', tour: 't-1' });
    done();
  });

  it('U·the_return_url_never_reaches_the_portal', async () => {
    const { props, done } = await mounted({ area: 'reserve', returnUrl: '/t/acme/areas/x', tour: 't-1' });
    expect(props.initialParams).toEqual({ area: 'reserve', tour: 't-1' });
    done();
  });

  it('U·navigate_with_params_puts_them_in_the_address_next_to_the_area', async () => {
    const { props, go, done } = await mounted({ area: 'catalog' });
    props.navigate({ portal: 'commercial-reservation-portal', area: 'reserve', params: { tour: 't-1' } });
    expect(go).toHaveBeenCalledWith(['/t', 'acme', 'areas', 'commercial-reservation-portal'], { queryParams: { tour: 't-1', area: 'reserve' } });
    done();
  });

  it('U·navigate_drops_params_that_are_not_plain_strings', async () => {
    const { props, go, done } = await mounted({ area: 'catalog' });
    props.navigate({ portal: 'commercial-reservation-portal', area: 'reserve', params: { tour: 't-1', n: 5, o: { a: 1 }, empty: '', area: 'hijack' } });
    expect(go).toHaveBeenCalledWith(['/t', 'acme', 'areas', 'commercial-reservation-portal'], { queryParams: { tour: 't-1', area: 'reserve' } });
    done();
  });
});

describe('initialParamsOf', () => {
  const of_ = (q: Record<string, string | string[]>) => initialParamsOf(convertToParamMap(q));

  it('U·keeps_plain_strings_and_ignores_empty_ones', () => {
    expect(of_({ area: 'a', tour: 't', blank: '', spaces: '   ' })).toEqual({ area: 'a', tour: 't' });
  });

  it('U·takes_the_first_value_of_a_repeated_key', () => {
    expect(of_({ tour: ['t-1', 't-2'] })).toEqual({ tour: 't-1' });
  });

  it('U·ignores_keys_that_are_not_plain_names', () => {
    expect(of_({ '__proto__': 'x', constructor: 'x', 'a b': 'x', '<script>': 'x', '1abc': 'x', ok: 'x' })).toEqual({ ok: 'x' });
  });

  it('U·ignores_control_characters_and_very_long_values', () => {
    expect(of_({ a: 'x\u0000y', b: 'x\ny', c: 'z'.repeat(201), d: 'z'.repeat(200) })).toEqual({ d: 'z'.repeat(200) });
  });

  it('U·keeps_at_most_ten_entries', () => {
    const q = Object.fromEntries(Array.from({ length: 15 }, (_, i) => [`k${i}`, 'v']));
    expect(Object.keys(of_(q) ?? {})).toHaveLength(10);
  });

  it('U·the_result_has_no_inherited_members', () => {
    const result = of_({ tour: 't' }) as Record<string, unknown>;
    expect(result['toString']).toBe(Object.prototype.toString);
    expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
  });
});

describe('navigationParams', () => {
  it('U·rejects_anything_that_is_not_a_plain_object', () => {
    expect(navigationParams(undefined)).toEqual({});
    expect(navigationParams('tour=1')).toEqual({});
    expect(navigationParams(['a'])).toEqual({});
    expect(navigationParams(null)).toEqual({});
  });

  it('U·never_carries_area_or_the_return_url', () => {
    expect(navigationParams({ area: 'x', returnUrl: '/y', tour: 't' })).toEqual({ tour: 't' });
  });
});

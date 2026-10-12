import { describe, expect, it, vi } from 'vitest';
import { createContainerClient } from './container';
import { answer, json, jwt } from './test-helpers';

const BASE = 'https://gateway.test';
const make = (fetchMock = vi.fn().mockResolvedValue(json(200, {}))) =>
  createContainerClient({ baseUrl: BASE, fetch: fetchMock as unknown as typeof fetch });

describe('mount scope', () => {
  it('U-scope_is_general_platform_or_tenant_and_the_general_one_has_no_identifier', () => {
    const { propsFor } = make();
    expect(propsFor(undefined, 'general').scope).toBe('general');
    expect('identifier' in propsFor(undefined, 'general')).toBe(false);
    expect(propsFor().scope).toBe('platform');
    expect(propsFor('acme').scope).toBe('tenant');
  });

  it('U-general_session_opens_under_the_identifier_typed_and_never_as_the_platform', () => {
    const { propsFor, store } = make();
    propsFor(undefined, 'general').session.open(answer(jwt(['ADMIN'])), 'acme');
    expect(store.of('acme').token).toBe(jwt(['ADMIN']));
    expect(store.of().token).toBeNull();
    store.of('acme').close();
  });

  it('U-general_client_carries_the_token_it_opened_and_a_new_mount_of_the_tenant_shares_it', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(200, {}));
    const { propsFor, store } = make(fetchMock);
    const general = propsFor(undefined, 'general');
    await general.apiClient.request('/x');
    expect(fetchMock.mock.calls[0][1].headers['Authorization']).toBeUndefined();

    general.session.open(answer(jwt(['ADMIN'])), 'acme');
    await general.apiClient.request('/x');
    expect(fetchMock.mock.calls[1][1].headers['Authorization']).toBe(`Bearer ${jwt(['ADMIN'])}`);

    await propsFor('acme').apiClient.request('/x');
    expect(fetchMock.mock.calls[2][1].headers['Authorization']).toBe(`Bearer ${jwt(['ADMIN'])}`);
    store.of('acme').close();
  });

  it('U-general_session_rejects_a_missing_or_malformed_identifier_and_opens_nothing', () => {
    const { propsFor, store } = make();
    const { session } = propsFor(undefined, 'general');
    for (const bad of [undefined, '', '../x', 'a b', 'ACME', '-acme', 'a'.repeat(41)]) {
      expect(() => session.open(answer(), bad), String(bad)).toThrow();
    }
    expect(store.of().token).toBeNull();
  });

  it('U-tenant_and_platform_sessions_ignore_an_identifier_passed_to_open', () => {
    const { propsFor, store } = make();
    propsFor('acme').session.open(answer(jwt(['A'])), 'other');
    expect(store.of('acme').token).toBe(jwt(['A']));
    expect(store.of('other').token).toBeNull();
    propsFor().session.open(answer(jwt(['P'])), 'other');
    expect(store.of().token).toBe(jwt(['P']));
    expect(store.of('other').token).toBeNull();
    store.of('acme').close();
    store.of().close();
  });
});
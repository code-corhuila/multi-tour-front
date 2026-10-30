import { describe, expect, it, vi } from 'vitest';
import { createContainerClient } from './container';
import { answer, json, jwt } from './test-helpers';

const BASE = 'https://gateway.test';

function make() {
  const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(json(200, { ok: true })));
  return { fetchMock, client: createContainerClient({ baseUrl: BASE, fetch: fetchMock as unknown as typeof fetch }) };
}

describe('anonymous mount props (HU-COM-006, G-PUB)', () => {
  it('U·anonymous_props_are_a_tenant_mount_with_no_roles', () => {
    const { client } = make();
    const props = client.anonymousPropsFor('acme');
    expect(props.scope).toBe('tenant');
    expect(props.identifier).toBe('acme');
    expect(props.session.roles).toEqual([]);
    expect(props.session.permissions ?? []).toEqual([]);
    expect(props.session.access).toBeUndefined();
    expect(props.session.displayName).toBeUndefined();
  });

  it('U·anonymous_client_sends_no_authorization_even_when_the_tenant_has_a_session', async () => {
    const { client, fetchMock } = make();
    client.store.of('acme').open(answer(jwt(['ADMIN'])));
    await client.anonymousPropsFor('acme').apiClient.request('/api/v1/public/tours');
    const headers = fetchMock.mock.calls[0][1].headers as Record<string, string>;
    expect(Object.keys(headers).map((h) => h.toLowerCase())).not.toContain('authorization');
    expect(headers['X-Correlation-Id']).toBeTruthy();
    client.store.of('acme').close();
  });

  it('U·anonymous_401_does_not_end_the_session_of_the_tenant', async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(json(401, { error: 'UNAUTHORIZED' })));
    const client = createContainerClient({ baseUrl: BASE, fetch: fetchMock as unknown as typeof fetch });
    client.store.of('acme').open(answer(jwt(['ADMIN'])));
    await expect(client.anonymousPropsFor('acme').apiClient.request('/api/v1/public/tours')).rejects.toMatchObject({ status: 401 });
    expect(client.store.of('acme').token).not.toBeNull();
    client.store.of('acme').close();
  });

  it('U·anonymous_session_cannot_open_or_close_the_real_session', () => {
    const { client } = make();
    client.store.of('acme').open(answer(jwt(['ADMIN'])));
    const { session } = client.anonymousPropsFor('acme');
    session.open(answer(jwt(['ADMIN'])), 'other');
    session.close();
    expect(client.store.of('acme').token).not.toBeNull();
    expect(client.store.of('other').token).toBeNull();
    client.store.of('acme').close();
  });

  it('U·anonymous_props_need_a_valid_identifier', () => {
    const { client } = make();
    expect(() => client.anonymousPropsFor('Bad Id')).toThrow();
  });
});

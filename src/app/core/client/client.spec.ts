import { afterEach, describe, expect, it, vi } from 'vitest';
import { messageFor } from './api-client';
import { createContainerClient, REFRESH_PATH } from './container';
import { answer, json, jwt } from './test-helpers';

const BASE = 'https://gateway.test';

function headersOf(fetchMock: ReturnType<typeof vi.fn>, call: number): Record<string, string> {
  return fetchMock.mock.calls[call][1].headers;
}

afterEach(() => {
  vi.useRealTimers();
  localStorage.clear();
  sessionStorage.clear();
});

describe('client', () => {
  it('U·client_adds_authorization_and_new_correlation', async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(json(200, { ok: true })));
    const { propsFor } = createContainerClient({ baseUrl: BASE, fetch: fetchMock });
    const props = propsFor('acme');
    props.session.open(answer(jwt([]), 'x'.repeat(24)));

    await props.apiClient.request('/api/v1/things');
    await props.apiClient.request('/api/v1/things');

    expect(fetchMock.mock.calls[0][0]).toBe(`${BASE}/api/v1/things`);
    const [first, second] = [headersOf(fetchMock, 0), headersOf(fetchMock, 1)];
    expect(first['Authorization']).toBe(`Bearer ${jwt([])}`);
    expect(first['X-Correlation-Id']).toBeTruthy();
    expect(second['X-Correlation-Id']).toBeTruthy();
    expect(second['X-Correlation-Id']).not.toBe(first['X-Correlation-Id']);
    props.session.close();
  });

  it('U·request_times_out_after_10_s_with_TIMEOUT', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) =>
          init.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError'))),
        ),
    );
    const { propsFor } = createContainerClient({ baseUrl: BASE, fetch: fetchMock });

    const outcome = expect(propsFor('acme').apiClient.request('/slow')).rejects.toMatchObject({ code: 'TIMEOUT' });
    await vi.advanceTimersByTimeAsync(10_000);
    await outcome;
  });

  it('U·401_closes_the_session', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(401, { error: 'UNAUTHORIZED', message: 'x', traceId: 't-1' }));
    const { propsFor, store } = createContainerClient({ baseUrl: BASE, fetch: fetchMock });
    const props = propsFor('acme');
    props.session.open(answer());
    expect(store.of('acme').token).not.toBeNull();

    await expect(props.apiClient.request('/api/v1/things')).rejects.toMatchObject({ status: 401 });

    expect(store.of('acme').token).toBeNull();
  });

  it('U·one_place_maps_status_to_message_with_traceId', async () => {
    const statuses = [400, 401, 403, 404, 422, 429, 500, 503];
    const messages = new Set<string>();
    for (const status of statuses) {
      const fetchMock = vi.fn().mockResolvedValue(json(status, { error: 'SOME_CODE', message: 'server text', traceId: `t-${status}` }));
      const { propsFor } = createContainerClient({ baseUrl: BASE, fetch: fetchMock });
      const error = await propsFor('acme').apiClient.request('/x').catch((e: unknown) => e);
      expect(error).toMatchObject({ status, code: 'SOME_CODE', traceId: `t-${status}`, message: messageFor(status, 'SOME_CODE') });
      messages.add((error as { message: string }).message);
    }
    expect(messages.size).toBe(statuses.length);

    const noBody = vi.fn().mockResolvedValue(new Response('<html>bad gateway</html>', { status: 502 }));
    const { propsFor } = createContainerClient({ baseUrl: BASE, fetch: noBody });
    const error = (await propsFor('acme').apiClient.request('/x').catch((e: unknown) => e)) as { traceId: string };
    expect(error.traceId).toBe(headersOf(noBody, 0)['X-Correlation-Id']);
  });

  it('U·sessions_are_kept_per_identifier', () => {
    const { store } = createContainerClient({ baseUrl: BASE, fetch: vi.fn() });
    store.of('acme').open(answer(jwt(['ADMIN'])));
    store.of('beta').open(answer(jwt(['CUSTOMER'])));

    expect(store.of('acme').roles).toEqual(['ADMIN']);
    expect(store.of('beta').roles).toEqual(['CUSTOMER']);
    store.of('beta').close();
    expect(store.of('beta').token).toBeNull();
    expect(store.of('acme').token).toBe(jwt(['ADMIN']));
    store.of('acme').close();
  });

  it('U·no_token_in_web_storage', async () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(json(200, {})));
    const { propsFor, store } = createContainerClient({ baseUrl: BASE, fetch: fetchMock });
    const props = propsFor('acme');
    props.session.open(answer());
    await props.apiClient.request('/x');

    expect(store.of('acme').token).toBe(answer().accessToken);
    expect(setItem).not.toHaveBeenCalled();
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
    props.session.close();
    setItem.mockRestore();
  });

  it('U·session_renews_before_15_minutes_with_the_refresh_token', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockResolvedValue(json(200, answer(jwt(['ADMIN']), 'n'.repeat(24))));
    const { store } = createContainerClient({ baseUrl: BASE, fetch: fetchMock });
    store.of('acme').open(answer(jwt(['OLD']), 'o'.repeat(24)));

    await vi.advanceTimersByTimeAsync(840_000);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(`${BASE}${REFRESH_PATH}`);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ refreshToken: 'o'.repeat(24) });
    expect(store.of('acme').roles).toEqual(['ADMIN']);
    store.of('acme').close();
  });
});

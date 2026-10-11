import { describe, expect, it, vi } from 'vitest';
import { createContainerClient } from './container';
import { answer, json, jwt } from './test-helpers';

const BASE = 'https://gateway.test';

function setup(fetchMock: ReturnType<typeof vi.fn>, identifier = 'acme') {
  const container = createContainerClient({ baseUrl: BASE, fetch: fetchMock });
  return { ...container, props: container.propsFor(identifier) };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

describe('requests', () => {
  it('U·identifier_is_handed_to_the_portal_and_omitted_for_the_platform', () => {
    const { propsFor } = setup(vi.fn());
    expect(propsFor('acme').identifier).toBe('acme');
    expect('identifier' in propsFor()).toBe(false);
  });

  it('U·request_path_must_stay_on_the_gateway', async () => {
    const fetchMock = vi.fn();
    const { props } = setup(fetchMock);
    for (const path of ['//evil.test/x', 'https://evil.test/x', 'api/v1/x', '/a\\b', '/go?u=http://evil.test']) {
      await expect(props.apiClient.request(path)).rejects.toMatchObject({ code: 'INVALID_PATH' });
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('U·401_of_an_older_token_does_not_close_a_newer_session', async () => {
    const pending = deferred<Response>();
    const { props, store } = setup(vi.fn().mockReturnValue(pending.promise));
    props.session.open(answer(jwt(['OLD'])));
    const request = props.apiClient.request('/x').catch((e: unknown) => e);

    props.session.open(answer(jwt(['NEW'])));
    pending.resolve(json(401, { error: 'UNAUTHORIZED', message: 'x', traceId: 't' }));

    expect(await request).toMatchObject({ status: 401 });
    expect(store.of('acme').token).toBe(jwt(['NEW']));
    props.session.close();
  });

  it('U·401_on_change_own_password_does_not_close_the_session', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(401, { error: 'UNAUTHORIZED', message: 'x', traceId: 't' }));
    const { props, store } = setup(fetchMock);
    props.session.open(answer());

    await expect(
      props.apiClient.request('/api/v1/security/sessions/password', { method: 'PUT', body: {} }),
    ).rejects.toMatchObject({ status: 401 });

    expect(store.of('acme').token).not.toBeNull();
    props.session.close();
  });

  it('U·an_aborted_signal_rejects_with_ABORTED_without_calling_fetch', async () => {
    const fetchMock = vi.fn();
    const { props } = setup(fetchMock);
    const controller = new AbortController();
    controller.abort();

    await expect(props.apiClient.request('/x', { signal: controller.signal })).rejects.toMatchObject({ code: 'ABORTED' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('U·abort_in_flight_is_ABORTED_and_the_listener_is_removed', async () => {
    const fetchMock = vi.fn().mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) =>
          init.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError'))),
        ),
    );
    const { props } = setup(fetchMock);
    const controller = new AbortController();
    const remove = vi.spyOn(controller.signal, 'removeEventListener');

    const outcome = expect(props.apiClient.request('/x', { signal: controller.signal })).rejects.toMatchObject({ code: 'ABORTED' });
    controller.abort();
    await outcome;

    expect(remove).toHaveBeenCalledWith('abort', expect.any(Function));
  });

  it('U·caller_headers_cannot_replace_authorization_or_correlation', async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(json(200, {})));
    const { props } = setup(fetchMock);
    props.session.open(answer(jwt([])));

    await props.apiClient.request('/x', {
      headers: { authorization: 'Bearer stolen', 'x-correlation-id': 'mine', 'Idempotency-Key': 'key-12345' },
    });

    const sent = fetchMock.mock.calls[0][1].headers as Record<string, string>;
    expect(sent['Authorization']).toBe(`Bearer ${jwt([])}`);
    expect(sent['X-Correlation-Id']).not.toBe('mine');
    expect(sent['Idempotency-Key']).toBe('key-12345');
    expect(Object.keys(sent).filter((k) => /^(authorization|x-correlation-id)$/i.test(k))).toHaveLength(2);
    props.session.close();
  });

  it('U·a_2xx_with_invalid_json_is_INVALID_RESPONSE', async () => {
    const { props } = setup(vi.fn().mockResolvedValue(new Response('<html>', { status: 200 })));
    await expect(props.apiClient.request('/x')).rejects.toMatchObject({ status: 200, code: 'INVALID_RESPONSE' });
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApiClient, messageFor } from './api-client';
import { json } from './test-helpers';

const BASE = 'https://gateway.test';

function clientWith(fetchMock: ReturnType<typeof vi.fn>) {
  return createApiClient({ baseUrl: BASE, token: () => 'tkn', onUnauthorized: () => undefined, fetch: fetchMock as unknown as typeof fetch });
}

function hangingFetch() {
  return vi.fn().mockImplementation(
    (_url: string, init: RequestInit) =>
      new Promise((_resolve, reject) =>
        init.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError'))),
      ),
  );
}

afterEach(() => {
  vi.useRealTimers();
});

describe('client with FormData bodies', () => {
  it('U·form_data_body_is_sent_as_is_without_content_type', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(201, { id: 'e-1' }));
    const form = new FormData();
    form.append('name', 'Hotel');
    form.append('image', new Blob(['x'], { type: 'image/png' }), 'a.png');

    await clientWith(fetchMock).request('/api/v1/establishments', {
      method: 'POST',
      body: form,
      headers: { 'Idempotency-Key': 'k-1', Authorization: 'Bearer evil', 'x-correlation-id': 'evil' },
    });

    const init = fetchMock.mock.calls[0][1];
    expect(init.body).toBe(form);
    const headers = init.headers as Record<string, string>;
    expect(Object.keys(headers).map((h) => h.toLowerCase())).not.toContain('content-type');
    expect(headers['Authorization']).toBe('Bearer tkn');
    expect(headers['X-Correlation-Id']).not.toBe('evil');
    expect(headers['Idempotency-Key']).toBe('k-1');
  });

  it('U·json_body_keeps_json_content_type_and_stringify', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(200, {}));
    await clientWith(fetchMock).request('/x', { method: 'POST', body: { a: 1 } });
    const init = fetchMock.mock.calls[0][1];
    expect(init.body).toBe('{"a":1}');
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json');
  });

  it('U·form_data_uses_30_s_timeout', async () => {
    vi.useFakeTimers();
    const outcome = clientWith(hangingFetch())
      .request('/x', { method: 'POST', body: new FormData() })
      .then(() => 'ok', (e: { code: string }) => e.code);
    await vi.advanceTimersByTimeAsync(10_000);
    await vi.advanceTimersByTimeAsync(19_999);
    let settled = false;
    void outcome.then(() => (settled = true));
    await Promise.resolve();
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(await outcome).toBe('TIMEOUT');
  });

  it('U·json_request_keeps_10_s_timeout', async () => {
    vi.useFakeTimers();
    const outcome = clientWith(hangingFetch())
      .request('/x', { method: 'POST', body: { a: 1 } })
      .then(() => 'ok', (e: { code: string }) => e.code);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(await outcome).toBe('TIMEOUT');
  });

  it('U·413_and_415_have_their_own_message_with_traceId_and_details', async () => {
    for (const [status, text] of [
      [413, 'The file is too large.'],
      [415, 'This file type is not allowed.'],
    ] as const) {
      const fetchMock = vi
        .fn()
        .mockResolvedValue(
          json(status, { error: 'SOME_CODE', message: 'x', traceId: `t-${status}`, details: [{ field: 'image', message: 'bad' }] }),
        );
      const error = await clientWith(fetchMock).request('/x').catch((e: unknown) => e);
      expect(messageFor(status, 'SOME_CODE')).toBe(text);
      expect(error).toMatchObject({
        status,
        code: 'SOME_CODE',
        traceId: `t-${status}`,
        message: text,
        details: [{ field: 'image', message: 'bad' }],
      });
    }
  });
});

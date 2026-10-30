import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApiClient } from './api-client';
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

describe('client with a timeout per request (HU-COM-009)', () => {
  it('U·timeout_ms_longer_than_default_keeps_the_request_alive_past_10s', async () => {
    vi.useFakeTimers();
    const fetchMock = hangingFetch();
    const pending = clientWith(fetchMock).request('/api/v1/payments', { method: 'POST', body: {}, timeoutMs: 80_000 });
    const settled = vi.fn();
    pending.catch(settled);
    await vi.advanceTimersByTimeAsync(79_000);
    expect(settled).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(2_000);
    await expect(pending).rejects.toMatchObject({ code: 'TIMEOUT' });
  });

  it('U·default_timeout_stays_10s_without_timeout_ms', async () => {
    vi.useFakeTimers();
    const pending = clientWith(hangingFetch()).request('/api/v1/payments');
    const assertion = expect(pending).rejects.toMatchObject({ code: 'TIMEOUT' });
    await vi.advanceTimersByTimeAsync(10_001);
    await assertion;
  });

  it('U·form_data_default_stays_30s_without_timeout_ms', async () => {
    vi.useFakeTimers();
    const pending = clientWith(hangingFetch()).request('/api/v1/establishments', { method: 'POST', body: new FormData() });
    const settled = vi.fn();
    pending.catch(settled);
    await vi.advanceTimersByTimeAsync(29_000);
    expect(settled).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(2_000);
    await expect(pending).rejects.toMatchObject({ code: 'TIMEOUT' });
  });

  it('U·timeout_ms_shorter_than_default_applies', async () => {
    vi.useFakeTimers();
    const pending = clientWith(hangingFetch()).request('/api/v1/payments', { timeoutMs: 2_000 });
    const assertion = expect(pending).rejects.toMatchObject({ code: 'TIMEOUT' });
    await vi.advanceTimersByTimeAsync(2_001);
    await assertion;
  });

  it.each([0, -5, Number.NaN, Number.POSITIVE_INFINITY, 'x' as unknown as number])(
    'U·invalid_timeout_ms_%s_falls_back_to_the_default',
    async (bad) => {
      vi.useFakeTimers();
      const pending = clientWith(hangingFetch()).request('/api/v1/payments', { timeoutMs: bad });
      const assertion = expect(pending).rejects.toMatchObject({ code: 'TIMEOUT' });
      await vi.advanceTimersByTimeAsync(10_001);
      await assertion;
    },
  );

  it('U·timeout_ms_is_capped_so_a_portal_cannot_hold_a_request_forever', async () => {
    vi.useFakeTimers();
    const pending = clientWith(hangingFetch()).request('/api/v1/payments', { timeoutMs: 3_600_000 });
    const assertion = expect(pending).rejects.toMatchObject({ code: 'TIMEOUT' });
    await vi.advanceTimersByTimeAsync(120_001);
    await assertion;
  });

  it('U·a_fast_answer_is_unaffected_by_timeout_ms', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(200, { ok: true }));
    await expect(clientWith(fetchMock).request('/api/v1/payments', { timeoutMs: 80_000 })).resolves.toEqual({ ok: true });
  });
});

import { describe, expect, it, vi } from 'vitest';
import { createApiClient } from './api-client';
import { json } from './test-helpers';

const BASE = 'https://gateway.test';

function clientWith(fetchMock: ReturnType<typeof vi.fn>) {
  return createApiClient({ baseUrl: BASE, token: () => 'tkn', onUnauthorized: () => undefined, fetch: fetchMock as unknown as typeof fetch });
}

describe('client with responseType blob (HU-COM-010)', () => {
  it('U·blob_response_returns_the_bytes_and_type_with_the_authorization', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('%PDF', { status: 200, headers: { 'Content-Type': 'application/pdf' } }));
    const result = await clientWith(fetchMock).request<Blob>('/api/v1/payments/p-1/proof', { responseType: 'blob' });

    expect(result).toBeInstanceOf(Blob);
    expect(result.type).toBe('application/pdf');
    expect(result.size).toBe(4);
    const headers = fetchMock.mock.calls[0][1].headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer tkn');
    expect(headers['Accept']).toBe('*/*');
  });

  it('U·default_response_type_still_parses_json_and_asks_for_json', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(200, { ok: true }));
    await expect(clientWith(fetchMock).request('/api/v1/x')).resolves.toEqual({ ok: true });
    expect((fetchMock.mock.calls[0][1].headers as Record<string, string>)['Accept']).toBe('application/json');
  });

  it('U·explicit_json_response_type_behaves_as_the_default', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(200, { ok: true }));
    await expect(clientWith(fetchMock).request('/api/v1/x', { responseType: 'json' })).resolves.toEqual({ ok: true });
  });

  it('U·blob_request_error_keeps_the_envelope_and_the_message', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(404, { error: 'PROOF_NOT_FOUND', traceId: 't-9' }));
    await expect(clientWith(fetchMock).request('/api/v1/payments/p-1/proof', { responseType: 'blob' })).rejects.toMatchObject({
      status: 404,
      code: 'PROOF_NOT_FOUND',
      traceId: 't-9',
    });
  });

  it('U·blob_request_unauthorized_still_ends_the_session', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(401, { error: 'UNAUTHORIZED' }));
    const onUnauthorized = vi.fn();
    const client = createApiClient({ baseUrl: BASE, token: () => 'tkn', onUnauthorized, fetch: fetchMock as unknown as typeof fetch });
    await expect(client.request('/api/v1/payments/p-1/proof', { responseType: 'blob' })).rejects.toMatchObject({ status: 401 });
    expect(onUnauthorized).toHaveBeenCalledWith('tkn');
  });

  it('U·unknown_response_type_is_ignored_and_json_is_used', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(200, { ok: true }));
    await expect(clientWith(fetchMock).request('/api/v1/x', { responseType: 'arraybuffer' as unknown as 'blob' })).resolves.toEqual({ ok: true });
  });
});

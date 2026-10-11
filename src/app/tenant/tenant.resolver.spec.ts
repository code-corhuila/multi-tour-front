import { describe, expect, it, vi } from 'vitest';
import { ApiClient, ApiError } from '../core/client/types';
import { lookupTenant } from './tenant.resolver';

const failing = (status: number): ApiError => ({ status, code: 'X', message: 'm', traceId: 't' });
const clientAnswering = (outcome: () => Promise<unknown>) =>
  ({ request: vi.fn(outcome) }) as unknown as ApiClient & { request: ReturnType<typeof vi.fn> };

describe('lookupTenant', () => {
  it('asks the public route of identity-audit by identifier', async () => {
    const client = clientAnswering(async () => ({ identifier: 'acme', commercialName: 'Acme', tenantStatus: 'ACTIVE' }));
    await lookupTenant(client, 'acme');
    expect(client.request).toHaveBeenCalledWith('/api/v1/identity-audit/public/tenants/acme');
  });

  it('is active for an ACTIVE profile', async () => {
    const profile = { identifier: 'acme', commercialName: 'Acme', tenantStatus: 'ACTIVE' };
    expect(await lookupTenant(clientAnswering(async () => profile), 'acme')).toEqual({ state: 'active', profile });
  });

  it('is inactive for an INACTIVE profile', async () => {
    const profile = { identifier: 'acme', commercialName: 'Acme', tenantStatus: 'INACTIVE' };
    expect(await lookupTenant(clientAnswering(async () => profile), 'acme')).toEqual({ state: 'inactive', profile });
  });

  it('is unknown on 404 and on 401 (a path that is not an identifier)', async () => {
    for (const status of [404, 401]) {
      const client = clientAnswering(() => Promise.reject(failing(status)));
      expect(await lookupTenant(client, 'nope')).toEqual({ state: 'unknown' });
    }
  });

  it('is unknown, without any request, for something that is not an identifier', async () => {
    const client = clientAnswering(async () => ({}));
    expect(await lookupTenant(client, 'ACME/../x')).toEqual({ state: 'unknown' });
    expect(client.request).not.toHaveBeenCalled();
  });

  it('is an error with the common message for any other failure', async () => {
    const client = clientAnswering(() => Promise.reject({ ...failing(503), message: 'down' }));
    expect(await lookupTenant(client, 'acme')).toEqual({ state: 'error', message: 'down' });
  });
});
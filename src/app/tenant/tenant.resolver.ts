import { inject } from '@angular/core';
import { ResolveFn } from '@angular/router';
import { messageFor } from '../core/client/api-client';
import { CONTAINER_CLIENT } from '../core/client/container-client.token';
import { ApiClient, ApiError } from '../core/client/types';
import { VisualIdentity } from './visual-identity';

export interface TenantProfile {
  identifier: string;
  commercialName: string;
  tenantStatus: 'ACTIVE' | 'INACTIVE';
  /** Null or absent when the company chose no colors: the platform look applies. */
  visualIdentity?: VisualIdentity | null;
}

export type TenantLookup =
  | { state: 'active' | 'inactive'; profile: TenantProfile }
  | { state: 'unknown' }
  | { state: 'error'; message: string };

/** Same shape the public route accepts; anything else is not asked (the gateway would answer 401 and end a session). */
const IDENTIFIER = /^[a-z0-9-]{1,40}$/;

export async function lookupTenant(client: ApiClient, identifier: string): Promise<TenantLookup> {
  if (!IDENTIFIER.test(identifier)) return { state: 'unknown' };
  try {
    const profile = await client.request<TenantProfile>(`/api/v1/identity-audit/public/tenants/${identifier}`);
    return { state: profile.tenantStatus === 'ACTIVE' ? 'active' : 'inactive', profile };
  } catch (err) {
    const failure = err as Partial<ApiError>;
    if (failure.status === 404 || failure.status === 401) return { state: 'unknown' };
    return { state: 'error', message: failure.message ?? messageFor(undefined, '') };
  }
}

export const tenantResolver: ResolveFn<TenantLookup> = (route) => {
  const identifier = route.paramMap.get('identifier') ?? '';
  return lookupTenant(inject(CONTAINER_CLIENT).propsFor(identifier).apiClient, identifier);
};
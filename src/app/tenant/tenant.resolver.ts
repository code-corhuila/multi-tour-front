import { ResolveFn } from '@angular/router';
import { ApiClient } from '../core/client/types';

export interface TenantProfile {
  identifier: string;
  commercialName: string;
  tenantStatus: 'ACTIVE' | 'INACTIVE';
}

export type TenantLookup =
  | { state: 'active' | 'inactive'; profile: TenantProfile }
  | { state: 'unknown' }
  | { state: 'error'; message: string };

/** Skeleton: answers `unknown` until the lookup is written. */
export async function lookupTenant(_client: ApiClient, _identifier: string): Promise<TenantLookup> {
  return { state: 'unknown' };
}

export const tenantResolver: ResolveFn<TenantLookup> = () => ({ state: 'unknown' });
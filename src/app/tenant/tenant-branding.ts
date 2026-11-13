import { Injectable, signal } from '@angular/core';
import type { ApiClient } from '../core/client/types';
import { Branding, NO_BRANDING, validBranding } from './branding';
import { lookupTenant } from './tenant.resolver';

/**
 * The logo and the commercial images of the tenant's area, shared by the tenant shell (which shows them) and the portal page (which hands
 * them to the portal and refreshes them when the portal says that they changed). Only valid paths of the company's own files are kept.
 */
@Injectable()
export class TenantBranding {
  private readonly files = signal<Branding>(NO_BRANDING);

  readonly current = this.files.asReadonly();

  /** The profile value the resolver loaded; anything invalid leaves the platform's default look. */
  start(profile: unknown, identifier: string): void {
    this.files.set(validBranding(profile, identifier));
  }

  /** Reads the public profile again; a read that fails (an error, an unknown company) leaves what was shown. */
  async refresh(client: ApiClient, identifier: string): Promise<void> {
    const found = await lookupTenant(client, identifier);
    if ('profile' in found) this.files.set(validBranding(found.profile, identifier));
  }
}

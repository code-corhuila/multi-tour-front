import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import type { ApiClient } from '../core/client/types';
import { TenantBranding } from './tenant-branding';

const base = '/api/v1/identity-audit/public/tenants/acme';
const profile = (extra: object = {}) => ({
  identifier: 'acme',
  commercialName: 'Acme Tours',
  tenantStatus: 'ACTIVE',
  logoUrl: `${base}/logo?v=abcd1234`,
  images: [{ position: 0, url: `${base}/images/0?v=abcd1234` }],
  ...extra,
});
const make = () => {
  TestBed.configureTestingModule({ providers: [TenantBranding] });
  return TestBed.inject(TenantBranding);
};
const clientOf = (request: unknown) => ({ request }) as unknown as ApiClient;

describe('TenantBranding (front spec 005, RN-FRT-50, -54)', () => {
  it('starts from the profile the resolver loaded, and shows nothing for a profile without files', () => {
    const branding = make();
    expect(branding.current()).toEqual({ logoUrl: null, images: [] });
    branding.start(profile(), 'acme');
    expect(branding.current().logoUrl).toBe(`${base}/logo?v=abcd1234`);
    expect(branding.current().images).toHaveLength(1);
    branding.start({ identifier: 'acme' }, 'acme');
    expect(branding.current()).toEqual({ logoUrl: null, images: [] });
  });

  it('U·the_callback_reads_the_profile_again: refresh asks for the public profile of the link and shows the new files', async () => {
    const branding = make();
    branding.start(profile(), 'acme');
    const request = vi.fn(async () => profile({ logoUrl: `${base}/logo?v=11111111`, images: [] }));
    await branding.refresh(clientOf(request), 'acme');
    expect(request).toHaveBeenCalledWith('/api/v1/identity-audit/public/tenants/acme');
    expect(branding.current().logoUrl).toBe(`${base}/logo?v=11111111`);
    expect(branding.current().images).toEqual([]);
  });

  it('U·a_failed_read_keeps_the_band: an error, an unknown tenant or a refusal leave what was shown', async () => {
    const branding = make();
    branding.start(profile(), 'acme');
    const before = branding.current();
    for (const failure of [{ status: 500, message: 'down' }, { status: 404 }, { status: 401 }, new Error('network')]) {
      await branding.refresh(clientOf(vi.fn(async () => Promise.reject(failure))), 'acme');
      expect(branding.current(), JSON.stringify(failure)).toEqual(before);
    }
  });

  it('a refresh with a new version shows the new address and the old one is forgotten', async () => {
    const branding = make();
    branding.start(profile(), 'acme');
    const first = branding.current().logoUrl;
    await branding.refresh(clientOf(vi.fn(async () => profile({ logoUrl: `${base}/logo?v=22222222` }))), 'acme');
    expect(branding.current().logoUrl).toBe(`${base}/logo?v=22222222`);
    expect(branding.current().logoUrl).not.toBe(first);
  });

  it('a refresh that answers files of another tenant shows none of them', async () => {
    const branding = make();
    const other = '/api/v1/identity-audit/public/tenants/other';
    await branding.refresh(clientOf(vi.fn(async () => profile({ logoUrl: `${other}/logo?v=abcd1234`, images: [] }))), 'acme');
    expect(branding.current()).toEqual({ logoUrl: null, images: [] });
  });
});

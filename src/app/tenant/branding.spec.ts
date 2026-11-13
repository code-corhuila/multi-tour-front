import { describe, expect, it } from 'vitest';
import { validBranding } from './branding';

const base = '/api/v1/identity-audit/public/tenants/acme';

describe('validBranding (front spec 005, RN-FRT-52)', () => {
  it('U·a_valid_logo_and_images_are_kept_in_the_order_of_their_position', () => {
    const profile = {
      logoUrl: `${base}/logo?v=abcd1234`,
      images: [
        { position: 3, url: `${base}/images/3?v=00000003` },
        { position: 0, url: `${base}/images/0?v=00000000` },
      ],
    };
    expect(validBranding(profile, 'acme')).toEqual({
      logoUrl: `${base}/logo?v=abcd1234`,
      images: [
        { position: 0, url: `${base}/images/0?v=00000000` },
        { position: 3, url: `${base}/images/3?v=00000003` },
      ],
    });
  });

  it('a profile without files, or one that is not an object, has none', () => {
    for (const profile of [{}, { logoUrl: null, images: [] }, null, undefined, 'x', 42, { logoUrl: 7, images: 'nope' }]) {
      expect(validBranding(profile, 'acme'), String(profile)).toEqual({ logoUrl: null, images: [] });
    }
  });

  it('U·a_path_of_another_place_is_not_shown: only the public files of the link, never another address', () => {
    for (const logoUrl of [
      'https://evil.example/logo.png',
      '//evil.example/logo.png',
      'javascript:alert(1)',
      'data:image/png;base64,AAAA',
      '/api/v1/identity-audit/tenant/logo',
      `${base}/logo/extra`,
      `${base}/logo?v=xyz`,
      `${base}/logo?v=abcd1234&x=1`,
      `${base}/../logo`,
      `${base}//logo`,
      `${base}/%2e%2e/logo`,
      `${base}/logo%2fx`,
      `/api/v1/identity-audit/public/tenants//evil.example/logo`,
      `${base}/logo#frag`,
      `${base}/images/5?v=abcd1234`,
      `${base}/images/x`,
      '',
    ]) {
      expect(validBranding({ logoUrl }, 'acme').logoUrl, logoUrl).toBeNull();
    }
  });

  it('U·a_path_of_another_tenant_is_not_shown', () => {
    const other = '/api/v1/identity-audit/public/tenants/other';
    const result = validBranding({ logoUrl: `${other}/logo?v=abcd1234`, images: [{ position: 0, url: `${other}/images/0?v=abcd1234` }] }, 'acme');
    expect(result).toEqual({ logoUrl: null, images: [] });
  });

  it('an image whose position does not match its path, a repeated position, a sixth image and a value that is not an object are dropped', () => {
    const result = validBranding(
      {
        images: [
          { position: 1, url: `${base}/images/2?v=abcd1234` },
          { position: 2, url: `${base}/images/2?v=abcd1234` },
          { position: 2, url: `${base}/images/2?v=ffffffff` },
          { position: 7, url: `${base}/images/7?v=abcd1234` },
          'x',
          null,
          { position: '2', url: `${base}/images/2?v=abcd1234` },
        ],
      },
      'acme',
    );
    expect(result.images).toEqual([{ position: 2, url: `${base}/images/2?v=abcd1234` }]);
  });
});

// @vitest-environment node
// @ts-expect-error Node fs is available at runtime; this workspace has no @types/node.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const inc = readFileSync('nginx/security-headers.inc', 'utf8');
const csp = /Content-Security-Policy "([^"]+)"/.exec(inc)?.[1] ?? '';
const directive = (name: string) => csp.split(';').map((d) => d.trim().split(/\s+/)).find(([n]) => n === name)?.slice(1);

describe('content security policy (HU-COM-010, portal 009 plan pillar 9)', () => {
  it('U·csp_allows_blob_in_img_src_and_frame_src_only', () => {
    expect(directive('img-src')).toEqual(["'self'", 'data:', 'blob:']);
    expect(directive('frame-src')).toEqual(["'self'", 'blob:']);
    for (const name of ['default-src', 'script-src', 'connect-src', 'style-src']) {
      expect(directive(name)?.some((s) => s.includes('blob'))).toBe(false);
    }
  });

  it('U·csp_keeps_every_other_directive', () => {
    expect(directive('default-src')).toEqual(["'self'"]);
    expect(directive('script-src')).toEqual(["'self'"]);
    expect(directive('style-src')).toEqual(["'self'", "'unsafe-inline'"]);
    expect(directive('connect-src')).toEqual(["'self'"]);
    expect(directive('base-uri')).toEqual(["'self'"]);
    expect(directive('form-action')).toEqual(["'self'"]);
    expect(directive('frame-ancestors')).toEqual(["'none'"]);
  });
});

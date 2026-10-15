import { describe, expect, it } from 'vitest';
import { IDENTITY_CHROME_CSS, needsIdentityChromeAdapter } from './identity-chrome-adapter';

describe('identity chrome adapter (temporary)', () => {
  it('U·applies_to_the_portals_that_do_not_read_chrome_yet', () => {
    expect(needsIdentityChromeAdapter('identity-audit-portal')).toBe(true);
    expect(needsIdentityChromeAdapter('commercial-reservation-portal')).toBe(true);
    expect(needsIdentityChromeAdapter('cash-reporting-portal')).toBe(false);
    expect(needsIdentityChromeAdapter('operations-cost-portal')).toBe(false);
  });

  it('U·hides_the_own_sidebar_of_the_commercial_portal', () => {
    expect(IDENTITY_CHROME_CSS).toContain('.crp-operator-sidebar');
  });

  it('U·every_rule_is_scoped_by_the_container_attribute_and_hides_the_own_aside', () => {
    expect(IDENTITY_CHROME_CSS).toContain(".staff-sidebar");
    expect(IDENTITY_CHROME_CSS).toContain('display: none');
    const selectors = IDENTITY_CHROME_CSS.split('{').filter((_, i, a) => i < a.length - 1).map((chunk) => chunk.split('}').pop()!.trim());
    for (const selector of selectors) expect(selector).toContain('[data-chrome="container"]');
    expect(IDENTITY_CHROME_CSS).not.toMatch(/\b\d+(vh|vw|vmin|vmax)\b/);
  });
});

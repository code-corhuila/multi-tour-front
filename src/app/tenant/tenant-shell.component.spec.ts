import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { describe, expect, it } from 'vitest';
import { TenantShellComponent } from './tenant-shell.component';
import { TenantLookup } from './tenant.resolver';

function render(tenant: TenantLookup) {
  TestBed.configureTestingModule({
    providers: [provideRouter([]), { provide: ActivatedRoute, useValue: { snapshot: { data: { tenant } } } }],
  });
  const fixture = TestBed.createComponent(TenantShellComponent);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

const profile = (tenantStatus: 'ACTIVE' | 'INACTIVE', visualIdentity?: { primaryColor: string; secondaryColor: string } | null) => ({
  identifier: 'acme',
  commercialName: 'Acme Tours',
  tenantStatus,
  ...(visualIdentity === undefined ? {} : { visualIdentity }),
});

const COLORS = { primaryColor: '#c0392b', secondaryColor: '#7b241c' };

describe('TenantShellComponent', () => {
  it('shows a clear page for an unknown tenant and mounts nothing', () => {
    const el = render({ state: 'unknown' });
    expect(el.textContent).toContain('Page not found');
    expect(el.querySelector('router-outlet')).toBeNull();
  });

  it('says an inactive tenant is not available', () => {
    const el = render({ state: 'inactive', profile: profile('INACTIVE') });
    expect(el.textContent).toContain('Acme Tours is not active');
    expect(el.querySelector('router-outlet')).toBeNull();
  });

  it('offers a retry when the lookup failed', () => {
    const el = render({ state: 'error', message: 'down' });
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('down');
    expect(el.querySelector('button')?.textContent).toContain('Try again');
  });

  it('applies its theme and renders the routes of an active tenant without a name heading of its own', () => {
    const el = render({ state: 'active', profile: profile('ACTIVE') });
    expect(el.querySelector('router-outlet')).not.toBeNull();
    expect(el.querySelector('h2')).toBeNull();
    expect(el.textContent).not.toContain('Acme Tours');
    expect(el.getAttribute('data-theme')).toBe('acme');
  });

  it('U-the_host_sets_the_accent_variables_of_the_profile_for_every_portal_below', () => {
    const el = render({ state: 'active', profile: profile('ACTIVE', COLORS) });
    expect(el.style.getPropertyValue('--accent')).toBe('#c0392b');
    expect(el.style.getPropertyValue('--accent-strong')).toBe('#7b241c');
    expect(el.style.getPropertyValue('--accent-soft')).toContain('#c0392b');
  });

  it('U-the_host_sets_no_variable_without_visual_identity_or_with_a_malformed_one', () => {
    for (const visualIdentity of [undefined, null, { primaryColor: 'red', secondaryColor: '#7b241c' }]) {
      const el = render({ state: 'active', profile: profile('ACTIVE', visualIdentity) });
      expect(el.style.getPropertyValue('--accent')).toBe('');
      expect(el.style.getPropertyValue('--accent-strong')).toBe('');
      TestBed.resetTestingModule();
    }
  });

  it('U-an_inactive_or_unknown_tenant_paints_nothing', () => {
    const el = render({ state: 'inactive', profile: profile('INACTIVE', COLORS) });
    expect(el.style.getPropertyValue('--accent')).toBe('');
  });
});

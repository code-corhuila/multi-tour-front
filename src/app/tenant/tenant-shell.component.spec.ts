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

const profile = (tenantStatus: 'ACTIVE' | 'INACTIVE') => ({ identifier: 'acme', commercialName: 'Acme Tours', tenantStatus });

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
});
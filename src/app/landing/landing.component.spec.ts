import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
// @ts-expect-error Node fs is available at runtime; this workspace has no @types/node.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { LandingComponent } from './landing.component';

const ACTIVE = (commercialName: string) => ({
  state: 'active',
  profile: { identifier: 'acme', commercialName, tenantStatus: 'ACTIVE' },
});

/** Rendered by the real router at `/t/<identifier>`, with the tenant the resolver would have loaded. */
async function render(identifier = 'acme', tenant: object = ACTIVE('Acme Tours')) {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([{ path: 't/:identifier', component: LandingComponent, resolve: { tenant: () => tenant } }]),
    ],
  });
  const harness = await RouterTestingHarness.create();
  await harness.navigateByUrl(`/t/${identifier}`);
  harness.detectChanges();
  return harness.routeNativeElement as HTMLElement;
}
const hrefs = (el: HTMLElement, text: string) =>
  Array.from(el.querySelectorAll<HTMLAnchorElement>('a')).filter((a) => a.textContent?.includes(text)).map((a) => a.getAttribute('href'));

describe('LandingComponent', () => {
  it('U-landing_draws_the_hero_of_the_mockup', async () => {
    const el = await render();
    expect(el.querySelector('.mth-brand')?.textContent).toContain('Multi Tour');
    expect(el.querySelector('h1')?.textContent).toContain('Destinos que valen la pena');
    expect(el.querySelector('h1 .mth-h1-accent')?.textContent).toBe('vivir');
    expect(el.textContent).toContain('Explora experiencias únicas y encuentra tu próxima aventura.');
    expect(el.querySelector('img.mth-hero-img')?.getAttribute('src')).toBe('/assets/mountain-hero.jpg');
    expect(el.querySelector('img.mth-hero-img')?.getAttribute('alt')).toContain('Cordillera');
  });

  it('U-landing_has_the_three_steps_with_numbers_and_icons', async () => {
    const el = await render();
    const steps = Array.from(el.querySelectorAll('.mth-benefit'));
    expect(steps.map((s) => s.querySelector('.mth-benefit-index')?.textContent)).toEqual(['01', '02', '03']);
    expect(steps.map((s) => s.querySelector('.mth-benefit-title')?.textContent)).toEqual([
      'Explora experiencias',
      'Reserva de forma sencilla',
      'Gestiona tu viaje',
    ]);
    expect(steps.every((s) => s.querySelector('svg') !== null)).toBe(true);
  });

  it('U-landing_sends_every_way_in_to_the_sign_in_of_the_tenant', async () => {
    const el = await render('acme');
    expect(hrefs(el, 'Ingresar')).toContain('/t/acme/ingresar');
    expect(hrefs(el, 'Equipo del operador')).toContain('/t/acme/ingresar?tab=operador');
    expect(hrefs(el, 'Acceder al equipo del operador')).toEqual(['/t/acme/ingresar?tab=operador']);
    expect(hrefs(el, 'Ver catálogo')).toEqual(['/t/acme/ingresar']);
    expect(hrefs(el, 'Descubrir experiencias')).toEqual(['/t/acme/ingresar']);
    const others = Array.from(el.querySelectorAll('a:not(.mth-brand):not(.skip-link)')).map((a) => a.getAttribute('href'));
    expect(others.every((h) => h?.startsWith('/t/acme/ingresar'))).toBe(true);
  });

  it('U-landing_works_without_motion_support_and_keeps_everything_visible', async () => {
    const el = await render();
    expect(el.querySelectorAll('.mth-pending').length).toBe(0);
  });

  it('U-landing_shows_the_company_as_kicker_and_in_the_document_title', async () => {
    const el = await render('acme', ACTIVE('Acme Tours'));
    expect(el.querySelector('.mth-eyebrow')?.textContent?.trim()).toBe('Acme Tours');
    expect(el.querySelector('.mth-brand')?.textContent).toContain('Multi Tour');
    expect(document.title).toBe('Acme Tours | Multi Tour');
  });

  it('U-landing_keeps_the_generic_kicker_without_a_commercial_name', async () => {
    const el = await render('acme', ACTIVE('  '));
    expect(el.querySelector('.mth-eyebrow')?.textContent?.trim()).toBe('Multi Tour');
    expect(document.title).toBe('Multi Tour');
  });

  it('U-landing_at_the_root_is_generic_and_every_way_in_goes_to_the_general_login', async () => {
    TestBed.configureTestingModule({ providers: [provideRouter([{ path: '', component: LandingComponent }])] });
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/');
    harness.detectChanges();
    const el = harness.routeNativeElement as HTMLElement;
    expect(el.querySelector('.mth-eyebrow')?.textContent?.trim()).toBe('Multi Tour');
    expect(document.title).toBe('Multi Tour');
    expect(el.querySelector('.mth-brand')?.getAttribute('href')).toBe('/');
    for (const text of ['Ingresar', 'Ver catálogo', 'Descubrir experiencias', 'Ver detalle', 'Tours']) {
      expect(hrefs(el, text).every((h) => h === '/ingresar'), text).toBe(true);
    }
    expect(hrefs(el, 'Equipo del operador')).toContain('/ingresar?tab=operador');
    expect(hrefs(el, 'Acceder al equipo del operador')).toEqual(['/ingresar?tab=operador']);
  });

  it('U-landing_takes_its_accents_from_the_tenant_variables_with_the_platform_look_as_default', () => {
    const css = readFileSync('src/app/landing/landing.component.css', 'utf8');
    expect(css).toContain('--mt-teal: var(--accent-strong, #147d73)');
    expect(css).toContain('--mt-coral: var(--accent, #e9785d)');
    expect(css).not.toMatch(/#147d73;\s*$/m);
  });
});

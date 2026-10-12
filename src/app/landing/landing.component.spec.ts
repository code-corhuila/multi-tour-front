import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { describe, expect, it } from 'vitest';
import { LandingComponent } from './landing.component';

/** Rendered by the real router at `/t/<identifier>`, as the app does. */
async function render(identifier = 'acme') {
  TestBed.configureTestingModule({
    providers: [provideRouter([{ path: 't/:identifier', component: LandingComponent }])],
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
});
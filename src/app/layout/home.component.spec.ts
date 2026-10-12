import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';
import { HomeComponent } from './home.component';

function setup() {
  TestBed.configureTestingModule({ providers: [provideRouter([])] });
  const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
  const fixture = TestBed.createComponent(HomeComponent);
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  const input = () => el.querySelector<HTMLInputElement>('input')!;
  const button = () => el.querySelector<HTMLButtonElement>('button[type="submit"]')!;
  const type = (value: string) => {
    input().value = value;
    input().dispatchEvent(new Event('input'));
    fixture.detectChanges();
  };
  const submit = () => {
    el.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    fixture.detectChanges();
  };
  return { el, navigate, input, button, type, submit };
}

describe('HomeComponent', () => {
  it('U-home_renders_the_company_field_and_the_platform_link', () => {
    const { el, input } = setup();
    expect(el.textContent).toContain('Ingresa con el enlace de tu empresa.');
    const label = el.querySelector<HTMLLabelElement>(`label[for="${input().id}"]`);
    expect(label?.textContent).toContain('Identificador de tu empresa');
    const link = el.querySelector<HTMLAnchorElement>('a[href="/platform"]');
    expect(link?.textContent).toContain('Administración de la plataforma');
  });

  it('U-home_button_is_disabled_while_the_field_is_empty', () => {
    const { button, type } = setup();
    expect(button().disabled).toBe(true);
    type('acme');
    expect(button().disabled).toBe(false);
    type('  ');
    expect(button().disabled).toBe(true);
  });

  it('U-home_navigates_to_the_tenant_link_on_submit', () => {
    const { navigate, type, submit } = setup();
    type(' Acme-Tours ');
    submit();
    expect(navigate).toHaveBeenCalledWith('/t/acme-tours');
  });

  it('U-home_rejects_an_invalid_identifier_next_to_the_field_without_navigating', () => {
    const { el, input, navigate, type, submit } = setup();
    for (const bad of ['ab', 'a'.repeat(41), 'acme tours', '-acme', 'acme-', 'ac/me', 'acme--x']) {
      type(bad);
      submit();
      const error = el.querySelector('[role="alert"]');
      expect(error, bad).not.toBeNull();
      expect(input().getAttribute('aria-describedby')).toBe(error!.id);
    }
    expect(navigate).not.toHaveBeenCalled();
  });

  it('U-home_clears_the_error_when_the_person_types_again', () => {
    const { el, input, type, submit } = setup();
    type('ab');
    submit();
    type('abc');
    expect(el.querySelector('[role="alert"]')).toBeNull();
    expect(input().hasAttribute('aria-describedby')).toBe(false);
  });
});
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';
import { NavItem } from './operator-nav';
import { OperatorSidebarComponent } from './operator-sidebar.component';

const ITEMS: NavItem[] = [
  { label: 'Reservas', portal: 'commercial-reservation-portal', area: 'reservations', link: true },
  { label: 'Catálogos', portal: 'commercial-reservation-portal', area: 'catalog', link: true },
  { label: 'Salidas', portal: 'operations-cost-portal', link: false },
];

@Component({
  imports: [OperatorSidebarComponent],
  template: `<app-operator-sidebar [items]="items" identifier="acme" roleLabel="Administrador del tenant" [active]="active" (closed)="closed()" />`,
})
class Host {
  items = ITEMS;
  active = { portal: 'commercial-reservation-portal', area: 'catalog' };
  closed = vi.fn();
}

function render() {
  TestBed.configureTestingModule({ providers: [provideRouter([])] });
  const fixture = TestBed.createComponent(Host);
  fixture.detectChanges();
  return { fixture, el: fixture.nativeElement as HTMLElement };
}

describe('OperatorSidebarComponent', () => {
  it('U·sidebar_is_an_aside_with_a_labelled_nav_and_no_header', () => {
    const { el } = render();
    expect(el.querySelector('aside nav[aria-label="Navegación del operador"]')).not.toBeNull();
    expect(el.querySelector('header')).toBeNull();
    expect(el.textContent).toContain('Administrador del tenant');
  });

  // The sign-out sits at the bottom of the window, never at the bottom of a page whose height changes while its content loads.
  it('U·sidebar_stays_fixed_to_the_window_so_cerrar_sesion_never_jumps', () => {
    const { el } = render();
    const host = getComputedStyle(el.querySelector('app-operator-sidebar') as HTMLElement);
    expect(host.position).toBe('sticky');
    expect(host.top).toBe('0px');
    expect(host.height).toBe('100vh');
    expect(getComputedStyle(el.querySelector('aside') as HTMLElement).overflowY).toBe('auto');
  });

  it('U·sidebar_entry_opens_the_portal_area_through_the_same_route_as_navigate', () => {
    const { el } = render();
    const link = el.querySelector('a[href*="/t/acme/areas/commercial-reservation-portal"]') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('/t/acme/areas/commercial-reservation-portal?area=reservations');
  });

  it('U·sidebar_marks_the_open_entry_with_aria_current', () => {
    const { el } = render();
    const current = el.querySelectorAll('[aria-current="page"]');
    expect(current).toHaveLength(1);
    expect(current[0].textContent).toContain('Catálogos');
  });

  it('U·an_unavailable_entry_is_proximamente_text_with_aria_disabled', () => {
    const { el } = render();
    const soon = el.querySelector('[aria-disabled="true"]') as HTMLElement;
    expect(soon.tagName).not.toBe('A');
    expect(soon.textContent).toContain('Salidas');
    expect(soon.textContent).toContain('Próximamente');
  });

  it('U·cerrar_sesion_asks_the_container_to_close_the_session', () => {
    const { fixture, el } = render();
    (Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.includes('Cerrar sesión')) as HTMLButtonElement).click();
    expect(fixture.componentInstance.closed).toHaveBeenCalledTimes(1);
  });
});

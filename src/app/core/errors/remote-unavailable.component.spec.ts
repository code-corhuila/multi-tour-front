import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { RemoteUnavailableComponent } from './remote-unavailable.component';

function render(portal: string) {
  const fixture = TestBed.createComponent(RemoteUnavailableComponent);
  fixture.componentRef.setInput('portal', portal);
  fixture.detectChanges();
  return fixture;
}

describe('RemoteUnavailableComponent', () => {
  it('U·commercial_reservation_portal_shows_the_out_of_service_notice_in_spanish', () => {
    const el: HTMLElement = render('commercial-reservation-portal').nativeElement;
    expect(el.querySelector('[role="alert"] h2')?.textContent).toContain('Comercial y reservas: fuera de servicio');
    expect(el.textContent).toContain('Este módulo no está disponible por ahora. El resto de la aplicación sigue funcionando.');
    expect(el.querySelector('button')?.textContent).toContain('Reintentar');
    expect(el.textContent).not.toContain('is not available right now');
  });

  it('U·cash_reporting_portal_shows_the_out_of_service_notice_in_spanish', () => {
    const el: HTMLElement = render('cash-reporting-portal').nativeElement;
    expect(el.querySelector('[role="alert"] h2')?.textContent).toContain('Caja y reportes: fuera de servicio');
    expect(el.textContent).toContain('Este módulo no está disponible por ahora. El resto de la aplicación sigue funcionando.');
    expect(el.querySelector('button')?.textContent).toContain('Reintentar');
  });

  it.each(['identity-audit-portal', 'operations-cost-portal', 'ghost-portal'])(
    'U·%s_keeps_the_original_notice_unchanged',
    (portal) => {
      const el: HTMLElement = render(portal).nativeElement;
      expect(el.querySelector('h2')?.textContent).toBe(`${portal} is not available right now`);
      expect(el.querySelector('p')?.textContent).toBe('The rest of the application still works.');
      expect(el.querySelector('button')?.textContent).toBe('Try again');
      expect(el.textContent).not.toContain('fuera de servicio');
    },
  );

  it.each(['commercial-reservation-portal', 'cash-reporting-portal'])('U·retry_button_of_%s_emits_retried', (portal) => {
    const fixture = render(portal);
    const retried = vi.fn();
    fixture.componentInstance.retried.subscribe(retried);
    (fixture.nativeElement.querySelector('button') as HTMLButtonElement).click();
    expect(retried).toHaveBeenCalledTimes(1);
  });
});

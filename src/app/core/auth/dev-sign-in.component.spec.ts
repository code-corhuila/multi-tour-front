import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';
import { createContainerClient } from '../client/container';
import { CONTAINER_CLIENT } from '../client/container-client.token';
import { DevSignInComponent } from './dev-sign-in.component';

function setup(returnUrl?: string) {
  const client = createContainerClient({ baseUrl: '', fetch: vi.fn() });
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: CONTAINER_CLIENT, useValue: client },
      { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(returnUrl ? { returnUrl } : {}) } } },
    ],
  });
  const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
  const fixture = TestBed.createComponent(DevSignInComponent);
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  const type = (label: string, value: string) => {
    const input = el.querySelector<HTMLInputElement>(`[aria-label="${label}"]`)!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
  };
  return { el, client, navigate, type };
}

describe('DevSignInComponent', () => {
  it('opens the session of the tenant with the pasted token and goes back to the requested url', () => {
    const { el, client, navigate, type } = setup('/t/acme/areas/x');
    type('Token from dev-token.sh', ' a.b.c ');
    type('Tenant identifier (empty for the platform)', 'acme');
    el.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
    expect(client.store.of('acme').token).toBe('a.b.c');
    expect(navigate).toHaveBeenCalledWith('/t/acme/areas/x');
    client.store.of('acme').close();
  });

  it('opens the platform session when no identifier is typed and goes home without a return url', () => {
    const { el, client, navigate, type } = setup();
    type('Token from dev-token.sh', 'a.b.c');
    el.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
    expect(client.store.of().token).toBe('a.b.c');
    expect(navigate).toHaveBeenCalledWith('/');
    client.store.of().close();
  });

  it('does nothing without a token', () => {
    const { el, client, navigate } = setup();
    el.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
    expect(client.store.of().token).toBeNull();
    expect(navigate).not.toHaveBeenCalled();
  });
});
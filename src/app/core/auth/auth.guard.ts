import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { CONTAINER_CLIENT } from '../client/container-client.token';

/** The sign-in screen belongs to the identity portal, which the container mounts under these paths. */
function signInCommands(identifier?: string): string[] {
  return identifier === undefined ? ['/platform', 'sign-in'] : ['/t', identifier, 'sign-in'];
}

/** A restricted or temporary credential (`access`) is not a full session, so it goes back to sign-in too. */
export const authGuard: CanActivateFn = (route, state) => {
  const identifier = route.paramMap.get('identifier') ?? undefined;
  const session = inject(CONTAINER_CLIENT).store.of(identifier);
  if (session.token && !session.access) return true;
  return inject(Router).createUrlTree(signInCommands(identifier), { queryParams: { returnUrl: state.url } });
};
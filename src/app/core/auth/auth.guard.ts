import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { CONTAINER_CLIENT } from '../client/container-client.token';

/** The sign-in screen (ingresar) belongs to the identity portal, which the container mounts under these paths. */
function signInCommands(identifier?: string): string[] {
  return identifier === undefined ? ['/platform', 'ingresar'] : ['/t', identifier, 'ingresar'];
}

/** A temporary credential, or a restricted one that is not the Administrator of an inactive tenant, is not a full session, so it goes back to sign-in too. */
export const authGuard: CanActivateFn = (route, state) => {
  const identifier = route.paramMap.get('identifier') ?? undefined;
  const session = inject(CONTAINER_CLIENT).store.of(identifier);
  // HU-COM-020: the restricted access of the Administrator of an inactive tenant opens the areas of its pending obligations; the backend allows only that work.
  const restrictedAdministrator = session.access === 'restricted' && session.roles.includes('TENANT_ADMINISTRATOR');
  if (session.token && (!session.access || restrictedAdministrator)) return true;
  return inject(Router).createUrlTree(signInCommands(identifier), { queryParams: { returnUrl: state.url } });
};
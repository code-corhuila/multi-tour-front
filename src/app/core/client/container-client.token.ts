import { InjectionToken } from '@angular/core';
import { ContainerClient, createContainerClient, gatewayBaseUrl } from './container';

/** The one client and session store of the container; tests provide their own. */
export const CONTAINER_CLIENT = new InjectionToken<ContainerClient>('CONTAINER_CLIENT', {
  factory: () => createContainerClient({ baseUrl: gatewayBaseUrl() }),
});
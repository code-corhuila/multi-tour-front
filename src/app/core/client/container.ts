import { createApiClient } from './api-client';
import { SessionStore } from './session';
import { MountProps } from './types';

export const REFRESH_PATH = '/api/v1/security/public/sessions/refresh';

export interface ContainerClient {
  store: SessionStore;
  propsFor(identifier: string): MountProps;
}

export function createContainerClient(_options: { baseUrl: string; fetch?: typeof fetch }): ContainerClient {
  const store = new SessionStore(() => Promise.reject(new Error('not implemented')));
  const apiClient = createApiClient({ baseUrl: '', token: () => null, onUnauthorized: () => undefined });
  return { store, propsFor: (identifier) => ({ apiClient, session: store.of(identifier) }) };
}

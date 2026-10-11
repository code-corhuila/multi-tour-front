import { createApiClient } from './api-client';
import { SessionStore } from './session';
import { MountProps } from './types';

export const REFRESH_PATH = '/api/v1/security/public/sessions/refresh';

export interface ContainerClient {
  store: SessionStore;
  /** What a portal receives when it is mounted: the client and the session of that tenant (`platform` has none). */
  propsFor(identifier: string): MountProps;
}

/** The gateway URL is read here only: a runtime global set by the page, else the page's own origin (the gateway serves it). */
export function gatewayBaseUrl(): string {
  const value = (globalThis as { GATEWAY_BASE_URL?: unknown }).GATEWAY_BASE_URL;
  return typeof value === 'string' ? value.replace(/\/+$/, '') : '';
}

export function createContainerClient(options: { baseUrl: string; fetch?: typeof fetch }): ContainerClient {
  const anonymous = createApiClient({ ...options, token: () => null, onUnauthorized: () => undefined });
  const store = new SessionStore((refreshToken) =>
    anonymous.request(REFRESH_PATH, { method: 'POST', body: { refreshToken } }),
  );
  return {
    store,
    propsFor(identifier) {
      const session = store.of(identifier);
      const apiClient = createApiClient({
        ...options,
        token: () => session.token,
        onUnauthorized: () => session.close(),
      });
      return { apiClient, session };
    },
  };
}

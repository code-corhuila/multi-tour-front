import { isTenantIdentifier } from '../../tenant/identifier';
import { createApiClient } from './api-client';
import { SessionStore, TenantSession } from './session';
import { MountProps, Scope, Session } from './types';

export const REFRESH_PATH = '/api/v1/security/public/sessions/refresh';

export interface ContainerClient {
  store: SessionStore;
  /**
   * What a portal receives when it is mounted: the client and the session of that tenant (`platform` has none).
   * The `general` scope has no identifier: its session opens under the one the portal passes to `open`.
   */
  propsFor(identifier?: string, scope?: Scope): MountProps;
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

  /** Only the token a request used may end its session: a newer sign-in must survive an older 401. */
  const clientOf = (current: () => TenantSession | undefined) =>
    createApiClient({
      ...options,
      token: () => current()?.token ?? null,
      onUnauthorized: (used) => {
        const session = current();
        if (used !== null && used === session?.token) session.close();
      },
    });

  /** The general login: no session of its own, it follows the one the portal opens for the typed identifier. */
  function general(): MountProps {
    let current: TenantSession | undefined;
    const session: Session = {
      get roles() {
        return current?.roles ?? [];
      },
      get access() {
        return current?.access;
      },
      open(answer, identifier) {
        if (typeof identifier !== 'string' || !isTenantIdentifier(identifier)) {
          throw new Error('the general login must open the session with a valid company identifier');
        }
        const next = store.of(identifier);
        // Typing another company in the same login must not leave the first session alive.
        if (current && current !== next) current.close();
        current = next;
        current.open(answer);
      },
      close() {
        current?.close();
        current = undefined;
      },
    };
    return { apiClient: clientOf(() => current), session, scope: 'general' };
  }

  return {
    store,
    propsFor(identifier?: string, scope?: Scope) {
      if (scope === 'general') return general();
      const session = store.of(identifier);
      const apiClient = clientOf(() => session);
      return identifier === undefined
        ? { apiClient, session, scope: 'platform' }
        : { apiClient, session, identifier, scope: 'tenant' };
    },
  };
}
/** The contract the container hands to a portal when it mounts it (ADR-006 F4). */
export interface RequestOptions {
  method?: string;
  body?: unknown;
  signal?: AbortSignal;
  /** Extra headers, e.g. `Idempotency-Key`; the client still owns `Authorization` and `X-Correlation-Id`. */
  headers?: Record<string, string>;
}

export interface ApiClient {
  request<T>(path: string, init?: RequestOptions): Promise<T>;
}

export interface Session {
  readonly roles: string[];
  /** Set when the token is a temporary or restricted credential: the portal then routes to the matching screen. */
  readonly access?: 'password-change' | 'restricted';
  /**
   * Opens the session with a sign-in answer. In the general scope the portal passes the identifier typed in the
   * login and the session is kept under it; in the other scopes the identifier is ignored.
   */
  open(answer: unknown, identifier?: string): void;
  close(): void;
}

/** Where the portal is mounted: the general login (/ingresar), the platform, or a tenant link. */
export type Scope = 'general' | 'platform' | 'tenant';

export interface MountProps {
  /** The tenant identifier of the link; omitted for the platform and the general login. */
  identifier?: string;
  apiClient: ApiClient;
  session: Session;
  /** Optional for portals written before ADR-007 was extended; the container always sets it. */
  scope?: Scope;
  /** SPA navigation owned by the container: the portal never reloads the page (the session lives in memory). */
  navigate?: (path: string) => void;
  /** The commercial name of the company, for screens that show it; tenant mounts only, omitted when blank. */
  commercialName?: string;
  /** The company's colors (#RRGGBB) or null; only tenant mounts get it. The portal paints nothing from it by itself. */
  visualIdentity?: { primaryColor: string; secondaryColor: string } | null;
  /** The portal calls it with the colors the service returned after a save; the container applies them live. */
  onVisualIdentityChange?: (colors: { primaryColor: string; secondaryColor: string }) => void;
}

/** One field-level problem of the envelope's `details`, e.g. `{field: 'email', message: 'already in use'}`. */
export interface ErrorDetail {
  field: string;
  message: string;
}

/** What `request` rejects with: the common envelope `{error, message, details?, traceId}` plus the HTTP status. */
export interface ApiError {
  status?: number;
  code: string;
  message: string;
  /** Present only when the server sent well-formed details. */
  details?: ErrorDetail[];
  traceId: string;
}

/** The token pair the sign-in and refresh endpoints answer with (multi-tour-security). */
export interface SessionAnswer {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
}

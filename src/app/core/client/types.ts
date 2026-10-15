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
  /** Special permissions of the person (the `permissions` claim, or derived from the roles). Optional in the contract (ADR-007). */
  readonly permissions?: string[];
  /** Set when the token is a temporary or restricted credential: the portal then routes to the matching screen. */
  readonly access?: 'password-change' | 'restricted';
  /** Name to greet the person with. Absent when the container does not know it; kept in memory only (RN-FRT-17). */
  readonly displayName?: string;
  /** One or two uppercase letters for the avatar. Optional: when absent the portal derives them from `displayName` (DP-FRT-2). */
  readonly initials?: string;
  /**
   * Opens the session with a sign-in answer. In the general scope the portal passes the identifier typed in the
   * login and the session is kept under it; in the other scopes the identifier is ignored.
   */
  open(answer: unknown, identifier?: string): void;
  close(): void;
}

/** Where the portal is mounted: the general login (/ingresar), the platform, or a tenant link. */
export type Scope = 'general' | 'platform' | 'tenant';

/** An area of a portal, possibly another one than the caller (HU-FRT-001 amendment). The container owns the address. */
export interface PortalTarget {
  /** Key of the portal in public/federation.manifest.json. */
  portal: string;
  /** Area key declared by that portal. */
  area: string;
}

export interface MountProps {
  /** The tenant identifier of the link; omitted for the platform and the general login. */
  identifier?: string;
  apiClient: ApiClient;
  session: Session;
  /** Optional for portals written before ADR-007 was extended; the container always sets it. */
  scope?: Scope;
  /**
   * SPA navigation owned by the container: the portal never reloads the page (the session lives in memory).
   * A text is a path of this application (the identity portal's use); a `{ portal, area }` opens an area of
   * another portal without the caller knowing any address. Never throws; a target the roles cannot use is ignored.
   */
  navigate?: (target: string | PortalTarget) => void;
  /**
   * Who draws the operator sidebar. `'container'`: the portal draws only its content. Absent or `'portal'`: it draws
   * its own. The container sets it only around a portal that declared `chrome: true` in the manifest (HU-FRT-001).
   */
  chrome?: 'container' | 'portal';
  /** Parameters kept across a mount; the container hands `{ area }` when the address names the area to open. */
  initialParams?: Readonly<Record<string, string>>;
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

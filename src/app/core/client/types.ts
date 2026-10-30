/** The contract the container hands to a portal when it mounts it (ADR-006 F4). */
export interface RequestOptions {
  method?: string;
  body?: unknown;
  signal?: AbortSignal;
  /** Extra headers, e.g. `Idempotency-Key`; the client still owns `Authorization` and `X-Correlation-Id`. */
  headers?: Record<string, string>;
  /**
   * `'blob'`: an answer that is a file (e.g. a stored payment proof) is returned as a `Blob`, fetched with the session's
   * `Authorization`; the portal opens it with an object URL (the CSP allows `blob:` in `img-src` and `frame-src`).
   * Omitted or `'json'`: the answer is parsed as JSON. Errors keep the common envelope in both cases.
   */
  responseType?: 'json' | 'blob';
  /**
   * Milliseconds to wait for this request. Omitted: 10 s (30 s for a FormData). A longer window is for a call that runs a saga
   * (e.g. 80000); a value that is not positive and finite is ignored, and the client caps it at 120 s.
   */
  timeoutMs?: number;
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
  /**
   * Plain text values the area needs on arrival (e.g. the tour to reserve). They travel in the address and come back as
   * `initialParams`; the container keeps only short strings under plain names and drops the rest.
   */
  params?: Readonly<Record<string, string>>;
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
  /** Parameters kept across a mount; the container hands `{ area }` when the address names the area to open, plus the plain-string values of `navigate({ portal, area, params })` or of the query. */
  initialParams?: Readonly<Record<string, string>>;
  /** The commercial name of the company, for screens that show it; tenant mounts only, omitted when blank. */
  commercialName?: string;
  /** The company's colors (#RRGGBB) or null; only tenant mounts get it. The portal paints nothing from it by itself. */
  visualIdentity?: { primaryColor: string; secondaryColor: string } | null;
  /**
   * Set only around a portal that draws no sidebar of its own (`chrome: 'container'`). The portal calls it with the area key of the
   * entry it shows as current whenever that changes inside the portal (e.g. a button of one area that opens another), so the
   * container marks that entry in its sidebar without mounting the portal again. A key the menu does not list marks no entry.
   */
  onAreaChange?: (area: string) => void;
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

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
  open(answer: unknown): void;
  close(): void;
}

export interface MountProps {
  /** The tenant identifier of the link; omitted for the platform. */
  identifier?: string;
  apiClient: ApiClient;
  session: Session;
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

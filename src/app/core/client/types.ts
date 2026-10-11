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
  open(answer: unknown): void;
  close(): void;
}

export interface MountProps {
  apiClient: ApiClient;
  session: Session;
}

/** What `request` rejects with: the common envelope `{error, message, traceId}` plus the HTTP status. */
export interface ApiError {
  status?: number;
  code: string;
  message: string;
  traceId: string;
}

/** The token pair the sign-in and refresh endpoints answer with (multi-tour-security). */
export interface SessionAnswer {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
}

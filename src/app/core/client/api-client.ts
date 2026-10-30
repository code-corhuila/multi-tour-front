import { ApiClient, ApiError, ErrorDetail, RequestOptions } from './types';

export const REQUEST_TIMEOUT_MS = 10_000;
/** Longer window for uploads (FormData bodies carry a file). */
export const FORM_DATA_TIMEOUT_MS = 30_000;
/** The longest window a caller may ask for with `timeoutMs`: a portal cannot hold a request open forever. */
export const MAX_REQUEST_TIMEOUT_MS = 120_000;

export interface ClientOptions {
  baseUrl: string;
  token: () => string | null;
  /** Called with the token the failed request used (null if none). */
  onUnauthorized: (usedToken: string | null) => void;
  fetch?: typeof fetch;
  timeoutMs?: number;
  newCorrelationId?: () => string;
}

const BY_CODE: Record<string, string> = {
  TIMEOUT: 'The server took too long to answer. Try again.',
  NETWORK_ERROR: 'The server could not be reached. Check your connection and try again.',
  ABORTED: 'The request was cancelled.',
  INVALID_PATH: 'The request address is not valid.',
  INVALID_RESPONSE: 'The server answered something that could not be read.',
};

const BY_STATUS: Record<number, string> = {
  400: 'Some of the data is not valid. Review it and try again.',
  401: 'Your session ended. Sign in again.',
  403: 'You do not have permission to do this.',
  404: 'What you asked for was not found.',
  413: 'The file is too large.',
  415: 'This file type is not allowed.',
  422: 'This action is not allowed in the current state.',
  429: 'Too many requests. Wait a moment and try again.',
  503: 'This service is not available right now. Try again later.',
};

/** The caller handles the 401 of this route (wrong or expired temporary credential), so it must not end the session. */
const KEEPS_SESSION_ON_401 = 'PUT /api/v1/security/sessions/password';

/** Set by the client, never by a caller. */
const RESERVED_HEADERS = new Set(['authorization', 'x-correlation-id']);

/** The single place that decides the message a person sees for a status or code. */
export function messageFor(status: number | undefined, code: string): string {
  return (
    BY_CODE[code] ??
    (status === undefined ? undefined : BY_STATUS[status]) ??
    'Something went wrong on our side. Try again later.'
  );
}

function failure(status: number | undefined, code: string, traceId: string, details?: ErrorDetail[]): ApiError {
  return { status, code, message: messageFor(status, code), ...(details && { details }), traceId };
}

function isApiError(value: unknown): value is ApiError {
  return typeof value === 'object' && value !== null && 'traceId' in value && 'code' in value;
}

/** A field name that is safe to use as a map key in the portal. */
const FIELD_NAME = /^[A-Za-z][A-Za-z0-9_.[\]-]{0,99}$/;
const MAX_DETAILS = 20;

/**
 * Only a non-empty list of {field, message} strings passes (all or nothing), capped in size. The portal matches on
 * `field`; `message` is the server's text and is not for display (people see the one from `messageFor`).
 */
function readDetails(value: unknown): ErrorDetail[] | undefined {
  if (!Array.isArray(value) || value.length === 0) return undefined;
  const items = value.slice(0, MAX_DETAILS) as Partial<ErrorDetail>[];
  const ok = items.every((d) => typeof d?.field === 'string' && FIELD_NAME.test(d.field) && typeof d.message === 'string');
  return ok ? items.map((d) => ({ field: d.field!, message: d.message!.slice(0, 200) })) : undefined;
}

/** Only a path on the gateway: a leading single slash, no backslash, no scheme. */
function isGatewayPath(path: string): boolean {
  return /^\/(?!\/)/.test(path) && !path.includes('\\') && !path.includes('://');
}

function defaultCorrelationId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

/** The common envelope `{error, message, details?, traceId}`; anything else (HTML from a proxy, empty body) is tolerated. */
async function readEnvelope(response: Response): Promise<{ error?: string; traceId?: string; details?: unknown }> {
  try {
    const body: unknown = await response.json();
    return (typeof body === 'object' && body !== null ? body : {}) as { error?: string; traceId?: string; details?: unknown };
  } catch {
    return {};
  }
}

export function createApiClient(options: ClientOptions): ApiClient {
  const send = options.fetch ?? globalThis.fetch.bind(globalThis);
  const timeoutMs = options.timeoutMs ?? REQUEST_TIMEOUT_MS;
  const newId = options.newCorrelationId ?? defaultCorrelationId;

  return {
    async request<T>(path: string, init: RequestOptions = {}): Promise<T> {
      const correlationId = newId();
      const callerSignal = init.signal;
      if (!isGatewayPath(path)) throw failure(undefined, 'INVALID_PATH', correlationId);
      if (callerSignal?.aborted) throw failure(undefined, 'ABORTED', correlationId);

      const method = (init.method ?? 'GET').toUpperCase();
      const headers: Record<string, string> = { Accept: 'application/json' };
      for (const [name, value] of Object.entries(init.headers ?? {})) {
        if (!RESERVED_HEADERS.has(name.toLowerCase())) headers[name] = value;
      }
      const token = options.token();
      if (token) headers['Authorization'] = `Bearer ${token}`;
      headers['X-Correlation-Id'] = correlationId;
      // A FormData goes as is: the browser sets multipart/form-data with its boundary, so no Content-Type here.
      const isForm = typeof FormData !== 'undefined' && init.body instanceof FormData;
      if (init.body !== undefined && !isForm) headers['Content-Type'] = 'application/json';

      const controller = new AbortController();
      let timedOut = false;
      // A valid `timeoutMs` of the caller wins (a saga may take 70 s); otherwise the client default, longer for a file.
      const asked = init.timeoutMs;
      const waitMs =
        typeof asked === 'number' && Number.isFinite(asked) && asked > 0
          ? Math.min(asked, MAX_REQUEST_TIMEOUT_MS)
          : isForm
            ? Math.max(timeoutMs, FORM_DATA_TIMEOUT_MS)
            : timeoutMs;
      const timer = setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, waitMs);
      const onCallerAbort = () => controller.abort();
      callerSignal?.addEventListener('abort', onCallerAbort, { once: true });

      try {
        const response = await send(options.baseUrl + path, {
          method,
          headers,
          body: init.body === undefined ? undefined : isForm ? (init.body as FormData) : JSON.stringify(init.body),
          signal: controller.signal,
        });
        if (response.ok) {
          const text = await response.text();
          try {
            return (text ? JSON.parse(text) : undefined) as T;
          } catch {
            throw failure(response.status, 'INVALID_RESPONSE', correlationId);
          }
        }
        if (response.status === 401 && `${method} ${path.split('?')[0]}` !== KEEPS_SESSION_ON_401) {
          options.onUnauthorized(token);
        }
        const envelope = await readEnvelope(response);
        throw failure(
          response.status,
          envelope.error ?? 'HTTP_ERROR',
          envelope.traceId ?? response.headers.get('X-Correlation-Id') ?? correlationId,
          readDetails(envelope.details),
        );
      } catch (err) {
        if (isApiError(err)) throw err;
        throw failure(undefined, timedOut ? 'TIMEOUT' : callerSignal?.aborted ? 'ABORTED' : 'NETWORK_ERROR', correlationId);
      } finally {
        clearTimeout(timer);
        callerSignal?.removeEventListener('abort', onCallerAbort);
      }
    },
  };
}

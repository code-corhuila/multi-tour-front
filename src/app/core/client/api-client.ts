import { ApiClient, ApiError, RequestOptions } from './types';

export const REQUEST_TIMEOUT_MS = 10_000;

export interface ClientOptions {
  baseUrl: string;
  token: () => string | null;
  onUnauthorized: () => void;
  fetch?: typeof fetch;
  timeoutMs?: number;
  newCorrelationId?: () => string;
}

const BY_CODE: Record<string, string> = {
  TIMEOUT: 'The server took too long to answer. Try again.',
  NETWORK_ERROR: 'The server could not be reached. Check your connection and try again.',
};

const BY_STATUS: Record<number, string> = {
  400: 'Some of the data is not valid. Review it and try again.',
  401: 'Your session ended. Sign in again.',
  403: 'You do not have permission to do this.',
  404: 'What you asked for was not found.',
  422: 'This action is not allowed in the current state.',
  429: 'Too many requests. Wait a moment and try again.',
  503: 'This service is not available right now. Try again later.',
};

/** The single place that decides the message a person sees for a status or code. */
export function messageFor(status: number | undefined, code: string): string {
  return (
    BY_CODE[code] ??
    (status === undefined ? undefined : BY_STATUS[status]) ??
    'Something went wrong on our side. Try again later.'
  );
}

function failure(status: number | undefined, code: string, traceId: string): ApiError {
  return { status, code, message: messageFor(status, code), traceId };
}

/** The common envelope `{error, message, traceId}`; anything else (HTML from a proxy, empty body) is tolerated. */
async function readEnvelope(response: Response): Promise<{ error?: string; traceId?: string }> {
  try {
    const body: unknown = await response.json();
    return (typeof body === 'object' && body !== null ? body : {}) as { error?: string; traceId?: string };
  } catch {
    return {};
  }
}

export function createApiClient(options: ClientOptions): ApiClient {
  const send = options.fetch ?? globalThis.fetch.bind(globalThis);
  const timeoutMs = options.timeoutMs ?? REQUEST_TIMEOUT_MS;
  const newId = options.newCorrelationId ?? (() => crypto.randomUUID());

  return {
    async request<T>(path: string, init: RequestOptions = {}): Promise<T> {
      const correlationId = newId();
      const headers: Record<string, string> = { Accept: 'application/json', ...init.headers };
      const token = options.token();
      if (token) headers['Authorization'] = `Bearer ${token}`;
      headers['X-Correlation-Id'] = correlationId;
      if (init.body !== undefined) headers['Content-Type'] = 'application/json';

      const controller = new AbortController();
      let timedOut = false;
      const timer = setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, timeoutMs);
      init.signal?.addEventListener('abort', () => controller.abort(), { once: true });

      try {
        const response = await send(options.baseUrl + path, {
          method: init.method ?? 'GET',
          headers,
          body: init.body === undefined ? undefined : JSON.stringify(init.body),
          signal: controller.signal,
        });
        if (response.ok) {
          const text = await response.text();
          return (text ? JSON.parse(text) : undefined) as T;
        }
        if (response.status === 401) options.onUnauthorized();
        const envelope = await readEnvelope(response);
        throw failure(
          response.status,
          envelope.error ?? 'HTTP_ERROR',
          envelope.traceId ?? response.headers.get('X-Correlation-Id') ?? correlationId,
        );
      } catch (err) {
        if (isApiError(err)) throw err;
        throw failure(undefined, timedOut ? 'TIMEOUT' : 'NETWORK_ERROR', correlationId);
      } finally {
        clearTimeout(timer);
      }
    },
  };
}

function isApiError(value: unknown): value is ApiError {
  return typeof value === 'object' && value !== null && 'traceId' in value && 'code' in value;
}

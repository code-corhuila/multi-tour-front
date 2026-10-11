import { ApiClient } from './types';

export const REQUEST_TIMEOUT_MS = 10_000;

export interface ClientOptions {
  baseUrl: string;
  token: () => string | null;
  onUnauthorized: () => void;
  fetch?: typeof fetch;
  timeoutMs?: number;
  newCorrelationId?: () => string;
}

/** The single place that decides the message a person sees for a status or code. */
export function messageFor(status: number | undefined, code: string): string {
  return `${status ?? ''} ${code}`;
}

export function createApiClient(_options: ClientOptions): ApiClient {
  return { request: () => Promise.resolve(undefined as never) };
}

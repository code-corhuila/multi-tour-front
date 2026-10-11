import { Session, SessionAnswer } from './types';

export type Refresher = (refreshToken: string) => Promise<SessionAnswer>;

/** The access token lives in memory only (ADR-006 F6). */
export class TenantSession implements Session {
  token: string | null = null;
  readonly roles: string[] = [];

  open(_answer: unknown): void {}

  close(): void {}
}

/** One session per tenant identifier, so two tenants never mix (RN-FRT-02). */
export class SessionStore {
  constructor(_refresh: Refresher) {}

  of(_identifier: string): TenantSession {
    return new TenantSession();
  }
}

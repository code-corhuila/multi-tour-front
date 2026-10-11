import { Session, SessionAnswer } from './types';

export type Refresher = (refreshToken: string) => Promise<SessionAnswer>;

/** The access token lasts 15 minutes; it is renewed this long before it ends. */
export const RENEW_LEAD_MS = 60_000;

function rolesOf(accessToken: string): string[] {
  try {
    const payload = accessToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const roles: unknown = JSON.parse(atob(payload)).roles;
    return Array.isArray(roles) ? roles.filter((r): r is string => typeof r === 'string') : [];
  } catch {
    return [];
  }
}

function asAnswer(value: unknown): SessionAnswer {
  const a = value as Partial<SessionAnswer> | null;
  if (typeof a?.accessToken !== 'string' || typeof a.expiresIn !== 'number') {
    throw new Error('session answer needs accessToken and expiresIn');
  }
  return { accessToken: a.accessToken, refreshToken: a.refreshToken, expiresIn: a.expiresIn };
}

/**
 * Tokens live in memory only (ADR-006 F6): the refresh endpoint answers the refresh token in the body, so the
 * container cannot keep it in an HttpOnly cookie; it is held here and sent in the refresh body.
 */
export class TenantSession implements Session {
  token: string | null = null;
  roles: string[] = [];
  private refreshToken: string | undefined;
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor(private readonly refresh: Refresher) {}

  open(answer: unknown): void {
    const { accessToken, refreshToken, expiresIn } = asAnswer(answer);
    clearTimeout(this.timer);
    this.token = accessToken;
    this.refreshToken = refreshToken;
    this.roles = rolesOf(accessToken);
    this.timer = setTimeout(() => void this.renew(), Math.max(expiresIn * 1000 - RENEW_LEAD_MS, 0));
  }

  close(): void {
    clearTimeout(this.timer);
    this.token = null;
    this.refreshToken = undefined;
    this.roles = [];
  }

  private async renew(): Promise<void> {
    if (!this.refreshToken) return this.close();
    try {
      this.open(await this.refresh(this.refreshToken));
    } catch {
      this.close();
    }
  }
}

/** One session per tenant identifier, so two tenants never mix (RN-FRT-02). */
export class SessionStore {
  private readonly sessions = new Map<string, TenantSession>();

  constructor(private readonly refresh: Refresher) {}

  of(identifier: string): TenantSession {
    let session = this.sessions.get(identifier);
    if (!session) {
      session = new TenantSession(this.refresh);
      this.sessions.set(identifier, session);
    }
    return session;
  }
}

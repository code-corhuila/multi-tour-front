import { Session, SessionAnswer } from './types';

export type Refresher = (refreshToken: string) => Promise<SessionAnswer>;

/** The access token lasts 15 minutes; it is renewed this long before it ends. */
export const RENEW_LEAD_MS = 60_000;
/** A renewal is never scheduled sooner than this, so a short or odd `expiresIn` cannot loop refreshes. */
export const MIN_RENEW_MS = 5_000;
/** `setTimeout` fires at once for delays above this. */
const MAX_TIMER_MS = 2 ** 31 - 1;

type Access = 'password-change' | 'restricted';

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/**
 * Reads the token payload (base64url, UTF-8). Roles and `access` are only hints to choose a screen:
 * every service validates RS256, `exp` and `sub` by itself, so nothing here is a security decision.
 */
function payloadOf(accessToken: string): Record<string, unknown> {
  try {
    const base64 = accessToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='));
    const text = new TextDecoder().decode(Uint8Array.from(binary, (c) => c.charCodeAt(0)));
    const payload: unknown = JSON.parse(text);
    return typeof payload === 'object' && payload !== null ? (payload as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** An absent claim is a normal access; a present one that is not understood is treated as the most limited. */
function accessOf(payload: Record<string, unknown>): Access | undefined {
  const claim = payload['access'];
  if (claim === undefined) return undefined;
  return claim === 'password-change' ? claim : 'restricted';
}

/** The name the token may carry; blank or non-text means the container does not know it. */
function displayNameOf(payload: Record<string, unknown>): string | undefined {
  const claim = payload['displayName'];
  return typeof claim === 'string' && claim.trim() !== '' ? claim.trim() : undefined;
}

function rolesOf(payload: Record<string, unknown>): string[] {
  const roles = payload['roles'];
  return Array.isArray(roles) ? roles.filter((r): r is string => typeof r === 'string') : [];
}

function asAnswer(value: unknown): SessionAnswer {
  const a = value as Partial<SessionAnswer> | null;
  if (typeof a?.accessToken !== 'string' || a.accessToken === '') throw new Error('session answer needs an accessToken');
  if (typeof a.expiresIn !== 'number' || !Number.isFinite(a.expiresIn) || a.expiresIn <= 0) {
    throw new Error('session answer needs a positive expiresIn');
  }
  const refreshToken = typeof a.refreshToken === 'string' && a.refreshToken !== '' ? a.refreshToken : undefined;
  return { accessToken: a.accessToken, refreshToken, expiresIn: a.expiresIn };
}

/**
 * Tokens live in memory only (ADR-006 F6): the refresh endpoint answers the refresh token in the body, so the
 * container cannot keep it in an HttpOnly cookie; it is held here and sent in the refresh body.
 */
export class TenantSession implements Session {
  token: string | null = null;
  roles: string[] = [];
  access: Access | undefined;
  displayName: string | undefined;
  private refreshToken: string | undefined;
  private timer: ReturnType<typeof setTimeout> | undefined;
  /** Bumped by every open and close, so a renewal that finishes after either one is dropped. */
  private generation = 0;

  constructor(private readonly refresh: Refresher) {}

  open(answer: unknown): void {
    const { accessToken, refreshToken, expiresIn } = asAnswer(answer);
    const payload = payloadOf(accessToken);
    this.reset();
    this.token = accessToken;
    this.refreshToken = refreshToken;
    this.roles = rolesOf(payload);
    this.access = accessOf(payload);
    this.displayName = displayNameOf(payload);
    this.timer = refreshToken
      ? setTimeout(() => void this.renew(), clamp(expiresIn * 1000 - RENEW_LEAD_MS, MIN_RENEW_MS, MAX_TIMER_MS))
      : setTimeout(() => this.close(), clamp(expiresIn * 1000, 0, MAX_TIMER_MS));
  }

  close(): void {
    this.reset();
  }

  private reset(): void {
    this.generation++;
    clearTimeout(this.timer);
    this.token = null;
    this.refreshToken = undefined;
    this.roles = [];
    this.access = undefined;
    this.displayName = undefined;
  }

  private async renew(): Promise<void> {
    const generation = this.generation;
    try {
      const next = await this.refresh(this.refreshToken as string);
      if (generation === this.generation) this.open(next);
    } catch {
      if (generation === this.generation) this.close();
    }
  }
}

/** One session per tenant identifier, so two tenants never mix (RN-FRT-02). */
export class SessionStore {
  private readonly sessions = new Map<string, TenantSession>();

  constructor(private readonly refresh: Refresher) {}

  /** No identifier means the platform session; the key prefixes keep a tenant named `platform` apart from it. */
  of(identifier?: string): TenantSession {
    const key = identifier === undefined ? 'platform' : `tenant:${identifier}`;
    let session = this.sessions.get(key);
    if (!session) {
      session = new TenantSession(this.refresh);
      this.sessions.set(key, session);
    }
    return session;
  }
}

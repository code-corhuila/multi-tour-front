import { SessionAnswer } from './types';

/** A JWT-shaped string whose payload is base64url without padding, as the security service signs it. */
export function jwt(roles: string[], extra: Record<string, unknown> = {}): string {
  const bytes = new TextEncoder().encode(JSON.stringify({ sub: 'u1', roles, ...extra }));
  const payload = btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `h.${payload}.s`;
}

export function answer(token = jwt(['ADMIN']), refreshToken: string | null = 'r'.repeat(24), expiresIn = 900): SessionAnswer {
  return refreshToken === null ? { accessToken: token, expiresIn } : { accessToken: token, refreshToken, expiresIn };
}

export function json(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });
}

import { afterEach, describe, expect, it, vi } from 'vitest';
import { SessionStore } from './session';
import { answer, jwt } from './test-helpers';
import { SessionAnswer } from './types';

afterEach(() => vi.useRealTimers());

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

describe('session', () => {
  it('U·access_claim_is_exposed_and_unknown_values_fail_closed', () => {
    const store = new SessionStore(vi.fn());
    const session = store.of('acme');
    const cases: [Record<string, unknown>, unknown][] = [
      [{ access: 'password-change' }, 'password-change'],
      [{ access: 'restricted' }, 'restricted'],
      [{ access: 'something-new' }, 'restricted'],
      [{}, undefined],
    ];
    for (const [claims, expected] of cases) {
      session.open(answer(jwt([], claims)));
      expect(session.access).toBe(expected);
    }
    session.open(answer(jwt([], { access: 'restricted' })));
    session.close();
    expect(session.access).toBeUndefined();
  });

  it('U·payload_is_decoded_as_base64url_utf8', () => {
    const token = jwt(['Ñandú', '?>?>?>?>?>?>?>?>']);
    expect(token).toMatch(/[-_]/);
    const session = new SessionStore(vi.fn()).of('acme');
    session.open(answer(token));
    expect(session.roles).toEqual(['Ñandú', '?>?>?>?>?>?>?>?>']);
    session.close();
  });

  it('U·open_rejects_bad_answers_and_keeps_the_previous_state', () => {
    const session = new SessionStore(vi.fn()).of('acme');
    session.open(answer(jwt(['KEEP'])));
    const bad: unknown[] = [
      null,
      {},
      'x',
      { accessToken: 'a.b.c' },
      { accessToken: 'a.b.c', expiresIn: Number.NaN },
      { accessToken: 'a.b.c', expiresIn: 0 },
      { accessToken: 'a.b.c', expiresIn: -5 },
      { accessToken: 'a.b.c', expiresIn: '900' },
      { accessToken: '', expiresIn: 900 },
    ];
    for (const value of bad) {
      expect(() => session.open(value)).toThrow();
      expect(session.token).toBe(jwt(['KEEP']));
    }
    session.close();
  });

  it('U·a_refresh_that_finishes_after_close_is_dropped', async () => {
    vi.useFakeTimers();
    const pending = deferred<SessionAnswer>();
    const session = new SessionStore(() => pending.promise).of('acme');
    session.open(answer());
    await vi.advanceTimersByTimeAsync(840_000);

    session.close();
    pending.resolve(answer(jwt(['LATE'])));
    await vi.advanceTimersByTimeAsync(0);

    expect(session.token).toBeNull();
  });

  it('U·a_refresh_that_finishes_after_a_newer_sign_in_is_dropped', async () => {
    vi.useFakeTimers();
    const pending = deferred<SessionAnswer>();
    const session = new SessionStore(() => pending.promise).of('acme');
    session.open(answer());
    await vi.advanceTimersByTimeAsync(840_000);

    session.open(answer(jwt(['NEWER'])));
    pending.resolve(answer(jwt(['LATE'])));
    await vi.advanceTimersByTimeAsync(0);

    expect(session.token).toBe(jwt(['NEWER']));
    session.close();
  });

  it('U·a_failed_renewal_closes_the_session', async () => {
    vi.useFakeTimers();
    const session = new SessionStore(() => Promise.reject(new Error('401'))).of('acme');
    session.open(answer());
    await vi.advanceTimersByTimeAsync(840_000);
    expect(session.token).toBeNull();
  });

  it('U·renewal_delay_is_clamped_so_it_never_loops', async () => {
    vi.useFakeTimers();
    const refresh = vi.fn().mockResolvedValue(answer(jwt([]), 'n'.repeat(24), 1));
    const session = new SessionStore(refresh).of('acme');
    session.open(answer(jwt([]), 'o'.repeat(24), 1));

    await vi.advanceTimersByTimeAsync(4_999);
    expect(refresh).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(refresh).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(4_000);
    expect(refresh).toHaveBeenCalledTimes(1);
    session.close();

    const huge = new SessionStore(refresh).of('huge');
    huge.open(answer(jwt([]), 'o'.repeat(24), 1e12));
    await vi.advanceTimersByTimeAsync(1_000);
    expect(refresh).toHaveBeenCalledTimes(1);
    huge.close();
  });

  it('U·without_a_refresh_token_the_session_ends_at_the_real_expiry', async () => {
    vi.useFakeTimers();
    const refresh = vi.fn();
    const session = new SessionStore(refresh).of('acme');
    session.open(answer(jwt([], { access: 'restricted' }), null, 600));

    await vi.advanceTimersByTimeAsync(599_000);
    expect(session.token).not.toBeNull();
    await vi.advanceTimersByTimeAsync(1_000);
    expect(session.token).toBeNull();
    expect(refresh).not.toHaveBeenCalled();
  });

  it('U·platform_and_a_tenant_named_platform_do_not_share_a_session', () => {
    const store = new SessionStore(vi.fn());
    store.of().open(answer(jwt(['PLATFORM'])));
    expect(store.of('platform').token).toBeNull();
    expect(store.of().token).toBe(jwt(['PLATFORM']));
    store.of().close();
  });

  it('U·container_passes_display_name_when_the_session_has_it', () => {
    const session = new SessionStore(vi.fn()).of('acme');
    session.open(answer(jwt(['CLIENT'], { displayName: '  Ana Pérez  ' })));
    expect(session.displayName).toBe('Ana Pérez');
    session.close();
    expect(session.displayName).toBeUndefined();
  });

  it('U·container_omits_display_name_when_unknown', () => {
    const session = new SessionStore(vi.fn()).of('acme');
    for (const claims of [{}, { displayName: '' }, { displayName: '   ' }, { displayName: 42 }, { displayName: null }]) {
      session.open(answer(jwt(['CLIENT'], claims)));
      expect(session.displayName).toBeUndefined();
    }
    session.close();
  });

  it('U·no_name_in_web_storage', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const log = vi.spyOn(console, 'log');
    const warn = vi.spyOn(console, 'warn');
    const session = new SessionStore(vi.fn()).of('acme');
    session.open(answer(jwt(['CLIENT'], { displayName: 'Ana Pérez' })));
    expect(session.displayName).toBe('Ana Pérez');
    expect(setItem).not.toHaveBeenCalled();
    expect(JSON.stringify({ ...localStorage })).not.toContain('Ana');
    expect(JSON.stringify({ ...sessionStorage })).not.toContain('Ana');
    expect(log).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
    session.close();
    vi.restoreAllMocks();
  });
  it('U·permissions_follow_the_claim_or_the_roles_and_are_cleared_on_close', () => {
    const session = new SessionStore(vi.fn()).of('acme');
    session.open(answer(jwt(['MANAGER'])));
    expect([...session.permissions].sort()).toEqual(['Consultar datos sensibles', 'Gestionar ejecución de salidas']);
    session.open(answer(jwt(['MANAGER'], { permissions: ['Gestionar caja'] })));
    expect(session.permissions).toEqual(['Gestionar caja']);
    session.close();
    expect(session.permissions).toEqual([]);
  });
});

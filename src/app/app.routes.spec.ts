import { describe, expect, it } from 'vitest';
import { authGuard } from './core/auth/auth.guard';
import { routes } from './app.routes';
import { LandingComponent } from './landing/landing.component';

const route = (path: string) => routes.find((r) => r.path === path);

describe('route table', () => {
  it('has the home, the platform and the tenant link, and ends with the common 404', () => {
    expect(routes.map((r) => r.path)).toEqual(expect.arrayContaining(['', 'platform', 't/:identifier']));
    expect(routes.at(-1)?.path).toBe('**');
  });

  it('resolves the tenant before anything under its link', () => {
    expect(route('t/:identifier')?.resolve?.['tenant']).toBeDefined();
    expect(route('platform')?.resolve).toBeUndefined();
  });

  it('protects the areas of the tenant and of the platform, and leaves the rest to the identity portal', () => {
    for (const parent of ['t/:identifier', 'platform']) {
      const children = route(parent)?.children ?? [];
      expect(children.find((c) => c.path === 'areas/:remote')?.canActivate).toEqual([authGuard]);
      expect(children.at(-1)?.path).toBe('**');
      expect(children.at(-1)?.canActivate).toBeUndefined();
    }
  });

  it('shows the landing at the index of the tenant link, before the identity portal', () => {
    const children = route('t/:identifier')?.children ?? [];
    expect(children[0]?.path).toBe('');
    expect(children[0]?.pathMatch).toBe('full');
    expect(route('platform')?.children?.[0]?.path).not.toBe('');
  });

  it('shows the welcome at the root and mounts the general login at ingresar, ending in the 404', () => {
    expect(route('')?.component).toBe(LandingComponent);
    const general = route('ingresar')?.children ?? [];
    expect(general.at(-1)?.path).toBe('**');
    expect(general.at(-1)?.data).toMatchObject({ remote: 'identity-audit-portal', scope: 'general' });
    expect(general.at(-1)?.canActivate).toBeUndefined();
    expect(routes.at(-1)?.path).toBe('**');
  });

  it('keeps the old sign-in path as an alias of ingresar under the tenant and the platform', () => {
    for (const parent of ['t/:identifier', 'platform']) {
      const alias = (route(parent)?.children ?? []).find((c) => c.path === 'sign-in');
      expect(alias?.redirectTo).toBe('ingresar');
    }
  });

  it('includes the development sign-in in the development build', () => {
    expect(route('dev-sign-in')).toBeDefined();
  });
});
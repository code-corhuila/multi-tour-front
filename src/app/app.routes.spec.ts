import { describe, expect, it } from 'vitest';
import { authGuard } from './core/auth/auth.guard';
import { routes } from './app.routes';

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

  it('includes the development sign-in in the development build', () => {
    expect(route('dev-sign-in')).toBeDefined();
  });
});
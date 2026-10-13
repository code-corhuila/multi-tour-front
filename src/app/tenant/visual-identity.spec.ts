import { describe, expect, it } from 'vitest';
import { toAccentVariables } from './visual-identity';

describe('toAccentVariables', () => {
  it('U-profile_colors_become_accent_variables', () => {
    const vars = toAccentVariables({ primaryColor: '#1E6F69', secondaryColor: '#184f4d' });
    expect(vars['--accent']).toBe('#1E6F69');
    expect(vars['--accent-strong']).toBe('#184f4d');
  });

  it('U-only_the_accent_variables_are_set_and_the_soft_tint_comes_from_the_primary', () => {
    const vars = toAccentVariables({ primaryColor: '#1e6f69', secondaryColor: '#184f4d' });
    expect(Object.keys(vars).sort()).toEqual(['--accent', '--accent-soft', '--accent-strong']);
    expect(vars['--accent-soft']).toBe('color-mix(in srgb, #1e6f69 10%, transparent)');
  });

  it('U-profile_without_visual_identity_sets_no_variable', () => {
    for (const none of [undefined, null]) expect(toAccentVariables(none)).toEqual({});
  });

  it('U-malformed_color_is_not_applied', () => {
    const bad = ['red', '#fff', '#12345g', '#1234567', 'url(x)', '#123456; x: y', '', 'rgb(0,0,0)'];
    for (const value of bad) {
      expect(toAccentVariables({ primaryColor: value, secondaryColor: '#184f4d' }), value).toEqual({});
      expect(toAccentVariables({ primaryColor: '#1e6f69', secondaryColor: value }), value).toEqual({});
    }
    expect(toAccentVariables({ primaryColor: 1, secondaryColor: null } as never)).toEqual({});
  });
});
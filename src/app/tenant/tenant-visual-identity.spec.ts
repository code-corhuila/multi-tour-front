import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { TenantVisualIdentity } from './tenant-visual-identity';

const make = (initial?: unknown) => {
  TestBed.configureTestingModule({ providers: [TenantVisualIdentity] });
  const state = TestBed.inject(TenantVisualIdentity);
  if (initial !== undefined) state.start(initial);
  return state;
};

describe('TenantVisualIdentity', () => {
  it('U-starts_from_the_profile_colors_and_exposes_them_as_variables', () => {
    const state = make({ primaryColor: '#112233', secondaryColor: '#445566' });
    expect(state.current()).toEqual({ primaryColor: '#112233', secondaryColor: '#445566' });
    expect(state.variables()['--accent']).toBe('#112233');
  });

  it('U-without_a_valid_profile_identity_there_is_none', () => {
    for (const bad of [null, { primaryColor: 'red', secondaryColor: '#445566' }, 'x', 42]) {
      const state = make(bad);
      expect(state.current(), String(bad)).toBeNull();
      expect(state.variables()).toEqual({});
      TestBed.resetTestingModule();
    }
  });

  it('U-change_updates_the_variables_and_a_malformed_change_is_ignored', () => {
    const state = make({ primaryColor: '#112233', secondaryColor: '#445566' });
    state.change({ primaryColor: '#aabbcc', secondaryColor: '#ddeeff' });
    expect(state.variables()['--accent']).toBe('#aabbcc');
    expect(state.variables()['--accent-strong']).toBe('#ddeeff');
    state.change({ primaryColor: 'javascript:1', secondaryColor: '#ddeeff' });
    state.change(null);
    state.change(undefined);
    expect(state.variables()['--accent']).toBe('#aabbcc');
  });
});
import { describe, expect, it } from 'vitest';
import { PERMISSIONS, permissionsOf } from './permissions';

describe('permissions of the session', () => {
  it('U·claim_wins_over_the_roles: a permissions claim of strings is used as it comes', () => {
    expect(permissionsOf(['Gestionar caja', 'x'], ['MANAGER'])).toEqual(['Gestionar caja', 'x']);
  });

  it('U·malformed_claim_falls_back_to_the_roles: a claim that is not a list of strings is ignored', () => {
    expect(permissionsOf('Gestionar caja', ['MANAGER'])).toEqual(permissionsOf(undefined, ['MANAGER']));
    expect(permissionsOf([1, 2], ['MANAGER'])).toEqual(permissionsOf(undefined, ['MANAGER']));
  });

  it('U·roles_map_to_the_decided_permissions: the table of the lead, nothing else', () => {
    expect(permissionsOf(undefined, ['TENANT_ADMINISTRATOR']).sort()).toEqual(
      [PERMISSIONS.validateProofs, PERMISSIONS.manageCash, PERMISSIONS.manageDepartures, PERMISSIONS.sensitiveData].sort(),
    );
    expect(permissionsOf(undefined, ['MANAGER']).sort()).toEqual([PERMISSIONS.manageDepartures, PERMISSIONS.sensitiveData].sort());
    expect(permissionsOf(undefined, ['ACCOUNTANT']).sort()).toEqual([PERMISSIONS.manageCash, PERMISSIONS.validateProofs].sort());
    for (const role of ['OPERATIONAL_COLLABORATOR', 'ANALYST', 'FINAL_CUSTOMER', 'PLATFORM_ADMINISTRATOR', 'UNKNOWN']) {
      expect(permissionsOf(undefined, [role])).toEqual([]);
    }
  });

  it('U·several_roles_add_up_without_duplicates', () => {
    const all = permissionsOf(undefined, ['MANAGER', 'ACCOUNTANT']);
    expect(new Set(all).size).toBe(all.length);
    expect(all).toHaveLength(4);
  });
});

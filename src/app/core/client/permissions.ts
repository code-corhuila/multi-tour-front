/** Special permissions a person may hold in a tenant (names as the Mockup shows them in the collaborator detail). */
export const PERMISSIONS = {
  validateProofs: 'Validar comprobantes',
  manageCash: 'Gestionar caja',
  manageDepartures: 'Gestionar ejecución de salidas',
  sensitiveData: 'Consultar datos sensibles',
} as const;

// shortcut: the token does not carry the permissions yet (claim name is gap G-C08 of Docs), so the roles stand in
// for them with this table; drop the table when the identity service issues the claim.
const BY_ROLE: Readonly<Record<string, readonly string[]>> = {
  TENANT_ADMINISTRATOR: [PERMISSIONS.validateProofs, PERMISSIONS.manageCash, PERMISSIONS.manageDepartures, PERMISSIONS.sensitiveData],
  MANAGER: [PERMISSIONS.manageDepartures, PERMISSIONS.sensitiveData],
  ACCOUNTANT: [PERMISSIONS.manageCash, PERMISSIONS.validateProofs],
};

/** The `permissions` claim when it is a list of strings; otherwise the union of what each role grants. */
export function permissionsOf(claim: unknown, roles: readonly string[]): string[] {
  if (Array.isArray(claim) && claim.every((p): p is string => typeof p === 'string')) return [...claim];
  return [...new Set(roles.flatMap((role) => BY_ROLE[role] ?? []))];
}

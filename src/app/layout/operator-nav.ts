import { entryChrome, entryRoles, ManifestEntry } from '../core/federation/remote-loader';
import { OPERATOR_NAV_COPY as COPY } from './operator-nav-copy';

/** The roles that get the operator sidebar, in the order their title is chosen. The backend still decides every request. */
export const OPERATOR_ROLES = ['TENANT_ADMINISTRATOR', 'OPERATIONAL_COLLABORATOR', 'MANAGER', 'ACCOUNTANT', 'ANALYST'] as const;
const ADMIN_ONLY = ['TENANT_ADMINISTRATOR'];

export interface OperatorNavEntry {
  readonly label: string;
  /** Key of the portal in the manifest. */
  readonly portal: string;
  /** Area key declared by that portal; absent when the portal opens its home. */
  readonly area?: string;
  readonly roles: readonly string[];
  /**
   * False draws the entry as "Próximamente" even when the portal is in the manifest. 'Colaboradores' is false because the
   * identity portal does not read `initialParams.area` yet and its list is reachable only from its own (hidden) bar.
   * Remove the flag when identity reads the area.
   */
  readonly available?: boolean;
}

const IDENTITY = 'identity-audit-portal';
const COMMERCIAL = 'commercial-reservation-portal';
const CASH = 'cash-reporting-portal';
const OPERATIONS = 'operations-cost-portal';

/** The one list of the sidebar (authorized screens, section "Menu inside a portal"); portals never send their own entries. */
export const OPERATOR_NAV: readonly OperatorNavEntry[] = [
  { label: COPY.entries.summary, portal: IDENTITY, roles: OPERATOR_ROLES },
  { label: COPY.entries.reservations, portal: COMMERCIAL, area: 'reservations', roles: OPERATOR_ROLES },
  { label: COPY.entries.departures, portal: OPERATIONS, roles: OPERATOR_ROLES },
  { label: COPY.entries.catalog, portal: COMMERCIAL, area: 'catalog', roles: OPERATOR_ROLES },
  { label: COPY.entries.discounts, portal: COMMERCIAL, area: 'discounts', roles: ADMIN_ONLY },
  { label: COPY.entries.payments, portal: COMMERCIAL, area: 'payments', roles: OPERATOR_ROLES },
  { label: COPY.entries.cash, portal: CASH, area: 'cash', roles: OPERATOR_ROLES },
  { label: COPY.entries.operation, portal: OPERATIONS, roles: OPERATOR_ROLES },
  { label: COPY.entries.notifications, portal: COMMERCIAL, area: 'notifications', roles: OPERATOR_ROLES },
  { label: COPY.entries.reports, portal: CASH, area: 'reports', roles: OPERATOR_ROLES },
  { label: COPY.entries.collaborators, portal: IDENTITY, roles: ADMIN_ONLY, available: false },
];

/** An entry as the sidebar draws it: a link, or "Próximamente" text when the portal cannot be opened by these roles. */
export interface NavItem {
  readonly label: string;
  readonly portal: string;
  readonly area?: string;
  readonly link: boolean;
}

export const isOperator = (roles: readonly string[]): boolean => OPERATOR_ROLES.some((role) => roles.includes(role));

/** The title under the brand: the first operator role of the session. */
export const roleLabel = (roles: readonly string[]): string => {
  const role = OPERATOR_ROLES.find((r) => roles.includes(r));
  return role ? COPY.roles[role] : '';
};

/** The entries these roles may see; each one is a link only when its portal is in the manifest and lets them in. */
export function operatorNav(manifest: Record<string, ManifestEntry>, roles: readonly string[]): NavItem[] {
  return OPERATOR_NAV.filter((e) => e.roles.some((role) => roles.includes(role))).map(({ label, portal, area, available }) => {
    const entry = Object.hasOwn(manifest, portal) ? manifest[portal] : undefined;
    const allowed = available !== false && entry !== undefined && (entryRoles(entry)?.some((role) => roles.includes(role)) ?? true);
    return { label, portal, ...(area && { area }), link: allowed };
  });
}

/** The container draws the sidebar only for an operator around a portal that declared `chrome: true`. */
export const chromeFor = (entry: ManifestEntry | undefined, roles: readonly string[]): boolean =>
  entry !== undefined && entryChrome(entry) && isOperator(roles);

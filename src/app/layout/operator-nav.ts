import { entryChrome, entryRoles, ManifestEntry } from '../core/federation/remote-loader';
import { OPERATOR_NAV_COPY as COPY } from './operator-nav-copy';

/** The roles that get the operator sidebar, in the order their title is chosen. The backend still decides every request. */
export const OPERATOR_ROLES = ['TENANT_ADMINISTRATOR', 'OPERATIONAL_COLLABORATOR', 'MANAGER', 'ACCOUNTANT', 'ANALYST'] as const;
const ADMIN_ONLY = ['TENANT_ADMINISTRATOR'];
// The optional read-only roles drop what is not theirs, as in the sidebar of each role of the landing page (indice.html).
const NO_ACCOUNTANT = ['TENANT_ADMINISTRATOR', 'OPERATIONAL_COLLABORATOR', 'MANAGER', 'ANALYST'];
const NO_ANALYST = ['TENANT_ADMINISTRATOR', 'OPERATIONAL_COLLABORATOR', 'MANAGER', 'ACCOUNTANT'];
const NO_COLLABORATOR = ['TENANT_ADMINISTRATOR', 'MANAGER', 'ACCOUNTANT', 'ANALYST'];
const ADMIN_AND_COLLABORATOR = ['TENANT_ADMINISTRATOR', 'OPERATIONAL_COLLABORATOR'];

export interface OperatorNavEntry {
  readonly label: string;
  /** Key of the portal in the manifest. */
  readonly portal: string;
  /** Area key declared by that portal; absent when the portal opens its home. */
  readonly area?: string;
  readonly roles: readonly string[];
  /**
   * A screen its portal owner is still building: the entry opens the container's blank screen
   * (`areas/pendiente?area=<slug>`) inside the sidebar instead of the portal. Without `fixed` it links to the portal as soon
   * as the manifest has it with `chrome: true`; with `fixed` it stays blank until the flag is removed here.
   */
  readonly pending?: { readonly slug: string; readonly fixed?: boolean };
}

const IDENTITY = 'identity-audit-portal';
const COMMERCIAL = 'commercial-reservation-portal';
const CASH = 'cash-reporting-portal';
const OPERATIONS = 'operations-cost-portal';

/** Route segment of the container's blank screen (`/t/<id>/areas/pendiente?area=<slug>`). */
export const PENDING_ROUTE = 'pendiente';

/** The one list of the sidebar (authorized screens, section "Menu inside a portal"); portals never send their own entries. */
export const OPERATOR_NAV: readonly OperatorNavEntry[] = [
  { label: COPY.entries.summary, portal: IDENTITY, roles: OPERATOR_ROLES },
  { label: COPY.entries.reservations, portal: COMMERCIAL, area: 'reservations', roles: OPERATOR_ROLES },
  { label: COPY.entries.departures, portal: OPERATIONS, pending: { slug: 'salidas' }, roles: NO_ACCOUNTANT },
  { label: COPY.entries.catalog, portal: COMMERCIAL, area: 'catalog', roles: NO_ACCOUNTANT },
  { label: COPY.entries.discounts, portal: COMMERCIAL, area: 'discounts', roles: ADMIN_ONLY },
  { label: COPY.entries.payments, portal: COMMERCIAL, area: 'payments', roles: OPERATOR_ROLES },
  { label: COPY.entries.cash, portal: CASH, area: 'cash', roles: NO_ANALYST },
  { label: COPY.entries.operation, portal: OPERATIONS, pending: { slug: 'operacion' }, roles: OPERATOR_ROLES },
  { label: COPY.entries.notifications, portal: COMMERCIAL, area: 'notifications', roles: ADMIN_AND_COLLABORATOR },
  { label: COPY.entries.reports, portal: CASH, area: 'reports', roles: OPERATOR_ROLES },
  // The audit screen belongs to the identity portal, which does not read the area yet: the entry stays on the blank screen, like Colaboradores.
  { label: COPY.entries.audit, portal: IDENTITY, pending: { slug: 'auditoria', fixed: true }, roles: NO_COLLABORATOR },
  { label: COPY.entries.collaborators, portal: IDENTITY, pending: { slug: 'colaboradores', fixed: true }, roles: ADMIN_ONLY },
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
  return OPERATOR_NAV.filter((e) => e.roles.some((role) => roles.includes(role))).map(({ label, portal, area, pending }) => {
    const entry = Object.hasOwn(manifest, portal) ? manifest[portal] : undefined;
    const allowed = entry !== undefined && (entryRoles(entry)?.some((role) => roles.includes(role)) ?? true);
    // A pending entry is blank unless it is not fixed and its portal already runs inside the single sidebar.
    if (pending && (pending.fixed || !(allowed && entryChrome(entry as ManifestEntry)))) {
      return { label, portal: PENDING_ROUTE, area: pending.slug, link: true };
    }
    return { label, portal, ...(area && { area }), link: allowed };
  });
}

/** The container draws the sidebar only for an operator around a portal that declared `chrome: true`. */
export const chromeFor = (entry: ManifestEntry | undefined, roles: readonly string[]): boolean =>
  entry !== undefined && entryChrome(entry) && isOperator(roles);

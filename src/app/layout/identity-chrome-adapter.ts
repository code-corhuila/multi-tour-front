/**
 * TEMPORARY adapter of the single operator sidebar (HU-FRT-001).
 *
 * The identity portal does not read `MountProps.chrome` yet, so it still draws its own sidebar (`aside.staff-sidebar`,
 * inside the grid `.staff-shell`, next to `main.staff-content`). While the container draws the one sidebar around it,
 * these rules hide that second bar and leave the content at full width. Every rule is scoped by the attribute
 * `data-chrome="container"`, which the container sets only on the slot of the identity portal when it draws its sidebar:
 * the sign-in (`**`) and the other portals never carry it, so nothing else is affected.
 *
 * REMOVE this file (and its use in `portal-page.component.ts`) when the identity portal reads `MountProps.chrome`.
 */
export const IDENTITY_PORTAL_KEY = 'identity-audit-portal';

/** True for the portal that still needs the adapter. */
export const COMMERCIAL_PORTAL_KEY = 'commercial-reservation-portal';

/** The commercial portal does not read `MountProps.chrome` either: its own `.crp-operator-sidebar` is hidden the same way. */
export const needsIdentityChromeAdapter = (remote: string): boolean => remote === IDENTITY_PORTAL_KEY || remote === COMMERCIAL_PORTAL_KEY;

/** Component styles (no inline script, CSP safe); `::ng-deep` reaches the remote DOM, which is not the container's. */
export const IDENTITY_CHROME_CSS = `
  :host ::ng-deep [data-chrome="container"] .staff-sidebar { display: none; }
  :host ::ng-deep [data-chrome="container"] .staff-shell { display: block; min-height: 0; }
  :host ::ng-deep [data-chrome="container"] .staff-content { margin: 0; width: 100%; }
  :host ::ng-deep [data-chrome="container"] .crp-operator-sidebar { display: none; }
  :host ::ng-deep [data-chrome="container"] .crp-operator-shell { display: block; min-height: 0; }
  :host ::ng-deep [data-chrome="container"] .crp-operator-content { margin: 0; width: 100%; }
`;

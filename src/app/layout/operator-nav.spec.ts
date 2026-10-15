import { describe, expect, it } from 'vitest';
import { ManifestEntry } from '../core/federation/remote-loader';
import { chromeFor, isOperator, operatorNav, OPERATOR_NAV } from './operator-nav';

const MANIFEST: Record<string, ManifestEntry> = {
  'identity-audit-portal': { url: 'portals/id.js', chrome: true },
  'commercial-reservation-portal': { url: 'portals/com.js', chrome: true },
  'cash-reporting-portal': { url: 'portals/cash.js', chrome: true, roles: ['TENANT_ADMINISTRATOR', 'OPERATIONAL_COLLABORATOR'] },
};

const PLAIN: ManifestEntry = 'portals/plain.js';

describe('operator navigation list', () => {
  it('U·sidebar_lists_the_eleven_entries_for_the_administrator', () => {
    const items = operatorNav(MANIFEST, ['TENANT_ADMINISTRATOR']);
    expect(items.map((i) => i.label)).toEqual([
      'Resumen', 'Reservas', 'Salidas', 'Catálogos', 'Descuentos', 'Pagos', 'Caja', 'Operación', 'Notificaciones', 'Reportes', 'Colaboradores',
    ]);
    expect(OPERATOR_NAV).toHaveLength(11);
  });

  it('U·sidebar_hides_descuentos_and_colaboradores_for_the_collaborator', () => {
    const labels = operatorNav(MANIFEST, ['OPERATIONAL_COLLABORATOR']).map((i) => i.label);
    expect(labels).toHaveLength(9);
    expect(labels).not.toContain('Descuentos');
    expect(labels).not.toContain('Colaboradores');
  });

  it('U·an_entry_whose_portal_is_not_in_the_manifest_is_not_a_link', () => {
    const items = operatorNav(MANIFEST, ['TENANT_ADMINISTRATOR']);
    expect(operatorNav({}, ['TENANT_ADMINISTRATOR']).find((i) => i.label === 'Reservas')?.link).toBe(false);
    expect(items.find((i) => i.label === 'Reservas')).toMatchObject({ link: true, portal: 'commercial-reservation-portal', area: 'reservations' });
  });

  it('U·an_entry_whose_portal_does_not_allow_the_roles_is_not_a_link', () => {
    const items = operatorNav(MANIFEST, ['ACCOUNTANT']);
    expect(items.find((i) => i.label === 'Caja')?.link).toBe(false);
    expect(items.find((i) => i.label === 'Reservas')?.link).toBe(true);
  });

  // Entries of screens the portal owners are still building open a blank screen of the container, as links.
  it('U·pending_entries_are_links_to_the_blank_screen_with_their_own_area', () => {
    const items = operatorNav(MANIFEST, ['TENANT_ADMINISTRATOR']);
    expect(items.find((i) => i.label === 'Salidas')).toMatchObject({ portal: 'pendiente', area: 'salidas', link: true });
    expect(items.find((i) => i.label === 'Operación')).toMatchObject({ portal: 'pendiente', area: 'operacion', link: true });
    expect(items.find((i) => i.label === 'Colaboradores')).toMatchObject({ portal: 'pendiente', area: 'colaboradores', link: true });
    expect(items.find((i) => i.label === 'Resumen')).toMatchObject({ portal: 'identity-audit-portal', link: true });
    expect(items.filter((i) => !i.link)).toEqual([]);
  });

  it('U·salidas_and_operacion_link_to_their_portal_once_it_is_in_the_manifest_with_the_flag', () => {
    const flagged = { ...MANIFEST, 'operations-cost-portal': { url: 'portals/ops.js', chrome: true } };
    const items = operatorNav(flagged, ['TENANT_ADMINISTRATOR']);
    expect(items.find((i) => i.label === 'Salidas')).toMatchObject({ portal: 'operations-cost-portal', link: true });
    expect(items.find((i) => i.label === 'Operación')).toMatchObject({ portal: 'operations-cost-portal', link: true });
    expect(items.find((i) => i.label === 'Salidas')?.area).toBeUndefined();
    // Colaboradores is fixed: it stays blank until the identity portal reads the area.
    expect(items.find((i) => i.label === 'Colaboradores')).toMatchObject({ portal: 'pendiente', area: 'colaboradores' });
    const unflagged = { ...MANIFEST, 'operations-cost-portal': 'portals/ops.js' };
    expect(operatorNav(unflagged, ['TENANT_ADMINISTRATOR']).find((i) => i.label === 'Salidas')?.portal).toBe('pendiente');
  });

  it('U·only_operator_roles_are_operators', () => {
    expect(isOperator(['TENANT_ADMINISTRATOR'])).toBe(true);
    expect(isOperator(['FINAL_CUSTOMER'])).toBe(false);
    expect(isOperator([])).toBe(false);
  });

  it('U·chrome_is_on_only_for_a_flagged_portal_and_an_operator', () => {
    expect(chromeFor(MANIFEST['commercial-reservation-portal'], ['TENANT_ADMINISTRATOR'])).toBe(true);
    expect(chromeFor(MANIFEST['identity-audit-portal'], ['TENANT_ADMINISTRATOR'])).toBe(true);
    expect(chromeFor(PLAIN, ['TENANT_ADMINISTRATOR'])).toBe(false);
    expect(chromeFor(MANIFEST['commercial-reservation-portal'], ['FINAL_CUSTOMER'])).toBe(false);
    expect(chromeFor(undefined, ['TENANT_ADMINISTRATOR'])).toBe(false);
  });
});

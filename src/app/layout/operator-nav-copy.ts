/** Every text of the operator sidebar (pillar 5); the list in `operator-nav.ts` and the component read only from here. */
export const OPERATOR_NAV_COPY = {
  navLabel: 'Navegación del operador',
  brand: ['MULTI', 'TOUR'],
  soon: 'Próximamente',
  signOut: 'Cerrar sesión',
  entries: {
    summary: 'Resumen',
    reservations: 'Reservas',
    departures: 'Salidas',
    catalog: 'Catálogos',
    discounts: 'Descuentos',
    payments: 'Pagos',
    cash: 'Caja',
    operation: 'Operación',
    notifications: 'Notificaciones',
    reports: 'Reportes',
    audit: 'Auditoría',
    collaborators: 'Colaboradores',
  },
  /** The title under the brand, by the first role of the session found here. */
  roles: {
    TENANT_ADMINISTRATOR: 'Administrador del tenant',
    OPERATIONAL_COLLABORATOR: 'Colaborador operativo',
    MANAGER: 'Gerente',
    ACCOUNTANT: 'Contador',
    ANALYST: 'Analista',
  },
} as const;

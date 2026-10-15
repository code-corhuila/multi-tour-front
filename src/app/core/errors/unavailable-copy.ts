/** Texts of the notice shown when a portal could not be mounted. Data only: the component holds no wording. */
export interface UnavailableCopy {
  readonly title: string;
  readonly body: string;
  readonly retry: string;
}

const OUT_OF_SERVICE_BODY = 'Este módulo no está disponible por ahora. El resto de la aplicación sigue funcionando.';
const OUT_OF_SERVICE_RETRY = 'Reintentar';

/** Portals of domains 02 and 04 only; any other portal keeps the original notice. */
const OUT_OF_SERVICE: Readonly<Record<string, UnavailableCopy>> = {
  'commercial-reservation-portal': {
    title: 'Comercial y reservas: fuera de servicio',
    body: OUT_OF_SERVICE_BODY,
    retry: OUT_OF_SERVICE_RETRY,
  },
  'cash-reporting-portal': {
    title: 'Caja y reportes: fuera de servicio',
    body: OUT_OF_SERVICE_BODY,
    retry: OUT_OF_SERVICE_RETRY,
  },
};

export function unavailableCopy(portal: string): UnavailableCopy {
  return (
    Object.hasOwn(OUT_OF_SERVICE, portal)
      ? OUT_OF_SERVICE[portal]
      : {
          title: `${portal} is not available right now`,
          body: 'The rest of the application still works.',
          retry: 'Try again',
        }
  );
}

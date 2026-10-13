import { ApplicationConfig } from '@angular/core';
import { provideRouter, withRouterConfig } from '@angular/router';
import { routes } from './app.routes';

// `always`: the portal page and the guard read `identifier` from the parent `t/:identifier` route.
export const appConfig: ApplicationConfig = {
  providers: [provideRouter(routes, withRouterConfig({ paramsInheritanceStrategy: 'always' }))],
};
import { Routes } from '@angular/router';

/** Development builds only: `angular.json` swaps this file for `dev-routes.production.ts` in the production build (norm 5.5.2). */
export const DEV_ROUTES: Routes = [
  { path: 'dev-sign-in', loadComponent: () => import('./dev-sign-in.component').then((m) => m.DevSignInComponent) },
];
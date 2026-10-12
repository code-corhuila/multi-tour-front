import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';
import { DEV_ROUTES } from './core/auth/dev-routes';
import { LandingComponent } from './landing/landing.component';
import { CompanySelectorComponent } from './layout/company-selector.component';
import { NotFoundComponent } from './layout/not-found.component';
import { IDENTITY_PORTAL, PortalPageComponent } from './layout/portal-page.component';
import { TenantShellComponent } from './tenant/tenant-shell.component';
import { tenantResolver } from './tenant/tenant.resolver';

/** Under a tenant link or the platform: `areas/:remote` is protected; everything else is the identity portal's (sign-in included). */
const portalRoutes: Routes = [
  // The old sign-in path stays as an alias; the query string (returnUrl included) is kept.
  { path: 'sign-in', redirectTo: 'ingresar' },
  { path: 'areas/:remote', component: PortalPageComponent, canActivate: [authGuard] },
  { path: '**', component: PortalPageComponent, data: { remote: IDENTITY_PORTAL } },
];

export const routes: Routes = [
  // Without a tenant the landing is generic; ingresar is where a company is chosen.
  { path: '', pathMatch: 'full', component: LandingComponent },
  { path: 'ingresar', component: CompanySelectorComponent },
  { path: 'platform', children: portalRoutes },
  {
    path: 't/:identifier',
    component: TenantShellComponent,
    resolve: { tenant: tenantResolver },
    // The public home of the tenant needs no session; everything else is the portal's.
    children: [{ path: '', pathMatch: 'full', component: LandingComponent }, ...portalRoutes],
  },
  ...DEV_ROUTES,
  { path: '**', component: NotFoundComponent },
];
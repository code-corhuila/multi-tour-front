import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';
import { DEV_ROUTES } from './core/auth/dev-routes';
import { HomeComponent } from './layout/home.component';
import { NotFoundComponent } from './layout/not-found.component';
import { IDENTITY_PORTAL, PortalPageComponent } from './layout/portal-page.component';
import { TenantShellComponent } from './tenant/tenant-shell.component';
import { tenantResolver } from './tenant/tenant.resolver';

/** Under a tenant link or the platform: `areas/:remote` is protected; everything else is the identity portal's (sign-in included). */
const portalRoutes: Routes = [
  { path: 'areas/:remote', component: PortalPageComponent, canActivate: [authGuard] },
  { path: '**', component: PortalPageComponent, data: { remote: IDENTITY_PORTAL } },
];

export const routes: Routes = [
  { path: '', pathMatch: 'full', component: HomeComponent },
  { path: 'platform', children: portalRoutes },
  { path: 't/:identifier', component: TenantShellComponent, resolve: { tenant: tenantResolver }, children: portalRoutes },
  ...DEV_ROUTES,
  { path: '**', component: NotFoundComponent },
];
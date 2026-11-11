import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, NavigationStart, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { CONTAINER_CLIENT } from '../core/client/container-client.token';
import { NotFoundComponent } from '../layout/not-found.component';
import { TenantLookup } from './tenant.resolver';
import { TenantVisualIdentity } from './tenant-visual-identity';

/** Page of `/t/:identifier`: the tenant is resolved before any portal is mounted below it. */
@Component({
  selector: 'app-tenant-shell',
  imports: [RouterOutlet, NotFoundComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [TenantVisualIdentity],
  // The profile carries no theme field yet, so the identifier is the theme key (`data-theme="travesia-natural"` in the Mockup).
  // The accent variables are inherited by the landing and by every portal mounted below.
  host: {
    '[attr.data-theme]': 'theme',
    '[style.--accent]': "identity.variables()['--accent']",
    '[style.--accent-strong]': "identity.variables()['--accent-strong']",
    '[style.--accent-soft]': "identity.variables()['--accent-soft']",
  },
  template: `
    @switch (tenant.state) {
      @case ('unknown') {
        <app-not-found message="This link does not match any company." />
      }
      @case ('inactive') {
        <section>
          <h2>{{ name }} is not active</h2>
          <p>This company is not taking part in Multitour right now.</p>
        </section>
        @if (signInOnly()) {
          <router-outlet />
        }
      }
      @case ('error') {
        <section role="alert">
          <p>{{ message }}</p>
          <button type="button" (click)="reload()">Try again</button>
        </section>
      }
      @default {
        <router-outlet />
      }
    }
  `,
})
export class TenantShellComponent {
  protected readonly tenant = inject(ActivatedRoute).snapshot.data['tenant'] as TenantLookup;
  protected readonly name = 'profile' in this.tenant ? this.tenant.profile.commercialName : '';
  protected readonly message = this.tenant.state === 'error' ? this.tenant.message : '';
  protected readonly identity = inject(TenantVisualIdentity);
  protected readonly theme = this.tenant.state === 'active' ? this.tenant.profile.identifier : null;

  private readonly client = inject(CONTAINER_CLIENT, { optional: true });
  private readonly router = inject(Router);
  private readonly url = signal(this.router.url);
  /** Follows the address the router is going to (start, not end), so the outlet is gone before a target area is activated.
   *  An inactive tenant opens no area, but its sign-in stays reachable for the Administrator's restricted access. */
  protected readonly signInOnly = computed(
    () => /^\/t\/[^/?#]+\/ingresar(?:[/?#]|$)/.test(this.url()) || (this.restrictedAdministrator() && /^\/t\/[^/?#]+\/areas\//.test(this.url())),
  );

  /** HU-COM-020: the session of this tenant is the restricted access of its Administrator; then an inactive tenant also opens the areas of its pending obligations. */
  private restrictedAdministrator(): boolean {
    if (this.tenant.state === 'unknown' || this.tenant.state === 'error') return false;
    const session = this.client?.store.of(this.tenant.profile.identifier);
    return session !== undefined && !!session.token && session.access === 'restricted' && session.roles.includes('TENANT_ADMINISTRATOR');
  }

  constructor() {
    this.router.events
      .pipe(filter((event): event is NavigationStart => event instanceof NavigationStart), takeUntilDestroyed())
      .subscribe((event) => this.url.set(event.url));
    if (this.tenant.state === 'active') this.identity.start(this.tenant.profile.visualIdentity);
  }

  protected reload(): void {
    location.reload();
  }
}
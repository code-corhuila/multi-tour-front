import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute, RouterOutlet } from '@angular/router';
import { NotFoundComponent } from '../layout/not-found.component';
import { TenantLookup } from './tenant.resolver';
import { toAccentVariables } from './visual-identity';

/** Page of `/t/:identifier`: the tenant is resolved before any portal is mounted below it. */
@Component({
  selector: 'app-tenant-shell',
  imports: [RouterOutlet, NotFoundComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  // The profile carries no theme field yet, so the identifier is the theme key (`data-theme="travesia-natural"` in the Mockup).
  // The accent variables are inherited by the landing and by every portal mounted below.
  host: {
    '[attr.data-theme]': 'theme',
    '[style.--accent]': "accents['--accent']",
    '[style.--accent-strong]': "accents['--accent-strong']",
    '[style.--accent-soft]': "accents['--accent-soft']",
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
  protected readonly accents =
    this.tenant.state === 'active' ? toAccentVariables(this.tenant.profile.visualIdentity) : {};
  protected readonly theme = this.tenant.state === 'active' ? this.tenant.profile.identifier : null;

  protected reload(): void {
    location.reload();
  }
}
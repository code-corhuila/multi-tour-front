import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, NavigationStart, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { CONTAINER_CLIENT } from '../core/client/container-client.token';
import { NotFoundComponent } from '../layout/not-found.component';
import { TenantLookup } from './tenant.resolver';
import { TenantBranding } from './tenant-branding';
import { TenantVisualIdentity } from './tenant-visual-identity';

/** Page of `/t/:identifier`: the tenant is resolved before any portal is mounted below it. */
@Component({
  selector: 'app-tenant-shell',
  imports: [RouterOutlet, NotFoundComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [TenantVisualIdentity, TenantBranding],
  // The profile carries no theme field yet, so the identifier is the theme key (`data-theme="travesia-natural"` in the Mockup).
  // The accent variables are inherited by the landing and by every portal mounted below.
  host: {
    '[attr.data-theme]': 'theme',
    '[style.--accent]': "identity.variables()['--accent']",
    '[style.--accent-strong]': "identity.variables()['--accent-strong']",
    '[style.--accent-soft]': "identity.variables()['--accent-soft']",
  },
  styles: `
    .tenant-brand { display: flex; flex-wrap: wrap; align-items: center; gap: 16px; padding: 12px 16px; border-bottom: 1px solid var(--accent-soft, rgba(0, 0, 0, 0.08)); }
    .tenant-brand-name { display: flex; align-items: center; gap: 12px; font-weight: 600; }
    .tenant-brand-logo { display: block; height: 56px; width: auto; max-width: 200px; object-fit: contain; }
    .tenant-brand-images { display: flex; flex-wrap: wrap; gap: 8px; margin: 0; padding: 0; list-style: none; }
    .tenant-brand-images img { display: block; height: 56px; width: auto; max-width: 120px; border-radius: 6px; object-fit: cover; }
  `,
  template: `
    @if (showBand()) {
      <section class="tenant-brand" aria-label="Company logo and images">
        <div class="tenant-brand-name">
          @if (logo(); as src) {
            <img class="tenant-brand-logo" [src]="src" [alt]="name" loading="lazy" (error)="failed(src)" />
          } @else {
            <span>{{ name }}</span>
          }
        </div>
        @if (images().length > 0) {
          <ul class="tenant-brand-images">
            @for (image of images(); track image.position) {
              <li><img [src]="image.url" [alt]="'Image ' + (image.position + 1)" loading="lazy" (error)="failed(image.url)" /></li>
            }
          </ul>
        }
      </section>
    }
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
  private readonly branding = inject(TenantBranding);
  /** Pictures the browser could not load: hidden, never shown broken (RN-FRT-53). */
  private readonly broken = signal<ReadonlySet<string>>(new Set());
  protected readonly logo = computed(() => {
    const src = this.branding.current().logoUrl;
    return src && !this.broken().has(src) ? src : null;
  });
  /** The images of an active company only: an inactive one shows its notice with its logo (RN-FRT-56). */
  protected readonly images = computed(() =>
    this.tenant.state === 'active' ? this.branding.current().images.filter((image) => !this.broken().has(image.url)) : [],
  );
  protected readonly showBand = computed(() => this.logo() !== null || this.images().length > 0);
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
    if ('profile' in this.tenant) this.branding.start(this.tenant.profile, this.tenant.profile.identifier);
  }

  protected failed(url: string): void {
    this.broken.update((set) => new Set(set).add(url));
  }

  protected reload(): void {
    location.reload();
  }
}
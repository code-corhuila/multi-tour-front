import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { CONTAINER_CLIENT } from '../core/client/container-client.token';
import { ManifestEntry, MANIFEST_LOADER } from '../core/federation/remote-loader';
import { NotFoundComponent } from './not-found.component';
import { isOperator, OPERATOR_NAV, operatorNav, PENDING_ROUTE, roleLabel } from './operator-nav';
import { OperatorSidebarComponent } from './operator-sidebar.component';

/**
 * Blank screen of the entries whose portal screen is still being built (`areas/pendiente?area=<slug>`): the single sidebar
 * with the entry active and an empty content, only a visually hidden title for assistive technology. It makes no request.
 */
@Component({
  selector: 'app-pending-page',
  imports: [OperatorSidebarComponent, NotFoundComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .operator-shell { display: grid; grid-template-columns: 226px minmax(0, 1fr); min-height: 100vh; background: var(--page-bg, #f5f7f7); }
    /* Own width: a portal stylesheet is global and may define .operator-content too (operations-cost sets 1240px). */
    .operator-content { min-width: 0; width: 100%; max-width: 1420px; }
    .visually-hidden { position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }
    @media (max-width: 860px) { .operator-shell { grid-template-columns: minmax(0, 1fr); } }
  `,
  template: `
    @let v = view();
    @if (v) {
      <div class="operator-shell">
        <app-operator-sidebar [items]="v.items" [identifier]="v.identifier" [roleLabel]="v.roleLabel" [active]="v.active" (closed)="signOut(v.identifier)" />
        <div class="operator-content"><main><h1 class="visually-hidden">{{ v.title }}</h1></main></div>
      </div>
    } @else if (ready()) {
      <app-not-found />
    }
  `,
})
export class PendingPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly client = inject(CONTAINER_CLIENT);
  private readonly loadManifest = inject(MANIFEST_LOADER);
  private readonly params = toSignal(this.route.paramMap, { requireSync: true });
  private readonly query = toSignal(this.route.queryParamMap, { requireSync: true });
  private readonly manifest = signal<Record<string, ManifestEntry> | undefined>(undefined);

  protected readonly ready = computed(() => this.manifest() !== undefined);

  protected readonly view = computed(() => {
    const manifest = this.manifest();
    const identifier = this.params().get('identifier');
    const slug = this.query().get('area');
    if (!manifest || !identifier) return undefined;
    const roles = this.client.propsFor(identifier, undefined).session.roles;
    const entry = OPERATOR_NAV.find((e) => e.pending?.slug === slug && e.roles.some((role) => roles.includes(role)));
    if (!entry || !isOperator(roles)) return undefined;
    return {
      identifier,
      title: entry.label,
      items: operatorNav(manifest, roles),
      roleLabel: roleLabel(roles),
      active: { portal: PENDING_ROUTE, area: slug as string },
    };
  });

  constructor() {
    // A manifest that fails to load still draws the bar: the blank entries need nothing from it.
    this.loadManifest().then(
      (manifest) => this.manifest.set(manifest),
      () => this.manifest.set({}),
    );
  }

  protected signOut(identifier: string): void {
    this.client.store.of(identifier).close();
    this.router.navigate(['/t', identifier, 'ingresar']).catch(() => undefined);
  }
}

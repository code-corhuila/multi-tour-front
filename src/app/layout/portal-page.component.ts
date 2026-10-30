import { ChangeDetectionStrategy, Component, computed, inject, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { safeReturnUrl } from '../core/auth/return-url';
import { CONTAINER_CLIENT } from '../core/client/container-client.token';
import { MountProps, PortalTarget, Scope, Session } from '../core/client/types';
import { RemoteUnavailableComponent } from '../core/errors/remote-unavailable.component';
import { RemoteHostComponent } from '../core/federation/remote-host.component';
import { entryRoles, entryUrl, ManifestEntry, MANIFEST_LOADER } from '../core/federation/remote-loader';
import { TenantLookup } from '../tenant/tenant.resolver';
import { TenantVisualIdentity } from '../tenant/tenant-visual-identity';
import { initialParamsOf, navigationParams } from './initial-params';
import { NotFoundComponent } from './not-found.component';
import { IDENTITY_CHROME_CSS, IDENTITY_PORTAL_KEY, needsIdentityChromeAdapter } from './identity-chrome-adapter';
import { chromeFor, isOperator, NavItem, operatorNav, roleLabel } from './operator-nav';
import { OperatorSidebarComponent } from './operator-sidebar.component';

export const IDENTITY_PORTAL = 'identity-audit-portal';

/** The portal and the area that draw the public offer (route `/t/:identifier/catalogo`); the three client pages of the offer are public. */
export const COMMERCIAL_PORTAL = 'commercial-reservation-portal';
export const PUBLIC_OFFER_AREA = 'tours';
const PUBLIC_AREAS: readonly string[] = [PUBLIC_OFFER_AREA, 'lodging', 'gastronomy'];

type View =
  | { kind: 'loading' }
  | { kind: 'not-found' }
  | { kind: 'unavailable'; remote: string }
  | { kind: 'mount'; key: string; remote: string; url: string; props: MountProps; sidebar?: Sidebar };

/** What the operator sidebar needs; present only when the container draws it around this portal. */
interface Sidebar {
  identifier: string;
  items: NavItem[];
  roleLabel: string;
  active: { portal: string; area?: string };
}

/**
 * Mounts one remote of the manifest: the one fixed in the route data (the identity portal) or the one named
 * by `:remote`. A remote that is missing or fails leaves only this area unavailable.
 */
@Component({
  selector: 'app-portal-page',
  imports: [RemoteHostComponent, RemoteUnavailableComponent, NotFoundComponent, OperatorSidebarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  // The first style is the TEMPORARY identity adapter, scoped by [data-chrome] (see identity-chrome-adapter.ts).
  styles: [
    IDENTITY_CHROME_CSS,
    `
    .operator-shell { display: grid; grid-template-columns: 226px minmax(0, 1fr); min-height: 100vh; background: var(--page-bg, #f5f7f7); }
    /* Own width: a portal stylesheet is global and may define .operator-content too (operations-cost sets 1240px). */
    .operator-content { min-width: 0; width: 100%; max-width: 1420px; }
    @media (max-width: 860px) { .operator-shell { grid-template-columns: minmax(0, 1fr); } }
  `,
  ],
  template: `
    @let v = view();
    @if (v.kind === 'mount') {
      <!-- a one-item loop keyed by tenant and remote: a new tenant or area mounts again instead of reusing the old one -->
      @for (m of [v]; track m.key) {
        @if (m.sidebar; as bar) {
          <div class="operator-shell">
            <app-operator-sidebar [items]="bar.items" [identifier]="bar.identifier" [roleLabel]="bar.roleLabel" [active]="activeOf(m.key, bar.active)" (opened)="reopen(m.key, $event)" (closed)="signOut(bar.identifier)" />
            <div class="operator-content" [attr.data-chrome]="adapts(m.remote) ? 'container' : null"><app-remote-host [name]="m.remote" [url]="m.url" [props]="m.props" /></div>
          </div>
        } @else {
          <app-remote-host [name]="m.remote" [url]="m.url" [props]="m.props" />
        }
      }
    } @else if (v.kind === 'unavailable') {
      <app-remote-unavailable [portal]="v.remote" (retried)="load()" />
    } @else if (v.kind === 'not-found') {
      <app-not-found />
    } @else {
      <p>Loading…</p>
    }
  `,
})
export class PortalPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly client = inject(CONTAINER_CLIENT);
  private readonly loadManifest = inject(MANIFEST_LOADER);
  /** Provided by the tenant shell only: the platform and the general login have no tenant colors. */
  private readonly identity = inject(TenantVisualIdentity, { optional: true });
  private readonly params = toSignal(this.route.paramMap, { requireSync: true });
  private readonly query = toSignal(this.route.queryParamMap, { requireSync: true });
  private readonly manifest = signal<Record<string, ManifestEntry> | 'loading' | 'failed'>('loading');

  protected readonly view = computed<View>(() => {
    const manifest = this.manifest();
    const fixed = this.route.snapshot.data['remote'] as string | undefined;
    const remote = fixed ?? this.params().get('remote') ?? '';
    const identifier = this.params().get('identifier') ?? undefined;
    if (manifest === 'loading') return { kind: 'loading' };
    if (manifest === 'failed') return { kind: 'unavailable', remote };
    const url = Object.hasOwn(manifest, remote) ? entryUrl(manifest[remote]) : undefined;
    // An area asked through `navigate` that the manifest does not list is "not available", not a mistyped address.
    const asked = this.query().get('area') ?? undefined;
    const anonymous = this.route.snapshot.data['anonymous'] === true;
    // A public route opens its own area; the query may only choose another public one.
    const area = anonymous ? (asked !== undefined && PUBLIC_AREAS.includes(asked) ? asked : (this.route.snapshot.data['area'] as string)) : asked;
    if (!url) return fixed || asked !== undefined ? { kind: 'unavailable', remote } : { kind: 'not-found' };
    const scope = this.route.snapshot.data['scope'] as Scope | undefined;
    const props = this.propsFor(identifier, scope, anonymous);
    // A public route hands only its own area; the other routes hand the plain values of the address (ADR-007).
    const initialParams = anonymous ? (area ? { area } : undefined) : initialParamsOf(this.query());
    const roles = props.session.roles;
    // Only a tenant mount of a portal that declared the flag, for an operator: never the sign-in, the platform or a customer.
    const draws = !fixed && scope === undefined && identifier !== undefined && chromeFor(manifest[remote], roles);
    if (!draws) return { kind: 'mount', key: `${scope ?? ''}|${identifier ?? ''}|${remote}`, remote, url, props: { ...props, ...(initialParams && { initialParams }) } };
    const key = `${identifier}|${remote}|${area ?? ''}|${JSON.stringify(initialParams ?? {})}|${this.reloads()}`;
    return {
      kind: 'mount',
      key,
      remote,
      url,
      props: { ...props, chrome: 'container', onAreaChange: (reported: string) => this.reported.set({ key, area: reported }), ...(initialParams && { initialParams }) },
      sidebar: { identifier: identifier as string, items: operatorNav(manifest, roles), roleLabel: roleLabel(roles), active: { portal: remote, ...(area && { area }) } },
    };
  });

  /** The entry the mounted portal says it shows (MountProps.onAreaChange); it belongs to one mount, so a new mount forgets it. */
  private readonly reported = signal<{ key: string; area: string } | null>(null);

  /** Bumped to mount the portal again at the area the address names (see `reopen`). */
  private readonly reloads = signal(0);

  /**
   * An entry of the sidebar was clicked. When the address already names that entry but the portal is no longer at its root (another area
   * or a sub-screen, `onAreaChange`), the router would ignore the link (same address) and the person could not come back: mount the portal again.
   */
  protected reopen(mountKey: string, item: { area?: string }): void {
    // A sub-screen reports its parent area, so "the portal moved elsewhere" cannot be told from "it sits on a sub-screen of this area": both mount again.
    if (this.reported()?.key === mountKey && item.area !== undefined && item.area === this.query().get('area')) {
      this.reloads.update((n) => n + 1);
    }
  }

  /** The entry the sidebar marks: what the mounted portal reported, otherwise what the address names. */
  protected activeOf(key: string, named: { portal: string; area?: string }): { portal: string; area?: string } {
    const reported = this.reported();
    return reported?.key === key ? { portal: named.portal, area: reported.area } : named;
  }

  /** Temporary: identity still draws its own bar, which the stylesheet hides inside this slot. */
  protected adapts(remote: string): boolean {
    return needsIdentityChromeAdapter(remote);
  }

  constructor() {
    this.load();
  }

  /** Closes the tenant session and goes back to its sign-in. */
  protected signOut(identifier: string): void {
    this.client.store.of(identifier).close();
    this.router.navigate(['/t', identifier, 'ingresar']).catch(() => undefined);
  }

  protected load(): void {
    this.manifest.set('loading');
    this.loadManifest().then(
      (manifest) => this.manifest.set(manifest),
      () => this.manifest.set('failed'),
    );
  }

  /** The resolved profile's commercial name (route data of the tenant shell's resolver), only when non-blank. */
  private commercialName(): string | undefined {
    const tenant = this.route.snapshot.data['tenant'] as TenantLookup | undefined;
    const name = tenant && 'profile' in tenant ? tenant.profile.commercialName : undefined;
    return typeof name === 'string' && name.trim() !== '' ? name.trim() : undefined;
  }

  /**
   * Opens an area of a portal by its manifest key; the address is built here and nowhere else. A target the
   * session's roles cannot use is not opened; an unknown one goes to the unavailable notice of that area.
   */
  private openTarget(target: unknown, identifier: string | undefined, scope: Scope | undefined, session: Session): void {
    const { portal, area, params } = (typeof target === 'object' && target !== null ? target : {}) as Partial<PortalTarget>;
    if (typeof portal !== 'string' || portal === '' || typeof area !== 'string' || area === '' || scope === 'general') return;
    const manifest = this.manifest();
    if (typeof manifest !== 'string' && Object.hasOwn(manifest, portal)) {
      const roles = entryRoles(manifest[portal]);
      if (roles && !roles.some((role) => session.roles.includes(role))) return;
    }
    const commands = identifier === undefined ? ['/platform', 'areas', portal] : ['/t', identifier, 'areas', portal];
    this.router.navigate(commands, { queryParams: { ...navigationParams(params), area } }).catch(() => undefined);
  }

  /**
   * After the portal opens a full session, the person goes back to the url the guard kept; without one, an operator of a tenant
   * goes to the identity area, because the sign-in route draws no sidebar and that area gets the container's one.
   */
  private propsFor(identifier: string | undefined, scope: Scope | undefined, anonymous = false): MountProps {
    const props = anonymous && identifier !== undefined ? this.client.anonymousPropsFor(identifier) : this.client.propsFor(identifier, scope);
    const real = props.session;
    // Only the sign-in route carries a fixed remote (route data); a portal mounted in an area is never sent to another one.
    const onSignIn = this.route.snapshot.data['remote'] !== undefined;
    const session: Session = {
      get roles() {
        return real.roles;
      },
      get access() {
        return real.access;
      },
      get displayName() {
        return real.displayName;
      },
      open: (answer, id) => {
        real.open(answer, id);
        const back = safeReturnUrl(this.route.snapshot.queryParamMap.get('returnUrl'));
        if (real.access) return;
        if (back) void this.router.navigateByUrl(back);
        else if (onSignIn && identifier !== undefined && scope === undefined && isOperator(real.roles)) void this.router.navigateByUrl(`/t/${identifier}/areas/${IDENTITY_PORTAL_KEY}`);
      },
      close: () => real.close(),
    };
    // Only a path of this application: the portal moves around without a page load (the session is in memory).
    const navigate = (target: string | PortalTarget) => {
      if (typeof target === 'string') {
        if (safeReturnUrl(target)) void this.router.navigateByUrl(target);
      } else this.openTarget(target, identifier, scope, real);
    };
    const colors = this.identity && scope === undefined && identifier !== undefined ? this.identity : null;
    const name = scope === undefined && identifier !== undefined ? this.commercialName() : undefined;
    return {
      ...props,
      session,
      navigate,
      ...(name && { commercialName: name }),
      ...(colors && {
        visualIdentity: untracked(() => colors.current()),
        onVisualIdentityChange: (value) => colors.change(value),
      }),
    };
  }
}
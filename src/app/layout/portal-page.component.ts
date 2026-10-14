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
import { NotFoundComponent } from './not-found.component';

export const IDENTITY_PORTAL = 'identity-audit-portal';

type View =
  | { kind: 'loading' }
  | { kind: 'not-found' }
  | { kind: 'unavailable'; remote: string }
  | { kind: 'mount'; key: string; remote: string; url: string; props: MountProps };

/**
 * Mounts one remote of the manifest: the one fixed in the route data (the identity portal) or the one named
 * by `:remote`. A remote that is missing or fails leaves only this area unavailable.
 */
@Component({
  selector: 'app-portal-page',
  imports: [RemoteHostComponent, RemoteUnavailableComponent, NotFoundComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let v = view();
    @if (v.kind === 'mount') {
      <!-- a one-item loop keyed by tenant and remote: a new tenant or area mounts again instead of reusing the old one -->
      @for (m of [v]; track m.key) {
        <app-remote-host [name]="m.remote" [url]="m.url" [props]="m.props" />
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
    const asked = this.route.snapshot.queryParamMap.has('area');
    if (!url) return fixed || asked ? { kind: 'unavailable', remote } : { kind: 'not-found' };
    const scope = this.route.snapshot.data['scope'] as Scope | undefined;
    return { kind: 'mount', key: `${scope ?? ''}|${identifier ?? ''}|${remote}`, remote, url, props: this.propsFor(identifier, scope) };
  });

  constructor() {
    this.load();
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
    const { portal, area } = (typeof target === 'object' && target !== null ? target : {}) as Partial<PortalTarget>;
    if (typeof portal !== 'string' || portal === '' || typeof area !== 'string' || area === '' || scope === 'general') return;
    const manifest = this.manifest();
    if (typeof manifest !== 'string' && Object.hasOwn(manifest, portal)) {
      const roles = entryRoles(manifest[portal]);
      if (roles && !roles.some((role) => session.roles.includes(role))) return;
    }
    const commands = identifier === undefined ? ['/platform', 'areas', portal] : ['/t', identifier, 'areas', portal];
    this.router.navigate(commands, { queryParams: { area } }).catch(() => undefined);
  }

  /** After the portal opens a full session, the person goes back to the url the guard kept. */
  private propsFor(identifier: string | undefined, scope: Scope | undefined): MountProps {
    const props = this.client.propsFor(identifier, scope);
    const real = props.session;
    const session: Session = {
      get roles() {
        return real.roles;
      },
      get access() {
        return real.access;
      },
      open: (answer, id) => {
        real.open(answer, id);
        const back = safeReturnUrl(this.route.snapshot.queryParamMap.get('returnUrl'));
        if (back && !real.access) void this.router.navigateByUrl(back);
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
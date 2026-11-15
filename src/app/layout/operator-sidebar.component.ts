import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NavItem } from './operator-nav';
import { OPERATOR_NAV_COPY } from './operator-nav-copy';

/** The single sidebar of the operator; the container draws it around a portal that leaves it out (MountProps.chrome). */
@Component({
  selector: 'app-operator-sidebar',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    /* Fixed to the window: the sign-out stays at the bottom of the window, not at the bottom of a page that grows while its content loads. */
    :host { display: block; position: sticky; top: 0; align-self: start; height: 100vh; }
    aside { display: flex; flex-direction: column; box-sizing: border-box; height: 100%; overflow-y: auto; padding: 22px 14px 18px; background: var(--surface, #fff); border-right: 1px solid var(--line, #d7e0de); color: var(--text, #1c292b); font-family: 'Manrope', sans-serif; }
    .brand { font-size: 0.9rem; font-weight: 800; letter-spacing: 0.12em; }
    .brand span { color: var(--cta, #2f6b57); }
    .role { margin: 10px 0 26px; color: var(--text-soft, #5d6d6a); font-size: 0.7rem; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; }
    ul { display: grid; gap: 2px; margin: 0; padding: 0; list-style: none; }
    a, .soon, button { display: block; box-sizing: border-box; width: 100%; padding: 9px 11px; border: 0; border-left: 3px solid transparent; border-radius: 7px; background: none; color: var(--text-soft, #5d6d6a); font: inherit; font-size: 0.85rem; font-weight: 700; text-align: left; text-decoration: none; }
    a:hover, button:hover { color: var(--text, #1c292b); background: var(--surface-muted, #eef2f1); }
    a:focus-visible, button:focus-visible { outline: 2px solid var(--accent, #2f6b57); outline-offset: 2px; }
    a[aria-current='page'] { color: var(--accent-strong, #1f4d3d); background: var(--accent-soft, rgba(47, 107, 87, 0.1)); border-left-color: var(--accent, #2f6b57); font-weight: 800; }
    .soon { opacity: 0.45; cursor: not-allowed; }
    small { margin-left: 6px; font-size: 0.7rem; font-weight: 600; }
    button { margin-top: auto; cursor: pointer; }
    @media (max-width: 860px) {
      :host { position: static; height: auto; }
      aside { height: auto; overflow-y: visible; padding: 16px; border-right: 0; border-bottom: 1px solid var(--line, #d7e0de); }
      .role { margin: 6px 0 12px; }
      ul { grid-template-columns: repeat(4, minmax(0, 1fr)); }
      a, .soon { padding: 8px 6px; text-align: center; font-size: 0.74rem; border-left: 0; border-top: 3px solid transparent; }
      a[aria-current='page'] { border-top-color: var(--accent, #2f6b57); }
      button { margin-top: 12px; }
    }
  `,
  template: `
    <aside>
      <div class="brand">{{ copy.brand[0] }}<span>{{ copy.brand[1] }}</span></div>
      <div class="role">{{ roleLabel() }}</div>
      <nav [attr.aria-label]="copy.navLabel">
        <ul>
          @for (item of items(); track $index) {
            <li>
              @if (item.link) {
                <a
                  [routerLink]="['/t', identifier(), 'areas', item.portal]"
                  [queryParams]="item.area ? { area: item.area } : null"
                  [attr.aria-current]="$index === activeIndex() ? 'page' : null"
                  (click)="opened.emit(item)"
                  >{{ item.label }}</a
                >
              } @else {
                <span class="soon" aria-disabled="true">{{ item.label }}<small>{{ copy.soon }}</small></span>
              }
            </li>
          }
        </ul>
      </nav>
      <button type="button" (click)="closed.emit()">{{ copy.signOut }}</button>
    </aside>
  `,
})
export class OperatorSidebarComponent {
  protected readonly copy = OPERATOR_NAV_COPY;
  readonly items = input.required<readonly NavItem[]>();
  readonly identifier = input.required<string>();
  readonly roleLabel = input.required<string>();
  /** The portal and area open now; the first entry that matches is the current one. */
  readonly active = input.required<{ portal: string; area?: string }>();
  readonly closed = output<void>();
  /** An entry was clicked: the page may need to mount its portal again when the address already names that entry. */
  readonly opened = output<NavItem>();

  protected readonly activeIndex = computed(() => {
    const { portal, area } = this.active();
    return this.items().findIndex((i) => i.link && i.portal === portal && (i.area === undefined || i.area === area));
  });
}

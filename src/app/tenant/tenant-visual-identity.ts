import { computed, Injectable, signal } from '@angular/core';
import { toAccentVariables, VisualIdentity } from './visual-identity';

/**
 * The colors of the tenant's area, shared by the tenant shell (which paints them) and the portal page (which
 * hands them to the portal and applies the change it announces). Only valid `#RRGGBB` pairs are ever kept.
 */
@Injectable()
export class TenantVisualIdentity {
  private readonly colors = signal<VisualIdentity | null>(null);

  readonly current = this.colors.asReadonly();
  readonly variables = computed(() => toAccentVariables(this.colors()));

  /** The profile value the resolver loaded; anything invalid leaves the platform defaults. */
  start(value: unknown): void {
    this.colors.set(this.valid(value));
  }

  /** What the portal announces after a save; a malformed value is ignored and the previous colors stay. */
  change(value: unknown): void {
    const next = this.valid(value);
    if (next) this.colors.set(next);
  }

  private valid(value: unknown): VisualIdentity | null {
    const { primaryColor, secondaryColor } = (value ?? {}) as Partial<VisualIdentity>;
    if (Object.keys(toAccentVariables({ primaryColor, secondaryColor } as VisualIdentity)).length === 0) return null;
    return { primaryColor: primaryColor as string, secondaryColor: secondaryColor as string };
  }
}
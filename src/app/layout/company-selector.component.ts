import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

/** Kebab-case, 3 to 40: the shape of a tenant link identifier. */
export function isTenantIdentifier(value: string): boolean {
  return value.length >= 3 && value.length <= 40 && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(value);
}

const INVALID = 'Usa de 3 a 40 letras minúsculas, números o guiones, sin guiones al inicio ni al final.';

/** `/ingresar`: the way in with the company link identifier, and the platform administration. */
@Component({
  selector: 'app-company-selector',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './company-selector.component.css',
  templateUrl: './company-selector.component.html',
})
export class CompanySelectorComponent {
  private readonly router = inject(Router);
  protected readonly value = signal('');
  protected readonly error = signal('');

  protected type(event: Event): void {
    this.value.set((event.target as HTMLInputElement).value);
    this.error.set('');
  }

  protected enter(event: Event): void {
    event.preventDefault();
    const identifier = this.value().trim().toLowerCase();
    if (!isTenantIdentifier(identifier)) {
      this.error.set(INVALID);
      return;
    }
    void this.router.navigateByUrl(`/t/${identifier}`);
  }
}
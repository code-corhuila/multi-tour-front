import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

/** Kebab-case, 3 to 40: the shape of a tenant link identifier. */
export function isTenantIdentifier(value: string): boolean {
  return value.length >= 3 && value.length <= 40 && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(value);
}

const INVALID = 'Usa de 3 a 40 letras minúsculas, números o guiones, sin guiones al inicio ni al final.';

/** The start page: the way in with the company link identifier, and the platform administration. */
@Component({
  selector: 'app-home',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host { display: block; }
    .welcome { display: grid; gap: 14px; justify-items: center; max-width: 340px; margin: 12vh auto 0; padding: 0 16px;
      color: #1c2326; font-family: 'Manrope', sans-serif; text-align: center; }
    .lead { margin: 0; color: #667579; font-size: 0.95rem; }
    form { display: grid; gap: 8px; width: 100%; text-align: left; }
    label { color: #243238; font-size: 0.82rem; font-weight: 700; }
    input { min-height: 40px; padding: 0 10px; border: 1px solid #dce5df; border-radius: 10px; background: #fffefb;
      color: inherit; font: inherit; }
    input[aria-invalid='true'] { border-color: #b34a4a; }
    .error { margin: 0; color: #b34a4a; font-size: 0.8rem; }
    button { min-height: 40px; border: 0; border-radius: 10px; background: #146b5d; color: #fff; font: inherit;
      font-weight: 800; cursor: pointer; }
    button:disabled { background: #eef3f0; color: #93a29d; cursor: not-allowed; }
    a { color: #667579; font-size: 0.82rem; }
  `,
  template: `
    <section class="welcome">
      <p class="lead">Ingresa con el enlace de tu empresa.</p>
      <form novalidate (submit)="enter($event)">
        <label for="company">Identificador de tu empresa</label>
        <input
          id="company"
          name="company"
          autocomplete="off"
          [value]="value()"
          [attr.aria-invalid]="error() ? 'true' : null"
          [attr.aria-describedby]="error() ? 'company-error' : null"
          (input)="type($event)"
        />
        @if (error()) {
          <p id="company-error" class="error" role="alert">{{ error() }}</p>
        }
        <button type="submit" [disabled]="value().trim() === ''">Entrar</button>
      </form>
      <a routerLink="/platform">Administración de la plataforma</a>
    </section>
  `,
})
export class HomeComponent {
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
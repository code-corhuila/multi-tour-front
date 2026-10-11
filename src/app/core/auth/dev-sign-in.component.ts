import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CONTAINER_CLIENT } from '../client/container-client.token';
import { safeReturnUrl } from './return-url';

/** Opens a session from a token pasted from `dev-token.sh`. Never part of the production build. */
@Component({
  selector: 'app-dev-sign-in',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form (submit)="submit($event)">
      <h2>Development sign-in</h2>
      <label>
        Token from dev-token.sh
        <textarea #token aria-label="Token from dev-token.sh" (input)="tokenText.set(token.value)"></textarea>
      </label>
      <label>
        Tenant identifier (empty for the platform)
        <input #id aria-label="Tenant identifier (empty for the platform)" (input)="identifier.set(id.value)" />
      </label>
      <button type="submit">Sign in</button>
    </form>
  `,
})
export class DevSignInComponent {
  private readonly client = inject(CONTAINER_CLIENT);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  protected readonly tokenText = signal('');
  protected readonly identifier = signal('');

  protected submit(event: Event): void {
    event.preventDefault();
    const accessToken = this.tokenText().trim();
    if (!accessToken) return;
    // The token's own `exp` is what the services check; this only bounds how long the container keeps it.
    this.client.store.of(this.identifier().trim() || undefined).open({ accessToken, expiresIn: 3600 });
    void this.router.navigateByUrl(safeReturnUrl(this.route.snapshot.queryParamMap.get('returnUrl')) ?? '/');
  }
}
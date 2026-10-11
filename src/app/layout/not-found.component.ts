import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

/** The common "not found" page: unknown routes and unknown tenant links. */
@Component({
  selector: 'app-not-found',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section>
      <h2>Page not found</h2>
      <p>{{ message() }}</p>
      <a routerLink="/">Go to the start</a>
    </section>
  `,
})
export class NotFoundComponent {
  readonly message = input('The page you asked for does not exist.');
}
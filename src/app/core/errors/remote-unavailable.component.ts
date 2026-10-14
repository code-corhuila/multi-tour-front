import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/** Shown in place of a remote that could not be loaded; the rest of the shell keeps working. */
@Component({
  selector: 'app-remote-unavailable',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section role="alert">
      <h2>{{ portal() }} is not available right now</h2>
      <p>The rest of the application still works.</p>
      <button type="button" (click)="retried.emit()">Try again</button>
    </section>
  `,
})
export class RemoteUnavailableComponent {
  readonly portal = input.required<string>();
  readonly retried = output<void>();
}

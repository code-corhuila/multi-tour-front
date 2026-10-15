import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { unavailableCopy } from './unavailable-copy';

/** Shown in place of a remote that could not be loaded; the rest of the shell keeps working. */
@Component({
  selector: 'app-remote-unavailable',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section role="alert">
      <h2>{{ copy().title }}</h2>
      <p>{{ copy().body }}</p>
      <button type="button" (click)="retried.emit()">{{ copy().retry }}</button>
    </section>
  `,
})
export class RemoteUnavailableComponent {
  readonly portal = input.required<string>();
  readonly retried = output<void>();
  protected readonly copy = computed(() => unavailableCopy(this.portal()));
}

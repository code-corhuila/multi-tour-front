import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  Injector,
  input,
  OnDestroy,
  signal,
  viewChild,
} from '@angular/core';
import { RemoteUnavailableComponent } from '../errors/remote-unavailable.component';
import { mountRemote, REMOTE_IMPORTER, RemoteProps } from './remote-loader';

@Component({
  selector: 'app-remote-host',
  imports: [RemoteUnavailableComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (failed()) {
      <app-remote-unavailable [portal]="name()" (retried)="retry()" />
    } @else {
      <div #slot data-remote></div>
    }
  `,
})
export class RemoteHostComponent implements OnDestroy {
  readonly name = input.required<string>();
  readonly url = input.required<string>();
  readonly props = input<RemoteProps>({});

  protected readonly failed = signal(false);
  private readonly importer = inject(REMOTE_IMPORTER);
  private readonly injector = inject(Injector);
  private readonly slot = viewChild<ElementRef<HTMLElement>>('slot');
  private cleanup?: () => void;
  private destroyed = false;

  constructor() {
    afterNextRender(() => this.load());
  }

  /** Mounts only this remote again, once the slot is back in the DOM. */
  protected retry(): void {
    this.failed.set(false);
    afterNextRender(() => this.load(), { injector: this.injector });
  }

  private load(): void {
    const element = this.slot()?.nativeElement;
    if (!element) return;
    mountRemote(this.importer, this.url(), element, this.props()).then(
      (cleanup) => (this.destroyed ? cleanup() : (this.cleanup = cleanup)),
      (err) => {
        console.error(`remote "${this.name()}" failed to load`, err);
        this.failed.set(true);
      },
    );
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.cleanup?.();
  }
}

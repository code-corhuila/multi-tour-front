import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { RemoteHostComponent } from './core/federation/remote-host.component';
import { loadManifest } from './core/federation/remote-loader';

@Component({
  selector: 'app-root',
  imports: [RemoteHostComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1>{{ title }}</h1>
    @for (remote of remotes(); track remote[0]) {
      <app-remote-host [name]="remote[0]" [url]="remote[1]" />
    }
  `,
})
export class App {
  protected readonly title = 'Multitour';
  protected readonly remotes = signal<[string, string][]>([]);

  constructor() {
    // Routing and the per-portal areas arrive in T-05; this only proves the remotes mount.
    loadManifest()
      .then((manifest) => this.remotes.set(Object.entries(manifest)))
      .catch((err) => console.error('federation manifest not loaded', err));
  }
}

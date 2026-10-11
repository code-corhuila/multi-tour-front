import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header><h1>{{ title }}</h1></header>
    <main><router-outlet /></main>
  `,
})
export class App {
  protected readonly title = 'Multitour';
}
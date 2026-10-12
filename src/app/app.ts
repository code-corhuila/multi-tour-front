import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  // The wordmark: quiet, with the Mockup text color.
  styles: `h1 { margin: 0; padding: 20px 24px 0; color: #1c2326; font: 800 1.15rem 'Manrope', sans-serif; letter-spacing: -0.04em; }`,
  template: `
    <header><h1>{{ title }}</h1></header>
    <main><router-outlet /></main>
  `,
})
export class App {
  protected readonly title = 'Multitour';
}
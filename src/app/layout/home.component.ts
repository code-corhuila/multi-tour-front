import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-home',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p>Open the link your company gave you, <code>/t/&lt;company&gt;</code>, or go to the
      <a routerLink="/platform">platform</a>.</p>
  `,
})
export class HomeComponent {}
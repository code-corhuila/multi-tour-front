import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';

describe('App', () => {
  it('only hosts the routes: the portals and screens draw their own brand', async () => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('header')).toBeNull();
    expect(el.querySelector('h1')).toBeNull();
    expect(el.querySelector('router-outlet')).not.toBeNull();
  });
});
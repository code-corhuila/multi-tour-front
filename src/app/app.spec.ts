import { TestBed } from '@angular/core/testing';
import { App } from './app';

describe('App', () => {
  it('renders the product name', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('h1')?.textContent).toBe('Multitour');
  });
});
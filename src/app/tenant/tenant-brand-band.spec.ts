import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, NavigationStart, provideRouter, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { TenantShellComponent } from './tenant-shell.component';
import { TenantLookup } from './tenant.resolver';

const routerEvents = new Subject<NavigationStart>();
const files = '/api/v1/identity-audit/public/tenants/acme';

function render(tenant: TenantLookup) {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: Router, useValue: { url: '/t/acme', events: routerEvents } },
      { provide: ActivatedRoute, useValue: { snapshot: { data: { tenant } } } },
    ],
  });
  const fixture = TestBed.createComponent(TenantShellComponent);
  fixture.detectChanges();
  return { fixture, el: fixture.nativeElement as HTMLElement };
}

const profile = (status: 'ACTIVE' | 'INACTIVE', extra: object = {}) => ({ identifier: 'acme', commercialName: 'Acme Tours', tenantStatus: status, ...extra });
const withFiles = {
  logoUrl: `${files}/logo?v=abcd1234`,
  images: [
    { position: 3, url: `${files}/images/3?v=00000003` },
    { position: 0, url: `${files}/images/0?v=00000000` },
  ],
};
const band = (el: HTMLElement) => el.querySelector('.tenant-brand');

describe('the band with the logo and the images of the company (front spec 005, RN-FRT-50, -51, -53, -56)', () => {
  it('U·the_logo_and_the_images_are_shown: the logo with the commercial name, then the images in the order of their position', () => {
    const { el } = render({ state: 'active', profile: profile('ACTIVE', withFiles) });
    const logo = el.querySelector<HTMLImageElement>('.tenant-brand img.tenant-brand-logo');
    expect(logo?.getAttribute('src')).toBe(`${files}/logo?v=abcd1234`);
    // the logo is the name: the text is not repeated next to it
    expect(el.querySelector('.tenant-brand-name span')).toBeNull();
    const images = Array.from(el.querySelectorAll<HTMLImageElement>('.tenant-brand .tenant-brand-images img'));
    expect(images.map((i) => i.getAttribute('src'))).toEqual([`${files}/images/0?v=00000000`, `${files}/images/3?v=00000003`]);
  });

  it('U·a_profile_without_files_shows_no_band: no band and no empty box, the default look stays', () => {
    for (const extra of [{}, { logoUrl: null, images: [] }]) {
      const { el } = render({ state: 'active', profile: profile('ACTIVE', extra) });
      expect(band(el), JSON.stringify(extra)).toBeNull();
      expect(el.querySelector('img')).toBeNull();
      TestBed.resetTestingModule();
    }
  });

  it('U·the_pictures_have_alternative_text and load without blocking: the commercial name for the logo and "Imagen n" for the others', () => {
    const { el } = render({ state: 'active', profile: profile('ACTIVE', withFiles) });
    expect(el.querySelector('img.tenant-brand-logo')?.getAttribute('alt')).toBe('Acme Tours');
    const images = Array.from(el.querySelectorAll<HTMLImageElement>('.tenant-brand-images img'));
    expect(images.map((i) => i.getAttribute('alt'))).toEqual(['Image 1', 'Image 4']);
    for (const img of [el.querySelector<HTMLImageElement>('img.tenant-brand-logo')!, ...images]) expect(img.getAttribute('loading')).toBe('lazy');
  });

  it('U·a_picture_that_fails_is_hidden: a broken picture is never shown and the band goes when none is left', () => {
    const { fixture, el } = render({ state: 'active', profile: profile('ACTIVE', withFiles) });
    el.querySelector('.tenant-brand-images img')!.dispatchEvent(new Event('error'));
    fixture.detectChanges();
    expect(el.querySelectorAll('.tenant-brand-images img')).toHaveLength(1);
    for (const img of Array.from(el.querySelectorAll('.tenant-brand img'))) img.dispatchEvent(new Event('error'));
    fixture.detectChanges();
    expect(band(el)).toBeNull();
  });

  it('without a logo the band shows the commercial name next to the images, and a logo that fails alone leaves the images and the name', () => {
    const { fixture, el } = render({ state: 'active', profile: profile('ACTIVE', { images: withFiles.images }) });
    expect(el.querySelector('img.tenant-brand-logo')).toBeNull();
    expect(el.querySelector('.tenant-brand-name span')?.textContent).toContain('Acme Tours');
    TestBed.resetTestingModule();
    const both = render({ state: 'active', profile: profile('ACTIVE', withFiles) });
    both.el.querySelector('img.tenant-brand-logo')!.dispatchEvent(new Event('error'));
    both.fixture.detectChanges();
    expect(both.el.querySelector('img.tenant-brand-logo')).toBeNull();
    expect(both.el.querySelectorAll('.tenant-brand-images img')).toHaveLength(2);
    expect(both.el.querySelector('.tenant-brand-name span')?.textContent).toContain('Acme Tours');
    expect(fixture).toBeTruthy();
  });

  it('the states with no profile show no band, and an inactive company with images only shows none', () => {
    for (const tenant of [{ state: 'unknown' } as TenantLookup, { state: 'error', message: 'down' } as TenantLookup]) {
      const { el } = render(tenant);
      expect(band(el)).toBeNull();
      TestBed.resetTestingModule();
    }
    const { el } = render({ state: 'inactive', profile: profile('INACTIVE', { images: withFiles.images }) });
    expect(band(el)).toBeNull();
  });

  it('U·a_path_of_another_place_is_not_shown: nothing from another tenant or another address reaches the page', () => {
    const other = '/api/v1/identity-audit/public/tenants/other';
    const { el } = render({
      state: 'active',
      profile: profile('ACTIVE', { logoUrl: `${other}/logo?v=abcd1234`, images: [{ position: 0, url: 'https://evil.example/x.png' }] }),
    });
    expect(band(el)).toBeNull();
    expect(el.querySelector('img')).toBeNull();
  });

  it('U·an_inactive_tenant_shows_its_logo and no images next to its notice', () => {
    const { el } = render({ state: 'inactive', profile: profile('INACTIVE', withFiles) });
    expect(el.textContent).toContain('Acme Tours is not active');
    expect(el.querySelector('img.tenant-brand-logo')?.getAttribute('src')).toBe(`${files}/logo?v=abcd1234`);
    expect(el.querySelector('.tenant-brand-images')).toBeNull();
  });
});

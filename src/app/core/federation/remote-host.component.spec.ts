import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { MountProps } from '../client/types';
import { RemoteHostComponent } from './remote-host.component';
import { loadManifest, mountRemote, REMOTE_IMPORTER } from './remote-loader';

const PROPS: MountProps = { identifier: 'acme', apiClient: { request: vi.fn() }, session: { roles: [], open: vi.fn(), close: vi.fn() } };

function createHost(importer: ReturnType<typeof vi.fn>) {
  TestBed.configureTestingModule({ providers: [{ provide: REMOTE_IMPORTER, useValue: importer }] });
  const fixture = TestBed.createComponent(RemoteHostComponent);
  fixture.componentRef.setInput('name', 'Stub');
  fixture.componentRef.setInput('url', '/stubs/x.js');
  fixture.componentRef.setInput('props', PROPS);
  fixture.detectChanges();
  return fixture;
}

describe('RemoteHostComponent', () => {
  it('calls mount of the remote module with the element and the props', async () => {
    const mount = vi.fn();
    const fixture = createHost(vi.fn().mockResolvedValue({ mount }));
    await vi.waitFor(() => expect(mount).toHaveBeenCalledTimes(1));
    const [element, props] = mount.mock.calls[0];
    expect(element).toBe(fixture.nativeElement.querySelector('[data-remote]'));
    expect(props).toBe(PROPS);
  });

  it('shows the unavailable area instead of throwing when the import fails', async () => {
    const fixture = createHost(vi.fn().mockRejectedValue(new Error('network down')));
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent).toContain(
        'Stub is not available right now',
      );
    });
  });

  it('shows the unavailable area when the module has no mount', async () => {
    const fixture = createHost(vi.fn().mockResolvedValue({}));
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('[role="alert"]')).not.toBeNull();
    });
  });
});

describe('loadManifest', () => {
  it('reads the remote name to module url map', async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ a: '/a.js' }) });
    expect(await loadManifest('m.json', fetcher)).toEqual({ a: '/a.js' });
    expect(fetcher).toHaveBeenCalledWith('m.json', { cache: 'no-store' });
  });

  it('U·manifest_entry_may_carry_the_roles_that_can_open_it', async () => {
    const entry = { url: '/b.js', roles: ['ADMIN'] };
    const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ a: '/a.js', b: entry }) });
    expect(await loadManifest('m.json', fetcher)).toEqual({ a: '/a.js', b: entry });
  });

  it('U·manifest_entry_with_bad_roles_or_an_unsafe_url_is_dropped', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const json = { x: { url: '/x.js', roles: 'ADMIN' }, y: { url: '/y.js', roles: [1] }, z: { url: 'https://evil.example/z.js' }, w: { roles: [] } };
    const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => json });
    expect(await loadManifest('m.json', fetcher)).toEqual({});
    expect(warn).toHaveBeenCalledTimes(4);
    warn.mockRestore();
  });

  it('rejects when the manifest cannot be fetched', async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: false, status: 404 });
    await expect(loadManifest('m.json', fetcher)).rejects.toThrow();
  });
});

describe('manifest origin check', () => {
  const unsafe = {
    'cross-origin': 'https://evil.example/x.js',
    data: 'data:text/javascript,export const mount=()=>{}',
    blob: 'blob:https://evil.example/1234',
    'protocol-relative': '//evil.example/x.js',
    'non-string': 42,
  };

  it('drops unsafe entries with a warning and keeps the valid relative one', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const fetcher = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({ ...unsafe, good: 'stubs/ok.js' }) });
    expect(Object.keys(await loadManifest('m.json', fetcher))).toEqual(['good']);
    expect(warn).toHaveBeenCalledTimes(Object.keys(unsafe).length);
    warn.mockRestore();
  });

  for (const [kind, url] of Object.entries(unsafe)) {
    it(`mountRemote rejects a ${kind} url without importing it`, async () => {
      const importer = vi.fn();
      await expect(mountRemote(importer, url as string, document.createElement('div'), PROPS)).rejects.toThrow();
      expect(importer).not.toHaveBeenCalled();
    });
  }

  it('imports a relative url resolved against the document base', async () => {
    const importer = vi.fn().mockResolvedValue({ mount: vi.fn() });
    await mountRemote(importer, 'stubs/ok.js', document.createElement('div'), PROPS);
    expect(importer).toHaveBeenCalledWith(new URL('stubs/ok.js', document.baseURI).href);
  });
});

describe('retry of the unavailable area', () => {
  it('mounts only that remote again without reloading the page', async () => {
    const mount = vi.fn();
    const importer = vi.fn().mockRejectedValueOnce(new Error('down')).mockResolvedValue({ mount });
    const fixture = createHost(importer);
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('button')).not.toBeNull();
    });
    fixture.nativeElement.querySelector('button').click();
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(mount).toHaveBeenCalledTimes(1);
    });
  });
});
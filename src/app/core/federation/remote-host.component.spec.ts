import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { RemoteHostComponent } from './remote-host.component';
import { REMOTE_IMPORTER } from './remote-loader';
import { loadManifest } from './remote-loader';

function createHost(importer: ReturnType<typeof vi.fn>) {
  TestBed.configureTestingModule({ providers: [{ provide: REMOTE_IMPORTER, useValue: importer }] });
  const fixture = TestBed.createComponent(RemoteHostComponent);
  fixture.componentRef.setInput('name', 'Stub');
  fixture.componentRef.setInput('url', '/stubs/x.js');
  fixture.componentRef.setInput('props', { answer: 42 });
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
    expect(props).toEqual({ answer: 42 });
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
    expect(fetcher).toHaveBeenCalledWith('m.json');
  });

  it('rejects when the manifest cannot be fetched', async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: false, status: 404 });
    await expect(loadManifest('m.json', fetcher)).rejects.toThrow();
  });
});

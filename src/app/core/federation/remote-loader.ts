import { InjectionToken } from '@angular/core';
import { MountProps } from '../client/types';

/** The contract of ADR-006 F4: a remote module exports `mount` and returns its cleanup. */
export interface RemoteModule {
  mount(element: HTMLElement, props: MountProps): void | (() => void);
}

export type RemoteImporter = (url: string) => Promise<unknown>;

/** Replaceable in tests; the default is a plain dynamic import of the remote's ES module. */
export const REMOTE_IMPORTER = new InjectionToken<RemoteImporter>('REMOTE_IMPORTER', {
  factory: () => (url) => import(/* @vite-ignore */ url),
});

export type ManifestLoader = () => Promise<Record<string, string>>;

/** Replaceable in tests; the default fetches the manifest without cache. */
export const MANIFEST_LOADER = new InjectionToken<ManifestLoader>('MANIFEST_LOADER', {
  factory: () => () => loadManifest(),
});

/** Only same-origin modules may be imported. Returns the absolute url (relative ones resolve against the document). */
export function resolveRemoteUrl(value: unknown): string {
  if (typeof value !== 'string') throw new Error('remote url must be a string');
  const url = new URL(value, document.baseURI);
  if (url.origin !== location.origin) throw new Error(`remote url ${value} is not same-origin`);
  return url.href;
}

/** Manifest: `{ "<remote name>": "<same-origin url of an ES module that exports mount>" }`; unsafe entries are dropped with a warning. */
export async function loadManifest(
  url = 'federation.manifest.json',
  fetcher: (input: string, init?: RequestInit) => Promise<Pick<Response, 'ok' | 'status' | 'json'>> = fetch,
): Promise<Record<string, string>> {
  const response = await fetcher(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`manifest ${url} answered ${response.status}`);
  const raw = (await response.json()) as Record<string, unknown>;
  const manifest: Record<string, string> = {};
  for (const [name, value] of Object.entries(raw)) {
    try {
      resolveRemoteUrl(value);
      manifest[name] = value as string;
    } catch (err) {
      console.warn(`remote "${name}" dropped from the manifest`, err);
    }
  }
  return manifest;
}

/** Imports the remote and mounts it; rejects if the url is unsafe, the import fails or the module has no `mount`. */
export async function mountRemote(
  importer: RemoteImporter,
  url: string,
  element: HTMLElement,
  props: MountProps,
): Promise<() => void> {
  const remote = (await importer(resolveRemoteUrl(url))) as Partial<RemoteModule>;
  if (typeof remote.mount !== 'function') throw new Error(`remote ${url} does not export mount`);
  return remote.mount(element, props) ?? (() => undefined);
}

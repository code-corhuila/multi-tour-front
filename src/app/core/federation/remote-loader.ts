import { InjectionToken } from '@angular/core';

/** What the container hands to a remote. The real client and session arrive in T-04. */
export type RemoteProps = Record<string, unknown>;

/** The contract of ADR-006 F4: a remote module exports `mount` and returns its cleanup. */
export interface RemoteModule {
  mount(element: HTMLElement, props: RemoteProps): void | (() => void);
}

export type RemoteImporter = (url: string) => Promise<unknown>;

/** Replaceable in tests; the default is a plain dynamic import of the remote's ES module. */
export const REMOTE_IMPORTER = new InjectionToken<RemoteImporter>('REMOTE_IMPORTER', {
  factory: () => (url) => import(/* @vite-ignore */ url),
});

/** Manifest: `{ "<remote name>": "<url of an ES module that exports mount>" }`. */
export async function loadManifest(
  url = 'federation.manifest.json',
  fetcher: (input: string) => Promise<Pick<Response, 'ok' | 'status' | 'json'>> = fetch,
): Promise<Record<string, string>> {
  const response = await fetcher(url);
  if (!response.ok) throw new Error(`manifest ${url} answered ${response.status}`);
  return response.json();
}

/** Imports the remote and mounts it; rejects if the import fails or the module has no `mount`. */
export async function mountRemote(
  importer: RemoteImporter,
  url: string,
  element: HTMLElement,
  props: RemoteProps,
): Promise<() => void> {
  const remote = (await importer(url)) as Partial<RemoteModule>;
  if (typeof remote.mount !== 'function') throw new Error(`remote ${url} does not export mount`);
  return remote.mount(element, props) ?? (() => undefined);
}

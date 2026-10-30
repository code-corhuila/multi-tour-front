import { ParamMap } from '@angular/router';

/** Names a portal may receive: plain identifiers. `area` travels on its own and `returnUrl` is the container's. */
const NAME = /^[A-Za-z][A-Za-z0-9_]{0,31}$/;
const RESERVED = new Set(['area', 'returnUrl', '__proto__', 'constructor', 'prototype']);
const MAX_VALUE = 200;
const MAX_ENTRIES = 10;

/** A non-blank text of at most 200 characters with no control character. Data only: nothing here is ever run or followed. */
function plainValue(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '' && value.length <= MAX_VALUE && !/[\x00-\x1F\x7F]/.test(value);
}

function collect(entries: Iterable<[string, unknown]>): Record<string, string> {
  const out: Record<string, string> = {};
  let count = 0;
  for (const [name, value] of entries) {
    if (count === MAX_ENTRIES) break;
    if (!NAME.test(name) || RESERVED.has(name) || !plainValue(value)) continue;
    out[name] = value;
    count++;
  }
  return out;
}

/** What `navigate({ portal, area, params })` may carry into the address: plain string pairs, never `area` or `returnUrl`. */
export function navigationParams(params: unknown): Record<string, string> {
  return typeof params === 'object' && params !== null && !Array.isArray(params) ? collect(Object.entries(params)) : {};
}

/** The `initialParams` of a mount, read from the address: the `area` as it comes, plus the other query values that pass the same checks. */
export function initialParamsOf(query: ParamMap): Record<string, string> | undefined {
  const area = query.get('area');
  const rest = collect(query.keys.map((name): [string, unknown] => [name, query.get(name)]));
  const all = { ...rest, ...(area && { area }) };
  return Object.keys(all).length > 0 ? all : undefined;
}

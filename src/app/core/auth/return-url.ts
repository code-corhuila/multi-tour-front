/** Only a path of this application: a single leading slash, no backslash (so never another site). */
export function safeReturnUrl(value: string | null): string | null {
  return value !== null && /^\/(?!\/)/.test(value) && !value.includes('\\') ? value : null;
}
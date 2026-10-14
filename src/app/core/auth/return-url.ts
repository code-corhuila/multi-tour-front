/** Only a path of this application: a single leading slash, no backslash and no control character (so never another site). */
export function safeReturnUrl(value: string | null): string | null {
  return value !== null && /^\/(?!\/)/.test(value) && !value.includes('\\') && !/[\x00-\x1F\x7F]/.test(value) ? value : null;
}
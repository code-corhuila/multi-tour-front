/** Kebab-case, 3 to 40: the shape of a tenant link identifier. */
export function isTenantIdentifier(value: string): boolean {
  return value.length >= 3 && value.length <= 40 && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(value);
}
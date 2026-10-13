/** The two colors a company chose, as the public profile carries them. */
export interface VisualIdentity {
  primaryColor: string;
  secondaryColor: string;
}

const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;

/**
 * CSS variables for the tenant's area. Both colors must be `#RRGGBB`: anything else yields no variable, so a
 * malformed value never reaches the CSS and the platform defaults stay (RN-FRT-10, -12).
 */
export function toAccentVariables(identity: VisualIdentity | null | undefined): Record<string, string> {
  const { primaryColor, secondaryColor } = identity ?? {};
  if (typeof primaryColor !== 'string' || typeof secondaryColor !== 'string') return {};
  if (!HEX_COLOR.test(primaryColor) || !HEX_COLOR.test(secondaryColor)) return {};
  return {
    '--accent': primaryColor,
    '--accent-strong': secondaryColor,
    '--accent-soft': `color-mix(in srgb, ${primaryColor} 10%, transparent)`,
  };
}
/** A saved commercial image as the public profile carries it: its place (0 to 4) and its path. */
export interface BrandingImage {
  position: number;
  url: string;
}

/** The logo and the commercial images of a company that the container may show. */
export interface Branding {
  logoUrl: string | null;
  images: BrandingImage[];
}

export const NO_BRANDING: Branding = { logoUrl: null, images: [] };

/**
 * The only addresses the container loads as a picture: the public files of the company of the link, with the optional short version
 * of their hash. Any other value (another tenant, another route, an absolute or protocol-relative address, a script) is dropped, as
 * a color that is not `#RRGGBB` is (RN-FRT-12, -52).
 */
export function validBranding(profile: unknown, identifier: string): Branding {
  if (typeof profile !== 'object' || profile === null) return NO_BRANDING;
  const { logoUrl, images } = profile as Record<string, unknown>;
  const files = `/api/v1/identity-audit/public/tenants/${identifier}`;
  const version = '(?:\\?v=[0-9a-f]{1,16})?';
  const logoPath = new RegExp(`^${files}/logo${version}$`);
  const imagePath = new RegExp(`^${files}/images/([0-4])${version}$`);
  const logo = typeof logoUrl === 'string' && logoPath.test(logoUrl) ? logoUrl : null;
  const seen = new Set<number>();
  const kept: BrandingImage[] = [];
  for (const item of Array.isArray(images) ? images : []) {
    if (typeof item !== 'object' || item === null) continue;
    const { position, url } = item as Record<string, unknown>;
    if (typeof position !== 'number' || typeof url !== 'string' || seen.has(position)) continue;
    const match = imagePath.exec(url);
    if (!match || Number(match[1]) !== position) continue;
    seen.add(position);
    kept.push({ position, url });
  }
  return { logoUrl: logo, images: kept.sort((a, b) => a.position - b.position) };
}

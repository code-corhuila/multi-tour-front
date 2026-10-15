# multi-tour-front

## What it is

The Angular 21 container (shell) of the Multitour interface. It will own the HTTP client and the
session, and mount each domain portal. It routes `/` (the welcome), `/ingresar` (the general login, drawn by the identity portal), `/platform`, `/t/<identifier>` (resolves the tenant's public profile first) and `**` (the common 404), guards `areas/<remote>` and mounts each portal from `federation.manifest.json`.

## How to start it

Node 22 LTS or 24. Copy `.env.example` to `.env`, then:

```bash
npm ci
npm start    # http://localhost:4200
```

`npm run start:demo` serves the modules from `portals/` and the manifest from `public/`.
The stubs of `e2e/stubs/` are served by the `development` configuration and, in the browser checks, by request interception.
Copy `portal.js` and `portal.css` from each portal to `portals/<name>.js` and `portals/<name>.css`.

## Where the data is

Nowhere: this repository holds no data. It only calls the API through the gateway.

## How to test it

```bash
npm test     # Vitest through the Angular unit-test builder
npm run build
```

The development sign-in (`/dev-sign-in`, a token pasted from `dev-token.sh`) exists in the `development` and `demo` configurations; the production build swaps it out.

### Browser checks: on the image, never on a development server

The Playwright checks (`e2e/*.e2e.ts`) run against the production image on port 8080; no `ng serve` is started. The stub remotes and the test data reach the browser only through `page.route` (`e2e/support/container.ts`), so the image under test is the one that ships.

1. In each portal repository: `npm ci` and `npm run build:module`; copy `portal.js` and `portal.css` to `portals/<name>.js` and `portals/<name>.css` here.
2. `docker build -t multi-tour-front .`
3. `docker run -d --name front-e2e -p 8080:8080 multi-tour-front`
4. `npm run e2e` (base URL `http://localhost:8080`; `E2E_BASE_URL` moves it; run `npx playwright install chromium` once).
5. `docker rm -f front-e2e`. No server is left running.

A portal whose module is not in `portals/` has its mounted-portal check skipped and its area shows "not available". Each run keeps one screenshot per area in `test-results/areas/` as evidence, not as a pixel baseline.

The CI runs `npm ci`, `npm run build`, `npm test`, builds and checks the image, then runs the browser checks on it, on every pull request to `develop` and `qa`.

## The mount contract of a portal

`mount(element, props)` (ADR-007). Besides `apiClient`, `session` and `identifier?`, the container hands every portal two optional fields:

| Field | Meaning |
|---|---|
| `scope` | `'general'` at `/ingresar` (the general login, no identifier), `'platform'` under `/platform`, `'tenant'` under `/t/<identifier>` |
| `navigate(path)` | SPA navigation owned by the container. The portal must use it for every move between screens and areas and never reload the page: the session lives in memory and a full navigation drops it. Only a path of this app is followed (single leading slash, no backslash) |

`session.open(answer, identifier?)`: in the `general` scope the portal passes the company identifier typed in the login (kebab-case, 3 to 40; otherwise it throws and nothing opens). The session is kept under that identifier, the portal's `apiClient` carries its token, and `navigate('/t/<identifier>')` or `navigate('/t/<identifier>/areas/<remote>')` lands on the tenant with the session intact. In the other scopes the identifier is ignored.

### Visual identity (HU-IDA-003)

Three more optional fields, set only on a tenant mount (never on the platform or the general login):

| Field | Meaning |
|---|---|
| `visualIdentity` | The company's current colors `{ primaryColor, secondaryColor }` (`#RRGGBB`), or `null` when it chose none. The container already paints them as `--accent`, `--accent-strong` and `--accent-soft` on the tenant's area, so the portal reads those variables and paints nothing by itself |
| `commercialName` | The commercial name of the company (non-blank string) so a screen can show it; omitted on the platform and the general login |
| `onVisualIdentityChange(colors)` | The portal calls it with the colors the service returned after a save; the container validates them (a malformed pair is ignored) and updates the variables live, with no reload |

`visualIdentity` is the value at mount time; after a save, read the CSS variables or use the colors the service returned.
A portal that ignores both keeps mounting as before.

## Assets and licenses

Everything is served from this origin (no CDN). Fonts and photos live in `public/assets/`:

- `fonts/fraunces.woff2` and `fonts/manrope.woff2`: latin subset, variable files, declared in `src/styles.css`. Fraunces and Manrope are under the SIL Open Font License 1.1.
- `mountain-hero.jpg`, `destino-sendero-del-condor.jpg`, `destino-cascadas-de-iraka.jpg`, `destino-bahia-esmeralda.jpg`: photos from Unsplash, under the Unsplash License (free use, no attribution required). The Mockup's demo content of the landing uses them.
- `alojamiento-asociado.jpg` (a hotel) and `restaurante-asociado.jpg` (a restaurant): the photos of the associated lodging and food establishments, the same files the landing mockup uses (`landing/img/`). The licence of their source is still to be confirmed before production; they are demo content.

## The production image

`Dockerfile` builds the shell (`npm ci`, `npm run build`) and serves it with `nginxinc/nginx-unprivileged` (non-root, port 8080, versions pinned). `nginx/default.conf` sets the security headers (CSP, `nosniff`, frame and referrer policies), falls back to `index.html` for the router, and never caches `federation.manifest.json` or anything under `/portals/`.

```bash
docker build -t multi-tour-front .
docker run --rm -p 8080:8080 multi-tour-front
```

### How the identity-audit portal reaches production

The manifest in production (`public/federation.manifest.json`) points to `portals/identity-audit-portal.js`, a file served from the same origin as the shell. The portal repository builds its single ES module; copy that file to `portals/identity-audit-portal.js` in this repository **before** `docker build` (the folder `portals/` is empty in Git on purpose, its content is ignored). Without the file the image still starts and that area answers 404, which the shell shows as "not available right now". A new portal build only needs the file replaced and the image rebuilt; browsers never cache the manifest or the module.

### How the cash-reporting portal reaches production

The manifest entry `cash-reporting-portal` is `{ "url": "portals/cash-reporting-portal.js", "roles": [...] }`: `roles` (the five internal roles, never the final customer) only decides who may be sent there by another portal's `navigate`; the area itself and every request stay guarded by the portal and the service. In the cash portal repository run `npm ci` and `npm run build:module` and copy `dist/portal.js` to `portals/cash-reporting-portal.js` and `dist/portal.css` to `portals/cash-reporting-portal.css` (the module loads the stylesheet by that name, next to itself) **before** `docker build`. Without them that area answers 404 and the shell shows "not available right now".

### How the operations-cost portal reaches production

The manifest entry `operations-cost-portal` is `{ "url": "portals/operations-cost-portal.js", "roles": [...] }` (`TENANT_ADMINISTRATOR`, `OPERATIONAL_COLLABORATOR`, `MANAGER`, the roles its own guard accepts). In the operations-cost portal repository its image serves `portal.js` and `operations-cost-portal.css`; the gateway maps `/portals/operations-cost-portal.js` and `.css` to that container, so the file does not need to be copied into this repository when the portals run as separate containers.

### Checks

- `scripts/check-main-build.sh [dir]` (`V·main_build_has_no_dev_sign_in`): the production bundle has no development sign-in and no stub remotes. The CI also proves the check fails on a development build.
- `scripts/check-image.sh <image>`: runs the image and checks headers, the uncached manifest, the 404 of a missing portal, the router fallback and the non-root user.

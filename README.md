# multi-tour-front

## What it is

The Angular 21 container (shell) of the Multitour interface. It will own the HTTP client and the
session, and mount each domain portal. It routes `/` (home), `/platform`, `/t/<identifier>` (resolves the tenant's public profile first) and `**` (the common 404), guards `areas/<remote>` and mounts each portal from `federation.manifest.json`.

## How to start it

Node 22 LTS or 24. Copy `.env.example` to `.env`, then:

```bash
npm ci
npm start    # http://localhost:4200
```

`npm run start:demo` serves the modules from `portals/` and the manifest from `public/`.
The E2E stubs are only used with the `development` configuration.
Copy `portal.js` and `portal.css` from each portal to `portals/<name>.js` and `portals/<name>.css`.

## Where the data is

Nowhere: this repository holds no data. It only calls the API through the gateway.

## How to test it

```bash
npm test     # Vitest through the Angular unit-test builder
npm run build
npm run e2e  # three Playwright checks on the development build (run npx playwright install chromium once)
```

The development sign-in (`/dev-sign-in`, a token pasted from `dev-token.sh`) exists in the `development` and `demo` configurations; the production build swaps it out.

The CI runs `npm ci`, `npm run build`, `npm test` and the E2E checks on every pull request to `develop` and `qa`.

## The production image

`Dockerfile` builds the shell (`npm ci`, `npm run build`) and serves it with `nginxinc/nginx-unprivileged` (non-root, port 8080, versions pinned). `nginx/default.conf` sets the security headers (CSP, `nosniff`, frame and referrer policies), falls back to `index.html` for the router, and never caches `federation.manifest.json` or anything under `/portals/`.

```bash
docker build -t multi-tour-front .
docker run --rm -p 8080:8080 multi-tour-front
```

### How the identity-audit portal reaches production

The manifest in production (`public/federation.manifest.json`) points to `portals/identity-audit-portal.js`, a file served from the same origin as the shell. The portal repository builds its single ES module; copy that file to `portals/identity-audit-portal.js` in this repository **before** `docker build` (the folder `portals/` is empty in Git on purpose, its content is ignored). Without the file the image still starts and that area answers 404, which the shell shows as "not available right now". A new portal build only needs the file replaced and the image rebuilt; browsers never cache the manifest or the module.

### Checks

- `scripts/check-main-build.sh [dir]` (`V·main_build_has_no_dev_sign_in`): the production bundle has no development sign-in and no stub remotes. The CI also proves the check fails on a development build.
- `scripts/check-image.sh <image>`: runs the image and checks headers, the uncached manifest, the 404 of a missing portal, the router fallback and the non-root user.

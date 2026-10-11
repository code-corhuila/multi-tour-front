# multi-tour-front

## What it is

The Angular 21 container (shell) of the Multitour interface. It will own the HTTP client and the
session, and mount each domain portal. It routes / (home), /platform, /t/<identifier> (resolves the tenant's public profile first) and ** (the common 404), guards reas/<remote> and mounts each portal from ederation.manifest.json.

## How to start it

Node 22 LTS or 24. Copy `.env.example` to `.env`, then:

```bash
npm ci
npm start    # http://localhost:4200
```

## Where the data is

Nowhere: this repository holds no data. It only calls the API through the gateway.

## How to test it

```bash
npm test     # Vitest through the Angular unit-test builder
npm run build
```

The CI runs `npm ci`, `npm run build` and `npm test` on every pull request to `develop` and `qa`.

## What is missing

The image, the security headers and the build checks (task T-06).
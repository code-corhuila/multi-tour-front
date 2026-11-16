# Changelog

All notable changes of `multi-tour-front` (Front shell that mounts the four portals) are documented in this file.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [3.1.0] - 2026-11-15

Minor release: tests only, no change of behavior. Every entry is a pull request merged into `qa` and re-applied to `release/3.1.0` with `git cherry-pick -x`. Spec 006 of `multi-tour-front` (`code-corhuila/multi-tour-docs#1126`): one Playwright file per story of the security, identity-audit and operations-cost domains, with the real module of each portal and the API stubbed per test.

### Added

#### HU-SEC-001 - Sign in and receive a token

- End-to-end test of the sign-in of the identity portal ([PR 81](https://github.com/code-corhuila/multi-tour-front/pull/81), promoted in [PR 92](https://github.com/code-corhuila/multi-tour-front/pull/92))

#### HU-SEC-002 - Create a Final Customer account

- End-to-end test of the sign-up of a final customer ([PR 82](https://github.com/code-corhuila/multi-tour-front/pull/82), promoted in [PR 98](https://github.com/code-corhuila/multi-tour-front/pull/98))

#### HU-SEC-003 - Verify the Final Customer's e-mail

- End-to-end test of the e-mail verification of a final customer ([PR 83](https://github.com/code-corhuila/multi-tour-front/pull/83), promoted in [PR 99](https://github.com/code-corhuila/multi-tour-front/pull/99))

#### HU-SEC-004 - Recover the password

- End-to-end test of the password recovery ([PR 84](https://github.com/code-corhuila/multi-tour-front/pull/84), promoted in [PR 100](https://github.com/code-corhuila/multi-tour-front/pull/100))

#### HU-SEC-005 - Manage the tenant's internal users

- End-to-end test of the first access of an internal user ([PR 85](https://github.com/code-corhuila/multi-tour-front/pull/85), promoted in [PR 101](https://github.com/code-corhuila/multi-tour-front/pull/101))

#### HU-SEC-008 - Give the internal role to a Final Customer account

- End-to-end test of the customer and team contexts of one account ([PR 86](https://github.com/code-corhuila/multi-tour-front/pull/86), promoted in [PR 102](https://github.com/code-corhuila/multi-tour-front/pull/102))

#### HU-IDA-001 - Manage the tenant lifecycle

- End-to-end test of the tenant lifecycle of the platform administrator ([PR 88](https://github.com/code-corhuila/multi-tour-front/pull/88), promoted in [PR 94](https://github.com/code-corhuila/multi-tour-front/pull/94))

#### HU-IDA-002 - Record and consult the audit of sensitive actions

- End-to-end test of the platform audit of sensitive actions ([PR 89](https://github.com/code-corhuila/multi-tour-front/pull/89), promoted in [PR 95](https://github.com/code-corhuila/multi-tour-front/pull/95))

#### HU-IDA-003 - Maintain the tenant's visual identity

- End-to-end test of the visual identity of the tenant ([PR 90](https://github.com/code-corhuila/multi-tour-front/pull/90), promoted in [PR 96](https://github.com/code-corhuila/multi-tour-front/pull/96))

#### HU-IDA-004 - Change the time zone and the country of the tenant

- End-to-end test of the time zone and country change of the tenant ([PR 87](https://github.com/code-corhuila/multi-tour-front/pull/87), promoted in [PR 93](https://github.com/code-corhuila/multi-tour-front/pull/93))

#### HU-IDA-005 - Maintain the tenant's logo and commercial images

- End-to-end test of the logo and commercial images of the tenant ([PR 91](https://github.com/code-corhuila/multi-tour-front/pull/91), promoted in [PR 97](https://github.com/code-corhuila/multi-tour-front/pull/97))

#### HU-OPS-001 - Schedule the departures of a tour

- End-to-end test of the scheduling of a departure ([PR 103](https://github.com/code-corhuila/multi-tour-front/pull/103), promoted in [PR 112](https://github.com/code-corhuila/multi-tour-front/pull/112))

#### HU-OPS-002 - Assign and change the vehicles of a departure

- End-to-end test of the vehicles of a departure ([PR 104](https://github.com/code-corhuila/multi-tour-front/pull/104), promoted in [PR 113](https://github.com/code-corhuila/multi-tour-front/pull/113))

#### HU-OPS-003 - Record the start and the end of a departure

- End-to-end test of the start and the end of a departure ([PR 105](https://github.com/code-corhuila/multi-tour-front/pull/105), promoted in [PR 114](https://github.com/code-corhuila/multi-tour-front/pull/114))

#### HU-OPS-004 - Record the delivered and the undelivered services

- End-to-end test of the delivered and undelivered services ([PR 106](https://github.com/code-corhuila/multi-tour-front/pull/106), promoted in [PR 115](https://github.com/code-corhuila/multi-tour-front/pull/115))

#### HU-OPS-005 - Block ordinary adjustments and record an extraordinary cancellation

- End-to-end test of the extraordinary cancellation of a reservation ([PR 107](https://github.com/code-corhuila/multi-tour-front/pull/107), promoted in [PR 116](https://github.com/code-corhuila/multi-tour-front/pull/116))

#### HU-OPS-006 - Cancel a departure and handle its reservations

- End-to-end test of the cancellation of a departure ([PR 108](https://github.com/code-corhuila/multi-tour-front/pull/108), promoted in [PR 117](https://github.com/code-corhuila/multi-tour-front/pull/117))

#### HU-OPS-007 - Record operational costs

- End-to-end test of the operational costs of a departure ([PR 109](https://github.com/code-corhuila/multi-tour-front/pull/109), promoted in [PR 118](https://github.com/code-corhuila/multi-tour-front/pull/118))

#### HU-OPS-008 - Record a personal emergency during a departure

- End-to-end test of the personal emergency of a departure ([PR 110](https://github.com/code-corhuila/multi-tour-front/pull/110), promoted in [PR 111](https://github.com/code-corhuila/multi-tour-front/pull/111))

## [3.0.0] - 2026-11-14

Cut 3 release. Every entry below is a pull request merged into `qa` and re-applied to `release/3.0.0` with `git cherry-pick -x`; the heading of each group is the user story named in the pull request, and the entry is the title of the pull request without its type. The frozen head of `qa` is `eab1c7cad27abed0fd36361ed1eedd729a009205`.

### Changed

#### HU-COM-001 - Manage the operational catalog

- The operator sidebar and the api client (part 1) ([PR 67](https://github.com/code-corhuila/multi-tour-front/pull/67))
- The e2e checks and the restricted routes (part 2) ([PR 68](https://github.com/code-corhuila/multi-tour-front/pull/68))

#### HU-COM-002 - Manage associated establishments

- The HU-COM-002 establishment list spec aligned with the current portal ([PR 75](https://github.com/code-corhuila/multi-tour-front/pull/75))

#### HU-COM-012 - Modify a reservation before execution

- Retry the open of a reservation detail when the list is mounted again ([PR 79](https://github.com/code-corhuila/multi-tour-front/pull/79))

#### HU-COM-020 - Handle the obligations of an inactive tenant

- Wait for the sidebar buttons before reading the items ([PR 77](https://github.com/code-corhuila/multi-tour-front/pull/77))

#### HU-FRT-001 - Mount the four portals in one container

- The operator sidebar (2 of 2) ([PR 34](https://github.com/code-corhuila/multi-tour-front/pull/34))
- The operations-cost chrome flag ([PR 37](https://github.com/code-corhuila/multi-tour-front/pull/37))
- The commercial sidebar hiding ([PR 39](https://github.com/code-corhuila/multi-tour-front/pull/39))

#### HU-IDA-005 - Maintain the tenant's logo and commercial images

- HU-IDA-005 ([PR 73](https://github.com/code-corhuila/multi-tour-front/pull/73))

#### Cross-cutting: CI, test fixes and alignment promotions (no single story is named in the PR title, branch or body)

- Align one comment of the portal page with develop ([PR 69](https://github.com/code-corhuila/multi-tour-front/pull/69))

### Security

#### HU-FRT-001 - Mount the four portals in one container

- Manifest, notice and session permissions (1 of 2) ([PR 33](https://github.com/code-corhuila/multi-tour-front/pull/33))

[Unreleased]: https://github.com/code-corhuila/multi-tour-front/compare/v3.0.0...HEAD
[3.0.0]: https://github.com/code-corhuila/multi-tour-front/releases/tag/v3.0.0

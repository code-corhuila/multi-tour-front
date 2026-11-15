# Changelog

All notable changes of `multi-tour-front` (Front shell that mounts the four portals) are documented in this file.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

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

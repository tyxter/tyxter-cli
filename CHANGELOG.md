# Changelog

Notable changes to the Tyxter CLI (`@tyxter/cli` and the `tyxter-cli`
compatibility command). The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and versions follow
[Semantic Versioning](https://semver.org/). Each GitHub release shows its
section of this file.

## [Unreleased]

## [0.1.4] - 2026-11-17

### Fixed

- `tyxter listen` keeps running when your local endpoint fails a forward. A
  non-2xx answer, a timeout or a refused connection used to end the command
  with exit code 1. Each failed forward is now reported on stderr with the
  event id, its type, the failure and the `tyxter events resend` command that
  replays it, and listening continues. With `--json` the report is a
  `tyxter_cli_listen_forward_failed` JSON line on stderr. `listen --once`
  still exits 1 when a forward failed. (#18)
- `tyxter listen prod` waits for the rate limit when it opens its listen
  session instead of exiting on HTTP 429. It honors `Retry-After` within the
  run's duration and prints the wait on stderr. If the wait cannot fit, it
  exits 1 with a message that names the rate limit and the time to wait.
  Ctrl+C during the wait exits cleanly. (#20)

## [0.1.3] - 2026-11-04

No changes to the CLI. Version bump for npm trusted publishing.

## [0.1.2] - 2026-11-04

### Added

- npm packages. Run the CLI without Docker through `@tyxter/cli`, or through
  the `tyxter-cli` compatibility command, which pins the same version.
- A GitHub release for each version tag.

## [0.1.1] - 2026-10-17

### Added

- MIT license.

### Changed

- Container images are published only for version tags.

## [0.1.0] - 2026-10-17

First stable release, after the `0.1.0-alpha` container previews.

### Added

- `tyxter listen prod`: production listen through short-lived listen sessions
  that are disabled on exit.

### Changed

- Defaults point at `api.tyxter.com`.
- The container image runs on Node 24. (#9)

### Fixed

- `tyxter listen --from-now --json` output stays parseable.
- Local webhook forwards are bounded and can be cancelled. (#7)
- `tyxter logs tail` pages through new webhook logs. (#8)
- `tyxter tour` waits for the simulated webhook and honors rate limits and
  polling delays.
- Malformed webhook signatures are rejected without throwing.
- The tour demo receiver stays up on malformed signatures and non-JSON bodies.

[Unreleased]: https://github.com/tyxter/tyxter-cli/compare/v0.1.4...HEAD
[0.1.4]: https://github.com/tyxter/tyxter-cli/compare/v0.1.3...v0.1.4
[0.1.3]: https://github.com/tyxter/tyxter-cli/compare/v0.1.2...v0.1.3
[0.1.2]: https://github.com/tyxter/tyxter-cli/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/tyxter/tyxter-cli/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/tyxter/tyxter-cli/compare/v0.1.0-alpha.2...v0.1.0

# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.20] - 2026-03-26

### Changed

- Improved release workflow with early changelog validation to prevent build failures

## [1.1.19] - 2026-03-26

### Fixed

- Fixed React ref access errors in UpdateControls component by moving ref data to state

## [1.1.18] - 2026-03-26

### Added

- Added an in-app release notes modal so updater patch notes are readable without leaving the main window

### Changed

- Reworked the updater controls so the install action and release-notes affordance sit together in a compact action row

### Fixed

- Fixed the release notes modal so long changelogs scroll inside the dialog instead of being clipped
- Preserved GitHub-flavored Markdown rendering in release notes, including lists and tables

## [1.1.17] - 2026-03-25

### Fixed

- Fixed the Linux updater artifact mode so release manifests can find the `.AppImage.tar.gz.sig` file

## [1.1.16] - 2026-03-25

### Fixed

- Restored the updater private key password secret so the signed release pipeline can publish again

## [1.1.15] - 2026-03-25

### Fixed

- Rotated the updater keypair again to match the newly generated GitHub secret
- Restored the release pipeline after the updater signing validation exposed a malformed secret
- Updated the embedded updater public key to the current trust root

## [1.1.14] - 2026-03-25

### Fixed

- Added updater signing key validation to the release workflow so missing or mismatched secrets fail fast
- Clarified the updater signing secret requirements in the release docs and checklist
- Bumped the release version after restoring the signing secret flow

## [1.1.13] - 2026-03-25

### Fixed

- Forced the updater signing key prep step to use Bash on every release runner so Windows no longer parses POSIX shell syntax as PowerShell
- Rotated the updater signing keypair and updated the embedded updater public key so future signed releases use the new trust root

## [1.1.12] - 2026-03-25

### Changed

- Redesigned the earliest Powering Up boot splash with a colder steel gradient and stronger mirror-like sweep
- Made destructive session actions more legible in dark theme

### Fixed

- Documented the boundary between the pre-React boot splash and the post-hydration skeleton
- Kept file mention popovers anchored to the caret and outside modal stacking contexts

## [1.1.11] - 2026-03-25

### Fixed

- Fixed Windows release builds so the rustup wrapper preserves the PATH separator on each platform
- Split Tauri build entrypoints by platform and updated CI and release workflows to call the explicit macOS, Windows, and Linux commands

## [1.1.10] - 2026-03-25

### Fixed

- Installed Linux desktop build dependencies in the release workflow before Tauri builds
- Forced the cross-platform Tauri build step to use Bash so Windows runners can execute the release script correctly

## [1.1.9] - 2026-03-25

### Fixed

- Installed Linux desktop build dependencies in CI before Rust tests and Tauri builds
- Added `libglib2.0-dev` so Ubuntu runners can resolve the `glib-2.0` pkg-config metadata required by Tauri

## [1.1.8] - 2026-03-25

### Changed

- Added an explicit `build:mac:release` command for release-style macOS ZIP bundles
- Kept `build:mac` focused on the local DMG experience for easier manual installs
- Split the docs so GitHub Releases and local macOS builds describe their own bundle formats

## [1.1.4] - 2026-03-25

### Changed

- Added a concrete release checklist for the GitHub Actions and Homebrew publish flow
- Updated package metadata and release hygiene for public-source distribution
- Wired the default test command to run both JavaScript and Rust unit tests

### Fixed

- Added real unit coverage for renderer helpers and Rust core modules
- Improved process output collapsing so repeated final snapshots are deduplicated

## [1.0.1] - 2025-03-23

### Changed

- Improved README with clearer value proposition
- Added "Why Two Agents?" section explaining dual-model cross-validation benefits
- Updated tagline to emphasize automated pair programming with coffee break messaging

## [1.0.0] - 2025-03-22

### Added

- Initial public release
- Dual-agent architecture with Mentor and Executor roles
- Real-time CPU/memory monitoring per agent
- Git change tracking for all session modifications
- Full automation mode with workspace-scoped permissions
- Human oversight with approval/rejection workflow
- Cross-platform support (macOS, Windows, Linux)
- Homebrew Cask distribution for macOS
- Code signing and notarization for macOS builds
- Dark/light theme support
- Model picker with automatic provider detection
- Onboarding wizard for first-time users
- File mention support for context injection

### Security

- Session-specific permissions (no global opencode config modification)
- Workspace-scoped file system access
- Secure handling of API keys via opencode configuration

[1.1.18]: https://github.com/timwuhaotian/the-pair/compare/v1.1.17...v1.1.18
[1.1.17]: https://github.com/timwuhaotian/the-pair/compare/v1.1.16...v1.1.17
[1.1.10]: https://github.com/timwuhaotian/the-pair/compare/v1.1.9...v1.1.10
[1.1.15]: https://github.com/timwuhaotian/the-pair/compare/v1.1.14...v1.1.15
[1.1.14]: https://github.com/timwuhaotian/the-pair/compare/v1.1.13...v1.1.14
[1.1.12]: https://github.com/timwuhaotian/the-pair/compare/v1.1.11...v1.1.12
[1.1.11]: https://github.com/timwuhaotian/the-pair/compare/v1.1.10...v1.1.11
[1.1.13]: https://github.com/timwuhaotian/the-pair/compare/v1.1.12...v1.1.13
[1.1.9]: https://github.com/timwuhaotian/the-pair/compare/v1.1.8...v1.1.9
[1.1.8]: https://github.com/timwuhaotian/the-pair/compare/v1.1.7...v1.1.8
[1.1.7]: https://github.com/timwuhaotian/the-pair/compare/v1.1.6...v1.1.7
[1.1.4]: https://github.com/timwuhaotian/the-pair/compare/v1.0.1...v1.1.4
[1.0.1]: https://github.com/timwuhaotian/the-pair/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/timwuhaotian/the-pair/releases/tag/v1.0.0

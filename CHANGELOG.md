# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.3] - 2026-03-28

### Added

- Added role-specific recent model tracking (separate for Mentor and Executor).
- Added verbose flag to Claude provider for enhanced debugging output.
- Added card variant to ModelPicker with role headers and subtitles.
- Added drop-up support for ModelPicker in constrained layouts.

### Changed

- Refactored ModelPicker to use native dropdown instead of modal for improved UX.
- Enhanced onboarding wizard with streamlined model selection cards.
- Updated visual design with refined color variables for light/dark themes.
- Improved model selection UI with better visual hierarchy and role differentiation.
- Migrated legacy recent models storage to role-specific keys.

### Fixed

- Fixed recent models list not being role-specific.
- Fixed ModelPicker layout issues in modal contexts.

## [1.2.2] - 2026-03-28

### Added

- Added resume functionality for paused pairs with intelligent state restoration that distinguishes between planning and review phases.
- Added DashboardEmptyState component with clear onboarding and visual explanation of Mentor/Executor roles.
- Added ErrorDetailPanel with actionable retry/discard options and expandable error details.
- Added IterationProgress indicator with visual warnings when approaching iteration limits.
- Added MessageFilterBar to filter console messages by role (All/Mentor/Executor) with message counts.
- Added ScrollToBottomButton that auto-appears when new console messages arrive.
- Added handoff guard to prevent race conditions when pairs finish.
- Added comprehensive unit tests for resume scenarios and handoff guards.

### Changed

- Improved resource meters to hide progress bars when usage is below 0.5%.
- Enhanced dashboard cards to line-clamp long specs to 3 lines.
- Refactored monitor spawning logic for better reusability.
- Improved accessibility with aria-labels and titles on interactive elements.

### Fixed

- Fixed mentor finish signal not being prioritized over verification turns.
- Fixed handoff events being processed after pair already finished.
- Fixed iteration count being incorrectly incremented on resume.
- Fixed resource meter showing empty bars at 0% usage.

## [1.2.1] - 2026-03-27

### Added

- Added an automated verification gate that runs workspace-specific checks and routes mentor verdicts through a strict JSON review loop.
- Added verification status chips and a dedicated gate panel so the dashboard, recovery modal, and task history can surface review progress at a glance.

### Changed

- Preserved verification state across snapshots, recoverable sessions, and archived run history.
- Refined onboarding with a compact layout, automatic pair-name suggestions from the selected workspace, and role-specific model defaults.
- Expanded the mentor and executor handoff prompts so verification retries keep iterating autonomously without dropping context.

### Fixed

- Tightened provider-specific output handling so Claude final results and stderr logs are treated separately from streaming noise.
- Kept legacy snapshots and recoverable session records readable after the verification state schema change.

## [1.2.0] - 2026-03-27

### Changed

- Expanded provider detection and model cataloging across OpenCode, Codex, Claude Code, and Gemini CLI.
- Reworked onboarding and model selection to validate actual ready models instead of only checking for an OpenCode config file.
- Refreshed provider-facing copy and model guidance throughout the app to match the new multi-provider flow.

### Fixed

- Corrected OpenCode config path resolution on Windows so the app reads and opens the right file.
- Improved fallback CLI discovery and added coverage for provider readiness, model preference resolution, and override handling.

## [1.1.22] - 2026-03-26

### Fixed

- Reduced metal sheen overlay opacity to improve contrast and readability
- Adjusted gradient color stops for a more refined metallic finish

## [1.1.21] - 2026-03-26

### Fixed

- Fixed model and subscription detection on Apple Silicon Macs where CLI tools (`claude`, `opencode`, `codex`) were not found when the app was launched from the Dock or Finder
- Added fallback binary detection that checks known install paths directly when the `which` command fails
- Fixed PATH setup to always include common binary directories even when login shell PATH capture is blocked by corporate security software (e.g. CyberArk EPM)
- Fixed OpenCode zen-backed models (`opencode/*` provider) being filtered out from the model list even when opencode is installed and authenticated

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

- Added a concrete release checklist for the GitHub Actions publish flow
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
[1.2.1]: https://github.com/timwuhaotian/the-pair/compare/v1.2.0...v1.2.1
[1.2.0]: https://github.com/timwuhaotian/the-pair/compare/v1.1.22...v1.2.0
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

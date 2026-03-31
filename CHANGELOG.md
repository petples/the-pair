# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.3.2] - 2026-03-31

### Fixed

- **Cross-platform provider detection**: Fixed CLI tool discovery on Windows and macOS when launched from GUI contexts (Dock, Finder, Explorer). Previously only Codex was detected; Claude and OpenCode are now correctly discovered.
- **PATH fallback directories**: Added Windows npm install locations (`%APPDATA%\npm`, `%LOCALAPPDATA%\npm`) and Unix user bin directories (`~/.local/bin`, `~/.npm-global/bin`, `~/.volta/bin`, NVM version dirs) to PATH fallback list.
- **Binary discovery**: Added `.cmd`/`.exe`/`.bat` extension checks for Windows npm shims, enabling detection of `claude.cmd`, `opencode.cmd`, etc.
- **OpenCode auth path**: Fixed OpenCode auth.json path resolution on Windows to use `%APPDATA%\opencode\auth.json`.
- **Environment variable passthrough**: All CLI child processes now explicitly receive `HOME`, `USERPROFILE`, `APPDATA`, and `LOCALAPPDATA` environment variables, ensuring config files are discoverable regardless of GUI app environment isolation.
- **Claude credential fallback**: Added file-based auth detection for Claude using `~/.claude/.credentials.json` and Windows AppData paths when `claude auth status` subprocess fails.

### Changed

- **Dynamic model discovery**: Replaced hardcoded model catalogs with dynamic discovery from config files, CLI help output, and session history for all providers (Claude, Codex, Gemini, OpenCode).
- **Gemini event parsing**: Added structured text extraction for Gemini's `candidates`, `serverContent`, and `modelTurn` event formats.
- **Noise filtering**: Improved plain output filtering to skip punctuation-only protocol artifacts.

## [1.3.1] - 2026-03-31

### Added

- **Branch conflict detection**: Prevents creating pairs on branches already used by another active pair, eliminating worktree conflicts.
- **Worktree cleanup on failure**: If broker initialization fails during pair creation, the newly created worktree is automatically deleted to prevent orphaned directories.
- **BranchPicker "current" badge**: Visual indicator showing which branch is currently checked out in the repository.
- **Remote branch filtering**: Remote branches that have a corresponding local branch are now hidden from the BranchPicker to reduce clutter.
- **`extractErrorMessage` utility**: Centralized error message extraction helper in `utils.ts` for consistent error handling across the app.

### Fixed

- **Worktree creation for current branch**: Fixed worktree creation logic when selecting the currently checked-out branch; now uses `--detach` flag to avoid "git worktree add" failures.
- **Worktree deletion**: Fixed `delete_worktree` to run git commands from the parent repository instead of the worktree itself, resolving remove failures.
- **Local branch detection**: Fixed `ensure_local_tracking_branch` to correctly identify local vs remote branches and handle edge cases with branch names containing slashes.
- **Session snapshot recovery**: Fixed `build_process_context` to gracefully fall back to the original directory if the worktree path no longer exists.
- **Store error handling**: Improved error message extraction across `usePairStore` and `useUpdateStore` to handle non-Error objects consistently.

### Changed

- **Gitignore strategy**: Worktrees are now excluded via `.git/info/exclude` instead of `.gitignore` to avoid polluting the repository's tracked files.

## [1.3.0] - 2026-03-29

### Added

- **Reasoning effort controls**: Per-role reasoning effort picker (`ReasoningEffortPicker` component) integrated into model selection for both pair creation (`CreatePairModal`) and pair settings (`PairSettingsModal`). Supports low/medium/high for Claude and Codex o-series models, none/low/medium/high for Gemini 2.5/2.0-flash models.
- **Token usage tracking**: Live per-turn token usage (`TurnTokenUsage` type) extracted from provider JSON event streams for Claude, Codex, Gemini, and OpenCode. Output tokens, input tokens, provider source, and live/final status are tracked per agent turn.
- **Token chip display**: New `TokenChip` component showing live output token counts inline in the agent console during execution.
- **Update notification modal**: Dedicated `UpdateNotification` component replacing the inline updater controls with a standalone modal for update announcements.
- **Centralized update store**: New `useUpdateStore` (Zustand) managing update check, download, and install state, replacing the previous component-local state management.
- **Error boundary**: `ErrorBoundary` component wrapping the app to catch and gracefully display React render errors.
- **Sound feedback**: `playFinishChime()` utility that plays an audio chime when a pair reaches the `Finished` status.
- **Snapshot diff utility**: `shouldSaveSnapshot()` moved to dedicated `snapshotDiff.ts` module with unit tests, comparing status, turn, iteration, models, reasoning effort, and token usage changes.
- **Token usage utilities**: `tokenUsage.ts` module with `resolveCurrentTurnTokenUsage`, `syncTokenUsage`, and `turnCardToMessage` helpers, plus 275 lines of unit tests covering edge cases.
- **Compact ResourceMeter**: `ResourceMeter` component now supports `compact` and `hideLabels` props for use in space-constrained layouts.
- **usePrevious hook**: Generic `usePrevious<T>` utility for detecting value changes across renders.
- **Model catalog reasoning levels**: `AvailableModel` entries now include `reasoningEffortLevels` metadata so the frontend knows which models support reasoning effort configuration.
- **Provider reasoning effort passthrough**: Provider adapter passes `--reasoning-effort` flag to Claude and Codex CLI, `--thinking-budget` to Gemini CLI (mapped from effort levels), with full test coverage.

### Changed

- **Removed verification gate**: Deleted the entire `verification_gate.rs` backend module (668 lines), `VerificationGatePanel` component (265 lines), `verificationGate.ts` frontend library (473 lines), `ReleaseNotesModal`, and associated tests. The verification gate workflow has been replaced by simpler mentor review logic.
- **Simplified pair status machine**: Removed `Awaiting Human Review` status. The flow is now `Idle → Mentoring → Executing → Reviewing → (loop or Finished)`, with no separate human review gate.
- **Simplified session recovery**: `SessionRecoveryModal` no longer gates resume behind `canResume` status checks; sessions can always resume with a new task.
- **Streamlined dashboard cards**: Reduced pair cards from `min-h-[220px]` to `min-h-[140px]` with tighter spacing (9–10px text, 1.5px gaps). Active pair count shown inline with a pulsing badge in the heading.
- **Improved updater architecture**: `UpdateControls` rewritten from 154 lines of component-local state to a thin 34-line wrapper delegating to `useUpdateStore`, with event-driven check/install flow via Tauri events.
- **Enhanced process spawning**: `ProcessSpawner` now extracts token usage from provider-specific JSON event formats (Claude `result`/`content_block_delta` events, Codex `usage` objects, Gemini `usageMetadata`, OpenCode generic usage). Token usage is pushed to `MessageBroker` via new `update_token_usage`/`reset_token_usage` methods.
- **Session snapshot schema**: Snapshots now persist `mentor_reasoning_effort`, `executor_reasoning_effort`, per-turn `token_usage`, and run-level `total_output_tokens`. The `verification` field has been removed from all snapshot types.
- **Pair state persistence**: `Pair` objects now track `mentorReasoningEffort`, `executorReasoningEffort`, `mentorTokenUsage`, and `executorTokenUsage` instead of `verification` state.
- **Agent state tracking**: `AgentState` now carries an optional `tokenUsage` field. `Message` records include optional per-message `tokenUsage`.
- **Message broker**: Removed all verification-related methods (`set_verification_report`, verification verdict parsing, verification review/retry prompts). Added `update_token_usage` and `reset_token_usage` methods. Agent activity labels changed from "Awaiting verification verdict" to "Executor standing by" / "Checking the work".

### Fixed

- Fixed CI `test:rust` failures caused by uncommitted struct field additions (`mentor_reasoning_effort`, `executor_reasoning_effort`) that were referenced by `pair_manager.rs` but missing from `CreatePairInput`, `ProcessContext`, and `UpdatePairModelsInput`.
- Fixed reasoning effort not being passed through to provider CLI commands during agent turns.
- Fixed Gemini reasoning effort mapping: `none` maps to `--thinking-budget 0`, `low` to 1024, `medium` to 8192, `high` to 32768.

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

[1.3.0]: https://github.com/timwuhaotian/the-pair/compare/v1.2.3...v1.3.0
[1.2.3]: https://github.com/timwuhaotian/the-pair/compare/v1.2.2...v1.2.3
[1.2.2]: https://github.com/timwuhaotian/the-pair/compare/v1.2.1...v1.2.2
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

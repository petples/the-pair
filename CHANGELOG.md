# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

[1.0.1]: https://github.com/timwuhaotian/the-pair/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/timwuhaotian/the-pair/releases/tag/v1.0.0

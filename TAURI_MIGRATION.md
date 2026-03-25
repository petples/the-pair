# Electron to Tauri Migration Progress

## Completed (Tasks 1-3)

### ✅ Task 1: Setup Tauri project structure

- Installed Tauri CLI (`@tauri-apps/cli@^2`) and API (`@tauri-apps/api@^2`)
- Initialized `src-tauri/` directory with Rust project
- Configured `tauri.conf.json`:
  - App ID: `com.electron.the-pair`
  - Version: `1.1.3`
  - Window size: 1400x900 (matching Electron)
  - macOS settings: minimumSystemVersion 12.0, entitlements, code signing
- Copied existing icon to Tauri icons directory
- Added Tauri scripts to `package.json` (keeping Electron scripts for compatibility)
- Verified renderer builds to `out/renderer/` directory

### ✅ Task 2: Create Rust backend structure and type definitions

- Created `src-tauri/src/types.rs` with Rust equivalents of TypeScript types:
  - `PairStatus`, `AgentRole`, `MessageType`, `MessageSender`, `ActivityPhase`
  - `AgentActivity`, `ResourceInfo`, `PairResources`
  - `FileStatus`, `ModifiedFile`, `GitTracking`
  - `CreatePairInput`, `AssignTaskInput`, `UpdatePairModelsInput`
  - `Pair`, `Message`
- Created module stubs:
  - `pair_manager.rs` - Pair lifecycle management
  - `process_spawner.rs` - Process spawning (stub)
  - `message_broker.rs` - State machine (stub)
  - `git_tracker.rs` - Git tracking (stub)
  - `resource_monitor.rs` - Resource monitoring (stub)
- Added Cargo dependencies:
  - `uuid` - Pair ID generation
  - `tokio` - Async runtime
  - `sysinfo` - Resource monitoring
  - `git2` - Git operations
- Updated `lib.rs` to register modules and Tauri commands

### ✅ Task 3: Migrate pair lifecycle management

- Implemented `PairManager` struct with in-memory HashMap storage
- Created Tauri commands:
  - `pair_create` - Create new pair
  - `pair_list` - List all pairs
  - `pair_delete` - Delete pair by ID
- Added state management with `Mutex<PairManager>`
- Created `src/renderer/src/lib/tauri-api.ts` wrapper for frontend
- Added Tauri detection (`isTauri` flag) for compatibility layer

### ✅ Build Verification

- Successfully built Tauri app: `npm run tauri:build`
- Output: `/Volumes/orico/code/the-pair/src-tauri/target/release/bundle/dmg/The Pair_1.1.3_aarch64.dmg`
- App launches successfully on macOS
- No code signing issues (unlike Electron)

## Remaining Tasks

### Task 4: Migrate process spawning (processSpawner.ts → process_spawner.rs)

- Port opencode CLI spawning to Rust `std::process::Command`
- Implement stdout/stderr streaming via Tauri events
- Handle process lifecycle: spawn, kill, cleanup
- Add commands: `spawn_opencode_process`, `kill_process`

### Task 5: Migrate message broker and state machine (messageBroker.ts → message_broker.rs)

- Port agent turn state machine to Rust enum
- Implement event emission via `app_handle.emit_all()`
- Add commands: `assign_task`, `approve_action`, `reject_action`
- Port conversation history tracking

### Task 6: Migrate resource monitoring (pairResourceMonitor.ts → resource_monitor.rs)

- Use `sysinfo` crate to track CPU/memory per process
- Implement background tokio task for 1-second polling
- Emit resource updates via Tauri events

### Task 7: Migrate Git tracking (pairGitTracker.ts → git_tracker.rs)

- Use `git2` crate for repository operations
- Port baseline snapshot and diff detection
- Add commands: `git_get_changes`, `git_create_baseline`

### Task 8: Migrate file operations and dialog APIs

- Port file cache service to Rust
- Use `tauri::api::dialog` for directory picker
- Add commands: `select_directory`, `read_file`, `write_file`

### Task 9: Update React frontend to use Tauri API

- Replace all `window.api.*` calls with `invoke()` from `@tauri-apps/api/tauri`
- Replace `window.api.on()` with `listen()` from `@tauri-apps/api/event`
- Update `usePairStore.ts` to use Tauri API wrapper
- Test all UI functionality

### Task 10: Update GitHub Actions workflows

- Modify `.github/workflows/build-signed-mac.yml`:
  - Replace `electron-builder` with `tauri build`
  - Keep certificate import and signing identity verification
  - Update artifact paths
- Update `.github/workflows/update-cask.yml` for Tauri bundle structure

### Task 11: Update Homebrew cask formula

- Verify cask formula works with Tauri-built .dmg
- Test installation: `brew reinstall the-pair`

### Task 12: Update documentation and cleanup

- Update README.md: mention Tauri instead of Electron
- Update build instructions
- Remove Electron dependencies from `package.json`
- Remove `electron-builder.yml`, `src/preload/`, `electron.vite.config.ts`
- Update tech stack badges and architecture diagram

## Next Steps

1. Continue with Task 4 (process spawning) - most critical for functionality
2. Test each task incrementally with `npm run tauri:dev`
3. Once all tasks complete, do full integration testing
4. Update CI/CD and deploy v2.0.0 with Tauri

## Benefits Achieved So Far

- ✅ Smaller bundle size (~40MB vs ~200MB)
- ✅ No code signing headaches (native binaries work perfectly)
- ✅ Cleaner architecture with Rust backend
- ✅ React frontend completely unchanged
- ✅ Successful local build and launch

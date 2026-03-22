# The Pair - Project Plan

## Overview

The Pair is a desktop application designed to orchestrate and monitor dual-agent AI workflows (Planner + Executor) executing on local codebases. It is not an IDE, but a robust scheduler and sandbox for autonomous iterations with a human-in-the-loop fallback.

## Phase 1: Foundation & Scaffold (Completed)

- [x] Scaffold Electron + React + TypeScript via `electron-vite`.
- [x] Integrate Tailwind CSS v4 and `lucide-react`.
- [x] Setup dark-mode UI skeleton following shadcn/ui principles.
- [x] Implement initial global state management using `Zustand`.
- [x] Build out the UI prototype: Bento Grid Dashboard & Watchtower Detail View.

## Phase 2: Core Scheduler & IPC (Partially Completed)

- [x] **Electron Main Process Setup:**
  - Create the `PairManager` class to instantiate and track Node.js child processes.
  - Setup IPC (Inter-Process Communication) channels for real-time status, logs, and resource usage bridging between Main and Renderer.
- [x] **Ghostty Integration:**
  - Implemented `ProcessSpawner` to launch Ghostty terminals with opencode.
  - Added role-specific prompts for Planner and Executor agents.
- [x] **Create Pair Modal:**
  - Built modal to select directory, models, and task specification.
  - Integrated with global opencode.json config for model selection.
- [ ] **Resource Monitoring:**
  - Integrate `pidusage` to track CPU/Memory per Pair process.
  - Pipe resource data to the frontend store via IPC at fixed intervals (e.g., 1000ms).

## Phase 3: The Planner & Executor Entities

- [ ] **LLM Integration Layer:**
  - Create standard API clients for both OpenAI-compatible endpoints (supporting Local models like Ollama or LM Studio) and Anthropic/Anthropic-compatible endpoints.
  - Setup system prompts for **Planner** (strategic, critical, task-decomposition) and **Executor** (strict script/code runner).
- [ ] **State Machine & Loop:**
  - Implement the core execution loop: `Idle -> Planning -> Executing -> Reviewing -> Finished / Error`.
  - Add Loop Prevention: enforce a `maxIterations` constraint to pause and request human intervention.

## Phase 4: File System & Workspace Integration

- [ ] **Workspace Sandboxing:**
  - Ensure the Executor's commands are strictly scoped to the user-selected local directory.
- [ ] **Diff Generation:**
  - Integrate `git diff` or a similar file-system snapshot mechanism to track what the Executor modified.
  - Display these changes in the UI under "Modified Files".

## Phase 5: Human-in-the-Loop & Final Polish

- [ ] **Pause, Resume & Reject:**
  - Wire up the "Approve", "Reject" (with text feedback), and "Pause" buttons to actually signal the Electron Main Process.
- [ ] **Settings & Configuration:**
  - Build a settings modal for global API keys, default URLs, and default models.
  - Allow per-Pair overrides for models and prompts.
- [ ] **Packaging:**
  - Configure `electron-builder` for macOS, Windows, and Linux targets.
  - Add App Icons and metadata.

## Future / MVP+

- Persistent Session Storage (SQLite / Local JSON).
- View full historical diffs per iteration.
- Context window compression (Summarizing previous loops when token limits are reached).

# The Pair UI, Reusable Tasks, and Homebrew Release Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refresh the Electron app chrome, let existing pairs accept new tasks and deferred model updates, enrich model selection UX, and automate signed Homebrew publishing from `main` version bumps.

**Architecture:** Keep pair identity stable while treating each new task as a fresh run on the same pair container. Expand model metadata in the main process, expose it through preload/store, and reuse a shared rich model picker across onboarding, creation, and pair settings. Replace tag-driven brew publishing with a `push main -> detect version bump -> signed release -> cask update` workflow.

**Tech Stack:** Electron, React 19, TypeScript, Zustand, Tailwind CSS v4, Node test runner, GitHub Actions, electron-builder

---

### Task 1: Add regression tests for reusable task state and model metadata

**Files:**

- Create: `tests/modelCatalog.test.ts`
- Create: `tests/pairTaskState.test.ts`
- Create: `src/main/modelCatalog.ts`
- Create: `src/main/pairTaskState.ts`
- Modify: `package.json`

- [ ] Write failing tests for model availability/billing labeling and task-state reset behavior
- [ ] Run the new node tests and confirm failure matches missing helpers
- [ ] Implement the minimal helper modules and add a repo-level `npm test` script
- [ ] Re-run the targeted tests until green

### Task 2: Refresh app chrome and model-picking surfaces

**Files:**

- Modify: `src/main/index.ts`
- Modify: `src/renderer/src/App.tsx`
- Modify: `src/renderer/src/assets/main.css`
- Create: `src/renderer/src/components/AppChrome.tsx`
- Create: `src/renderer/src/components/ModelPicker.tsx`
- Modify: `src/renderer/src/components/CreatePairModal.tsx`
- Modify: `src/renderer/src/components/OnboardingWizard.tsx`

- [ ] Hide the default Electron title bar and expose a native-integrated draggable app chrome
- [ ] Move dashboard/detail headers into the new shell and tighten hierarchy around pair state
- [ ] Replace plain `<select>` model fields with a richer picker that shows provider, billing, plan/access, readiness, and role guidance

### Task 3: Let pairs accept new tasks and deferred model changes

**Files:**

- Modify: `src/main/index.ts`
- Modify: `src/main/pairManager.ts`
- Modify: `src/main/messageBroker.ts`
- Modify: `src/main/processSpawner.ts`
- Modify: `src/main/types.ts`
- Modify: `src/preload/index.ts`
- Modify: `src/preload/index.d.ts`
- Modify: `src/renderer/src/store/usePairStore.ts`
- Modify: `src/renderer/src/types.ts`
- Create: `src/renderer/src/components/AssignTaskModal.tsx`
- Create: `src/renderer/src/components/PairSettingsModal.tsx`

- [ ] Add IPC for assigning a new task to an existing pair and for saving updated default models
- [ ] Reset run-scoped state without recreating the pair container or workspace
- [ ] Apply pending model changes only when the next task starts, and surface that clearly in the UI

### Task 4: Automate signed Homebrew publishing from `main`

**Files:**

- Modify: `.github/workflows/build-signed-mac.yml`
- Modify: `.github/workflows/update-cask.yml`
- Modify: `HOMEBREW_SETUP.md`

- [ ] Convert signed mac release automation to trigger from pushes to `main`
- [ ] Guard publishing behind `package.json` version changes and create/update the GitHub release for that version
- [ ] Update the Homebrew tap in the same release flow and document all required GitHub secrets

### Task 5: Verify the integrated changes

**Files:**

- Modify: none

- [ ] Run `npm test`
- [ ] Run `npm run typecheck`
- [ ] Run `npm run lint`
- [ ] Note any remaining external setup requirements for signing/notarization/Homebrew push

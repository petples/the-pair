# AI Agent Guidelines for "The Pair"

This file contains instructions and context for any AI agents (like yourself) working on the `the-pair` repository.

## Project Identity

"The Pair" is a Desktop application built with Electron, React, and TypeScript. It serves as an orchestrator for local AI agents. It explicitly separates AI tasks into two distinct sub-agents: a **Planner** and an **Executor**. The app manages their lifecycle, provides terminal/file-system access, monitors resources, and provides a polished UI for humans to observe and intervene.

## Tech Stack

- **Framework:** Electron (via `electron-vite`)
- **Frontend:** React 19, TypeScript
- **Styling:** Tailwind CSS v4, `clsx`, `tailwind-merge`
- **Icons:** `lucide-react`
- **State Management:** `zustand`
- **Process Monitoring:** `pidusage` (in the Main process)

## Architecture Rules

1. **Main vs. Renderer:**
   - Never import Node.js built-ins (`fs`, `path`, `child_process`) directly into the Renderer (`src/renderer/src/`).
   - Use `contextBridge` in `src/preload/index.ts` to expose strict APIs to the frontend window.
2. **Styling:**
   - Always use Tailwind CSS classes. We are using a custom dark mode palette defined in `src/renderer/src/assets/main.css`.
   - Use the `cn()` utility from `src/renderer/src/lib/utils.ts` for conditional class merging.
3. **Agent Interactions (Within the App):**
   - The application spawns processes. It must handle infinite loops gracefully.
   - Always implement an iteration limit (`maxIterations`) before pausing for human intervention.
4. **Error Handling:**
   - Handle permissions and locked files defensively in the Main process.
   - Propagate errors cleanly to the frontend via IPC to display in the `Console` UI.

## Adding Features

- **UI Components:** Keep components modular. Prefer keeping everything in `src/renderer/src/components/` if they are reusable.
- **State:** Use the existing `usePairStore` for global application state related to active Pairs.
- **Commands:** Run commands silently in the background when checking status. Ensure `electron-vite` processes are cleanly killed on exit.

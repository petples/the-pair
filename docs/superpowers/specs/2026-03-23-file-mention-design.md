# @Mention File Search Feature - Design Specification

## 1. Overview

Add fuzzy file/directory search triggered by typing `@` in Task Specification textareas. Users can quickly reference workspace files to add context for AI agents.

## 2. User Flow

1. User opens AssignTaskModal or CreatePairModal
2. User types `@` followed by search characters (e.g., `@bu`)
3. Popover appears with fuzzy-matched file/directory results
4. User selects a file (via click or keyboard navigation)
5. Selected path is inserted at cursor: `@src/components/Button.tsx`
6. On task execution, backend parses @mentions, reads file contents, and injects into AI context

## 3. Architecture

### Components

| Component        | Location                                      | Responsibility                         |
| ---------------- | --------------------------------------------- | -------------------------------------- |
| FileCacheService | `src/main/services/fileCache.ts`              | Main process file indexing and caching |
| FileMention      | `src/renderer/src/components/FileMention.tsx` | Autocomplete popover UI                |
| AssignTaskModal  | Existing                                      | Uses FileMention for spec input        |
| CreatePairModal  | Existing                                      | Uses FileMention for spec input        |

### Data Flow

```
User types "@bu"
  → FileMention detects @ trigger + query
  → Call window.api.file.listFiles()
  → Fuse.js fuzzy filters (capped at 50)
  → Display popover with matches

User selects file
  → Insert "@path/to/file" at cursor position

Backend (on task execution)
  → Parse spec with regex /@([^\s]+)/
  → Read mentioned files from disk
  → Inject content into AI context
```

## 4. API Specification

### IPC Methods

#### `file:listFiles(options: { pairId?: string; directory?: string }): Promise<FileEntry[]>`

Returns cached file list for a pair's workspace or directory.

**Parameters:**

- `pairId` - Used in AssignTaskModal where pair/workspace already exists
- `directory` - Used in CreatePairModal where user is selecting workspace

**Response:**

```typescript
interface FileEntry {
  path: string // Relative to workspace root, e.g., "src/components/Button.tsx"
  type: 'file' | 'directory'
}
```

#### `file:parseMentions(pairId: string, spec: string): Promise<string>`

Parses @mentions in spec and returns enhanced spec with file contents injected.

**Input:** Raw spec with @mentions
**Output:** Spec with @mentions replaced with file contents (for AI context)

### Preload API

```typescript
interface FileAPI {
  listFiles: (options: { pairId?: string; directory?: string }) => Promise<FileEntry[]>
  parseMentions: (pairId: string, spec: string) => Promise<string>
}
```

## 5. Implementation Details

### 5.1 File Caching (Main Process)

- **Initial load**: Recursively scan workspace directory on pair creation
- **File watcher**: Use `chokidar` to watch for file changes (add/delete/modify)
- **Exclusions**: Skip hidden files and common directories:
  - `.git`, `.svn`, `.hg`
  - `node_modules`, `dist`, `build`, `out`
  - `.next`, `.nuxt`, `.svelte-kit`
  - `__pycache__`, `.venv`, `venv`
  - `*.log`, `.DS_Store`, `Thumbs.db`

### 5.2 Fuzzy Search (Renderer)

- Library: `fuse.js`
- Search keys: `path` (filename and full path)
- Threshold: 0.4 (allows typos)
- Result limit: Cap at 50 matches for performance

### 5.3 @Mention Parsing (Main Process)

- Regex: `/@([^\s]+)/g` to find all @mentions
- Resolve relative paths against workspace root
- Read file contents with proper encoding handling
- Format for AI context:
  ```
  @src/components/Button.tsx
  ---
  [file content here]
  ---
  ```

### 5.4 FileMention Component

- **Trigger**: Show popover when cursor is after `@` followed by 1+ characters
- **Dismiss**: On blur, Escape key, or selecting a file
- **Navigation**: Arrow keys to navigate, Enter to select
- **Positioning**: Below textarea, aligned to cursor position

## 6. Edge Cases

| Edge Case                        | Handling                                 |
| -------------------------------- | ---------------------------------------- |
| Workspace with 10k+ files        | Cap results at 50, show "X more results" |
| User deletes mentioned file      | Show warning/error when parsing          |
| Invalid path in @mention         | Skip silently or show inline warning     |
| Very large file (>1MB)           | Truncate or skip with warning            |
| Binary files                     | Skip with warning                        |
| Circular symlinks                | Detect and skip                          |
| Slow file system (network drive) | Use cached list, don't block UI          |

## 7. Dependencies

| Package  | Version | Purpose                       |
| -------- | ------- | ----------------------------- |
| fuse.js  | ^7.0.0  | Fuzzy search in renderer      |
| chokidar | ^3.5.0  | File watching in main process |

## 8. Files to Modify

- `src/main/services/fileCache.ts` (new)
- `src/main/index.ts` (register IPC handlers)
- `src/preload/index.ts` (expose file API)
- `src/preload/index.d.ts` (TypeScript types)
- `src/renderer/src/components/FileMention.tsx` (new)
- `src/renderer/src/components/AssignTaskModal.tsx` (integrate FileMention)
- `src/renderer/src/components/CreatePairModal.tsx` (integrate FileMention)

## 9. Acceptance Criteria

- [ ] Typing `@` followed by characters shows fuzzy-matched file popover
- [ ] Arrow keys navigate results, Enter selects
- [ ] Selected file inserts `@path/to/file` at cursor
- [ ] File cache is built on workspace open
- [ ] File watcher updates cache on file changes
- [ ] Hidden files and common directories are excluded
- [ ] Backend parses @mentions and injects file contents
- [ ] Works in both AssignTaskModal and CreatePairModal

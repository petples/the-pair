# Contributing to The Pair

Thank you for your interest in contributing to The Pair! This document provides guidelines and instructions for contributing to the project.

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [How Can I Contribute?](#how-can-i-contribute)
- [Development Workflow](#development-workflow)
- [Coding Guidelines](#coding-guidelines)
- [Pull Request Guidelines](#pull-request-guidelines)
- [Commit Message Guidelines](#commit-message-guidelines)

---

## Code of Conduct

This project and everyone participating in it is governed by our [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code. Please report unacceptable behavior to the project maintainers.

---

## Getting Started

### Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** 20+ ([Download](https://nodejs.org/))
- **Git** ([Download](https://git-scm.com/))
- **VS Code** (recommended) with:
  - [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint)
  - [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)

### Fork and Clone

1. **Fork** the repository on GitHub

2. **Clone** your fork locally:

   ```bash
   git clone https://github.com/YOUR_USERNAME/the-pair.git
   cd the-pair
   ```

3. **Set up upstream** to stay in sync:

   ```bash
   git remote add upstream https://github.com/timwuhaotian/the-pair.git
   git fetch upstream
   ```

4. **Install dependencies**:

   ```bash
   npm install
   ```

5. **Start development mode**:
   ```bash
   npm run dev
   ```

---

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check the [existing issues](https://github.com/timwuhaotian/the-pair/issues) as you might find out that you don't need to create one.

**When creating a bug report, include:**

- **Clear title and description**
- **Steps to reproduce** the behavior
- **Expected vs actual behavior**
- **Screenshots** if applicable
- **Environment details**:
  - OS version (e.g., macOS 14.1)
  - App version (e.g., 1.0.0)
  - Node.js version (`node -v`)

**Example:**

```markdown
**Title:** Executor activity not updating in real-time

**Steps to Reproduce:**

1. Create a new pair
2. Wait for executor to start working
3. Observe the activity status bar

**Expected:** Activity shows "Executing instruction" with thinking icon
**Actual:** Activity remains at "Executor idle"

**Environment:**

- macOS 14.1
- App version: 1.0.0
```

### Suggesting Features

Feature suggestions are tracked as [GitHub issues](https://github.com/timwuhaotian/the-pair/issues).

**When creating a feature suggestion, include:**

- **Use case** — Why is this feature needed?
- **Proposed solution** — How should it work?
- **Alternatives considered** — What other approaches were thought about?
- **Additional context** — Screenshots, mockups, or examples

### Pull Requests

Pull requests are the primary way to contribute code. See the [Pull Request Guidelines](#pull-request-guidelines) for details.

---

## Development Workflow

### Branch Naming

Use descriptive branch names following this pattern:

```
{type}/{short-description}
```

**Examples:**

- `feat/add-dark-mode-toggle`
- `fix/executor-pid-tracking`
- `docs/update-readme-installation`
- `refactor/simplify-state-machine`

**Types:**

- `feat` — New feature
- `fix` — Bug fix
- `docs` — Documentation changes
- `refactor` — Code refactoring (no behavior change)
- `test` — Adding or updating tests
- `chore` — Build process or auxiliary tool changes

### Making Changes

1. **Sync with upstream**:

   ```bash
   git checkout main
   git pull upstream main
   ```

2. **Create a branch**:

   ```bash
   git checkout -b feat/your-feature-name
   ```

3. **Make your changes** following the [Coding Guidelines](#coding-guidelines)

4. **Test your changes**:

   ```bash
   # Type checking
   npm run typecheck

   # Linting
   npm run lint

   # Run the app
   npm run dev
   ```

5. **Commit your changes** following the [Commit Message Guidelines](#commit-message-guidelines)

6. **Push to your fork**:

   ```bash
   git push origin feat/your-feature-name
   ```

7. **Create a Pull Request** on GitHub

---

## Coding Guidelines

### TypeScript

- **Use TypeScript** for all new code — no `.js` files
- **Avoid `any`** — use proper types or create new interfaces
- **Use interfaces** for object types
- **Export types** from dedicated `types.ts` files when shared

**Example:**

```typescript
// Good
interface AgentActivity {
  phase: ActivityPhase
  label: string
  detail?: string
  startedAt: number
  updatedAt: number
}

// Bad
const activity: any = { ... }
```

### React Components

- **Functional components** only — no class components
- **Type props** with interfaces
- **Use hooks** for state and effects
- **Keep components small** — extract sub-components when needed

**Example:**

```typescript
interface StatusBadgeProps {
  status: PairStatus
  className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  return <div className={cn('badge', className)}>{status}</div>
}
```

### Styling

- **Tailwind CSS only** — no inline styles or CSS modules
- **Use `cn()` utility** for conditional classes
- **Follow mobile-first** responsive design
- **Use semantic color tokens** from our theme

**Example:**

```typescript
<div className={cn(
  'flex items-center gap-2 p-4 rounded-lg',
  'bg-muted hover:bg-muted/80',
  isActive && 'ring-2 ring-primary'
)}>
  {children}
</div>
```

### State Management

- **Use Zustand** for global state
- **Keep state minimal** — derive computed values
- **Use selectors** for performance

**Example:**

```typescript
interface PairStore {
  pairs: Pair[]
  addPair: (pair: Pair) => void
  removePair: (id: string) => void
}

export const usePairStore = create<PairStore>((set) => ({
  pairs: [],
  addPair: (pair) => set((state) => ({ pairs: [...state.pairs, pair] })),
  removePair: (id) => set((state) => ({ pairs: state.pairs.filter((p) => p.id !== id) }))
}))
```

### File Naming

- **Components**: PascalCase (e.g., `StatusBadge.tsx`)
- **Utilities**: camelCase (e.g., `formatTime.ts`)
- **Types**: camelCase with `.ts` (e.g., `types.ts`)
- **Tests**: `{filename}.test.ts`

### Comments

- **JSDoc** for public APIs
- **Inline comments** for complex logic
- **No commented-out code** — delete it

**Example:**

```typescript
/**
 * Captures the current Git status as a baseline for tracking changes.
 * @param gitRoot - The root path of the Git repository
 * @returns Porcelain status output string
 */
captureBaseline(gitRoot: string): string {
  // Use porcelain v1 format with null separators for reliable parsing
  return execSync('git status --porcelain=v1 -z --untracked-files=all', {
    encoding: 'utf-8',
    cwd: gitRoot
  })
}
```

---

## Pull Request Guidelines

### Before Submitting

- [ ] Code follows the [Coding Guidelines](#coding-guidelines)
- [ ] Type checking passes (`npm run typecheck`)
- [ ] Linting passes (`npm run lint`)
- [ ] All tests pass (if applicable)
- [ ] Commits are squashed into logical units
- [ ] PR description is clear and complete

### PR Description Template

```markdown
## Description

Brief description of the changes

## Type of Change

- [ ] Bug fix (non-breaking change that fixes an issue)
- [ ] New feature (non-breaking change that adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to change)
- [ ] Documentation update

## Related Issues

Closes #123

## Testing

Describe how you tested the changes

## Screenshots (if applicable)

Add screenshots of UI changes

## Checklist

- [ ] My code follows the code style of this project
- [ ] I have commented my code, particularly in hard-to-understand areas
- [ ] I have made corresponding changes to the documentation
- [ ] My changes generate no new warnings
- [ ] I have checked my code and corrected any misspellings
```

### Review Process

1. **Automated checks** — CI runs type checking, linting, and tests
2. **Maintainer review** — A maintainer reviews the code
3. **Address feedback** — Make requested changes
4. **Approval** — Once approved, the PR is merged

### Merge Strategy

We use **squash and merge** to keep the commit history clean. Each PR becomes a single commit on `main`.

---

## Commit Message Guidelines

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification.

### Format

```
{type}({scope}): {subject}

{body}

{footer}
```

### Types

- `feat` — A new feature
- `fix` — A bug fix
- `docs` — Documentation changes
- `style` — Code style changes (formatting, etc.)
- `refactor` — Code refactoring
- `test` — Adding or updating tests
- `chore` — Maintenance tasks

### Examples

```bash
# Feature
feat(console): add real-time activity indicators

- Add thinking, using_tools, responding phases
- Show duration for active agent turns
- Animate status icons based on phase

Closes #42

# Bug fix
fix(resource-monitor): correctly track executor PIDs

Executor processes were being attributed to mentor slot.
Now properly passing role-specific PIDs to setPids().

Fixes #38

# Documentation
docs(readme): add Homebrew installation instructions

Add step-by-step guide for publishing to Homebrew Cask
including notarization requirements.
```

### Subject Line Rules

- Use **imperative mood** ("add" not "added")
- **No period** at the end
- **Max 72 characters**

### Body Rules

- **Wrap at 72 characters**
- **Explain what and why** (not how)
- Use **bullet points** for multiple changes

---

## Additional Resources

- [Tauri Documentation](https://tauri.app/v2/guides/)
- [React Documentation](https://react.dev/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [Zustand Documentation](https://docs.pmnd.rs/zustand/getting-started/introduction)

---

## Questions?

If you have questions, please:

1. Check existing [issues](https://github.com/timwuhaotian/the-pair/issues)
2. Read the [README.md](README.md) and [AGENTS.md](AGENTS.md)
3. Ask in the GitHub issue discussions

Thank you for contributing to The Pair! 🎉

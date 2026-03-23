<div align="center">
  <h1>The Pair</h1>
  <p>Automated pair programming — grab a coffee while two AI agents cross-check each other's work</p>
  
  [![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://www.apache.org/licenses/LICENSE-2.0)
  [![GitHub release](https://img.shields.io/github/v/release/timwuhaotian/the-pair?include_prereleases&logo=github)](https://github.com/timwuhaotian/the-pair/releases)
  [![Build Status](https://github.com/timwuhaotian/the-pair/actions/workflows/build.yml/badge.svg)](https://github.com/timwuhaotian/the-pair/actions)
  [![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178c6.svg?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
  [![Electron](https://img.shields.io/badge/Electron-39-47848f.svg?logo=electron&logoColor=white)](https://www.electronjs.org/)
  [![React](https://img.shields.io/badge/React-19-61dafb.svg?logo=react&logoColor=black)](https://react.dev/)
  [![Homebrew](https://img.shields.io/badge/Homebrew-Cask-orange.svg?logo=homebrew)](https://brew.sh/)
  [![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)
  [![Code Style](https://img.shields.io/badge/code_style-prettier-ff69b4.svg)](https://prettier.io/)
  
  <p align="center">
    <strong>macOS</strong> • <strong>Windows</strong> • <strong>Linux</strong>
  </p>
</div>

---

## 📖 Table of Contents

- [What is The Pair?](#-what-is-the-pair)
- [Features](#-features)
- [Screenshots](#-screenshots)
- [Installation](#-installation)
- [Quick Start](#-quick-start)
- [Configuration](#-configuration)
- [Architecture](#-architecture)
- [Development](#-development)
- [Building](#-building)
- [Code Signing & Notarization](#-code-signing--notarization)
- [Publishing to Homebrew](#-publishing-to-homebrew)
- [Contributing](#-contributing)
- [License](#-license)

---

## 🎯 What is The Pair?

**Worried about AI code hallucinations? You're not alone.**

The Pair solves this by running **two AI agents that cross-check each other**:

- **Mentor Agent** — Plans, reviews, and validates (read-only)
- **Executor Agent** — Writes code and runs commands

While they work, **go grab a coffee**. Come back to reviewed, cross-validated code.

Unlike single-agent tools where one model's mistakes go unchecked, The Pair's dual-agent architecture means the Executor writes code while the Mentor catches issues before they land. You get higher-quality output with less supervision.

### Key Benefits

- **Dual-Model Cross-Validation** — Two models check each other's work, dramatically reducing code hallucinations
- **Automated collaboration** — Agents work together without constant human intervention
- **Real-time monitoring** — Watch CPU/memory usage per agent with live activity tracking
- **Git integration** — Automatic tracking of all file changes made during a session
- **Human oversight** — Step in when needed with approval/rejection workflow
- **Full transparency** — See every action, tool call, and decision in the console

### Use Cases

- 🤖 **Autonomous coding sessions** — Let AI agents iterate on features while you focus on review
- 📝 **Code refactoring** — Automated analysis and implementation of improvements
- 🐛 **Bug fixing** — Agents collaborate to diagnose and resolve issues
- 📚 **Learning tool** — Observe how AI agents break down and solve problems
- 🔧 **Task automation** — Repetitive coding tasks handled by the agent pair

---

## 🤔 Why Two Agents?

**Single AI agents have a trust problem.**

When one model writes code, who checks it? You do. Every line.

The Pair flips this: one agent writes, another reviews. They catch each other's mistakes so you don't have to.

**The result?** Less time debugging AI-generated code. More time shipping.

---

## ✨ Features

### Core Features

- **Dual-Agent Architecture** — Separation of planning (Mentor) and execution (Executor) for better code quality
- **Full Automation Mode** — Agents work autonomously with workspace-scoped permissions
- **Real-Time Activity Tracking** — Live status showing what each agent is thinking, doing, or waiting for
- **Resource Monitoring** — CPU and memory usage per agent, updated every second
- **Git Change Tracking** — Automatic detection of all modified, added, or deleted files
- **Conversation History** — Full transcript of all agent interactions and decisions
- **Error Recovery** — Automatic retry and recovery from failed operations
- **Stop/Retry Controls** — Manual intervention when needed

### Technical Features

- **Local-First** — Runs entirely on your machine, no cloud dependencies
- **Model Agnostic** — Works with any opencode-compatible AI model (OpenAI, Anthropic, Ollama, etc.)
- **Cross-Platform** — Native builds for macOS, Windows, and Linux
- **Type-Safe** — Full TypeScript coverage with strict type checking
- **Modern UI** — Beautiful dark/light theme with smooth animations (Framer Motion)
- **Lightweight** — Minimal resource footprint with efficient process management

---

## 📸 Screenshots

<div align="center">
  <picture>
    <img src="./docs/screenshots/dashboard.png" alt="Dashboard View" width="700"/>
  </picture>
  <p><em>Dashboard showing active pairs with real-time resource monitoring</em></p>
  
  <picture>
    <img src="./docs/screenshots/pair-detail.png" alt="Pair Detail View" width="700"/>
  </picture>
  <p><em>Pair detail view with live agent activity and Git change tracking</em></p>
</div>

---

## 📥 Installation

### Homebrew (macOS)

Homebrew installation works only when the release assets are publicly downloadable.

- If `timwuhaotian/the-pair` is public, users can install with Homebrew normally.
- If the repository is still private, `brew install --cask the-pair` will fail because Homebrew cannot access private GitHub release assets.

```bash
# Add the tap
brew tap timwuhaotian/the-pair

# Install The Pair
brew install --cask the-pair
```

### Manual Download

Download the latest release from [GitHub Releases](https://github.com/timwuhaotian/the-pair/releases).

Note:

- If the repository is public, the release assets are directly downloadable.
- If the repository is private, users need authenticated GitHub access; public Homebrew installs will not work yet.

| Platform    | File                           |
| ----------- | ------------------------------ |
| **macOS**   | `the-pair-{version}.dmg`       |
| **Windows** | `the-pair-{version}-setup.exe` |
| **Linux**   | `the-pair-{version}.AppImage`  |

### From Source

```bash
git clone https://github.com/timwuhaotian/the-pair.git
cd the-pair
npm install
npm run build:mac  # or build:win / build:linux
```

---

## 🚀 Quick Start

### Prerequisites

1. **Install opencode** — The Pair requires opencode CLI to run AI agents

   ```bash
   # macOS
   brew install opencode

   # Or visit: https://opencode.ai/install
   ```

2. **Configure AI Models** — Set up your AI providers in `~/.config/opencode/opencode.json`

   ```json
   {
     "provider": {
       "openai": {
         "options": {
           "apiKey": "your-api-key"
         }
       },
       "anthropic": {
         "options": {
           "apiKey": "your-api-key"
         }
       }
     }
   }
   ```

### First Run

1. **Launch The Pair** from Applications folder (macOS) or start menu

2. **Create a New Pair** — Click "New Pair" button

3. **Configure Your Pair**:
   - **Name**: Give your task a name (e.g., "Add User Authentication")
   - **Directory**: Select your project folder
   - **Spec**: Describe what you want the agents to accomplish
   - **Mentor Model**: Choose an AI model for planning/review (e.g., `gpt-4`)
   - **Executor Model**: Choose an AI model for coding (e.g., `claude-3-sonnet`)

4. **Watch the Magic** — The agents will:
   - Mentor analyzes the task and creates a plan
   - Executor implements the first step
   - Mentor reviews and provides next instructions
   - Loop continues until task is complete

5. **Monitor Progress** — Watch real-time:
   - Agent activity (thinking, using tools, responding)
   - Resource usage (CPU/memory per agent)
   - Modified files (Git-tracked changes)

6. **Intervene if Needed** — Use "Stop Pair" or "Retry Turn" for manual control

---

## ⚙️ Configuration

### opencode Configuration

The Pair uses your existing opencode configuration located at:

- **macOS/Linux**: `~/.config/opencode/opencode.json`
- **Windows**: `%APPDATA%/opencode/opencode.json`

Example configuration:

```json
{
  "provider": {
    "openai": {
      "options": {
        "apiKey": "sk-..."
      },
      "models": {
        "gpt-4": {
          "name": "GPT-4"
        },
        "gpt-4-turbo": {
          "name": "GPT-4 Turbo"
        }
      }
    },
    "anthropic": {
      "options": {
        "apiKey": "sk-ant-..."
      },
      "models": {
        "claude-3-opus": {
          "name": "Claude 3 Opus"
        },
        "claude-3-sonnet": {
          "name": "Claude 3 Sonnet"
        }
      }
    }
  }
}
```

### Pair Runtime Configuration

Each pair maintains its own runtime configuration in `.pair/runtime/<pairId>/` within your project directory. This includes:

- Temporary session files
- Runtime permissions (workspace-scoped)
- Agent conversation history

**Note**: The Pair does not modify your global opencode permissions. All permissions are session-specific.

---

## 🏗️ Architecture

### Tech Stack

| Layer               | Technology            |
| ------------------- | --------------------- |
| **Framework**       | Electron 39           |
| **Frontend**        | React 19 + TypeScript |
| **Styling**         | Tailwind CSS v4       |
| **State**           | Zustand               |
| **Animations**      | Framer Motion         |
| **Icons**           | Lucide React          |
| **Process Monitor** | pidusage              |

### System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    The Pair App                         │
├─────────────────────────────────────────────────────────┤
│  Renderer Process (React UI)                            │
│  ┌──────────────┬──────────────┬──────────────────┐    │
│  │  Dashboard   │ Pair Detail  │    Settings      │    │
│  │  (List)      │ (Console)    │                  │    │
│  └──────────────┴──────────────┴──────────────────┘    │
│                          ↕ IPC                          │
│  Preload Script (contextBridge API)                     │
│                          ↕ IPC                          │
├─────────────────────────────────────────────────────────┤
│  Main Process (Node.js)                                 │
│  ┌──────────────┬──────────────┬──────────────────┐    │
│  │ PairManager  │MessageBroker │ ProcessSpawner   │    │
│  │ (Lifecycle)  │ (State Machine)│ (opencode)     │    │
│  └──────────────┴──────────────┴──────────────────┘    │
│                          ↕                               │
│  ┌──────────────┬──────────────┬──────────────────┐    │
│  │ Git Tracker  │Resource Mon. │ Activity Tracker │    │
│  └──────────────┴──────────────┴──────────────────┘    │
└─────────────────────────────────────────────────────────┘
                          ↕
            ┌─────────────┴─────────────┐
            ↙                           ↘
   ┌─────────────────┐          ┌─────────────────┐
   │   opencode CLI  │          │   Git Repo      │
   │  (Mentor/Exec)  │          │  (Workspace)    │
   └─────────────────┘          └─────────────────┘
```

### Agent Workflow

```
┌──────────────────────────────────────────────────────┐
│                 Pair Execution Flow                   │
└──────────────────────────────────────────────────────┘

     ┌─────────┐
     │  Start  │
     └────┬────┘
          │
          ▼
┌─────────────────┐
│ 1. Initialize   │ ← Git baseline, resources, activity
│    & Baseline   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 2. Mentoring    │ ← Analyze task, create plan
│    Phase        │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 3. Executing    │ ← Implement, run tools, modify files
│    Phase        │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 4. Reviewing    │ ← Check output, plan next step
│    Phase        │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
┌───────┐ ┌──────────┐
│ Done? │ │ Continue │
└───┬───┘ └────┬─────┘
    │          │
    │ Yes      │ No (loop back)
    │          └─────────────┐
    ▼                        │
┌─────────┐                  │
│ Finished│ ◄────────────────┘
└─────────┘
```

---

## 💻 Development

### Prerequisites

- **Node.js** 20+ ([Download](https://nodejs.org/))
- **npm** or **pnpm**
- **Git**

### Setup

```bash
# Clone the repository
git clone https://github.com/timwuhaotian/the-pair.git
cd the-pair

# Install dependencies
npm install

# Start development mode
npm run dev
```

### Project Structure

```
the-pair/
├── src/
│   ├── main/                  # Electron main process
│   │   ├── index.ts           # Entry point
│   │   ├── pairManager.ts     # Pair lifecycle management
│   │   ├── messageBroker.ts   # State machine & IPC
│   │   ├── processSpawner.ts  # opencode process spawning
│   │   ├── pairResourceMonitor.ts  # CPU/Memory monitoring
│   │   ├── pairGitTracker.ts  # Git change tracking
│   │   ├── agentTurn.ts       # Agent response parsing
│   │   └── types.ts           # TypeScript types
│   │
│   ├── preload/               # Context bridge
│   │   ├── index.ts           # API exposure
│   │   └── index.d.ts         # Type definitions
│   │
│   └── renderer/              # React frontend
│       ├── src/
│       │   ├── App.tsx        # Main component
│       │   ├── components/    # UI components
│       │   ├── store/         # Zustand store
│       │   └── types.ts       # Frontend types
│       └── index.html
│
├── build/                     # Build resources
├── resources/                 # App icons
├── package.json
├── electron-builder.yml
└── README.md
```

### Available Scripts

```bash
# Development
npm run dev              # Start hot-reload development server

# Type checking
npm run typecheck        # Check both main and renderer
npm run typecheck:node   # Main process only
npm run typecheck:web    # Renderer only

# Linting
npm run lint             # ESLint
npm run format           # Prettier

# Building
npm run build            # Build all platforms
npm run build:mac        # macOS only
npm run build:win        # Windows only
npm run build:linux      # Linux only
npm run build:unpack     # Unpacked build (for testing)
```

---

## 🔨 Building

### Build Requirements

- **macOS**: Xcode Command Line Tools
- **Windows**: Visual Studio Build Tools
- **Linux**: `libarchive`, `libappindicator3` (for AppImage)

### Build Commands

```bash
# Build for current platform
npm run build

# Build for specific platform
npm run build:mac
npm run build:win
npm run build:linux

# Build without signing (for testing)
CSC_IDENTITY_AUTO_DISCOVERY=false npm run build:mac
```

### Build Output

After building, find your distributables in `dist/`:

```
dist/
├── the-pair-{version}.dmg          # macOS installer
├── the-pair-{version}-setup.exe    # Windows installer
├── the-pair-{version}.AppImage     # Linux AppImage
└── the-pair-{version}.deb          # Debian package
```

---

## 🔐 Code Signing & Notarization

### Current release flow

This repository now uses a GitHub Actions release pipeline:

`push to main` -> detect `package.json` version bump -> build unpacked macOS app -> manually codesign the app bundle -> notarize the notarization archive -> staple when available -> package DMG/ZIP -> create/update GitHub Release -> update Homebrew tap cask

The workflow file is:

- [build-signed-mac.yml](/Volumes/orico/code/the-pair/.github/workflows/build-signed-mac.yml)

### What you need from Apple

1. **Apple Developer Program membership**
   Apple’s Developer ID docs state that software distributed outside the Mac App Store uses a Developer ID certificate plus notarization.

2. **Developer ID Application certificate**
   Apple documents this under Developer ID certificates.

   Steps:
   1. Sign in to `developer.apple.com`
   2. Open `Certificates, Identifiers & Profiles`
   3. Create a `Developer ID Application` certificate
   4. Download the `.cer`
   5. Double-click it to install it into Keychain Access

3. **Export the certificate as `.p12`**
   In Keychain Access:
   1. Find `Developer ID Application: ...`
   2. Export it as `.p12`
   3. Set an export password

4. **Apple ID app-specific password**
   Needed because the workflow uses `xcrun notarytool --apple-id --password --team-id`.

5. **Apple Team ID**
   Apple says Team ID is shown under `Membership details` in the developer account.

### GitHub Actions secrets

Configure these in `Settings -> Secrets and variables -> Actions`:

| Secret                         | What it is                                                             | How to get it                                                                                                                       |
| ------------------------------ | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `MACOS_SIGNING_IDENTITY`       | Exact signing identity string used by `electron-builder` as `CSC_NAME` | Run `security find-identity -v -p codesigning` after installing the certificate, then copy the `Developer ID Application: ...` line |
| `MACOS_CERTIFICATE_P12_BASE64` | Base64-encoded `.p12` export of your Developer ID Application cert     | `base64 -i /path/to/developer-id.p12 \| pbcopy` on macOS                                                                            |
| `MACOS_CERTIFICATE_PASSWORD`   | Password you chose when exporting the `.p12`                           | You set this during export                                                                                                          |
| `APPLE_ID`                     | Apple Account email used for notarization                              | Your Apple Developer account email                                                                                                  |
| `APPLE_APP_SPECIFIC_PASSWORD`  | App-specific password for notarization                                 | Go to `account.apple.com` -> `Sign-In and Security` -> `App-Specific Passwords`                                                     |
| `APPLE_TEAM_ID`                | 10-character Apple team identifier                                     | `developer.apple.com` -> `Membership details`                                                                                       |
| `HOMEBREW_TAP_GITHUB_TOKEN`    | Token allowed to push to `timwuhaotian/homebrew-the-pair`              | Create a GitHub PAT with repo contents write access to the tap repo                                                                 |

Notes:

- GitHub’s built-in `GITHUB_TOKEN` is already used for creating/updating releases in the main repo. You do **not** need to add that one manually.
- For `HOMEBREW_TAP_GITHUB_TOKEN`, GitHub docs say a fine-grained PAT can be used when it has repository contents read/write access to the target repo.

### Local signed build

For local release builds, copy `.env.example` to `.env` and fill in:

```bash
export CSC_NAME="Developer ID Application: Your Name (TEAMID)"
export CSC_KEY_PASSWORD="your-p12-password"
export CSC_LINK="/absolute/path/to/developer-id.p12"
export APPLE_ID="your-apple-id@example.com"
export APPLE_APP_SPECIFIC_PASSWORD="your-app-specific-password"
export TEAM_ID="YOURTEAMID"

npm run build:mac
```

### Manual notarization check

If you want to verify notarization manually:

```bash
APP_PATH=$(find dist -maxdepth 3 -name "*.app" | head -n 1)
ZIP_PATH="dist/the-pair-{version}.zip"

ditto -c -k --sequesterRsrc --keepParent "$APP_PATH" "$ZIP_PATH"

xcrun notarytool submit "$ZIP_PATH" \
  --apple-id "$APPLE_ID" \
  --password "$APPLE_APP_SPECIFIC_PASSWORD" \
  --team-id "$TEAM_ID" \
  --wait

xcrun stapler staple "$APP_PATH"
xcrun stapler validate "$APP_PATH"
```

### Verify signature

```bash
APP_PATH=$(find dist -maxdepth 3 -name "*.app" | head -n 1)
codesign --verify --deep --strict --verbose=2 "$APP_PATH"
```

### Do I need App Store Connect setup?

For the current workflow, **no App Store listing, no TestFlight app, and no App Store submission record are required**.

This is because the app is being distributed outside the Mac App Store via:

- GitHub Releases
- Homebrew Cask

What you **do** need is:

- an active Apple Developer Program membership
- a `Developer ID Application` certificate
- notarization credentials (`APPLE_ID`, app-specific password, `APPLE_TEAM_ID`)

What you **do not** need for this workflow:

- App Store app record
- TestFlight setup
- provisioning profile for App Store distribution

The only App Store Connect-related case you may care about is team management. Apple notes that, for Apple Developer Program organizations, team member access is managed in App Store Connect. If you are a solo developer, you can ignore that.

---

## 🍺 Publishing to Homebrew

### Automatic publish behavior

Homebrew publishing is now driven by the same release workflow:

1. Push to `main`
2. Workflow compares `package.json` version against the previous commit
3. If the version changed:
   - signed macOS app bundle is built
   - the app is manually codesigned
   - the notarization archive is submitted to Apple
   - release `v<version>` is created or updated
   - SHA256 is recalculated
   - `Casks/the-pair.rb` is committed to `timwuhaotian/homebrew-the-pair`

### Homebrew tap requirements

You still need a tap repository:

```text
timwuhaotian/homebrew-the-pair
```

The workflow will write `Casks/the-pair.rb` there automatically.

Important:

- The tap itself can be public while the source repository remains private.
- However, Homebrew installation only works when the release asset URL in the cask is publicly reachable.
- If `timwuhaotian/the-pair` is private, the generated cask URL will point to private release assets and `brew install --cask the-pair` will fail for normal users.
- When you are ready for public distribution, make the release source public or move assets to a separate public release repository/object store before announcing the cask.

### Manual fallback workflow

There is also a manual repair workflow:

- [update-cask.yml](/Volumes/orico/code/the-pair/.github/workflows/update-cask.yml)

Use it only if:

- the release already exists
- the brew cask needs to be regenerated or fixed

### User install command

```bash
brew tap timwuhaotian/the-pair
brew install --cask the-pair
```

### Alternative: homebrew-cask

To submit to the official `homebrew-cask`:

1. Fork [`Homebrew/homebrew-cask`](https://github.com/Homebrew/homebrew-cask)
2. Add your cask to `Casks/t/the-pair.rb`
3. Run `brew audit --cask the-pair` to ensure compliance
4. Submit a pull request

**Requirements**:

- App must be signed and notarized
- SHA256 hash must be correct
- Cask must follow [homebrew-cask guidelines](https://github.com/Homebrew/homebrew-cask/blob/master/CONTRIBUTING.md)

---

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Quick Start for Contributors

```bash
# Fork the repository
git clone https://github.com/YOUR_USERNAME/the-pair.git
cd the-pair

# Create a branch
git checkout -b feature/your-feature-name

# Make changes and commit
git commit -m "feat: add your feature"

# Push and create PR
git push origin feature/your-feature-name
```

### Development Guidelines

- **Code Style**: Follow existing patterns (Prettier + ESLint)
- **Type Safety**: Use TypeScript, avoid `any`
- **Testing**: Add tests for new features
- **Documentation**: Update README and add inline comments
- **Commits**: Use [Conventional Commits](https://www.conventionalcommits.org/)

### Reporting Issues

- Use [GitHub Issues](https://github.com/timwuhaotian/the-pair/issues)
- Include steps to reproduce
- Attach screenshots if applicable
- Specify your OS and app version

---

## 📄 License

This project is licensed under the [Apache License 2.0](LICENSE).

```
Copyright 2024 timwuhaotian

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
```

---

<div align="center">
  <p>Built with ❤️ by <a href="https://github.com/timwuhaotian">timwuhaotian</a></p>
  <p>⭐ Star this repo if you find it helpful!</p>
</div>

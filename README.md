<div align="center">
  <h1>The Pair</h1>
  <p>A desktop orchestrator for dual AI agents that collaboratively solve coding tasks</p>
  
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

**The Pair** is a desktop application that orchestrates dual AI agents working together on coding tasks. It runs two specialized agents in an automated collaboration loop:

- **Mentor Agent** — Analyzes tasks, breaks down requirements, reviews code, and provides strategic guidance (read-only)
- **Executor Agent** — Writes code, runs commands, modifies files, and implements the Mentor's instructions

Unlike traditional IDEs or single-agent tools, The Pair provides:
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

### Homebrew (macOS) — Recommended

```bash
# Add the tap
brew tap timwuhaotian/the-pair

# Install The Pair
brew install --cask the-pair
```

### Manual Download

Download the latest release from [GitHub Releases](https://github.com/timwuhaotian/the-pair/releases):

| Platform | File |
|----------|------|
| **macOS** | `the-pair-{version}.dmg` |
| **Windows** | `the-pair-{version}-setup.exe` |
| **Linux** | `the-pair-{version}.AppImage` |

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

| Layer | Technology |
|-------|------------|
| **Framework** | Electron 39 |
| **Frontend** | React 19 + TypeScript |
| **Styling** | Tailwind CSS v4 |
| **State** | Zustand |
| **Animations** | Framer Motion |
| **Icons** | Lucide React |
| **Process Monitor** | pidusage |

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
├── the-pair-1.0.0.dmg              # macOS installer
├── the-pair-1.0.0-win.exe          # Windows installer
├── the-pair-1.0.0.AppImage         # Linux AppImage
└── the-pair-1.0.0.deb              # Debian package
```

---

## 🔐 Code Signing & Notarization

### Prerequisites

1. **Apple Developer Account** — Enroll in the [Apple Developer Program](https://developer.apple.com/)

2. **Create Signing Certificate**
   ```bash
   # List available identities
   security find-identity -v -p codesigning
   
   # Or use Xcode to create certificates
   ```

3. **Create App Password** — For notarization, generate an [app-specific password](https://support.apple.com/en-us/HT204397)

### Configure electron-builder.yml

Update `electron-builder.yml` for signing:

```yaml
mac:
  identity: "Your Developer ID Application: Your Name (TEAM_ID)"
  hardenedRuntime: true
  entitlements: build/entitlements.mac.plist
  entitlementsInherit: build/entitlements.mac.plist
  notarize: true
  category: public.app-category.developer-tools
```

### Build with Signing

```bash
# Set environment variables
export CSC_NAME="Your Developer ID Application: Your Name"
export CSC_KEY_PASSWORD="your-key-password"
export CSC_LINK="path-to-certificate.p12"
export APPLE_ID="your-apple-id@example.com"
export APPLE_APP_SPECIFIC_PASSWORD="your-app-password"
export TEAM_ID="your-team-id"

# Build signed and notarized app
npm run build:mac
```

### Notarization

The build process automatically notarizes your app if `notarize: true` is set. For manual notarization:

```bash
# Notarize the DMG
xcrun notarytool submit dist/the-pair-1.0.0.dmg \
  --apple-id "your-apple-id@example.com" \
  --password "your-app-password" \
  --team-id "your-team-id" \
  --wait

# Staple the ticket
xcrun stapler staple dist/the-pair-1.0.0.dmg
```

### Verify Signature

```bash
# Check signature
codesign --verify --verbose dist/the-pair.app

# Check notarization status
spctl --assess --type exec --verbose dist/the-pair.app
```

---

## 🍺 Publishing to Homebrew

### Create Homebrew Tap

1. **Create a GitHub repository** for your tap:
   ```
   timwuhaotian/homebrew-the-pair
   ```

2. **Create the Cask file** at `Casks/the-pair.rb`:

```ruby
cask "the-pair" do
  version "1.0.0"
  sha256 "YOUR_DMG_SHA256_HASH"

  url "https://github.com/timwuhaotian/the-pair/releases/download/v#{version}/the-pair-#{version}.dmg",
      verified: "github.com/timwuhaotian/the-pair/"
  name "The Pair"
  desc "Desktop orchestrator for dual AI agents"
  homepage "https://github.com/timwuhaotian/the-pair"

  auto_updates true
  depends_on macos: ">= :monterey"

  app "the-pair.app"

  uninstall quit: "com.electron.the-pair"

  zap trash: [
    "~/.config/the-pair",
    "~/Library/Application Support/the-pair",
    "~/Library/Caches/com.electron.the-pair",
    "~/Library/Logs/the-pair",
    "~/Library/Preferences/com.electron.the-pair.plist",
    "~/Library/Saved Application State/com.electron.the-pair.savedState",
  ]
end
```

3. **Update the tap** with GitHub Actions (optional):

Create `.github/workflows/update-cask.yml`:

```yaml
name: Update Homebrew Cask

on:
  release:
    types: [published]

jobs:
  update-cask:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v4
        with:
          repository: timwuhaotian/homebrew-the-pair
          token: ${{ secrets.HOMEBREW_GITHUB_TOKEN }}
      
      - name: Update Cask
        run: |
          cd Casks
          # Update version and SHA256
          sed -i '' 's/version "[0-9.]*"/version "${{ github.event.release.tag_name }}"/' the-pair.rb
          # Calculate new SHA256
          SHA256=$(shasum -a 256 "${{ github.event.release.assets[0].browser_download_url }}")
          sed -i '' "s/sha256 \"[a-f0-9]*\"/sha256 \"$SHA256\"/" the-pair.rb
      
      - name: Commit and Push
        run: |
          git config user.name "GitHub Actions"
          git config user.email "actions@github.com"
          git add Casks/the-pair.rb
          git commit -m "Update the-pair to ${{ github.event.release.tag_name }}"
          git push
```

4. **Users can now install** via:
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

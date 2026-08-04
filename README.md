# flyWork

[English](./README.md) | [中文](./README.zh-CN.md)

A desktop productivity app for developers, built with Electron and React. Manage workspaces, automate development workflows, and integrate with AI coding agents.

## Features

### Workspace Management
- Organize projects into workspaces with custom paths
- Real-time Git status monitoring (branch, modified files, last commit)
- Quick access to workspace details and recent activity

### Git Operations
- Comprehensive Git workflow: commit, push, pull, stash, branch management
- AI-powered commit message generation using Claude Code CLI (with rule-based fallback)
- Visual branch management and checkout
- File staging/unstaging with granular control

### Automation Workflows
- Build custom automation pipelines with multi-step commands
- Dry-run mode to preview execution before applying changes
- Real-time streaming output during execution
- Built-in Git environment variables (branch, commit, author info) for use in scripts
- Action whitelist for safe, controlled execution

### AI Agent Integration
- Detect and integrate with local CLI agents: Claude Code, Codex/ChatGPT, OpenCode, Gemini
- View project-specific sessions from native agent storage
- Access conversation history and thread messages

### Command Center
- Quick access via **⌥ Space** (Alt+Space) global shortcut
- Execute common actions: open Xcode, terminal, Finder
- Run Git operations directly from the command palette

### Additional Features
- System tray integration for quick access
- Activity log with audit trail
- Inbox for collecting items
- Today view for daily focus
- Dark mode with macOS vibrancy effects

## Tech Stack

- **Electron** - Cross-platform desktop app framework
- **React 19** - UI framework
- **Vite** - Build tool and dev server
- **electron-vite** - Electron + Vite integration
- **electron-builder** - Packaging and distribution

## Project Setup

### Install Dependencies

```bash
npm install
```

### Development

```bash
npm run dev
```

This starts the app in development mode with hot reload.

### Build

```bash
# For Windows
npm run build:win

# For macOS
npm run build:mac

# For Linux
npm run build:linux
```

Build output will be in the `dist` directory.

## Data Storage

Application data is stored in `~/.flywork/`:
- `data.json` - Workspaces, sessions, and app state
- `audit.log` - Activity and automation execution logs

## Keyboard Shortcuts

- **⌥ Space** - Open Command Center

## Recommended IDE Setup

- [VSCode](https://code.visualstudio.com/) + [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) + [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)

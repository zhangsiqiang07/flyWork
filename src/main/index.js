import {
  app,
  shell,
  BrowserWindow,
  ipcMain,
  Tray,
  Menu,
  globalShortcut,
  nativeTheme,
  Notification,
  dialog
} from 'electron'
import { join } from 'path'
import { spawn, exec } from 'child_process'
import { promisify } from 'util'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { writeFileSync, readFileSync, existsSync, mkdirSync, readdirSync } from 'fs'
import { homedir } from 'os'

const execAsync = promisify(exec)

// Audit log path
const AUDIT_LOG_PATH = join(homedir(), '.flywork', 'audit.log')
const DATA_PATH = join(homedir(), '.flywork', 'data.json')

// Ensure data dir exists
function ensureDataDir() {
  const dir = join(homedir(), '.flywork')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
}

// Action whitelist registry - only these actions can be executed
const ACTION_REGISTRY = {
  'open-xcode': {
    name: '打开 Xcode',
    risk: 'readonly',
    command: ['open', ['-a', 'Xcode']],
    dryRunOutput: '将执行: open -a Xcode'
  },
  'git-status': {
    name: 'Git 状态',
    risk: 'readonly',
    command: ['git', ['status']],
    dryRunOutput: '将执行: git status'
  },
  'git-pull': {
    name: '同步远程代码',
    risk: 'modify',
    command: ['git', ['pull', '--rebase']],
    dryRunOutput: '将执行: git pull --rebase'
  },
  'git-log': {
    name: '查看提交历史',
    risk: 'readonly',
    command: ['git', ['log', '--oneline', '-10']],
    dryRunOutput: '将执行: git log --oneline -10'
  },
  'run-tests': {
    name: '运行单元测试',
    risk: 'normal',
    command: ['xcodebuild', ['test', '-scheme', 'PetPal', '-destination', 'platform=iOS Simulator,name=iPhone 15']],
    dryRunOutput: '将执行: xcodebuild test -scheme PetPal ...'
  },
  'open-terminal': {
    name: '打开终端',
    risk: 'readonly',
    command: ['open', ['-a', 'Terminal']],
    dryRunOutput: '将执行: open -a Terminal'
  },
  'open-finder': {
    name: '打开 Finder',
    risk: 'readonly',
    command: ['open', ['.']],
    dryRunOutput: '将执行: open .'
  }
}

let mainWindow = null
let tray = null
let commandCenterWindow = null

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
    vibrancy: 'under-window',
    visualEffectState: 'active',
    backgroundColor: '#0d1117',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
    mainWindow.focus()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return mainWindow
}

function setupTray() {
  // Use a simple template icon for tray
  try {
    const { nativeImage } = require('electron')
    const icon = nativeImage.createFromDataURL(
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAAdgAAAHYBTnsmCAAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAAFUSURBVDiNpZM9SwNBEIafvYuXkIuQQixyECwEwcJCsLKwECwEwcJCsPAHWFhYWFhYWFhYWFhY+BcsBMHCQrCwECwsBAsLwcJCsLAQLCwECwvBwkKwsBAsLAQLC8HCQrCwECwsBAsLwcJCsLAQLCwECwvBwkKwsBAsLAQLCwHCQrCwECwsBAsLwcJCsLAQLCwECwvBwkKwsBAsLAQLCwHCQrCwECwsBAsLwcJCsLAQLCwECwvBwkKwsBAsLAQLCwHCQrCwECwsBAsLwcJCsLAQLCwECwvBwkKwsBAsLAQLCwHCQrCwECwsBAsLwcJCsLAQLCwECwvBwkKwsBAsLAQLCwHCQrCwECwsBAsLwcJCsLAQLCwECwvBwkKwsBAsLAQLCwHCQrCwECwsBAsLwcJCsLAQLCwECwvBwkKwsBAsLAQLCwHCQrCwECwsBAsLwcJCsLAQLCwECwvBwkKwsBAsLAQLCwH/A3QDAtCrHXoAAAAASUVORK5CYII='
    )
    tray = new Tray(icon)
  } catch {
    // Tray creation may fail if no icon, continue without it
    return
  }

  const contextMenu = Menu.buildFromTemplate([
    { label: 'flyWork', enabled: false },
    { type: 'separator' },
    { label: '显示主窗口', click: () => mainWindow?.show() },
    { label: '今日视图', click: () => { mainWindow?.show(); mainWindow?.webContents.send('navigate', 'today') } },
    { type: 'separator' },
    { label: '退出 flyWork', role: 'quit' }
  ])

  tray.setToolTip('flyWork')
  tray.setContextMenu(contextMenu)
  tray.on('click', () => {
    if (mainWindow?.isVisible()) {
      mainWindow.focus()
    } else {
      mainWindow?.show()
    }
  })
}

function setupGlobalShortcuts() {
  // ⌥ Space - Command Center
  const registered = globalShortcut.register('Alt+Space', () => {
    if (mainWindow) {
      mainWindow.show()
      mainWindow.focus()
      mainWindow.webContents.send('toggle-command-center')
    }
  })

  if (!registered) {
    console.log('Alt+Space shortcut registration failed')
  }
}

function writeAuditLog(entry) {
  ensureDataDir()
  const line = JSON.stringify({
    timestamp: new Date().toISOString(),
    ...entry
  }) + '\n'
  try {
    const { appendFileSync } = require('fs')
    appendFileSync(AUDIT_LOG_PATH, line)
  } catch (e) {
    console.error('Audit log error:', e)
  }
}

function setupIPC() {
  // Execute a whitelisted action
  ipcMain.handle('execute-action', async (_, { actionId, workdir, dryRun }) => {
    const action = ACTION_REGISTRY[actionId]
    if (!action) {
      writeAuditLog({ type: 'BLOCKED', actionId, reason: 'Not in whitelist' })
      return { success: false, error: `动作 "${actionId}" 不在白名单中，已拒绝执行` }
    }

    writeAuditLog({ type: dryRun ? 'DRY_RUN' : 'EXECUTE', actionId, name: action.name, workdir })

    if (dryRun) {
      return {
        success: true,
        dryRun: true,
        output: action.dryRunOutput || `将执行: ${action.command[0]} ${action.command[1].join(' ')}`
      }
    }

    return new Promise((resolve) => {
      const [cmd, args] = action.command
      const cwd = workdir || homedir()
      const output = []
      const errors = []

      try {
        const proc = spawn(cmd, args, { cwd, shell: false })

        proc.stdout?.on('data', (data) => output.push(data.toString()))
        proc.stderr?.on('data', (data) => errors.push(data.toString()))

        proc.on('close', (code) => {
          const result = {
            success: code === 0,
            exitCode: code,
            output: output.join(''),
            error: errors.join('')
          }
          writeAuditLog({ type: 'RESULT', actionId, exitCode: code, success: code === 0 })
          resolve(result)
        })

        proc.on('error', (err) => {
          resolve({ success: false, error: err.message })
        })
      } catch (err) {
        resolve({ success: false, error: err.message })
      }
    })
  })

  // Get audit log
  ipcMain.handle('get-audit-log', async () => {
    ensureDataDir()
    try {
      if (!existsSync(AUDIT_LOG_PATH)) return []
      const content = readFileSync(AUDIT_LOG_PATH, 'utf-8')
      return content.trim().split('\n').filter(Boolean).map(l => {
        try { return JSON.parse(l) } catch { return null }
      }).filter(Boolean).reverse().slice(0, 100)
    } catch {
      return []
    }
  })

  // Persist app data (workspaces, sessions, inbox, etc.)
  ipcMain.handle('save-data', async (_, data) => {
    ensureDataDir()
    try {
      writeFileSync(DATA_PATH, JSON.stringify(data, null, 2))
      return { success: true }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })

  // Load app data
  ipcMain.handle('load-data', async () => {
    ensureDataDir()
    try {
      if (!existsSync(DATA_PATH)) return null
      const content = readFileSync(DATA_PATH, 'utf-8')
      return JSON.parse(content)
    } catch {
      return null
    }
  })

  // Open file/folder
  ipcMain.handle('open-path', async (_, path) => {
    try {
      await shell.openPath(path)
      return { success: true }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })

  // Open external URL
  ipcMain.handle('open-url', async (_, url) => {
    await shell.openExternal(url)
    return { success: true }
  })

  // Show native notification
  ipcMain.handle('notify', async (_, { title, body }) => {
    new Notification({ title, body }).show()
    return { success: true }
  })

  // Show open directory dialog
  ipcMain.handle('show-open-dialog', async (_, options) => {
    const result = await dialog.showOpenDialog(mainWindow, options || {
      properties: ['openDirectory']
    })
    return result
  })

  // Get action registry (for UI display)
  ipcMain.handle('get-actions', async () => {
    return Object.entries(ACTION_REGISTRY).map(([id, action]) => ({
      id,
      name: action.name,
      risk: action.risk,
      dryRunOutput: action.dryRunOutput
    }))
  })

  // Get real Git info for a workspace directory (async non-blocking)
  ipcMain.handle('get-git-info', async (_, workdir) => {
    if (!workdir || !existsSync(workdir)) {
      return { isGit: false, gitBranch: '无', gitModifiedFiles: [], lastCommit: '目录不存在', lastCommitHash: '', lastCommitTime: '' }
    }
    try {
      const [branchRes, statusRes, logRes] = await Promise.allSettled([
        execAsync('git branch --show-current', { cwd: workdir, timeout: 3000, encoding: 'utf-8' }),
        execAsync('git status --porcelain', { cwd: workdir, timeout: 5000, encoding: 'utf-8' }),
        execAsync('git log -1 --pretty=format:"%h|%s|%cr"', { cwd: workdir, timeout: 3000, encoding: 'utf-8' })
      ])

      const branch = (branchRes.status === 'fulfilled' ? branchRes.value.stdout : '').trim() || 'HEAD'
      const statusOutput = (statusRes.status === 'fulfilled' ? statusRes.value.stdout : '').trim()
      const modifiedFiles = statusOutput ? statusOutput.split('\n').filter(Boolean).map((line) => {
        const status = line.slice(0, 2).trim()
        const path = line.slice(3).trim()
        return { status: status || 'M', path }
      }) : []

      let lastCommit = '未提交'
      let lastCommitHash = ''
      let lastCommitTime = ''
      if (logRes.status === 'fulfilled' && logRes.value.stdout) {
        const parts = logRes.value.stdout.trim().split('|')
        lastCommitHash = parts[0] || ''
        lastCommit = parts[1] || '提交记录'
        lastCommitTime = parts[2] || ''
      }

      return {
        isGit: true,
        gitBranch: branch,
        gitModifiedFiles: modifiedFiles,
        lastCommit,
        lastCommitHash,
        lastCommitTime
      }
    } catch {
      return { isGit: false, gitBranch: '无', gitModifiedFiles: [], lastCommit: '非 Git 仓库', lastCommitHash: '', lastCommitTime: '' }
    }
  })

  // Get branches list (async, non-blocking local query)
  ipcMain.handle('git-get-branches', async (_, workdir) => {
    if (!workdir || !existsSync(workdir)) return { current: 'main', branches: [] }
    try {
      const [branchRes, outputRes] = await Promise.all([
        execAsync('git branch --show-current', { cwd: workdir, timeout: 3000, encoding: 'utf-8' }),
        execAsync('git branch -a', { cwd: workdir, timeout: 4000, encoding: 'utf-8' })
      ])
      const current = branchRes.stdout.trim() || 'HEAD'
      const lines = outputRes.stdout.split('\n').filter(Boolean)
      const branches = []
      const seenNames = new Set()

      for (let line of lines) {
        const trimmed = line.trim()
        if (trimmed.includes('->')) continue // Skip HEAD refs like origin/HEAD -> origin/main
        const isCurrent = trimmed.startsWith('*')
        let rawName = trimmed.replace(/^\*\s*/, '').trim()
        let cleanName = rawName
        if (cleanName.startsWith('remotes/')) {
          cleanName = cleanName.replace('remotes/', '')
        }
        if (!cleanName || seenNames.has(cleanName)) continue
        seenNames.add(cleanName)
        branches.push({
          name: cleanName,
          isCurrent,
          isRemote: cleanName.startsWith('origin/')
        })
      }

      return { current, branches }
    } catch (err) {
      return { current: 'main', branches: [], error: err.message }
    }
  })

  // Checkout branch
  ipcMain.handle('git-checkout', async (_, { workdir, branch }) => {
    try {
      const { execSync } = require('child_process')
      let target = branch.trim()
      if (target.startsWith('origin/')) {
        const localName = target.replace('origin/', '')
        try {
          execSync(`git checkout "${localName}"`, { cwd: workdir, timeout: 5000, encoding: 'utf-8' })
        } catch {
          execSync(`git checkout -b "${localName}" "${target}"`, { cwd: workdir, timeout: 5000, encoding: 'utf-8' })
        }
        target = localName
      } else {
        execSync(`git checkout "${target}"`, { cwd: workdir, timeout: 5000, encoding: 'utf-8' })
      }
      writeAuditLog({ type: 'EXECUTE', actionId: 'git-checkout', name: `切换分支至 ${target}`, workdir })
      return { success: true, output: `✓ 已成功切换至 ${target}` }
    } catch (err) {
      return { success: false, error: err.stderr || err.message }
    }
  })

  // Create & checkout new branch
  ipcMain.handle('git-create-branch', async (_, { workdir, newBranch, baseBranch }) => {
    try {
      const { execSync } = require('child_process')
      const base = baseBranch || 'HEAD'
      const res = execSync(`git checkout -b "${newBranch}" "${base}"`, { cwd: workdir, timeout: 5000, encoding: 'utf-8' })
      writeAuditLog({ type: 'EXECUTE', actionId: 'git-create-branch', name: `基于 ${base} 创建分支 ${newBranch}`, workdir })
      return { success: true, output: res }
    } catch (err) {
      return { success: false, error: err.stderr || err.message }
    }
  })

  // Detect local CLI agents (Claude Code, Codex, OpenCode, Gemini, etc.)
  ipcMain.handle('detect-local-agents', async () => {
    const checkCli = (cmd) => {
      try {
        const { execSync } = require('child_process')
        const extraPaths = `${homedir()}/.local/bin:${homedir()}/.opencode/bin:${homedir()}/.nvm/versions/node/v24.12.0/bin:/usr/local/bin`
        const pathEnv = `${extraPaths}:${process.env.PATH || ''}`
        const binPath = execSync(`which ${cmd} 2>/dev/null || command -v ${cmd} 2>/dev/null`, {
          env: { ...process.env, PATH: pathEnv },
          timeout: 2000,
          encoding: 'utf-8'
        }).trim()
        return { installed: Boolean(binPath), path: binPath || null }
      } catch {
        return { installed: false, path: null }
      }
    }

    return {
      claude: checkCli('claude'),
      codex: checkCli('codex'),
      opencode: checkCli('opencode'),
      gemini: checkCli('gemini')
    }
  })

  // Get project sessions from native agent storage (Claude Code / Codex / ChatGPT)
  ipcMain.handle('get-agent-project-sessions', async (_, { agent, projectPath, workspaceName }) => {
    if (!projectPath && !workspaceName) return []
    const sessions = []
    const seenThreadIds = new Set()

    // 1. ChatGPT / Codex native parser
    if (!agent || agent.toLowerCase().includes('codex') || agent.toLowerCase().includes('chatgpt')) {
      const globStatePath = join(homedir(), '.codex', '.codex-global-state.json')
      const sessIndexPath = join(homedir(), '.codex', 'session_index.jsonl')

      if (existsSync(globStatePath) && existsSync(sessIndexPath)) {
        try {
          const globData = JSON.parse(readFileSync(globStatePath, 'utf-8'))
          const projects = globData['local-projects'] || {}
          const threadAssigns = globData['thread-project-assignments'] || {}
          const threadTitles = globData['thread-titles'] || {}
          const sidebarOrders = globData['sidebar-project-thread-orders'] || {}

          // Find target project ID in Codex
          let matchedProjectId = null
          Object.values(projects).forEach((p) => {
            if (
              (workspaceName && p.name === workspaceName) ||
              (projectPath && p.rootPaths && p.rootPaths.some((rp) => rp === projectPath || projectPath.endsWith(rp.split('/').pop())))
            ) {
              matchedProjectId = p.id
            }
          })

          const indexMap = {}
          const lines = readFileSync(sessIndexPath, 'utf-8').split('\n').filter(Boolean)
          lines.forEach((l) => {
            try {
              const item = JSON.parse(l)
              indexMap[item.id] = item
            } catch {}
          })

          const targetThreadIds = new Set()

          // A) Thread IDs from sidebarOrders (contains all 180+ threads for project)
          if (matchedProjectId && sidebarOrders[matchedProjectId]?.threadIds) {
            sidebarOrders[matchedProjectId].threadIds.forEach((id) => targetThreadIds.add(id))
          }

          // B) Thread IDs from threadAssigns
          Object.entries(threadAssigns).forEach(([tId, assign]) => {
            if (assign && (assign.projectId === matchedProjectId || (assign.cwd && projectPath && assign.cwd === projectPath))) {
              targetThreadIds.add(tId)
            }
          })

          // C) Fallback scan in session_index
          lines.forEach((l) => {
            try {
              const item = JSON.parse(l)
              if (item.thread_name && workspaceName && item.thread_name.includes(workspaceName)) {
                targetThreadIds.add(item.id)
              }
            } catch {}
          })

          targetThreadIds.forEach((tId) => {
            if (seenThreadIds.has(tId)) return
            seenThreadIds.add(tId)

            const item = indexMap[tId] || {}
            const title = threadTitles[tId] || item.thread_name
            if (!title) return

            const dateObj = item.updated_at ? new Date(item.updated_at) : new Date(0)
            sessions.push({
              sessionId: tId,
              agent: 'ChatGPT / Codex',
              summary: title,
              updatedAt: item.updated_at ? new Date(item.updated_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : '历史',
              rawTimestamp: dateObj.getTime(),
              isMatched: true
            })
          })
        } catch (err) {
          console.error('Failed to parse Codex state:', err)
        }
      }
    }

    // 2. Claude Code native parser
    if (!agent || agent.toLowerCase().includes('claude')) {
      const claudeHist = join(homedir(), '.claude', 'history.jsonl')
      if (existsSync(claudeHist)) {
        try {
          const lines = readFileSync(claudeHist, 'utf-8').split('\n').filter(Boolean)
          lines.reverse().forEach((line) => {
            try {
              const item = JSON.parse(line)
              const p = item.project || ''
              const isMatched =
                (projectPath && (p === projectPath || projectPath.endsWith(p.split('/').pop()))) ||
                (workspaceName && p.includes(workspaceName))

              if (isMatched) {
                const sId = item.sessionId || item.timestamp
                if (sId && !seenThreadIds.has(sId)) {
                  seenThreadIds.add(sId)
                  const dateObj = item.timestamp ? new Date(item.timestamp) : new Date(0)
                  sessions.push({
                    sessionId: String(sId),
                    agent: 'Claude Code',
                    summary: typeof item.display === 'string' && item.display.length > 2 && item.display !== 'user' ? item.display.slice(0, 50) : `Claude Code 会话 ${String(sId).slice(0, 6)}`,
                    updatedAt: item.timestamp ? new Date(item.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : '最近',
                    rawTimestamp: dateObj.getTime(),
                    isMatched: true
                  })
                }
              }
            } catch {}
          })
        } catch {}
      }
    }

    // Sort strictly by rawTimestamp descending (100% matches ChatGPT App Sidebar order)
    return sessions.sort((a, b) => b.rawTimestamp - a.rawTimestamp)
  })

  // Get full messages for a specific native agent session/thread
  ipcMain.handle('get-native-thread-messages', async (_, { sessionId }) => {
    if (!sessionId) return []
    const messages = []

    // Helper recursive search
    const findFile = (dir, targetId) => {
      if (!existsSync(dir)) return null
      try {
        const entries = readdirSync(dir, { withFileTypes: true })
        for (const entry of entries) {
          const fullPath = join(dir, entry.name)
          if (entry.isDirectory()) {
            const found = findFile(fullPath, targetId)
            if (found) return found
          } else if (entry.name.includes(targetId)) {
            return fullPath
          }
        }
      } catch {}
      return null
    }

    // 1. Search in ~/.codex/sessions
    const codexSessDir = join(homedir(), '.codex', 'sessions')
    const foundCodexFile = findFile(codexSessDir, sessionId)
    if (foundCodexFile) {
      try {
        const content = readFileSync(foundCodexFile, 'utf-8')
        content.split('\n').filter(Boolean).forEach((line) => {
          try {
            const item = JSON.parse(line)
            if (item.type === 'event_msg' && item.payload) {
              const pType = item.payload.type
              if (pType === 'user_message' || pType === 'agent_message') {
                const role = pType === 'user_message' ? 'user' : 'assistant'
                const text = item.payload.message || item.payload.text || item.payload.content || ''
                if (text && typeof text === 'string') {
                  messages.push({
                    role,
                    content: text,
                    time: item.payload.timestamp ? new Date(item.payload.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : ''
                  })
                }
              }
            }
          } catch {}
        })
      } catch {}
      if (messages.length > 0) return messages
    }

    // 2. Search in ~/.claude/history.jsonl
    const claudeHist = join(homedir(), '.claude', 'history.jsonl')
    if (existsSync(claudeHist)) {
      try {
        const content = readFileSync(claudeHist, 'utf-8')
        content.split('\n').filter(Boolean).forEach((line) => {
          try {
            const item = JSON.parse(line)
            if (item.sessionId === sessionId || String(item.timestamp) === sessionId) {
              if (item.display && item.display !== 'status') {
                const role = item.display === 'assistant' || item.display === 'model' ? 'assistant' : 'user'
                const text = typeof item.display === 'string' ? item.display : `命令记录`
                messages.push({
                  role,
                  content: text,
                  time: item.timestamp ? new Date(item.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : ''
                })
              }
            }
          } catch {}
        })
      } catch {}
    }

    return messages
  })

  // Generate AI Commit preview (Conventional Commit)
  ipcMain.handle('git-ai-commit-preview', async (_, workdir) => {
    try {
      const { execSync } = require('child_process')
      const status = execSync('git status --short --untracked-files=all', { cwd: workdir, timeout: 3000, encoding: 'utf-8' }).trim()
      if (!status) {
        return { success: false, error: '没有需要提交的未提交改动 (Working tree clean)' }
      }
      const diffStat = execSync('git diff --stat HEAD', { cwd: workdir, timeout: 3000, encoding: 'utf-8' }).trim()
      
      // Check if local Claude CLI is available
      const extraPaths = `${homedir()}/.local/bin:${homedir()}/.opencode/bin:${homedir()}/.nvm/versions/node/v24.12.0/bin:/usr/local/bin`
      const pathEnv = `${extraPaths}:${process.env.PATH || ''}`

      let claudeBin = ''
      try {
        claudeBin = execSync('which claude 2>/dev/null || command -v claude 2>/dev/null', { env: { ...process.env, PATH: pathEnv }, timeout: 1500, encoding: 'utf-8' }).trim()
      } catch {
        // Ignored
      }

      if (claudeBin) {
        try {
          const prompt = '你是一名资深工程师。请根据标准输入中的 Git 改动生成一条准确的中文提交信息。\n要求：使用 Conventional Commits 格式，格式为 type(scope): 中文标题。\ntype 只允许 feat、fix、refactor、perf、docs、test、build、ci、chore、style。\n只输出最终可以直接传给 git commit 的文字，不要使用 Markdown 代码块。'
          const diffContext = execSync('git diff HEAD --stat && git status --short', { cwd: workdir, timeout: 3000, encoding: 'utf-8' })
          const aiMsg = execSync(`echo ${JSON.stringify(diffContext)} | "${claudeBin}" -p ${JSON.stringify(prompt)} --output-format text --max-turns 1`, {
            cwd: workdir,
            env: { ...process.env, PATH: pathEnv },
            timeout: 10000,
            encoding: 'utf-8'
          }).trim()

          if (aiMsg) {
            return { success: true, commitMessage: aiMsg, diffStat, engine: 'Claude Code CLI' }
          }
        } catch {
          // Fallback to rule engine
        }
      }

      // Rule-based fallback
      const lines = status.split('\n')
      let type = 'feat'
      let scope = ''
      const filePaths = lines.map(l => l.slice(3).trim())
      
      if (filePaths.every(f => f.includes('test') || f.includes('spec'))) {
        type = 'test'
      } else if (filePaths.every(f => f.endsWith('.md') || f.includes('doc'))) {
        type = 'docs'
      } else if (filePaths.every(f => f.includes('config') || f.endsWith('.json') || f.endsWith('.lock'))) {
        type = 'chore'
      } else if (filePaths.some(f => f.includes('fix') || f.includes('bug'))) {
        type = 'fix'
      } else if (lines.some(l => l.startsWith('M '))) {
        type = 'feat'
      }

      if (filePaths.some(f => f.includes('views/'))) scope = 'views'
      else if (filePaths.some(f => f.includes('components/'))) scope = 'components'
      else if (filePaths.some(f => f.includes('main/'))) scope = 'main'
      else if (filePaths.some(f => f.includes('preload/'))) scope = 'preload'

      const scopePart = scope ? `(${scope})` : ''
      const mainFilesText = filePaths.slice(0, 3).map(f => f.split('/').pop()).join('、')
      const commitTitle = `${type}${scopePart}: 更新 ${mainFilesText} 相关的逻辑`
      const bodyLines = filePaths.slice(0, 5).map(f => `- 更改与调整 ${f}`)
      const commitMessage = `${commitTitle}\n\n${bodyLines.join('\n')}`

      return { success: true, commitMessage, diffStat, engine: 'Local Rule Engine' }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })

  // Commit changes
  ipcMain.handle('git-commit', async (_, { workdir, message, stageAll = true }) => {
    try {
      const { execSync } = require('child_process')
      if (stageAll) {
        execSync('git add -A', { cwd: workdir, timeout: 5000, encoding: 'utf-8' })
      }
      const res = execSync(`git commit -m ${JSON.stringify(message)}`, { cwd: workdir, timeout: 5000, encoding: 'utf-8' })
      writeAuditLog({ type: 'EXECUTE', actionId: 'git-commit', name: `提交代码: ${message.split('\n')[0]}`, workdir })
      return { success: true, output: res }
    } catch (err) {
      return { success: false, error: err.stderr || err.message }
    }
  })

  // Push code
  ipcMain.handle('git-push', async (_, { workdir, remote = 'origin' }) => {
    try {
      const { execSync } = require('child_process')
      const branch = execSync('git branch --show-current', { cwd: workdir, timeout: 2000, encoding: 'utf-8' }).trim() || 'main'
      const res = execSync(`git push ${remote} ${branch} || git push -u ${remote} ${branch}`, { cwd: workdir, timeout: 15000, encoding: 'utf-8' })
      writeAuditLog({ type: 'EXECUTE', actionId: 'git-push', name: `推送代码至 ${remote}/${branch}`, workdir })
      return { success: true, output: res || '✓ 推送成功' }
    } catch (err) {
      return { success: false, error: err.stderr || err.message }
    }
  })

  // Pull code
  ipcMain.handle('git-pull', async (_, { workdir, remote = 'origin' }) => {
    try {
      const { execSync } = require('child_process')
      const res = execSync(`git pull ${remote} --rebase`, { cwd: workdir, timeout: 15000, encoding: 'utf-8' })
      writeAuditLog({ type: 'EXECUTE', actionId: 'git-pull', name: `从 ${remote} 拉取更新`, workdir })
      return { success: true, output: res || '✓ 已是最新代码' }
    } catch (err) {
      return { success: false, error: err.stderr || err.message }
    }
  })

  // Stash & Stash Pop
  ipcMain.handle('git-stash', async (_, { workdir, message }) => {
    try {
      const { execSync } = require('child_process')
      const msg = message ? `"${message}"` : ''
      const res = execSync(`git stash push -u -m ${msg}`, { cwd: workdir, timeout: 5000, encoding: 'utf-8' })
      writeAuditLog({ type: 'EXECUTE', actionId: 'git-stash', name: `挂起工作区代码 (${msg})`, workdir })
      return { success: true, output: res }
    } catch (err) {
      return { success: false, error: err.stderr || err.message }
    }
  })

  ipcMain.handle('git-stash-pop', async (_, workdir) => {
    try {
      const { execSync } = require('child_process')
      const res = execSync('git stash pop', { cwd: workdir, timeout: 5000, encoding: 'utf-8' })
      writeAuditLog({ type: 'EXECUTE', actionId: 'git-stash-pop', name: '恢复挂起的代码 (Stash Pop)', workdir })
      return { success: true, output: res }
    } catch (err) {
      return { success: false, error: err.stderr || err.message }
    }
  })

  // Discard changes
  ipcMain.handle('git-discard', async (_, { workdir, file }) => {
    try {
      const { execSync } = require('child_process')
      if (file) {
        execSync(`git checkout -- "${file}" || git clean -fd "${file}"`, { cwd: workdir, timeout: 5000, encoding: 'utf-8' })
      } else {
        execSync('git checkout -- . && git clean -fd', { cwd: workdir, timeout: 5000, encoding: 'utf-8' })
      }
      writeAuditLog({ type: 'EXECUTE', actionId: 'git-discard', name: `放弃修改: ${file || '全部文件'}`, workdir })
      return { success: true }
    } catch (err) {
      return { success: false, error: err.stderr || err.message }
    }
  })

  // Stage & Unstage single file
  ipcMain.handle('git-stage-file', async (_, { workdir, file }) => {
    try {
      const { execSync } = require('child_process')
      execSync(`git add "${file}"`, { cwd: workdir, timeout: 3000, encoding: 'utf-8' })
      return { success: true }
    } catch (err) {
      return { success: false, error: err.stderr || err.message }
    }
  })

  ipcMain.handle('git-unstage-file', async (_, { workdir, file }) => {
    try {
      const { execSync } = require('child_process')
      execSync(`git restore --staged "${file}" || git reset HEAD "${file}"`, { cwd: workdir, timeout: 3000, encoding: 'utf-8' })
      return { success: true }
    } catch (err) {
      return { success: false, error: err.stderr || err.message }
    }
  })

  // Get recent 20 commits log (async non-blocking)
  ipcMain.handle('git-get-log', async (_, workdir) => {
    if (!workdir || !existsSync(workdir)) return []
    try {
      const { stdout } = await execAsync('git log -20 --pretty=format:"%h|%s|%an|%cr|%d"', { cwd: workdir, timeout: 5000, encoding: 'utf-8' })
      const logOutput = stdout.trim()
      if (!logOutput) return []
      return logOutput.split('\n').filter(Boolean).map((line) => {
        const [hash, subject, author, time, refs] = line.split('|')
        return { hash, subject, author, time, refs: refs ? refs.trim() : '' }
      })
    } catch {
      return []
    }
  })
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.flywork.app')
  nativeTheme.themeSource = 'dark'

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  ensureDataDir()
  createMainWindow()
  setupTray()
  setupGlobalShortcuts()
  setupIPC()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
    else mainWindow?.show()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})

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
import { spawn, exec, execFileSync, execSync } from 'child_process'
import { promisify } from 'util'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { writeFileSync, readFileSync, existsSync, mkdirSync, readdirSync } from 'fs'
import { homedir } from 'os'

// 云效服务模块
import {
  storeToken,
  getStoredToken,
  deleteStoredToken,
  hasStoredToken,
  validateToken,
  getConfig,
  storeConfig,
  setCurrentOrganization,
  getCurrentOrganizationId
} from './services/yunxiao/auth.js'
import {
  listOrganizations,
  searchMembers,
  getMember,
  getOrganization
} from './services/yunxiao/organization.js'
import {
  searchProjects,
  getProject,
  listProjectMembers,
  createProject,
  listProjects
} from './services/yunxiao/project.js'
import {
  listWorkitems,
  getWorkitem,
  getWorkitemImage,
  createWorkitem,
  updateWorkitemField,
  listWorkitemFields,
  listWorkflowStatuses,
  createWorkitemComment,
  listWorkitemComments,
  listWorkitemAttachments,
  listProjectWorkitemTypes
} from './services/yunxiao/workitem.js'
import {
  listSprints,
  getSprintInfo,
  createSprint,
  updateSprint
} from './services/yunxiao/sprint.js'

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
    command: [
      'xcodebuild',
      ['test', '-scheme', 'PetPal', '-destination', 'platform=iOS Simulator,name=iPhone 15']
    ],
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
let workitemDetailWindow = null
const activeAutomationProcesses = new Map()

function openWorkitemDetailWindow(workitemId) {
  if (!workitemId) throw new Error('未指定工作项')
  if (workitemDetailWindow && !workitemDetailWindow.isDestroyed()) workitemDetailWindow.close()

  workitemDetailWindow = new BrowserWindow({
    width: 820,
    height: 760,
    minWidth: 620,
    minHeight: 480,
    title: '云效工作项详情',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
    backgroundColor: '#0d1117',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })
  workitemDetailWindow.on('closed', () => {
    workitemDetailWindow = null
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    const detailUrl = new URL(process.env['ELECTRON_RENDERER_URL'])
    detailUrl.searchParams.set('workitemDetail', workitemId)
    workitemDetailWindow.loadURL(detailUrl.toString())
  } else {
    workitemDetailWindow.loadFile(join(__dirname, '../renderer/index.html'), {
      query: { workitemDetail: workitemId }
    })
  }
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false,
    title: 'FlyDeck',
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
    { label: 'FlyDeck', enabled: false },
    { type: 'separator' },
    { label: '显示主窗口', click: () => mainWindow?.show() },
    {
      label: '今日视图',
      click: () => {
        mainWindow?.show()
        mainWindow?.webContents.send('navigate', 'today')
      }
    },
    { type: 'separator' },
    { label: '退出 FlyDeck', role: 'quit' }
  ])

  tray.setToolTip('FlyDeck')
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
  const line =
    JSON.stringify({
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

function getBuiltinGitEnv(workdir) {
  if (!workdir || !existsSync(workdir))
    return { PROJECT_DIR: workdir || '', WORKSPACE_ROOT: workdir || '' }
  try {
    const opts = { cwd: workdir, encoding: 'utf-8', timeout: 3000 }
    const branch = execSync('git rev-parse --abbrev-ref HEAD 2>/dev/null', opts).trim() || 'main'
    const commitHash = execSync('git rev-parse HEAD 2>/dev/null', opts).trim() || ''
    const shortSha = execSync('git rev-parse --short HEAD 2>/dev/null', opts).trim() || ''
    const commitMsg = execSync('git log -1 --pretty=format:"%s" 2>/dev/null', opts).trim() || ''
    const author = execSync('git log -1 --pretty=format:"%an" 2>/dev/null', opts).trim() || ''
    const authorEmail = execSync('git log -1 --pretty=format:"%ae" 2>/dev/null', opts).trim() || ''
    const isDirty =
      execSync('git status --porcelain 2>/dev/null', opts).trim().length > 0 ? 'true' : 'false'

    return {
      GIT_BRANCH: branch,
      GIT_COMMIT: commitHash,
      GIT_COMMIT_HASH: commitHash,
      GIT_SHA: commitHash,
      GIT_SHORT_SHA: shortSha,
      GIT_COMMIT_MSG: commitMsg,
      GIT_COMMIT_MESSAGE: commitMsg,
      GIT_AUTHOR: author,
      GIT_AUTHOR_EMAIL: authorEmail,
      GIT_DIRTY: isDirty,
      PROJECT_DIR: workdir,
      WORKSPACE_ROOT: workdir
    }
  } catch {
    return {
      PROJECT_DIR: workdir || '',
      WORKSPACE_ROOT: workdir || ''
    }
  }
}

function setupIPC() {
  // Execute custom automation step (with real-time streaming log output)
  ipcMain.handle(
    'execute-automation-step',
    async (event, { command, workdir, customEnv = {}, dryRun, stepKey }) => {
      const sender = event.sender

      // Helper to send a log chunk to renderer
      const sendChunk = (type, text) => {
        if (!sender.isDestroyed()) {
          sender.send('automation-log-chunk', { stepKey, type, text, ts: Date.now() })
        }
      }

      // Never silently fall back to the home directory. A misplaced command is
      // more dangerous than a failed command, especially for Git operations.
      if (!workdir) {
        const error = '自动化流程未绑定有效工作区，已阻止执行。请在编辑自动化流程时关联一个工作区。'
        sendChunk('stderr', `❌ ${error}`)
        return { success: false, exitCode: -1, output: '', error }
      }
      if (!existsSync(workdir)) {
        const error = `工作区目录不存在：${workdir}\n已阻止执行；请在“工作区”中更新该目录后重试。`
        sendChunk('stderr', `❌ ${error}`)
        return { success: false, exitCode: -1, output: '', error }
      }

      const cwd = workdir

      const builtinGitEnv = getBuiltinGitEnv(cwd)
      const combinedEnv = {
        ...process.env,
        ...builtinGitEnv,
        ...(customEnv || {}),
        PATH: `${process.env.PATH}:/usr/local/bin:/opt/homebrew/bin`
      }

      writeAuditLog({
        type: dryRun ? 'AUTOMATION_DRY_RUN' : 'AUTOMATION_EXECUTE',
        command,
        workdir: cwd,
        envKeys: Object.keys(customEnv || {})
      })

      sendChunk('info', `[工作目录] ${cwd}\n`)

      if (dryRun) {
        const gitInfoStr = Object.entries(builtinGitEnv)
          .map(([k, v]) => `  ${k}="${v}"`)
          .join('\n')
        const customEnvStr =
          Object.entries(customEnv || {})
            .map(([k, v]) => `  ${k}="${v}"`)
            .join('\n') || '  (无自定义环境变量)'
        const dryOutput = [
          `[Dry Run 预演模式]`,
          `工作目录: ${cwd}`,
          ``,
          `内置 Git 环境变量:\n${gitInfoStr}`,
          ``,
          `自定义环境变量:\n${customEnvStr}`,
          ``,
          `即将在 Shell 中执行指令:\n$ ${command}`
        ].join('\n')
        sendChunk('stdout', dryOutput)
        return {
          success: true,
          dryRun: true,
          exitCode: 0,
          output: dryOutput,
          error: '',
          gitEnv: builtinGitEnv
        }
      }

      // Real execution with streaming output via spawn
      return new Promise((resolve) => {
        const proc = spawn('/bin/bash', ['-c', command], {
          cwd,
          env: combinedEnv,
          detached: process.platform !== 'win32',
          stdio: ['ignore', 'pipe', 'pipe']
        })
        activeAutomationProcesses.set(stepKey, proc)

        let stdoutBuf = ''
        let stderrBuf = ''

        proc.stdout.on('data', (chunk) => {
          const text = chunk.toString()
          stdoutBuf += text
          sendChunk('stdout', text)
        })

        proc.stderr.on('data', (chunk) => {
          const text = chunk.toString()
          stderrBuf += text
          sendChunk('stderr', text)
        })

        proc.on('close', (code) => {
          activeAutomationProcesses.delete(stepKey)
          const wasCancelled = proc.__flyworkCancelled === true
          const exitCode = wasCancelled ? 130 : code
          const success = !wasCancelled && code === 0
          const error = wasCancelled ? '执行已由用户终止' : stderrBuf
          writeAuditLog({
            type: wasCancelled ? 'AUTOMATION_CANCELLED' : 'AUTOMATION_RESULT',
            command,
            success,
            exitCode,
            error: error.slice(0, 500)
          })
          sendChunk(
            'exit',
            wasCancelled
              ? '\n[已终止] 当前步骤及其子进程已停止。'
              : `\n[进程退出] Exit Code: ${code}`
          )
          resolve({
            success,
            exitCode,
            output: stdoutBuf || (success ? '执行完成，无输出' : ''),
            error,
            gitEnv: builtinGitEnv
          })
        })

        proc.on('error', (err) => {
          activeAutomationProcesses.delete(stepKey)
          const errorStr = err.message
          sendChunk('stderr', `\n[进程错误] ${errorStr}`)
          writeAuditLog({
            type: 'AUTOMATION_RESULT',
            command,
            success: false,
            exitCode: -1,
            error: errorStr
          })
          resolve({
            success: false,
            exitCode: -1,
            output: stdoutBuf,
            error: errorStr,
            gitEnv: builtinGitEnv
          })
        })
      })
    }
  )

  // Stop the shell and all commands it started for an automation step.
  ipcMain.handle('cancel-automation-step', async (_, stepKey) => {
    const proc = activeAutomationProcesses.get(stepKey)
    if (!proc || proc.exitCode !== null || proc.killed) {
      return { success: false, error: '没有正在运行的步骤' }
    }

    try {
      proc.__flyworkCancelled = true
      if (process.platform === 'win32') {
        proc.kill('SIGTERM')
      } else {
        // The process was spawned detached, so a negative PID targets its
        // process group rather than leaving child commands running.
        process.kill(-proc.pid, 'SIGTERM')
        setTimeout(() => {
          if (activeAutomationProcesses.get(stepKey) === proc && proc.exitCode === null) {
            try {
              process.kill(-proc.pid, 'SIGKILL')
            } catch {}
          }
        }, 3000)
      }
      return { success: true }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })

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
      return content
        .trim()
        .split('\n')
        .filter(Boolean)
        .map((l) => {
          try {
            return JSON.parse(l)
          } catch {
            return null
          }
        })
        .filter(Boolean)
        .reverse()
        .slice(0, 100)
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
    const result = await dialog.showOpenDialog(
      mainWindow,
      options || {
        properties: ['openDirectory']
      }
    )
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
      return {
        isGit: false,
        gitBranch: '无',
        gitModifiedFiles: [],
        lastCommit: '目录不存在',
        lastCommitHash: '',
        lastCommitTime: ''
      }
    }
    try {
      const [branchRes, statusRes, logRes] = await Promise.allSettled([
        execAsync('git branch --show-current', { cwd: workdir, timeout: 3000, encoding: 'utf-8' }),
        execAsync('git status --porcelain', { cwd: workdir, timeout: 5000, encoding: 'utf-8' }),
        execAsync('git log -1 --pretty=format:"%h|%s|%cr"', {
          cwd: workdir,
          timeout: 3000,
          encoding: 'utf-8'
        })
      ])

      const branch =
        (branchRes.status === 'fulfilled' ? branchRes.value.stdout : '').trim() || 'HEAD'
      const statusOutput = (statusRes.status === 'fulfilled' ? statusRes.value.stdout : '').trim()
      const modifiedFiles = statusOutput
        ? statusOutput
            .split('\n')
            .filter(Boolean)
            .map((line) => {
              const status = line.slice(0, 2).trim()
              const path = line.slice(3).trim()
              return { status: status || 'M', path }
            })
        : []

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
      return {
        isGit: false,
        gitBranch: '无',
        gitModifiedFiles: [],
        lastCommit: '非 Git 仓库',
        lastCommitHash: '',
        lastCommitTime: ''
      }
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
          execSync(`git checkout "${localName}"`, {
            cwd: workdir,
            timeout: 5000,
            encoding: 'utf-8'
          })
        } catch {
          execSync(`git checkout -b "${localName}" "${target}"`, {
            cwd: workdir,
            timeout: 5000,
            encoding: 'utf-8'
          })
        }
        target = localName
      } else {
        execSync(`git checkout "${target}"`, { cwd: workdir, timeout: 5000, encoding: 'utf-8' })
      }
      writeAuditLog({
        type: 'EXECUTE',
        actionId: 'git-checkout',
        name: `切换分支至 ${target}`,
        workdir
      })
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
      const res = execSync(`git checkout -b "${newBranch}" "${base}"`, {
        cwd: workdir,
        timeout: 5000,
        encoding: 'utf-8'
      })
      writeAuditLog({
        type: 'EXECUTE',
        actionId: 'git-create-branch',
        name: `基于 ${base} 创建分支 ${newBranch}`,
        workdir
      })
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
    if (
      !agent ||
      agent.toLowerCase().includes('codex') ||
      agent.toLowerCase().includes('chatgpt')
    ) {
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
              (projectPath &&
                p.rootPaths &&
                p.rootPaths.some(
                  (rp) => rp === projectPath || projectPath.endsWith(rp.split('/').pop())
                ))
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
            if (
              assign &&
              (assign.projectId === matchedProjectId ||
                (assign.cwd && projectPath && assign.cwd === projectPath))
            ) {
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
              updatedAt: item.updated_at
                ? new Date(item.updated_at).toLocaleTimeString('zh-CN', {
                    hour: '2-digit',
                    minute: '2-digit'
                  })
                : '历史',
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
                    summary:
                      typeof item.display === 'string' &&
                      item.display.length > 2 &&
                      item.display !== 'user'
                        ? item.display.slice(0, 50)
                        : `Claude Code 会话 ${String(sId).slice(0, 6)}`,
                    updatedAt: item.timestamp
                      ? new Date(item.timestamp).toLocaleTimeString('zh-CN', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })
                      : '最近',
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
        content
          .split('\n')
          .filter(Boolean)
          .forEach((line) => {
            try {
              const item = JSON.parse(line)
              if (item.type === 'event_msg' && item.payload) {
                const pType = item.payload.type
                if (pType === 'user_message' || pType === 'agent_message') {
                  const role = pType === 'user_message' ? 'user' : 'assistant'
                  const text =
                    item.payload.message || item.payload.text || item.payload.content || ''
                  if (text && typeof text === 'string') {
                    messages.push({
                      role,
                      content: text,
                      time: item.payload.timestamp
                        ? new Date(item.payload.timestamp).toLocaleTimeString('zh-CN', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })
                        : ''
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
        content
          .split('\n')
          .filter(Boolean)
          .forEach((line) => {
            try {
              const item = JSON.parse(line)
              if (item.sessionId === sessionId || String(item.timestamp) === sessionId) {
                if (item.display && item.display !== 'status') {
                  const role =
                    item.display === 'assistant' || item.display === 'model' ? 'assistant' : 'user'
                  const text = typeof item.display === 'string' ? item.display : `命令记录`
                  messages.push({
                    role,
                    content: text,
                    time: item.timestamp
                      ? new Date(item.timestamp).toLocaleTimeString('zh-CN', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })
                      : ''
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
      const git = (args, cwd) =>
        execFileSync('git', args, { cwd, timeout: 5000, encoding: 'utf-8' })
      const repoRoot = git(['rev-parse', '--show-toplevel'], workdir).trim()
      const status = git(['status', '--short', '--untracked-files=all'], repoRoot).trim()
      if (!status) {
        return { success: false, error: '没有需要提交的未提交改动 (Working tree clean)' }
      }

      const stagedDiff = git(['diff', '--cached', '--no-ext-diff', '--no-color', '--'], repoRoot)
      const unstagedDiff = git(['diff', '--no-ext-diff', '--no-color', '--'], repoRoot)
      const untrackedFiles = git(['ls-files', '--others', '--exclude-standard'], repoRoot)
        .split('\n')
        .filter(Boolean)
      const untrackedDiffs = untrackedFiles.flatMap((file) => {
        const isSensitive =
          file === '.env' ||
          file.startsWith('.env.') ||
          /\.(pem|key|p12|mobileprovision)$/i.test(file) ||
          /credentials|secret/i.test(file) ||
          /Secrets\./.test(file)
        if (isSensitive) return []
        try {
          return [
            git(['diff', '--no-index', '--no-ext-diff', '--no-color', '--', '/dev/null', file], repoRoot)
          ]
        } catch (err) {
          // git diff --no-index returns code 1 when it successfully finds a difference.
          if (err.status === 1 && typeof err.stdout === 'string') return [err.stdout]
          throw err
        }
      })
      const rawDiff = [stagedDiff, unstagedDiff, ...untrackedDiffs].filter(Boolean).join('\n')
      // The API accepts at most 30,000 characters. A suffix makes truncation explicit to the service.
      const diff =
        rawDiff.length > 30000
          ? `${rawDiff.slice(0, 29940)}\n\n[Diff truncated to 30,000 characters]`
          : rawDiff
      const omittedSensitiveFiles = untrackedFiles.filter(
        (file) =>
          file === '.env' ||
          file.startsWith('.env.') ||
          /\.(pem|key|p12|mobileprovision)$/i.test(file) ||
          /credentials|secret/i.test(file) ||
          /Secrets\./.test(file)
      )
      const context = [
        `Git status:\n${status}`,
        omittedSensitiveFiles.length
          ? `未上传内容的敏感未跟踪文件：${omittedSensitiveFiles.join(', ')}`
          : ''
      ]
        .filter(Boolean)
        .join('\n\n')
        .slice(0, 2000)
      if (!diff.trim()) {
        return {
          success: false,
          error: '没有可安全发送给 Commit API 的 Git diff。请检查改动后重试。'
        }
      }

      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 60000)
      let response
      try {
        const baseUrl = (process.env.BUG_AI_API_BASE_URL || 'https://dev.foresightx.com.cn/bug-ai').replace(
          /\/$/,
          ''
        )
        response = await fetch(`${baseUrl}/api/v1/commit/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ diff, context }),
          signal: controller.signal
        })
      } catch (err) {
        if (err.name === 'AbortError') {
          return { success: false, error: 'Commit API 请求超时（60 秒）。' }
        }
        throw err
      } finally {
        clearTimeout(timeout)
      }

      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        const detail = Array.isArray(payload?.detail)
          ? payload.detail.map((item) => item.msg).join('；')
          : payload?.detail
        return { success: false, error: detail || `Commit API 请求失败（HTTP ${response.status}）。` }
      }

      const commitMessage =
        typeof payload?.data?.message === 'string' ? payload.data.message.replace(/\s+$/, '') : ''
      if (!commitMessage.trim()) {
        return { success: false, error: 'Commit API 返回了空提交信息。' }
      }
      return {
        success: true,
        commitMessage,
        diffStat: status,
        engine: 'Bug AI Commit API'
      }
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
      const res = execSync(`git commit -m ${JSON.stringify(message)}`, {
        cwd: workdir,
        timeout: 5000,
        encoding: 'utf-8'
      })
      writeAuditLog({
        type: 'EXECUTE',
        actionId: 'git-commit',
        name: `提交代码: ${message.split('\n')[0]}`,
        workdir
      })
      return { success: true, output: res }
    } catch (err) {
      return { success: false, error: err.stderr || err.message }
    }
  })

  // Push code
  ipcMain.handle('git-push', async (_, { workdir, remote = 'origin' }) => {
    try {
      const { execSync } = require('child_process')
      const branch =
        execSync('git branch --show-current', {
          cwd: workdir,
          timeout: 2000,
          encoding: 'utf-8'
        }).trim() || 'main'
      const res = execSync(`git push ${remote} ${branch} || git push -u ${remote} ${branch}`, {
        cwd: workdir,
        timeout: 15000,
        encoding: 'utf-8'
      })
      writeAuditLog({
        type: 'EXECUTE',
        actionId: 'git-push',
        name: `推送代码至 ${remote}/${branch}`,
        workdir
      })
      return { success: true, output: res || '✓ 推送成功' }
    } catch (err) {
      return { success: false, error: err.stderr || err.message }
    }
  })

  // Pull code
  ipcMain.handle('git-pull', async (_, { workdir, remote = 'origin' }) => {
    try {
      const { execSync } = require('child_process')
      const res = execSync(`git pull ${remote} --rebase`, {
        cwd: workdir,
        timeout: 15000,
        encoding: 'utf-8'
      })
      writeAuditLog({
        type: 'EXECUTE',
        actionId: 'git-pull',
        name: `从 ${remote} 拉取更新`,
        workdir
      })
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
      const res = execSync(`git stash push -u -m ${msg}`, {
        cwd: workdir,
        timeout: 5000,
        encoding: 'utf-8'
      })
      writeAuditLog({
        type: 'EXECUTE',
        actionId: 'git-stash',
        name: `挂起工作区代码 (${msg})`,
        workdir
      })
      return { success: true, output: res }
    } catch (err) {
      return { success: false, error: err.stderr || err.message }
    }
  })

  ipcMain.handle('git-stash-pop', async (_, workdir) => {
    try {
      const { execSync } = require('child_process')
      const res = execSync('git stash pop', { cwd: workdir, timeout: 5000, encoding: 'utf-8' })
      writeAuditLog({
        type: 'EXECUTE',
        actionId: 'git-stash-pop',
        name: '恢复挂起的代码 (Stash Pop)',
        workdir
      })
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
        execSync(`git checkout -- "${file}" || git clean -fd "${file}"`, {
          cwd: workdir,
          timeout: 5000,
          encoding: 'utf-8'
        })
      } else {
        execSync('git checkout -- . && git clean -fd', {
          cwd: workdir,
          timeout: 5000,
          encoding: 'utf-8'
        })
      }
      writeAuditLog({
        type: 'EXECUTE',
        actionId: 'git-discard',
        name: `放弃修改: ${file || '全部文件'}`,
        workdir
      })
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
      execSync(`git restore --staged "${file}" || git reset HEAD "${file}"`, {
        cwd: workdir,
        timeout: 3000,
        encoding: 'utf-8'
      })
      return { success: true }
    } catch (err) {
      return { success: false, error: err.stderr || err.message }
    }
  })

  // Get recent 20 commits log (async non-blocking)
  ipcMain.handle('git-get-log', async (_, workdir) => {
    if (!workdir || !existsSync(workdir)) return []
    try {
      const { stdout } = await execAsync('git log -20 --pretty=format:"%h|%s|%an|%cr|%d"', {
        cwd: workdir,
        timeout: 5000,
        encoding: 'utf-8'
      })
      const logOutput = stdout.trim()
      if (!logOutput) return []
      return logOutput
        .split('\n')
        .filter(Boolean)
        .map((line) => {
          const [hash, subject, author, time, refs] = line.split('|')
          return { hash, subject, author, time, refs: refs ? refs.trim() : '' }
        })
    } catch {
      return []
    }
  })

  // ==================== 云效 API IPC Handlers ====================

  // 检查是否已配置云效 Token
  ipcMain.handle('yunxiao-check-auth', async () => {
    try {
      const hasToken = await hasStoredToken()
      const config = getConfig()
      return {
        success: true,
        configured: hasToken,
        currentOrganizationId: config?.currentOrganizationId || null,
        currentOrganizationName: config?.currentOrganizationName || null
      }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })

  // 验证并存储云效 Token
  ipcMain.handle('yunxiao-validate-token', async (_, token) => {
    try {
      const result = await validateToken(token)
      if (result.valid) {
        writeAuditLog({ type: 'YUNXIAO_AUTH', action: 'TOKEN_VALIDATED' })
      }
      return { success: true, ...result }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })

  // 清除云效 Token
  ipcMain.handle('yunxiao-logout', async () => {
    try {
      await deleteStoredToken()
      writeAuditLog({ type: 'YUNXIAO_AUTH', action: 'TOKEN_DELETED' })
      return { success: true }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })

  // 获取组织列表
  ipcMain.handle('yunxiao-list-organizations', async () => {
    try {
      const result = await listOrganizations()
      return { success: true, ...result }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })

  // 获取组织详情
  ipcMain.handle('yunxiao-get-organization', async (_, organizationId) => {
    try {
      const result = await getOrganization(organizationId)
      return { success: true, data: result }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })

  // 设置当前组织
  ipcMain.handle(
    'yunxiao-set-current-organization',
    async (_, { organizationId, organizationName }) => {
      try {
        setCurrentOrganization(organizationId, organizationName)
        writeAuditLog({ type: 'YUNXIAO_CONFIG', action: 'SET_ORGANIZATION', organizationId })
        return { success: true }
      } catch (err) {
        return { success: false, error: err.message }
      }
    }
  )

  // 搜索组织成员
  ipcMain.handle('yunxiao-search-members', async (_, options) => {
    try {
      const result = await searchMembers(options)
      return { success: true, ...result }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })

  // 获取成员详情
  ipcMain.handle('yunxiao-get-member', async (_, { memberId, organizationId }) => {
    try {
      const result = await getMember(memberId, organizationId)
      return { success: true, data: result }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })

  // 获取云效配置
  ipcMain.handle('yunxiao-get-config', async () => {
    try {
      const config = getConfig()
      return { success: true, data: config || {} }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })

  // 搜索项目
  ipcMain.handle('yunxiao-search-projects', async (_, options) => {
    try {
      const result = await searchProjects(options)
      return { success: true, ...result }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })

  // 获取项目列表（简化版）
  ipcMain.handle('yunxiao-list-projects', async (_, organizationId) => {
    try {
      const projects = await listProjects(organizationId)
      return { success: true, projects }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })

  // 获取项目详情
  ipcMain.handle('yunxiao-get-project', async (_, { projectId, organizationId }) => {
    try {
      const project = await getProject(projectId, organizationId)
      return { success: true, data: project }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })

  // 获取项目成员
  ipcMain.handle('yunxiao-list-project-members', async (_, { projectId, organizationId }) => {
    try {
      const members = await listProjectMembers(projectId, organizationId)
      return { success: true, members }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })

  // 创建项目
  ipcMain.handle('yunxiao-create-project', async (_, { projectData, organizationId }) => {
    try {
      const project = await createProject(projectData, organizationId)
      writeAuditLog({ type: 'YUNXIAO_PROJECT', action: 'CREATE', projectId: project.id })
      return { success: true, data: project }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('yunxiao-list-workitems', async (_, options) => {
    try {
      const result = await listWorkitems(options)
      return { success: true, ...result }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('yunxiao-get-workitem', async (_, { workitemId, organizationId }) => {
    try {
      return { success: true, workitem: await getWorkitem(workitemId, organizationId) }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('yunxiao-open-workitem-detail', async (_, workitemId) => {
    try {
      openWorkitemDetailWindow(workitemId)
      return { success: true }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('yunxiao-get-workitem-image', async (_, { imageUrl, workitemId, organizationId }) => {
    try {
      return {
        success: true,
        dataUrl: await getWorkitemImage(imageUrl, workitemId, organizationId)
      }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('yunxiao-create-workitem', async (_, { workitem, organizationId }) => {
    try {
      const data = await createWorkitem(workitem, organizationId)
      writeAuditLog({
        type: 'YUNXIAO_WORKITEM',
        action: 'CREATE',
        projectId: workitem.spaceIdentifier,
        workitemId: data.workitemIdentifier || data.identifier
      })
      return { success: true, data }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle(
    'yunxiao-update-workitem-field',
    async (_, { workitemId, fields, organizationId }) => {
      try {
        const data = await updateWorkitemField(workitemId, fields, organizationId)
        writeAuditLog({ type: 'YUNXIAO_WORKITEM', action: 'UPDATE_FIELD', workitemId })
        return { success: true, data }
      } catch (err) {
        return { success: false, error: err.message }
      }
    }
  )

  ipcMain.handle('yunxiao-list-workitem-fields', async (_, options) => {
    try {
      return { success: true, fields: await listWorkitemFields(options) }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })
  ipcMain.handle(
    'yunxiao-list-project-workitem-types',
    async (_, { projectId, category, organizationId }) => {
      try {
        return {
          success: true,
          types: await listProjectWorkitemTypes(projectId, category, organizationId)
        }
      } catch (err) {
        return { success: false, error: err.message }
      }
    }
  )
  ipcMain.handle('yunxiao-list-workflow-statuses', async (_, options) => {
    try {
      return { success: true, statuses: await listWorkflowStatuses(options) }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })
  ipcMain.handle(
    'yunxiao-create-workitem-comment',
    async (_, { workitemId, content, organizationId }) => {
      try {
        const data = await createWorkitemComment(workitemId, content, organizationId)
        writeAuditLog({ type: 'YUNXIAO_WORKITEM', action: 'ADD_COMMENT', workitemId })
        return { success: true, data }
      } catch (err) {
        return { success: false, error: err.message }
      }
    }
  )
  ipcMain.handle('yunxiao-list-workitem-comments', async (_, { workitemId, organizationId }) => {
    try {
      return { success: true, comments: await listWorkitemComments(workitemId, organizationId) }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })
  ipcMain.handle('yunxiao-list-workitem-attachments', async (_, { workitemId, organizationId }) => {
    try {
      return {
        success: true,
        attachments: await listWorkitemAttachments(workitemId, organizationId)
      }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('yunxiao-list-sprints', async (_, options) => {
    try {
      return { success: true, ...(await listSprints(options)) }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })
  ipcMain.handle('yunxiao-get-sprint', async (_, { sprintId, projectId, organizationId }) => {
    try {
      return { success: true, data: await getSprintInfo(sprintId, projectId, organizationId) }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })
  ipcMain.handle('yunxiao-create-sprint', async (_, { sprint, organizationId }) => {
    try {
      const data = await createSprint(sprint, organizationId)
      writeAuditLog({
        type: 'YUNXIAO_SPRINT',
        action: 'CREATE',
        sprintId: data.identifier || data.id
      })
      return { success: true, data }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })
  ipcMain.handle('yunxiao-update-sprint', async (_, { sprintId, sprint, organizationId }) => {
    try {
      const data = await updateSprint(sprintId, sprint, organizationId)
      writeAuditLog({ type: 'YUNXIAO_SPRINT', action: 'UPDATE', sprintId })
      return { success: true, data }
    } catch (err) {
      return { success: false, error: err.message }
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

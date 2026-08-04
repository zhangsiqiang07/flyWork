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
import { spawn } from 'child_process'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs'
import { homedir } from 'os'

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

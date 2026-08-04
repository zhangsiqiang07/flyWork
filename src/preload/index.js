import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// flyWork secure API bridge
const flyworkAPI = {
  // Action execution
  executeAction: (actionId, workdir, dryRun = false) =>
    ipcRenderer.invoke('execute-action', { actionId, workdir, dryRun }),

  // Data persistence
  saveData: (data) => ipcRenderer.invoke('save-data', data),
  loadData: () => ipcRenderer.invoke('load-data'),

  // Audit log
  getAuditLog: () => ipcRenderer.invoke('get-audit-log'),

  // File/URL
  openPath: (path) => ipcRenderer.invoke('open-path', path),
  openUrl: (url) => ipcRenderer.invoke('open-url', url),
  showOpenDialog: (options) => ipcRenderer.invoke('show-open-dialog', options),

  // Local Agents Detection
  detectLocalAgents: () => ipcRenderer.invoke('detect-local-agents'),

  // Git info & Operations
  getGitInfo: (workdir) => ipcRenderer.invoke('get-git-info', workdir),
  gitGetBranches: (workdir) => ipcRenderer.invoke('git-get-branches', workdir),
  gitCheckout: (workdir, branch) => ipcRenderer.invoke('git-checkout', { workdir, branch }),
  gitCreateBranch: (workdir, newBranch, baseBranch) => ipcRenderer.invoke('git-create-branch', { workdir, newBranch, baseBranch }),
  gitAiCommitPreview: (workdir) => ipcRenderer.invoke('git-ai-commit-preview', workdir),
  gitCommit: (workdir, message, stageAll = true) => ipcRenderer.invoke('git-commit', { workdir, message, stageAll }),
  gitPush: (workdir, remote = 'origin') => ipcRenderer.invoke('git-push', { workdir, remote }),
  gitPull: (workdir, remote = 'origin') => ipcRenderer.invoke('git-pull', { workdir, remote }),
  gitStash: (workdir, message) => ipcRenderer.invoke('git-stash', { workdir, message }),
  gitStashPop: (workdir) => ipcRenderer.invoke('git-stash-pop', workdir),
  gitDiscard: (workdir, file) => ipcRenderer.invoke('git-discard', { workdir, file }),
  gitStageFile: (workdir, file) => ipcRenderer.invoke('git-stage-file', { workdir, file }),
  gitUnstageFile: (workdir, file) => ipcRenderer.invoke('git-unstage-file', { workdir, file }),
  gitGetLog: (workdir) => ipcRenderer.invoke('git-get-log', workdir),

  // Actions registry
  getActions: () => ipcRenderer.invoke('get-actions'),

  // Notifications
  notify: (title, body) => ipcRenderer.invoke('notify', { title, body }),

  // Navigation events from main process
  onNavigate: (callback) => ipcRenderer.on('navigate', (_, view) => callback(view)),
  onToggleCommandCenter: (callback) =>
    ipcRenderer.on('toggle-command-center', () => callback()),

  // Cleanup
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel)
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('flywork', flyworkAPI)
  } catch (error) {
    console.error(error)
  }
} else {
  window.electron = electronAPI
  window.flywork = flyworkAPI
}

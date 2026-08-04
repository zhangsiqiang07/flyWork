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

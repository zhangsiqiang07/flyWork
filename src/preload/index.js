import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// flyWork secure API bridge
const flyworkAPI = {
  // Action execution
  executeAction: (actionId, workdir, dryRun = false) =>
    ipcRenderer.invoke('execute-action', { actionId, workdir, dryRun }),

  // Automation execution with real-time streaming
  executeAutomationStep: (command, workdir, customEnv = {}, dryRun = false, stepKey = '') =>
    ipcRenderer.invoke('execute-automation-step', { command, workdir, customEnv, dryRun, stepKey }),

  cancelAutomationStep: (stepKey) => ipcRenderer.invoke('cancel-automation-step', stepKey),

  // Subscribe to streaming log chunks from automation execution
  onAutomationLogChunk: (callback) => {
    const handler = (_, chunk) => callback(chunk)
    ipcRenderer.on('automation-log-chunk', handler)
    return () => ipcRenderer.removeListener('automation-log-chunk', handler)
  },

  // Data persistence
  saveData: (data) => ipcRenderer.invoke('save-data', data),
  loadData: () => ipcRenderer.invoke('load-data'),

  // Audit log
  getAuditLog: () => ipcRenderer.invoke('get-audit-log'),

  // File/URL
  openPath: (path) => ipcRenderer.invoke('open-path', path),
  openUrl: (url) => ipcRenderer.invoke('open-url', url),
  showOpenDialog: (options) => ipcRenderer.invoke('show-open-dialog', options),

  // Local Agents Detection & Sessions
  detectLocalAgents: () => ipcRenderer.invoke('detect-local-agents'),
  getAgentProjectSessions: (agent, projectPath, workspaceName) =>
    ipcRenderer.invoke('get-agent-project-sessions', { agent, projectPath, workspaceName }),
  getNativeThreadMessages: (sessionId) =>
    ipcRenderer.invoke('get-native-thread-messages', { sessionId }),

  // Git info & Operations
  getGitInfo: (workdir) => ipcRenderer.invoke('get-git-info', workdir),
  gitGetBranches: (workdir) => ipcRenderer.invoke('git-get-branches', workdir),
  gitCheckout: (workdir, branch) => ipcRenderer.invoke('git-checkout', { workdir, branch }),
  gitCreateBranch: (workdir, newBranch, baseBranch) =>
    ipcRenderer.invoke('git-create-branch', { workdir, newBranch, baseBranch }),
  gitAiCommitPreview: (workdir) => ipcRenderer.invoke('git-ai-commit-preview', workdir),
  gitCommit: (workdir, message, stageAll = true) =>
    ipcRenderer.invoke('git-commit', { workdir, message, stageAll }),
  gitPush: (workdir, remote = 'origin') => ipcRenderer.invoke('git-push', { workdir, remote }),
  gitPull: (workdir, remote = 'origin') => ipcRenderer.invoke('git-pull', { workdir, remote }),
  gitStash: (workdir, message) => ipcRenderer.invoke('git-stash', { workdir, message }),
  gitStashPop: (workdir) => ipcRenderer.invoke('git-stash-pop', workdir),
  gitDiscard: (workdir, file) => ipcRenderer.invoke('git-discard', { workdir, file }),
  gitStageFile: (workdir, file) => ipcRenderer.invoke('git-stage-file', { workdir, file }),
  gitUnstageFile: (workdir, file) => ipcRenderer.invoke('git-unstage-file', { workdir, file }),
  gitGetLog: (workdir) => ipcRenderer.invoke('git-get-log', workdir),

  // 云效 API
  yunxiaoCheckAuth: () => ipcRenderer.invoke('yunxiao-check-auth'),
  yunxiaoValidateToken: (token) => ipcRenderer.invoke('yunxiao-validate-token', token),
  yunxiaoLogout: () => ipcRenderer.invoke('yunxiao-logout'),
  yunxiaoListOrganizations: () => ipcRenderer.invoke('yunxiao-list-organizations'),
  yunxiaoGetOrganization: (organizationId) =>
    ipcRenderer.invoke('yunxiao-get-organization', organizationId),
  yunxiaoSetCurrentOrganization: (org) =>
    ipcRenderer.invoke('yunxiao-set-current-organization', org),
  yunxiaoSearchMembers: (options) => ipcRenderer.invoke('yunxiao-search-members', options),
  yunxiaoGetMember: (memberId, organizationId) =>
    ipcRenderer.invoke('yunxiao-get-member', { memberId, organizationId }),
  yunxiaoGetConfig: () => ipcRenderer.invoke('yunxiao-get-config'),

  // 云效项目管理
  yunxiaoSearchProjects: (options) => ipcRenderer.invoke('yunxiao-search-projects', options),
  yunxiaoListProjects: (organizationId) =>
    ipcRenderer.invoke('yunxiao-list-projects', organizationId),
  yunxiaoGetProject: (projectId, organizationId) =>
    ipcRenderer.invoke('yunxiao-get-project', { projectId, organizationId }),
  yunxiaoListProjectMembers: (projectId, organizationId) =>
    ipcRenderer.invoke('yunxiao-list-project-members', { projectId, organizationId }),
  yunxiaoCreateProject: (projectData, organizationId) =>
    ipcRenderer.invoke('yunxiao-create-project', { projectData, organizationId }),

  // 云效工作项
  yunxiaoListWorkitems: (options) => ipcRenderer.invoke('yunxiao-list-workitems', options),
  yunxiaoGetWorkitem: (workitemId, organizationId) =>
    ipcRenderer.invoke('yunxiao-get-workitem', { workitemId, organizationId }),
  yunxiaoOpenWorkitemDetail: (workitemId) =>
    ipcRenderer.invoke('yunxiao-open-workitem-detail', workitemId),
  yunxiaoGetWorkitemImage: (imageUrl, workitemId, organizationId) =>
    ipcRenderer.invoke('yunxiao-get-workitem-image', { imageUrl, workitemId, organizationId }),
  yunxiaoCreateWorkitem: (workitem, organizationId) =>
    ipcRenderer.invoke('yunxiao-create-workitem', { workitem, organizationId }),
  yunxiaoUpdateWorkitemField: (workitemId, fields, organizationId) =>
    ipcRenderer.invoke('yunxiao-update-workitem-field', { workitemId, fields, organizationId }),
  yunxiaoListWorkitemFields: (options) =>
    ipcRenderer.invoke('yunxiao-list-workitem-fields', options),
  yunxiaoListProjectWorkitemTypes: (projectId, category, organizationId) =>
    ipcRenderer.invoke('yunxiao-list-project-workitem-types', {
      projectId,
      category,
      organizationId
    }),
  yunxiaoListWorkflowStatuses: (options) =>
    ipcRenderer.invoke('yunxiao-list-workflow-statuses', options),
  yunxiaoCreateWorkitemComment: (workitemId, content, organizationId) =>
    ipcRenderer.invoke('yunxiao-create-workitem-comment', { workitemId, content, organizationId }),
  yunxiaoListWorkitemComments: (workitemId, organizationId) =>
    ipcRenderer.invoke('yunxiao-list-workitem-comments', { workitemId, organizationId }),
  yunxiaoListWorkitemAttachments: (workitemId, organizationId) =>
    ipcRenderer.invoke('yunxiao-list-workitem-attachments', { workitemId, organizationId }),

  // 云效迭代
  yunxiaoListSprints: (options) => ipcRenderer.invoke('yunxiao-list-sprints', options),
  yunxiaoGetSprint: (sprintId, projectId, organizationId) =>
    ipcRenderer.invoke('yunxiao-get-sprint', { sprintId, projectId, organizationId }),
  yunxiaoCreateSprint: (sprint, organizationId) =>
    ipcRenderer.invoke('yunxiao-create-sprint', { sprint, organizationId }),
  yunxiaoUpdateSprint: (sprintId, sprint, organizationId) =>
    ipcRenderer.invoke('yunxiao-update-sprint', { sprintId, sprint, organizationId }),

  // Actions registry
  getActions: () => ipcRenderer.invoke('get-actions'),

  // Notifications
  notify: (title, body) => ipcRenderer.invoke('notify', { title, body }),

  // Navigation events from main process
  onNavigate: (callback) => ipcRenderer.on('navigate', (_, view) => callback(view)),
  onToggleCommandCenter: (callback) => ipcRenderer.on('toggle-command-center', () => callback()),

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

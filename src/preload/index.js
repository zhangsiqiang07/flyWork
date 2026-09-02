import { contextBridge, ipcRenderer, webUtils } from 'electron'
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
  getAuditLogPath: () => ipcRenderer.invoke('get-audit-log-path'),
  openAuditLog: () => ipcRenderer.invoke('open-audit-log'),
  clearAuditLog: () => ipcRenderer.invoke('clear-audit-log'),

  // Environment Doctor
  runEnvironmentDoctor: (options) => ipcRenderer.invoke('run-environment-doctor', options),

  // Mobile Tools: Provisioning & Certificates
  mobileListProfiles: () => ipcRenderer.invoke('mobile-list-profiles'),
  mobileParseProfile: (filePath) => ipcRenderer.invoke('mobile-parse-profile', filePath),
  mobileDeleteProfile: (filePath) => ipcRenderer.invoke('mobile-delete-profile', filePath),
  mobileListKeychainCerts: () => ipcRenderer.invoke('mobile-list-keychain-certs'),
  mobileRevealFile: (filePath) => ipcRenderer.invoke('mobile-reveal-file', filePath),
  mobileOpenProfilesDir: () => ipcRenderer.invoke('mobile-open-profiles-dir'),

  // Mobile Tools: Simulator Toolbox
  simulatorList: () => ipcRenderer.invoke('simulator-list'),
  simulatorBoot: (udid) => ipcRenderer.invoke('simulator-boot', udid),
  simulatorShutdown: (udid) => ipcRenderer.invoke('simulator-shutdown', udid),
  simulatorRestart: (udid) => ipcRenderer.invoke('simulator-restart', udid),
  simulatorOpenApp: () => ipcRenderer.invoke('simulator-open-app'),
  simulatorSetAppearance: (udid, appearance) =>
    ipcRenderer.invoke('simulator-set-appearance', { udid, appearance }),
  simulatorPush: (udid, bundleId, payload) =>
    ipcRenderer.invoke('simulator-push', { udid, bundleId, payload }),
  simulatorSetLocation: (udid, lat, lon) =>
    ipcRenderer.invoke('simulator-set-location', { udid, lat, lon }),
  simulatorClearLocation: (udid) => ipcRenderer.invoke('simulator-clear-location', udid),
  simulatorOpenUrl: (udid, url) => ipcRenderer.invoke('simulator-open-url', { udid, url }),
  simulatorInstallApp: (udid, appPath, isPhysical = false) =>
    ipcRenderer.invoke('simulator-install-app', { udid, appPath, isPhysical }),
  deviceLaunchApp: (udid, bundleId, isPhysical = false) =>
    ipcRenderer.invoke('device-launch-app', { udid, bundleId, isPhysical }),
  simulatorGetAppContainer: (udid, bundleId) =>
    ipcRenderer.invoke('simulator-get-app-container', { udid, bundleId }),
  simulatorSetClipboard: (udid, text) =>
    ipcRenderer.invoke('simulator-set-clipboard', { udid, text }),
  apnsSendPush: (options) => ipcRenderer.invoke('apns-send-push', options),
  apnsValidateP12: (p12Path, password) =>
    ipcRenderer.invoke('apns-validate-p12', { p12Path, password }),

  // Mobile Tools: IPA Analyzer
  ipaAnalyze: (filePath) => ipcRenderer.invoke('ipa-analyze', filePath),

  // Network & Ports Helper
  networkGetInterfaces: () => ipcRenderer.invoke('network-get-interfaces'),
  networkCheckPorts: (ports) => ipcRenderer.invoke('network-check-ports', ports),
  networkKillPortProcess: (pid) => ipcRenderer.invoke('network-kill-port-process', pid),

  // File/URL
  openPath: (path) => ipcRenderer.invoke('open-path', path),
  openUrl: (url) => ipcRenderer.invoke('open-url', url),
  showOpenDialog: (options) => ipcRenderer.invoke('show-open-dialog', options),
  readTextFile: (filePath) => ipcRenderer.invoke('read-text-file', filePath),

  // Resolve a file path from a drag-drop File object.
  // Electron 32+ removed File.path in renderer; webUtils.getPathForFile is the replacement.
  getPathForFile: webUtils.getPathForFile,

  // Local Agents Detection & Sessions
  detectLocalAgents: () => ipcRenderer.invoke('detect-local-agents'),
  getAgentProjectSessions: (agent, projectPath, workspaceName) =>
    ipcRenderer.invoke('get-agent-project-sessions', { agent, projectPath, workspaceName }),
  getNativeThreadMessages: (sessionId) =>
    ipcRenderer.invoke('get-native-thread-messages', { sessionId }),

  // 周报 (Weekly Report) APIs
  getWeeklyCommits: (options) => ipcRenderer.invoke('weekly-report-get-commits', options),
  generateWeeklyReport: (params) => ipcRenderer.invoke('weekly-report-generate', params),
  cancelWeeklyReport: (taskId) => ipcRenderer.invoke('weekly-report-cancel', taskId),
  onWeeklyReportLogChunk: (callback) => {
    const handler = (_, chunk) => callback(chunk)
    ipcRenderer.on('weekly-report-log-chunk', handler)
    return () => ipcRenderer.removeListener('weekly-report-log-chunk', handler)
  },

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
  yunxiaoGetCurrentUser: () => ipcRenderer.invoke('yunxiao-get-current-user'),
  yunxiaoSetCurrentUser: (user) => ipcRenderer.invoke('yunxiao-set-current-user', user),

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

  // Crash Symbolication (iOS .plcrash + dSYM)
  crashToolchainCheck: () => ipcRenderer.invoke('crash-toolchain-check'),
  crashImport: (plcrashPaths) => ipcRenderer.invoke('crash-import', { plcrashPaths }),
  crashSymbolicate: (reportId, plcrashPath, archivePath) =>
    ipcRenderer.invoke('crash-symbolicate', { reportId, plcrashPath, archivePath }),
  crashListReports: () => ipcRenderer.invoke('crash-list-reports'),
  crashGetReport: (reportId) => ipcRenderer.invoke('crash-get-report', { reportId }),
  crashDeleteReport: (reportId) => ipcRenderer.invoke('crash-delete-report', { reportId }),
  onCrashLogChunk: (callback) => {
    const handler = (_, chunk) => callback(chunk)
    ipcRenderer.on('crash-log-chunk', handler)
    return () => ipcRenderer.removeListener('crash-log-chunk', handler)
  },

  // Apple Universal Links
  universalLinkVerify: (target) => ipcRenderer.invoke('universal-link-verify', { target }),
  universalLinkTestUrl: (aasaData, testUrl, targetAppId) =>
    ipcRenderer.invoke('universal-link-test-url', { aasaData, testUrl, targetAppId }),
  universalLinkCheckWorkspace: (workspaceRoot) =>
    ipcRenderer.invoke('universal-link-check-workspace', { workspaceRoot }),
  universalLinkSimulatorOpen: (url) => ipcRenderer.invoke('universal-link-simulator-open', { url }),
  universalLinkGenerateTemplate: (options) =>
    ipcRenderer.invoke('universal-link-generate-template', options),

  // Jenkins CI APIs
  jenkinsCheckAuth: () => ipcRenderer.invoke('jenkins-check-auth'),
  jenkinsValidateConfig: (config) => ipcRenderer.invoke('jenkins-validate-config', config),
  jenkinsLogout: () => ipcRenderer.invoke('jenkins-logout'),
  jenkinsListJobs: () => ipcRenderer.invoke('jenkins-list-jobs'),
  jenkinsGetJobDetail: (jobPath) => ipcRenderer.invoke('jenkins-get-job-detail', jobPath),
  jenkinsBuildJob: (jobPath, parameters) =>
    ipcRenderer.invoke('jenkins-build-job', { jobPath, parameters }),
  jenkinsGetQueueItem: (queueId) => ipcRenderer.invoke('jenkins-get-queue-item', queueId),
  jenkinsCancelQueueItem: (queueId) => ipcRenderer.invoke('jenkins-cancel-queue-item', queueId),
  jenkinsGetBuildLog: (jobPath, buildNumber, start = 0) =>
    ipcRenderer.invoke('jenkins-get-build-log', { jobPath, buildNumber, start }),
  jenkinsStopBuild: (jobPath, buildNumber) =>
    ipcRenderer.invoke('jenkins-stop-build', { jobPath, buildNumber }),
  jenkinsGetParameterChoices: (jobPath, paramName, fullClass = '') =>
    ipcRenderer.invoke('jenkins-get-parameter-choices', { jobPath, paramName, fullClass }),

  // Development Orchestrator (智能研发编排)
  orchestratorGetMeta: () => ipcRenderer.invoke('orchestrator-get-meta'),
  orchestratorGetPlans: () => ipcRenderer.invoke('orchestrator-get-plans'),
  orchestratorSavePlans: (plans) => ipcRenderer.invoke('orchestrator-save-plans', plans),
  orchestratorResolveDag: (tasks) => ipcRenderer.invoke('orchestrator-resolve-dag', tasks),
  orchestratorRouteTask: (task, projectProfile) =>
    ipcRenderer.invoke('orchestrator-route-task', { task, projectProfile }),
  orchestratorBuildContext: (task, requirement, allTasks) =>
    ipcRenderer.invoke('orchestrator-build-context', { task, requirement, allTasks }),
  orchestratorReconcileAsset: (tasks, assetPayload) =>
    ipcRenderer.invoke('orchestrator-reconcile-asset', { tasks, assetPayload }),
  orchestratorDecomposePrd: (prdText, options) =>
    ipcRenderer.invoke('orchestrator-decompose-prd', { prdText, options }),
  orchestratorBindBugsToPlan: (targetPlan, bugs, options) =>
    ipcRenderer.invoke('orchestrator-bind-bugs-to-plan', { targetPlan, bugs, options }),
  orchestratorCreateStandaloneBugPlan: (bugs, options) =>
    ipcRenderer.invoke('orchestrator-create-standalone-bug-plan', { bugs, options }),

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

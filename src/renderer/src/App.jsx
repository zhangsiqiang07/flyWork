import { useState, useEffect, useCallback, lazy, Suspense } from 'react'
import flyDeckSymbol from './assets/flydeck-symbol.svg'
import { WORKSPACES, SESSIONS, ACTIVITY_LOG, AUTOMATIONS } from './data/mockData'
import { INITIAL_ORCHESTRATOR_PLANS } from './data/orchestratorMockData'
import Sidebar from './components/Sidebar'
import StatusBar from './components/StatusBar'
import CommandCenter from './components/CommandCenter'
import ContextPanel from './components/ContextPanel'
import './styles/index.css'

// Dynamic lazy imports for non-blocking view chunk loading
const Today = lazy(() => import('./views/Today'))
const Workspaces = lazy(() => import('./views/Workspaces'))
const WorkspaceDetail = lazy(() => import('./views/WorkspaceDetail'))
const AutomationsView = lazy(() => import('./views/Automations'))
const SettingsAndTools = lazy(() => import('./views/SettingsAndTools'))
const YunxiaoDashboard = lazy(() => import('./views/YunxiaoDashboard'))
const WeeklyReport = lazy(() => import('./views/WeeklyReport'))
const IOSToolbox = lazy(() => import('./views/iOSToolbox'))
const JenkinsDashboard = lazy(() => import('./views/JenkinsDashboard'))
const PrdIterationHub = lazy(() => import('./views/PrdIterationHub'))
const Orchestrator = lazy(() => import('./views/Orchestrator'))
const Whiteboard = lazy(() => import('./views/Whiteboard'))
const VideoStudio = lazy(() => import('./views/VideoStudio'))

function ViewSkeleton() {
  return (
    <div
      style={{
        padding: 24,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        animation: 'fadeIn 150ms ease'
      }}
    >
      <div
        style={{
          width: 180,
          height: 24,
          background: 'var(--bg-elevated)',
          borderRadius: 6,
          opacity: 0.6
        }}
      />
      <div
        style={{
          width: 320,
          height: 16,
          background: 'var(--bg-elevated)',
          borderRadius: 4,
          opacity: 0.4
        }}
      />
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: 16,
          marginTop: 16
        }}
      >
        <div
          style={{ height: 140, background: 'var(--bg-elevated)', borderRadius: 10, opacity: 0.3 }}
        />
        <div
          style={{ height: 140, background: 'var(--bg-elevated)', borderRadius: 10, opacity: 0.3 }}
        />
      </div>
    </div>
  )
}

export default function App() {
  const [currentView, setCurrentView] = useState('today')
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState(null)
  const [commandCenterOpen, setCommandCenterOpen] = useState(false)
  const [contextPanelOpen, setContextPanelOpen] = useState(false)
  const [activeSessionChat, setActiveSessionChat] = useState(null)

  const [isLoaded, setIsLoaded] = useState(false)
  const [workspaces, setWorkspaces] = useState([])
  const [sessions, setSessions] = useState([])
  const [activityLog, setActivityLog] = useState([])
  const [automations, setAutomations] = useState([])
  const [chatHistories, setChatHistories] = useState({})
  const [yunxiaoConfigured, setYunxiaoConfigured] = useState(false)
  const [jenkinsConfigured, setJenkinsConfigured] = useState(false)
  const [weeklyReports, setWeeklyReports] = useState([])
  const [weeklyReportRepos, setWeeklyReportRepos] = useState([])
  const [weeklyReportPrompt, setWeeklyReportPrompt] = useState('')
  const [weeklyReportInitialRepoPath, setWeeklyReportInitialRepoPath] = useState(null)
  const [orchestratorPlans, setOrchestratorPlans] = useState(INITIAL_ORCHESTRATOR_PLANS)
  const [activeOrchestratorPlanId, setActiveOrchestratorPlanId] = useState(null)
  const [settingsInitialTab, setSettingsInitialTab] = useState('audit-log')
  const [iosToolsInitialTab, setIosToolsInitialTab] = useState('simulator')

  // 1. Initial Data Loading
  useEffect(() => {
    async function initData() {
      try {
        // Check Yunxiao configuration status
        if (window.flywork?.yunxiaoCheckAuth) {
          const yunxiaoAuth = await window.flywork.yunxiaoCheckAuth()
          setYunxiaoConfigured(yunxiaoAuth.success && yunxiaoAuth.configured)
        }

        // Check Jenkins configuration status
        if (window.flywork?.jenkinsCheckAuth) {
          const jenkinsAuth = await window.flywork.jenkinsCheckAuth()
          setJenkinsConfigured(jenkinsAuth.success && jenkinsAuth.configured)
        }

        if (window.flywork?.loadData) {
          const savedData = await window.flywork.loadData()
          if (savedData && Array.isArray(savedData.workspaces)) {
            const loadedWorkspaces = savedData.workspaces || []
            const wsIds = new Set(loadedWorkspaces.map((w) => w.id))

            // Auto-repair: if automation.workspaceId doesn't match any workspace ID,
            // try to find the workspace by name/root similarity (prevents stale ID mismatches)
            const LEGACY_ID_MAP = {
              'petpal-ios': (ws) =>
                ws.some(
                  (w) =>
                    w.root?.toLowerCase().includes('petpal') ||
                    w.name?.toLowerCase().includes('petpal')
                ),
              'knowledge-os': (ws) =>
                ws.some(
                  (w) =>
                    w.root?.toLowerCase().includes('knowledge') ||
                    w.name?.toLowerCase().includes('knowledge')
                ),
              'server-infra': (ws) =>
                ws.some(
                  (w) =>
                    w.name?.toLowerCase().includes('server') ||
                    w.name?.toLowerCase().includes('infra')
                )
            }

            const repairedAutomations = (savedData.automations || []).map((a) => {
              if (!a.workspaceId || wsIds.has(a.workspaceId)) return a
              // Try to find a matching workspace by legacy alias
              const matchFn = LEGACY_ID_MAP[a.workspaceId]
              if (matchFn) {
                const matched = loadedWorkspaces.find(
                  (w) =>
                    w.root
                      ?.toLowerCase()
                      .includes(a.workspaceId.replace('-ios', '').replace('-', '')) ||
                    w.name
                      ?.toLowerCase()
                      .includes(a.workspaceId.replace('-ios', '').replace('-', ''))
                )
                if (matched) {
                  console.log(
                    `[flyWork] Repaired automation workspaceId: ${a.workspaceId} -> ${matched.id} (${matched.name})`
                  )
                  return { ...a, workspaceId: matched.id }
                }
              }
              return a
            })

            setWorkspaces(loadedWorkspaces)
            setSessions(savedData.sessions || [])
            setActivityLog(savedData.activityLog || [])
            setAutomations(repairedAutomations)
            setChatHistories(savedData.chatHistories || {})
            setWeeklyReports(savedData.weeklyReports || [])
            setWeeklyReportRepos(savedData.weeklyReportRepos || [])
            setWeeklyReportPrompt(savedData.weeklyReportPrompt || '')
            setIsLoaded(true)
            return
          }
        }
      } catch (err) {
        console.error('Failed to load saved data:', err)
      }
      // Default to empty arrays
      setWorkspaces([])
      setSessions([])
      setActivityLog([])
      setAutomations([])
      setChatHistories({})
      setWeeklyReports([])
      setWeeklyReportRepos([])
      setWeeklyReportPrompt('')
      setIsLoaded(true)
    }
    initData()
  }, [])

  // 2. Data Auto-Persistence
  useEffect(() => {
    if (!isLoaded) return
    const timer = setTimeout(() => {
      if (window.flywork?.saveData) {
        window.flywork.saveData({
          workspaces,
          sessions,
          activityLog,
          automations,
          chatHistories,
          weeklyReports,
          weeklyReportRepos,
          weeklyReportPrompt
        })
      }
    }, 500)
    return () => clearTimeout(timer)
  }, [
    workspaces,
    sessions,
    activityLog,
    automations,
    chatHistories,
    weeklyReports,
    weeklyReportRepos,
    weeklyReportPrompt,
    isLoaded
  ])

  useEffect(() => {
    if (window.flywork) {
      window.flywork.onToggleCommandCenter(() => setCommandCenterOpen((prev) => !prev))
      window.flywork.onNavigate((view) => setCurrentView(view))
    }
    const handleKeyDown = (e) => {
      if ((e.metaKey && e.key === 'k') || (e.altKey && e.key === ' ')) {
        e.preventDefault()
        setCommandCenterOpen((prev) => !prev)
      }
      if (e.key === 'Escape') setCommandCenterOpen(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const navigateTo = useCallback((view, meta = null) => {
    setCurrentView(view)
    if (view === 'workspace-detail' && meta) setSelectedWorkspaceId(meta)
    if (view === 'weekly-report') setWeeklyReportInitialRepoPath(meta)
    if (view === 'orchestrator') {
      if (meta) setActiveOrchestratorPlanId(meta)
      else setActiveOrchestratorPlanId(null)
    }
    if (view === 'settings') {
      if (meta) setSettingsInitialTab(meta)
      else setSettingsInitialTab('audit-log')
    }
    if (view === 'ios-tools') {
      if (meta) setIosToolsInitialTab(meta)
      else setIosToolsInitialTab('simulator')
    }
    if (view !== 'workspace-detail') {
      setContextPanelOpen(false)
    }
    setCommandCenterOpen(false)
  }, [])

  useEffect(() => {
    const handleOpenSettings = (e) => {
      const { tab, subTab } = e.detail || {}
      if (tab) setSettingsInitialTab(subTab ? `${tab}-${subTab}` : tab)
      setCurrentView('settings')
    }
    window.addEventListener('flywork_open_settings', handleOpenSettings)
    return () => window.removeEventListener('flywork_open_settings', handleOpenSettings)
  }, [])

  const openWorkspace = useCallback((workspaceId) => {
    setSelectedWorkspaceId(workspaceId)
    setCurrentView('workspace-detail')
    setContextPanelOpen(false)
    setCommandCenterOpen(false)
  }, [])

  const addWorkspaceFromFolder = useCallback(async () => {
    if (!window.flywork?.showOpenDialog) return
    const result = await window.flywork.showOpenDialog({
      properties: ['openDirectory'],
      title: '选择本地工程/项目文件夹'
    })
    if (!result || result.canceled || !result.filePaths || result.filePaths.length === 0) {
      return
    }
    const folderPath = result.filePaths[0]
    const folderName = folderPath.split('/').filter(Boolean).pop() || '未命名工作区'

    const newWs = {
      id: `ws-${Date.now()}`,
      name: folderName,
      icon: '📁',
      color: '#4f9ef8',
      bgColor: 'rgba(79,158,248,0.15)',
      root: folderPath,
      description: folderPath,
      gitBranch: 'main',
      gitModifiedFiles: [],
      lastCommit: '关联本地项目目录',
      lastCommitHash: '',
      lastCommitTime: '刚刚',
      buildStatus: 'success',
      buildMessage: '关联就绪',
      services: [],
      actions: [
        { id: 'open-finder', name: '打开 Finder', risk: 'readonly', icon: '📁' },
        { id: 'open-terminal', name: '打开终端', risk: 'readonly', icon: '💻' },
        { id: 'git-status', name: '查看 Git 状态', risk: 'readonly', icon: '📊' }
      ],
      tags: ['Local']
    }

    setWorkspaces((prev) => [newWs, ...prev])
  }, [])

  const updateWorkspace = useCallback((workspaceId, updates) => {
    setWorkspaces((prev) => prev.map((w) => (w.id === workspaceId ? { ...w, ...updates } : w)))
  }, [])

  const deleteWorkspace = useCallback(
    (workspaceId) => {
      setWorkspaces((prev) => prev.filter((w) => w.id !== workspaceId))
      if (selectedWorkspaceId === workspaceId) {
        setSelectedWorkspaceId(null)
        setCurrentView('workspaces')
      }
    },
    [selectedWorkspaceId]
  )

  const resumeSession = useCallback((sessionId) => {
    setSessions((prev) =>
      prev.map((s) =>
        s.id === sessionId ? { ...s, status: 'active', updatedAt: new Date().toISOString() } : s
      )
    )
    setCommandCenterOpen(false)
  }, [])

  const pauseSession = useCallback((sessionId) => {
    setSessions((prev) =>
      prev.map((s) =>
        s.id === sessionId ? { ...s, status: 'paused', updatedAt: new Date().toISOString() } : s
      )
    )
  }, [])

  const selectedWorkspace = workspaces.find((w) => w.id === selectedWorkspaceId)
  const activeSessions = sessions.filter((s) => s.status === 'active').length

  const importWorkspaceByPath = useCallback(
    (rootPath, customName, defaultAgent = 'Claude Code') => {
      if (!rootPath) return
      const folderName = customName || rootPath.split('/').pop() || 'Unassigned Project'
      const newId = `ws-${Date.now()}`
      const newWs = {
        id: newId,
        name: folderName,
        description: `自动关联的 ${defaultAgent} 本地项目`,
        root: rootPath,
        gitBranch: 'main',
        gitStatus: 'clean',
        gitModifiedCount: 0,
        icon: defaultAgent.includes('Claude') ? '🤖' : '🧠',
        bgColor: 'var(--accent-purple-dim)',
        defaultAgent,
        gitModifiedFiles: [],
        lastCommit: '已关联原生 CLI 存储',
        lastCommitHash: '',
        lastCommitTime: '刚刚',
        buildStatus: 'success',
        buildMessage: '同步就绪',
        services: [],
        actions: [
          { id: 'open-finder', name: '打开 Finder', risk: 'readonly', icon: '📁' },
          { id: 'open-terminal', name: '打开终端', risk: 'readonly', icon: '💻' },
          { id: 'git-status', name: '查看 Git 状态', risk: 'readonly', icon: '📊' }
        ],
        tags: ['Native Agent', defaultAgent]
      }

      setWorkspaces((prev) => [newWs, ...prev])
      setSelectedWorkspaceId(newId)
      setCurrentView('workspace-detail')
    },
    []
  )

  const handleOpenSessionChat = useCallback((sessionInfo) => {
    setActiveSessionChat(sessionInfo)
    setContextPanelOpen(true)
  }, [])

  const handleCloseSessionChat = useCallback(() => {
    setContextPanelOpen(false)
  }, [])

  const handleAskAI = useCallback(
    (promptText, workspaceId = null) => {
      const wsId = workspaceId || selectedWorkspaceId || 'global'
      const threadKey = `${wsId}_Claude Code`
      const newMsg = {
        role: 'user',
        content: promptText,
        time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
      }
      const aiReply = {
        role: 'assistant',
        content:
          '🔍 已接收到自动化分析请求。\n\n**诊断定位**：\n已拦截到命令异常输出，建议进行以下排查：\n1. 检查命令行可执行工具与环境变量配置 (PATH)。\n2. 在自动化步骤编辑中尝试使用 ${root} 动态注入工作区绝对路径。\n3. 可对关键修改命令执行 Dry Run 预演验证。',
        time: '刚刚'
      }

      setChatHistories((prev) => ({
        ...prev,
        [threadKey]: [...(prev[threadKey] || []), newMsg, aiReply]
      }))
    },
    [selectedWorkspaceId]
  )

  const handleOrchestrateBugs = useCallback(
    ({ mode, targetPlanId, updatedPlan, newPlan }) => {
      if (mode === 'bind' && updatedPlan) {
        setOrchestratorPlans((prev) => prev.map((p) => (p.id === updatedPlan.id ? updatedPlan : p)))
        navigateTo('orchestrator', updatedPlan.id)
      } else if (mode === 'standalone' && newPlan) {
        setOrchestratorPlans((prev) => [newPlan, ...prev])
        navigateTo('orchestrator', newPlan.id)
      }
    },
    [navigateTo]
  )

  const renderMainContent = () => {
    switch (currentView) {
      case 'today':
        return (
          <Today
            sessions={sessions}
            workspaces={workspaces}
            activityLog={activityLog}
            onOpenWorkspace={openWorkspace}
            onResumeSession={resumeSession}
            onPauseSession={pauseSession}
            yunxiaoConfigured={yunxiaoConfigured}
            plans={orchestratorPlans}
            onOrchestrateBugs={handleOrchestrateBugs}
            onNavigate={navigateTo}
          />
        )
      case 'workspaces':
        return (
          <Workspaces
            workspaces={workspaces}
            sessions={sessions}
            onOpenWorkspace={openWorkspace}
            onAddWorkspace={addWorkspaceFromFolder}
            onUpdateWorkspace={updateWorkspace}
            onDeleteWorkspace={deleteWorkspace}
            onImportWorkspace={importWorkspaceByPath}
          />
        )
      case 'workspace-detail':
        return selectedWorkspace ? (
          <WorkspaceDetail
            workspace={selectedWorkspace}
            sessions={sessions.filter((s) => s.workspaceId === selectedWorkspace.id)}
            activityLog={activityLog.filter((a) => a.workspaceId === selectedWorkspace.id)}
            automations={automations.filter((a) => a.workspaceId === selectedWorkspace.id)}
            onUpdateAutomations={setAutomations}
            onResumeSession={resumeSession}
            onPauseSession={pauseSession}
            onBack={() => {
              setContextPanelOpen(false)
              setCurrentView('workspaces')
            }}
            onOpenSessionChat={handleOpenSessionChat}
            onSetContextPanel={handleOpenSessionChat}
            activeSessionId={contextPanelOpen ? activeSessionChat?.sessionId : null}
            onUpdateWorkspace={updateWorkspace}
            onDeleteWorkspace={deleteWorkspace}
            onNavigate={navigateTo}
          />
        ) : null
      case 'orchestrator': {
        const activePlan = orchestratorPlans.find((p) => p.id === activeOrchestratorPlanId)
        if (activePlan) {
          return (
            <Orchestrator
              activePlan={activePlan}
              plans={orchestratorPlans}
              onSelectPlan={(id) => setActiveOrchestratorPlanId(id)}
              onBackToHub={() => setActiveOrchestratorPlanId(null)}
              onUpdatePlan={(updatedPlan) => {
                setOrchestratorPlans((prev) =>
                  prev.map((p) => (p.id === updatedPlan.id ? updatedPlan : p))
                )
              }}
              workspaces={workspaces}
              onAddWorkspace={addWorkspaceFromFolder}
            />
          )
        }
        return (
          <PrdIterationHub
            plans={orchestratorPlans}
            onSelectPlan={(id) => setActiveOrchestratorPlanId(id)}
            onCreatePlan={(newPlan) => {
              setOrchestratorPlans((prev) => [newPlan, ...prev])
            }}
            onRunReadyTasksForPlan={(planId) => {
              setOrchestratorPlans((prev) =>
                prev.map((p) => {
                  if (p.id === planId) {
                    const updatedTasks = (p.tasks || []).map((t) =>
                      t.status === 'READY' ? { ...t, status: 'DONE' } : t
                    )
                    return { ...p, tasks: updatedTasks }
                  }
                  return p
                })
              )
            }}
            workspaces={workspaces}
            onAddWorkspace={addWorkspaceFromFolder}
          />
        )
      }
      case 'weekly-report':
        return (
          <WeeklyReport
            workspaces={workspaces}
            weeklyReports={weeklyReports}
            setWeeklyReports={setWeeklyReports}
            cachedRepos={weeklyReportRepos}
            setCachedRepos={setWeeklyReportRepos}
            cachedPrompt={weeklyReportPrompt}
            setCachedPrompt={setWeeklyReportPrompt}
            initialRepoPath={weeklyReportInitialRepoPath}
          />
        )
      case 'automations':
        return null
      case 'settings':
      case 'audit-log':
      case 'activity':
      case 'doctor':
      case 'environment':
      case 'jenkins-settings':
      case 'yunxiao-settings':
        return (
          <SettingsAndTools
            initialTab={
              currentView === 'yunxiao-settings'
                ? 'yunxiao'
                : currentView === 'jenkins-settings'
                  ? 'jenkins'
                  : currentView === 'doctor' || currentView === 'environment'
                    ? 'doctor'
                    : settingsInitialTab
            }
            onYunxiaoConfigChange={(config) => {
              setYunxiaoConfigured(config.configured)
              if (config.configured && currentView === 'yunxiao-settings') {
                setCurrentView('yunxiao')
              }
            }}
            onJenkinsConfigChange={(config) => {
              setJenkinsConfigured(config.configured)
              if (config.configured && currentView === 'jenkins-settings') {
                setCurrentView('jenkins')
              }
            }}
          />
        )
      case 'ios-tools':
      case 'simulator':
      case 'provisioning':
      case 'profiles':
      case 'crash':
      case 'universal-link':
        return (
          <IOSToolbox
            initialTab={
              ['simulator', 'provisioning', 'profiles', 'crash', 'universal-link'].includes(
                currentView
              )
                ? currentView
                : iosToolsInitialTab
            }
            workspaces={workspaces}
            selectedWorkspaceId={selectedWorkspaceId}
          />
        )
      case 'yunxiao':
        return (
          <YunxiaoDashboard
            plans={orchestratorPlans}
            workspaces={workspaces}
            onOrchestrateBugs={handleOrchestrateBugs}
            onNavigate={navigateTo}
          />
        )
      case 'jenkins':
        return <JenkinsDashboard />
      case 'whiteboard':
        return <Whiteboard />
      case 'video-studio':
        return (
          <VideoStudio
            workspaces={workspaces}
            onNavigate={navigateTo}
            onOpenWorkspace={openWorkspace}
            onAddNewWorkspace={(newWs) => setWorkspaces((prev) => [newWs, ...prev])}
          />
        )
      default:
        return null
    }
  }

  return (
    <div className="app-layout">
      <div className="titlebar">
        <button
          type="button"
          className="titlebar-logo"
          onClick={() => navigateTo('today')}
          title="返回今日"
          aria-label="返回今日面板"
        >
          <img className="logo-icon" src={flyDeckSymbol} alt="FlyDeck" />
          <span>FlyDeck</span>
        </button>
        <div className="titlebar-search">
          <button className="titlebar-search-btn" onClick={() => setCommandCenterOpen(true)}>
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <span>搜索、执行动作、询问 AI...</span>
            <span className="shortcut">⌘K</span>
          </button>
        </div>
        <div className="titlebar-actions">
          {activeSessions > 0 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 12,
                color: 'var(--accent-green)',
                background: 'var(--accent-green-dim)',
                padding: '3px 10px',
                borderRadius: 'var(--radius-full)'
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: 'var(--accent-green)'
                }}
              />
              {activeSessions} 个工作中
            </div>
          )}
        </div>
      </div>

      <div className="main-body">
        <Sidebar
          currentView={currentView}
          selectedWorkspaceId={selectedWorkspaceId}
          workspaces={workspaces}
          sessions={sessions}
          yunxiaoConfigured={yunxiaoConfigured}
          jenkinsConfigured={jenkinsConfigured}
          onNavigate={navigateTo}
          onOpenWorkspace={openWorkspace}
        />

        <div className="main-content">
          <Suspense fallback={<ViewSkeleton />}>
            {/* Keep automation runtime state and its IPC log subscription alive while users browse elsewhere. */}
            <div
              style={{ display: currentView === 'automations' ? 'block' : 'none', height: '100%' }}
            >
              <AutomationsView
                automations={automations}
                workspaces={workspaces}
                setAutomations={setAutomations}
                onAskAI={handleAskAI}
              />
            </div>
            {currentView !== 'automations' && renderMainContent()}
          </Suspense>
        </div>
        <ContextPanel
          isOpen={contextPanelOpen}
          activeSession={activeSessionChat}
          onClose={handleCloseSessionChat}
          selectedWorkspace={selectedWorkspace}
        />
      </div>

      <StatusBar workspaces={workspaces} sessions={sessions} />

      {commandCenterOpen && (
        <CommandCenter
          workspaces={workspaces}
          sessions={sessions}
          automations={automations}
          onClose={() => setCommandCenterOpen(false)}
          onNavigate={navigateTo}
          onOpenWorkspace={openWorkspace}
          onResumeSession={resumeSession}
        />
      )}
    </div>
  )
}

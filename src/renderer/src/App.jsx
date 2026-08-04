import { useState, useEffect, useCallback } from 'react'
import {
  WORKSPACES,
  SESSIONS,
  INBOX_ITEMS,
  ACTIVITY_LOG,
  AUTOMATIONS
} from './data/mockData'
import Sidebar from './components/Sidebar'
import StatusBar from './components/StatusBar'
import CommandCenter from './components/CommandCenter'
import ContextPanel from './components/ContextPanel'
import Today from './views/Today'
import Workspaces from './views/Workspaces'
import WorkspaceDetail from './views/WorkspaceDetail'
import Inbox from './views/Inbox'
import AutomationsView from './views/Automations'
import Activity from './views/Activity'
import './styles/index.css'

export default function App() {
  const [currentView, setCurrentView] = useState('today')
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState(null)
  const [commandCenterOpen, setCommandCenterOpen] = useState(false)
  const [contextPanelOpen, setContextPanelOpen] = useState(true)
  const [contextPanelContent, setContextPanelContent] = useState('ai')

  const [workspaces] = useState(WORKSPACES)
  const [sessions, setSessions] = useState(SESSIONS)
  const [inboxItems, setInboxItems] = useState(INBOX_ITEMS)
  const [activityLog] = useState(ACTIVITY_LOG)
  const [automations, setAutomations] = useState(AUTOMATIONS)

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

  const navigateTo = useCallback((view, workspaceId = null) => {
    setCurrentView(view)
    if (workspaceId) setSelectedWorkspaceId(workspaceId)
    setCommandCenterOpen(false)
  }, [])

  const openWorkspace = useCallback((workspaceId) => {
    setSelectedWorkspaceId(workspaceId)
    setCurrentView('workspace-detail')
    setCommandCenterOpen(false)
  }, [])

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

  const addInboxItem = useCallback((item) => {
    setInboxItems((prev) => [{ id: `inbox-${Date.now()}`, createdAt: new Date().toISOString(), ...item }, ...prev])
  }, [])

  const selectedWorkspace = workspaces.find((w) => w.id === selectedWorkspaceId)
  const inboxCount = inboxItems.length
  const activeSessions = sessions.filter((s) => s.status === 'active').length

  const renderMainContent = () => {
    switch (currentView) {
      case 'today':
        return <Today sessions={sessions} workspaces={workspaces} activityLog={activityLog} onOpenWorkspace={openWorkspace} onResumeSession={resumeSession} onPauseSession={pauseSession} onSetContextPanel={(c) => { setContextPanelContent(c); setContextPanelOpen(true) }} />
      case 'workspaces':
        return <Workspaces workspaces={workspaces} sessions={sessions} onOpenWorkspace={openWorkspace} />
      case 'workspace-detail':
        return selectedWorkspace ? (
          <WorkspaceDetail workspace={selectedWorkspace} sessions={sessions.filter((s) => s.workspaceId === selectedWorkspace.id)} activityLog={activityLog.filter((a) => a.workspaceId === selectedWorkspace.id)} automations={automations.filter((a) => a.workspaceId === selectedWorkspace.id)} onResumeSession={resumeSession} onPauseSession={pauseSession} onBack={() => setCurrentView('workspaces')} onSetContextPanel={(c) => { setContextPanelContent(c); setContextPanelOpen(true) }} />
        ) : null
      case 'inbox':
        return <Inbox items={inboxItems} workspaces={workspaces} onAddItem={addInboxItem} />
      case 'automations':
        return <AutomationsView automations={automations} workspaces={workspaces} setAutomations={setAutomations} onSetContextPanel={(c) => { setContextPanelContent(c); setContextPanelOpen(true) }} />
      case 'activity':
        return <Activity activityLog={activityLog} workspaces={workspaces} />
      default:
        return null
    }
  }

  return (
    <div className="app-layout">
      <div className="titlebar">
        <div className="titlebar-logo">
          <div className="logo-icon">F</div>
          <span>flyWork</span>
        </div>
        <div className="titlebar-search">
          <button className="titlebar-search-btn" onClick={() => setCommandCenterOpen(true)}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            <span>搜索、执行动作、询问 AI...</span>
            <span className="shortcut">⌘K</span>
          </button>
        </div>
        <div className="titlebar-actions">
          {activeSessions > 0 && (
            <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, color:'var(--accent-green)', background:'var(--accent-green-dim)', padding:'3px 10px', borderRadius:'var(--radius-full)' }}>
              <span style={{ width:6, height:6, borderRadius:'50%', background:'var(--accent-green)' }} />
              {activeSessions} 个工作中
            </div>
          )}
          <button className="btn btn-ghost btn-icon" onClick={() => setContextPanelOpen((p) => !p)} title="切换上下文面板">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M15 3v18"/></svg>
          </button>
        </div>
      </div>

      <div className="main-body">
        <Sidebar currentView={currentView} workspaces={workspaces} sessions={sessions} inboxCount={inboxCount} onNavigate={navigateTo} onOpenWorkspace={openWorkspace} />
        <div className="main-content">{renderMainContent()}</div>
        <ContextPanel isOpen={contextPanelOpen} activeTab={contextPanelContent} onTabChange={setContextPanelContent} currentView={currentView} selectedWorkspace={selectedWorkspace} sessions={sessions} activityLog={activityLog} />
      </div>

      <StatusBar workspaces={workspaces} sessions={sessions} />

      {commandCenterOpen && (
        <CommandCenter workspaces={workspaces} sessions={sessions} onClose={() => setCommandCenterOpen(false)} onNavigate={navigateTo} onOpenWorkspace={openWorkspace} onResumeSession={resumeSession} onAddInboxItem={addInboxItem} />
      )}
    </div>
  )
}

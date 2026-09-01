export default function Sidebar({
  currentView,
  selectedWorkspaceId,
  workspaces,
  sessions,
  inboxCount,
  yunxiaoConfigured,
  jenkinsConfigured,
  onNavigate,
  onOpenWorkspace
}) {
  const activeSessions = sessions.filter((s) => s.status === 'active')

  const navItems = [
    { id: 'today', label: '今日', icon: <SunIcon /> },
    { id: 'orchestrator', label: '智能编排', icon: <OrchestratorIcon />, badge: 'AI' },
    { id: 'weekly-report', label: '周报', icon: <ReportIcon /> },
    {
      id: 'inbox',
      label: '收件箱',
      icon: <InboxIcon />,
      badge: inboxCount > 0 ? inboxCount : null
    },
    { id: 'automations', label: '自动化', icon: <AutoIcon /> },
    { id: 'activity', label: '活动', icon: <ActivityIcon /> },
    { id: 'crash', label: '崩溃分析', icon: <CrashIcon /> },
    { id: 'universal-link', label: '通用链接', icon: <LinkIcon /> },
    { id: 'yunxiao', label: '云效', icon: <YunxiaoIcon />, badge: yunxiaoConfigured ? '✓' : null },
    {
      id: 'jenkins',
      label: 'Jenkins',
      icon: <JenkinsIcon />,
      badge: jenkinsConfigured ? '✓' : null
    }
  ]

  return (
    <div className="sidebar">
      {/* Active Session Banner */}
      {activeSessions.length > 0 && (
        <div style={{ padding: '0 8px', marginBottom: 8 }}>
          {activeSessions.map((session) => {
            const ws = workspaces.find((w) => w.id === session.workspaceId)
            return (
              <div
                key={session.id}
                onClick={() => onOpenWorkspace(session.workspaceId)}
                style={{
                  background: 'rgba(63,185,80,0.08)',
                  border: '1px solid rgba(63,185,80,0.2)',
                  borderRadius: 'var(--radius-md)',
                  padding: '8px 10px',
                  cursor: 'pointer',
                  marginBottom: 4
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: 'var(--accent-green)',
                      flexShrink: 0,
                      boxShadow: '0 0 5px rgba(63,185,80,0.6)'
                    }}
                  />
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent-green)' }}>
                    工作中
                  </span>
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: 'var(--text-primary)',
                    fontWeight: 500,
                    lineHeight: 1.4,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {session.title}
                </div>
                {ws && (
                  <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 2 }}>
                    {ws.icon} {ws.name}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Main Navigation */}
      <div className="sidebar-section">
        {navItems.map((item) => (
          <div
            key={item.id}
            className={`sidebar-item ${currentView === item.id ? 'active' : ''}`}
            onClick={() => onNavigate(item.id)}
          >
            <span className="sidebar-item-icon">{item.icon}</span>
            <span style={{ flex: 1 }}>{item.label}</span>
            {item.badge && (
              <span className="sidebar-item-badge">{item.badge > 99 ? '99+' : item.badge}</span>
            )}
          </div>
        ))}
      </div>

      <div className="sidebar-section">
        <div className="sidebar-section-label">工作空间</div>
        {workspaces.map((ws) => (
          <div
            key={ws.id}
            className={`sidebar-item ${currentView === 'workspace-detail' && selectedWorkspaceId === ws.id ? 'active' : ''}`}
            onClick={() => onOpenWorkspace(ws.id)}
            style={{ paddingLeft: 6 }}
          >
            <div
              className="sidebar-workspace-icon"
              style={{ background: ws.bgColor, fontSize: 13 }}
            >
              {ws.icon}
            </div>
            <span
              style={{
                flex: 1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}
            >
              {ws.name}
            </span>
            {ws.buildStatus === 'failed' && (
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: 'var(--accent-red)',
                  flexShrink: 0
                }}
              />
            )}
            {ws.buildStatus === 'success' &&
              sessions.some((s) => s.workspaceId === ws.id && s.status === 'active') && (
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: 'var(--accent-green)',
                    flexShrink: 0
                  }}
                />
              )}
          </div>
        ))}
        <div
          className="sidebar-item"
          onClick={() => onNavigate('workspaces')}
          style={{ color: 'var(--text-muted)', fontSize: 11 }}
        >
          <span className="sidebar-item-icon">
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M12 8v8M8 12h8" />
            </svg>
          </span>
          <span>添加工作空间</span>
        </div>
      </div>
    </div>
  )
}

function SunIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  )
}
function ReportIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  )
}
function InboxIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
      <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </svg>
  )
}
function AutoIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  )
}
function ActivityIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  )
}
function YunxiaoIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
    </svg>
  )
}
function CrashIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  )
}
function LinkIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  )
}
function JenkinsIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function OrchestratorIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <circle cx="6" cy="6" r="3" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="12" r="3" />
      <path d="M9 6h4a5 5 0 0 1 5 5v1M9 18h4a5 5 0 0 0 5-5v-1" />
    </svg>
  )
}


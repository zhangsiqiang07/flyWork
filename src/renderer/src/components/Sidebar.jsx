export default function Sidebar({ currentView, selectedWorkspaceId, workspaces, sessions, inboxCount, onNavigate, onOpenWorkspace }) {
  const activeSessions = sessions.filter(s => s.status === 'active')
  
  const navItems = [
    { id: 'today', label: '今日', icon: <SunIcon /> },
    { id: 'inbox', label: '收件箱', icon: <InboxIcon />, badge: inboxCount > 0 ? inboxCount : null },
    { id: 'automations', label: '自动化', icon: <AutoIcon /> },
    { id: 'activity', label: '活动', icon: <ActivityIcon /> },
  ]

  return (
    <div className="sidebar">
      {/* Active Session Banner */}
      {activeSessions.length > 0 && (
        <div style={{ padding: '0 8px', marginBottom: 8 }}>
          {activeSessions.map(session => {
            const ws = workspaces.find(w => w.id === session.workspaceId)
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
                <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:3 }}>
                  <span style={{ width:6, height:6, borderRadius:'50%', background:'var(--accent-green)', flexShrink:0, boxShadow:'0 0 5px rgba(63,185,80,0.6)' }}/>
                  <span style={{ fontSize:11, fontWeight:600, color:'var(--accent-green)' }}>工作中</span>
                </div>
                <div style={{ fontSize:11, color:'var(--text-primary)', fontWeight:500, lineHeight:1.4, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{session.title}</div>
                {ws && <div style={{ fontSize:10, color:'var(--text-secondary)', marginTop:2 }}>{ws.icon} {ws.name}</div>}
              </div>
            )
          })}
        </div>
      )}

      {/* Main Navigation */}
      <div className="sidebar-section">
        {navItems.map(item => (
          <div
            key={item.id}
            className={`sidebar-item ${currentView === item.id ? 'active' : ''}`}
            onClick={() => onNavigate(item.id)}
          >
            <span className="sidebar-item-icon">{item.icon}</span>
            <span style={{ flex:1 }}>{item.label}</span>
            {item.badge && <span className="sidebar-item-badge">{item.badge > 99 ? '99+' : item.badge}</span>}
          </div>
        ))}
      </div>

      <div className="sidebar-section">
        <div className="sidebar-section-label">工作空间</div>
        {workspaces.map(ws => (
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
            <span style={{ flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{ws.name}</span>
            {ws.buildStatus === 'failed' && (
              <span style={{ width:6, height:6, borderRadius:'50%', background:'var(--accent-red)', flexShrink:0 }}/>
            )}
            {ws.buildStatus === 'success' && sessions.some(s => s.workspaceId === ws.id && s.status === 'active') && (
              <span style={{ width:6, height:6, borderRadius:'50%', background:'var(--accent-green)', flexShrink:0 }}/>
            )}
          </div>
        ))}
        <div
          className="sidebar-item"
          onClick={() => onNavigate('workspaces')}
          style={{ color: 'var(--text-muted)', fontSize: 11 }}
        >
          <span className="sidebar-item-icon">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v8M8 12h8"/></svg>
          </span>
          <span>添加工作空间</span>
        </div>
      </div>
    </div>
  )
}

function SunIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>
}
function InboxIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>
}
function AutoIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
}
function ActivityIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
}

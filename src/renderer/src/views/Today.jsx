import { useState } from 'react'
import ActionRunner from '../components/ActionRunner'

function formatRelTime(iso) {
  const d = new Date(iso)
  const now = new Date()
  const diff = now - d
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`
  return `${Math.floor(diff / 86400000)} 天前`
}

export default function Today({ sessions, workspaces, activityLog, onOpenWorkspace, onResumeSession, onPauseSession, onSetContextPanel }) {
  const [runningAction, setRunningAction] = useState(null)
  const [runningWorkspace, setRunningWorkspace] = useState(null)

  const activeSessions = sessions.filter(s => s.status === 'active')
  const pausedSessions = sessions.filter(s => s.status === 'paused')
  const failedBuilds = workspaces.filter(w => w.buildStatus === 'failed')
  const todayActivity = activityLog.filter(a => {
    const d = new Date(a.timestamp)
    const now = new Date()
    return d.toDateString() === now.toDateString()
  })

  const handleActionClick = (action, workspace) => {
    setRunningAction(action)
    setRunningWorkspace(workspace)
  }

  const greeting = () => {
    const h = new Date().getHours()
    if (h < 6) return '夜深了'
    if (h < 12) return '早上好'
    if (h < 14) return '午安'
    if (h < 18) return '下午好'
    return '晚上好'
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div className="page-header" style={{ background: 'linear-gradient(180deg, rgba(79,158,248,0.04) 0%, transparent 100%)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div className="page-title">
              {greeting()}，今天 {new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' })}
            </div>
            <div className="page-subtitle">
              {activeSessions.length > 0
                ? `${activeSessions.length} 个会话工作中 · ${failedBuilds.length > 0 ? `${failedBuilds.length} 个构建失败` : '构建正常'}`
                : '今天还没有开始工作'}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-secondary btn-sm">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
              新建会话
            </button>
          </div>
        </div>
      </div>

      <div className="page-content" style={{ overflowY: 'auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 24, alignItems: 'start' }}>
          {/* Left column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

            {/* Active Sessions */}
            {activeSessions.length > 0 && (
              <div>
                <div className="section-header">
                  <span className="section-title">🟢 正在进行</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }} className="stagger-children">
                  {activeSessions.map(session => {
                    const ws = workspaces.find(w => w.id === session.workspaceId)
                    return (
                      <div key={session.id} className="card" style={{ padding: 16, animation: 'fadeIn 200ms ease forwards', borderColor: 'rgba(63,185,80,0.2)', background: 'rgba(63,185,80,0.03)' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent-green)', boxShadow: '0 0 8px rgba(63,185,80,0.6)', marginTop: 6, flexShrink: 0, animation: 'pulseGlow 2s ease infinite' }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 3 }}>{session.title}</div>
                            {ws && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{ws.icon} {ws.name}</span>
                                <span style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--accent-blue)', background: 'var(--accent-blue-dim)', padding: '1px 6px', borderRadius: 3 }}>⑂ {session.branch}</span>
                                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>开始于 {formatRelTime(session.startedAt)}</span>
                              </div>
                            )}
                            {session.notes && (
                              <div style={{ fontSize: 12, color: 'var(--text-secondary)', background: 'var(--bg-elevated)', padding: '8px 10px', borderRadius: 6, marginBottom: 10, lineHeight: 1.6 }}>
                                {session.notes}
                              </div>
                            )}
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                              <button className="btn btn-primary btn-sm" onClick={() => onOpenWorkspace(session.workspaceId)}>
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                                进入工作空间
                              </button>
                              <button className="btn btn-secondary btn-sm" onClick={() => onPauseSession(session.id)}>
                                ⏸ 暂停
                              </button>
                              {ws && ws.actions[0] && (
                                <button className="btn btn-ghost btn-sm" onClick={() => handleActionClick(ws.actions[0], ws)}>
                                  ⚙️ {ws.actions[0].name}
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Build Failures */}
            {failedBuilds.length > 0 && (
              <div>
                <div className="section-header">
                  <span className="section-title">❌ 构建异常</span>
                  <span className="badge badge-red" style={{ fontSize: 10 }}>{failedBuilds.length} 个失败</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {failedBuilds.map(ws => (
                    <div key={ws.id} className="card" style={{ borderColor: 'rgba(224,92,92,0.25)', background: 'rgba(224,92,92,0.03)' }}>
                      <div className="build-status-card">
                        <div className="build-status-icon failed">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6M9 9l6 6"/></svg>
                        </div>
                        <div className="build-status-info">
                          <div className="build-status-name">{ws.name}</div>
                          <div className="build-status-desc">{ws.buildMessage}</div>
                          <div className="build-status-meta">耗时 {ws.buildDuration} · {ws.buildTime}</div>
                        </div>
                        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                          <button className="btn btn-ghost btn-sm" onClick={() => { onOpenWorkspace(ws.id); onSetContextPanel('log') }}>查看日志</button>
                          <button className="btn btn-secondary btn-sm" style={{ color: 'var(--accent-purple)', borderColor: 'rgba(163,113,247,0.3)', background: 'var(--accent-purple-dim)' }}>
                            🤖 AI 分析
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Paused Sessions */}
            {pausedSessions.length > 0 && (
              <div>
                <div className="section-header">
                  <span className="section-title">⏸ 可继续的会话</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {pausedSessions.map(session => {
                    const ws = workspaces.find(w => w.id === session.workspaceId)
                    return (
                      <div key={session.id} className="card card-clickable" style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent-amber)', flexShrink: 0 }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{session.title}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                              {ws?.icon} {ws?.name} · 暂停于 {formatRelTime(session.updatedAt)}
                            </div>
                          </div>
                          <button className="btn btn-secondary btn-sm" onClick={() => onResumeSession(session.id)}>
                            ▶ 继续
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* No sessions */}
            {activeSessions.length === 0 && pausedSessions.length === 0 && (
              <div className="empty-state">
                <div style={{ fontSize: 40 }}>☀️</div>
                <div className="empty-state-title">今天还没有开始工作</div>
                <div className="empty-state-desc">选择一个工作空间开始新的会话，或者从命令中心快速启动。</div>
                <button className="btn btn-primary" style={{ marginTop: 8 }}>创建新会话</button>
              </div>
            )}
          </div>

          {/* Right column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Quick access workspaces */}
            <div>
              <div className="section-header">
                <span className="section-title">最近工作空间</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {workspaces.map(ws => (
                  <div
                    key={ws.id}
                    className="card card-clickable"
                    style={{ padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10 }}
                    onClick={() => onOpenWorkspace(ws.id)}
                  >
                    <div style={{ width: 28, height: 28, borderRadius: 6, background: ws.bgColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>{ws.icon}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ws.name}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>⑂ {ws.gitBranch}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      {ws.buildStatus === 'failed' && <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-red)' }}/>}
                      {ws.buildStatus === 'success' && <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-green)' }}/>}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Today's activity */}
            <div>
              <div className="section-header">
                <span className="section-title">今日活动</span>
                <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{todayActivity.length} 条</span>
              </div>
              <div className="timeline">
                {todayActivity.slice(0, 6).map((item) => (
                  <div key={item.id} className="timeline-item">
                    <div className="timeline-icon" style={{ background: `${item.color}22`, border: `1px solid ${item.color}44` }}>
                      <span style={{ fontSize: 12 }}>{item.icon}</span>
                    </div>
                    <div className="timeline-content">
                      <div className="timeline-title">{item.title}</div>
                      <div className="timeline-meta" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>{item.detail}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{formatRelTime(item.timestamp)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Action Runner Modal */}
      {runningAction && (
        <ActionRunner action={runningAction} workspace={runningWorkspace} onClose={() => { setRunningAction(null); setRunningWorkspace(null) }} />
      )}
    </div>
  )
}

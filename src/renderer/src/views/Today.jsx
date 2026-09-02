import { useState, useEffect, useMemo, useCallback } from 'react'
import ActionRunner from '../components/ActionRunner'
import BugOrchestrateModal from '../components/orchestrator/BugOrchestrateModal'
import { MOCK_YUNXIAO_BUGS } from '../data/mockYunxiaoBugs'

function formatRelTime(iso) {
  const d = new Date(iso)
  const now = new Date()
  const diff = now - d
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`
  return `${Math.floor(diff / 86400000)} 天前`
}

export default function Today({
  sessions,
  workspaces,
  activityLog,
  onOpenWorkspace,
  onResumeSession,
  onPauseSession,
  yunxiaoConfigured = false,
  plans = [],
  onOrchestrateBugs,
  onNavigate
}) {
  const [runningAction, setRunningAction] = useState(null)
  const [runningWorkspace, setRunningWorkspace] = useState(null)
  const [authStatus, setAuthStatus] = useState({ checked: false, configured: false, organizationName: '' })
  const [currentUser, setCurrentUser] = useState(null)
  const [assigneeFilter, setAssigneeFilter] = useState('mine') // 'mine' | 'all'
  const [projects, setProjects] = useState([])
  const [selectedProjectId, setSelectedProjectId] = useState('ALL')
  const [yunxiaoBugs, setYunxiaoBugs] = useState([])
  const [loadingBugs, setLoadingBugs] = useState(false)
  const [bugError, setBugError] = useState(null)
  const [selectedTodayBugIds, setSelectedTodayBugIds] = useState(() => new Set())
  const [isBugModalOpen, setIsBugModalOpen] = useState(false)
  const [isDemoMode, setIsDemoMode] = useState(false)

  const loadBugs = useCallback(
    async (projId = selectedProjectId, useDemo = isDemoMode) => {
      if (useDemo) {
        setYunxiaoBugs(MOCK_YUNXIAO_BUGS)
        setCurrentUser({ id: 'u-1', name: 'Alex' })
        return
      }

      try {
        setLoadingBugs(true)
        setBugError(null)

        const auth = await window.flywork?.yunxiaoCheckAuth?.()
        const isConfigured = Boolean(auth?.success && auth?.configured)
        setAuthStatus({
          checked: true,
          configured: isConfigured,
          organizationName: auth?.currentOrganizationName || ''
        })

        if (!isConfigured) {
          setYunxiaoBugs([])
          setCurrentUser(null)
          return
        }

        // Fetch Token user information
        let user = auth?.currentUser || null
        if (!user && window.flywork?.yunxiaoGetCurrentUser) {
          try {
            const userRes = await window.flywork.yunxiaoGetCurrentUser()
            if (userRes?.success && userRes.user) {
              user = userRes.user
            }
          } catch {
            // ignore
          }
        }
        if (!user) {
          try {
            const cached = localStorage.getItem('flywork_yunxiao_user')
            if (cached) user = JSON.parse(cached)
          } catch {
            // ignore
          }
        }
        setCurrentUser(user)

        // Fetch real projects from Yunxiao
        if (window.flywork?.yunxiaoListProjects) {
          try {
            const projRes = await window.flywork.yunxiaoListProjects()
            if (projRes?.success && Array.isArray(projRes.projects)) {
              setProjects(
                projRes.projects.map((p) => ({
                  id: p.identifier || p.id,
                  name: p.name || p.title || p.identifier || p.id
                }))
              )
            }
          } catch (e) {
            console.warn('[Today] Failed to list projects:', e)
          }
        }

        // Fetch real bugs from Yunxiao
        if (window.flywork?.yunxiaoListWorkitems) {
          const params = {
            category: 'Bug',
            perPage: 50
          }
          if (projId && projId !== 'ALL') {
            params.projectId = projId
          }
          const res = await window.flywork.yunxiaoListWorkitems(params)
          if (res?.success && Array.isArray(res.workitems)) {
            setYunxiaoBugs(res.workitems)
          } else {
            if (res?.error) {
              setBugError(res.error)
            }
            setYunxiaoBugs([])
          }
        }
      } catch (err) {
        setBugError(err.message || '加载云效缺陷失败')
        setYunxiaoBugs([])
      } finally {
        setLoadingBugs(false)
      }
    },
    [selectedProjectId, isDemoMode]
  )

  useEffect(() => {
    loadBugs()
  }, [])

  // 1. 状态必须为“待确认”或“处理中”才在今天显示
  const isAllowedTodayBugStatus = (bug) => {
    const raw =
      typeof bug.status === 'object'
        ? bug.status?.name || bug.status?.stage || ''
        : String(bug.status || '')
    const s = raw.trim()
    return s === '待确认' || s === '处理中'
  }

  // 提取当前缺陷列表中所有涉及的负责人列表（用于下拉切换与身份识别）
  const availableAssignees = useMemo(() => {
    const map = new Map()
    for (const bug of yunxiaoBugs) {
      if (!isAllowedTodayBugStatus(bug)) continue
      let id = ''
      let name = ''
      if (bug.assignedTo && typeof bug.assignedTo === 'object') {
        id = String(bug.assignedTo.id || bug.assignedTo.userId || '').trim()
        name = String(
          bug.assignedTo.name ||
            bug.assignedTo.nickName ||
            bug.assignedTo.realName ||
            bug.assignedTo.userName ||
            id
        ).trim()
      } else if (bug.assignedTo) {
        name = String(bug.assignedTo).trim()
        id = String(bug.assignedToId || name).trim()
      } else if (bug.assignedToId) {
        id = String(bug.assignedToId).trim()
        name = String(bug.assignedToName || id).trim()
      }
      if (name || id) {
        const key = (name || id).toLowerCase()
        if (!map.has(key)) {
          map.set(key, { id: id || name, name: name || id })
        }
      }
    }
    return Array.from(map.values())
  }, [yunxiaoBugs])

  // 提取用户的所有标识用于多维度精准比对
  const getUserTokens = (u) => {
    const tokens = new Set()
    if (!u) return tokens
    if (typeof u === 'string') {
      tokens.add(u.trim().toLowerCase())
      return tokens
    }
    const fields = [u.id, u.userId, u.identifier, u.name, u.nickName, u.realName, u.username, u.account, u.email]
    for (const f of fields) {
      if (f && typeof f === 'string') {
        tokens.add(f.trim().toLowerCase())
      }
    }
    return tokens
  }

  // 提取缺陷负责人的所有标识
  const getBugAssigneeTokens = (bug) => {
    const tokens = new Set()
    if (!bug) return tokens

    if (bug.assignedTo && typeof bug.assignedTo === 'object') {
      const a = bug.assignedTo
      const fields = [a.id, a.userId, a.identifier, a.name, a.nickName, a.realName, a.userName, a.account, a.email]
      for (const f of fields) {
        if (f && typeof f === 'string') tokens.add(f.trim().toLowerCase())
      }
    } else if (bug.assignedTo) {
      tokens.add(String(bug.assignedTo).trim().toLowerCase())
    }

    if (bug.assignedToId) tokens.add(String(bug.assignedToId).trim().toLowerCase())
    if (bug.assignedToName) tokens.add(String(bug.assignedToName).trim().toLowerCase())
    if (bug.assignee) {
      if (typeof bug.assignee === 'object') {
        if (bug.assignee.id) tokens.add(String(bug.assignee.id).trim().toLowerCase())
        if (bug.assignee.name) tokens.add(String(bug.assignee.name).trim().toLowerCase())
      } else {
        tokens.add(String(bug.assignee).trim().toLowerCase())
      }
    }
    return tokens
  }

  // 2. 负责人必须匹配当前 Token 用户或选定的负责人
  const isBugAssignedToUser = (bug, user, filterMode) => {
    if (filterMode === 'all') return true

    // 如果指定了特定负责人的名字或 ID（既不是 'mine' 也不是 'all'）
    if (filterMode && filterMode !== 'mine') {
      const targetToken = filterMode.trim().toLowerCase()
      const bugTokens = getBugAssigneeTokens(bug)
      return bugTokens.has(targetToken)
    }

    // 默认 'mine'：精准匹配当前 Token 用户
    let targetUser = user
    if (!targetUser) {
      try {
        const cached = localStorage.getItem('flywork_yunxiao_user')
        if (cached) targetUser = JSON.parse(cached)
      } catch {}
    }

    // 关键：若无法识别当前用户，绝不放行所有人！
    if (!targetUser) {
      return false
    }

    const userTokens = getUserTokens(targetUser)
    const bugTokens = getBugAssigneeTokens(bug)

    for (const ut of userTokens) {
      if (bugTokens.has(ut)) return true
    }
    return false
  }

  // 综合过滤：仅状态为待确认、处理中，且负责人符合筛选条件的缺陷
  const todayBugs = useMemo(() => {
    return yunxiaoBugs.filter((bug) => {
      if (!isAllowedTodayBugStatus(bug)) return false
      return isBugAssignedToUser(bug, currentUser, assigneeFilter)
    })
  }, [yunxiaoBugs, currentUser, assigneeFilter])

  const selectedBugs = useMemo(() => {
    return todayBugs.filter((b) => selectedTodayBugIds.has(b.identifier || b.id))
  }, [todayBugs, selectedTodayBugIds])

  const toggleSelectTodayBug = (id) => {
    setSelectedTodayBugIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const activeSessions = sessions.filter((s) => s.status === 'active')
  const failedBuilds = workspaces.filter((w) => w.buildStatus === 'failed')
  const unfinishedPlans = useMemo(() => {
    return (plans || []).filter((plan) => {
      if (!plan) return false
      const s = String(plan.status || '').toUpperCase()
      if (s === 'DONE' || s === 'COMPLETED') return false
      const tasks = plan.tasks || []
      if (tasks.length > 0 && tasks.every((t) => String(t.status).toUpperCase() === 'DONE')) {
        return false
      }
      return true
    })
  }, [plans])
  const todayActivity = activityLog.filter((a) => {
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
      <div
        className="page-header"
        style={{
          background: 'linear-gradient(180deg, rgba(79,158,248,0.04) 0%, transparent 100%)',
          padding: '16px 24px'
        }}
      >
        <div style={{ maxWidth: 1040, margin: '0 auto', width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div className="page-title">
                {greeting()}，今天 {new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' })}
              </div>
              <div className="page-subtitle">
                {unfinishedPlans.length > 0 || todayBugs.length > 0
                  ? `${unfinishedPlans.length > 0 ? `${unfinishedPlans.length} 个智能编排需求待推进` : ''}${unfinishedPlans.length > 0 && todayBugs.length > 0 ? ' · ' : ''}${todayBugs.length > 0 ? `${todayBugs.length} 个云效待办缺陷` : ''}`
                  : activeSessions.length > 0
                    ? `${activeSessions.length} 个会话工作中 · ${failedBuilds.length > 0 ? `${failedBuilds.length} 个构建失败` : '构建正常'}`
                    : '今天工作台运转良好'}
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
      </div>

      <div className="page-content" style={{ overflowY: 'auto' }}>
        <div style={{ maxWidth: 1040, margin: '0 auto', width: '100%' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 20, alignItems: 'start' }}>
            {/* Left column */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

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

            {/* Yunxiao Pending Bugs in Workbench */}
            <div>
              <div
                className="section-header"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 8
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="section-title">🐛 云效待办缺陷</span>
                  <span
                    className="badge"
                    style={{
                      fontSize: 10,
                      background: 'rgba(79,158,248,0.1)',
                      color: 'var(--accent-blue)',
                      border: '1px solid rgba(79,158,248,0.25)'
                    }}
                    title="仅显示状态为待确认、处理中的缺陷"
                  >
                    待确认 · 处理中
                  </span>
                  {isDemoMode ? (
                    <span
                      className="badge"
                      style={{
                        background: 'rgba(210,153,34,0.15)',
                        color: 'var(--accent-amber)',
                        fontSize: 10,
                        border: '1px solid rgba(210,153,34,0.3)'
                      }}
                    >
                      演示数据
                    </span>
                  ) : authStatus.configured ? (
                    <span
                      className="badge"
                      style={{
                        background: 'rgba(63,185,80,0.15)',
                        color: 'var(--accent-green)',
                        fontSize: 10,
                        border: '1px solid rgba(63,185,80,0.3)'
                      }}
                    >
                      已连接{authStatus.organizationName ? ` · ${authStatus.organizationName}` : ''}
                    </span>
                  ) : (
                    <span
                      className="badge"
                      style={{
                        background: 'rgba(255,255,255,0.06)',
                        color: 'var(--text-muted)',
                        fontSize: 10
                      }}
                    >
                      未连接
                    </span>
                  )}

                  <span className="badge badge-red" style={{ fontSize: 10 }}>
                    {todayBugs.length} 个待处理
                  </span>
                </div>

                {/* Right Toolbar */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {authStatus.configured && (
                    <select
                      value={assigneeFilter}
                      onChange={(e) => setAssigneeFilter(e.target.value)}
                      style={{
                        fontSize: 11,
                        padding: '2px 8px',
                        borderRadius: 4,
                        background: 'var(--bg-elevated)',
                        color: 'var(--text-primary)',
                        border: '1px solid var(--border)'
                      }}
                      title="负责人筛选（默认只看我的待办）"
                    >
                      <option value="mine">
                        👤 我的待办 {currentUser?.name ? `(${currentUser.name})` : '(当前用户)'}
                      </option>
                      {availableAssignees
                        .filter((a) => {
                          if (currentUser?.name && a.name.toLowerCase() === currentUser.name.toLowerCase()) return false
                          return true
                        })
                        .map((a) => (
                          <option key={a.id || a.name} value={a.name || a.id}>
                            👤 负责人: {a.name}
                          </option>
                        ))}
                      <option value="all">👥 全部负责人 ({yunxiaoBugs.length})</option>
                    </select>
                  )}

                  {authStatus.configured && projects.length > 0 && !isDemoMode && (
                    <select
                      value={selectedProjectId}
                      onChange={(e) => {
                        const nextId = e.target.value
                        setSelectedProjectId(nextId)
                        loadBugs(nextId, false)
                      }}
                      style={{
                        fontSize: 11,
                        padding: '2px 8px',
                        borderRadius: 4,
                        background: 'var(--bg-elevated)',
                        color: 'var(--text-primary)',
                        border: '1px solid var(--border)'
                      }}
                    >
                      <option value="ALL">全部项目 ({projects.length})</option>
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  )}

                  {authStatus.configured && (
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => loadBugs(selectedProjectId, false)}
                      disabled={loadingBugs}
                      style={{ fontSize: 11, padding: '2px 8px' }}
                      title="从云效重新同步"
                    >
                      🔄 刷新
                    </button>
                  )}

                  {isDemoMode && (
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => {
                        setIsDemoMode(false)
                        loadBugs(selectedProjectId, false)
                      }}
                      style={{ fontSize: 11, color: 'var(--accent-amber)', padding: '2px 8px' }}
                    >
                      退出演示
                    </button>
                  )}

                  {todayBugs.length > 0 && (
                    <>
                      {selectedTodayBugIds.size > 0 && (
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => setIsBugModalOpen(true)}
                          style={{
                            background: 'linear-gradient(135deg, #4f9ef8, #8b5cf6)',
                            border: 'none',
                            fontSize: 11,
                            padding: '3px 10px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4
                          }}
                        >
                          <span>🚀</span>
                          <span>智能编排处理 ({selectedTodayBugIds.size})</span>
                        </button>
                      )}
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => {
                          if (selectedTodayBugIds.size === todayBugs.length) {
                            setSelectedTodayBugIds(new Set())
                          } else {
                            setSelectedTodayBugIds(
                              new Set(todayBugs.map((b) => b.identifier || b.id))
                            )
                          }
                        }}
                        style={{ fontSize: 11, padding: '2px 8px' }}
                      >
                        {selectedTodayBugIds.size === todayBugs.length ? '取消全选' : '全选'}
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Bug List Content */}
              {loadingBugs ? (
                <div
                  className="card"
                  style={{
                    padding: 24,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8
                  }}
                >
                  <div style={{ fontSize: 22 }}>⏳</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    正在从企业云效同步待办缺陷...
                  </div>
                </div>
              ) : !authStatus.configured && !isDemoMode ? (
                <div
                  className="card"
                  style={{
                    padding: '16px 20px',
                    background: 'var(--bg-elevated)',
                    border: '1px dashed var(--border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 16
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 8,
                        background: 'rgba(79,158,248,0.1)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 18,
                        flexShrink: 0
                      }}
                    >
                      ☁️
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                        尚未连接云效协同组织
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                        配置个人访问令牌后，将自动同步指派给您的待确认 / 处理中缺陷，支持一键分发智能编排。
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => onNavigate && onNavigate('yunxiao-settings')}
                      style={{
                        background: 'linear-gradient(135deg, #4f9ef8, #8b5cf6)',
                        border: 'none',
                        fontSize: 12
                      }}
                    >
                      ⚙️ 前往配置云效
                    </button>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => {
                        setIsDemoMode(true)
                        loadBugs('ALL', true)
                      }}
                      style={{ fontSize: 11 }}
                      title="使用预置模拟缺陷体验编排流程"
                    >
                      体验演示缺陷
                    </button>
                  </div>
                </div>
              ) : bugError ? (
                <div
                  className="card"
                  style={{
                    padding: '16px 20px',
                    background: 'rgba(224,92,92,0.06)',
                    borderColor: 'rgba(224,92,92,0.25)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}
                >
                  <div style={{ fontSize: 12, color: 'var(--accent-red)' }}>
                    ❌ 同步云效缺陷失败：{bugError}
                  </div>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => loadBugs(selectedProjectId, false)}
                    style={{ fontSize: 11 }}
                  >
                    重试
                  </button>
                </div>
              ) : todayBugs.length === 0 ? (
                <div
                  className="card"
                  style={{
                    padding: '20px',
                    textAlign: 'center',
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border)'
                  }}
                >
                  <div style={{ fontSize: 22, marginBottom: 4 }}>
                    {!currentUser && availableAssignees.length > 0 ? '👤' : '🎉'}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                    {!currentUser && availableAssignees.length > 0
                      ? '请确认您的云效成员身份以过滤“我的待办”'
                      : yunxiaoBugs.length > 0
                        ? `当前没有指派给「${currentUser?.name || currentUser?.username || '您'}」的待确认 / 处理中缺陷`
                        : '当前暂无待办缺陷'}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                    {!currentUser && availableAssignees.length > 0
                      ? `已从云效同步 ${yunxiaoBugs.length} 项待办缺陷。请点击您在云效中的姓名，系统将自动记住并仅展示您的缺陷：`
                      : yunxiaoBugs.length > 0
                        ? `已从云效同步 ${yunxiaoBugs.length} 项缺陷，当前筛选条件（负责人: ${currentUser?.name || 'Token 用户'}，状态: 待确认/处理中）下暂无匹配项。`
                        : '所有缺陷已修复或关闭，工作台运转良好。'}
                  </div>
                  {!currentUser && availableAssignees.length > 0 ? (
                    <div
                      style={{
                        display: 'flex',
                        gap: 8,
                        justifyContent: 'center',
                        flexWrap: 'wrap',
                        marginTop: 12
                      }}
                    >
                      {availableAssignees.map((a) => (
                        <button
                          key={a.id || a.name}
                          className="btn btn-secondary btn-sm"
                          onClick={() => {
                            const userObj = { id: a.id, name: a.name }
                            setCurrentUser(userObj)
                            localStorage.setItem('flywork_yunxiao_user', JSON.stringify(userObj))
                            if (window.flywork?.yunxiaoSetCurrentUser) {
                              window.flywork.yunxiaoSetCurrentUser(userObj)
                            }
                          }}
                          style={{
                            fontSize: 11,
                            padding: '4px 10px',
                            color: 'var(--accent-blue)',
                            borderColor: 'rgba(79,158,248,0.3)',
                            background: 'rgba(79,158,248,0.08)'
                          }}
                        >
                          我是「{a.name}」
                        </button>
                      ))}
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => setAssigneeFilter('all')}
                        style={{ fontSize: 11 }}
                      >
                        查看全部 ({yunxiaoBugs.length})
                      </button>
                    </div>
                  ) : yunxiaoBugs.length > 0 && assigneeFilter === 'mine' ? (
                    <div style={{ marginTop: 10 }}>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => setAssigneeFilter('all')}
                        style={{ fontSize: 11, color: 'var(--accent-blue)' }}
                      >
                        查看项目下全部负责人缺陷 ({yunxiaoBugs.length})
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {todayBugs.map((bug) => {
                    const id = bug.identifier || bug.id
                    const isChecked = selectedTodayBugIds.has(id)
                    const serial = bug.serialNumber || id
                    const title = bug.subject || bug.name || bug.title || '未命名缺陷'
                    const statusName =
                      typeof bug.status === 'object'
                        ? bug.status?.name || '待确认'
                        : bug.status || '待确认'
                    const assigneeName =
                      typeof bug.assignedTo === 'object'
                        ? bug.assignedTo?.name || '未指派'
                        : bug.assignedTo || '未指派'
                    const projectName = bug.projectName || bug.project?.name

                    return (
                      <div
                        key={id}
                        className="card"
                        style={{
                          padding: '10px 14px',
                          background: isChecked ? 'rgba(79,158,248,0.06)' : 'var(--bg-elevated)',
                          borderColor: isChecked ? 'var(--accent-blue)' : 'var(--border)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          cursor: 'pointer',
                          transition: 'all 120ms ease'
                        }}
                        onClick={() => toggleSelectTodayBug(id)}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            e.stopPropagation()
                            toggleSelectTodayBug(id)
                          }}
                          onClick={(e) => e.stopPropagation()}
                          style={{ cursor: 'pointer', width: 15, height: 15, flexShrink: 0 }}
                          title="勾选用于智能编排"
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            <span
                              style={{
                                fontFamily: 'monospace',
                                fontSize: 11,
                                fontWeight: 700,
                                color: 'var(--accent-red)',
                                background: 'rgba(224,92,92,0.15)',
                                padding: '1px 5px',
                                borderRadius: 3,
                                flexShrink: 0
                              }}
                            >
                              {serial}
                            </span>
                            {projectName && (
                              <span
                                style={{
                                  fontSize: 10,
                                  color: 'var(--accent-blue)',
                                  background: 'rgba(79,158,248,0.1)',
                                  padding: '1px 5px',
                                  borderRadius: 3,
                                  flexShrink: 0
                                }}
                              >
                                {projectName}
                              </span>
                            )}
                            <span
                              className="badge"
                              style={{
                                fontSize: 10,
                                fontWeight: 600,
                                padding: '1px 6px',
                                borderRadius: 3,
                                background:
                                  statusName === '待确认'
                                    ? 'rgba(210,153,34,0.15)'
                                    : 'rgba(79,158,248,0.15)',
                                color:
                                  statusName === '待确认'
                                    ? 'var(--accent-amber)'
                                    : 'var(--accent-blue)',
                                border: `1px solid ${statusName === '待确认' ? 'rgba(210,153,34,0.3)' : 'rgba(79,158,248,0.3)'}`,
                                flexShrink: 0
                              }}
                            >
                              {statusName}
                            </span>
                            <span
                              style={{
                                fontSize: 13,
                                fontWeight: 600,
                                color: 'var(--text-primary)',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                maxWidth: 360
                              }}
                              title={title}
                            >
                              {title}
                            </span>
                          </div>
                          <div
                            style={{
                              fontSize: 11,
                              color: 'var(--text-muted)',
                              marginTop: 3,
                              display: 'flex',
                              alignItems: 'center',
                              gap: 10
                            }}
                          >
                            <span>👤 负责人：{assigneeName}</span>
                            {bug.severity && <span>⚡ 严重程度：{bug.severity}</span>}
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                          {!isDemoMode && (
                            <button
                              className="btn btn-ghost btn-sm"
                              onClick={(e) => {
                                e.stopPropagation()
                                if (window.flywork?.yunxiaoOpenWorkitemDetail) {
                                  window.flywork.yunxiaoOpenWorkitemDetail(id)
                                }
                              }}
                              style={{ fontSize: 10, color: 'var(--text-muted)', padding: '2px 6px' }}
                              title="在独立窗口中查看云效详情"
                            >
                              云效详情 ↗
                            </button>
                          )}
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              setSelectedTodayBugIds(new Set([id]))
                              setIsBugModalOpen(true)
                            }}
                            style={{
                              fontSize: 11,
                              padding: '2px 8px',
                              color: 'var(--accent-blue)',
                              borderColor: 'rgba(79,158,248,0.3)',
                              background: 'rgba(79,158,248,0.08)'
                            }}
                          >
                            🤖 编排处理
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

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
                          <button className="btn btn-ghost btn-sm" onClick={() => onOpenWorkspace(ws.id)}>查看工作区</button>
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

            {/* Unfinished Orchestration Requirements */}
            <div>
              <div
                className="section-header"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 10
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="section-title">🧩 智能编排 · 未完成需求</span>
                  {unfinishedPlans.length > 0 && (
                    <span
                      className="badge"
                      style={{
                        fontSize: 10,
                        background: 'rgba(139,92,246,0.12)',
                        color: 'var(--accent-purple)',
                        border: '1px solid rgba(139,92,246,0.25)'
                      }}
                    >
                      {unfinishedPlans.length} 个需求推进中
                    </span>
                  )}
                </div>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => onNavigate && onNavigate('orchestrator')}
                  style={{ fontSize: 11, color: 'var(--accent-blue)', padding: '2px 6px' }}
                >
                  前往智能编排 ↗
                </button>
              </div>

              {unfinishedPlans.length === 0 ? (
                <div
                  className="card"
                  style={{
                    padding: '16px 20px',
                    textAlign: 'center',
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border)'
                  }}
                >
                  <div style={{ fontSize: 20, marginBottom: 4 }}>✨</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                    暂无未完成的智能编排需求
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                    所有需求与缺陷编排任务均已交付完成，可在「智能编排」模块新建或导入 PRD 需求。
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {unfinishedPlans.map((plan) => {
                    const totalTasks = plan.tasks?.length || 0
                    const doneTasks = (plan.tasks || []).filter((t) => t.status === 'DONE').length
                    const runningTasks = (plan.tasks || []).filter(
                      (t) => t.status === 'RUNNING' || t.status === 'IN_PROGRESS'
                    ).length
                    const progressPercent =
                      totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0
                    const activeTask =
                      (plan.tasks || []).find((t) => t.status === 'RUNNING') ||
                      (plan.tasks || []).find((t) => t.status === 'READY')
                    const projectsCount = plan.projects?.length || 0

                    return (
                      <div
                        key={plan.id}
                        className="card card-clickable"
                        style={{
                          padding: '12px 16px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 8,
                          transition: 'all 120ms ease',
                          borderColor: runningTasks > 0 ? 'rgba(79,158,248,0.35)' : 'var(--border)'
                        }}
                        onClick={() => onNavigate && onNavigate('orchestrator', plan.id)}
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            justifyContent: 'space-between',
                            gap: 12
                          }}
                        >
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                              <span
                                style={{
                                  fontSize: 10,
                                  fontFamily: 'monospace',
                                  fontWeight: 700,
                                  color: 'var(--accent-purple)',
                                  background: 'rgba(139,92,246,0.12)',
                                  padding: '1px 6px',
                                  borderRadius: 3
                                }}
                              >
                                {plan.version || 'PRD'}
                              </span>
                              <span
                                style={{
                                  fontSize: 13,
                                  fontWeight: 600,
                                  color: 'var(--text-primary)',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                  maxWidth: 380
                                }}
                                title={plan.title}
                              >
                                {plan.title}
                              </span>
                              {runningTasks > 0 ? (
                                <span
                                  className="badge"
                                  style={{
                                    fontSize: 10,
                                    background: 'rgba(79,158,248,0.15)',
                                    color: 'var(--accent-blue)',
                                    border: '1px solid rgba(79,158,248,0.3)'
                                  }}
                                >
                                  ⚡ {runningTasks} 个任务执行中
                                </span>
                              ) : (
                                <span
                                  className="badge"
                                  style={{
                                    fontSize: 10,
                                    background: 'rgba(210,153,34,0.12)',
                                    color: 'var(--accent-amber)',
                                    border: '1px solid rgba(210,153,34,0.25)'
                                  }}
                                >
                                  待继续执行
                                </span>
                              )}
                            </div>

                            {plan.description && (
                              <div
                                style={{
                                  fontSize: 11,
                                  color: 'var(--text-secondary)',
                                  marginTop: 3,
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                  maxWidth: 480
                                }}
                              >
                                {plan.description}
                              </div>
                            )}
                          </div>

                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              onNavigate && onNavigate('orchestrator', plan.id)
                            }}
                            style={{
                              fontSize: 11,
                              padding: '3px 10px',
                              flexShrink: 0,
                              color: 'var(--accent-purple)',
                              borderColor: 'rgba(139,92,246,0.3)',
                              background: 'rgba(139,92,246,0.08)'
                            }}
                          >
                            🚀 进入编排
                          </button>
                        </div>

                        {/* Progress and task meta */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              fontSize: 11,
                              color: 'var(--text-muted)'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <span>
                                进度：<strong style={{ color: 'var(--text-primary)' }}>{progressPercent}%</strong> ({doneTasks}/{totalTasks} 任务完成)
                              </span>
                              {projectsCount > 0 && <span>跨 {projectsCount} 端工程协同</span>}
                            </div>
                            {plan.leadPm && <span>产品负责人：{plan.leadPm}</span>}
                          </div>

                          {/* Progress Bar */}
                          <div
                            style={{
                              width: '100%',
                              height: 5,
                              background: 'var(--bg-base)',
                              borderRadius: 3,
                              overflow: 'hidden'
                            }}
                          >
                            <div
                              style={{
                                width: `${progressPercent}%`,
                                height: '100%',
                                background:
                                  progressPercent === 100
                                    ? 'var(--accent-green)'
                                    : 'linear-gradient(90deg, #4f9ef8, #8b5cf6)',
                                transition: 'width 200ms ease'
                              }}
                            />
                          </div>

                          {activeTask && (
                            <div
                              style={{
                                fontSize: 11,
                                color: 'var(--text-secondary)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                                marginTop: 1
                              }}
                            >
                              <span style={{ color: 'var(--accent-blue)' }}>▶ 当前推进任务:</span>
                              <span style={{ fontFamily: 'monospace', fontSize: 10, color: 'var(--text-muted)' }}>[{activeTask.id}]</span>
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 360 }}>{activeTask.title}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* No items overall empty state */}
            {activeSessions.length === 0 && unfinishedPlans.length === 0 && todayBugs.length === 0 && (
              <div className="empty-state">
                <div style={{ fontSize: 40 }}>☀️</div>
                <div className="empty-state-title">今天还没有开始工作</div>
                <div className="empty-state-desc">选择一个工作空间开始新的会话，或者从智能编排与缺陷中心快速启动。</div>
                <button
                  className="btn btn-primary"
                  style={{ marginTop: 8 }}
                  onClick={() => onNavigate && onNavigate('orchestrator')}
                >
                  进入智能编排
                </button>
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
              <div className="section-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span className="section-title">今日活动</span>
                <span
                  style={{ fontSize: 11, color: 'var(--accent-blue)', cursor: 'pointer' }}
                  onClick={() => onNavigate && onNavigate('settings')}
                >
                  审计日志 →
                </span>
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
    </div>

      {/* Action Runner Modal */}
      {runningAction && (
        <ActionRunner action={runningAction} workspace={runningWorkspace} onClose={() => { setRunningAction(null); setRunningWorkspace(null) }} />
      )}

      {/* Bug Orchestrate Modal */}
      {isBugModalOpen && (
        <BugOrchestrateModal
          isOpen={isBugModalOpen}
          bugs={selectedBugs}
          plans={plans}
          workspaces={workspaces}
          onClose={() => setIsBugModalOpen(false)}
          onConfirm={(payload) => {
            setIsBugModalOpen(false)
            setSelectedTodayBugIds(new Set())
            if (onOrchestrateBugs) {
              onOrchestrateBugs(payload)
            }
          }}
        />
      )}
    </div>
  )
}

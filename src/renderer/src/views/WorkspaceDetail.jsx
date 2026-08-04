import { useState, useEffect, useCallback } from 'react'
import ActionRunner from '../components/ActionRunner'
import EditWorkspaceModal from '../components/EditWorkspaceModal'
import GitCreateBranchModal from '../components/GitCreateBranchModal'
import GitAiCommitModal from '../components/GitAiCommitModal'

function formatRelTime(iso) {
  const d = new Date(iso)
  const now = new Date()
  const diff = now - d
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`
  return `${Math.floor(diff / 86400000)}天前`
}

const TABS = ['概览', 'Git', '动作', '构建', '会话', '活动']

const RISK_CONFIG = {
  readonly: { label: '只读', color: 'var(--text-secondary)', bg: 'var(--bg-hover)' },
  normal: { label: '普通', color: 'var(--accent-blue)', bg: 'var(--accent-blue-dim)' },
  modify: { label: '修改', color: 'var(--accent-amber)', bg: 'var(--accent-amber-dim)' },
  high: { label: '高风险', color: 'var(--accent-red)', bg: 'var(--accent-red-dim)' }
}

export default function WorkspaceDetail({ workspace: ws, sessions, activityLog, automations, onResumeSession, onPauseSession, onBack, onSetContextPanel, onUpdateWorkspace, onDeleteWorkspace }) {
  const [activeTab, setActiveTab] = useState('概览')
  const [runningAction, setRunningAction] = useState(null)
  const [newSessionTitle, setNewSessionTitle] = useState('')
  const [showNewSession, setShowNewSession] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)

  // Git states
  const [liveGitInfo, setLiveGitInfo] = useState(null)
  const [branches, setBranches] = useState([])
  const [commitLog, setCommitLog] = useState([])
  const [showCreateBranchModal, setShowCreateBranchModal] = useState(false)
  const [showAiCommitModal, setShowAiCommitModal] = useState(false)
  const [gitNotice, setGitNotice] = useState('')
  const [isGitOperating, setIsGitOperating] = useState(false)
  const [isGitLoading, setIsGitLoading] = useState(false)

  const refreshGitData = useCallback(async () => {
    if (!ws?.root) return
    setIsGitLoading(true)
    try {
      const [info, branchesRes, logs] = await Promise.all([
        window.flywork?.getGitInfo ? window.flywork.getGitInfo(ws.root) : Promise.resolve(null),
        window.flywork?.gitGetBranches ? window.flywork.gitGetBranches(ws.root) : Promise.resolve(null),
        window.flywork?.gitGetLog ? window.flywork.gitGetLog(ws.root) : Promise.resolve([])
      ])
      if (info) setLiveGitInfo(info)
      if (branchesRes && Array.isArray(branchesRes.branches)) setBranches(branchesRes.branches)
      if (Array.isArray(logs)) setCommitLog(logs)
    } finally {
      setIsGitLoading(false)
    }
  }, [ws?.root])

  const [selectedAgentTab, setSelectedAgentTab] = useState(ws?.defaultAgent || 'ChatGPT / Codex')
  const [nativeAgentSessions, setNativeAgentSessions] = useState([])
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 12

  const loadNativeSessions = useCallback(async () => {
    if (!ws || !window.flywork?.getAgentProjectSessions) return
    const targetPath = selectedAgentTab.includes('Claude') ? (ws.claudeProjectPath || ws.root) : (ws.codexProjectPath || ws.root)
    const list = await window.flywork.getAgentProjectSessions(selectedAgentTab, targetPath, ws.name)
    setNativeAgentSessions(list || [])
    setCurrentPage(1)
  }, [ws, selectedAgentTab])

  useEffect(() => {
    if (activeTab === 'Git' || activeTab === '概览') {
      refreshGitData()
    }
    if (activeTab === '会话') {
      loadNativeSessions()
    }
  }, [refreshGitData, loadNativeSessions, activeTab, selectedAgentTab])

  const showGitToast = (msg) => {
    setGitNotice(msg)
    setTimeout(() => setGitNotice(''), 4000)
  }

  const handleSwitchBranch = async (targetBranch) => {
    if (!targetBranch || isGitOperating) return
    setIsGitOperating(true)
    try {
      const res = await window.flywork?.gitCheckout(ws.root, targetBranch)
      if (res?.success) {
        showGitToast(`✓ 已成功切换至分支 ${targetBranch}`)
        refreshGitData()
      } else {
        showGitToast(`❌ 切换失败: ${res?.error || '是否有未提交改动冲掉？'}`)
      }
    } finally {
      setIsGitOperating(false)
    }
  }

  const handleCreateBranch = async (newBranch, baseBranch) => {
    if (isGitOperating) return { success: false, error: '正在操作中' }
    setIsGitOperating(true)
    try {
      const res = await window.flywork?.gitCreateBranch(ws.root, newBranch, baseBranch)
      if (res?.success) {
        showGitToast(`✓ 成功建并切至新分支 ${newBranch}`)
        refreshGitData()
      }
      return res
    } finally {
      setIsGitOperating(false)
    }
  }

  const handlePush = async () => {
    setIsGitOperating(true)
    showGitToast('正在推送代码至远程仓库...')
    try {
      const res = await window.flywork?.gitPush(ws.root)
      if (res?.success) showGitToast(`✓ 推送成功: ${res.output}`)
      else showGitToast(`❌ 推送失败: ${res?.error}`)
      refreshGitData()
    } finally {
      setIsGitOperating(false)
    }
  }

  const handlePull = async () => {
    setIsGitOperating(true)
    showGitToast('正在拉取远程代码并变基...')
    try {
      const res = await window.flywork?.gitPull(ws.root)
      if (res?.success) showGitToast(`✓ 拉取成功: ${res.output}`)
      else showGitToast(`❌ 拉取失败: ${res?.error}`)
      refreshGitData()
    } finally {
      setIsGitOperating(false)
    }
  }

  const handleStash = async () => {
    setIsGitOperating(true)
    try {
      const res = await window.flywork?.gitStash(ws.root, 'flyWork Stash')
      if (res?.success) showGitToast('✓ 已暂存当前工作区修改 (Git Stash)')
      else showGitToast(`❌ Stash 失败: ${res?.error}`)
      refreshGitData()
    } finally {
      setIsGitOperating(false)
    }
  }

  const handleStashPop = async () => {
    setIsGitOperating(true)
    try {
      const res = await window.flywork?.gitStashPop(ws.root)
      if (res?.success) showGitToast('✓ 已恢复暂存代码 (Stash Pop)')
      else showGitToast(`❌ 恢复失败: ${res?.error}`)
      refreshGitData()
    } finally {
      setIsGitOperating(false)
    }
  }

  const handleDiscard = async (file = null) => {
    const targetName = file || '全部未提交修改'
    if (!confirm(`确定要放弃 ${targetName} 吗？此操作无法撤销。`)) return
    setIsGitOperating(true)
    try {
      const res = await window.flywork?.gitDiscard(ws.root, file)
      if (res?.success) showGitToast(`✓ 已还原 ${targetName}`)
      else showGitToast(`❌ 还原失败: ${res?.error}`)
      refreshGitData()
    } finally {
      setIsGitOperating(false)
    }
  }

  const gitBranch = liveGitInfo?.gitBranch || ws.gitBranch || 'main'
  const gitModifiedFiles = liveGitInfo?.gitModifiedFiles || ws.gitModifiedFiles || []
  const lastCommit = liveGitInfo?.lastCommit || ws.lastCommit || '无提交历史'
  const lastCommitHash = liveGitInfo?.lastCommitHash || ws.lastCommitHash || ''
  const lastCommitTime = liveGitInfo?.lastCommitTime || ws.lastCommitTime || ''

  const activeSession = sessions.find(s => s.status === 'active')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={onBack} title="返回">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6"/></svg>
          </button>
          <div
            onClick={() => setShowEditModal(true)}
            style={{ width: 36, height: 36, borderRadius: 10, background: ws.bgColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, cursor: 'pointer' }}
            title="点击修改图标"
          >
            {ws.icon}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div className="page-title" style={{ margin: 0, fontSize: 18 }}>{ws.name}</div>
              <button
                className="btn btn-ghost btn-icon btn-sm"
                onClick={() => setShowEditModal(true)}
                title="修改名称及图标"
                style={{ opacity: 0.7, padding: '2px 4px' }}
              >
                ✏️
              </button>
              {ws.buildStatus === 'failed' ? (
                <span className="badge badge-red" style={{ fontSize: 10 }}>❌ 构建失败</span>
              ) : (
                <span className="badge badge-green" style={{ fontSize: 10 }}>✓ 正常</span>
              )}
              {activeSession && <span className="badge badge-green" style={{ fontSize: 10, animation: 'pulseGlow 2s infinite' }}>🟢 工作中</span>}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{ws.root}</div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {onDeleteWorkspace && (
              <button
                className="btn btn-ghost btn-sm"
                style={{ color: 'var(--accent-red)', fontSize: 11 }}
                onClick={() => {
                  if (confirm(`确定要删除工作空间 "${ws.name}" 吗？`)) {
                    onDeleteWorkspace(ws.id)
                  }
                }}
                title="删除该工作空间"
              >
                🗑️ 删除空间
              </button>
            )}
            {activeSession ? (
              <button className="btn btn-secondary btn-sm" onClick={() => onPauseSession(activeSession.id)}>⏸ 暂停会话</button>
            ) : (
              <button className="btn btn-primary btn-sm" onClick={() => setShowNewSession(true)}>▶ 开始工作</button>
            )}
            <button className="btn btn-ghost btn-icon btn-sm" onClick={() => onSetContextPanel('context')}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            </button>
          </div>
        </div>

        {/* New session input */}
        {showNewSession && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 8, animation: 'fadeIn 150ms ease' }}>
            <input
              className="quick-input"
              style={{ flex: 1, padding: '8px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--accent-blue)', borderRadius: 6, color: 'var(--text-primary)', fontSize: 13 }}
              placeholder="描述这次工作会话..."
              value={newSessionTitle}
              onChange={e => setNewSessionTitle(e.target.value)}
              autoFocus
            />
            <button className="btn btn-primary btn-sm" disabled={!newSessionTitle.trim()}>创建会话</button>
            <button className="btn btn-ghost btn-sm" onClick={() => { setShowNewSession(false); setNewSessionTitle('') }}>取消</button>
          </div>
        )}

        <div className="tab-bar" style={{ padding: '0 0', borderBottom: 'none' }}>
          {TABS.map(tab => (
            <button key={tab} className={`tab-item ${activeTab === tab ? 'active' : ''}`} onClick={() => setActiveTab(tab)}>{tab}</button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="page-content" style={{ overflowY: 'auto' }}>

        {activeTab === '概览' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            {/* Git Status */}
            <div className="card" style={{ padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>GIT 状态</div>
                <span style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--accent-blue)', background: 'var(--accent-blue-dim)', padding: '2px 8px', borderRadius: 4 }}>⑂ {gitBranch}</span>
              </div>
              <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
                <div className="stat-item">
                  <div className="stat-value" style={{ fontSize: 22 }}>{gitModifiedFiles.length}</div>
                  <div className="stat-label">修改文件</div>
                </div>
                <div className="stat-item">
                  <div className="stat-value" style={{ fontSize: 22, color: 'var(--accent-green)' }}>↑0</div>
                  <div className="stat-label">待推送</div>
                </div>
              </div>
              <div className="git-file-list">
                {gitModifiedFiles.slice(0, 4).map((f, i) => (
                  <div key={i} className="git-file-item">
                    <span className={`git-file-status git-status-${f.status}`}>{f.status}</span>
                    <span style={{ color: 'var(--text-primary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {f.path.split('/').slice(-2).join('/')}
                    </span>
                  </div>
                ))}
                {gitModifiedFiles.length > 4 && (
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', padding: '2px 8px' }}>+{gitModifiedFiles.length - 4} 个更多</div>
                )}
                {gitModifiedFiles.length === 0 && (
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', padding: '4px 8px' }}>无未提交修改 (Working tree clean)</div>
                )}
              </div>
            </div>

            {/* Build Status */}
            <div className="card" style={{ padding: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 12 }}>构建状态</div>
              <div className="build-status-card" style={{ padding: 0 }}>
                <div className={`build-status-icon ${ws.buildStatus}`}>
                  {ws.buildStatus === 'success'
                    ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                    : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6M9 9l6 6"/></svg>
                  }
                </div>
                <div className="build-status-info">
                  <div className="build-status-name">{ws.integrations?.jenkins || 'CI Build'}</div>
                  <div className="build-status-desc" style={{ color: ws.buildStatus === 'failed' ? 'var(--accent-red)' : 'var(--accent-green)' }}>
                    {ws.buildMessage}
                  </div>
                  <div className="build-status-meta">{ws.buildTime}</div>
                </div>
              </div>
              {ws.buildStatus === 'failed' && (
                <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => onSetContextPanel('log')}>查看日志</button>
                  <button className="btn btn-sm" style={{ background: 'var(--accent-purple-dim)', color: 'var(--accent-purple)', border: '1px solid rgba(163,113,247,0.3)' }}>
                    🤖 AI 分析
                  </button>
                </div>
              )}
            </div>

            {/* Services */}
            {ws.services?.length > 0 && (
              <div className="card" style={{ padding: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 12 }}>服务状态</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {ws.services.map(svc => (
                    <div key={svc.name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: svc.status === 'online' ? 'var(--accent-green)' : 'var(--accent-red)', flexShrink: 0 }}/>
                      <span style={{ fontSize: 12, flex: 1 }}>{svc.name}</span>
                      <span style={{ fontSize: 11, color: svc.status === 'online' ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                        {svc.status === 'online' ? '在线' : '离线'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Quick Actions */}
            <div className="card" style={{ padding: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 10 }}>快速动作</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {ws.actions?.map(action => {
                  const risk = RISK_CONFIG[action.risk] || RISK_CONFIG.readonly
                  return (
                    <div
                      key={action.id}
                      className="action-item"
                      onClick={() => setRunningAction(action)}
                    >
                      <div className="action-item-icon" style={{ background: risk.bg, fontSize: 14 }}>{action.icon}</div>
                      <span className="action-item-name">{action.name}</span>
                      <span className="badge action-item-risk" style={{ background: risk.bg, color: risk.color, fontSize: 10 }}>
                        {risk.label}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'Git' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {gitNotice && (
              <div style={{ background: 'var(--accent-blue-dim)', color: 'var(--accent-blue)', padding: '10px 14px', borderRadius: 8, fontSize: 12, border: '1px solid rgba(79,158,248,0.3)', animation: 'fadeIn 150ms ease' }}>
                {gitNotice}
              </div>
            )}

            {/* Branch & Sync Bar */}
            <div className="card" style={{ padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>分支与远程同步</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn btn-secondary btn-sm" onClick={handlePull} disabled={isGitOperating} title="git pull --rebase">
                    ⬇️ 拉取
                  </button>
                  <button className="btn btn-primary btn-sm" onClick={handlePush} disabled={isGitOperating} title="git push origin">
                    ⬆️ 推送
                  </button>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)', flexShrink: 0 }}>切换分支:</span>
                  <select
                    style={{
                      flex: 1,
                      padding: '6px 10px',
                      background: 'var(--bg-elevated)',
                      border: '1px solid var(--accent-blue)',
                      borderRadius: 6,
                      color: 'var(--accent-blue)',
                      fontFamily: 'monospace',
                      fontSize: 12,
                      outline: 'none',
                      minWidth: 160
                    }}
                    value={gitBranch}
                    onChange={(e) => handleSwitchBranch(e.target.value)}
                    disabled={isGitOperating}
                  >
                    {branches.length > 0 ? (
                      <>
                        <optgroup label="本地分支">
                          {branches.filter(b => !b.isRemote).map((b) => (
                            <option key={b.name} value={b.name}>
                              {b.isCurrent ? `⑂ ${b.name} (当前)` : `⑂ ${b.name}`}
                            </option>
                          ))}
                        </optgroup>
                        {branches.some(b => b.isRemote) && (
                          <optgroup label="远程分支 (Checkout 自动跟踪)">
                            {branches.filter(b => b.isRemote).map((b) => (
                              <option key={b.name} value={b.name}>
                                ☁️ {b.name}
                              </option>
                            ))}
                          </optgroup>
                        )}
                      </>
                    ) : (
                      <option value={gitBranch}>⑂ {gitBranch}</option>
                    )}
                  </select>
                  <button
                    className="btn btn-ghost btn-icon btn-sm"
                    onClick={refreshGitData}
                    title="刷新分支与 Git 状态"
                    disabled={isGitOperating}
                  >
                    🔄
                  </button>
                </div>

                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => setShowCreateBranchModal(true)}>
                    + 基于分支新建
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={handleStash} disabled={isGitOperating} title="暂存当前修改">
                    📦 Stash
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={handleStashPop} disabled={isGitOperating} title="恢复上一次暂存">
                    解暂存
                  </button>
                </div>
              </div>
            </div>

            {/* Uncommitted Changes Manager */}
            <div className="card" style={{ padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
                  未提交改动 ({gitModifiedFiles.length})
                </div>
                {gitModifiedFiles.length > 0 && (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      className="btn btn-ghost btn-sm"
                      style={{ color: 'var(--accent-red)', fontSize: 11 }}
                      onClick={() => handleDiscard(null)}
                      disabled={isGitOperating}
                    >
                      🗑️ 还原全部改动
                    </button>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => setShowAiCommitModal(true)}
                    >
                      🤖 AI 智能 Commit
                    </button>
                  </div>
                )}
              </div>

              <div className="git-file-list">
                {gitModifiedFiles.map((f, i) => (
                  <div key={i} className="git-file-item" style={{ padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span className={`git-file-status git-status-${f.status}`}>{f.status}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-primary)', flex: 1, fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {f.path}
                    </span>
                    <button
                      className="btn btn-ghost btn-sm"
                      style={{ fontSize: 10, padding: '2px 6px', color: 'var(--text-muted)' }}
                      title="放弃改动"
                      onClick={() => handleDiscard(f.path)}
                    >
                      还原
                    </button>
                  </div>
                ))}
                {gitModifiedFiles.length === 0 && (
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '12px 0', textAlign: 'center' }}>
                    ✓ 暂无未提交修改，代码仓库很干净。
                  </div>
                )}
              </div>
            </div>

            {/* Commit Log History */}
            <div className="card" style={{ padding: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 12 }}>
                提交历史 (Commit Log)
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {commitLog.length > 0 ? (
                  commitLog.map((log) => (
                    <div
                      key={log.hash}
                      style={{
                        padding: '8px 12px',
                        background: 'var(--bg-elevated)',
                        borderRadius: 6,
                        border: '1px solid var(--border)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10
                      }}
                    >
                      <span style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--accent-purple)', background: 'var(--accent-purple-dim)', padding: '2px 6px', borderRadius: 4 }}>
                        {log.hash}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {log.subject}
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                          {log.author} · {log.time} {log.refs ? ` · ${log.refs}` : ''}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '8px 0' }}>{lastCommit}</div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === '动作' && (
          <div>
            <div style={{ marginBottom: 16, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
              以下动作均经过预定义，执行前会显示命令预览。高风险操作需二次确认。
            </div>
            {Object.entries(
              ws.actions?.reduce((acc, action) => {
                const risk = action.risk
                if (!acc[risk]) acc[risk] = []
                acc[risk].push(action)
                return acc
              }, {}) || {}
            ).map(([risk, actions]) => {
              const riskConf = RISK_CONFIG[risk] || RISK_CONFIG.readonly
              return (
                <div key={risk} style={{ marginBottom: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <span className="badge" style={{ background: riskConf.bg, color: riskConf.color, fontSize: 10 }}>{riskConf.label}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {risk === 'readonly' && '可直接执行，不修改任何内容'}
                      {risk === 'normal' && '可直接执行，影响范围受限'}
                      {risk === 'modify' && '会修改文件或分支，显示预览后执行'}
                      {risk === 'high' && '高影响操作，必须二次确认'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {actions.map(action => (
                      <div key={action.id} className="card card-clickable" style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }} onClick={() => setRunningAction(action)}>
                        <div style={{ width: 30, height: 30, borderRadius: 7, background: riskConf.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>{action.icon}</div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 500 }}>{action.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'monospace', marginTop: 1 }}>{action.id}</div>
                        </div>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2"><path d="m9 18 6-6-6-6"/></svg>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {activeTab === '构建' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="card" style={{ borderColor: ws.buildStatus === 'failed' ? 'rgba(224,92,92,0.3)' : 'rgba(63,185,80,0.2)' }}>
              <div className="build-status-card">
                <div className={`build-status-icon ${ws.buildStatus}`} style={{ width: 44, height: 44, fontSize: 20 }}>
                  {ws.buildStatus === 'success' ? '✅' : '❌'}
                </div>
                <div className="build-status-info">
                  <div className="build-status-name" style={{ fontSize: 15 }}>{ws.integrations?.jenkins || 'CI Build'}</div>
                  <div className="build-status-desc" style={{ color: ws.buildStatus === 'failed' ? 'var(--accent-red)' : 'var(--accent-green)', fontSize: 13, marginTop: 3 }}>
                    {ws.buildMessage}
                  </div>
                  {ws.buildDuration && <div className="build-status-meta" style={{ marginTop: 4 }}>耗时 {ws.buildDuration} · {ws.buildTime}</div>}
                </div>
              </div>
            </div>
            {ws.buildStatus === 'failed' && (
              <div className="card" style={{ padding: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 10 }}>构建日志摘要</div>
                <div className="terminal-output selectable" style={{ maxHeight: 300 }}>
{`[2026-08-04 10:00:21] ERROR: Unable to checkout repository
[2026-08-04 10:00:21] ERROR: The following untracked working tree files would be overwritten by checkout:
	report.xml
Please move or remove them before you switch branches.
Aborting
[2026-08-04 10:04:42] Build FAILED`}
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  <button className="btn btn-secondary btn-sm">🔄 重新构建</button>
                  <button className="btn btn-sm" style={{ background: 'var(--accent-purple-dim)', color: 'var(--accent-purple)', border: '1px solid rgba(163,113,247,0.3)' }}>
                    🤖 AI 分析根因
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === '会话' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* FlyWork Sessions */}
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 10 }}>
                flyWork 关联任务会话 ({sessions.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {sessions.length === 0 ? (
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', background: 'var(--bg-elevated)', padding: '12px 14px', borderRadius: 8, border: '1px solid var(--border)' }}>
                    暂无主动开启的 flyWork 会话，点击顶部「▶ 开始工作」开启任务跟踪。
                  </div>
                ) : (
                  sessions.map(session => (
                    <div key={session.id} className="card" style={{ padding: '12px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: session.status === 'active' ? 'var(--accent-green)' : 'var(--accent-amber)', marginTop: 5, flexShrink: 0 }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{session.title}</div>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                            <span style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--accent-blue)', background: 'var(--accent-blue-dim)', padding: '1px 6px', borderRadius: 3 }}>⑂ {session.branch}</span>
                            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                              {session.status === 'active' ? '进行中' : `暂停于 ${formatRelTime(session.updatedAt)}`}
                            </span>
                          </div>
                          {session.notes && <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 8 }}>{session.notes}</div>}
                          <div style={{ display: 'flex', gap: 6 }}>
                            {session.status === 'active'
                              ? <button className="btn btn-secondary btn-sm" onClick={() => onPauseSession(session.id)}>⏸ 暂停</button>
                              : <button className="btn btn-primary btn-sm" onClick={() => onResumeSession(session.id)}>▶ 继续</button>
                            }
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Native Agent Project Sessions */}
            <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 16, border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                    桌面智能体项目专属会话
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span>只过滤显示当前工程 <strong style={{ color: 'var(--accent-blue)' }}>{ws.name}</strong> 对应的智能体会话列表</span>
                    <span className="badge badge-gray" style={{ fontSize: 9, opacity: 0.8 }}>
                      {selectedAgentTab.includes('ChatGPT') ? '📌 对齐应用侧边栏与最新时间排序' : '🕒 按最近交互时间倒序'}
                    </span>
                  </div>
                </div>
                
                {/* Agent Switcher Tabs */}
                <div style={{ display: 'flex', gap: 4, background: 'var(--bg-elevated)', padding: 3, borderRadius: 8, border: '1px solid var(--border)' }}>
                  {['ChatGPT / Codex', 'Claude Code', 'OpenCode'].map((agentName) => {
                    const isActive = selectedAgentTab === agentName
                    return (
                      <button
                        key={agentName}
                        onClick={() => setSelectedAgentTab(agentName)}
                        style={{
                          padding: '4px 10px',
                          borderRadius: 6,
                          fontSize: 11,
                          fontWeight: isActive ? 600 : 400,
                          border: 'none',
                          cursor: 'pointer',
                          background: isActive ? 'var(--accent-blue)' : 'transparent',
                          color: isActive ? '#fff' : 'var(--text-secondary)',
                          transition: 'all 150ms ease'
                        }}
                      >
                        {agentName === 'ChatGPT / Codex' ? '🧠 ChatGPT / Codex' : agentName === 'Claude Code' ? '🤖 Claude Code' : '💻 OpenCode'}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {nativeAgentSessions.length > 0 ? (
                  <>
                    {nativeAgentSessions.slice(0, currentPage * pageSize).map((nSess, idx) => (
                      <div
                        key={nSess.sessionId || idx}
                        style={{
                          padding: '12px 14px',
                          borderRadius: 8,
                          display: 'flex',
                          alignItems: 'center',
                          justify: 'space-between',
                          background: 'var(--bg-elevated)',
                          border: '1px solid var(--border)',
                          transition: 'border-color 150ms ease'
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ color: 'var(--accent-blue)' }}>💬</span>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nSess.summary}</span>
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, display: 'flex', gap: 12 }}>
                            <span>Session: <code style={{ fontSize: 10 }}>{nSess.sessionId.slice(0, 12)}</code></span>
                            <span>更新时间: {nSess.updatedAt}</span>
                            <span style={{ color: 'var(--accent-green)' }}>✓ 已匹配项目 {ws.name}</span>
                          </div>
                        </div>
                        <button
                          className="btn btn-secondary btn-sm"
                          style={{ fontSize: 11, marginLeft: 12 }}
                          onClick={() => {
                            onSetContextPanel({ type: 'native-session', sessionId: nSess.sessionId, summary: nSess.summary, agent: selectedAgentTab })
                          }}
                        >
                          对话 ➔
                        </button>
                      </div>
                    ))}

                    {/* Pagination / Load More Controls */}
                    {nativeAgentSessions.length > currentPage * pageSize ? (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, paddingTop: 10, borderTop: '1px dashed var(--border)' }}>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          已显示 <strong style={{ color: 'var(--text-primary)' }}>{Math.min(currentPage * pageSize, nativeAgentSessions.length)}</strong> / 共 <strong>{nativeAgentSessions.length}</strong> 条历史会话
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button
                            className="btn btn-secondary btn-sm"
                            style={{ fontSize: 11 }}
                            onClick={() => setCurrentPage((prev) => prev + 1)}
                          >
                            👇 加载更多 (+12)
                          </button>
                          <button
                            className="btn btn-ghost btn-sm"
                            style={{ fontSize: 11, color: 'var(--accent-blue)' }}
                            onClick={() => setCurrentPage(Math.ceil(nativeAgentSessions.length / pageSize))}
                          >
                            展开全量 ({nativeAgentSessions.length} 条)
                          </button>
                        </div>
                      </div>
                    ) : (
                      nativeAgentSessions.length > pageSize && (
                        <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-muted)', marginTop: 8, paddingTop: 8, borderTop: '1px dashed var(--border)' }}>
                          ✓ 已加载全量共 {nativeAgentSessions.length} 条项目会话
                        </div>
                      )
                    )}
                  </>
                ) : (
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', background: 'var(--bg-elevated)', padding: '16px 14px', borderRadius: 8, textAlign: 'center' }}>
                    未在 <strong>{selectedAgentTab}</strong> 中找到工程 <strong style={{ color: 'var(--accent-blue)' }}>{ws.name}</strong> 的专属历史会话。
                    <div style={{ fontSize: 11, marginTop: 4, opacity: 0.8 }}>
                      请检查上方编辑 ✏️ 中配置的关联 Project 路径是否一致。
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === '活动' && (
          <div className="timeline">
            {activityLog.length === 0 ? (
              <div className="empty-state"><div className="empty-state-title">暂无活动记录</div></div>
            ) : activityLog.map(item => (
              <div key={item.id} className="timeline-item">
                <div className="timeline-icon" style={{ background: `${item.color}22`, border: `1px solid ${item.color}44` }}>
                  <span style={{ fontSize: 12 }}>{item.icon}</span>
                </div>
                <div className="timeline-content">
                  <div className="timeline-title">{item.title}</div>
                  <div className="timeline-meta">{item.detail}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{formatRelTime(item.timestamp)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {runningAction && (
        <ActionRunner action={runningAction} workspace={ws} onClose={() => setRunningAction(null)} />
      )}
      {showEditModal && (
        <EditWorkspaceModal
          workspace={ws}
          onClose={() => setShowEditModal(false)}
          onSave={onUpdateWorkspace}
        />
      )}
      {showCreateBranchModal && (
        <GitCreateBranchModal
          branches={branches}
          currentBranch={gitBranch}
          onClose={() => setShowCreateBranchModal(false)}
          onCreate={handleCreateBranch}
        />
      )}
      {showAiCommitModal && (
        <GitAiCommitModal
          workspace={ws}
          onClose={() => setShowAiCommitModal(false)}
          onCommitSuccess={refreshGitData}
        />
      )}
    </div>
  )
}

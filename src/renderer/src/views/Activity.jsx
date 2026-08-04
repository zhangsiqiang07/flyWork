import { useState } from 'react'

const TYPE_CONFIG = {
  git: { label: 'Git', color: 'var(--accent-blue)', bg: 'var(--accent-blue-dim)' },
  ai: { label: 'AI', color: 'var(--accent-purple)', bg: 'var(--accent-purple-dim)' },
  build: { label: '构建', color: 'var(--accent-amber)', bg: 'var(--accent-amber-dim)' },
  action: { label: '动作', color: 'var(--accent-teal)', bg: 'var(--accent-teal-dim)' },
  session: { label: '会话', color: 'var(--accent-green)', bg: 'var(--accent-green-dim)' },
  inbox: { label: '收件箱', color: 'var(--text-secondary)', bg: 'var(--bg-hover)' }
}

function formatTime(iso) {
  const d = new Date(iso)
  const now = new Date()
  const diff = now - d
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}天前`
  return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
}

export default function Activity({ activityLog, workspaces }) {
  const [filterType, setFilterType] = useState('all')
  const [filterWorkspace, setFilterWorkspace] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [realAuditLogs, setRealAuditLogs] = useState([])

  useEffect(() => {
    if (window.flywork?.getAuditLog) {
      window.flywork.getAuditLog().then((logs) => {
        if (Array.isArray(logs)) {
          const mapped = logs.map((log, idx) => ({
            id: `audit-${log.timestamp}-${idx}`,
            type: 'action',
            title: log.name ? `动作拦截/执行: ${log.name}` : `系统日志: ${log.type}`,
            detail: log.reason ? `被拦截: ${log.reason}` : `工作路径: ${log.workdir || '.'} | 状态: ${log.type}`,
            timestamp: log.timestamp || new Date().toISOString(),
            workspaceId: null
          }))
          setRealAuditLogs(mapped)
        }
      })
    }
  }, [])

  const allLogs = [...realAuditLogs, ...activityLog].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))

  const filteredLog = allLogs.filter(item => {
    if (filterType !== 'all' && item.type !== filterType) return false
    if (filterWorkspace !== 'all' && item.workspaceId !== filterWorkspace) return false
    if (searchQuery && !item.title.toLowerCase().includes(searchQuery.toLowerCase()) && !item.detail?.toLowerCase().includes(searchQuery.toLowerCase())) return false
    return true
  })

  const typeCounts = allLogs.reduce((acc, item) => {
    acc[item.type] = (acc[item.type] || 0) + 1
    return acc
  }, {})

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div>
            <div className="page-title">活动记录</div>
            <div className="page-subtitle">所有操作的可搜索时间线 · {activityLog.length} 条记录</div>
          </div>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="quick-input" style={{ padding: '5px 10px', flex: '0 0 200px' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            <input placeholder="搜索活动..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} style={{ fontSize: 12 }} />
          </div>

          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            <button className={`btn btn-sm ${filterType === 'all' ? 'btn-secondary' : 'btn-ghost'}`} onClick={() => setFilterType('all')} style={{ fontSize: 11 }}>
              全部
            </button>
            {Object.entries(TYPE_CONFIG).map(([type, conf]) => (
              typeCounts[type] ? (
                <button
                  key={type}
                  className={`btn btn-sm ${filterType === type ? 'btn-secondary' : 'btn-ghost'}`}
                  onClick={() => setFilterType(filterType === type ? 'all' : type)}
                  style={{ fontSize: 11 }}
                >
                  {conf.label}
                </button>
              ) : null
            ))}
          </div>

          <select
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-secondary)', fontSize: 12, padding: '4px 8px', outline: 'none' }}
            value={filterWorkspace}
            onChange={e => setFilterWorkspace(e.target.value)}
          >
            <option value="all">所有工作空间</option>
            {workspaces.map(ws => <option key={ws.id} value={ws.id}>{ws.icon} {ws.name}</option>)}
          </select>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
        {filteredLog.length === 0 ? (
          <div className="empty-state">
            <div style={{ fontSize: 32 }}>📋</div>
            <div className="empty-state-title">没有匹配的活动</div>
            <div className="empty-state-desc">尝试调整过滤条件</div>
          </div>
        ) : (
          <div className="timeline">
            {filteredLog.map((item, i) => {
              const typeConf = TYPE_CONFIG[item.type] || TYPE_CONFIG.git
              const ws = workspaces.find(w => w.id === item.workspaceId)
              return (
                <div key={item.id} className="timeline-item" style={{ animation: `fadeIn 150ms ease ${i * 20}ms both` }}>
                  <div className="timeline-icon" style={{ background: typeConf.bg, border: `1px solid ${typeConf.color}44` }}>
                    <span style={{ fontSize: 12 }}>{item.icon}</span>
                  </div>
                  <div className="timeline-content">
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                          <div className="timeline-title">{item.title}</div>
                          <span className="badge" style={{ background: typeConf.bg, color: typeConf.color, fontSize: 10, flexShrink: 0 }}>
                            {typeConf.label}
                          </span>
                        </div>
                        <div className="timeline-meta">{item.detail}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                          {ws && <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>{ws.icon} {ws.name}</span>}
                          {item.meta && Object.entries(item.meta).map(([k, v]) => (
                            <span key={k} className="badge badge-gray" style={{ fontSize: 10 }}>{k}: {v}</span>
                          ))}
                        </div>
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', flexShrink: 0, marginTop: 2 }}>
                        {formatTime(item.timestamp)}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

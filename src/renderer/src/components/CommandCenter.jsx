import { useState, useRef, useEffect } from 'react'
import { COMMAND_SUGGESTIONS } from '../data/mockData'

const RESULT_TYPE_CONFIG = {
  navigation: { label: '导航', color: 'var(--accent-blue)', bg: 'var(--accent-blue-dim)' },
  action: { label: '动作', color: 'var(--accent-amber)', bg: 'var(--accent-amber-dim)' },
  session: { label: '会话', color: 'var(--accent-green)', bg: 'var(--accent-green-dim)' },
  ai: { label: 'AI', color: 'var(--accent-purple)', bg: 'var(--accent-purple-dim)' },
  inbox: { label: '收件箱', color: 'var(--accent-teal)', bg: 'var(--accent-teal-dim)' },
  workspace: { label: '工作空间', color: 'var(--accent-blue)', bg: 'var(--accent-blue-dim)' }
}

const RISK_LABELS = {
  readonly: { text: '只读', color: 'var(--text-secondary)', bg: 'var(--bg-hover)' },
  normal: { text: '普通', color: 'var(--accent-blue)', bg: 'var(--accent-blue-dim)' },
  modify: { text: '修改', color: 'var(--accent-amber)', bg: 'var(--accent-amber-dim)' },
  high: { text: '高风险', color: 'var(--accent-red)', bg: 'var(--accent-red-dim)' }
}

export default function CommandCenter({ workspaces, sessions, onClose, onNavigate, onOpenWorkspace, onResumeSession, onAddInboxItem }) {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [inboxSaved, setInboxSaved] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Build dynamic results
  const buildResults = (q) => {
    const lower = q.toLowerCase().trim()
    if (!lower) return COMMAND_SUGGESTIONS

    const results = []

    // Match workspaces
    workspaces.forEach(ws => {
      if (ws.name.toLowerCase().includes(lower) || ws.description?.toLowerCase().includes(lower)) {
        results.push({ type: 'workspace', label: `打开 ${ws.name}`, icon: ws.icon, action: `workspace:${ws.id}`, meta: ws.description })
      }
    })

    // Match sessions
    sessions.filter(s => s.status === 'paused').forEach(s => {
      if (s.title.toLowerCase().includes(lower)) {
        results.push({ type: 'session', label: `继续: ${s.title}`, icon: '▶️', action: `resume-session:${s.id}`, meta: s.workspaceId })
      }
    })

    // Filter suggestions
    COMMAND_SUGGESTIONS.forEach(sug => {
      if (sug.label.toLowerCase().includes(lower)) {
        results.push(sug)
      }
    })

    // AI task for anything not matched
    if (results.length === 0 || lower.startsWith('让') || lower.startsWith('分析') || lower.startsWith('生成') || lower.startsWith('帮我')) {
      results.push({ type: 'ai', label: `AI: ${q}`, icon: '🤖', action: `ai:query:${q}`, meta: 'Claude Code' })
    }

    return results.slice(0, 8)
  }

  const results = buildResults(query)

  const handleSelect = (item) => {
    const action = item.action
    if (!action) return

    if (action.startsWith('navigate:')) {
      onNavigate(action.replace('navigate:', ''))
    } else if (action.startsWith('workspace:')) {
      onOpenWorkspace(action.replace('workspace:', ''))
    } else if (action.startsWith('resume-session:')) {
      onResumeSession(action.replace('resume-session:', ''))
    } else if (action === 'inbox:clipboard') {
      onAddInboxItem({ type: 'clip', title: '剪贴板内容', preview: '从命令中心快速保存', source: 'clipboard', workspaceId: null, tags: [] })
      setInboxSaved(true)
      setTimeout(onClose, 800)
    } else if (action.startsWith('ai:')) {
      // Simulate AI task
      onClose()
    } else {
      onClose()
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((i) => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (results[selectedIndex]) handleSelect(results[selectedIndex])
    }
  }

  useEffect(() => { setSelectedIndex(0) }, [query])

  // Group results by type for display
  const grouped = results.reduce((acc, item, idx) => {
    if (!acc[item.type]) acc[item.type] = []
    acc[item.type].push({ ...item, _idx: idx })
    return acc
  }, {})

  let flatIdx = 0

  return (
    <div className="overlay-backdrop" onClick={onClose}>
      <div className="command-center" onClick={(e) => e.stopPropagation()}>
        {/* Search Input */}
        <div className="command-center-input-wrap">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/>
            <path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            ref={inputRef}
            className="command-center-input"
            placeholder="搜索工作空间、执行动作、询问 AI..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          {inboxSaved && <span style={{ color:'var(--accent-green)', fontSize:12 }}>✓ 已保存</span>}
          {query && (
            <button onClick={() => setQuery('')} style={{ color:'var(--text-muted)', padding:'2px' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
          )}
        </div>

        {/* Results */}
        <div className="command-center-results">
          {Object.entries(grouped).map(([type, items]) => {
            const typeConfig = RESULT_TYPE_CONFIG[type] || RESULT_TYPE_CONFIG.navigation
            return (
              <div key={type}>
                <div className="command-center-section-label">{typeConfig.label}</div>
                {items.map((item) => {
                  const currentIdx = item._idx
                  const isSelected = selectedIndex === currentIdx
                  return (
                    <div
                      key={item.action || item.label}
                      className={`command-center-item ${isSelected ? 'selected' : ''}`}
                      onClick={() => handleSelect(item)}
                    >
                      <div className="command-center-item-icon" style={{ background: typeConfig.bg }}>
                        <span style={{ fontSize: 14 }}>{item.icon}</span>
                      </div>
                      <div style={{ flex: 1 }}>
                        <div className="command-center-item-title">{item.label}</div>
                        {item.meta && <div className="command-center-item-subtitle">{item.meta}</div>}
                        {item.agent && <div className="command-center-item-subtitle">由 {item.agent} 处理</div>}
                      </div>
                      {item.risk && (
                        <span
                          className="badge"
                          style={{
                            background: RISK_LABELS[item.risk]?.bg,
                            color: RISK_LABELS[item.risk]?.color,
                            fontSize: 10
                          }}
                        >
                          {RISK_LABELS[item.risk]?.text}
                        </span>
                      )}
                      {isSelected && (
                        <span style={{ color:'var(--text-muted)', fontSize:11 }}>↵</span>
                      )}
                    </div>
                  )
                })}
              </div>
            )
          })}

          {results.length === 0 && (
            <div className="empty-state" style={{ padding: '24px' }}>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>未找到匹配结果</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>按 Enter 将其作为 AI 任务处理</div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="command-center-footer">
          <span><kbd className="command-center-kbd">↑↓</kbd> 导航</span>
          <span><kbd className="command-center-kbd">↵</kbd> 执行</span>
          <span><kbd className="command-center-kbd">Esc</kbd> 关闭</span>
          <span style={{ marginLeft: 'auto' }}>
            <span className="badge badge-purple" style={{ fontSize: 10 }}>AI 感知</span>
          </span>
        </div>
      </div>
    </div>
  )
}

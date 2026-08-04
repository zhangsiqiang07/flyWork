import { useState, useEffect } from 'react'

const TABS = [
  { id: 'ai', label: '💬 会话消息', icon: '💬' },
  { id: 'context', label: '🔍 动态诊断', icon: '🔍' },
  { id: 'log', label: '📋 活动日志', icon: '📋' }
]

export default function ContextPanel({
  isOpen,
  activeTab,
  onTabChange,
  currentView,
  selectedWorkspace,
  sessions,
  activityLog,
  chatHistories,
  onUpdateChatHistories
}) {
  const [aiInput, setAiInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [selectedAgent, setSelectedAgent] = useState('Claude Code')
  const [nativeMessages, setNativeMessages] = useState([])
  const [isLoadingMessages, setIsLoadingMessages] = useState(false)
  const [activeSessionInfo, setActiveSessionInfo] = useState(null)

  const isNativeSession = typeof activeTab === 'object' && activeTab?.type === 'native-session'

  useEffect(() => {
    if (isNativeSession && activeTab.sessionId) {
      setActiveSessionInfo(activeTab)
      setIsLoadingMessages(true)
      if (window.flywork?.getNativeThreadMessages) {
        window.flywork.getNativeThreadMessages(activeTab.sessionId).then((msgs) => {
          setNativeMessages(msgs || [])
          setIsLoadingMessages(false)
        })
      } else {
        setIsLoadingMessages(false)
      }
    } else {
      setActiveSessionInfo(null)
      setNativeMessages([])
    }
  }, [activeTab])

  if (!isOpen) return <div className="context-panel collapsed" />

  const currentTabId = typeof activeTab === 'string' ? activeTab : 'ai'

  const threadKey = `${selectedWorkspace?.id || 'global'}_${selectedAgent}`
  const localConversations = chatHistories?.[threadKey] || [
    {
      role: 'assistant',
      content: `👋 已关联 **「${selectedWorkspace?.name || '全局项目'}」**。\n在左侧「会话」面板中点击任何 **ChatGPT / Codex / Claude** 会话的「对话 ➔」，即可在此阅览其完整的历史问答消息。`,
      time: '最近'
    }
  ]

  const conversationsToRender = isNativeSession && activeSessionInfo ? nativeMessages : localConversations

  const handleAISend = () => {
    if (!aiInput.trim()) return
    const msg = aiInput.trim()
    const nowTime = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    const userMsg = { role: 'user', content: msg, time: nowTime }

    const newThread = [...localConversations, userMsg]
    if (onUpdateChatHistories) {
      onUpdateChatHistories((prev) => ({ ...prev, [threadKey]: newThread }))
    }
    setAiInput('')
    setIsTyping(true)

    setTimeout(() => {
      const assistantMsg = {
        role: 'assistant',
        content: `[${selectedAgent}] 已分析「${selectedWorkspace?.name || '全局项目'}」的问题：\n\n已根据当前工程上下文（分支: \`${selectedWorkspace?.gitBranch || 'main'}\`，路径: \`${selectedWorkspace?.root || '本地'}\`）为你完成对「${msg}」的回答。`,
        time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
      }
      const updatedThread = [...newThread, assistantMsg]
      if (onUpdateChatHistories) {
        onUpdateChatHistories((prev) => ({ ...prev, [threadKey]: updatedThread }))
      }
      setIsTyping(false)
    }, 1000)
  }

  const recentActivity = activityLog?.slice(0, 8) || []

  return (
    <div className="context-panel">
      <div className="context-panel-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>
            项目 Context Copilot
          </span>
          {selectedWorkspace && (
            <span className="badge badge-blue" style={{ fontSize: 10 }}>
              {selectedWorkspace.icon} {selectedWorkspace.name}
            </span>
          )}
        </div>
      </div>

      <div className="context-panel-tabs">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={`context-panel-tab ${currentTabId === tab.id ? 'active' : ''}`}
            onClick={() => {
              setActiveSessionInfo(null)
              onTabChange(tab.id)
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="context-panel-body">
        {currentTabId === 'ai' && (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Header info bar for active native session */}
            {isNativeSession && activeSessionInfo && (
              <div style={{ background: 'var(--bg-elevated)', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--accent-blue)', marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="badge badge-purple" style={{ fontSize: 10 }}>
                    {activeSessionInfo.agent || '智能体'} 原生 Message
                  </span>
                  <button
                    className="btn btn-ghost btn-sm"
                    style={{ fontSize: 10, padding: '1px 6px' }}
                    onClick={() => {
                      setActiveSessionInfo(null)
                      onTabChange('ai')
                    }}
                  >
                    ✕ 返回本地对话
                  </button>
                </div>
                <div style={{ fontSize: 12, fontWeight: 600, marginTop: 4, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {activeSessionInfo.summary}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                  Session: <code style={{ fontSize: 9 }}>{activeSessionInfo.sessionId}</code>
                </div>
              </div>
            )}

            {/* Conversation Messages Display */}
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 12, paddingRight: 4 }}>
              {isLoadingMessages ? (
                <div style={{ padding: 20, textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>
                  ⏳ 正在从本地磁盘解析该 Session 的完整 Message 消息...
                </div>
              ) : conversationsToRender.length === 0 ? (
                <div style={{ padding: 20, textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>
                  暂无 Message 消息记录
                </div>
              ) : (
                conversationsToRender.map((msg, i) => (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                    <div
                      style={{
                        maxWidth: '92%',
                        padding: '10px 12px',
                        borderRadius: msg.role === 'user' ? '12px 12px 2px 12px' : '2px 12px 12px 12px',
                        background: msg.role === 'user' ? 'var(--accent-blue-dim)' : 'var(--bg-elevated)',
                        border: `1px solid ${msg.role === 'user' ? 'rgba(79,158,248,0.3)' : 'var(--border)'}`,
                        fontSize: 12,
                        lineHeight: 1.6,
                        color: 'var(--text-primary)',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word'
                      }}
                      className="selectable"
                    >
                      {msg.content}
                    </div>
                    {msg.time && <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{msg.time}</span>}
                  </div>
                ))
              )}
              {isTyping && (
                <div style={{ display: 'flex', gap: 4, padding: '8px 10px', background: 'var(--bg-elevated)', borderRadius: '4px 12px 12px 12px', border: '1px solid var(--border)', width: 'fit-content' }}>
                  {[0, 1, 2].map((i) => (
                    <span key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--text-muted)', animation: `blink 1.2s ease infinite`, animationDelay: `${i * 0.2}s` }} />
                  ))}
                </div>
              )}
            </div>

            {/* Input Footer */}
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10 }}>
              <div className="quick-input" style={{ padding: '6px 10px' }}>
                <input
                  placeholder="追加问题或提交新任务..."
                  value={aiInput}
                  onChange={(e) => setAiInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleAISend()
                    }
                  }}
                  style={{ fontSize: 12 }}
                />
                <button
                  onClick={handleAISend}
                  disabled={!aiInput.trim()}
                  style={{ color: aiInput.trim() ? 'var(--accent-blue)' : 'var(--text-muted)', background: 'none', border: 'none', cursor: aiInput.trim() ? 'pointer' : 'default' }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m22 2-7 20-4-9-9-4 20-7z"/></svg>
                </button>
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 5, paddingLeft: 2 }}>
                挂载工程：{selectedWorkspace ? `${selectedWorkspace.name} (${selectedWorkspace.gitBranch})` : '全局'}
              </div>
            </div>
          </div>
        )}

        {currentTabId === 'context' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {selectedWorkspace ? (
              <>
                <div>
                  <div className="section-title" style={{ marginBottom: 8 }}>工程概览</div>
                  <div className="card" style={{ padding: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <span style={{ fontSize: 20 }}>{selectedWorkspace.icon}</span>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{selectedWorkspace.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'monospace' }}>{selectedWorkspace.root}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <span className="badge badge-blue" style={{ fontSize: 10 }}>默认智能体: {selectedWorkspace.defaultAgent || 'Claude Code'}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="section-title" style={{ marginBottom: 8 }}>实时 Git 差异分析</div>
                  <div className="card" style={{ padding: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                      <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--accent-blue)', background: 'var(--accent-blue-dim)', padding: '2px 6px', borderRadius: 4 }}>
                        ⑂ {selectedWorkspace.gitBranch}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 6 }}>
                      {selectedWorkspace.gitModifiedFiles?.length || 0} 个待提交变更文件
                    </div>
                    <div className="git-file-list">
                      {(selectedWorkspace.gitModifiedFiles || []).slice(0, 6).map((f, i) => (
                        <div key={i} className="git-file-item">
                          <span className={`git-file-status git-status-${f.status}`}>{f.status}</span>
                          <span style={{ color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.path.split('/').pop()}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="empty-state">
                <div style={{ fontSize: 24, marginBottom: 8 }}>🔍</div>
                <div className="empty-state-title">未选择工作空间</div>
                <div className="empty-state-desc">进入工作空间后，这里将显示实时工程诊断与 Git 变更</div>
              </div>
            )}
          </div>
        )}

        {currentTabId === 'log' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div className="section-title" style={{ marginBottom: 8 }}>关联活动日志</div>
            {recentActivity.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: 16, textAlign: 'center' }}>
                暂无记录
              </div>
            ) : (
              recentActivity.map((item) => (
                <div key={item.id} style={{ display: 'flex', gap: 8, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 14, flexShrink: 0 }}>{item.icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.detail}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}

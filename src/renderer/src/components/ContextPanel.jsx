import { useState, useEffect } from 'react'

export default function ContextPanel({
  isOpen,
  activeSession,
  onClose,
  selectedWorkspace
}) {
  const [messages, setMessages] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [copiedId, setCopiedId] = useState(false)

  const isNative = activeSession?.type === 'native-session'
  const sessionId = activeSession?.sessionId
  const summary = activeSession?.summary || '会话详情'
  const agent = activeSession?.agent || selectedWorkspace?.defaultAgent || '智能体'
  const updatedAt = activeSession?.updatedAt || ''

  useEffect(() => {
    if (!isOpen || !sessionId) {
      setMessages([])
      setIsLoading(false)
      return
    }

    if (isNative && window.flywork?.getNativeThreadMessages) {
      setIsLoading(true)
      window.flywork
        .getNativeThreadMessages(sessionId)
        .then((msgs) => {
          setMessages(msgs || [])
        })
        .catch((err) => {
          console.error('Failed to load session messages:', err)
          setMessages([])
        })
        .finally(() => {
          setIsLoading(false)
        })
    } else if (activeSession?.messages) {
      setMessages(activeSession.messages)
      setIsLoading(false)
    } else {
      setMessages([])
      setIsLoading(false)
    }
  }, [isOpen, sessionId, isNative, activeSession])

  const handleCopySessionId = () => {
    if (!sessionId) return
    navigator.clipboard?.writeText(sessionId)
    setCopiedId(true)
    setTimeout(() => setCopiedId(false), 2000)
  }

  if (!isOpen) return <div className="context-panel collapsed" />

  return (
    <div className="context-panel">
      {/* Header */}
      <div className="context-panel-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
            💬 会话内容
          </span>
          <span className="badge badge-purple" style={{ fontSize: 10, padding: '2px 6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {agent}
          </span>
        </div>
        <button
          className="btn btn-ghost btn-icon btn-sm"
          onClick={onClose}
          title="关闭面板"
          style={{ width: 26, height: 26, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: 'var(--text-muted)' }}
        >
          ✕
        </button>
      </div>

      {/* Session Metadata Banner */}
      <div style={{ padding: '12px 16px', background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6, lineHeight: 1.4, wordBreak: 'break-word' }}>
          {summary}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, color: 'var(--text-muted)' }}>
          {sessionId && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, overflow: 'hidden' }}>
                <span>ID:</span>
                <code style={{ fontSize: 10, fontFamily: 'monospace', color: 'var(--text-secondary)', background: 'var(--bg-base)', padding: '1px 4px', borderRadius: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {sessionId}
                </code>
              </div>
              <button
                className="btn btn-ghost btn-sm"
                onClick={handleCopySessionId}
                style={{ fontSize: 10, padding: '1px 6px', flexShrink: 0, color: copiedId ? 'var(--accent-green)' : 'var(--text-muted)' }}
              >
                {copiedId ? '✓ 已复制' : '复制 ID'}
              </button>
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 }}>
            {updatedAt && <span>更新: {updatedAt}</span>}
            {!isLoading && <span className="badge badge-gray" style={{ fontSize: 10 }}>共 {messages.length} 条消息</span>}
          </div>
        </div>
      </div>

      {/* Conversation Messages Stream (Read-only) */}
      <div className="context-panel-body" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14, padding: '14px 16px' }}>
        {isLoading ? (
          <div style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
            <div style={{ fontSize: 22, marginBottom: 10 }}>⏳</div>
            <div>正在加载会话消息...</div>
          </div>
        ) : messages.length === 0 ? (
          <div style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: 24, marginBottom: 8, opacity: 0.7 }}>📭</div>
            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 4 }}>
              暂无对话记录
            </div>
            <div style={{ fontSize: 11, opacity: 0.8, lineHeight: 1.5 }}>
              该会话未记录对话消息或本地历史文件已归档。
            </div>
          </div>
        ) : (
          messages.map((msg, idx) => {
            const isUser = msg.role === 'user'
            return (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                  alignItems: isUser ? 'flex-end' : 'flex-start',
                  animation: 'fadeIn 120ms ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: 'var(--text-muted)', padding: '0 4px' }}>
                  <span>{isUser ? '👤 用户' : `🤖 ${agent}`}</span>
                  {msg.time && <span>· {msg.time}</span>}
                </div>
                <div
                  style={{
                    maxWidth: '96%',
                    padding: '10px 14px',
                    borderRadius: isUser ? '14px 14px 2px 14px' : '2px 14px 14px 14px',
                    background: isUser ? 'var(--accent-blue-dim)' : 'var(--bg-elevated)',
                    border: `1px solid ${isUser ? 'rgba(79,158,248,0.3)' : 'var(--border)'}`,
                    fontSize: 12,
                    lineHeight: 1.65,
                    color: 'var(--text-primary)',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word'
                  }}
                  className="selectable"
                >
                  {msg.content}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

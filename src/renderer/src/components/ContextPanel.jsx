import { useState, useEffect } from 'react'

const TABS = [
  { id: 'ai', label: 'AI 助手', icon: '🤖' },
  { id: 'context', label: '上下文', icon: '📎' },
  { id: 'log', label: '日志', icon: '📋' },
  { id: 'git', label: 'Git', icon: '⑂' }
]

const AI_CONVERSATIONS = [
  {
    role: 'user',
    content: '分析 Jenkins 构建失败原因'
  },
  {
    role: 'assistant',
    content: '根据构建日志分析，失败原因是工作目录中存在 `report.xml` 文件，阻塞了 checkout 步骤。\n\n**根因**：Jenkins Workspace 未被清理，上次构建残留了测试报告文件。\n\n**修复方案**：\n1. 在 Jenkinsfile 中 checkout 前添加 `cleanWs()` 步骤\n2. 或在 checkout 选项中启用 `clean: true`\n\n```groovy\nstage(\'Checkout\') {\n  steps {\n    cleanWs()\n    checkout scm\n  }\n}\n```',
    time: '10:48'
  }
]

export default function ContextPanel({ isOpen, activeTab, onTabChange, currentView, selectedWorkspace, sessions, activityLog }) {
  const [aiInput, setAiInput] = useState('')
  const [conversations, setConversations] = useState(AI_CONVERSATIONS)
  const [isTyping, setIsTyping] = useState(false)
  const [selectedAgent, setSelectedAgent] = useState('Claude Code')
  const [localAgents, setLocalAgents] = useState({
    claude: { installed: false },
    codex: { installed: false },
    opencode: { installed: false },
    gemini: { installed: false }
  })

  useEffect(() => {
    if (window.flywork?.detectLocalAgents) {
      window.flywork.detectLocalAgents().then((res) => {
        if (res) setLocalAgents(res)
      })
    }
  }, [])

  if (!isOpen) return <div className="context-panel collapsed" />

  const handleAISend = () => {
    if (!aiInput.trim()) return
    const msg = aiInput.trim()
    setAiInput('')
    setConversations(prev => [...prev, { role: 'user', content: msg }])
    setIsTyping(true)
    setTimeout(() => {
      setConversations(prev => [...prev, {
        role: 'assistant',
        content: `正在分析「${msg}」...\n\n我已收集当前工作上下文（分支 ${selectedWorkspace?.gitBranch || 'main'}，${selectedWorkspace?.gitModifiedFiles?.length || 0} 个修改文件），将生成针对性建议。`,
        time: new Date().toLocaleTimeString('zh-CN', { hour:'2-digit', minute:'2-digit' })
      }])
      setIsTyping(false)
    }, 1500)
  }

  const recentActivity = activityLog?.slice(0, 5) || []

  return (
    <div className="context-panel">
      <div className="context-panel-header">
        <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--text-secondary)' }}>
          上下文面板
        </span>
        {selectedWorkspace && (
          <span className="badge badge-blue" style={{ fontSize: 10 }}>
            {selectedWorkspace.icon} {selectedWorkspace.name}
          </span>
        )}
      </div>

      <div className="context-panel-tabs">
        {TABS.map(tab => (
          <button
            key={tab.id}
            className={`context-panel-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => onTabChange(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="context-panel-body">
        {activeTab === 'ai' && (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 0 }}>
            {/* Agent selector with real CLI auto-detection */}
            <div style={{ marginBottom: 12, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>已检测到的 CLI 智能体</div>
              </div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {[
                  { id: 'claude', name: 'Claude Code', installed: localAgents.claude?.installed },
                  { id: 'codex', name: 'Codex', installed: localAgents.codex?.installed },
                  { id: 'opencode', name: 'OpenCode', installed: localAgents.opencode?.installed },
                  { id: 'gemini', name: 'Gemini', installed: localAgents.gemini?.installed }
                ].map(agent => (
                  <button
                    key={agent.id}
                    className={`btn btn-sm ${selectedAgent === agent.name ? 'btn-secondary' : 'btn-ghost'}`}
                    onClick={() => setSelectedAgent(agent.name)}
                    style={{ fontSize: 10, display: 'flex', alignItems: 'center', gap: 4, opacity: agent.installed ? 1 : 0.5 }}
                    title={agent.installed ? `本地已检测到 ${agent.name} CLI` : `本地未检测到 ${agent.name}`}
                  >
                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: agent.installed ? 'var(--accent-green)' : 'var(--text-muted)' }} />
                    {agent.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Conversations */}
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 12 }}>
              {conversations.map((msg, i) => (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                  <div
                    style={{
                      maxWidth: '90%',
                      padding: '8px 10px',
                      borderRadius: msg.role === 'user' ? '12px 12px 4px 12px' : '4px 12px 12px 12px',
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
              ))}
              {isTyping && (
                <div style={{ display: 'flex', gap: 4, padding: '8px 10px', background: 'var(--bg-elevated)', borderRadius: '4px 12px 12px 12px', border: '1px solid var(--border)', width: 'fit-content' }}>
                  {[0,1,2].map(i => (
                    <span key={i} style={{ width:6, height:6, borderRadius:'50%', background:'var(--text-muted)', animation:`blink 1.2s ease infinite`, animationDelay: `${i*0.2}s` }} />
                  ))}
                </div>
              )}
            </div>

            {/* Input */}
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10 }}>
              <div className="quick-input" style={{ padding: '6px 10px' }}>
                <input
                  placeholder="询问 AI，或描述任务..."
                  value={aiInput}
                  onChange={e => setAiInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAISend() } }}
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
                上下文已包含：{selectedWorkspace ? `${selectedWorkspace.name} · ${selectedWorkspace.gitBranch}` : '全局'}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'context' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {selectedWorkspace ? (
              <>
                <div>
                  <div className="section-title" style={{ marginBottom: 8 }}>工作空间</div>
                  <div className="card" style={{ padding: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <span style={{ fontSize: 20 }}>{selectedWorkspace.icon}</span>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{selectedWorkspace.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{selectedWorkspace.root}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {selectedWorkspace.tags.map(tag => (
                        <span key={tag} className="badge badge-gray" style={{ fontSize: 10 }}>{tag}</span>
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                  <div className="section-title" style={{ marginBottom: 8 }}>Git 状态</div>
                  <div className="card" style={{ padding: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                      <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--accent-blue)', background: 'var(--accent-blue-dim)', padding: '2px 6px', borderRadius: 4 }}>
                        ⑂ {selectedWorkspace.gitBranch}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 6 }}>
                      {selectedWorkspace.gitModifiedFiles?.length || 0} 个修改文件
                    </div>
                    <div className="git-file-list">
                      {(selectedWorkspace.gitModifiedFiles || []).slice(0, 4).map((f, i) => (
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
                <div style={{ fontSize: 24, marginBottom: 8 }}>📎</div>
                <div className="empty-state-title">暂无上下文</div>
                <div className="empty-state-desc">打开一个工作空间后，这里会显示相关上下文信息</div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'log' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div className="section-title" style={{ marginBottom: 8 }}>最近活动</div>
            {recentActivity.map(item => (
              <div key={item.id} style={{ display: 'flex', gap: 8, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: 14, flexShrink: 0 }}>{item.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.detail}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{formatTime(item.timestamp)}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'git' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {selectedWorkspace ? (
              <>
                <div>
                  <div className="section-title" style={{ marginBottom: 8 }}>当前分支</div>
                  <div style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--accent-blue)', background: 'var(--bg-elevated)', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)' }}>
                    ⑂ {selectedWorkspace.gitBranch}
                  </div>
                </div>
                <div>
                  <div className="section-title" style={{ marginBottom: 8 }}>最近提交</div>
                  <div style={{ background: 'var(--bg-elevated)', borderRadius: 6, border: '1px solid var(--border)', padding: 10 }}>
                    <div style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text-muted)', marginBottom: 4 }}>{selectedWorkspace.lastCommitHash}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.5 }}>{selectedWorkspace.lastCommit}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>{selectedWorkspace.lastCommitTime}</div>
                  </div>
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div className="section-title">修改文件 ({selectedWorkspace.gitModifiedFiles?.length || 0})</div>
                  </div>
                  <div className="git-file-list">
                    {(selectedWorkspace.gitModifiedFiles || []).map((f, i) => (
                      <div key={i} className="git-file-item" style={{ padding: '4px 6px' }}>
                        <span className={`git-file-status git-status-${f.status}`}>{f.status}</span>
                        <span style={{ color: 'var(--text-primary)', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{f.path.split('/').slice(-2).join('/')}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn btn-secondary btn-sm" style={{ flex: 1 }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
                    AI 生成提交信息
                  </button>
                </div>
              </>
            ) : (
              <div className="empty-state">
                <div style={{ fontSize: 24 }}>⑂</div>
                <div className="empty-state-title">未选择工作空间</div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function formatTime(iso) {
  const d = new Date(iso)
  const now = new Date()
  const diff = now - d
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`
  return d.toLocaleDateString('zh-CN')
}

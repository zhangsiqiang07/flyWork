import { useState } from 'react'

const PRESET_ICONS = ['📁', '🐾', '🧠', '🐛', '⚡️', '🚀', '💻', '🛠️', '📦', '🌐', '🎨', '🔒', '📝', '⚙️', '🎯', '🔥', '📊', '💼', '💡', '🌟']

export default function EditWorkspaceModal({ workspace, onClose, onSave }) {
  const [name, setName] = useState(workspace?.name || '')
  const [icon, setIcon] = useState(workspace?.icon || '📁')
  const [defaultAgent, setDefaultAgent] = useState(workspace?.defaultAgent || 'Claude Code')
  const [customAgentPath, setCustomAgentPath] = useState(workspace?.customAgentPath || '')
  const [claudeProjectPath, setClaudeProjectPath] = useState(workspace?.claudeProjectPath || workspace?.root || '')
  const [codexProjectPath, setCodexProjectPath] = useState(workspace?.codexProjectPath || workspace?.root || '')

  const handleSave = () => {
    if (!name.trim()) return
    onSave(workspace.id, {
      name: name.trim(),
      icon,
      defaultAgent,
      customAgentPath: customAgentPath.trim(),
      claudeProjectPath: claudeProjectPath.trim(),
      codexProjectPath: codexProjectPath.trim()
    })
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 440 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">编辑工作空间配置</div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 8 }}>选择专属图标 (Emoji)</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {PRESET_ICONS.map((emoji) => (
                <button
                  key={emoji}
                  className={`btn ${icon === emoji ? 'btn-secondary' : 'btn-ghost'}`}
                  style={{
                    width: 36,
                    height: 36,
                    padding: 0,
                    fontSize: 18,
                    border: icon === emoji ? '2px solid var(--accent-blue)' : '1px solid var(--border)'
                  }}
                  onClick={() => setIcon(emoji)}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 6 }}>空间显示名称</div>
            <input
              className="quick-input"
              style={{
                width: '100%',
                padding: '8px 12px',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                borderRadius: 6,
                color: 'var(--text-primary)',
                fontSize: 13
              }}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="请输入工作空间名称"
              autoFocus
            />
          </div>

          <div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 6 }}>绑定默认 CLI 智能体</div>
            <select
              style={{
                width: '100%',
                padding: '8px 12px',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--accent-blue)',
                borderRadius: 6,
                color: 'var(--text-primary)',
                fontSize: 12,
                outline: 'none'
              }}
              value={defaultAgent}
              onChange={(e) => setDefaultAgent(e.target.value)}
            >
              <option value="Claude Code">🤖 Claude Code (推荐)</option>
              <option value="Codex">🧠 Codex CLI</option>
              <option value="OpenCode">💻 OpenCode CLI</option>
              <option value="Gemini">⚡️ Gemini CLI</option>
            </select>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
              进入该空间时将自动唤醒此智能体及对应独立对话记录。
            </div>
          </div>

          <div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 6 }}>Claude Code 关联 Project 目录</div>
            <input
              className="quick-input"
              style={{
                width: '100%',
                padding: '8px 12px',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                borderRadius: 6,
                color: 'var(--text-primary)',
                fontSize: 11,
                fontFamily: 'monospace'
              }}
              value={claudeProjectPath}
              onChange={(e) => setClaudeProjectPath(e.target.value)}
              placeholder="如 /Users/dimoo/Desktop/works/PetPal (查看 Claude 历史)"
            />
          </div>

          <div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 6 }}>Codex / ChatGPT 关联 Project 目录</div>
            <input
              className="quick-input"
              style={{
                width: '100%',
                padding: '8px 12px',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                borderRadius: 6,
                color: 'var(--text-primary)',
                fontSize: 11,
                fontFamily: 'monospace'
              }}
              value={codexProjectPath}
              onChange={(e) => setCodexProjectPath(e.target.value)}
              placeholder="如 /Users/dimoo/Desktop/works/PetPal (查看 Codex 历史)"
            />
          </div>

          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            关联工程目录：<span style={{ fontFamily: 'monospace', color: 'var(--accent-blue)' }}>{workspace?.root}</span>
          </div>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
            <button className="btn btn-ghost btn-sm" onClick={onClose}>
              取消
            </button>
            <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={!name.trim()}>
              保存修改
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

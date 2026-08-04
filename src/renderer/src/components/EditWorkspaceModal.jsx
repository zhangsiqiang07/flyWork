import { useState } from 'react'

const PRESET_ICONS = ['📁', '🐾', '🧠', '🐛', '⚡️', '🚀', '💻', '🛠️', '📦', '🌐', '🎨', '🔒', '📝', '⚙️', '🎯', '🔥', '📊', '💼', '💡', '🌟']

export default function EditWorkspaceModal({ workspace, onClose, onSave }) {
  const [name, setName] = useState(workspace?.name || '')
  const [icon, setIcon] = useState(workspace?.icon || '📁')
  const [defaultAgent, setDefaultAgent] = useState(workspace?.defaultAgent || 'Claude Code')
  const [root, setRoot] = useState(workspace?.root || '')
  const [customAgentPath, setCustomAgentPath] = useState(workspace?.customAgentPath || '')
  const [claudeProjectPath, setClaudeProjectPath] = useState(workspace?.claudeProjectPath || workspace?.root || '')
  const [codexProjectPath, setCodexProjectPath] = useState(workspace?.codexProjectPath || workspace?.root || '')

  const handleSave = () => {
    if (!name.trim()) return
    onSave(workspace.id, {
      name: name.trim(),
      icon,
      root: root.trim(),
      defaultAgent,
      customAgentPath: customAgentPath.trim(),
      claudeProjectPath: claudeProjectPath.trim(),
      codexProjectPath: codexProjectPath.trim()
    })
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ width: 480 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">
            <span>⚙️</span>
            <span>编辑工作空间配置</span>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label className="form-label">选择专属图标 (Emoji)</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {PRESET_ICONS.map((emoji) => (
                <button
                  key={emoji}
                  className={`btn ${icon === emoji ? 'btn-secondary' : 'btn-ghost'}`}
                  style={{
                    width: 36,
                    height: 36,
                    padding: 0,
                    fontSize: 18,
                    borderRadius: 8,
                    border: icon === emoji ? '2px solid var(--accent-blue)' : '1px solid rgba(255, 255, 255, 0.08)',
                    background: icon === emoji ? 'var(--accent-blue-dim)' : 'transparent'
                  }}
                  onClick={() => setIcon(emoji)}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="form-label">空间显示名称</label>
            <input
              className="form-control"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="请输入工作空间名称"
              autoFocus
            />
          </div>

          <div>
            <label className="form-label">工作区根目录</label>
            <input
              className="form-control"
              style={{ fontSize: 11, fontFamily: 'monospace' }}
              value={root}
              onChange={(e) => setRoot(e.target.value)}
              placeholder="如 /Users/dimoo/Desktop/works/PetPal"
            />
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 5 }}>
              自动化命令会在此目录中执行。
            </div>
          </div>

          <div>
            <label className="form-label">绑定默认 CLI 智能体</label>
            <select
              className="form-control"
              value={defaultAgent}
              onChange={(e) => setDefaultAgent(e.target.value)}
            >
              <option value="Claude Code">🤖 Claude Code (推荐)</option>
              <option value="Codex">🧠 Codex CLI</option>
              <option value="OpenCode">💻 OpenCode CLI</option>
              <option value="Gemini">⚡️ Gemini CLI</option>
            </select>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 5 }}>
              进入该空间时将自动唤醒此智能体及对应独立对话记录。
            </div>
          </div>

          <div>
            <label className="form-label">Claude Code 关联 Project 目录</label>
            <input
              className="form-control"
              style={{ fontSize: 11, fontFamily: 'monospace' }}
              value={claudeProjectPath}
              onChange={(e) => setClaudeProjectPath(e.target.value)}
              placeholder="如 /Users/dimoo/Desktop/works/PetPal"
            />
          </div>

          <div>
            <label className="form-label">Codex / ChatGPT 关联 Project 目录</label>
            <input
              className="form-control"
              style={{ fontSize: 11, fontFamily: 'monospace' }}
              value={codexProjectPath}
              onChange={(e) => setCodexProjectPath(e.target.value)}
              placeholder="如 /Users/dimoo/Desktop/works/PetPal"
            />
          </div>

        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary btn-sm" onClick={onClose}>
            取消
          </button>
          <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={!name.trim()}>
            保存修改
          </button>
        </div>
      </div>
    </div>
  )
}

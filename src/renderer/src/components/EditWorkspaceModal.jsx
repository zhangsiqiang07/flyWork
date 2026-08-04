import { useState } from 'react'

const PRESET_ICONS = ['📁', '🐾', '🧠', '🐛', '⚡️', '🚀', '💻', '🛠️', '📦', '🌐', '🎨', '🔒', '📝', '⚙️', '🎯', '🔥', '📊', '💼', '💡', '🌟']

export default function EditWorkspaceModal({ workspace, onClose, onSave }) {
  const [name, setName] = useState(workspace?.name || '')
  const [icon, setIcon] = useState(workspace?.icon || '📁')

  const handleSave = () => {
    if (!name.trim()) return
    onSave(workspace.id, { name: name.trim(), icon })
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">编辑工作空间信息</div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 8 }}>选择专属图标 (Emoji)</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {PRESET_ICONS.map((emoji) => (
                <button
                  key={emoji}
                  className={`btn ${icon === emoji ? 'btn-secondary' : 'btn-ghost'}`}
                  style={{
                    width: 38,
                    height: 38,
                    padding: 0,
                    fontSize: 20,
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
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSave()
              }}
              placeholder="请输入工作空间名称"
              autoFocus
            />
          </div>

          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            关联工程路径：<span style={{ fontFamily: 'monospace' }}>{workspace?.root}</span>
          </div>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
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

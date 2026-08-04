import { useState } from 'react'

export default function GitCreateBranchModal({ branches, currentBranch, onClose, onCreate }) {
  const [newBranchName, setNewBranchName] = useState('')
  const [baseBranch, setBaseBranch] = useState(currentBranch || 'main')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleCreate = async () => {
    if (!newBranchName.trim()) return
    setIsSubmitting(true)
    setError('')
    try {
      const res = await onCreate(newBranchName.trim(), baseBranch)
      if (res && !res.success) {
        setError(res.error || '创建分支失败')
      } else {
        onClose()
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 440 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">基于分支新建分支</div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {error && (
            <div style={{ background: 'var(--accent-red-dim)', color: 'var(--accent-red)', padding: '8px 12px', borderRadius: 6, fontSize: 12 }}>
              {error}
            </div>
          )}

          <div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 6 }}>基准分支 (Base Branch)</div>
            <select
              style={{
                width: '100%',
                padding: '8px 12px',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                borderRadius: 6,
                color: 'var(--text-primary)',
                fontSize: 12,
                outline: 'none'
              }}
              value={baseBranch}
              onChange={(e) => setBaseBranch(e.target.value)}
            >
              {branches.map((b) => (
                <option key={b.name} value={b.name}>
                  {b.isCurrent ? `⑂ ${b.name} (当前)` : b.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 6 }}>新分支名称</div>
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
              placeholder="例如: feature/user-profile 或 fix/login-issue"
              value={newBranchName}
              onChange={(e) => setNewBranchName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreate()
              }}
              autoFocus
            />
          </div>

          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>常用前缀推荐:</span>
            {['feat/', 'fix/', 'refactor/', 'docs/'].map((prefix) => (
              <button
                key={prefix}
                className="btn btn-ghost btn-sm"
                style={{ fontSize: 10, padding: '2px 6px' }}
                onClick={() => setNewBranchName((prev) => (prev.startsWith(prefix) ? prev : `${prefix}${prev}`))}
              >
                + {prefix}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
            <button className="btn btn-ghost btn-sm" onClick={onClose}>
              取消
            </button>
            <button className="btn btn-primary btn-sm" onClick={handleCreate} disabled={!newBranchName.trim() || isSubmitting}>
              {isSubmitting ? '创建中...' : '创建并切换'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

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
      <div className="modal" style={{ width: 440 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">
            <span>⑂</span>
            <span>新建 Git 分支</span>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {error && (
            <div style={{ background: 'var(--accent-red-dim)', color: 'var(--accent-red)', padding: '10px 14px', borderRadius: 8, fontSize: 12, border: '1px solid var(--accent-red)' }}>
              {error}
            </div>
          )}

          <div>
            <label className="form-label">基准分支 (Base Branch)</label>
            <select
              className="form-control"
              value={baseBranch}
              onChange={(e) => setBaseBranch(e.target.value)}
            >
              {branches.map((b) => (
                <option key={b.name} value={b.name}>
                  {b.isCurrent ? `⑂ ${b.name} (当前分支)` : b.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="form-label">新分支名称</label>
            <input
              className="form-control"
              placeholder="例如 feature/user-profile 或 fix/login-issue"
              value={newBranchName}
              onChange={(e) => setNewBranchName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreate()
              }}
              autoFocus
            />
          </div>

          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>常用前缀快速添加:</span>
            {['feat/', 'fix/', 'refactor/', 'docs/'].map((prefix) => (
              <button
                key={prefix}
                type="button"
                className="btn btn-ghost btn-sm"
                style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6 }}
                onClick={() => setNewBranchName((prev) => (prev.startsWith(prefix) ? prev : `${prefix}${prev}`))}
              >
                + {prefix}
              </button>
            ))}
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary btn-sm" onClick={onClose}>
            取消
          </button>
          <button className="btn btn-primary btn-sm" onClick={handleCreate} disabled={!newBranchName.trim() || isSubmitting}>
            {isSubmitting ? '创建中...' : '创建并切换分支'}
          </button>
        </div>
      </div>
    </div>
  )
}

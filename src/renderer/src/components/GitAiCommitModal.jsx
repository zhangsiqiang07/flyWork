import { useState, useEffect } from 'react'

export default function GitAiCommitModal({ workspace, onClose, onCommitSuccess }) {
  const [loading, setLoading] = useState(true)
  const [commitMessage, setCommitMessage] = useState('')
  const [diffStat, setDiffStat] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    async function generatePreview() {
      setLoading(true)
      setError('')
      try {
        if (window.flywork?.gitAiCommitPreview) {
          const res = await window.flywork.gitAiCommitPreview(workspace.root)
          if (res.success) {
            setCommitMessage(res.commitMessage)
            setDiffStat(res.diffStat || '')
          } else {
            setError(res.error || '无法生成 Commit 预览')
          }
        }
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    generatePreview()
  }, [workspace.root])

  const handleCommit = async () => {
    if (!commitMessage.trim()) return
    setIsSubmitting(true)
    setError('')
    try {
      if (window.flywork?.gitCommit) {
        const res = await window.flywork.gitCommit(workspace.root, commitMessage.trim(), true)
        if (res.success) {
          if (onCommitSuccess) onCommitSuccess()
          onClose()
        } else {
          setError(res.error || '提交失败')
        }
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ width: 540 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 20 }}>🤖</span>
            <div>
              <div className="modal-title">AI 智能 Git Commit 生成</div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>常规提交格式 (Conventional Commits) 自动推导</div>
            </div>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {loading ? (
            <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: 28, marginBottom: 10, animation: 'spin 1.2s linear infinite', display: 'inline-block' }}>⟳</div>
              <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>正在通过 AI 智能分析工作区未提交的文件变更...</div>
            </div>
          ) : error ? (
            <div style={{ background: 'var(--accent-red-dim)', color: 'var(--accent-red)', padding: '12px 14px', borderRadius: 8, fontSize: 13, border: '1px solid var(--accent-red)' }}>
              {error}
            </div>
          ) : (
            <>
              {diffStat && (
                <div>
                  <label className="form-label">改动差异文件 (git status / diff)</label>
                  <div
                    className="terminal-output"
                    style={{
                      maxHeight: 90,
                      fontSize: 11,
                      padding: '8px 12px',
                      borderRadius: 8,
                      background: 'rgba(0, 0, 0, 0.3)',
                      border: '1px solid rgba(255, 255, 255, 0.08)'
                    }}
                  >
                    {diffStat}
                  </div>
                </div>
              )}

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <label className="form-label" style={{ marginBottom: 0 }}>生成的 Commit 提交信息 (可修正)</label>
                  <span style={{ fontSize: 10, color: 'var(--accent-blue)' }}>Conventional Commit</span>
                </div>
                <textarea
                  className="form-control"
                  style={{
                    height: 120,
                    fontSize: 12,
                    lineHeight: 1.6,
                    fontFamily: 'monospace',
                    resize: 'vertical'
                  }}
                  value={commitMessage}
                  onChange={(e) => setCommitMessage(e.target.value)}
                />
              </div>
            </>
          )}
        </div>

        {!loading && !error && (
          <div className="modal-footer">
            <button className="btn btn-secondary btn-sm" onClick={onClose}>
              取消
            </button>
            <button className="btn btn-primary btn-sm" onClick={handleCommit} disabled={!commitMessage.trim() || isSubmitting}>
              {isSubmitting ? '提交中...' : '确认并 Git Add & Commit'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

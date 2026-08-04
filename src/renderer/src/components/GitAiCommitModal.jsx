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
      <div className="modal" style={{ maxWidth: 520 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 18 }}>🤖</span>
            <div>
              <div className="modal-title">AI 智能 Commit 提交</div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>基于 Conventional Commits 自动分析变更</div>
            </div>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {loading ? (
            <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: 24, marginBottom: 8, animation: 'pulseGlow 1.5s infinite' }}>🤖</div>
              <div style={{ fontSize: 13 }}>正在使用 AI 分析未提交的改动差异...</div>
            </div>
          ) : error ? (
            <div style={{ background: 'var(--accent-red-dim)', color: 'var(--accent-red)', padding: '12px 14px', borderRadius: 6, fontSize: 13 }}>
              {error}
            </div>
          ) : (
            <>
              {diffStat && (
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>改动统计 (git diff)</div>
                  <div className="terminal-output" style={{ maxHeight: 70, fontSize: 11 }}>
                    {diffStat}
                  </div>
                </div>
              )}

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>生成提交说明 (常规提交 Conventional Commit，可直接修改)</div>
                  <span style={{ fontSize: 10, color: 'var(--accent-blue)' }}>格式: type(scope): 说明</span>
                </div>
                <textarea
                  className="quick-input"
                  style={{
                    width: '100%',
                    height: 120,
                    padding: '8px 12px',
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border)',
                    borderRadius: 6,
                    color: 'var(--text-primary)',
                    fontSize: 12,
                    lineHeight: 1.6,
                    fontFamily: 'monospace',
                    resize: 'vertical'
                  }}
                  value={commitMessage}
                  onChange={(e) => setCommitMessage(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
                <button className="btn btn-ghost btn-sm" onClick={onClose}>
                  取消
                </button>
                <button className="btn btn-primary btn-sm" onClick={handleCommit} disabled={!commitMessage.trim() || isSubmitting}>
                  {isSubmitting ? '提交中...' : '确认并 Git Add & Commit'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

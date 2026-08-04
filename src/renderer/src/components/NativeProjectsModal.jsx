import { useState, useEffect } from 'react'

export default function NativeProjectsModal({ onClose, onImportProject, existingRoots = [] }) {
  const [nativeProjects, setNativeProjects] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadProjects() {
      setLoading(true)
      try {
        if (window.flywork?.getNativeAgentProjects) {
          const list = await window.flywork.getNativeAgentProjects()
          setNativeProjects(list || [])
        }
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    loadProjects()
  }, [])

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ width: 540 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 20 }}>⚡️</span>
            <div>
              <div className="modal-title">自动识别本地原生 CLI 项目</div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>扫码检测 ~/.claude 及 ~/.codex 本地生成的历史会话与项目</div>
            </div>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {loading ? (
            <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: 28, marginBottom: 8, animation: 'spin 1.2s linear infinite', display: 'inline-block' }}>⟳</div>
              <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>正在检索本地 CLI 配置文件与存储库...</div>
            </div>
          ) : nativeProjects.length === 0 ? (
            <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
              未在本地 CLI 历史记录中找到新项目。
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 340, overflowY: 'auto' }}>
              {nativeProjects.map((p) => {
                const isAlreadyAdded = existingRoots.includes(p.root)
                return (
                  <div
                    key={p.root}
                    style={{
                      padding: '12px 14px',
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: 10,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 12
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                        📁 {p.name}
                        <span className="badge badge-purple" style={{ fontSize: 10 }}>
                          {p.agent} ({p.count} 条记录)
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'monospace', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {p.root}
                      </div>
                    </div>
                    {isAlreadyAdded ? (
                      <span className="badge badge-gray" style={{ fontSize: 11 }}>已在工作区</span>
                    ) : (
                      <button
                        className="btn btn-primary btn-sm"
                        style={{ fontSize: 11 }}
                        onClick={() => {
                          onImportProject(p)
                          onClose()
                        }}
                      >
                        + 一键导入
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary btn-sm" onClick={onClose}>
            关闭
          </button>
        </div>
      </div>
    </div>
  )
}

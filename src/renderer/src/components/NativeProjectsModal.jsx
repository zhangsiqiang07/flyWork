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
      <div className="modal" style={{ maxWidth: 520 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 20 }}>⚡️</span>
            <div>
              <div className="modal-title">发现并导入本地原生 CLI 项目</div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>自动识别 Claude Code / Codex 本地产生过的项目及对话</div>
            </div>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {loading ? (
            <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: 13 }}>正在扫描本地 ~/.claude 及 ~/.codex 存储的项目目录...</div>
            </div>
          ) : nativeProjects.length === 0 ? (
            <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
              未在本地 CLI 找到其他外部项目目录。
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 320, overflowY: 'auto' }}>
              {nativeProjects.map((p) => {
                const isAlreadyAdded = existingRoots.includes(p.root)
                return (
                  <div
                    key={p.root}
                    style={{
                      padding: '10px 14px',
                      background: 'var(--bg-elevated)',
                      border: '1px solid var(--border)',
                      borderRadius: 8,
                      display: 'flex',
                      alignItems: 'center',
                      justify: 'space-between',
                      gap: 12
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                        📁 {p.name}
                        <span className="badge badge-purple" style={{ fontSize: 10 }}>
                          {p.agent} ({p.count} 条记录)
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'monospace', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {p.root}
                      </div>
                    </div>
                    {isAlreadyAdded ? (
                      <span className="badge badge-gray" style={{ fontSize: 11 }}>已加入空间</span>
                    ) : (
                      <button
                        className="btn btn-primary btn-sm"
                        style={{ fontSize: 11 }}
                        onClick={() => {
                          onImportProject(p)
                          onClose()
                        }}
                      >
                        + 一键绑定导入
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
            <button className="btn btn-ghost btn-sm" onClick={onClose}>
              关闭
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

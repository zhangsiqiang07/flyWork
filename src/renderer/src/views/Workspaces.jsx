import { useState } from 'react'
import EditWorkspaceModal from '../components/EditWorkspaceModal'

export default function Workspaces({ workspaces, sessions, onOpenWorkspace, onAddWorkspace, onUpdateWorkspace, onDeleteWorkspace }) {
  const [editingWorkspace, setEditingWorkspace] = useState(null)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div className="page-title">工作空间</div>
            <div className="page-subtitle">{workspaces.length} 个项目 · 管理长期项目和域</div>
          </div>
          <button className="btn btn-primary btn-sm" onClick={onAddWorkspace}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v8M8 12h8"/></svg>
            添加本地项目
          </button>
        </div>
      </div>

      <div className="page-content" style={{ overflowY: 'auto' }}>
        <div className="workspace-grid">
          {workspaces.map((ws, i) => {
            const wsSession = sessions.filter(s => s.workspaceId === ws.id && s.status === 'active')
            return (
              <div
                key={ws.id}
                className="card card-clickable workspace-card"
                onClick={() => onOpenWorkspace(ws.id)}
                style={{ animation: `fadeIn 200ms ease ${i * 40}ms both`, position: 'relative' }}
              >
                <div className="workspace-card-header">
                  <div className="workspace-card-icon" style={{ background: ws.bgColor }}>
                    {ws.icon}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="workspace-card-name">{ws.name}</div>
                    <div className="workspace-card-meta">{ws.description}</div>
                  </div>
                  <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
                    {ws.buildStatus === 'failed' && (
                      <span className="badge badge-red" style={{ fontSize: 10 }}>构建失败</span>
                    )}
                    {ws.buildStatus === 'success' && wsSession.length > 0 && (
                      <span className="badge badge-green" style={{ fontSize: 10 }}>工作中</span>
                    )}
                    {ws.buildStatus === 'success' && wsSession.length === 0 && (
                      <span className="badge badge-gray" style={{ fontSize: 10 }}>正常</span>
                    )}
                    {onUpdateWorkspace && (
                      <button
                        className="btn btn-ghost btn-icon"
                        style={{ width: 22, height: 22, padding: 0, fontSize: 11 }}
                        title="修改名称及图标"
                        onClick={(e) => {
                          e.stopPropagation()
                          setEditingWorkspace(ws)
                        }}
                      >
                        ✏️
                      </button>
                    )}
                    {onDeleteWorkspace && (
                      <button
                        className="btn btn-ghost btn-icon"
                        style={{ width: 22, height: 22, padding: 0, fontSize: 12 }}
                        title="删除工作空间"
                        onClick={(e) => {
                          e.stopPropagation()
                          if (confirm(`确定要移除工作空间 "${ws.name}" 吗？`)) {
                            onDeleteWorkspace(ws.id)
                          }
                        }}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>

                <div style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <span style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--accent-blue)' }}>⑂ {ws.gitBranch || 'main'}</span>
                    {ws.gitModifiedFiles?.length > 0 && (
                      <span className="badge badge-amber" style={{ fontSize: 10 }}>{ws.gitModifiedFiles.length} 个修改</span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {ws.lastCommit}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{ws.lastCommitTime}</div>
                </div>

                {ws.services?.length > 0 && (
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
                    {ws.services.map(svc => (
                      <span key={svc.name} className="badge" style={{ fontSize: 10, background: svc.status === 'online' ? 'var(--accent-green-dim)' : 'var(--accent-red-dim)', color: svc.status === 'online' ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                        <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'currentColor', display: 'inline-block', marginRight: 3 }}/>
                        {svc.name}
                      </span>
                    ))}
                  </div>
                )}

                <div className="workspace-card-stats">
                  <div className="workspace-card-stat">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                    {ws.actions?.length || 0} 个动作
                  </div>
                  {wsSession.length > 0 && (
                    <div className="workspace-card-stat" style={{ color: 'var(--accent-green)' }}>
                      <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--accent-green)' }}/>
                      活跃会话
                    </div>
                  )}
                  <div className="workspace-card-stat" style={{ marginLeft: 'auto' }}>
                    <span>{ws.tags?.slice(0, 2).join(' · ')}</span>
                  </div>
                </div>
              </div>
            )
          })}

          {/* New workspace card */}
          <div
            className="card card-clickable workspace-card"
            onClick={onAddWorkspace}
            style={{ border: '1px dashed var(--border)', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 160 }}
          >
            <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>+</div>
              <div style={{ fontSize: 12, fontWeight: 500 }}>添加工作空间</div>
              <div style={{ fontSize: 11, marginTop: 4 }}>选择本地工程或 Git 仓库文件夹</div>
            </div>
          </div>
        </div>
      </div>

      {editingWorkspace && (
        <EditWorkspaceModal
          workspace={editingWorkspace}
          onClose={() => setEditingWorkspace(null)}
          onSave={onUpdateWorkspace}
        />
      )}
    </div>
  )
}

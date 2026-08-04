export default function StatusBar({ workspaces, sessions }) {
  const failedBuilds = workspaces.filter(w => w.buildStatus === 'failed').length
  const activeSessions = sessions.filter(s => s.status === 'active').length
  const totalServices = workspaces.reduce((acc, w) => acc + (w.services?.length || 0), 0)
  const onlineServices = workspaces.reduce((acc, w) => acc + (w.services?.filter(s => s.status === 'online').length || 0), 0)
  const totalModifiedFiles = workspaces.reduce((acc, w) => acc + (w.gitModifiedFiles?.length || 0), 0)

  return (
    <div className="status-bar">
      {activeSessions > 0 && (
        <div className="status-bar-item">
          <span className="dot dot-green" />
          <span>{activeSessions} 个会话工作中</span>
        </div>
      )}

      {totalServices > 0 && (
        <div className="status-bar-item">
          <span className={`dot ${onlineServices === totalServices ? 'dot-green' : 'dot-amber'}`} />
          <span>服务 {onlineServices}/{totalServices} 在线</span>
        </div>
      )}

      {failedBuilds > 0 && (
        <div className="status-bar-item">
          <span className="dot dot-red" />
          <span>构建失败 {failedBuilds} 个</span>
        </div>
      )}

      {totalModifiedFiles > 0 && (
        <div className="status-bar-item">
          <span className="dot dot-amber" />
          <span>Git 有 {totalModifiedFiles} 个未提交文件</span>
        </div>
      )}

      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div className="status-bar-item" style={{ color: 'var(--text-muted)', gap: 4 }}>
          <span>⌘K</span>
          <span>命令中心</span>
        </div>
        <div className="status-bar-item" style={{ color: 'var(--text-muted)' }}>
          <span>{new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
      </div>
    </div>
  )
}

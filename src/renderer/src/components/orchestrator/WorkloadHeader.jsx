export default function WorkloadHeader({
  tasks = [],
  onOpenDecompose,
  onOpenBatchAssign,
  onOpenReconcile,
  onOpenBugModal,
  onRunReadyTasks,
  isRunningAll = false
}) {
  // Compute counts
  const total = tasks.length
  const done = tasks.filter((t) => t.status === 'DONE').length
  const running = tasks.filter((t) => t.status === 'RUNNING').length
  const ready = tasks.filter((t) => t.status === 'READY').length
  const blocked = tasks.filter((t) => t.status === 'BLOCKED').length
  const waitApi = tasks.filter((t) => t.status === 'WAITING_API').length
  const waitDesign = tasks.filter((t) => t.status === 'WAITING_DESIGN').length

  // Agent Workload distribution
  const agentWorkload = {
    chatgpt: { name: 'ChatGPT', count: 0, color: '#10a37f' },
    antigravity: { name: 'Antigravity', count: 0, color: '#8b5cf6' },
    'claude-code': { name: 'Claude Code', count: 0, color: '#d97706' },
    trae: { name: 'TRAE', count: 0, color: '#06b6d4' },
    workbuddy: { name: 'WorkBuddy', count: 0, color: '#3b82f6' }
  }

  tasks.forEach((t) => {
    const agentId = t.execution?.selected?.agent_id || t.execution?.recommended?.agent_id
    if (agentId && agentWorkload[agentId]) {
      agentWorkload[agentId].count++
    }
  })

  return (
    <div
      style={{
        background: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border)',
        padding: '12px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12
      }}
    >
      {/* Top Row: Title, Status Metrics, Action Buttons */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 'var(--radius-md)',
              background: 'linear-gradient(135deg, rgba(139,92,246,0.25), rgba(79,158,248,0.25))',
              border: '1px solid rgba(139,92,246,0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 16
            }}
          >
            🧭
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
                Development Orchestrator
              </span>
              <span
                style={{
                  fontSize: 11,
                  padding: '2px 8px',
                  borderRadius: 12,
                  background: 'rgba(79,158,248,0.15)',
                  color: 'var(--accent-blue)',
                  fontWeight: 600,
                  border: '1px solid rgba(79,158,248,0.3)'
                }}
              >
                智能研发编排
              </span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
              PRD → Engineering Task Graph → Agent/Model Routing → 多智能体协同
            </div>
          </div>
        </div>

        {/* Global Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={onOpenDecompose}
            style={{
              background: 'linear-gradient(135deg, rgba(79,158,248,0.2), rgba(139,92,246,0.2))',
              border: '1px solid rgba(79,158,248,0.4)',
              color: 'var(--text-primary)',
              borderRadius: 'var(--radius-md)',
              padding: '6px 12px',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            <span>✨</span> AI 拆解 PRD
          </button>

          <button
            onClick={onOpenBatchAssign}
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
              borderRadius: 'var(--radius-md)',
              padding: '6px 12px',
              fontSize: 12,
              fontWeight: 500,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            <span>⚡</span> 按层批量指派
          </button>

          <button
            onClick={onOpenReconcile}
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
              borderRadius: 'var(--radius-md)',
              padding: '6px 12px',
              fontSize: 12,
              fontWeight: 500,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            <span>🔗</span> 资产注入 / Reconcile
          </button>

          {onOpenBugModal && (
            <button
              onClick={onOpenBugModal}
              style={{
                background: 'rgba(224,92,92,0.08)',
                border: '1px solid rgba(224,92,92,0.3)',
                color: 'var(--accent-red)',
                borderRadius: 'var(--radius-md)',
                padding: '6px 12px',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              <span>🐛</span> 关联云效 Bug
            </button>
          )}

          <button
            onClick={onRunReadyTasks}
            disabled={ready === 0 || isRunningAll}
            style={{
              background:
                ready > 0
                  ? 'linear-gradient(135deg, #238636, #2ea043)'
                  : 'var(--bg-elevated)',
              border: '1px solid ' + (ready > 0 ? '#3fb950' : 'var(--border)'),
              color: ready > 0 ? '#fff' : 'var(--text-muted)',
              borderRadius: 'var(--radius-md)',
              padding: '6px 14px',
              fontSize: 12,
              fontWeight: 600,
              cursor: ready > 0 ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              boxShadow: ready > 0 ? '0 0 12px rgba(63,185,80,0.3)' : 'none'
            }}
          >
            <span>{isRunningAll ? '⏳' : '▶'}</span>
            {isRunningAll ? '并行执行中...' : `一键运行就绪任务 (${ready})`}
          </button>
        </div>
      </div>

      {/* Middle Row: Status Metric Badges */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>
          {total} Tasks:
        </span>

        <span
          style={{
            fontSize: 11,
            padding: '3px 8px',
            borderRadius: 6,
            background: 'rgba(63,185,80,0.12)',
            color: 'var(--accent-green)',
            border: '1px solid rgba(63,185,80,0.3)',
            fontWeight: 600
          }}
        >
          ✓ DONE {done}
        </span>

        {running > 0 && (
          <span
            style={{
              fontSize: 11,
              padding: '3px 8px',
              borderRadius: 6,
              background: 'rgba(79,158,248,0.15)',
              color: 'var(--accent-blue)',
              border: '1px solid rgba(79,158,248,0.3)',
              fontWeight: 600
            }}
          >
            ● RUNNING {running}
          </span>
        )}

        <span
          style={{
            fontSize: 11,
            padding: '3px 8px',
            borderRadius: 6,
            background: 'rgba(79,158,248,0.12)',
            color: 'var(--accent-blue)',
            border: '1px solid rgba(79,158,248,0.3)',
            fontWeight: 600
          }}
        >
          ⚡ READY {ready}
        </span>

        <span
          style={{
            fontSize: 11,
            padding: '3px 8px',
            borderRadius: 6,
            background: 'rgba(210,153,34,0.12)',
            color: 'var(--accent-amber)',
            border: '1px solid rgba(210,153,34,0.3)',
            fontWeight: 600
          }}
        >
          ⛔ BLOCKED {blocked}
        </span>

        {waitApi > 0 && (
          <span
            style={{
              fontSize: 11,
              padding: '3px 8px',
              borderRadius: 6,
              background: 'rgba(163,113,247,0.12)',
              color: 'var(--accent-purple)',
              border: '1px solid rgba(163,113,247,0.3)',
              fontWeight: 600
            }}
          >
            ⏳ WAIT API {waitApi}
          </span>
        )}

        {waitDesign > 0 && (
          <span
            style={{
              fontSize: 11,
              padding: '3px 8px',
              borderRadius: 6,
              background: 'rgba(224,92,92,0.12)',
              color: '#f87171',
              border: '1px solid rgba(224,92,92,0.3)',
              fontWeight: 600
            }}
          >
            🎨 WAIT DESIGN {waitDesign}
          </span>
        )}
      </div>

      {/* Bottom Row: Multi-Agent Workload Distribution Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          background: 'var(--bg-elevated)',
          padding: '8px 12px',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border)'
        }}
      >
        <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600, flexShrink: 0 }}>
          🤖 智能体负载分布 (Agent Workload):
        </span>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flex: 1, flexWrap: 'wrap' }}>
          {Object.entries(agentWorkload).map(([key, data]) => {
            const pct = total > 0 ? Math.round((data.count / total) * 100) : 0
            return (
              <div
                key={key}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 11
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: data.color
                  }}
                />
                <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{data.name}</span>
                <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>
                  {data.count} ({pct}%)
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

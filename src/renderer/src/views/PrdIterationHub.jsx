import { useState, useMemo } from 'react'
import PrdDecomposeModal from '../components/orchestrator/PrdDecomposeModal'

export default function PrdIterationHub({
  plans = [],
  onSelectPlan,
  onCreatePlan,
  onRunReadyTasksForPlan,
  workspaces = [],
  onAddWorkspace
}) {
  const [statusFilter, setStatusFilter] = useState('ALL') // ALL | IN_PROGRESS | PLANNING | DONE
  const [projectFilter, setProjectFilter] = useState('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [isDecomposeOpen, setIsDecomposeOpen] = useState(false)
  const [selectedPrdPreview, setSelectedPrdPreview] = useState(null)

  // Filtered plans
  const filteredPlans = useMemo(() => {
    return plans.filter((p) => {
      // Status filter
      if (statusFilter !== 'ALL' && p.status !== statusFilter) return false

      // Project filter
      if (projectFilter !== 'ALL') {
        const hasProj = (p.projects || []).some((proj) =>
          typeof proj === 'string' ? proj === projectFilter : proj.id === projectFilter
        )
        if (!hasProj) return false
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matchTitle = (p.title || '').toLowerCase().includes(q)
        const matchId = (p.requirement?.id || p.id || '').toLowerCase().includes(q)
        const matchDesc = (p.description || '').toLowerCase().includes(q)
        const matchPm = (p.leadPm || '').toLowerCase().includes(q)
        if (!matchTitle && !matchId && !matchDesc && !matchPm) return false
      }

      return true
    })
  }, [plans, statusFilter, projectFilter, searchQuery])

  // Aggregate metrics
  const totalPrds = plans.length
  const inProgressCount = plans.filter((p) => p.status === 'IN_PROGRESS').length
  const totalTasks = plans.reduce((acc, p) => acc + (p.tasks?.length || 0), 0)
  const totalReadyTasks = plans.reduce(
    (acc, p) => acc + (p.tasks || []).filter((t) => t.status === 'READY').length,
    0
  )

  const getStatusBadge = (status) => {
    switch (status) {
      case 'IN_PROGRESS':
        return { label: '● 进行中', bg: 'rgba(79,158,248,0.15)', color: '#4f9ef8', border: 'rgba(79,158,248,0.3)' }
      case 'PLANNING':
        return { label: '📋 规划中', bg: 'rgba(210,153,34,0.15)', color: '#d29922', border: 'rgba(210,153,34,0.3)' }
      case 'DONE':
        return { label: '✓ 已完成', bg: 'rgba(63,185,80,0.15)', color: '#3fb950', border: 'rgba(63,185,80,0.3)' }
      default:
        return { label: status, bg: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: 'var(--border)' }
    }
  }

  const handleImportNewPlan = (newPlan) => {
    const enrichedPlan = {
      ...newPlan,
      id: newPlan.planId || `PLAN-${Date.now().toString().slice(-4)}`,
      status: 'IN_PROGRESS',
      isDemo: false,
      leadPm: 'You (AI Architect)',
      techLead: 'Multi-Agent Team',
      updatedAt: '刚刚',
      description: `基于 PRD 智能拆解生成，包含 ${newPlan.tasks?.length || 0} 个工程分层任务。`,
      requirement: {
        id: `REQ-${Date.now().toString().slice(-4)}`,
        title: newPlan.title,
        version: 'v1.0',
        author: 'AI Planner',
        status: 'ACTIVE',
        prdSnippet: 'AI 自动解析生成的需求契约。'
      },
      projects: (newPlan.targetProjects || ['PetPal-iOS']).map((id) => ({ id, name: id }))
    }
    onCreatePlan(enrichedPlan)
    onSelectPlan(enrichedPlan.id)
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        width: '100%',
        background: 'var(--bg-base)',
        color: 'var(--text-primary)',
        overflowY: 'auto'
      }}
    >
      {/* 1. Top Header Area */}
      <div
        style={{
          background: 'var(--bg-surface)',
          borderBottom: '1px solid var(--border)',
          padding: '20px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: 16
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 16
          }}
        >
          {/* Title & Tagline */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: 'var(--radius-lg)',
                background: 'linear-gradient(135deg, rgba(79,158,248,0.25), rgba(139,92,246,0.25))',
                border: '1px solid rgba(79,158,248,0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 22
              }}
            >
              🧭
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>
                  需求与项目迭代中心
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
                  PRD Iteration Hub
                </span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 3 }}>
                以 PRD 需求与迭代版本为维度管理工程任务图，驱动多智能体协同开发与 DAG 自动化调度
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              onClick={() => setIsDecomposeOpen(true)}
              style={{
                background: 'linear-gradient(135deg, #4f9ef8, #8b5cf6)',
                border: 'none',
                color: '#fff',
                borderRadius: 'var(--radius-md)',
                padding: '8px 16px',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                boxShadow: '0 0 16px rgba(79,158,248,0.3)'
              }}
            >
              <span>✨</span> + AI 导入新 PRD 需求
            </button>
          </div>
        </div>

        {/* Aggregate KPI Metric Badges */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          <div
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              padding: '12px 14px',
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              alignItems: 'center',
              gap: 12
            }}
          >
            <span style={{ fontSize: 24 }}>📋</span>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>PRD 需求总数</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>{totalPrds} 个需求</div>
            </div>
          </div>

          <div
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              padding: '12px 14px',
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              alignItems: 'center',
              gap: 12
            }}
          >
            <span style={{ fontSize: 24 }}>🚀</span>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>进行中迭代</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent-blue)' }}>{inProgressCount} 个迭代</div>
            </div>
          </div>

          <div
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              padding: '12px 14px',
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              alignItems: 'center',
              gap: 12
            }}
          >
            <span style={{ fontSize: 24 }}>⚙️</span>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>累计分层任务</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>{totalTasks} 个 Task</div>
            </div>
          </div>

          <div
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              padding: '12px 14px',
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              alignItems: 'center',
              gap: 12
            }}
          >
            <span style={{ fontSize: 24 }}>⚡</span>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>待执行就绪任务</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent-green)' }}>
                {totalReadyTasks} Tasks Ready
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Filter & Search Toolbar */}
      <div
        style={{
          padding: '14px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12
        }}
      >
        {/* Status Filters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {[
            { id: 'ALL', label: `全部需求 (${plans.length})` },
            { id: 'IN_PROGRESS', label: `● 进行中 (${plans.filter((p) => p.status === 'IN_PROGRESS').length})` },
            { id: 'PLANNING', label: `📋 规划中 (${plans.filter((p) => p.status === 'PLANNING').length})` },
            { id: 'DONE', label: `✓ 已完成 (${plans.filter((p) => p.status === 'DONE').length})` }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              style={{
                fontSize: 12,
                padding: '5px 12px',
                borderRadius: 'var(--radius-md)',
                background: statusFilter === tab.id ? 'var(--accent-blue-dim)' : 'var(--bg-elevated)',
                color: statusFilter === tab.id ? 'var(--accent-blue)' : 'var(--text-secondary)',
                border: statusFilter === tab.id ? '1px solid var(--accent-blue)' : '1px solid var(--border)',
                fontWeight: statusFilter === tab.id ? 600 : 400,
                cursor: 'pointer'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Project Selector & Search */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <select
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              padding: '6px 10px',
              fontSize: 12,
              color: 'var(--text-primary)',
              outline: 'none'
            }}
          >
            <option value="ALL">📁 全部工程维度</option>
            {workspaces.length > 0 ? (
              workspaces.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.icon || '📁'} {w.name}
                </option>
              ))
            ) : (
              <>
                <option value="PetPal-iOS">PetPal-iOS</option>
                <option value="PetPal-Android">PetPal-Android</option>
                <option value="PetPal-Backend">PetPal-Backend</option>
                <option value="PetPal-Web">PetPal-Web</option>
              </>
            )}
          </select>

          <input
            type="text"
            placeholder="搜索 PRD 需求 / 编号 / 负责人..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: 240,
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              padding: '6px 10px',
              fontSize: 12,
              color: 'var(--text-primary)',
              outline: 'none'
            }}
          />
        </div>
      </div>

      {/* 3. PRD Iteration Cards Grid */}
      <div
        style={{
          padding: '0 24px 30px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(460px, 1fr))',
          gap: 16
        }}
      >
        {filteredPlans.length === 0 ? (
          <div
            style={{
              gridColumn: '1 / -1',
              padding: '60px 20px',
              textAlign: 'center',
              color: 'var(--text-secondary)'
            }}
          >
            <div style={{ fontSize: 36, marginBottom: 12 }}>🔍</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>未找到匹配的 PRD 需求</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>可调整筛选条件或点击上方「+ AI 导入新 PRD 需求」</div>
          </div>
        ) : (
          filteredPlans.map((plan) => {
            const statusBadge = getStatusBadge(plan.status)
            const tasks = plan.tasks || []
            const doneCount = tasks.filter((t) => t.status === 'DONE').length
            const readyCount = tasks.filter((t) => t.status === 'READY').length
            const blockedCount = tasks.filter((t) => t.status === 'BLOCKED').length
            const waitCount = tasks.filter(
              (t) => t.status === 'WAITING_API' || t.status === 'WAITING_DESIGN'
            ).length
            const pctDone = tasks.length > 0 ? Math.round((doneCount / tasks.length) * 100) : 0

            // Multi-Agent team distribution
            const agentCounts = {}
            tasks.forEach((t) => {
              const agentId = t.execution?.selected?.agent_id || t.execution?.recommended?.agent_id || 'chatgpt'
              agentCounts[agentId] = (agentCounts[agentId] || 0) + 1
            })

            return (
              <div
                key={plan.id}
                style={{
                  background: 'var(--bg-surface)',
                  border: plan.isDemo ? '1px solid rgba(139,92,246,0.4)' : '1px solid var(--border)',
                  borderRadius: 'var(--radius-xl)',
                  padding: '18px 20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 14,
                  boxShadow: plan.isDemo ? '0 0 16px rgba(139,92,246,0.1)' : 'var(--shadow-sm)',
                  transition: 'all 150ms ease'
                }}
              >
                {/* Card Header: PRD ID, Demo Tag, Status */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {plan.isDemo && (
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          padding: '2px 7px',
                          borderRadius: 4,
                          background: 'linear-gradient(135deg, rgba(139,92,246,0.25), rgba(79,158,248,0.25))',
                          color: '#c084fc',
                          border: '1px solid rgba(139,92,246,0.4)'
                        }}
                      >
                        ⭐ 示例 PRD
                      </span>
                    )}

                    <span
                      style={{
                        fontFamily: 'monospace',
                        fontSize: 12,
                        fontWeight: 700,
                        color: 'var(--accent-blue)',
                        background: 'rgba(79,158,248,0.12)',
                        padding: '2px 6px',
                        borderRadius: 4
                      }}
                    >
                      {plan.requirement?.id || plan.id}
                    </span>

                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: 'var(--text-secondary)'
                      }}
                    >
                      {plan.version || 'v1.0'}
                    </span>
                  </div>

                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      padding: '3px 8px',
                      borderRadius: 6,
                      background: statusBadge.bg,
                      color: statusBadge.color,
                      border: `1px solid ${statusBadge.border}`
                    }}
                  >
                    {statusBadge.label}
                  </span>
                </div>

                {/* Card Title & Description */}
                <div>
                  <div
                    onClick={() => onSelectPlan(plan.id)}
                    style={{
                      fontSize: 16,
                      fontWeight: 700,
                      color: 'var(--text-primary)',
                      cursor: 'pointer'
                    }}
                  >
                    {plan.title}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: 'var(--text-secondary)',
                      marginTop: 4,
                      lineHeight: 1.5,
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden'
                    }}
                  >
                    {plan.description}
                  </div>
                </div>

                {/* Projects & Team Subline */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  {(plan.projects || []).map((proj) => {
                    const pName = typeof proj === 'string' ? proj : proj.name || proj.id
                    return (
                      <span
                        key={pName}
                        style={{
                          fontSize: 11,
                          background: 'var(--bg-elevated)',
                          padding: '2px 7px',
                          borderRadius: 4,
                          color: 'var(--text-secondary)',
                          border: '1px solid var(--border)'
                        }}
                      >
                        📁 {pName}
                      </span>
                    )
                  })}
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 4 }}>
                    • PM: {plan.leadPm || 'Sarah'} · 更新: {plan.updatedAt || '刚刚'}
                  </span>
                </div>

                {/* Progress Bar & Stats */}
                <div
                  style={{
                    background: 'var(--bg-elevated)',
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 6 }}>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                      研发任务完成度 ({doneCount}/{tasks.length})
                    </span>
                    <span style={{ fontWeight: 700, color: 'var(--accent-green)' }}>{pctDone}%</span>
                  </div>

                  {/* Stacked Progress Bar */}
                  <div
                    style={{
                      height: 6,
                      width: '100%',
                      background: '#21262d',
                      borderRadius: 3,
                      overflow: 'hidden',
                      display: 'flex'
                    }}
                  >
                    <div style={{ width: `${pctDone}%`, background: '#3fb950' }} />
                    <div
                      style={{
                        width: `${tasks.length > 0 ? (readyCount / tasks.length) * 100 : 0}%`,
                        background: '#4f9ef8'
                      }}
                    />
                    <div
                      style={{
                        width: `${tasks.length > 0 ? (blockedCount / tasks.length) * 100 : 0}%`,
                        background: '#d29922'
                      }}
                    />
                    <div
                      style={{
                        width: `${tasks.length > 0 ? (waitCount / tasks.length) * 100 : 0}%`,
                        background: '#a371f7'
                      }}
                    />
                  </div>

                  <div style={{ display: 'flex', gap: 10, marginTop: 8, fontSize: 10, color: 'var(--text-secondary)' }}>
                    <span style={{ color: '#3fb950' }}>✓ {doneCount} 完成</span>
                    <span style={{ color: '#4f9ef8' }}>⚡ {readyCount} 就绪</span>
                    {blockedCount > 0 && <span style={{ color: '#d29922' }}>⛔ {blockedCount} 阻塞</span>}
                    {waitCount > 0 && <span style={{ color: '#a371f7' }}>⏳ {waitCount} 等待资产</span>}
                  </div>
                </div>

                {/* AI Agents Allocation Pill */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>🤖 参与 Agent:</span>
                  {Object.entries(agentCounts).map(([agentId, count]) => (
                    <span
                      key={agentId}
                      style={{
                        fontSize: 10,
                        background: 'var(--bg-elevated)',
                        padding: '2px 6px',
                        borderRadius: 4,
                        color: 'var(--text-primary)',
                        border: '1px solid var(--border)'
                      }}
                    >
                      {agentId === 'antigravity'
                        ? '✨ Antigravity'
                        : agentId === 'chatgpt'
                          ? '🤖 ChatGPT'
                          : agentId === 'claude-code'
                            ? '⚡ Claude'
                            : agentId === 'trae'
                              ? '🚀 TRAE'
                              : '🛠️ ' + agentId}{' '}
                      ({count})
                    </span>
                  ))}
                </div>

                {/* Action Bar Footer */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingTop: 8,
                    borderTop: '1px solid var(--border)'
                  }}
                >
                  <button
                    onClick={() => setSelectedPrdPreview(plan)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--accent-blue)',
                      fontSize: 12,
                      cursor: 'pointer',
                      padding: 0
                    }}
                  >
                    📄 查看 PRD 契约
                  </button>

                  <div style={{ display: 'flex', gap: 8 }}>
                    {readyCount > 0 && (
                      <button
                        onClick={() => onRunReadyTasksForPlan && onRunReadyTasksForPlan(plan.id)}
                        style={{
                          background: 'rgba(63,185,80,0.12)',
                          border: '1px solid rgba(63,185,80,0.3)',
                          color: 'var(--accent-green)',
                          borderRadius: 'var(--radius-md)',
                          padding: '6px 12px',
                          fontSize: 11,
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        ⚡ 运行就绪 ({readyCount})
                      </button>
                    )}

                    <button
                      onClick={() => onSelectPlan(plan.id)}
                      style={{
                        background: 'linear-gradient(135deg, #4f9ef8, #8b5cf6)',
                        border: 'none',
                        color: '#fff',
                        borderRadius: 'var(--radius-md)',
                        padding: '6px 14px',
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        boxShadow: '0 0 12px rgba(79,158,248,0.25)'
                      }}
                    >
                      <span>🧭</span> 进入任务编排
                    </button>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* PRD Preview Modal */}
      {selectedPrdPreview && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.7)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: 20
          }}
        >
          <div
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-xl)',
              width: '100%',
              maxWidth: 640,
              maxHeight: '80vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: 'var(--shadow-xl)',
              overflow: 'hidden'
            }}
          >
            <div
              style={{
                padding: '14px 18px',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'var(--bg-elevated)'
              }}
            >
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                {selectedPrdPreview.requirement?.title || selectedPrdPreview.title}
              </div>
              <button
                onClick={() => setSelectedPrdPreview(null)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>
                版本: {selectedPrdPreview.version} · 责任人: {selectedPrdPreview.leadPm}
              </div>
              <div
                style={{
                  background: 'var(--bg-elevated)',
                  padding: 12,
                  borderRadius: 6,
                  fontSize: 12,
                  lineHeight: 1.6,
                  color: 'var(--text-primary)',
                  fontFamily: 'monospace',
                  whiteSpace: 'pre-wrap'
                }}
              >
                {selectedPrdPreview.requirement?.prdSnippet || selectedPrdPreview.description}
              </div>
            </div>

            <div style={{ padding: '12px 18px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  const id = selectedPrdPreview.id
                  setSelectedPrdPreview(null)
                  onSelectPlan(id)
                }}
                style={{
                  background: 'var(--accent-blue)',
                  border: 'none',
                  color: '#fff',
                  padding: '6px 16px',
                  borderRadius: 'var(--radius-md)',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                进入此 PRD 任务编排
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Decompose New PRD Modal */}
      <PrdDecomposeModal
        isOpen={isDecomposeOpen}
        onClose={() => setIsDecomposeOpen(false)}
        onImportPlan={handleImportNewPlan}
        workspaces={workspaces}
        onAddWorkspace={onAddWorkspace}
      />
    </div>
  )
}

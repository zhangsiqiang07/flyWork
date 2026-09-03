import { useState, useMemo } from 'react'

export default function TaskGraphView({
  tasks = [],
  selectedTaskId,
  onSelectTask,
  onRunTask,
  selectedTaskIds = new Set(),
  onToggleTaskSelection,
  onSelectAllTasks,
  viewMode = 'list', // 'list' | 'dag'
  onChangeViewMode
}) {
  const [activeTab, setActiveTab] = useState('all') // all | ready | waiting | blocked | done

  // Filter tasks based on activeTab
  const filteredTasks = useMemo(() => {
    if (activeTab === 'ready') return tasks.filter((t) => t.status === 'READY')
    if (activeTab === 'waiting')
      return tasks.filter((t) => t.status === 'WAITING_API' || t.status === 'WAITING_DESIGN')
    if (activeTab === 'blocked') return tasks.filter((t) => t.status === 'BLOCKED')
    if (activeTab === 'done') return tasks.filter((t) => t.status === 'DONE')
    return tasks
  }, [tasks, activeTab])

  // Topological Layout calculation for DAG View
  const dagLayout = useMemo(() => {
    if (viewMode !== 'dag' || tasks.length === 0) return { levels: [], nodes: [], edges: [] }

    const taskMap = new Map(tasks.map((t) => [t.id, t]))
    const inDegree = new Map()
    const adj = new Map()

    tasks.forEach((t) => {
      inDegree.set(t.id, (t.dependencies || []).length)
      adj.set(t.id, [])
    })

    tasks.forEach((t) => {
      ;(t.dependencies || []).forEach((depId) => {
        if (adj.has(depId)) {
          adj.get(depId).push(t.id)
        }
      })
    })

    const levels = new Map()
    const queue = []

    tasks.forEach((t) => {
      if ((t.dependencies || []).length === 0) {
        queue.push({ id: t.id, level: 0 })
        levels.set(t.id, 0)
      }
    })

    while (queue.length > 0) {
      const { id, level } = queue.shift()
      const neighbors = adj.get(id) || []

      for (const nextId of neighbors) {
        const nextLevel = Math.max(levels.get(nextId) || 0, level + 1)
        levels.set(nextId, nextLevel)
        queue.push({ id: nextId, level: nextLevel })
      }
    }

    // Organize by column
    const maxLevel = Math.max(...Array.from(levels.values()), 0)
    const levelColumns = Array.from({ length: maxLevel + 1 }, () => [])

    tasks.forEach((t) => {
      const lvl = levels.get(t.id) || 0
      levelColumns[lvl].push(t)
    })

    // Node positioning
    const nodeCoords = new Map()
    const colWidth = 240
    const rowHeight = 110
    const startX = 30
    const startY = 40

    levelColumns.forEach((colTasks, colIdx) => {
      colTasks.forEach((t, rowIdx) => {
        const x = startX + colIdx * colWidth
        const y = startY + rowIdx * rowHeight
        nodeCoords.set(t.id, { x, y, task: t })
      })
    })

    // Calculate edge curves
    const edges = []
    tasks.forEach((t) => {
      const targetCoord = nodeCoords.get(t.id)
      if (!targetCoord) return

      ;(t.dependencies || []).forEach((depId) => {
        const sourceCoord = nodeCoords.get(depId)
        if (sourceCoord) {
          edges.push({
            id: `${depId}->${t.id}`,
            source: sourceCoord,
            target: targetCoord,
            isDone: taskMap.get(depId)?.status === 'DONE'
          })
        }
      })
    })

    const totalWidth = Math.max((maxLevel + 1) * colWidth + 80, 800)
    const maxRows = Math.max(...levelColumns.map((c) => c.length), 1)
    const totalHeight = Math.max(maxRows * rowHeight + 100, 500)

    return {
      nodes: Array.from(nodeCoords.values()),
      edges,
      width: totalWidth,
      height: totalHeight
    }
  }, [tasks, viewMode])

  const getStatusBadge = (status) => {
    switch (status) {
      case 'DONE':
        return {
          label: '✓ DONE',
          bg: 'rgba(63,185,80,0.15)',
          color: '#3fb950',
          border: 'rgba(63,185,80,0.4)'
        }
      case 'RUNNING':
        return {
          label: '● RUNNING',
          bg: 'rgba(79,158,248,0.2)',
          color: '#4f9ef8',
          border: 'rgba(79,158,248,0.5)'
        }
      case 'READY':
        return {
          label: '⚡ READY',
          bg: 'rgba(79,158,248,0.15)',
          color: '#4f9ef8',
          border: 'rgba(79,158,248,0.4)'
        }
      case 'BLOCKED':
        return {
          label: '⛔ BLOCKED',
          bg: 'rgba(210,153,34,0.15)',
          color: '#d29922',
          border: 'rgba(210,153,34,0.4)'
        }
      case 'WAITING_API':
        return {
          label: '⏳ WAIT API',
          bg: 'rgba(163,113,247,0.15)',
          color: '#a371f7',
          border: 'rgba(163,113,247,0.4)'
        }
      case 'WAITING_DESIGN':
        return {
          label: '🎨 WAIT DESIGN',
          bg: 'rgba(224,92,92,0.15)',
          color: '#f87171',
          border: 'rgba(224,92,92,0.4)'
        }
      default:
        return {
          label: status,
          bg: 'var(--bg-elevated)',
          color: 'var(--text-secondary)',
          border: 'var(--border)'
        }
    }
  }

  const getLayerColor = (layer) => {
    switch (layer?.toLowerCase()) {
      case 'domain':
        return '#10a37f'
      case 'data':
        return '#8b5cf6'
      case 'state':
        return '#3b82f6'
      case 'ui':
        return '#06b6d4'
      case 'integration':
        return '#ec4899'
      case 'test':
        return '#d97706'
      default:
        return '#8b949e'
    }
  }

  const getAgentAvatar = (agentId) => {
    switch (agentId) {
      case 'chatgpt':
        return '🤖'
      case 'antigravity':
        return '✨'
      case 'claude-code':
        return '⚡'
      case 'trae':
        return '🚀'
      case 'workbuddy':
        return '🛠️'
      default:
        return '⚙️'
    }
  }

  return (
    <div
      style={{
        flex: 1,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg-base)',
        overflow: 'hidden'
      }}
    >
      {/* Top Controls Header */}
      <div
        style={{
          padding: '8px 12px',
          background: 'var(--bg-surface)',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 8
        }}
      >
        {/* Left: View Mode Toggle & Filter Tabs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {/* View Mode Toggle Button Group */}
          <div
            style={{
              display: 'flex',
              background: 'var(--bg-elevated)',
              padding: 2,
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border)'
            }}
          >
            <button
              onClick={() => onChangeViewMode('list')}
              style={{
                background: viewMode === 'list' ? 'var(--accent-blue-dim)' : 'transparent',
                color: viewMode === 'list' ? 'var(--accent-blue)' : 'var(--text-secondary)',
                border: 'none',
                padding: '3px 8px',
                borderRadius: 4,
                fontSize: 11,
                fontWeight: viewMode === 'list' ? 600 : 400,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4
              }}
            >
              <span>📋</span> 列表
            </button>
            <button
              onClick={() => onChangeViewMode('dag')}
              style={{
                background: viewMode === 'dag' ? 'var(--accent-blue-dim)' : 'transparent',
                color: viewMode === 'dag' ? 'var(--accent-blue)' : 'var(--text-secondary)',
                border: 'none',
                padding: '3px 8px',
                borderRadius: 4,
                fontSize: 11,
                fontWeight: viewMode === 'dag' ? 600 : 400,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4
              }}
            >
              <span>🕸️</span> DAG 拓扑
            </button>
          </div>

          {/* Filter Tabs */}
          <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
            {[
              { id: 'all', label: `全部 ${tasks.length}` },
              { id: 'ready', label: `就绪 ${tasks.filter((t) => t.status === 'READY').length}` },
              {
                id: 'waiting',
                label: `待资产 ${tasks.filter((t) => t.status === 'WAITING_API' || t.status === 'WAITING_DESIGN').length}`
              },
              {
                id: 'blocked',
                label: `阻塞 ${tasks.filter((t) => t.status === 'BLOCKED').length}`
              },
              { id: 'done', label: `完成 ${tasks.filter((t) => t.status === 'DONE').length}` }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  background: activeTab === tab.id ? 'var(--bg-elevated)' : 'transparent',
                  color: activeTab === tab.id ? 'var(--text-primary)' : 'var(--text-secondary)',
                  border:
                    activeTab === tab.id ? '1px solid var(--border)' : '1px solid transparent',
                  padding: '3px 6px',
                  borderRadius: 4,
                  fontSize: 11,
                  cursor: 'pointer',
                  fontWeight: activeTab === tab.id ? 600 : 400
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Right: Select All */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              fontSize: 11,
              color: 'var(--text-secondary)',
              cursor: 'pointer'
            }}
          >
            <input
              type="checkbox"
              checked={tasks.length > 0 && selectedTaskIds.size === tasks.length}
              onChange={onSelectAllTasks}
              style={{ cursor: 'pointer' }}
            />
            <span>全选 ({selectedTaskIds.size})</span>
          </label>
        </div>
      </div>

      {/* Main Content Area */}
      <div style={{ flex: 1, overflow: 'auto', position: 'relative' }}>
        {viewMode === 'list' ? (
          /* ================================================================
             List / Tree Table View
             ================================================================ */
          <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filteredTasks.length === 0 ? (
              <div
                style={{
                  padding: 40,
                  textAlign: 'center',
                  color: 'var(--text-secondary)',
                  fontSize: 13
                }}
              >
                无匹配的任务节点
              </div>
            ) : (
              filteredTasks.map((task) => {
                const isSelected = selectedTaskId === task.id
                const isChecked = selectedTaskIds.has(task.id)
                const badge = getStatusBadge(task.status)
                const layerColor = getLayerColor(task.layer)
                const agentId =
                  task.execution?.selected?.agent_id ||
                  task.execution?.recommended?.agent_id ||
                  'chatgpt'
                const matchScore = task.execution?.recommended?.score || 90

                return (
                  <div
                    key={task.id}
                    onClick={() => onSelectTask(task.id)}
                    style={{
                      background: isSelected ? 'var(--bg-elevated)' : 'var(--bg-surface)',
                      border: isSelected
                        ? '1px solid var(--accent-blue)'
                        : '1px solid var(--border)',
                      borderRadius: 'var(--radius-lg)',
                      padding: '10px 12px',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 7,
                      transition: 'all 120ms ease',
                      boxShadow: isSelected ? '0 0 10px rgba(79,158,248,0.15)' : 'none'
                    }}
                  >
                    {/* Top Row: Checkbox + ID + Layer Badge (Left) | Status Badge + Run Button (Right) */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 8
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onClick={(e) => e.stopPropagation()}
                          onChange={() => onToggleTaskSelection(task.id)}
                          style={{ cursor: 'pointer', flexShrink: 0 }}
                        />
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            color: 'var(--accent-blue)',
                            fontFamily: 'monospace',
                            flexShrink: 0
                          }}
                        >
                          {task.id}
                        </span>
                        <span
                          style={{
                            color: layerColor,
                            fontWeight: 600,
                            textTransform: 'uppercase',
                            fontSize: 10,
                            background: 'rgba(255,255,255,0.06)',
                            padding: '1px 5px',
                            borderRadius: 3,
                            flexShrink: 0
                          }}
                        >
                          {task.layer}
                        </span>
                        {(task.sources?.bug ||
                          task.type === 'bugfix' ||
                          task.type === 'bug-diagnosis') && (
                          <span
                            style={{
                              color: 'var(--accent-red)',
                              fontWeight: 600,
                              fontSize: 10,
                              background: 'rgba(224,92,92,0.12)',
                              border: '1px solid rgba(224,92,92,0.3)',
                              padding: '1px 5px',
                              borderRadius: 3,
                              flexShrink: 0,
                              display: 'flex',
                              alignItems: 'center',
                              gap: 2
                            }}
                          >
                            <span>🐛</span>
                            <span>
                              {task.sources?.bug?.serialNumber
                                ? `${task.sources.bug.serialNumber}`
                                : '云效Bug'}
                            </span>
                          </span>
                        )}
                      </div>

                      {/* Right: Status badge & Quick Run */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 600,
                            padding: '2px 6px',
                            borderRadius: 4,
                            background: badge.bg,
                            color: badge.color,
                            border: `1px solid ${badge.border}`
                          }}
                        >
                          {badge.label}
                        </span>
                        {task.status === 'READY' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              onRunTask(task)
                            }}
                            style={{
                              background: 'var(--accent-blue-dim)',
                              border: '1px solid var(--accent-blue)',
                              color: 'var(--accent-blue)',
                              borderRadius: 4,
                              padding: '2px 7px',
                              fontSize: 10,
                              fontWeight: 600,
                              cursor: 'pointer'
                            }}
                          >
                            ▶ 执行
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Middle Row: Task Title */}
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: 'var(--text-primary)',
                        lineHeight: 1.4,
                        wordBreak: 'break-word'
                      }}
                    >
                      {task.title}
                    </div>

                    {/* Bottom Row: Project & Dependencies (Left) | Assigned Agent Pill (Right) */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: 6,
                        fontSize: 11,
                        color: 'var(--text-secondary)'
                      }}
                    >
                      <div
                        style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}
                      >
                        <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>
                          {task.project}
                        </span>
                        {task.dependencies && task.dependencies.length > 0 && (
                          <>
                            <span style={{ fontSize: 10 }}>•</span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                              <span style={{ fontSize: 10 }}>🔗 依赖:</span>
                              {task.dependencies.map((d) => (
                                <span
                                  key={d}
                                  style={{
                                    fontFamily: 'monospace',
                                    fontSize: 9,
                                    background: 'var(--bg-elevated)',
                                    padding: '1px 4px',
                                    borderRadius: 3,
                                    border: '1px solid var(--border)'
                                  }}
                                >
                                  {d}
                                </span>
                              ))}
                            </span>
                          </>
                        )}
                      </div>

                      {/* Assigned Agent Badge */}
                      <div
                        style={{
                          background: 'var(--bg-elevated)',
                          border: '1px solid var(--border)',
                          borderRadius: 4,
                          padding: '2px 6px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          fontSize: 10
                        }}
                      >
                        <span>{getAgentAvatar(agentId)}</span>
                        <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                          {agentId}
                        </span>
                        <span
                          style={{
                            color: 'var(--accent-green)',
                            fontWeight: 600,
                            background: 'rgba(63,185,80,0.1)',
                            padding: '0 3px',
                            borderRadius: 2,
                            fontSize: 9
                          }}
                        >
                          {matchScore}%
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        ) : (
          /* ================================================================
             DAG Dependency Graph View (SVG Canvas)
             ================================================================ */
          <div
            style={{
              width: '100%',
              height: '100%',
              overflow: 'auto',
              background: '#0a0d12',
              position: 'relative'
            }}
          >
            <svg
              width={dagLayout.width}
              height={dagLayout.height}
              style={{ display: 'block', minWidth: '100%', minHeight: '100%' }}
            >
              <defs>
                {/* Arrow markers for edges */}
                <marker
                  id="arrow-done"
                  viewBox="0 0 10 10"
                  refX="8"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="#3fb950" />
                </marker>
                <marker
                  id="arrow-pending"
                  viewBox="0 0 10 10"
                  refX="8"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="#484f58" />
                </marker>
              </defs>

              {/* Render Connecting Edges (Bezier Curves) */}
              {dagLayout.edges.map((edge) => {
                const sx = edge.source.x + 200
                const sy = edge.source.y + 40
                const tx = edge.target.x
                const ty = edge.target.y + 40
                const dx = (tx - sx) / 2
                const d = `M ${sx} ${sy} C ${sx + dx} ${sy}, ${tx - dx} ${ty}, ${tx} ${ty}`

                return (
                  <path
                    key={edge.id}
                    d={d}
                    fill="none"
                    stroke={edge.isDone ? '#3fb950' : '#30363d'}
                    strokeWidth={edge.isDone ? 2 : 1.5}
                    strokeDasharray={edge.isDone ? 'none' : '4,4'}
                    markerEnd={edge.isDone ? 'url(#arrow-done)' : 'url(#arrow-pending)'}
                  />
                )
              })}

              {/* Render DAG Nodes */}
              {dagLayout.nodes.map(({ x, y, task }) => {
                const isSelected = selectedTaskId === task.id
                const badge = getStatusBadge(task.status)
                const layerColor = getLayerColor(task.layer)
                const agentId =
                  task.execution?.selected?.agent_id ||
                  task.execution?.recommended?.agent_id ||
                  'chatgpt'

                return (
                  <g
                    key={task.id}
                    transform={`translate(${x}, ${y})`}
                    onClick={() => onSelectTask(task.id)}
                    style={{ cursor: 'pointer' }}
                  >
                    {/* Node Container Box */}
                    <rect
                      width="200"
                      height="80"
                      rx="8"
                      fill={isSelected ? '#1c2333' : '#161b22'}
                      stroke={isSelected ? '#4f9ef8' : badge.border}
                      strokeWidth={isSelected ? 2 : 1}
                      filter={isSelected ? 'drop-shadow(0px 0px 8px rgba(79,158,248,0.4))' : 'none'}
                    />

                    {/* Left Accent Color Stripe by Layer */}
                    <rect width="5" height="80" rx="3" fill={layerColor} />

                    {/* Task ID & Status Badge */}
                    <text
                      x="14"
                      y="20"
                      fill="#4f9ef8"
                      fontSize="11"
                      fontWeight="700"
                      fontFamily="monospace"
                    >
                      {task.id}
                    </text>

                    <rect x="110" y="8" width="80" height="18" rx="4" fill={badge.bg} />
                    <text
                      x="150"
                      y="21"
                      fill={badge.color}
                      fontSize="9"
                      fontWeight="700"
                      textAnchor="middle"
                    >
                      {badge.label}
                    </text>

                    {/* Task Title */}
                    <text x="14" y="42" fill="#e6edf3" fontSize="11" fontWeight="600" width="175">
                      {task.title.length > 22 ? task.title.slice(0, 20) + '...' : task.title}
                    </text>

                    {/* Agent & Layer footer */}
                    <text x="14" y="65" fill="#8b949e" fontSize="10">
                      {getAgentAvatar(agentId)} {agentId} · {task.layer}
                    </text>
                  </g>
                )
              })}
            </svg>
          </div>
        )}
      </div>
    </div>
  )
}

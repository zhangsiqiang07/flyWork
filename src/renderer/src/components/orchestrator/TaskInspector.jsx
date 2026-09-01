import { useState } from 'react'

export default function TaskInspector({
  task,
  allTasks = [],
  onUpdateTask,
  onOpenContextModal,
  onRunTask,
  agentProfiles = []
}) {
  const [copiedPrompt, setCopiedPrompt] = useState(false)
  const [activeTab, setActiveTab] = useState('details') // details | execution | context

  if (!task) {
    return (
      <div
        style={{
          width: 300,
          minWidth: 260,
          maxWidth: 350,
          height: '100%',
          background: 'var(--bg-surface)',
          borderLeft: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 20,
          flexShrink: 0,
          color: 'var(--text-secondary)',
          textAlign: 'center'
        }}
      >
        <span style={{ fontSize: 32, marginBottom: 12 }}>🧭</span>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>未选择任务</div>
        <div style={{ fontSize: 12, marginTop: 4 }}>点击左侧或中间列表中的 Task 节点查看详情与调度</div>
      </div>
    )
  }

  const taskMap = new Map(allTasks.map((t) => [t.id, t]))
  const upstreamTasks = (task.dependencies || []).map((id) => taskMap.get(id)).filter(Boolean)
  const downstreamTasks = allTasks.filter((t) => (t.dependencies || []).includes(task.id))

  const currentAgent = task.execution?.selected?.agent_id || task.execution?.recommended?.agent_id || 'antigravity'
  const recommendedScore = task.execution?.recommended?.score || 94
  const recommendedReason = task.execution?.recommended?.reason || '匹配当前任务类型与工程技术栈规范'

  const handleAgentChange = (newAgent) => {
    onUpdateTask(task.id, {
      execution: {
        ...task.execution,
        selected: {
          agent_id: newAgent
        }
      }
    })
  }

  const handleCopyPrompt = () => {
    const promptText = `【Task ${task.id}: ${task.title}】
项目: ${task.project}
架构层: ${task.layer} | 任务类型: ${task.type}
交付文件: ${(task.files?.expected || []).join(', ')}

验收标准:
${(task.acceptance_criteria || []).map((c, i) => `${i + 1}. ${c}`).join('\n')}

请遵循项目代码规范完成该模块的实现与单元测试。`

    navigator.clipboard.writeText(promptText)
    setCopiedPrompt(true)
    setTimeout(() => setCopiedPrompt(false), 2000)
  }

  return (
    <div
      style={{
        width: 300,
        minWidth: 260,
        maxWidth: 350,
        height: '100%',
        background: 'var(--bg-surface)',
        borderLeft: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        overflow: 'hidden'
      }}
    >
      {/* Inspector Header */}
      <div
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--bg-elevated)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span
            style={{
              fontSize: 12,
              fontFamily: 'monospace',
              fontWeight: 700,
              color: 'var(--accent-blue)',
              background: 'rgba(79,158,248,0.12)',
              padding: '2px 6px',
              borderRadius: 4,
              border: '1px solid rgba(79,158,248,0.3)'
            }}
          >
            {task.id}
          </span>

          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              padding: '2px 8px',
              borderRadius: 4,
              background:
                task.status === 'DONE'
                  ? 'rgba(63,185,80,0.15)'
                  : task.status === 'READY'
                    ? 'rgba(79,158,248,0.15)'
                    : task.status === 'BLOCKED'
                      ? 'rgba(210,153,34,0.15)'
                      : 'rgba(163,113,247,0.15)',
              color:
                task.status === 'DONE'
                  ? '#3fb950'
                  : task.status === 'READY'
                    ? '#4f9ef8'
                    : task.status === 'BLOCKED'
                      ? '#d29922'
                      : '#a371f7'
            }}
          >
            {task.status}
          </span>
        </div>

        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginTop: 8 }}>
          {task.title}
        </div>

        {/* Metadata Badges */}
        <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
          <span
            style={{
              fontSize: 10,
              background: 'rgba(255,255,255,0.06)',
              padding: '2px 6px',
              borderRadius: 3,
              color: 'var(--text-secondary)'
            }}
          >
            📁 {task.project}
          </span>
          <span
            style={{
              fontSize: 10,
              background: 'rgba(255,255,255,0.06)',
              padding: '2px 6px',
              borderRadius: 3,
              color: 'var(--accent-blue)'
            }}
          >
            🏛️ {task.layer}
          </span>
          <span
            style={{
              fontSize: 10,
              background: 'rgba(255,255,255,0.06)',
              padding: '2px 6px',
              borderRadius: 3,
              color: 'var(--text-secondary)'
            }}
          >
            ⚙️ {task.type}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div
        style={{
          display: 'flex',
          borderBottom: '1px solid var(--border)',
          background: 'var(--bg-surface)'
        }}
      >
        {[
          { id: 'details', label: '任务与调度' },
          { id: 'context', label: '上下文切片' },
          { id: 'dependencies', label: `DAG (${upstreamTasks.length})` }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === tab.id ? '2px solid var(--accent-blue)' : '2px solid transparent',
              color: activeTab === tab.id ? 'var(--text-primary)' : 'var(--text-secondary)',
              padding: '8px 0',
              fontSize: 12,
              fontWeight: activeTab === tab.id ? 600 : 400,
              cursor: 'pointer'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px' }}>
        {activeTab === 'details' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* 1. Executor Routing Section */}
            <div
              style={{
                background: 'var(--bg-elevated)',
                padding: '12px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border)'
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: 'var(--text-secondary)',
                  textTransform: 'uppercase',
                  display: 'flex',
                  justifyContent: 'space-between'
                }}
              >
                <span>🤖 执行智能体路由 (Agent Routing)</span>
                <span style={{ color: 'var(--accent-green)', fontWeight: 600 }}>
                  匹配度: {recommendedScore}%
                </span>
              </div>

              {/* Recommended Reason Box */}
              <div
                style={{
                  marginTop: 6,
                  fontSize: 11,
                  color: 'var(--text-secondary)',
                  background: 'rgba(63,185,80,0.08)',
                  padding: '6px 8px',
                  borderRadius: 4,
                  border: '1px solid rgba(63,185,80,0.2)'
                }}
              >
                💡 <span style={{ color: 'var(--text-primary)' }}>推荐理由:</span> {recommendedReason}
              </div>

              {/* Agent Selector */}
              <div style={{ marginTop: 10 }}>
                <label style={{ fontSize: 10, color: 'var(--text-secondary)', display: 'block', marginBottom: 4, fontWeight: 600 }}>
                  指派执行智能体 (Target Agent):
                </label>
                <select
                  value={currentAgent}
                  onChange={(e) => handleAgentChange(e.target.value)}
                  style={{
                    width: '100%',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 4,
                    padding: '6px 8px',
                    fontSize: 12,
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                    outline: 'none',
                    cursor: 'pointer'
                  }}
                >
                  {agentProfiles.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.avatar} {a.name} ({a.role || '智能协同'})
                    </option>
                  ))}
                </select>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
                  ⚙️ 运行环境：底层由该智能体在当前开发环境中的默认配置模型驱动
                </div>
              </div>
            </div>

            {/* 2. Acceptance Criteria */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>
                ✅ 交付与验收标准 (Acceptance Criteria):
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {(task.acceptance_criteria || []).map((c, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 6,
                      fontSize: 12,
                      color: 'var(--text-primary)',
                      background: 'var(--bg-elevated)',
                      padding: '6px 8px',
                      borderRadius: 4
                    }}
                  >
                    <span style={{ color: 'var(--accent-blue)', fontWeight: 600 }}>{idx + 1}.</span>
                    <span>{c}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 3. Expected Files */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>
                📄 目标变更文件 (Expected Files):
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {(task.files?.expected || []).map((file, idx) => (
                  <div
                    key={idx}
                    style={{
                      fontSize: 11,
                      fontFamily: 'monospace',
                      color: 'var(--accent-blue)',
                      background: 'rgba(79,158,248,0.08)',
                      padding: '4px 8px',
                      borderRadius: 4,
                      border: '1px solid rgba(79,158,248,0.15)'
                    }}
                  >
                    {file}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'context' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              Context Builder 为该任务生成的隔离上下文切片状态：
            </div>

            {/* Context Item Cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div
                style={{
                  background: 'var(--bg-elevated)',
                  padding: '8px 10px',
                  borderRadius: 6,
                  border: '1px solid var(--border)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <span style={{ fontSize: 12, color: 'var(--text-primary)' }}>📋 PRD 选段 (§3.2 需求契约)</span>
                <span style={{ fontSize: 11, color: 'var(--accent-green)', fontWeight: 600 }}>✓ 已就绪</span>
              </div>

              <div
                style={{
                  background: 'var(--bg-elevated)',
                  padding: '8px 10px',
                  borderRadius: 6,
                  border: '1px solid var(--border)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <span style={{ fontSize: 12, color: 'var(--text-primary)' }}>🔌 API 接口与 DTO 签名</span>
                <span
                  style={{
                    fontSize: 11,
                    color: task.sources?.api?.status === 'pending' ? '#a371f7' : 'var(--accent-green)',
                    fontWeight: 600
                  }}
                >
                  {task.sources?.api?.status === 'pending' ? '⏳ 待接口就绪' : '✓ 已就绪'}
                </span>
              </div>

              <div
                style={{
                  background: 'var(--bg-elevated)',
                  padding: '8px 10px',
                  borderRadius: 6,
                  border: '1px solid var(--border)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <span style={{ fontSize: 12, color: 'var(--text-primary)' }}>🎨 Figma UI 标注与 Token</span>
                <span
                  style={{
                    fontSize: 11,
                    color: task.sources?.design?.status === 'pending' ? '#f87171' : 'var(--accent-green)',
                    fontWeight: 600
                  }}
                >
                  {task.sources?.design?.status === 'pending' ? '⏳ 待设计稿就绪' : '✓ 已就绪'}
                </span>
              </div>

              <div
                style={{
                  background: 'var(--bg-elevated)',
                  padding: '8px 10px',
                  borderRadius: 6,
                  border: '1px solid var(--border)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <span style={{ fontSize: 12, color: 'var(--text-primary)' }}>📐 项目架构 Rules & Skills</span>
                <span style={{ fontSize: 11, color: 'var(--accent-green)', fontWeight: 600 }}>✓ 2 Rules / 2 Skills</span>
              </div>
            </div>

            <button
              onClick={() => onOpenContextModal(task)}
              style={{
                background: 'var(--accent-blue-dim)',
                border: '1px solid var(--accent-blue)',
                color: 'var(--accent-blue)',
                padding: '8px 12px',
                borderRadius: 'var(--radius-md)',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                marginTop: 6
              }}
            >
              📦 查看完整上下文切片 (Context Package)
            </button>
          </div>
        )}

        {activeTab === 'dependencies' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Predecessors */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>
                ⬅️ 前置依赖任务 (Predecessors):
              </div>
              {upstreamTasks.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>无前置依赖，可直接并行执行</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {upstreamTasks.map((u) => (
                    <div
                      key={u.id}
                      style={{
                        background: 'var(--bg-elevated)',
                        padding: '8px 10px',
                        borderRadius: 6,
                        border: '1px solid var(--border)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent-blue)', fontFamily: 'monospace' }}>
                          {u.id}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-primary)', marginTop: 2 }}>{u.title}</div>
                      </div>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 600,
                          color: u.status === 'DONE' ? '#3fb950' : '#d29922'
                        }}
                      >
                        {u.status === 'DONE' ? '✓ 已完成' : '⏳ 进行中'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Downstream */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>
                ➡️ 下游解锁任务 (Successors):
              </div>
              {downstreamTasks.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>无下游直接依赖任务</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {downstreamTasks.map((d) => (
                    <div
                      key={d.id}
                      style={{
                        background: 'var(--bg-elevated)',
                        padding: '8px 10px',
                        borderRadius: 6,
                        border: '1px solid var(--border)'
                      }}
                    >
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent-blue)', fontFamily: 'monospace' }}>
                        {d.id}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-primary)', marginTop: 2 }}>{d.title}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Action Footer */}
      <div
        style={{
          padding: '12px 16px',
          borderTop: '1px solid var(--border)',
          background: 'var(--bg-elevated)',
          display: 'flex',
          gap: 8
        }}
      >
        <button
          onClick={handleCopyPrompt}
          style={{
            flex: 1,
            background: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            color: 'var(--text-primary)',
            padding: '8px 12px',
            borderRadius: 'var(--radius-md)',
            fontSize: 12,
            fontWeight: 500,
            cursor: 'pointer'
          }}
        >
          {copiedPrompt ? '✓ 已复制 Prompt' : '📋 复制 Prompt'}
        </button>

        <button
          onClick={() => onRunTask(task)}
          style={{
            flex: 1.5,
            background:
              task.status === 'READY'
                ? 'linear-gradient(135deg, #238636, #2ea043)'
                : 'var(--accent-blue)',
            border: 'none',
            color: '#fff',
            padding: '8px 14px',
            borderRadius: 'var(--radius-md)',
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            boxShadow: '0 0 10px rgba(63,185,80,0.2)'
          }}
        >
          ▶ 执行当前任务
        </button>
      </div>
    </div>
  )
}

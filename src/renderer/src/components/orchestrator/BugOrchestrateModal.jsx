import { useState, useMemo } from 'react'

export default function BugOrchestrateModal({
  isOpen,
  bugs = [],
  plans = [],
  workspaces = [],
  onClose,
  onConfirm
}) {
  const [mode, setMode] = useState('bind') // 'bind' | 'standalone'
  const [selectedPlanId, setSelectedPlanId] = useState(() => {
    const active = plans.find((p) => p.status === 'IN_PROGRESS') || plans[0]
    return active ? active.id : ''
  })
  const [selectedWorkspace, setSelectedWorkspace] = useState(() => {
    if (workspaces.length > 0) return workspaces[0].name || workspaces[0].id
    return 'PetPal-iOS'
  })
  const [policy, setPolicy] = useState('parallel') // 'parallel' | 'gate'
  const [standaloneTitle, setStandaloneTitle] = useState(() => {
    if (!bugs.length) return '云效缺陷集中修复专项'
    const first = bugs[0]
    const serial = first.serialNumber || first.identifier || 'BUG'
    return bugs.length === 1
      ? `[Bug专项] ${serial}: ${first.subject || first.title || '缺陷修复'}`
      : `[Bug专项] ${serial} 等 ${bugs.length} 项云效缺陷集中修复与验证`
  })
  const [featureName, setFeatureName] = useState('BugFix')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const targetPlan = useMemo(
    () => plans.find((p) => p.id === selectedPlanId) || plans[0] || null,
    [plans, selectedPlanId]
  )

  if (!isOpen || !bugs.length) return null

  // Preview generated tasks
  const previewTasks = useMemo(() => {
    if (mode === 'bind') {
      return bugs.map((bug, idx) => {
        const serial = bug.serialNumber || bug.identifier || `BUG-${idx + 1}`
        return {
          id: `BUG-${String(serial).replace(/[^a-zA-Z0-9_-]/g, '')}`,
          title: `[修复] ${serial}: ${bug.subject || bug.title || '缺陷问题'}`,
          agent: 'Claude Code',
          agentAvatar: '⚡',
          agentRole: 'Bug Hunter',
          layer: 'domain',
          status: 'READY'
        }
      })
    }
    // Standalone 3-stage DAG
    const first = bugs[0]
    return [
      {
        id: 'BUG-01-DIAG',
        title: bugs.length === 1 ? `根因溯源与复现单测: ${first.subject || first.title}` : `多缺陷根因排查与复现自动化测试`,
        agent: 'Claude Code',
        agentAvatar: '⚡',
        agentRole: 'Bug Hunter',
        layer: 'test',
        status: 'READY'
      },
      {
        id: 'BUG-02-FIX',
        title: bugs.length === 1 ? `补丁修复与工程落地: ${first.subject || first.title}` : `核心代码补丁编写与容错兜底`,
        agent: 'Antigravity',
        agentAvatar: '✨',
        agentRole: 'Full-stack Implementer',
        layer: 'domain',
        status: 'BLOCKED (依赖步骤 1)'
      },
      {
        id: 'BUG-03-VERIFY',
        title: '集成回归与 Code Review 质量验收',
        agent: 'ChatGPT',
        agentAvatar: '🤖',
        agentRole: 'Architect / Reviewer',
        layer: 'review',
        status: 'BLOCKED (依赖步骤 2)'
      }
    ]
  }, [mode, bugs])

  const handleApply = async () => {
    try {
      setIsSubmitting(true)
      if (mode === 'bind') {
        if (!targetPlan) throw new Error('请选择要绑定的目标迭代需求')
        let updatedPlan = null
        if (window.flywork?.orchestratorBindBugsToPlan) {
          const res = await window.flywork.orchestratorBindBugsToPlan(targetPlan, bugs, {
            project: selectedWorkspace,
            feature: featureName,
            policy
          })
          if (res.success) updatedPlan = res.plan
        }
        // Fallback if no IPC
        if (!updatedPlan) {
          const existingTasks = Array.isArray(targetPlan.tasks) ? [...targetPlan.tasks] : []
          const newTasks = bugs.map((bug, idx) => {
            const serial = bug.serialNumber || bug.identifier || `BUG-${idx + 1}`
            return {
              id: `BUG-${String(serial).replace(/[^a-zA-Z0-9_-]/g, '')}-${Date.now().toString().slice(-3)}`,
              title: `[修复] ${serial}: ${bug.subject || bug.title || '缺陷问题'}`,
              project: selectedWorkspace,
              feature: featureName,
              page_or_domain: 'BugFix',
              layer: 'domain',
              type: 'bugfix',
              complexity: 'medium',
              risk: 'medium',
              status: 'READY',
              dependencies: [],
              sources: {
                bug: {
                  id: bug.identifier || bug.id || '',
                  serialNumber: serial,
                  title: bug.subject || bug.title || '',
                  status: typeof bug.status === 'object' ? (bug.status?.name || '待修复') : (bug.status || '待修复'),
                  description: bug.description || ''
                }
              },
              files: { expected: [`Sources/Fixes/${serial}.swift`] },
              acceptance_criteria: [
                `定位缺陷根因：${bug.subject || bug.title}`,
                '编写单元测试复现缺陷并验证修复',
                '确认无其他破坏性影响'
              ],
              execution: {
                mode: 'assisted',
                recommended: {
                  agent_id: 'claude-code',
                  score: 96,
                  reason: '强项为代码库深度检索、测试用例编写与精准 Bug 溯源'
                },
                selected: { agent_id: 'claude-code' }
              }
            }
          })
          updatedPlan = {
            ...targetPlan,
            tasks: [...existingTasks, ...newTasks],
            updatedAt: '刚刚'
          }
        }
        onConfirm({ mode: 'bind', targetPlanId: targetPlan.id, updatedPlan })
      } else {
        // Standalone Plan
        let newPlan = null
        if (window.flywork?.orchestratorCreateStandaloneBugPlan) {
          const res = await window.flywork.orchestratorCreateStandaloneBugPlan(bugs, {
            title: standaloneTitle,
            project: selectedWorkspace
          })
          if (res.success) newPlan = res.plan
        }
        if (!newPlan) {
          const planId = `PLAN-BUG-${Date.now().toString().slice(-6)}`
          const baseId = `BUG-${Date.now().toString().slice(-4)}`
          const task1Id = `${baseId}-1-DIAG`
          const task2Id = `${baseId}-2-FIX`
          const task3Id = `${baseId}-3-VERIFY`
          const first = bugs[0]
          newPlan = {
            id: planId,
            title: standaloneTitle,
            version: 'v1.0-fix',
            status: 'IN_PROGRESS',
            isDemo: false,
            leadPm: '云效缺陷协同',
            techLead: 'Multi-Agent Team',
            updatedAt: '刚刚',
            description: `来自工作台缺陷集中修复计划，包含 ${bugs.length} 个缺陷。`,
            requirement: {
              id: `REQ-BUG-${Date.now().toString().slice(-4)}`,
              title: standaloneTitle,
              version: 'v1.0',
              author: '云效系统',
              status: 'ACTIVE',
              prdSnippet: `## 云效缺陷详情\n${bugs.map((b) => `• [${b.serialNumber || b.identifier || 'BUG'}] ${b.subject || b.title}`).join('\n')}`
            },
            projects: [{ id: selectedWorkspace, name: selectedWorkspace }],
            tasks: [
              {
                id: task1Id,
                title: bugs.length === 1 ? `诊断与根因溯源: ${first.subject || first.title}` : `多缺陷根因排查与复现单测`,
                project: selectedWorkspace,
                feature: 'BugFix',
                layer: 'test',
                type: 'bug-diagnosis',
                status: 'READY',
                dependencies: [],
                sources: { bug: { id: first.identifier, serialNumber: first.serialNumber, title: first.subject } },
                files: { expected: ['Tests/BugReproductionTests.swift'] },
                acceptance_criteria: ['定位缺陷触发场景并输出根因分析'],
                execution: {
                  recommended: { agent_id: 'claude-code', score: 96, reason: '深度检索与 Bug 溯源' },
                  selected: { agent_id: 'claude-code' }
                }
              },
              {
                id: task2Id,
                title: bugs.length === 1 ? `补丁修复与工程落地: ${first.subject || first.title}` : `核心代码补丁编写与容错兜底`,
                project: selectedWorkspace,
                feature: 'BugFix',
                layer: 'domain',
                type: 'bugfix',
                status: 'BLOCKED',
                dependencies: [task1Id],
                sources: { bug: { id: first.identifier, serialNumber: first.serialNumber, title: first.subject } },
                files: { expected: ['Sources/Core/Fix.swift'] },
                acceptance_criteria: ['补丁消除异常分支，通过单元测试'],
                execution: {
                  recommended: { agent_id: 'antigravity', score: 95, reason: '跨文件补丁编写' },
                  selected: { agent_id: 'antigravity' }
                }
              },
              {
                id: task3Id,
                title: '集成回归与 Code Review 质量验收',
                project: selectedWorkspace,
                feature: 'BugFix',
                layer: 'review',
                type: 'review',
                status: 'BLOCKED',
                dependencies: [task2Id],
                sources: { bug: { id: first.identifier, serialNumber: first.serialNumber, title: first.subject } },
                files: { expected: ['ReviewReport.md'] },
                acceptance_criteria: ['全局测试套件 100% 通过'],
                execution: {
                  recommended: { agent_id: 'chatgpt', score: 95, reason: 'Code Review 与质量验收' },
                  selected: { agent_id: 'chatgpt' }
                }
              }
            ]
          }
        }
        onConfirm({ mode: 'standalone', newPlan })
      }
    } catch (err) {
      console.error('[BugOrchestrateModal] Apply failed:', err)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 620,
          maxHeight: '90vh',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: '0 20px 48px rgba(0, 0, 0, 0.4)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'scaleIn 150ms ease'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border)',
            background: 'var(--bg-elevated)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 22 }}>🤖</span>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
                云效 Bug 智能编排调度
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                已选择 {bugs.length} 个缺陷，转化为多智能体协同研发任务进入 DAG 调度
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: 18,
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              padding: '4px 8px'
            }}
          >
            ✕
          </button>
        </div>

        {/* Content Body */}
        <div style={{ padding: '18px 20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Selected Bugs Pill List */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>
              已勾选的云效缺陷 ({bugs.length})：
            </div>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                maxHeight: 130,
                overflowY: 'auto',
                background: 'var(--bg-elevated)',
                padding: '8px 10px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border)'
              }}
            >
              {bugs.map((b, idx) => {
                const serial = b.serialNumber || b.identifier || `#${idx + 1}`
                const title = b.subject || b.title || b.name || '未命名缺陷'
                return (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 8,
                      fontSize: 12,
                      padding: '4px 6px',
                      borderRadius: 4,
                      background: 'rgba(255, 255, 255, 0.03)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          padding: '1px 5px',
                          borderRadius: 3,
                          background: 'rgba(224, 92, 92, 0.15)',
                          color: 'var(--accent-red)',
                          border: '1px solid rgba(224, 92, 92, 0.3)',
                          fontFamily: 'monospace'
                        }}
                      >
                        {serial}
                      </span>
                      <span
                        style={{
                          color: 'var(--text-primary)',
                          fontWeight: 500,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {title}
                      </span>
                    </div>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>
                      {typeof b.assignedTo === 'object' ? (b.assignedTo?.name || '未指派') : (b.assignedTo || '未指派')}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Mode Selection Cards */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>
              编排模式选择 (Orchestration Mode)：
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {/* Mode A: Bind */}
              <div
                onClick={() => setMode('bind')}
                style={{
                  padding: 14,
                  borderRadius: 'var(--radius-md)',
                  border: mode === 'bind' ? '2px solid var(--accent-blue)' : '1px solid var(--border)',
                  background: mode === 'bind' ? 'rgba(79, 158, 248, 0.08)' : 'var(--bg-elevated)',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                    🔗 绑定到现有迭代需求
                  </span>
                  <input
                    type="radio"
                    name="orchestrateMode"
                    checked={mode === 'bind'}
                    onChange={() => setMode('bind')}
                    style={{ cursor: 'pointer' }}
                  />
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  将缺陷作为子任务注入到当前的 PRD 需求开发计划中，并入需求 DAG 拓扑执行
                </div>
              </div>

              {/* Mode B: Standalone */}
              <div
                onClick={() => setMode('standalone')}
                style={{
                  padding: 14,
                  borderRadius: 'var(--radius-md)',
                  border: mode === 'standalone' ? '2px solid var(--accent-purple)' : '1px solid var(--border)',
                  background: mode === 'standalone' ? 'rgba(163, 113, 247, 0.08)' : 'var(--bg-elevated)',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                    ⚡ 不绑定 (独立 Bug 修复计划)
                  </span>
                  <input
                    type="radio"
                    name="orchestrateMode"
                    checked={mode === 'standalone'}
                    onChange={() => setMode('standalone')}
                    style={{ cursor: 'pointer' }}
                  />
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  脱离特定需求，自动生成由“根因分析 → 补丁修复 → Review 验收”闭环组成的独立专项计划
                </div>
              </div>
            </div>
          </div>

          {/* Mode Configuration Form */}
          <div
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              padding: 14,
              display: 'flex',
              flexDirection: 'column',
              gap: 12
            }}
          >
            {mode === 'bind' ? (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 4, fontWeight: 600 }}>
                      目标 PRD 迭代计划 (Target Plan)：
                    </label>
                    <select
                      value={selectedPlanId}
                      onChange={(e) => setSelectedPlanId(e.target.value)}
                      style={{
                        width: '100%',
                        background: 'var(--bg-surface)',
                        border: '1px solid var(--border)',
                        color: 'var(--text-primary)',
                        padding: '6px 8px',
                        borderRadius: 4,
                        fontSize: 12
                      }}
                    >
                      {plans.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.title} ({p.status === 'IN_PROGRESS' ? '进行中' : '规划中'} · {p.tasks?.length || 0} 任务)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 4, fontWeight: 600 }}>
                      归属工程工作区 (Workspace)：
                    </label>
                    <select
                      value={selectedWorkspace}
                      onChange={(e) => setSelectedWorkspace(e.target.value)}
                      style={{
                        width: '100%',
                        background: 'var(--bg-surface)',
                        border: '1px solid var(--border)',
                        color: 'var(--text-primary)',
                        padding: '6px 8px',
                        borderRadius: 4,
                        fontSize: 12
                      }}
                    >
                      {workspaces.length > 0 ? (
                        workspaces.map((w) => (
                          <option key={w.id} value={w.name || w.id}>
                            {w.icon || '📁'} {w.name}
                          </option>
                        ))
                      ) : (
                        <>
                          <option value="PetPal-iOS">PetPal-iOS</option>
                          <option value="PetPal-Android">PetPal-Android</option>
                          <option value="PetPal-Backend">PetPal-Backend</option>
                        </>
                      )}
                    </select>
                  </div>
                </div>

                {/* Execution Policy */}
                <div>
                  <label style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 6, fontWeight: 600 }}>
                    DAG 拓扑执行策略 (Execution Policy)：
                  </label>
                  <div style={{ display: 'flex', gap: 16 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name="bugPolicy"
                        checked={policy === 'parallel'}
                        onChange={() => setPolicy('parallel')}
                      />
                      <span>并行业行 (Ready) - 作为独立修复分支立即就绪</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name="bugPolicy"
                        checked={policy === 'gate'}
                        onChange={() => setPolicy('gate')}
                      />
                      <span>提测门禁 (Gate) - 作为集成与测试任务的前置阻断</span>
                    </label>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 4, fontWeight: 600 }}>
                    独立 Bug 修复计划名称 (Plan Title)：
                  </label>
                  <input
                    type="text"
                    value={standaloneTitle}
                    onChange={(e) => setStandaloneTitle(e.target.value)}
                    style={{
                      width: '100%',
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border)',
                      color: 'var(--text-primary)',
                      padding: '6px 10px',
                      borderRadius: 4,
                      fontSize: 12,
                      fontWeight: 500
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 4, fontWeight: 600 }}>
                    关联工作区 (Target Project Workspace)：
                  </label>
                  <select
                    value={selectedWorkspace}
                    onChange={(e) => setSelectedWorkspace(e.target.value)}
                    style={{
                      width: '100%',
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border)',
                      color: 'var(--text-primary)',
                      padding: '6px 8px',
                      borderRadius: 4,
                      fontSize: 12
                    }}
                  >
                    {workspaces.length > 0 ? (
                      workspaces.map((w) => (
                        <option key={w.id} value={w.name || w.id}>
                          {w.icon || '📁'} {w.name}
                        </option>
                      ))
                    ) : (
                      <>
                        <option value="PetPal-iOS">PetPal-iOS</option>
                        <option value="PetPal-Android">PetPal-Android</option>
                        <option value="PetPal-Backend">PetPal-Backend</option>
                      </>
                    )}
                  </select>
                </div>
              </>
            )}
          </div>

          {/* Generated Task Preview */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>
              生成的任务节点与智能体分配预览 (Task Graph Preview)：
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {previewTasks.map((t, i) => (
                <div
                  key={t.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderRadius: 6,
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border)',
                    fontSize: 12
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                    <span style={{ color: 'var(--accent-blue)', fontWeight: 700, fontFamily: 'monospace' }}>
                      {i + 1}.
                    </span>
                    <span style={{ color: 'var(--text-primary)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {t.title}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    <span
                      style={{
                        fontSize: 11,
                        background: 'rgba(79, 158, 248, 0.1)',
                        color: 'var(--accent-blue)',
                        padding: '2px 8px',
                        borderRadius: 12,
                        border: '1px solid rgba(79, 158, 248, 0.25)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4
                      }}
                    >
                      <span>{t.agentAvatar}</span>
                      <span>{t.agent}</span>
                      <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>({t.agentRole})</span>
                    </span>
                    <span
                      style={{
                        fontSize: 10,
                        padding: '2px 6px',
                        borderRadius: 4,
                        background: t.status.includes('READY') ? 'rgba(63, 185, 80, 0.15)' : 'rgba(210, 153, 34, 0.15)',
                        color: t.status.includes('READY') ? '#3fb950' : '#d29922'
                      }}
                    >
                      {t.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '14px 20px',
            borderTop: '1px solid var(--border)',
            background: 'var(--bg-elevated)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            💡 调度完成后将自动切换到智能编排视图执行任务拓扑
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={onClose}
              disabled={isSubmitting}
              style={{
                background: 'transparent',
                border: '1px solid var(--border)',
                color: 'var(--text-secondary)',
                borderRadius: 'var(--radius-md)',
                padding: '6px 14px',
                fontSize: 12,
                cursor: 'pointer'
              }}
            >
              取消
            </button>
            <button
              onClick={handleApply}
              disabled={isSubmitting}
              style={{
                background: 'linear-gradient(135deg, #4f9ef8, #8b5cf6)',
                border: 'none',
                color: '#fff',
                borderRadius: 'var(--radius-md)',
                padding: '6px 18px',
                fontSize: 12,
                fontWeight: 600,
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                boxShadow: '0 2px 10px rgba(79, 158, 248, 0.3)'
              }}
            >
              <span>🚀</span>
              <span>{isSubmitting ? '正在编排...' : '确认并进入智能编排 (Apply)'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

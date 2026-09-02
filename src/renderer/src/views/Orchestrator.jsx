import { useState, useEffect, useCallback, useMemo } from 'react'
import { INITIAL_ORCHESTRATOR_PLAN } from '../data/orchestratorMockData'
import WorkloadHeader from '../components/orchestrator/WorkloadHeader'
import FeatureTreePanel from '../components/orchestrator/FeatureTreePanel'
import TaskGraphView from '../components/orchestrator/TaskGraphView'
import TaskInspector from '../components/orchestrator/TaskInspector'
import PrdDecomposeModal from '../components/orchestrator/PrdDecomposeModal'
import ContextPackageModal from '../components/orchestrator/ContextPackageModal'
import BatchAssignModal from '../components/orchestrator/BatchAssignModal'
import AssetReconcileModal from '../components/orchestrator/AssetReconcileModal'
import BugOrchestrateModal from '../components/orchestrator/BugOrchestrateModal'
import { MOCK_YUNXIAO_BUGS } from '../data/mockYunxiaoBugs'

const DEFAULT_AGENTS = [
  { id: 'chatgpt', name: 'ChatGPT', avatar: '🤖', color: '#10a37f', role: '架构推理与 Review' },
  { id: 'antigravity', name: 'Antigravity', avatar: '✨', color: '#8b5cf6', role: '跨文件编码与 UI' },
  { id: 'claude-code', name: 'Claude Code', avatar: '⚡', color: '#d97706', role: '代码分析与单测' },
  { id: 'trae', name: 'TRAE', avatar: '🚀', color: '#06b6d4', role: 'UI 骨架与原型' },
  { id: 'workbuddy', name: 'WorkBuddy', avatar: '🛠️', color: '#3b82f6', role: '脚手架与 API' }
]

export default function Orchestrator({
  activePlan = null,
  plans = [],
  onSelectPlan,
  onBackToHub,
  onUpdatePlan,
  workspaces = [],
  onAddWorkspace
}) {
  const [currentPlan, setCurrentPlan] = useState(activePlan || INITIAL_ORCHESTRATOR_PLAN)
  const [selectedTaskId, setSelectedTaskId] = useState(
    currentPlan?.tasks?.[0]?.id || 'IOS-REP-104'
  )
  const [selectedNode, setSelectedNode] = useState(null)
  const [selectedTaskIds, setSelectedTaskIds] = useState(new Set())
  const [viewMode, setViewMode] = useState('list') // 'list' | 'dag'
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [isRunningAll, setIsRunningAll] = useState(false)
  const [showLeftTree, setShowLeftTree] = useState(true)
  const [showRightInspector, setShowRightInspector] = useState(true)

  // Modals
  const [isDecomposeOpen, setIsDecomposeOpen] = useState(false)
  const [isContextModalOpen, setIsContextModalOpen] = useState(false)
  const [isBatchAssignOpen, setIsBatchAssignOpen] = useState(false)
  const [isReconcileOpen, setIsReconcileOpen] = useState(false)
  const [isBugModalOpen, setIsBugModalOpen] = useState(false)
  const [yunxiaoBugs, setYunxiaoBugs] = useState([])
  const [activeContextTask, setActiveContextTask] = useState(null)
  const [activeContextPackage, setActiveContextPackage] = useState(null)

  useEffect(() => {
    async function loadBugs() {
      try {
        if (window.flywork?.yunxiaoListWorkitems) {
          const res = await window.flywork.yunxiaoListWorkitems({ category: 'Bug', perPage: 20 })
          if (res.success && res.workitems?.length > 0) {
            setYunxiaoBugs(res.workitems)
            return
          }
        }
      } catch (e) {}
      setYunxiaoBugs(MOCK_YUNXIAO_BUGS)
    }
    loadBugs()
  }, [])

  // Agent Profiles
  const [agentProfiles, setAgentProfiles] = useState(DEFAULT_AGENTS)

  // Sync when activePlan prop changes
  useEffect(() => {
    if (activePlan) {
      setCurrentPlan(activePlan)
      if (activePlan.tasks?.length > 0) {
        setSelectedTaskId(activePlan.tasks[0].id)
      }
    }
  }, [activePlan])

  // Load Meta from IPC
  useEffect(() => {
    async function loadMeta() {
      try {
        if (window.flywork?.orchestratorGetMeta) {
          const metaRes = await window.flywork.orchestratorGetMeta()
          if (metaRes.success) {
            if (metaRes.agentProfiles) setAgentProfiles(metaRes.agentProfiles)
            if (metaRes.modelRegistry) setModelRegistry(metaRes.modelRegistry)
          }
        }
      } catch (err) {
        console.error('[Orchestrator] Meta load error:', err)
      }
    }
    loadMeta()
  }, [])

  // Resolve DAG and update tasks
  const updateTasksWithDag = useCallback(
    async (newTasks) => {
      let resolvedTasks = newTasks
      try {
        if (window.flywork?.orchestratorResolveDag) {
          const res = await window.flywork.orchestratorResolveDag(newTasks)
          if (res.success && res.tasks) {
            resolvedTasks = res.tasks
          }
        }
      } catch (err) {
        console.error('DAG resolution failed:', err)
      }

      setCurrentPlan((prev) => {
        const updated = { ...prev, tasks: resolvedTasks }
        if (onUpdatePlan) onUpdatePlan(updated)
        return updated
      })
      return resolvedTasks
    },
    [onUpdatePlan]
  )

  // Filter tasks based on search & left tree selection
  const visibleTasks = useMemo(() => {
    let result = currentPlan.tasks || []

    // Tree node filter
    if (selectedNode) {
      if (selectedNode.startsWith('layer-')) {
        const parts = selectedNode.split('-')
        const layerName = parts[parts.length - 1]
        result = result.filter((t) => (t.layer || '').toLowerCase() === layerName.toLowerCase())
      }
    }

    // Status filter
    if (statusFilter === 'READY') result = result.filter((t) => t.status === 'READY')
    else if (statusFilter === 'WAITING')
      result = result.filter((t) => t.status === 'WAITING_API' || t.status === 'WAITING_DESIGN')
    else if (statusFilter === 'BLOCKED') result = result.filter((t) => t.status === 'BLOCKED')
    else if (statusFilter === 'DONE') result = result.filter((t) => t.status === 'DONE')

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(
        (t) =>
          t.id.toLowerCase().includes(q) ||
          t.title.toLowerCase().includes(q) ||
          (t.project || '').toLowerCase().includes(q) ||
          (t.layer || '').toLowerCase().includes(q)
      )
    }

    return result
  }, [currentPlan.tasks, selectedNode, statusFilter, searchQuery])

  // Selected Task
  const selectedTask = useMemo(() => {
    return (
      (currentPlan.tasks || []).find((t) => t.id === selectedTaskId) ||
      (currentPlan.tasks || [])[0]
    )
  }, [currentPlan.tasks, selectedTaskId])

  // Update specific Task
  const handleUpdateTask = useCallback(
    (taskId, updates) => {
      setCurrentPlan((prev) => {
        const updatedTasks = prev.tasks.map((t) => (t.id === taskId ? { ...t, ...updates } : t))
        const updated = { ...prev, tasks: updatedTasks }
        if (onUpdatePlan) onUpdatePlan(updated)
        return updated
      })
    },
    [onUpdatePlan]
  )

  // Run single Task (Assisted mode simulation + DAG cascade unlock)
  const handleRunTask = useCallback(
    async (task) => {
      if (!task) return

      // Set to RUNNING
      setCurrentPlan((prev) => ({
        ...prev,
        tasks: prev.tasks.map((t) => (t.id === task.id ? { ...t, status: 'RUNNING' } : t))
      }))

      // Simulate Agent Execution (1.2s)
      setTimeout(async () => {
        const updatedWithDone = currentPlan.tasks.map((t) => {
          if (t.id === task.id) {
            return {
              ...t,
              status: 'DONE',
              files: {
                ...t.files,
                changed: t.files?.expected || [`src/${t.layer}/${t.title.replace(/\s+/g, '')}.swift`]
              }
            }
          }
          return t
        })

        // Re-resolve DAG (downstream blocked tasks become READY)
        await updateTasksWithDag(updatedWithDone)
      }, 1200)
    },
    [currentPlan.tasks, updateTasksWithDag]
  )

  // Run all currently READY tasks
  const handleRunReadyTasks = useCallback(async () => {
    const readyTasks = (currentPlan.tasks || []).filter((t) => t.status === 'READY')
    if (readyTasks.length === 0) return

    setIsRunningAll(true)

    // Set all ready to RUNNING
    setCurrentPlan((prev) => ({
      ...prev,
      tasks: prev.tasks.map((t) => (t.status === 'READY' ? { ...t, status: 'RUNNING' } : t))
    }))

    setTimeout(async () => {
      const allDoneTasks = currentPlan.tasks.map((t) => {
        if (t.status === 'READY' || t.status === 'RUNNING') {
          return { ...t, status: 'DONE' }
        }
        return t
      })

      await updateTasksWithDag(allDoneTasks)
      setIsRunningAll(false)
    }, 1800)
  }, [currentPlan.tasks, updateTasksWithDag])

  // Open Context Package Modal
  const handleOpenContextModal = useCallback(
    async (task) => {
      setActiveContextTask(task)
      if (window.flywork?.orchestratorBuildContext) {
        const res = await window.flywork.orchestratorBuildContext(
          task,
          currentPlan.requirement,
          currentPlan.tasks
        )
        if (res.success && res.contextPackage) {
          setActiveContextPackage(res.contextPackage)
          setIsContextModalOpen(true)
          return
        }
      }

      // Fallback
      setActiveContextPackage({
        taskId: task.id,
        taskTitle: task.title,
        project: task.project,
        layer: task.layer,
        prdSnippet: {
          sectionId: task.sources?.prd?.section_id || '3.2',
          title: task.sources?.prd?.title || '需求契约',
          content: `【${task.title}】相关需求：完成对应模块工程实现，满足状态机闭环与响应式流。`
        },
        rules: [`${task.project}/rules/architecture.md`, 'rules/standards.md'],
        skills: [`${task.project.toLowerCase()}-${task.layer}`, 'clean-code'],
        expectedFiles: task.files?.expected || []
      })
      setIsContextModalOpen(true)
    },
    [currentPlan.requirement, currentPlan.tasks]
  )

  // Batch Assign Handlers
  const handleApplyByLayer = useCallback(
    (layerConfig) => {
      setCurrentPlan((prev) => {
        const updated = prev.tasks.map((t) => {
          const layer = (t.layer || '').toLowerCase()
          const target = layerConfig[layer]
          if (target) {
            return {
              ...t,
              execution: {
                ...t.execution,
                selected: { agent_id: target.agent }
              }
            }
          }
          return t
        })
        const newPlan = { ...prev, tasks: updated }
        if (onUpdatePlan) onUpdatePlan(newPlan)
        return newPlan
      })
    },
    [onUpdatePlan]
  )

  const handleApplyBySelection = useCallback(
    (agent) => {
      setCurrentPlan((prev) => {
        const updated = prev.tasks.map((t) => {
          if (selectedTaskIds.has(t.id)) {
            return {
              ...t,
              execution: {
                ...t.execution,
                selected: { agent_id: agent }
              }
            }
          }
          return t
        })
        const newPlan = { ...prev, tasks: updated }
        if (onUpdatePlan) onUpdatePlan(newPlan)
        return newPlan
      })
    },
    [selectedTaskIds, onUpdatePlan]
  )

  // Asset Reconcile Apply
  const handleApplyReconciliation = useCallback(
    (updatedTasks) => {
      setCurrentPlan((prev) => {
        const newPlan = { ...prev, tasks: updatedTasks }
        if (onUpdatePlan) onUpdatePlan(newPlan)
        return newPlan
      })
    },
    [onUpdatePlan]
  )

  // Import New Decomposed Plan
  const handleImportPlan = useCallback(
    (newPlan) => {
      setCurrentPlan(newPlan)
      if (newPlan.tasks?.length > 0) {
        setSelectedTaskId(newPlan.tasks[0].id)
      }
      if (onUpdatePlan) onUpdatePlan(newPlan)
    },
    [onUpdatePlan]
  )

  // Bug Orchestration Apply
  const handleBugOrchestrateConfirm = useCallback(
    ({ mode, updatedPlan, newPlan }) => {
      setIsBugModalOpen(false)
      if (mode === 'bind' && updatedPlan) {
        setCurrentPlan(updatedPlan)
        if (onUpdatePlan) onUpdatePlan(updatedPlan)
      } else if (mode === 'standalone' && newPlan) {
        if (onUpdatePlan) onUpdatePlan(newPlan)
        if (onSelectPlan) onSelectPlan(newPlan.id)
      }
    },
    [onUpdatePlan, onSelectPlan]
  )

  // Multi-select helpers
  const handleToggleTaskSelection = (taskId) => {
    setSelectedTaskIds((prev) => {
      const next = new Set(prev)
      if (next.has(taskId)) next.delete(taskId)
      else next.add(taskId)
      return next
    })
  }

  const handleSelectAllTasks = () => {
    if (selectedTaskIds.size === currentPlan.tasks.length) {
      setSelectedTaskIds(new Set())
    } else {
      setSelectedTaskIds(new Set(currentPlan.tasks.map((t) => t.id)))
    }
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
        overflow: 'hidden'
      }}
    >
      {/* 0. Top Breadcrumb & PRD Switcher Navigation Bar */}
      <div
        style={{
          background: 'var(--bg-surface)',
          borderBottom: '1px solid var(--border)',
          padding: '8px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: 12
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {onBackToHub && (
            <button
              onClick={onBackToHub}
              style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-primary)',
                padding: '4px 10px',
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4
              }}
            >
              <span>←</span> 返回需求列表 (迭代中心)
            </button>
          )}

          <span style={{ color: 'var(--text-muted)' }}>/</span>

          {currentPlan.isDemo && (
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                padding: '1px 6px',
                borderRadius: 4,
                background: 'linear-gradient(135deg, rgba(139,92,246,0.25), rgba(79,158,248,0.25))',
                color: '#c084fc',
                border: '1px solid rgba(139,92,246,0.4)'
              }}
            >
              ⭐ 示例 PRD
            </span>
          )}

          {/* Quick PRD Switcher Dropdown */}
          {plans.length > 0 && onSelectPlan ? (
            <select
              value={currentPlan.id}
              onChange={(e) => onSelectPlan(e.target.value)}
              style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                borderRadius: 4,
                padding: '3px 8px',
                fontSize: 12,
                fontWeight: 700,
                color: 'var(--text-primary)',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.isDemo ? '⭐ ' : ''}
                  {p.title} ({p.version || 'v1.0'})
                </option>
              ))}
            </select>
          ) : (
            <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
              {currentPlan.title}
            </span>
          )}

          <span
            style={{
              fontFamily: 'monospace',
              fontSize: 11,
              color: 'var(--accent-blue)',
              background: 'rgba(79,158,248,0.1)',
              padding: '1px 5px',
              borderRadius: 3
            }}
          >
            {currentPlan.requirement?.id || currentPlan.id}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-secondary)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button
              onClick={() => setShowLeftTree((v) => !v)}
              title={showLeftTree ? '隐藏左侧架构树' : '展开左侧架构树'}
              style={{
                background: showLeftTree ? 'var(--accent-blue-dim)' : 'var(--bg-elevated)',
                border: '1px solid ' + (showLeftTree ? 'var(--accent-blue)' : 'var(--border)'),
                color: showLeftTree ? 'var(--accent-blue)' : 'var(--text-secondary)',
                borderRadius: 4,
                padding: '2px 6px',
                fontSize: 11,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 3
              }}
            >
              <span>◨</span>
              <span>架构树</span>
            </button>

            <button
              onClick={() => setShowRightInspector((v) => !v)}
              title={showRightInspector ? '隐藏右侧检查器' : '展开右侧检查器'}
              style={{
                background: showRightInspector ? 'var(--accent-blue-dim)' : 'var(--bg-elevated)',
                border: '1px solid ' + (showRightInspector ? 'var(--accent-blue)' : 'var(--border)'),
                color: showRightInspector ? 'var(--accent-blue)' : 'var(--text-secondary)',
                borderRadius: 4,
                padding: '2px 6px',
                fontSize: 11,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 3
              }}
            >
              <span>◧</span>
              <span>任务属性</span>
            </button>
          </div>

          <span>•</span>
          <span>PM: {currentPlan.leadPm || 'Sarah'}</span>
          <span>•</span>
          <span>Tech: {currentPlan.techLead || 'Alex'}</span>
        </div>
      </div>

      {/* 1. Top Metrics & Workload Header */}
      <WorkloadHeader
        tasks={currentPlan.tasks || []}
        onOpenDecompose={() => setIsDecomposeOpen(true)}
        onOpenBatchAssign={() => setIsBatchAssignOpen(true)}
        onOpenReconcile={() => setIsReconcileOpen(true)}
        onOpenBugModal={() => setIsBugModalOpen(true)}
        onRunReadyTasks={handleRunReadyTasks}
        isRunningAll={isRunningAll}
      />

      {/* 2. Main Three-Column Layout */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Left Column: Feature Tree */}
        {showLeftTree && (
          <FeatureTreePanel
            requirement={currentPlan.requirement}
            projects={currentPlan.projects}
            tasks={currentPlan.tasks || []}
            selectedNode={selectedNode}
            onSelectNode={(nodeId) => setSelectedNode(nodeId)}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
          />
        )}

        {/* Middle Column: Task Graph / List View */}
        <TaskGraphView
          tasks={visibleTasks}
          selectedTaskId={selectedTaskId}
          onSelectTask={(id) => setSelectedTaskId(id)}
          onRunTask={handleRunTask}
          selectedTaskIds={selectedTaskIds}
          onToggleTaskSelection={handleToggleTaskSelection}
          onSelectAllTasks={handleSelectAllTasks}
          viewMode={viewMode}
          onChangeViewMode={setViewMode}
        />

        {/* Right Column: Task Inspector */}
        {showRightInspector && (
          <TaskInspector
            task={selectedTask}
            allTasks={currentPlan.tasks || []}
            onUpdateTask={handleUpdateTask}
            onOpenContextModal={handleOpenContextModal}
            onRunTask={handleRunTask}
            agentProfiles={agentProfiles}
          />
        )}
      </div>

      {/* 3. Modals */}
      <PrdDecomposeModal
        isOpen={isDecomposeOpen}
        onClose={() => setIsDecomposeOpen(false)}
        onImportPlan={handleImportPlan}
        workspaces={workspaces}
        onAddWorkspace={onAddWorkspace}
      />

      <ContextPackageModal
        isOpen={isContextModalOpen}
        onClose={() => setIsContextModalOpen(false)}
        task={activeContextTask}
        contextPackage={activeContextPackage}
      />

      <BatchAssignModal
        isOpen={isBatchAssignOpen}
        onClose={() => setIsBatchAssignOpen(false)}
        selectedTaskCount={selectedTaskIds.size}
        onApplyBySelection={handleApplyBySelection}
        onApplyByLayer={handleApplyByLayer}
        agentProfiles={agentProfiles}
      />

      <AssetReconcileModal
        isOpen={isReconcileOpen}
        onClose={() => setIsReconcileOpen(false)}
        tasks={currentPlan.tasks || []}
        onApplyReconciliation={handleApplyReconciliation}
      />

      {isBugModalOpen && (
        <BugOrchestrateModal
          isOpen={isBugModalOpen}
          bugs={yunxiaoBugs}
          targetPlan={currentPlan}
          plans={plans}
          workspaces={workspaces}
          onClose={() => setIsBugModalOpen(false)}
          onConfirm={handleBugOrchestrateConfirm}
        />
      )}
    </div>
  )
}

import { describe, it } from 'node:test'
import assert from 'node:assert'
import {
  TaskDAGEngine,
  AgentRouter,
  ContextBuilder,
  ChangeSetReconciler,
  PlannerPromptEngine,
  BugOrchestratorEngine
} from './orchestratorService.js'

describe('Development Orchestrator Engine Tests', () => {
  const sampleTasks = [
    {
      id: 'T101',
      title: 'Define Domain Model',
      layer: 'domain',
      type: 'implementation',
      status: 'DONE',
      dependencies: []
    },
    {
      id: 'T102',
      title: 'Create Data Repository',
      layer: 'data',
      type: 'implementation',
      status: 'READY',
      dependencies: ['T101']
    },
    {
      id: 'T103',
      title: 'Implement Remote API',
      layer: 'data',
      type: 'api-mapping',
      status: 'WAITING_API',
      dependencies: ['T101'],
      sources: { api: { status: 'pending' } }
    },
    {
      id: 'T104',
      title: 'Implement ViewModel',
      layer: 'state',
      type: 'implementation',
      status: 'BLOCKED',
      dependencies: ['T102', 'T103']
    },
    {
      id: 'T105',
      title: 'UI Visual Cell',
      layer: 'ui',
      type: 'ui-visual',
      status: 'WAITING_DESIGN',
      dependencies: [],
      sources: { design: { status: 'pending' } }
    }
  ]

  it('1. TaskDAGEngine resolves correct statuses and handles asset gates', () => {
    const resolved = TaskDAGEngine.resolveGraphStatuses(sampleTasks)
    const t101 = resolved.find((t) => t.id === 'T101')
    const t102 = resolved.find((t) => t.id === 'T102')
    const t103 = resolved.find((t) => t.id === 'T103')
    const t104 = resolved.find((t) => t.id === 'T104')
    const t105 = resolved.find((t) => t.id === 'T105')

    assert.strictEqual(t101.status, 'DONE')
    assert.strictEqual(t102.status, 'READY') // T101 is DONE
    assert.strictEqual(t103.status, 'WAITING_API') // API pending
    assert.strictEqual(t104.status, 'BLOCKED') // T103 is not DONE
    assert.strictEqual(t105.status, 'WAITING_DESIGN') // Design pending
  })

  it('2. TaskDAGEngine computes topological levels correctly', () => {
    const levels = TaskDAGEngine.computeTopologicalLevels(sampleTasks)
    assert.strictEqual(levels.get('T101'), 0)
    assert.strictEqual(levels.get('T102'), 1)
    assert.strictEqual(levels.get('T103'), 1)
    assert.strictEqual(levels.get('T104'), 2)
  })

  it('3. AgentRouter calculates score and recommends best Agent/Model', () => {
    const task = {
      id: 'T104',
      title: 'Implement Report ViewModel',
      layer: 'state',
      type: 'implementation',
      complexity: 'high'
    }
    const routing = AgentRouter.routeTask(task)
    assert.ok(routing.recommended)
    assert.ok(routing.recommended.score >= 85)
    assert.strictEqual(routing.recommended.agent_id, 'antigravity')
  })

  it('4. ContextBuilder packages isolated minimal context without leakage', () => {
    const pkg = ContextBuilder.buildContextPackage(
      sampleTasks[1],
      { title: '宠物健康报告 PRD' },
      sampleTasks
    )
    assert.strictEqual(pkg.taskId, 'T102')
    assert.strictEqual(pkg.upstreamContracts.length, 1)
    assert.strictEqual(pkg.upstreamContracts[0].taskId, 'T101')
  })

  it('5. ChangeSetReconciler unlocks WAITING tasks on asset injection', () => {
    const { updatedTasks, changeSet } = ChangeSetReconciler.reconcileAsset(sampleTasks, {
      type: 'design',
      details: { figma_file: 'figma://report-card-v2' }
    })
    const t105 = updatedTasks.find((t) => t.id === 'T105')
    assert.strictEqual(t105.status, 'READY')
    assert.ok(changeSet.unlockedTaskIds.includes('T105'))
  })

  it('6. PlannerPromptEngine decomposes PRD into structured Task Graph', () => {
    const plan = PlannerPromptEngine.decomposePrd('需求：支持宠物健康历史报告分页拉取与离线缓存', {
      title: '健康报告优化',
      targetProjects: ['PetPal-iOS', 'PetPal-Backend']
    })
    assert.ok(plan.tasks.length >= 6)
    assert.strictEqual(plan.tasks[0].status, 'READY')
  })

  it('7. BugOrchestratorEngine binds bugs to existing plan and computes statuses', () => {
    const mockPlan = {
      id: 'PLAN-TEST',
      title: '现有需求迭代计划',
      projects: [{ id: 'PetPal-iOS' }],
      tasks: [...sampleTasks]
    }
    const mockBugs = [
      {
        identifier: 'YX-BUG-001',
        serialNumber: 'PROJ-101',
        subject: '视频 Tab 页离线闪退问题',
        severity: 'urgent'
      },
      {
        identifier: 'YX-BUG-002',
        serialNumber: 'PROJ-102',
        subject: '健康报告图表偶现白屏',
        severity: 'normal'
      }
    ]

    const updatedPlan = BugOrchestratorEngine.bindBugsToPlan(mockPlan, mockBugs, {
      policy: 'parallel'
    })
    assert.strictEqual(updatedPlan.tasks.length, sampleTasks.length + 2)

    const bugTask1 = updatedPlan.tasks.find((t) => t.sources?.bug?.id === 'YX-BUG-001')
    assert.ok(bugTask1)
    assert.strictEqual(bugTask1.status, 'READY')
    assert.strictEqual(bugTask1.type, 'bugfix')
    assert.strictEqual(bugTask1.execution.recommended.agent_id, 'claude-code')
  })

  it('8. BugOrchestratorEngine creates standalone bug plan with 3-stage DAG', () => {
    const mockBugs = [
      { identifier: 'YX-BUG-003', serialNumber: 'PROJ-103', subject: '网络重试拦截死循环' }
    ]
    const standalonePlan = BugOrchestratorEngine.createStandaloneBugPlan(mockBugs, {
      project: 'PetPal-iOS'
    })
    assert.ok(standalonePlan.id.startsWith('PLAN-BUG-'))
    assert.strictEqual(standalonePlan.tasks.length, 3)

    const [diagTask, fixTask, verifyTask] = standalonePlan.tasks
    assert.strictEqual(diagTask.status, 'READY')
    assert.strictEqual(diagTask.execution.recommended.agent_id, 'claude-code')
    assert.strictEqual(fixTask.status, 'BLOCKED')
    assert.strictEqual(fixTask.execution.recommended.agent_id, 'antigravity')
    assert.strictEqual(verifyTask.status, 'BLOCKED')
    assert.strictEqual(verifyTask.execution.recommended.agent_id, 'chatgpt')
  })
})

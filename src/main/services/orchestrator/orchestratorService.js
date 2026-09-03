import fs from 'fs'
import path from 'path'
import { homedir } from 'os'

// ============================================================================
// Agent Profiles & Model Registry
// ============================================================================

export const AGENT_PROFILES = [
  {
    id: 'chatgpt',
    name: 'ChatGPT',
    avatar: '🤖',
    color: '#10a37f',
    capabilities: {
      architecture: 96,
      planning: 95,
      review: 95,
      domain: 90,
      debugging: 90,
      coding: 85,
      refactoring: 86
    },
    supportedModels: ['gpt-4o', 'gpt-4o-mini', 'o3-mini', 'o1'],
    defaultModel: 'gpt-4o',
    preferredRoles: ['Planner', 'Architect', 'Reviewer'],
    supports: ['repository', 'shell', 'skills', 'rules', 'browser']
  },
  {
    id: 'antigravity',
    name: 'Antigravity',
    avatar: '✨',
    color: '#8b5cf6',
    capabilities: {
      coding: 96,
      refactoring: 95,
      multi_file_change: 95,
      ui_implementation: 94,
      debugging: 92,
      testing: 90,
      architecture: 85,
      planning: 82
    },
    supportedModels: ['gemini-1.5-pro', 'gemini-2.0-flash', 'claude-3-5-sonnet', 'auto'],
    defaultModel: 'gemini-1.5-pro',
    preferredRoles: ['Senior Full-stack Implementer', 'Refactor Specialist'],
    supports: ['repository', 'terminal', 'subagents', 'skills', 'rules', 'artifacts']
  },
  {
    id: 'claude-code',
    name: 'Claude Code',
    avatar: '⚡',
    color: '#d97706',
    capabilities: {
      repository_analysis: 95,
      testing: 94,
      debugging: 93,
      coding: 91,
      architecture: 88,
      planning: 84
    },
    supportedModels: ['claude-3-5-sonnet', 'qwen-2.5-coder-32b', 'deepseek-r1', 'glm-4-plus'],
    defaultModel: 'claude-3-5-sonnet',
    preferredRoles: ['Test Engineer', 'Bug Hunter', 'Sub-module Implementer'],
    supports: ['terminal', 'git', 'search', 'skills']
  },
  {
    id: 'trae',
    name: 'TRAE',
    avatar: '🚀',
    color: '#06b6d4',
    capabilities: {
      ui_skeleton: 92,
      small_features: 89,
      routine_coding: 87,
      testing: 82,
      architecture: 75
    },
    supportedModels: ['claude-3-5-sonnet', 'glm-4-plus', 'qwen-max'],
    defaultModel: 'claude-3-5-sonnet',
    preferredRoles: ['UI/Component Builder', 'Fast Prototyper'],
    supports: ['ide-integration', 'inline-completion', 'chat']
  },
  {
    id: 'workbuddy',
    name: 'WorkBuddy',
    avatar: '🛠️',
    color: '#3b82f6',
    capabilities: {
      scaffolding: 88,
      documentation: 92,
      verification: 86,
      routine_coding: 80,
      architecture: 72
    },
    supportedModels: ['qwen-max', 'glm-4-air', 'gpt-4o-mini'],
    defaultModel: 'qwen-max',
    preferredRoles: ['Documentation & Scaffolding Assistant'],
    supports: ['local-scripts', 'docs-sync', 'task-tracker']
  }
]

export const MODEL_REGISTRY = [
  { id: 'auto', name: 'Auto (Smart Router)', provider: 'System', tier: 'smart' },
  { id: 'gpt-4o', name: 'GPT-4o', provider: 'OpenAI', tier: 'flagship' },
  { id: 'o3-mini', name: 'o3-mini', provider: 'OpenAI', tier: 'reasoning' },
  { id: 'o1', name: 'o1', provider: 'OpenAI', tier: 'deep-reasoning' },
  { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', provider: 'Google', tier: 'flagship' },
  { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', provider: 'Google', tier: 'fast' },
  { id: 'claude-3-5-sonnet', name: 'Claude 3.5 Sonnet', provider: 'Anthropic', tier: 'flagship' },
  {
    id: 'qwen-2.5-coder-32b',
    name: 'Qwen 2.5 Coder 32B',
    provider: 'Alibaba',
    tier: 'open-source'
  },
  { id: 'deepseek-r1', name: 'DeepSeek R1', provider: 'DeepSeek', tier: 'reasoning' },
  { id: 'glm-4-plus', name: 'GLM-4 Plus', provider: 'Zhipu AI', tier: 'flagship' }
]

// ============================================================================
// Task DAG Engine (Topological Sorting, Status Resolution, Cycle Detection)
// ============================================================================

export class TaskDAGEngine {
  /**
   * Recompute statuses of all tasks in a graph based on asset gates and dependencies.
   * @param {Array} tasks
   * @returns {Array} updated tasks
   */
  static resolveGraphStatuses(tasks) {
    const taskMap = new Map(tasks.map((t) => [t.id, { ...t }]))

    // Iteratively resolve statuses until convergence
    let changed = true
    let passes = 0
    const maxPasses = tasks.length + 2

    while (changed && passes < maxPasses) {
      changed = false
      passes++

      for (const [, task] of taskMap.entries()) {
        // Skip terminal or active states if already set
        if (task.status === 'DONE' || task.status === 'RUNNING') continue

        let newStatus = 'READY'

        // 1. External Asset Gates
        if (task.sources?.api?.status === 'pending') {
          newStatus = 'WAITING_API'
        } else if (task.sources?.design?.status === 'pending') {
          newStatus = 'WAITING_DESIGN'
        } else if (task.dependencies && task.dependencies.length > 0) {
          // 2. DAG Dependency Gates
          const hasUnfinishedDep = task.dependencies.some((depId) => {
            const depTask = taskMap.get(depId)
            return !depTask || depTask.status !== 'DONE'
          })

          if (hasUnfinishedDep) {
            newStatus = 'BLOCKED'
          }
        }

        if (task.status !== newStatus) {
          task.status = newStatus
          changed = true
        }
      }
    }

    return Array.from(taskMap.values())
  }

  /**
   * Get all tasks currently eligible for parallel execution (READY)
   */
  static getReadyTasks(tasks) {
    return tasks.filter((t) => t.status === 'READY')
  }

  /**
   * Calculate topological levels for rendering graph columns/tiers
   */
  static computeTopologicalLevels(tasks) {
    const adj = new Map()

    tasks.forEach((t) => {
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

    return levels
  }

  /**
   * Detect circular dependencies in task graph
   */
  static detectCycles(tasks) {
    const adj = new Map()
    tasks.forEach((t) => adj.set(t.id, t.dependencies || []))

    const visited = new Set()
    const recStack = new Set()
    const cycles = []

    function dfs(nodeId, path = []) {
      visited.add(nodeId)
      recStack.add(nodeId)
      path.push(nodeId)

      const deps = adj.get(nodeId) || []
      for (const dep of deps) {
        if (!visited.has(dep)) {
          if (dfs(dep, [...path])) return true
        } else if (recStack.has(dep)) {
          cycles.push([...path, dep])
          return true
        }
      }

      recStack.delete(nodeId)
      return false
    }

    tasks.forEach((t) => {
      if (!visited.has(t.id)) {
        dfs(t.id)
      }
    })

    return { hasCycles: cycles.length > 0, cycles }
  }
}

// ============================================================================
// Agent & Model Router (Capability Matching & Score Calculation)
// ============================================================================

export class AgentRouter {
  /**
   * Recommend the best Agent and Model for a given Task
   * @param {Object} task
   * @param {Object} projectProfile (optional project-level execution preferences)
   * @returns {Object} { recommended: { agent_id, model_id, score, reason }, candidates: [] }
   */
  static routeTask(task, projectProfile = null) {
    const layer = (task.layer || '').toLowerCase()
    const type = (task.type || '').toLowerCase()
    const complexity = (task.complexity || 'medium').toLowerCase()

    const scoredCandidates = AGENT_PROFILES.map((agent) => {
      // 1. Type capability
      let typeScore = 80
      if (type.includes('arch') || type.includes('scaffolding')) {
        typeScore = agent.capabilities.architecture || 80
      } else if (type.includes('impl') || type.includes('state') || type.includes('data')) {
        typeScore = agent.capabilities.coding || 80
      } else if (type.includes('ui')) {
        typeScore = agent.capabilities.ui_implementation || agent.capabilities.ui_skeleton || 85
      } else if (type.includes('test') || type.includes('verif')) {
        typeScore = agent.capabilities.testing || 85
      } else if (type.includes('review')) {
        typeScore = agent.capabilities.review || 80
      } else if (type.includes('refactor')) {
        typeScore = agent.capabilities.refactoring || 85
      } else if (type.includes('bug') || type.includes('diag')) {
        typeScore = agent.capabilities.debugging || agent.capabilities.testing || 90
      }

      // 2. Layer capability
      let layerScore = 80
      if (layer === 'architecture' || layer === 'domain') {
        layerScore = agent.capabilities.planning || agent.capabilities.architecture || 80
      } else if (layer === 'state' || layer === 'data') {
        layerScore = agent.capabilities.coding || agent.capabilities.refactoring || 85
      } else if (layer === 'ui') {
        layerScore = agent.capabilities.ui_implementation || 85
      } else if (layer === 'test') {
        layerScore = agent.capabilities.testing || 85
      } else if (layer === 'review') {
        layerScore = agent.capabilities.review || 85
      }

      // 3. Complexity handling
      let complexityScore = 85
      if (complexity === 'critical' || complexity === 'high') {
        if (agent.id === 'chatgpt' || agent.id === 'antigravity') complexityScore = 95
        else if (agent.id === 'claude-code') complexityScore = 90
        else complexityScore = 75
      }

      // 4. Project Preference Boost
      let prefScore = 80
      if (projectProfile && projectProfile[layer]?.agent === agent.id) {
        prefScore = 100
      }

      // Weighted score calculation
      const totalScore = Math.round(
        typeScore * 0.35 + layerScore * 0.25 + complexityScore * 0.25 + prefScore * 0.15
      )

      // Reason generation
      let reason = ''
      if (agent.id === 'antigravity') {
        reason = '强项为跨文件重构、UI/State 编写与本地工作区协同执行'
      } else if (agent.id === 'chatgpt') {
        reason = '具备顶尖的架构推理、领域契约定义与全局 Code Review 能力'
      } else if (agent.id === 'claude-code') {
        reason = '强项为代码库深度检索、测试用例编写与精准 Bug 溯源'
      } else if (agent.id === 'trae') {
        reason = '轻量高效，适合快速构建 UI 骨架与局部页面原型'
      } else {
        reason = '适合脚手架搭设、代码验证与文档契约生成'
      }

      return {
        agent_id: agent.id,
        agent_name: agent.name,
        model_id: agent.defaultModel,
        score: totalScore,
        reason
      }
    })

    scoredCandidates.sort((a, b) => b.score - a.score)
    const best = scoredCandidates[0]

    return {
      recommended: best,
      candidates: scoredCandidates
    }
  }
}

// ============================================================================
// Context Builder (Isolated Minimal Context Packages)
// ============================================================================

export class ContextBuilder {
  /**
   * Assemble a precise, isolated context package for a specific task
   * @param {Object} task
   * @param {Object} requirement
   * @param {Array} allTasks
   */
  static buildContextPackage(task, requirement = {}, allTasks = []) {
    const taskMap = new Map(allTasks.map((t) => [t.id, t]))
    const upstreamTasks = (task.dependencies || []).map((id) => taskMap.get(id)).filter(Boolean)

    const contextPackage = {
      taskId: task.id,
      taskTitle: task.title,
      project: task.project,
      layer: task.layer,
      type: task.type,
      generatedAt: new Date().toISOString(),

      // 1. PRD Snippet (Isolated requirement)
      prdSnippet: {
        sectionId: task.sources?.prd?.section_id || 'sec-core',
        title: task.sources?.prd?.title || requirement.title || '需求概要',
        content:
          task.sources?.prd?.content ||
          `【${task.title}】相关需求：完成对应模块工程实现，满足响应式、异常重试与数据流闭环。`
      },

      // 2. API Contract
      apiContract: task.sources?.api
        ? {
            operationId: task.sources.api.operation_id || 'getApiData',
            endpoint: task.sources.api.endpoint || '/api/v1/resource',
            status: task.sources.api.status || 'ready',
            dtoSchema: task.sources.api.dto || {
              request: { page: 'Int', pageSize: 'Int' },
              response: { code: 'Int', message: 'String', data: 'Object' }
            }
          }
        : null,

      // 3. Design Spec
      designSpec: task.sources?.design
        ? {
            frameId: task.sources.design.frame_id || 'frame-main',
            figmaUrl: task.sources.design.figma_file || 'figma://file/spec',
            status: task.sources.design.status || 'ready',
            tokens: {
              colors: ['#0d1117', '#161b22', '#4f9ef8'],
              layout: 'AutoLayout Vertical, Padding: 16px, Gap: 12px'
            }
          }
        : null,

      // 4. Injected Project Rules & Agent Skills
      rules: task.context?.rules || [
        `${task.project || 'Project'}/rules/architecture.md`,
        'rules/coding-standards.md'
      ],
      skills: task.context?.skills || [
        `${(task.project || 'generic').toLowerCase()}-${task.layer || 'core'}`,
        'clean-architecture'
      ],

      // 5. Target Expected Files & Upstream Outputs
      expectedFiles: task.files?.expected || [
        `src/${task.layer}/${task.title.replace(/\s+/g, '')}.ts`
      ],
      acceptanceCriteria: task.acceptance_criteria || [
        '代码结构清晰，符合项目分层设计规范',
        '核心方法包含防御性异常处理与状态闭环',
        '通过配套单元测试验证'
      ],

      // 6. Upstream code contracts produced by predecessor tasks
      upstreamContracts: upstreamTasks.map((u) => ({
        taskId: u.id,
        title: u.title,
        outputFiles: u.files?.expected || [],
        summary: `由 ${u.id} 生成的契约与接口定义`
      }))
    }

    return contextPackage
  }
}

// ============================================================================
// ChangeSet Reconciler (Incremental Asset Ingestion & Task Unlocking)
// ============================================================================

export class ChangeSetReconciler {
  /**
   * Reconcile new external asset (API or Figma) into existing tasks
   * @param {Array} tasks
   * @param {Object} assetPayload { type: 'api'|'design', assetId, details }
   * @returns {Object} { updatedTasks, changeSet }
   */
  static reconcileAsset(tasks, assetPayload) {
    const updatedTasks = JSON.parse(JSON.stringify(tasks))
    const unlockedTaskIds = []
    const affectedTasks = []

    updatedTasks.forEach((t) => {
      if (assetPayload.type === 'api') {
        if (t.sources?.api && t.sources.api.status === 'pending') {
          t.sources.api.status = 'ready'
          if (assetPayload.details) {
            t.sources.api = { ...t.sources.api, ...assetPayload.details }
          }
          affectedTasks.push(t.id)
        }
      } else if (assetPayload.type === 'design') {
        if (t.sources?.design && t.sources.design.status === 'pending') {
          t.sources.design.status = 'ready'
          if (assetPayload.details) {
            t.sources.design = { ...t.sources.design, ...assetPayload.details }
          }
          affectedTasks.push(t.id)
        }
      }
    })

    // Recompute statuses with DAG engine
    const finalTasks = TaskDAGEngine.resolveGraphStatuses(updatedTasks)

    finalTasks.forEach((t) => {
      const orig = tasks.find((o) => o.id === t.id)
      if (
        orig &&
        (orig.status === 'WAITING_API' || orig.status === 'WAITING_DESIGN') &&
        t.status === 'READY'
      ) {
        unlockedTaskIds.push(t.id)
      }
    })

    const changeSet = {
      id: `CS-${Date.now().toString().slice(-4)}`,
      timestamp: new Date().toISOString(),
      assetType: assetPayload.type,
      affectedTasks,
      unlockedTaskIds,
      summary: `补充 ${assetPayload.type.toUpperCase()} 资产：解除 ${unlockedTaskIds.length} 个骨架任务阻塞状态`
    }

    return { updatedTasks: finalTasks, changeSet }
  }
}

// ============================================================================
// AI PRD Decomposition Generator (Simulation & Template Generator)
// ============================================================================

export class PlannerPromptEngine {
  /**
   * Generate complete Planner system prompt + user prompt for AI PRD decomposition
   */
  static buildPlannerPrompt(prdText, targetProjects = ['PetPal-iOS', 'PetPal-Backend']) {
    const systemPrompt = `You are the Lead Engineering Architect and Task Decomposition Specialist in the Development Orchestrator system.
Your mission is to analyze the PRD, target projects, and architecture rules, and decompose requirements into a rigorous 6-level hierarchy:
Requirement -> Feature -> Project -> Page/Domain -> Layer -> Task.

Decomposition rules:
1. Divide work into architectural layers: domain, data, state, ui, integration, test, review.
2. Separate UI Skeleton from Visual UI (mark visual as WAITING_DESIGN if no Figma is given).
3. Separate Mock Repo from API Client (mark API Client as WAITING_API if endpoints are tentative).
4. Identify strict DAG dependencies among tasks.
5. Provide recommended Agent (ChatGPT, Antigravity, Claude Code, TRAE, WorkBuddy) and Model.
6. Output in clean JSON format matching the schema.`

    const userPrompt = `### PRD Content:
${prdText}

### Target Projects:
${targetProjects.join(', ')}

Please output the complete task graph JSON.`

    return { systemPrompt, userPrompt }
  }

  /**
   * Parse or generate structured Task Graph from PRD
   */
  static decomposePrd(prdText, options = {}) {
    const targetProjects = options.targetProjects || ['PetPal-iOS', 'PetPal-Backend']
    const featureName = options.featureName || 'HealthReport'

    // Smart heuristic generator for default / demo PRDs
    const tasks = [
      {
        id: 'CORE-101',
        title: 'Define Domain Entity Contracts',
        project: targetProjects[0] || 'App-Client',
        feature: featureName,
        page_or_domain: 'DomainCore',
        layer: 'domain',
        type: 'implementation',
        complexity: 'medium',
        risk: 'low',
        status: 'READY',
        dependencies: [],
        sources: {
          prd: { section_id: 'sec-1.1', title: '数据领域模型定义' }
        },
        files: { expected: ['Domain/Models/HealthReportModel.swift'] },
        acceptance_criteria: ['定义强类型实体与枚举', '实现 Codable 与 Equatable 协议'],
        execution: {
          mode: 'assisted',
          recommended: {
            agent_id: 'chatgpt',
            model_id: 'gpt-4o',
            score: 95,
            reason: '领域契约抽象'
          },
          selected: { agent_id: 'chatgpt', model_id: 'gpt-4o' }
        }
      },
      {
        id: 'CORE-102',
        title: 'Create Data Repository & Local Storage',
        project: targetProjects[0] || 'App-Client',
        feature: featureName,
        page_or_domain: 'DataRepository',
        layer: 'data',
        type: 'implementation',
        complexity: 'medium',
        risk: 'low',
        status: 'BLOCKED',
        dependencies: ['CORE-101'],
        sources: {
          prd: { section_id: 'sec-2.1', title: '本地缓存策略' }
        },
        files: { expected: ['Data/Repositories/ReportRepository.swift'] },
        acceptance_criteria: ['实现内存与 SQLite 二级缓存', '支持无网离线读取'],
        execution: {
          mode: 'assisted',
          recommended: {
            agent_id: 'antigravity',
            model_id: 'gemini-1.5-pro',
            score: 96,
            reason: '本地存储实现'
          },
          selected: { agent_id: 'antigravity', model_id: 'auto' }
        }
      },
      {
        id: 'CORE-103',
        title: 'Implement Remote API Client',
        project: targetProjects[0] || 'App-Client',
        feature: featureName,
        page_or_domain: 'NetworkService',
        layer: 'data',
        type: 'api-mapping',
        complexity: 'medium',
        risk: 'medium',
        status: 'WAITING_API',
        dependencies: ['CORE-101'],
        sources: {
          prd: { section_id: 'sec-2.2', title: 'API 请求协议' },
          api: { operation_id: 'getHealthReport', status: 'pending' }
        },
        files: { expected: ['Network/ReportApiService.swift'] },
        acceptance_criteria: ['网络重试与超时兜底', '错误码全局映射'],
        execution: {
          mode: 'assisted',
          recommended: {
            agent_id: 'antigravity',
            model_id: 'gemini-1.5-pro',
            score: 94,
            reason: 'API 接入'
          },
          selected: { agent_id: 'antigravity', model_id: 'auto' }
        }
      },
      {
        id: 'CORE-104',
        title: 'Implement Report ViewModel & State Machine',
        project: targetProjects[0] || 'App-Client',
        feature: featureName,
        page_or_domain: 'ReportList',
        layer: 'state',
        type: 'implementation',
        complexity: 'high',
        risk: 'low',
        status: 'BLOCKED',
        dependencies: ['CORE-102', 'CORE-103'],
        sources: {
          prd: { section_id: 'sec-3.1', title: '状态机与分页拉取' }
        },
        files: { expected: ['ViewModels/ReportListViewModel.swift'] },
        acceptance_criteria: [
          '维护 .loading / .loaded / .empty / .error 状态',
          '支持分页拉取与下拉刷新'
        ],
        execution: {
          mode: 'assisted',
          recommended: {
            agent_id: 'antigravity',
            model_id: 'gemini-1.5-pro',
            score: 95,
            reason: '状态流编写'
          },
          selected: { agent_id: 'antigravity', model_id: 'auto' }
        }
      },
      {
        id: 'CORE-105',
        title: 'Build UI Layout Skeleton',
        project: targetProjects[0] || 'App-Client',
        feature: featureName,
        page_or_domain: 'ReportUI',
        layer: 'ui',
        type: 'ui-skeleton',
        complexity: 'low',
        risk: 'low',
        status: 'READY',
        dependencies: [],
        sources: {
          prd: { section_id: 'sec-4.1', title: '页面骨架结构' }
        },
        files: { expected: ['Views/ReportListViewSkeleton.swift'] },
        acceptance_criteria: ['构建列表滚动容器', '骨架屏动画占位'],
        execution: {
          mode: 'assisted',
          recommended: {
            agent_id: 'trae',
            model_id: 'claude-3-5-sonnet',
            score: 92,
            reason: '快速骨架搭建'
          },
          selected: { agent_id: 'trae', model_id: 'claude-3-5-sonnet' }
        }
      },
      {
        id: 'CORE-106',
        title: 'Implement Pixel-Perfect Visual UI',
        project: targetProjects[0] || 'App-Client',
        feature: featureName,
        page_or_domain: 'ReportUI',
        layer: 'ui',
        type: 'ui-visual',
        complexity: 'medium',
        risk: 'low',
        status: 'WAITING_DESIGN',
        dependencies: ['CORE-105'],
        sources: {
          design: { figma_file: 'figma://report-detail', status: 'pending' }
        },
        files: { expected: ['Views/ReportCardCell.swift'] },
        acceptance_criteria: ['还原 Figma 设计稿样式', '适配暗黑模式与动态字体'],
        execution: {
          mode: 'assisted',
          recommended: {
            agent_id: 'antigravity',
            model_id: 'gemini-1.5-pro',
            score: 94,
            reason: '像素级 UI 还原'
          },
          selected: { agent_id: 'antigravity', model_id: 'auto' }
        }
      },
      {
        id: 'CORE-107',
        title: 'Integrate ViewModel with UI Components',
        project: targetProjects[0] || 'App-Client',
        feature: featureName,
        page_or_domain: 'Integration',
        layer: 'integration',
        type: 'integration',
        complexity: 'medium',
        risk: 'medium',
        status: 'BLOCKED',
        dependencies: ['CORE-104', 'CORE-106'],
        sources: {
          prd: { section_id: 'sec-5.1', title: '页面级总装' }
        },
        files: { expected: ['Views/ReportViewController.swift'] },
        acceptance_criteria: ['事件流双向绑定', '路由跳转与生命周期管理'],
        execution: {
          mode: 'assisted',
          recommended: {
            agent_id: 'antigravity',
            model_id: 'gemini-1.5-pro',
            score: 92,
            reason: '模块装配集成'
          },
          selected: { agent_id: 'antigravity', model_id: 'auto' }
        }
      },
      {
        id: 'CORE-108',
        title: 'Unit Testing & Architecture Review',
        project: targetProjects[0] || 'App-Client',
        feature: featureName,
        page_or_domain: 'Verification',
        layer: 'test',
        type: 'test',
        complexity: 'medium',
        risk: 'low',
        status: 'BLOCKED',
        dependencies: ['CORE-107'],
        sources: {
          prd: { section_id: 'sec-6.1', title: '质量保障与测试覆盖' }
        },
        files: { expected: ['Tests/ReportViewModelTests.swift'] },
        acceptance_criteria: ['ViewModel 单元测试覆盖率 > 85%', 'Mock 异常边界测试通过'],
        execution: {
          mode: 'assisted',
          recommended: {
            agent_id: 'claude-code',
            model_id: 'claude-3-5-sonnet',
            score: 95,
            reason: '测试验证'
          },
          selected: { agent_id: 'claude-code', model_id: 'claude-3-5-sonnet' }
        }
      }
    ]

    return {
      planId: `PLAN-${Date.now().toString().slice(-6)}`,
      title: options.title || '智能研发编排计划',
      feature: featureName,
      targetProjects,
      tasks: TaskDAGEngine.resolveGraphStatuses(tasks)
    }
  }
}

// ============================================================================
// Bug Orchestration Engine (Bind to Plan or Create Standalone Bug Plan)
// ============================================================================

export class BugOrchestratorEngine {
  /**
   * Convert a Yunxiao bug into a standardized bugfix task for an existing plan
   */
  static createBugTaskForPlan(bug, options = {}) {
    const bugId =
      bug.identifier || bug.id || bug.serialNumber || `BUG-${Date.now().toString().slice(-4)}`
    const bugSerial = bug.serialNumber || bugId
    const bugTitle = bug.subject || bug.title || bug.name || '缺陷修复'
    const project = options.project || 'PetPal-iOS'
    const feature = options.feature || 'BugFix'
    const policy = options.policy || 'parallel' // 'parallel' | 'gate'
    const taskId = `BUG-${String(bugSerial).replace(/[^a-zA-Z0-9_-]/g, '') || Date.now().toString().slice(-4)}`

    const dependencies = Array.isArray(options.dependOnTaskIds) ? [...options.dependOnTaskIds] : []

    const bugTask = {
      id: taskId,
      title: `[修复] ${bugSerial}: ${bugTitle}`,
      project,
      feature,
      page_or_domain: 'BugFix',
      layer: 'domain',
      type: 'bugfix',
      complexity: bug.severity === 'urgent' || bug.priority === 'urgent' ? 'high' : 'medium',
      risk: 'medium',
      status: dependencies.length > 0 ? 'BLOCKED' : 'READY',
      dependencies,
      sources: {
        bug: {
          id: bug.identifier || bug.id || '',
          serialNumber: bugSerial,
          title: bugTitle,
          status:
            typeof bug.status === 'object' ? bug.status?.name || '待修复' : bug.status || '待修复',
          assignedTo:
            typeof bug.assignedTo === 'object' ? bug.assignedTo?.name || '' : bug.assignedTo || '',
          description: bug.description || '',
          gmtCreate: bug.gmtCreate || '',
          url: bug.url || ''
        }
      },
      files: {
        expected: options.expectedFiles || [`Sources/Fixes/${bugSerial}.swift`]
      },
      acceptance_criteria: [
        `精准定位缺陷根因：${bugTitle}`,
        `编写单元测试复现缺陷并验证修复结果`,
        `回归关联调用链路，确保无破坏性副效应`
      ],
      execution: {
        mode: 'assisted',
        recommended: {
          agent_id: 'claude-code',
          model_id: 'claude-3-5-sonnet',
          score: 96,
          reason: '强项为代码库深度检索、测试用例编写与精准 Bug 溯源'
        },
        selected: {
          agent_id: 'claude-code',
          model_id: 'claude-3-5-sonnet'
        }
      }
    }

    return bugTask
  }

  /**
   * Bind one or multiple bugs to an existing plan
   */
  static bindBugsToPlan(targetPlan, bugs = [], options = {}) {
    if (!targetPlan) throw new Error('Target plan is required')
    const existingTasks = Array.isArray(targetPlan.tasks) ? [...targetPlan.tasks] : []
    const newTasks = []

    bugs.forEach((bug, idx) => {
      const task = this.createBugTaskForPlan(bug, {
        project:
          options.project ||
          targetPlan.projects?.[0]?.id ||
          targetPlan.projects?.[0]?.name ||
          targetPlan.projects?.[0] ||
          'PetPal-iOS',
        feature: options.feature || 'BugFix',
        policy: options.policy || 'parallel',
        dependOnTaskIds: options.dependOnTaskIds || []
      })
      if (existingTasks.some((t) => t.id === task.id)) {
        task.id = `${task.id}-${idx + 1}`
      }
      newTasks.push(task)
    })

    let allTasks = [...existingTasks, ...newTasks]

    // If policy is 'gate', make downstream test/review tasks depend on these bug tasks
    if (options.policy === 'gate' && newTasks.length > 0) {
      const bugTaskIds = newTasks.map((t) => t.id)
      allTasks = allTasks.map((t) => {
        if (t.layer === 'test' || t.layer === 'review' || t.type === 'test') {
          const currentDeps = t.dependencies || []
          const combined = Array.from(new Set([...currentDeps, ...bugTaskIds]))
          return { ...t, dependencies: combined }
        }
        return t
      })
    }

    const resolvedTasks = TaskDAGEngine.resolveGraphStatuses(allTasks)

    return {
      ...targetPlan,
      tasks: resolvedTasks,
      updatedAt: '刚刚'
    }
  }

  /**
   * Create a standalone bug fix plan with closed-loop DAG tasks
   */
  static createStandaloneBugPlan(bugs = [], options = {}) {
    if (!bugs.length) throw new Error('At least one bug is required')
    const primaryBug = bugs[0]
    const primarySerial = primaryBug.serialNumber || primaryBug.identifier || 'BUG'
    const targetProject = options.project || 'PetPal-iOS'
    const planId = `PLAN-BUG-${Date.now().toString().slice(-6)}`
    const title =
      options.title ||
      (bugs.length === 1
        ? `[Bug专项] ${primarySerial}: ${primaryBug.subject || primaryBug.title || '缺陷修复'}`
        : `[Bug专项] ${primarySerial} 等 ${bugs.length} 项云效缺陷集中修复与验证`)

    const baseTaskId = `BUG-${Date.now().toString().slice(-4)}`
    const task1Id = `${baseTaskId}-1-DIAG`
    const task2Id = `${baseTaskId}-2-FIX`
    const task3Id = `${baseTaskId}-3-VERIFY`

    const bugSummaries = bugs
      .map((b) => `• [${b.serialNumber || b.identifier || 'BUG'}] ${b.subject || b.title || ''}`)
      .join('\n')

    const tasks = [
      {
        id: task1Id,
        title:
          bugs.length === 1
            ? `诊断与根因溯源: ${primaryBug.subject || primaryBug.title}`
            : `多缺陷根因排查与复现测试`,
        project: targetProject,
        feature: 'BugFix',
        page_or_domain: 'BugDiagnosis',
        layer: 'test',
        type: 'bug-diagnosis',
        complexity: 'medium',
        risk: 'low',
        status: 'READY',
        dependencies: [],
        sources: {
          bug: {
            id: primaryBug.identifier || primaryBug.id || '',
            serialNumber: primarySerial,
            title: primaryBug.subject || primaryBug.title || '',
            allBugs: bugs.map((b) => ({
              id: b.identifier || b.id || '',
              serialNumber: b.serialNumber || '',
              title: b.subject || b.title || ''
            }))
          }
        },
        files: { expected: ['Tests/BugReproductionTests.swift'] },
        acceptance_criteria: [
          '精准定位缺陷触发场景并编写可复现的自动化单测',
          '输出根因分析摘要，明确缺陷所在的代码行与生命周期时序'
        ],
        execution: {
          mode: 'assisted',
          recommended: {
            agent_id: 'claude-code',
            model_id: 'claude-3-5-sonnet',
            score: 96,
            reason: '强项为代码库深度检索、测试用例编写与精准 Bug 溯源'
          },
          selected: { agent_id: 'claude-code', model_id: 'claude-3-5-sonnet' }
        }
      },
      {
        id: task2Id,
        title:
          bugs.length === 1
            ? `补丁修复与工程落地: ${primaryBug.subject || primaryBug.title}`
            : `核心代码补丁编写与容错兜底`,
        project: targetProject,
        feature: 'BugFix',
        page_or_domain: 'BugFix',
        layer: 'domain',
        type: 'bugfix',
        complexity: 'medium',
        risk: 'medium',
        status: 'BLOCKED',
        dependencies: [task1Id],
        sources: {
          bug: {
            id: primaryBug.identifier || primaryBug.id || '',
            serialNumber: primarySerial,
            title: primaryBug.subject || primaryBug.title || ''
          }
        },
        files: { expected: ['Sources/Core/Fix.swift'] },
        acceptance_criteria: [
          '依据根因分析完成补丁编写，消除异常分支',
          '补丁通过已编写的复现单元测试，无破坏性影响'
        ],
        execution: {
          mode: 'assisted',
          recommended: {
            agent_id: 'antigravity',
            model_id: 'gemini-1.5-pro',
            score: 95,
            reason: '强项为跨文件重构、精准补丁编写与本地工作区协同执行'
          },
          selected: { agent_id: 'antigravity', model_id: 'auto' }
        }
      },
      {
        id: task3Id,
        title: '集成回归与 Code Review 质量验收',
        project: targetProject,
        feature: 'BugFix',
        page_or_domain: 'BugVerify',
        layer: 'review',
        type: 'review',
        complexity: 'low',
        risk: 'low',
        status: 'BLOCKED',
        dependencies: [task2Id],
        sources: {
          bug: {
            id: primaryBug.identifier || primaryBug.id || '',
            serialNumber: primarySerial,
            title: primaryBug.subject || primaryBug.title || ''
          }
        },
        files: { expected: ['ReviewReport.md'] },
        acceptance_criteria: [
          '执行全局构建与测试套件，确认 100% 通过',
          '完成代码审查并同步更新云效工作项状态为已修复'
        ],
        execution: {
          mode: 'assisted',
          recommended: {
            agent_id: 'chatgpt',
            model_id: 'gpt-4o',
            score: 95,
            reason: '具备顶尖的架构推理、领域契约定义与全局 Code Review 能力'
          },
          selected: { agent_id: 'chatgpt', model_id: 'gpt-4o' }
        }
      }
    ]

    const resolvedTasks = TaskDAGEngine.resolveGraphStatuses(tasks)

    return {
      id: planId,
      title,
      version: 'v1.0-fix',
      status: 'IN_PROGRESS',
      isDemo: false,
      leadPm: '云效缺陷协同',
      techLead: 'Multi-Agent Team',
      updatedAt: '刚刚',
      description: `来自云效工作台缺陷集中修复计划，包含 ${bugs.length} 个缺陷：\n${bugSummaries}`,
      requirement: {
        id: `REQ-BUG-${Date.now().toString().slice(-4)}`,
        title,
        version: 'v1.0',
        author: '云效系统',
        status: 'ACTIVE',
        prdSnippet: `## 云效缺陷详情\n${bugSummaries}`
      },
      projects: [{ id: targetProject, name: targetProject }],
      tasks: resolvedTasks
    }
  }
}

// ============================================================================
// Orchestrator Persistence Store
// ============================================================================

export class OrchestratorStore {
  static getStorePath() {
    const dataDir = path.join(homedir(), '.flywork')
    if (!fs.existsSync(dataDir)) {
      try {
        fs.mkdirSync(dataDir, { recursive: true })
      } catch {
        // ignore
      }
    }
    return path.join(dataDir, 'orchestrator_plans.json')
  }

  static loadPlans() {
    try {
      const filePath = this.getStorePath()
      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, 'utf-8')
        return JSON.parse(raw)
      }
    } catch (err) {
      console.error('[OrchestratorStore] Load failed:', err)
    }
    return null
  }

  static savePlans(plans) {
    try {
      const filePath = this.getStorePath()
      fs.writeFileSync(filePath, JSON.stringify(plans, null, 2), 'utf-8')
      return true
    } catch (err) {
      console.error('[OrchestratorStore] Save failed:', err)
      return false
    }
  }
}

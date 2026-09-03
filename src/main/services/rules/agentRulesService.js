import fs from 'fs'
import path from 'path'

/**
 * Common AI Agent Specifications and their rule file definitions
 */
export const COMMON_AGENTS = [
  {
    id: 'cursor',
    name: 'Cursor',
    icon: '⚡',
    color: '#38bdf8',
    description: 'Cursor IDE 专用规则，支持全局 .cursorrules 与模块化 .cursor/rules/*.mdc',
    docsUrl: 'https://docs.cursor.com/context/rules-for-ai',
    ruleDefinitions: [
      {
        fileName: '.cursorrules',
        relativePath: '.cursorrules',
        isPrimary: true,
        type: 'single',
        description: 'Cursor 全局项目规则与提示词',
        defaultTemplate: `# Cursor Rules for this Project

## Project Overview
- Describe the project tech stack, architecture, and design patterns.

## Coding Standards
- Follow modern idioms and maintain consistent naming conventions.
- Prefer declarative, well-typed code with clear error handling.
- Keep components and functions small, modular, and focused.

## Prohibitions
- Do NOT modify generated files or lockfiles directly.
- Do NOT delete existing comments or documentation unless explicitly requested.
`
      },
      {
        fileName: '*.mdc',
        directory: '.cursor/rules',
        type: 'multi',
        ext: '.mdc',
        description: 'Cursor MDC 模块级规则 (含 frontmatter globs 与说明)',
        defaultTemplate: `---
description: Code Style & Architecture Guidelines
globs: **/*.{js,jsx,ts,tsx}
alwaysApply: false
---

# Code Guidelines

- Apply clean architecture principles.
- Use explicit types and write unit tests for core logic.
`
      }
    ]
  },
  {
    id: 'claude',
    name: 'Claude Code',
    icon: '🤖',
    color: '#d97706',
    description: 'Anthropic Claude Code CLI 终端与代码库交互规范',
    docsUrl: 'https://docs.anthropic.com/en/docs/agents-and-tools/claude-code/overview',
    ruleDefinitions: [
      {
        fileName: 'CLAUDE.md',
        relativePath: 'CLAUDE.md',
        isPrimary: true,
        type: 'single',
        description: 'Claude Code 根目录项目规范与常用构建/测试命令',
        defaultTemplate: `# CLAUDE.md — Claude Code Project Guidelines

## Build & Test Commands
- Build: \`npm run build\`
- Test: \`npm test\`
- Lint: \`npm run lint\`

## Code Architecture
- Describe high-level module organization and entry points.

## Code Style & Guidelines
- Follow existing patterns and code conventions.
- Always run tests and linter before declaring tasks complete.
`
      },
      {
        fileName: '*.md',
        directory: '.claude/rules',
        type: 'multi',
        ext: '.md',
        description: 'Claude 细分模块规则与开发规范',
        defaultTemplate: `# Module Rules

- Describe specific requirements for this module.
`
      }
    ]
  },
  {
    id: 'copilot',
    name: 'GitHub Copilot',
    icon: '✨',
    color: '#238636',
    description: 'GitHub Copilot 仓库级指令与 Copilot Chat 上下文规范',
    docsUrl: 'https://docs.github.com/en/copilot/customizing-copilot/adding-custom-instructions-for-github-copilot',
    ruleDefinitions: [
      {
        fileName: 'copilot-instructions.md',
        relativePath: '.github/copilot-instructions.md',
        isPrimary: true,
        type: 'single',
        description: 'GitHub Copilot 仓库级自定义指令 (VS Code 与 Copilot Chat 通用)',
        defaultTemplate: `# GitHub Copilot Custom Instructions

## Project Context
Provide context about the framework, language version, and libraries in this project.

## Conventions
- Prefer standard modern syntax and design patterns.
- Follow consistent error handling and logging guidelines.
`
      },
      {
        fileName: '*.md',
        directory: '.github/instructions',
        type: 'multi',
        ext: '.md',
        description: 'GitHub Copilot 模块化提示指令',
        defaultTemplate: `# Specific Instructions

- Outline specific patterns to apply for matching files.
`
      }
    ]
  },
  {
    id: 'agent-dir',
    name: '.agent',
    icon: '🎯',
    color: '#6366f1',
    description: '项目 .agent 目录下的智能体规范、角色指令与规则子文档',
    docsUrl: '',
    ruleDefinitions: [
      {
        fileName: 'rules.md',
        relativePath: '.agent/rules.md',
        isPrimary: true,
        type: 'single',
        description: '.agent 智能体核心规范文档',
        defaultTemplate: `# .agent 智能体规范

## 1. 智能体使命与职责
- 定义当前项目中智能体的角色分工、核心目标与工程上下文。

## 2. 工作规范与约束
- 遵循工程现有架构与模块依赖划分。
- 修改代码前后执行自动化测试，确保功能完备。
`
      },
      {
        directory: '.agent',
        type: 'recursive',
        exts: ['.md', '.mdc', '.txt', '.json', '.yaml', '.yml', '.toml', '.prompt'],
        description: '.agent 目录子文档'
      },
      {
        directory: '.agents',
        type: 'recursive',
        exts: ['.md', '.mdc', '.txt', '.json', '.yaml', '.yml', '.toml', '.prompt'],
        description: '.agents 目录子文档'
      }
    ]
  },
  {
    id: 'windsurf',
    name: 'Windsurf (Cascade)',
    icon: '🏄',
    color: '#06b6d4',
    description: 'Codeium Windsurf IDE Cascade 智能体规则',
    docsUrl: 'https://codeium.com/windsurf',
    ruleDefinitions: [
      {
        fileName: '.windsurfrules',
        relativePath: '.windsurfrules',
        isPrimary: true,
        type: 'single',
        description: 'Windsurf Cascade 全局提示词与编码规则',
        defaultTemplate: `# Windsurf Rules

- Maintain consistency with existing architecture.
- Verify changes with relevant tests before concluding.
`
      },
      {
        fileName: '*.md',
        directory: '.windsurf/rules',
        type: 'multi',
        ext: '.md',
        description: 'Windsurf 模块级规则',
        defaultTemplate: `# Windsurf Module Guidelines

- Add module rules here.
`
      }
    ]
  },
  {
    id: 'cline',
    name: 'Cline / Roo Code',
    icon: '🦾',
    color: '#f97316',
    description: 'Cline 与 Roo Code 智能体扩展规则及自定义模式',
    docsUrl: 'https://github.com/cline/cline',
    ruleDefinitions: [
      {
        fileName: '.clinerules',
        relativePath: '.clinerules',
        isPrimary: true,
        type: 'single',
        description: 'Cline 智能体根目录系统规则与安全约束',
        defaultTemplate: `# Cline Rules

## Development Workflow
- Always inspect existing code before editing.
- Do not run high-risk commands without user approval.
`
      },
      {
        fileName: '.roomodes',
        relativePath: '.roomodes',
        isPrimary: false,
        type: 'single',
        description: 'Roo Code 自定义 Agent 角色与模式配置',
        defaultTemplate: `{
  "customModes": [
    {
      "slug": "architect",
      "name": "Architect",
      "roleDefinition": "You are a software architect focusing on system design, contracts, and interfaces.",
      "groups": ["read", "browser"]
    }
  ]
}`
      },
      {
        fileName: '*.md',
        directory: '.roo/rules',
        type: 'multi',
        ext: '.md',
        description: 'Roo Code 分模块或角色规则',
        defaultTemplate: `# Roo Code Rules

- Define specific behavior guidelines.
`
      }
    ]
  },
  {
    id: 'opencode',
    name: 'OpenCode / AGENTS.md',
    icon: '🌐',
    color: '#8b5cf6',
    description: '开放通用智能体规范，符合 Linux Foundation / OpenCode 协作标准',
    docsUrl: 'https://agents.md',
    ruleDefinitions: [
      {
        fileName: 'AGENTS.md',
        relativePath: 'AGENTS.md',
        isPrimary: true,
        type: 'single',
        description: 'AGENTS.md 开放智能体通用项目规范',
        defaultTemplate: `# AGENTS.md

Welcome AI Agents! This file outlines the essential context, rules, and commands for this repository.

## Repository Overview
- Name: Project Name
- Purpose: Describe the core domain and workflow.

## Commands for Agents
- Setup: \`npm install\`
- Build: \`npm run build\`
- Test: \`npm test\`

## Rules & Constraints
- Keep all modifications scoped strictly to requested features.
- Preserve backward compatibility.
`
      }
    ]
  },
  {
    id: 'antigravity',
    name: 'Antigravity',
    icon: '🔮',
    color: '#ec4899',
    description: 'Google Antigravity 智能体项目规则、Skills 与开发规范',
    docsUrl: 'https://antigravity.google',
    ruleDefinitions: [
      {
        fileName: '*.md',
        directory: '.gemini/rules',
        type: 'multi',
        ext: '.md',
        description: 'Antigravity / Gemini 规则配置',
        defaultTemplate: `# Antigravity Rules

- Adhere to planning mode for complex architectural tasks.
- Verify changes with automated tests.
`
      },
      {
        fileName: '*.md',
        directory: '.antigravity/rules',
        type: 'multi',
        ext: '.md',
        description: 'Antigravity 自定义智能体规则与约束',
        defaultTemplate: `# Antigravity Rule

- Focus on clean architecture and high test coverage.
`
      }
    ]
  },
  {
    id: 'aider',
    name: 'Aider',
    icon: '🛠️',
    color: '#10b981',
    description: 'Aider AI 配对编程命令行工具编码规范与提示',
    docsUrl: 'https://aider.chat',
    ruleDefinitions: [
      {
        fileName: 'CONVENTIONS.md',
        relativePath: 'CONVENTIONS.md',
        isPrimary: true,
        type: 'single',
        description: 'Aider 代码约定与 Git 提交规范',
        defaultTemplate: `# Project Conventions

## Style & Patterns
- Keep code clean, readable, and functional.
- Adhere to idiomatic practices for this stack.

## Commit Guidelines
- Use conventional commits format (feat, fix, docs, refactor, test).
`
      },
      {
        fileName: '.aider.conf.yml',
        relativePath: '.aider.conf.yml',
        isPrimary: false,
        type: 'single',
        description: 'Aider 运行时配置与参数',
        defaultTemplate: `auto-commits: true
attribute-author: false
`
      },
      {
        fileName: '.aider.prompt.md',
        relativePath: '.aider.prompt.md',
        isPrimary: false,
        type: 'single',
        description: 'Aider 自定义系统 Prompt',
        defaultTemplate: `# Aider Custom System Prompt

You are an expert pair programmer helping develop this project.
`
      }
    ]
  },
  {
    id: 'trae',
    name: 'TRAE',
    icon: '🚀',
    color: '#6366f1',
    description: 'ByteDance TRAE AI 原生 IDE 智能体规则',
    docsUrl: 'https://www.trae.ai',
    ruleDefinitions: [
      {
        fileName: 'rules',
        relativePath: '.trae/rules',
        isPrimary: true,
        type: 'single',
        description: 'TRAE IDE 提示词与规范总则',
        defaultTemplate: `# TRAE Project Rules

- Follow project conventions and architectural boundaries.
- Document any new APIs and state management hooks.
`
      },
      {
        fileName: '*.md',
        directory: '.trae/rules',
        type: 'multi',
        ext: '.md',
        description: 'TRAE 细化规则',
        defaultTemplate: `# TRAE Detailed Rule

- Specific rule instructions.
`
      }
    ]
  }
]

/**
 * Standard preset templates for creating new rules
 */
export const RULE_TEMPLATES = [
  {
    id: 'fullstack-general',
    name: '全栈通用工程规范 (推荐)',
    description: '包含项目架构、代码质量、Git 提交规范、测试要求及安全边界',
    content: `# AI 智能体项目工作规范

## 1. 项目概览与架构原则
- 本工程遵循模块化、高内聚低耦合的设计思想。
- 业务逻辑与 UI 表现层严格分离，禁止在视图组件中直接书写高耦合复杂逻辑。
- 保持公共方法纯函数化，副作用必须在明确的生命周期或受控服务中执行。

## 2. 编码标准与代码质量
- 严格遵循项目的统一代码格式与 Linter 规则。
- 命名清晰明了，杜绝无意义缩写（如 tmp, data1, fn）。
- 关键模块、核心接口与非显而易见的逻辑必须提供简洁清晰的注释说明。
- 优先处理异常与边界情况（空值、超时、越界、错误提示）。

## 3. Git 提交规范 (Conventional Commits)
- 提交信息必须使用标准语义前缀：
  - \`feat:\` 新功能
  - \`fix:\` 缺陷修复
  - \`refactor:\` 代码重构
  - \`docs:\` 文档变更
  - \`test:\` 测试相关
  - \`chore:\` 构建/辅助工具变动
- 提交描述需言简意赅，说明变更的动机与核心影响。

## 4. 测试与验证要求
- 新增核心业务逻辑必须包含对应的单元测试。
- 修改现有逻辑前，务必保证既有测试用例保持通过。
- 交付前执行代码构建 (\`npm run build\` 或工程对应构建命令)，确保零编译告警与错误。

## 5. 智能体行为约束
- 禁止未告知用户直接修改或删除 \`package-lock.json\`, \`pnpm-lock.yaml\` 等依赖锁定文件。
- 禁止擅自泄露敏感凭证、Token、私钥等涉密数据。
- 单次变更尽量保持小步快跑，避免无针对性的大面积改动。
`
  },
  {
    id: 'frontend-react',
    name: '前端与 React/Vue 开发规范',
    description: '针对现代前端工程、状态管理、组件拆分、样式规范与渲染性能',
    content: `# 前端开发规范与 AI 助手指导

## 1. 组件与状态管理规范
- 优先采用函数式组件与 Hooks，组件代码行数尽量控制在 250 行以内。
- 纯 UI 展示组件与容器/数据流组件分离。
- 合理使用 \`useMemo\` 与 \`useCallback\`，避免不必要的重新渲染。
- 状态提升要适度，避免深层 Props 传递，必要时使用 Context 或专用状态库。

## 2. 样式与视觉规范
- 严格使用全局设计规范中定义的 CSS 变量（颜色、间距、圆角、字号）。
- 禁止硬编码 Hex 颜色值或随意定义像素间距。
- 页面必须保持良好的响应式适配与暗黑/明亮主题兼容。

## 3. 异步交互与用户体验
- 所有异步请求与数据加载必须具备明确的 Loading 状态与骨架屏。
- 异常场景需向用户提供友好且可恢复的错误提示（Toast/Modal），禁止无感知静默失败。
- 表单操作防抖节流，避免重复提交。
`
  },
  {
    id: 'backend-api',
    name: '后端与 API 接口规范',
    description: '针对 RESTful API 设计、鉴权校验、数据库操作与日志记录',
    content: `# 后端服务与 API 开发规范

## 1. API 接口设计
- 遵循 RESTful 规范，URL 路径使用小写中划线名词复数（如 \`/api/v1/workspaces\`）。
- 响应体统一格式：\`{ code: 0, message: "ok", data: ... }\`。
- 严格进行输入参数校验，杜绝注入漏洞。

## 2. 错误处理与日志
- 统一错误拦截中间件，禁止在响应中直接暴露服务端堆栈信息给客户端。
- 记录关键业务日志（时间戳、请求 ID、操作人、核心参数、耗时）。
- 日志中对手机号、密码、Token 等敏感数据进行脱敏处理。

## 3. 性能与安全
- 数据库查询必须合理建立索引，避免全表扫描或 N+1 查询。
- 读写分离与缓存策略严格设置过期时间。
`
  },
  {
    id: 'ios-swift',
    name: 'iOS / Swift / Xcode 原生开发规范',
    description: '针对 Swift 现代语法、MVVM 架构、内存管理与 UI 渲染',
    content: `# iOS & Swift 开发规范

## 1. 架构与设计模式
- 推荐采用 MVVM / VIPER 架构，ViewController 仅负责视图绑定与页面路由。
- ViewModel 不引入 UIKit/AppKit，保证高可测试性。
- 优先采用 Swift Concurrency (\`async/await\`, \`Actor\`) 替代传统嵌套闭包。

## 2. 内存管理与安全
- 闭包中捕获 \`self\` 必须根据生命周期审慎使用 \`[weak self]\`，杜绝循环引用。
- 避免强制解包 (\`!\`)，优先使用 \`guard let\` 或 \`if let\` 优雅解包。
- 主线程 UI 更新必须使用 \`@MainActor\` 或 \`DispatchQueue.main.async\`。

## 3. 构建与资产
- 新增图片资源规范存放于 \`.xcassets\`，命名使用 camelCase 或 kebab-case。
- 避免修改无关联的 \`project.pbxproj\` 冲突区域。
`
  },
  {
    id: 'minimal',
    name: '极简规范 (Minimal)',
    description: '精简版核心指令，适合轻量级仓库与快速原型验证',
    content: `# 项目核心准则

- 保持代码简练可读，杜绝过度设计。
- 遵循现有代码风格，修改后执行必要验证。
- 保护核心文件，不随意格式化未修改的文件。
`
  }
]

/**
 * Common code snippet blocks for quick insertion into rule editors
 */
export const RULE_SNIPPETS = [
  {
    id: 'code-style',
    title: '💡 编码风格',
    content: `
### 编码风格要求
- 采用统一的代码缩进与命名约定（变量 camelCase、常量 UPPER_SNAKE_CASE）。
- 保持函数简短单一职责，单个函数不超过 50 行。
- 避免出现深层嵌套（>3层），优先采用早期返回 (early return)。
`
  },
  {
    id: 'git-standards',
    title: '🌿 Git 规范',
    content: `
### Git 提交规范
- 提交前保证通过本地语法与测试检查。
- Commit 格式：<type>(<scope>): <subject>
  - 示例：feat(auth): 支持单点登录 Token 自动续期
`
  },
  {
    id: 'testing-requirements',
    title: '🧪 测试要求',
    content: `
### 自动化测试要求
- 核心服务方法与工具函数必须配备单元测试覆盖。
- 修复缺陷时需补充回归测试用例，防止同类问题反复出现。
`
  },
  {
    id: 'security-limits',
    title: '🛡️ 安全限制',
    content: `
### 安全与权限边界
- 严禁在代码库中硬编码真实 API Key、个人访问令牌或服务器私钥。
- 所有外部用户输入均需完成清洗与合法性校验。
`
  },
  {
    id: 'restricted-files',
    title: '📁 禁止修改文件',
    content: `
### 智能体禁止修改的文件
- \`package-lock.json\`, \`pnpm-lock.yaml\`, \`yarn.lock\`
- \`.env.production\`, \`*.secret.key\`
- \`build/\`, \`dist/\`, \`out/\` 构建产物目录
`
  }
]

/**
 * Validate that a relative path is safely within workspaceRoot and cannot escape
 * @param {string} workspaceRoot
 * @param {string} relativePath
 * @returns {string} resolved absolute path
 */
export function resolveSafePath(workspaceRoot, relativePath) {
  if (!workspaceRoot || typeof workspaceRoot !== 'string') {
    throw new Error('无效的工作空间根路径')
  }
  if (!relativePath || typeof relativePath !== 'string') {
    throw new Error('无效的相对路径')
  }

  // Prevent null bytes
  if (relativePath.includes('\0') || workspaceRoot.includes('\0')) {
    throw new Error('路径包含非法字符')
  }

  // Normalize paths
  const resolvedRoot = path.resolve(workspaceRoot)
  const resolvedTarget = path.resolve(resolvedRoot, relativePath)

  // Ensure resolvedTarget is either inside or equal to resolvedRoot
  const relativeFromRoot = path.relative(resolvedRoot, resolvedTarget)
  if (relativeFromRoot.startsWith('..') || path.isAbsolute(relativeFromRoot)) {
    throw new Error('路径越界：不允许访问工作空间以外的文件')
  }

  return resolvedTarget
}

/**
 * Scan directory recursively for matching files
 * @param {string} dirFullPath
 * @param {string} baseRelativeDir
 * @param {Array<string>} [exts]
 * @returns {Array<{subRelPath: string, displayName: string, fullPath: string, size: number, mtime: Date}>}
 */
export function scanDirectoryFilesRecursively(dirFullPath, baseRelativeDir, exts = []) {
  const results = []
  if (!fs.existsSync(dirFullPath)) return results

  function traverse(currentDir, currentRel) {
    try {
      const entries = fs.readdirSync(currentDir, { withFileTypes: true })
      entries.sort((a, b) => a.name.localeCompare(b.name))

      for (const entry of entries) {
        // Skip hidden files like .DS_Store, .git (except the top directory name itself)
        if (entry.name.startsWith('.') && entry.name !== '.agent' && entry.name !== '.agents') {
          continue
        }
        const full = path.join(currentDir, entry.name)
        const rel = currentRel ? path.join(currentRel, entry.name) : entry.name

        if (entry.isDirectory()) {
          if (
            entry.name !== 'node_modules' &&
            entry.name !== '.git' &&
            entry.name !== 'out' &&
            entry.name !== 'dist'
          ) {
            traverse(full, rel)
          }
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase()
          if (!exts.length || exts.includes(ext) || exts.includes('*')) {
            try {
              const stats = fs.statSync(full)
              results.push({
                subRelPath: path.join(baseRelativeDir, rel),
                displayName: rel,
                fullPath: full,
                size: stats.size,
                mtime: stats.mtime
              })
            } catch {
              /* ignore stat error */
            }
          }
        }
      }
    } catch {
      /* ignore */
    }
  }

  traverse(dirFullPath, '')
  return results
}

/**
 * Scan a workspace directory and return all detected or eligible AI agent rules
 * @param {string} workspaceRoot
 * @returns {Promise<Object>}
 */
export async function listWorkspaceAgentRules(workspaceRoot) {
  if (!workspaceRoot || !fs.existsSync(workspaceRoot)) {
    return {
      workspaceRoot,
      exists: false,
      totalConfigured: 0,
      totalAgentsConfigured: 0,
      agents: COMMON_AGENTS.map((agent) => ({
        ...agent,
        configuredCount: 0,
        rules: []
      }))
    }
  }

  const agentsResult = []
  let totalConfigured = 0
  let totalAgentsConfigured = 0

  for (const agent of COMMON_AGENTS) {
    const rulesList = []
    let agentConfiguredCount = 0

    for (const def of agent.ruleDefinitions) {
      if (def.type === 'single') {
        const fullPath = path.join(workspaceRoot, def.relativePath)
        const exists = fs.existsSync(fullPath)
        let stats = null
        if (exists) {
          try {
            stats = fs.statSync(fullPath)
            if (stats.isFile()) {
              agentConfiguredCount++
              totalConfigured++
              rulesList.push({
                id: `${agent.id}-${def.relativePath}`,
                name: def.fileName,
                relativePath: def.relativePath,
                fullPath,
                agentId: agent.id,
                agentName: agent.name,
                exists: true,
                isPrimary: def.isPrimary,
                size: stats.size,
                updatedAt: stats.mtime.toISOString(),
                description: def.description,
                defaultTemplate: def.defaultTemplate
              })
            }
          } catch {
            /* ignore stat error */
          }
        } else {
          // File does not exist, provide as candidate to create
          rulesList.push({
            id: `${agent.id}-${def.relativePath}`,
            name: def.fileName,
            relativePath: def.relativePath,
            fullPath,
            agentId: agent.id,
            agentName: agent.name,
            exists: false,
            isPrimary: def.isPrimary,
            size: 0,
            updatedAt: null,
            description: def.description,
            defaultTemplate: def.defaultTemplate
          })
        }
      } else if ((def.type === 'multi' || def.type === 'recursive') && def.directory) {
        const dirFullPath = path.join(workspaceRoot, def.directory)
        if (fs.existsSync(dirFullPath)) {
          const exts = def.exts || (def.ext ? [def.ext] : [])
          const foundFiles = scanDirectoryFilesRecursively(dirFullPath, def.directory, exts)
          for (const item of foundFiles) {
            // Deduplicate if already added (e.g. by single definition)
            if (rulesList.some((r) => r.relativePath === item.subRelPath)) {
              continue
            }
            agentConfiguredCount++
            totalConfigured++
            rulesList.push({
              id: `${agent.id}-${item.subRelPath}`,
              name: item.displayName,
              relativePath: item.subRelPath,
              fullPath: item.fullPath,
              agentId: agent.id,
              agentName: agent.name,
              exists: true,
              isPrimary: false,
              size: item.size,
              updatedAt: item.mtime.toISOString(),
              description: `${agent.name} 子文档：${item.displayName}`,
              defaultTemplate: def.defaultTemplate
            })
          }
        }
      }
    }

    if (agentConfiguredCount > 0) {
      totalAgentsConfigured++
    }

    agentsResult.push({
      ...agent,
      configuredCount: agentConfiguredCount,
      rules: rulesList
    })
  }

  return {
    workspaceRoot,
    exists: true,
    totalConfigured,
    totalAgentsConfigured,
    agents: agentsResult,
    templates: RULE_TEMPLATES,
    snippets: RULE_SNIPPETS
  }
}

/**
 * Read the content of an agent rule file
 * @param {string} workspaceRoot
 * @param {string} relativePath
 * @returns {Promise<Object>}
 */
export async function readWorkspaceAgentRule(workspaceRoot, relativePath) {
  try {
    const fullPath = resolveSafePath(workspaceRoot, relativePath)
    if (!fs.existsSync(fullPath)) {
      return {
        success: false,
        error: `规则文件不存在：${relativePath}`,
        relativePath,
        fullPath
      }
    }

    const stats = fs.statSync(fullPath)
    if (!stats.isFile()) {
      return {
        success: false,
        error: `路径不是常规文件：${relativePath}`,
        relativePath,
        fullPath
      }
    }

    const content = fs.readFileSync(fullPath, 'utf-8')
    return {
      success: true,
      content,
      relativePath,
      fullPath,
      size: stats.size,
      updatedAt: stats.mtime.toISOString()
    }
  } catch (err) {
    return {
      success: false,
      error: err.message,
      relativePath
    }
  }
}

/**
 * Save / Write content to an agent rule file
 * @param {string} workspaceRoot
 * @param {string} relativePath
 * @param {string} content
 * @returns {Promise<Object>}
 */
export async function saveWorkspaceAgentRule(workspaceRoot, relativePath, content) {
  try {
    const fullPath = resolveSafePath(workspaceRoot, relativePath)
    const dir = path.dirname(fullPath)

    // Ensure directory exists
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }

    fs.writeFileSync(fullPath, typeof content === 'string' ? content : '', 'utf-8')
    const stats = fs.statSync(fullPath)

    return {
      success: true,
      relativePath,
      fullPath,
      size: stats.size,
      updatedAt: stats.mtime.toISOString()
    }
  } catch (err) {
    return {
      success: false,
      error: err.message,
      relativePath
    }
  }
}

/**
 * Create a new rule file in workspace with chosen template or content
 * @param {string} workspaceRoot
 * @param {string} relativePath
 * @param {string} [templateId]
 * @param {string} [customContent]
 * @returns {Promise<Object>}
 */
export async function createWorkspaceAgentRule(workspaceRoot, relativePath, templateId = '', customContent = '') {
  try {
    const fullPath = resolveSafePath(workspaceRoot, relativePath)
    if (fs.existsSync(fullPath)) {
      return {
        success: false,
        error: `规则文件已存在：${relativePath}`
      }
    }

    let initialContent = customContent
    if (!initialContent && templateId) {
      const tpl = RULE_TEMPLATES.find((t) => t.id === templateId)
      if (tpl) {
        initialContent = tpl.content
      }
    }

    if (!initialContent) {
      // Find agent default template if possible
      const fileName = path.basename(relativePath)
      for (const agent of COMMON_AGENTS) {
        const def = agent.ruleDefinitions.find(
          (d) => d.fileName === fileName || d.relativePath === relativePath
        )
        if (def && def.defaultTemplate) {
          initialContent = def.defaultTemplate
          break
        }
      }
    }

    return await saveWorkspaceAgentRule(workspaceRoot, relativePath, initialContent || '# AI Rules\n')
  } catch (err) {
    return {
      success: false,
      error: err.message,
      relativePath
    }
  }
}

/**
 * Delete a rule file safely
 * @param {string} workspaceRoot
 * @param {string} relativePath
 * @returns {Promise<Object>}
 */
export async function deleteWorkspaceAgentRule(workspaceRoot, relativePath) {
  try {
    const fullPath = resolveSafePath(workspaceRoot, relativePath)
    if (!fs.existsSync(fullPath)) {
      return {
        success: false,
        error: `文件不存在：${relativePath}`
      }
    }

    fs.unlinkSync(fullPath)
    return {
      success: true,
      relativePath,
      fullPath
    }
  } catch (err) {
    return {
      success: false,
      error: err.message,
      relativePath
    }
  }
}

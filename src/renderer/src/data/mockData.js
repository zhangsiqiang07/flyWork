// flyWork Mock Data
// All the simulated data for the application

export const WORKSPACES = [
  {
    id: 'petpal-ios',
    name: 'PetPal iOS',
    icon: '🐾',
    color: '#4f9ef8',
    bgColor: 'rgba(79,158,248,0.15)',
    root: '/Users/dimoo/Desktop/works/PetPal',
    description: 'iOS 宠物社交平台',
    gitBranch: 'fix/tabbar-video',
    gitModifiedFiles: [
      { path: 'PetPal/Views/VideoTab/VideoTabViewController.swift', status: 'M' },
      { path: 'PetPal/Views/Main/TabBarController.swift', status: 'M' },
      { path: 'PetPal/Utils/UIExtensions.swift', status: 'M' },
      { path: 'PetPal/Resources/Assets.xcassets/TabBar.imageset/Contents.json', status: 'M' },
      { path: 'PetPal/Models/TabItem.swift', status: 'A' }
    ],
    lastCommit: 'fix: 修复视频页 TabBar 闪烁动画时序问题',
    lastCommitHash: 'a3f7c21',
    lastCommitTime: '2小时前',
    buildStatus: 'failed',
    buildMessage: 'report.xml 阻塞 checkout 步骤',
    buildDuration: '4分21秒',
    buildTime: '38分钟前',
    services: [],
    integrations: {
      jenkins: 'iOS/PetPal-iOS',
      github: 'company/PetPal',
      testflight: 'Build 142'
    },
    recentSessions: ['session-001'],
    actions: [
      { id: 'open-xcode', name: '打开 Xcode', risk: 'readonly', icon: '⚙️' },
      { id: 'git-pull', name: '同步远程代码', risk: 'modify', icon: '⬇️' },
      { id: 'git-status', name: '查看 Git 状态', risk: 'readonly', icon: '📊' },
      { id: 'run-tests', name: '运行单元测试', risk: 'normal', icon: '🧪' },
      { id: 'open-terminal', name: '打开终端', risk: 'readonly', icon: '💻' }
    ],
    tags: ['iOS', 'Swift', 'Xcode'],
    docPath: '/Users/dimoo/KnowledgeOS/03_Projects/PetPal'
  },
  {
    id: 'knowledge-os',
    name: 'KnowledgeOS',
    icon: '🧠',
    color: '#a371f7',
    bgColor: 'rgba(163,113,247,0.15)',
    root: '/Users/dimoo/KnowledgeOS',
    description: '个人知识管理系统',
    gitBranch: 'main',
    gitModifiedFiles: [
      { path: '00_Inbox/2026-08-04-liquid-glass.md', status: 'A' },
      { path: '02_Domains/iOS/TabBar-patterns.md', status: 'M' }
    ],
    lastCommit: 'docs: 添加 Liquid Glass TabBar 研究笔记',
    lastCommitHash: 'b9e2d45',
    lastCommitTime: '1天前',
    buildStatus: 'success',
    buildMessage: '最近同步成功',
    buildTime: '1小时前',
    services: [
      { name: 'Obsidian Sync', status: 'online' }
    ],
    integrations: {
      obsidian: 'KnowledgeOS'
    },
    recentSessions: ['session-003'],
    actions: [
      { id: 'open-finder', name: '打开 Finder', risk: 'readonly', icon: '📁' },
      { id: 'git-pull', name: '同步 Obsidian', risk: 'modify', icon: '🔄' },
      { id: 'git-status', name: '查看变更', risk: 'readonly', icon: '📊' }
    ],
    tags: ['Knowledge', 'Obsidian', 'Markdown'],
    docPath: '/Users/dimoo/KnowledgeOS'
  },
  {
    id: 'bug-sdk',
    name: 'Bug 上报 SDK',
    icon: '🐛',
    color: '#e05c5c',
    bgColor: 'rgba(224,92,92,0.15)',
    root: '/Users/dimoo/Projects/BugSDK',
    description: 'iOS / Android 崩溃上报 SDK',
    gitBranch: 'feature/realtime-logs',
    gitModifiedFiles: [
      { path: 'Sources/BugSDK/Collector.swift', status: 'M' },
      { path: 'Sources/BugSDK/NetworkLayer.swift', status: 'M' },
      { path: 'Tests/CollectorTests.swift', status: 'A' }
    ],
    lastCommit: 'feat: 实现实时日志收集功能',
    lastCommitHash: 'c4a8f93',
    lastCommitTime: '3天前',
    buildStatus: 'success',
    buildMessage: 'CI 构建成功',
    buildTime: '3天前',
    services: [],
    integrations: {
      github: 'company/BugSDK'
    },
    recentSessions: [],
    actions: [
      { id: 'open-xcode', name: '打开 Xcode', risk: 'readonly', icon: '⚙️' },
      { id: 'run-tests', name: '运行测试', risk: 'normal', icon: '🧪' },
      { id: 'git-status', name: 'Git 状态', risk: 'readonly', icon: '📊' }
    ],
    tags: ['SDK', 'Swift', 'SPM'],
    docPath: '/Users/dimoo/Projects/BugSDK/Docs'
  },
  {
    id: 'server-infra',
    name: '服务器与自动化',
    icon: '🖥️',
    color: '#26c6da',
    bgColor: 'rgba(38,198,218,0.12)',
    root: '/Users/dimoo/Projects/Infra',
    description: 'VPS + Docker + Nginx 运维',
    gitBranch: 'main',
    gitModifiedFiles: [],
    lastCommit: 'chore: 更新 Nginx SSL 证书续期脚本',
    lastCommitHash: 'e7b1c82',
    lastCommitTime: '1周前',
    buildStatus: 'success',
    buildMessage: '所有服务运行正常',
    buildTime: '5分钟前',
    services: [
      { name: 'Nginx', status: 'online' },
      { name: 'Docker', status: 'online' },
      { name: 'Redis', status: 'online' },
      { name: 'MySQL', status: 'online' }
    ],
    integrations: {},
    recentSessions: ['session-002'],
    actions: [
      { id: 'open-terminal', name: '打开终端', risk: 'readonly', icon: '💻' },
      { id: 'git-status', name: '查看变更', risk: 'readonly', icon: '📊' }
    ],
    tags: ['Docker', 'Nginx', 'DevOps'],
    docPath: '/Users/dimoo/Projects/Infra/Docs'
  }
]

export const SESSIONS = [
  {
    id: 'session-001',
    workspaceId: 'petpal-ios',
    title: '修复视频页 TabBar 闪烁问题',
    status: 'active',
    branch: 'fix/tabbar-video',
    startedAt: '2026-08-04T09:00:00+08:00',
    updatedAt: '2026-08-04T11:20:00+08:00',
    notes: '已定位到 UITabBarController 的 viewWillAppear 中强制刷新动画的问题，正在验证修复方案',
    resources: [
      { type: 'xcode', name: 'PetPal.xcworkspace', path: '/Users/dimoo/Projects/PetPal/PetPal.xcworkspace' },
      { type: 'doc', name: 'TabBar 技术调研', url: 'https://developer.apple.com/documentation/uikit/uitabbarcontroller' },
      { type: 'url', name: 'Stack Overflow - TabBar flash fix', url: 'https://stackoverflow.com/questions/tabbar-flash' }
    ],
    aiTasks: [
      { id: 'ai-001', title: '分析 TabBar 闪烁根因', status: 'done', agent: 'Claude Code' }
    ]
  },
  {
    id: 'session-002',
    workspaceId: 'server-infra',
    title: '配置 Docker Compose 服务编排',
    status: 'paused',
    branch: 'main',
    startedAt: '2026-08-03T14:00:00+08:00',
    updatedAt: '2026-08-03T18:30:00+08:00',
    notes: 'Docker Compose 文件已配置完成，需要测试服务间通信',
    resources: [
      { type: 'terminal', name: 'Server Terminal', path: '/Users/dimoo/Projects/Infra' }
    ],
    aiTasks: []
  },
  {
    id: 'session-003',
    workspaceId: 'knowledge-os',
    title: '整理 Liquid Glass UI 研究资料',
    status: 'paused',
    branch: 'main',
    startedAt: '2026-08-04T08:00:00+08:00',
    updatedAt: '2026-08-04T08:45:00+08:00',
    notes: '已收集了 WWDC 2025 相关资料，需要整理成技术笔记',
    resources: [
      { type: 'url', name: 'WWDC 2025 Liquid Glass', url: 'https://developer.apple.com/wwdc25/' }
    ],
    aiTasks: []
  }
]

export const INBOX_ITEMS = [
  {
    id: 'inbox-001',
    type: 'url',
    title: 'iOS 18 Liquid Glass TabBar 最佳实践',
    preview: 'Apple 设计团队分享的 Liquid Glass 在 TabBar 中的实现细节，包括动画时序和边界处理...',
    source: 'https://developer.apple.com',
    createdAt: '2026-08-04T10:15:00+08:00',
    workspaceId: 'petpal-ios',
    tags: ['iOS', 'UIKit', 'Design']
  },
  {
    id: 'inbox-002',
    type: 'note',
    title: '想法：flyWork 命令中心支持自然语言解析',
    preview: '可以用正则 + 语义映射的方式支持 "打开PetPal" "继续昨天的任务" 这类自然语言命令...',
    source: 'quick-capture',
    createdAt: '2026-08-04T09:30:00+08:00',
    workspaceId: null,
    tags: ['flyWork', '产品想法']
  },
  {
    id: 'inbox-003',
    type: 'bug',
    title: 'Bug: Jenkins checkout 被 report.xml 阻塞',
    preview: 'Jenkins 日志显示 checkout 步骤因为工作目录中存在 report.xml 而失败，需要在 Jenkinsfile 中清理...',
    source: 'manual',
    createdAt: '2026-08-04T08:00:00+08:00',
    workspaceId: 'petpal-ios',
    tags: ['Jenkins', 'CI/CD', 'Bug']
  },
  {
    id: 'inbox-004',
    type: 'clip',
    title: '剪贴板：Docker Compose 网络配置片段',
    preview: 'networks:\n  app-network:\n    driver: bridge\n    ipam:\n      config:\n        - subnet: 172.20.0.0/16',
    source: 'clipboard',
    createdAt: '2026-08-04T07:45:00+08:00',
    workspaceId: 'server-infra',
    tags: ['Docker', 'Network']
  },
  {
    id: 'inbox-005',
    type: 'file',
    title: 'TestFlight_build142_release_notes.md',
    preview: '版本 2.3.0 (142) 更新内容：修复视频播放卡顿问题，优化 TabBar 切换动画...',
    source: 'file',
    createdAt: '2026-08-03T20:00:00+08:00',
    workspaceId: 'petpal-ios',
    tags: ['TestFlight', 'Release']
  }
]

export const ACTIVITY_LOG = [
  {
    id: 'act-001',
    type: 'git',
    title: 'Git Commit',
    detail: 'fix: 修复视频页 TabBar 闪烁动画时序问题',
    workspaceId: 'petpal-ios',
    timestamp: '2026-08-04T11:20:00+08:00',
    meta: { hash: 'a3f7c21', files: 5 },
    icon: '📝',
    color: 'var(--accent-blue)'
  },
  {
    id: 'act-002',
    type: 'ai',
    title: 'AI 任务完成',
    detail: 'Claude Code 分析了 TabBar 闪烁根因，提供了 3 种修复方案',
    workspaceId: 'petpal-ios',
    timestamp: '2026-08-04T10:45:00+08:00',
    meta: { agent: 'Claude Code', model: 'claude-sonnet-4' },
    icon: '🤖',
    color: 'var(--accent-purple)'
  },
  {
    id: 'act-003',
    type: 'build',
    title: '构建失败',
    detail: 'Jenkins PetPal-iOS - report.xml 阻塞 checkout 步骤',
    workspaceId: 'petpal-ios',
    timestamp: '2026-08-04T10:00:00+08:00',
    meta: { duration: '4分21秒', job: 'iOS/PetPal-iOS' },
    icon: '❌',
    color: 'var(--accent-red)'
  },
  {
    id: 'act-004',
    type: 'action',
    title: '执行动作',
    detail: '同步远程代码 (git pull --rebase) - 成功',
    workspaceId: 'petpal-ios',
    timestamp: '2026-08-04T09:05:00+08:00',
    meta: { actionId: 'git-pull', exitCode: 0 },
    icon: '⬇️',
    color: 'var(--accent-green)'
  },
  {
    id: 'act-005',
    type: 'session',
    title: '开始工作会话',
    detail: '修复视频页 TabBar 闪烁问题 · PetPal iOS',
    workspaceId: 'petpal-ios',
    timestamp: '2026-08-04T09:00:00+08:00',
    meta: { branch: 'fix/tabbar-video' },
    icon: '▶️',
    color: 'var(--accent-green)'
  },
  {
    id: 'act-006',
    type: 'inbox',
    title: '收件箱收录',
    detail: 'iOS 18 Liquid Glass TabBar 最佳实践 文章',
    workspaceId: 'knowledge-os',
    timestamp: '2026-08-04T08:30:00+08:00',
    meta: { type: 'url' },
    icon: '📥',
    color: 'var(--accent-amber)'
  },
  {
    id: 'act-007',
    type: 'build',
    title: '构建成功',
    detail: 'KnowledgeOS Obsidian Sync - 同步完成 (42个文件)',
    workspaceId: 'knowledge-os',
    timestamp: '2026-08-04T08:00:00+08:00',
    meta: { files: 42 },
    icon: '✅',
    color: 'var(--accent-green)'
  },
  {
    id: 'act-008',
    type: 'git',
    title: 'Git Commit',
    detail: 'docs: 添加 Liquid Glass TabBar 研究笔记',
    workspaceId: 'knowledge-os',
    timestamp: '2026-08-03T18:00:00+08:00',
    meta: { hash: 'b9e2d45', files: 2 },
    icon: '📝',
    color: 'var(--accent-blue)'
  }
]

export const AUTOMATIONS = [
  {
    id: 'auto-001',
    name: 'PetPal 自动化打包构建',
    workspaceId: 'petpal-ios',
    description: '读取 packaging 目录配置，注入环境变量与内置 Git 动态参数执行自动化构建',
    lastRun: '2026-08-01T14:00:00+08:00',
    lastStatus: 'success',
    env: {
      BUILD_ENV: 'dev',
      SCHEME: 'PetPal',
      INSTALL_PODS: '1'
    },
    steps: [
      { id: 's1', name: '检查工作区 Git 状态与分支', command: 'echo "Branch: $GIT_BRANCH, Commit: $GIT_SHORT_SHA ($GIT_COMMIT_MSG)"', risk: 'readonly', status: 'complete' },
      { id: 's2', name: '同步远程代码', command: 'git pull origin $GIT_BRANCH --rebase', risk: 'modify', status: 'pending' },
      { id: 's3', name: '执行 Packaging 构建脚本', command: './packaging/build.sh --env $BUILD_ENV --scheme $SCHEME', risk: 'high', status: 'pending' }
    ]
  },
  {
    id: 'auto-002',
    name: 'KnowledgeOS 全量同步',
    workspaceId: 'knowledge-os',
    description: '整理 Inbox、AI 分类、提交并同步到 Obsidian',
    lastRun: '2026-08-04T08:00:00+08:00',
    lastStatus: 'success',
    env: {
      SYNC_BRANCH: 'main'
    },
    steps: [
      { id: 's1', name: '扫描 Inbox 新文件', command: 'find 00_Inbox -newer .last_sync', risk: 'readonly', status: 'complete' },
      { id: 's2', name: 'AI 分类建议', command: 'flywork ai classify --inbox', risk: 'normal', status: 'complete' },
      { id: 's3', name: '提交变更', command: 'git add -A && git commit -m "sync: $GIT_AUTHOR on $GIT_BRANCH ($BUILD_DATE)"', risk: 'modify', status: 'pending' },
      { id: 's4', name: '推送到远程', command: 'git push origin $SYNC_BRANCH', risk: 'modify', status: 'pending' }
    ]
  },
  {
    id: 'auto-003',
    name: '服务器健康检查',
    workspaceId: 'server-infra',
    description: '检查所有 Docker 服务状态和 SSL 证书有效期',
    lastRun: '2026-08-04T11:00:00+08:00',
    lastStatus: 'success',
    env: {},
    steps: [
      { id: 's1', name: '检查 Docker 容器', command: 'docker ps --format table', risk: 'readonly', status: 'complete' },
      { id: 's2', name: '检查 Nginx 状态', command: 'nginx -t && systemctl status nginx', risk: 'readonly', status: 'complete' },
      { id: 's3', name: '检查 SSL 证书', command: 'certbot certificates', risk: 'readonly', status: 'complete' },
      { id: 's4', name: '检查磁盘空间', command: 'df -h', risk: 'readonly', status: 'complete' }
    ]
  }
]

export const AGENTS = [
  { id: 'opencode', name: 'OpenCode', role: '编码主控', icon: '⚡', color: 'var(--accent-blue)' },
  { id: 'claude-code', name: 'Claude Code', role: '代码审查 / CI 分析', icon: '🧠', color: 'var(--accent-purple)' },
  { id: 'codex', name: 'Codex', role: '复杂实现 / 测试', icon: '🔬', color: 'var(--accent-teal)' },
  { id: 'deepseek', name: 'DeepSeek', role: '文档整理', icon: '📚', color: 'var(--accent-amber)' },
  { id: 'chatgpt', name: 'ChatGPT', role: '需求分析', icon: '💬', color: 'var(--accent-green)' }
]

export const COMMAND_SUGGESTIONS = [
  { type: 'navigation', label: '打开 PetPal iOS', icon: '🐾', action: 'navigate:petpal-ios' },
  { type: 'navigation', label: '打开 KnowledgeOS', icon: '🧠', action: 'navigate:knowledge-os' },
  { type: 'session', label: '继续 TabBar 修复会话', icon: '▶️', action: 'resume-session:session-001' },
  { type: 'action', label: '查看 Jenkins 失败日志', icon: '🔍', action: 'action:view-jenkins-log', risk: 'readonly' },
  { type: 'ai', label: '分析 Jenkins 构建失败', icon: '🤖', action: 'ai:analyze-jenkins', agent: 'Claude Code' },
  { type: 'ai', label: '生成当前 Git Commit 信息', icon: '✍️', action: 'ai:generate-commit', agent: 'Claude Code' },
  { type: 'action', label: '同步 PetPal 远程代码', icon: '⬇️', action: 'action:git-pull', risk: 'modify' },
  { type: 'inbox', label: '保存剪贴板到 Inbox', icon: '📥', action: 'inbox:clipboard' },
  { type: 'navigation', label: '查看今日活动', icon: '📅', action: 'navigate:today' },
  { type: 'navigation', label: '打开自动化管理', icon: '⚙️', action: 'navigate:automations' }
]

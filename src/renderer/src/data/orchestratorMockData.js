// ============================================================================
// 1. Plan 1 (Default Demo PRD): 宠物健康报告与应激分析系统优化
// ============================================================================
export const DEMO_HEALTH_PLAN = {
  id: 'PLAN-HEALTH-2026',
  title: '宠物健康报告与应激分析系统优化',
  version: 'v2.4',
  status: 'IN_PROGRESS', // PLANNING | IN_PROGRESS | DONE
  isDemo: true,
  leadPm: 'Sarah (Lead PM)',
  techLead: 'Alex (Architect)',
  updatedAt: '2026-09-01 15:30',
  description: '重构宠物健康历史评测报告模块，支持应激趋势图表、离线缓存、多端统一数据模型与 API 响应流。',
  requirement: {
    id: 'REQ-2026-003',
    title: '宠物健康报告与应激分析系统优化 PRD',
    version: 'v2.4',
    author: 'Sarah (Lead PM)',
    updatedAt: '2026-09-01',
    status: 'ACTIVE',
    prdSnippet: `## 3.2 历史报告列表与应激分析
1. 列表页支持分页拉取（20条/页），支持下拉刷新重置与本地离线缓存展示。
2. 状态机规范：.idle / .loading / .loaded(items) / .empty / .error(msg)。
3. 提供重试闭包与全局错误码映射机制。
4. 详情页支持应激等级趋势图与可视化风险标签卡片。`
  },
  projects: [
    {
      id: 'PetPal-iOS',
      name: 'PetPal iOS Client',
      platform: 'iOS (Swift/SwiftUI/Combine)',
      rules: ['rules/ios-guidelines.md', 'rules/combine-mvvm.md'],
      skills: ['ios-mvvm', 'ios-pagination', 'swiftui-layout']
    },
    {
      id: 'PetPal-Android',
      name: 'PetPal Android Client',
      platform: 'Android (Kotlin/Jetpack Compose)',
      rules: ['rules/android-architecture.md'],
      skills: ['kotlin-coroutines', 'compose-ui']
    },
    {
      id: 'PetPal-Backend',
      name: 'PetPal Core Java Service',
      platform: 'Java (Spring Boot / MySQL)',
      rules: ['rules/spring-standards.md', 'rules/rest-api.md'],
      skills: ['spring-boot', 'mybatis-plus', 'redis-cache']
    }
  ],
  tasks: [
    // ------------------------------------------------------------------------
    // iOS Project Tasks
    // ------------------------------------------------------------------------
    {
      id: 'IOS-REP-101',
      title: 'Define PetHealthReport Domain Models',
      project: 'PetPal-iOS',
      feature: 'HealthReport',
      page_or_domain: 'ReportDomain',
      layer: 'domain',
      type: 'implementation',
      complexity: 'medium',
      risk: 'low',
      status: 'DONE',
      dependencies: [],
      sources: {
        prd: { section_id: 'sec-1.1', title: '领域模型设计' }
      },
      files: {
        expected: ['PetPal/Domain/Models/PetHealthReport.swift'],
        changed: ['PetPal/Domain/Models/PetHealthReport.swift']
      },
      acceptance_criteria: ['严格不可变模型', '实现 Equatable 与 Identifiable', '支持 stressScore 风险等级枚举'],
      execution: {
        mode: 'assisted',
        recommended: { agent_id: 'chatgpt', score: 96, reason: '领域契约抽象与不可变数据建模' },
        selected: { agent_id: 'chatgpt' }
      }
    },
    {
      id: 'IOS-REP-102',
      title: 'Create Report Local Repository & SQLite Cache',
      project: 'PetPal-iOS',
      feature: 'HealthReport',
      page_or_domain: 'ReportData',
      layer: 'data',
      type: 'implementation',
      complexity: 'medium',
      risk: 'low',
      status: 'DONE',
      dependencies: ['IOS-REP-101'],
      sources: {
        prd: { section_id: 'sec-2.1', title: '本地缓存策略' }
      },
      files: {
        expected: ['PetPal/Data/Repositories/ReportRepository.swift'],
        changed: ['PetPal/Data/Repositories/ReportRepository.swift']
      },
      acceptance_criteria: ['内存与 SQLite 二级缓存', '支持无网离线读取', '线程安全并发读写'],
      execution: {
        mode: 'assisted',
        recommended: { agent_id: 'antigravity', score: 95, reason: '本地持久化存储与仓储层重构' },
        selected: { agent_id: 'antigravity' }
      }
    },
    {
      id: 'IOS-REP-103',
      title: 'Implement Remote API Client for Health Reports',
      project: 'PetPal-iOS',
      feature: 'HealthReport',
      page_or_domain: 'NetworkService',
      layer: 'data',
      type: 'api-mapping',
      complexity: 'medium',
      risk: 'medium',
      status: 'DONE',
      dependencies: ['IOS-REP-101'],
      sources: {
        prd: { section_id: 'sec-2.2', title: 'API 通信规范' },
        api: { operation_id: 'getPetHealthReportList', status: 'ready', endpoint: '/api/v2/pet/health/reports' }
      },
      files: {
        expected: ['PetPal/Network/Services/HealthReportApiService.swift'],
        changed: ['PetPal/Network/Services/HealthReportApiService.swift']
      },
      acceptance_criteria: ['基于 Combine 的 Publisher 封装', '超时 10s 自动重试 2 次', '业务错误码解析'],
      execution: {
        mode: 'assisted',
        recommended: { agent_id: 'antigravity', score: 94, reason: '网络契约与异步 API 接入' },
        selected: { agent_id: 'antigravity' }
      }
    },
    {
      id: 'IOS-REP-104',
      title: 'Implement ReportListViewModel with ViewState',
      project: 'PetPal-iOS',
      feature: 'HealthReport',
      page_or_domain: 'ReportList',
      layer: 'state',
      type: 'implementation',
      complexity: 'medium',
      risk: 'low',
      status: 'READY',
      dependencies: ['IOS-REP-102', 'IOS-REP-103'],
      sources: {
        prd: { section_id: 'sec-3.2', title: '报告列表分页与状态流' },
        api: { operation_id: 'getPetHealthReportList', status: 'ready' }
      },
      files: {
        expected: ['PetPal/Features/Report/ViewModels/ReportListViewModel.swift']
      },
      acceptance_criteria: [
        '支持分页拉取（每页 20 条），处理下拉刷新重置逻辑',
        '维护 ViewState: .idle / .loading / .loaded(items) / .empty / .error(msg)',
        '暴露 retry 闭包并向 View 广播错误提示'
      ],
      execution: {
        mode: 'assisted',
        recommended: {
          agent_id: 'antigravity',
          score: 95,
          reason: '擅长 iOS MVVM 状态流实现及多文件工程协同，匹配 ios-mvvm skill'
        },
        selected: { agent_id: 'antigravity' }
      }
    },
    {
      id: 'IOS-REP-105',
      title: 'Build Report List Page Skeleton & Placeholder',
      project: 'PetPal-iOS',
      feature: 'HealthReport',
      page_or_domain: 'ReportList',
      layer: 'ui',
      type: 'ui-skeleton',
      complexity: 'low',
      risk: 'low',
      status: 'READY',
      dependencies: [],
      sources: {
        prd: { section_id: 'sec-4.1', title: '列表容器骨架' }
      },
      files: {
        expected: ['PetPal/Features/Report/Views/ReportListSkeletonView.swift']
      },
      acceptance_criteria: ['SwiftUI 列表容器骨架', '骨架屏渐变 Shimmer 动效', '空状态与断网占位图'],
      execution: {
        mode: 'assisted',
        recommended: { agent_id: 'trae', score: 92, reason: '快速生成 SwiftUI 布局骨架与占位组件' },
        selected: { agent_id: 'trae' }
      }
    },
    {
      id: 'IOS-REP-106',
      title: 'Implement Visual Report Card Cell',
      project: 'PetPal-iOS',
      feature: 'HealthReport',
      page_or_domain: 'ReportList',
      layer: 'ui',
      type: 'ui-visual',
      complexity: 'medium',
      risk: 'low',
      status: 'WAITING_DESIGN',
      dependencies: ['IOS-REP-105'],
      sources: {
        design: { figma_file: 'figma://file/petpal-v2?node-id=302', frame_id: 'ReportCardItem', status: 'pending' }
      },
      files: {
        expected: ['PetPal/Features/Report/Views/ReportCardCell.swift']
      },
      acceptance_criteria: ['还原 Figma 渐变边框与阴影', '支持应激指数彩色气泡', '暗黑模式高对比度适配'],
      execution: {
        mode: 'assisted',
        recommended: { agent_id: 'antigravity', score: 94, reason: '结合设计稿标注进行像素级 UI 编码' },
        selected: { agent_id: 'antigravity' }
      }
    },
    {
      id: 'IOS-REP-107',
      title: 'Integrate Report List View with ViewModel',
      project: 'PetPal-iOS',
      feature: 'HealthReport',
      page_or_domain: 'ReportList',
      layer: 'integration',
      type: 'integration',
      complexity: 'medium',
      risk: 'medium',
      status: 'BLOCKED',
      dependencies: ['IOS-REP-104', 'IOS-REP-106'],
      sources: {
        prd: { section_id: 'sec-5.1', title: '页面装配' }
      },
      files: {
        expected: ['PetPal/Features/Report/Views/ReportListViewController.swift']
      },
      acceptance_criteria: ['双向数据绑定与生命周期钩子', '路由跳转到详情页', '埋点数据打点上报'],
      execution: {
        mode: 'assisted',
        recommended: { agent_id: 'antigravity', score: 93, reason: '跨模块装配集成与视图绑定' },
        selected: { agent_id: 'antigravity' }
      }
    },
    {
      id: 'IOS-REP-108',
      title: 'Unit Tests for Report ViewModel & Repository',
      project: 'PetPal-iOS',
      feature: 'HealthReport',
      page_or_domain: 'ReportList',
      layer: 'test',
      type: 'test',
      complexity: 'medium',
      risk: 'low',
      status: 'BLOCKED',
      dependencies: ['IOS-REP-107'],
      sources: {
        prd: { section_id: 'sec-6.1', title: '测试用例' }
      },
      files: {
        expected: ['PetPalTests/Features/Report/ReportListViewModelTests.swift']
      },
      acceptance_criteria: ['单测分支覆盖率 > 85%', 'Mock 网络延迟与异常抛出用例', '内存释放无循环引用验证'],
      execution: {
        mode: 'assisted',
        recommended: { agent_id: 'claude-code', score: 95, reason: '测试用例编写与边缘异常分析' },
        selected: { agent_id: 'claude-code' }
      }
    },

    // ------------------------------------------------------------------------
    // Java Backend Project Tasks
    // ------------------------------------------------------------------------
    {
      id: 'BE-REP-201',
      title: 'Design MySQL Health Report Schema & Indices',
      project: 'PetPal-Backend',
      feature: 'HealthReport',
      page_or_domain: 'Database',
      layer: 'data',
      type: 'implementation',
      complexity: 'medium',
      risk: 'medium',
      status: 'DONE',
      dependencies: [],
      sources: {
        prd: { section_id: 'sec-db-1', title: '数据库表设计' }
      },
      files: {
        expected: ['src/main/resources/db/migration/V20260901__pet_health_report.sql'],
        changed: ['src/main/resources/db/migration/V20260901__pet_health_report.sql']
      },
      acceptance_criteria: ['支持 pet_id 联合时间索引', '分表准备与软删除支持', 'DDL 幂等性执行'],
      execution: {
        mode: 'assisted',
        recommended: { agent_id: 'chatgpt', score: 94, reason: '数据库架构设计与索引规范' },
        selected: { agent_id: 'chatgpt' }
      }
    },
    {
      id: 'BE-REP-202',
      title: 'Implement Health Report Service & Redis Cache',
      project: 'PetPal-Backend',
      feature: 'HealthReport',
      page_or_domain: 'ReportService',
      layer: 'domain',
      type: 'implementation',
      complexity: 'medium',
      risk: 'low',
      status: 'READY',
      dependencies: ['BE-REP-201'],
      sources: {
        prd: { section_id: 'sec-srv-1', title: '后端核心服务' }
      },
      files: {
        expected: ['src/main/java/com/petpal/service/HealthReportService.java']
      },
      acceptance_criteria: ['Redis 5 分钟热点缓存防击穿', '分页查询高效游标支持', '事务一致性保证'],
      execution: {
        mode: 'assisted',
        recommended: { agent_id: 'antigravity', score: 95, reason: '后端服务逻辑与缓存层构建' },
        selected: { agent_id: 'antigravity' }
      }
    },
    {
      id: 'BE-REP-203',
      title: 'Expose RESTful API & Swagger Annotation',
      project: 'PetPal-Backend',
      feature: 'HealthReport',
      page_or_domain: 'ReportApi',
      layer: 'data',
      type: 'api-mapping',
      complexity: 'low',
      risk: 'low',
      status: 'BLOCKED',
      dependencies: ['BE-REP-202'],
      sources: {
        prd: { section_id: 'sec-api-1', title: 'REST 接口契约' }
      },
      files: {
        expected: ['src/main/java/com/petpal/controller/HealthReportController.java']
      },
      acceptance_criteria: ['OpenAPI 3.0 注解完备', '统一 ResultWrapper 响应封装', '参数合法性校验'],
      execution: {
        mode: 'assisted',
        recommended: { agent_id: 'workbuddy', score: 91, reason: 'REST Controller 与 API 契约生成' },
        selected: { agent_id: 'workbuddy' }
      }
    },
    {
      id: 'BE-REP-204',
      title: 'Backend Integration & Concurrency Test',
      project: 'PetPal-Backend',
      feature: 'HealthReport',
      page_or_domain: 'Verification',
      layer: 'test',
      type: 'test',
      complexity: 'high',
      risk: 'medium',
      status: 'BLOCKED',
      dependencies: ['BE-REP-203'],
      sources: {
        prd: { section_id: 'sec-perf-1', title: '高并发压测' }
      },
      files: {
        expected: ['src/test/java/com/petpal/service/HealthReportConcurrencyTest.java']
      },
      acceptance_criteria: ['并发 500 QPS 压测 RT < 50ms', '缓存穿透异常用例验证'],
      execution: {
        mode: 'assisted',
        recommended: { agent_id: 'claude-code', score: 94, reason: '压测与健壮性用例编写' },
        selected: { agent_id: 'claude-code' }
      }
    },

    // ------------------------------------------------------------------------
    // Android Project Tasks
    // ------------------------------------------------------------------------
    {
      id: 'AND-REP-301',
      title: 'Define Kotlin Data Models for Health Report',
      project: 'PetPal-Android',
      feature: 'HealthReport',
      page_or_domain: 'DomainModel',
      layer: 'domain',
      type: 'implementation',
      complexity: 'low',
      risk: 'low',
      status: 'READY',
      dependencies: [],
      sources: {
        prd: { section_id: 'sec-and-1', title: 'Android 领域模型' }
      },
      files: {
        expected: ['app/src/main/java/com/petpal/domain/model/HealthReport.kt']
      },
      acceptance_criteria: ['Kotlin data class 与 kotlinx.serialization', '不可变状态设计'],
      execution: {
        mode: 'assisted',
        recommended: { agent_id: 'chatgpt', score: 93, reason: 'Kotlin 领域数据建模' },
        selected: { agent_id: 'chatgpt' }
      }
    },
    {
      id: 'AND-REP-302',
      title: 'Implement Room Local Database Cache',
      project: 'PetPal-Android',
      feature: 'HealthReport',
      page_or_domain: 'LocalCache',
      layer: 'data',
      type: 'implementation',
      complexity: 'medium',
      risk: 'low',
      status: 'BLOCKED',
      dependencies: ['AND-REP-301'],
      sources: {
        prd: { section_id: 'sec-and-2', title: 'Room 数据库' }
      },
      files: {
        expected: ['app/src/main/java/com/petpal/data/db/HealthReportDao.kt']
      },
      acceptance_criteria: ['Room Dao 响应式 Flow 查询', '数据库版本升级迁移脚本'],
      execution: {
        mode: 'assisted',
        recommended: { agent_id: 'antigravity', score: 94, reason: 'Room 数据库与 Flow 查询构建' },
        selected: { agent_id: 'antigravity' }
      }
    },
    {
      id: 'AND-REP-303',
      title: 'Build Jetpack Compose Report List UI Skeleton',
      project: 'PetPal-Android',
      feature: 'HealthReport',
      page_or_domain: 'ReportUI',
      layer: 'ui',
      type: 'ui-skeleton',
      complexity: 'low',
      risk: 'low',
      status: 'READY',
      dependencies: [],
      sources: {
        prd: { section_id: 'sec-and-3', title: 'Compose 列表骨架' }
      },
      files: {
        expected: ['app/src/main/java/com/petpal/ui/report/ReportListSkeleton.kt']
      },
      acceptance_criteria: ['LazyColumn 配合 Shimmer 占位', '空状态与下拉刷新支持'],
      execution: {
        mode: 'assisted',
        recommended: { agent_id: 'trae', score: 91, reason: '快速生成 Compose 列表与骨架占位' },
        selected: { agent_id: 'trae' }
      }
    }
  ]
}

// ============================================================================
// 2. Plan 2: 智能项圈 BLE 蓝牙数据同步协议与断点续传
// ============================================================================
export const DEMO_BLE_PLAN = {
  id: 'PLAN-BLE-2026',
  title: '智能项圈 BLE 蓝牙数据同步协议与断点续传',
  version: 'v1.2',
  status: 'IN_PROGRESS',
  isDemo: false,
  leadPm: 'David (Hardware PM)',
  techLead: 'Elena (Firmware & Mobile)',
  updatedAt: '2026-08-30 11:20',
  description: '重构项圈蓝牙 GATT 通信协议，支持心率、体温、GPS 轨迹秒级分片同步与断点续传重发。',
  requirement: {
    id: 'REQ-2026-004',
    title: '智能项圈 BLE 同步协议 PRD',
    version: 'v1.2',
    author: 'David (Hardware PM)',
    updatedAt: '2026-08-30',
    status: 'ACTIVE',
    prdSnippet: '支持 MTU 512 协商，CRC32 校验，重连自动续传未 ACK 的数据分片。'
  },
  projects: [
    { id: 'PetPal-iOS', name: 'PetPal iOS Client', platform: 'iOS (CoreBluetooth)' },
    { id: 'PetPal-Android', name: 'PetPal Android Client', platform: 'Android (BleManager)' },
    { id: 'Collar-Firmware', name: 'Collar Embedded C', platform: 'C/C++ (FreeRTOS)' }
  ],
  tasks: [
    {
      id: 'BLE-101',
      title: 'Define GATT Service & Characteristic UUIDs',
      project: 'PetPal-iOS',
      feature: 'BleSync',
      page_or_domain: 'BleCore',
      layer: 'domain',
      type: 'implementation',
      complexity: 'low',
      risk: 'low',
      status: 'DONE',
      dependencies: [],
      execution: { recommended: { agent_id: 'chatgpt', score: 95, reason: '蓝牙服务协议与特征值定义' } }
    },
    {
      id: 'BLE-102',
      title: 'Implement CoreBluetooth State Machine & MTU Negotiation',
      project: 'PetPal-iOS',
      feature: 'BleSync',
      page_or_domain: 'BleService',
      layer: 'data',
      type: 'implementation',
      complexity: 'high',
      risk: 'medium',
      status: 'READY',
      dependencies: ['BLE-101'],
      execution: { recommended: { agent_id: 'antigravity', score: 96, reason: 'CoreBluetooth 状态机与并发通信' } }
    },
    {
      id: 'BLE-103',
      title: 'Implement Chunk Resend & CRC32 Validation Buffer',
      project: 'PetPal-iOS',
      feature: 'BleSync',
      page_or_domain: 'BleBuffer',
      layer: 'data',
      type: 'implementation',
      complexity: 'high',
      risk: 'high',
      status: 'BLOCKED',
      dependencies: ['BLE-102'],
      execution: { recommended: { agent_id: 'antigravity', score: 95, reason: '环形缓冲区与分片重传' } }
    },
    {
      id: 'BLE-104',
      title: 'Build Connection Diagnostics & Signal Strength UI',
      project: 'PetPal-iOS',
      feature: 'BleSync',
      page_or_domain: 'BleUI',
      layer: 'ui',
      type: 'ui-skeleton',
      complexity: 'low',
      risk: 'low',
      status: 'READY',
      dependencies: [],
      execution: { recommended: { agent_id: 'trae', score: 92, reason: '信号强度与连接诊断页面' } }
    }
  ]
}

// ============================================================================
// 3. Plan 3: 宠物社区动态流瀑布流与媒体压缩上传
// ============================================================================
export const DEMO_FEED_PLAN = {
  id: 'PLAN-FEED-2026',
  title: '宠物社区动态流瀑布流与媒体压缩上传',
  version: 'v3.0',
  status: 'PLANNING',
  isDemo: false,
  leadPm: 'Chloe (Community PM)',
  techLead: 'Marcus (FullStack)',
  updatedAt: '2026-08-28 17:45',
  description: '支持双列瀑布流、视频预加载播放、OSS 直传与 HEIF/WebP 客户端自适应压缩。',
  requirement: {
    id: 'REQ-2026-005',
    title: '宠物社区动态流重构 PRD',
    version: 'v3.0',
    author: 'Chloe (Community PM)',
    updatedAt: '2026-08-28',
    status: 'DRAFT'
  },
  projects: [
    { id: 'PetPal-iOS', name: 'PetPal iOS Client', platform: 'iOS (SwiftUI)' },
    { id: 'PetPal-Backend', name: 'PetPal Java Backend', platform: 'Spring Cloud' },
    { id: 'PetPal-Web', name: 'PetPal Creator Web', platform: 'React / Next.js' }
  ],
  tasks: [
    {
      id: 'FEED-101',
      title: 'Design Feed DTO & Recommendation API Contract',
      project: 'PetPal-Backend',
      feature: 'CommunityFeed',
      page_or_domain: 'FeedDomain',
      layer: 'domain',
      type: 'implementation',
      complexity: 'medium',
      risk: 'low',
      status: 'READY',
      dependencies: [],
      execution: { recommended: { agent_id: 'chatgpt', score: 96, reason: '动态流数据模型与推荐协议设计' } }
    },
    {
      id: 'FEED-102',
      title: 'Implement Multi-Media Direct Upload via Pre-signed OSS URL',
      project: 'PetPal-Backend',
      feature: 'CommunityFeed',
      page_or_domain: 'OssService',
      layer: 'data',
      type: 'implementation',
      complexity: 'medium',
      risk: 'low',
      status: 'BLOCKED',
      dependencies: ['FEED-101'],
      execution: { recommended: { agent_id: 'antigravity', score: 94, reason: 'OSS 预签名直传服务实现' } }
    },
    {
      id: 'FEED-103',
      title: 'Build Waterfall Masonry Grid with Auto-Play Viewport',
      project: 'PetPal-iOS',
      feature: 'CommunityFeed',
      page_or_domain: 'FeedUI',
      layer: 'ui',
      type: 'ui-skeleton',
      complexity: 'medium',
      risk: 'low',
      status: 'READY',
      dependencies: [],
      execution: { recommended: { agent_id: 'trae', score: 93, reason: '瀑布流网格与视口预加载' } }
    }
  ]
}

// ============================================================================
// 4. Plan 4: 会员积分商城与微信/Apple Pay 结算流
// ============================================================================
export const DEMO_MALL_PLAN = {
  id: 'PLAN-MALL-2026',
  title: '会员积分商城与微信/Apple Pay 结算流',
  version: 'v1.0',
  status: 'DONE',
  isDemo: false,
  leadPm: 'Michael (Growth PM)',
  techLead: 'Frank (Payment Architect)',
  updatedAt: '2026-08-20 09:10',
  description: '支持积分兑换商品、组合支付、订单状态机与防重复提交 Token 机制。',
  requirement: {
    id: 'REQ-2026-001',
    title: '积分商城与支付结算 PRD',
    version: 'v1.0',
    author: 'Michael (Growth PM)',
    updatedAt: '2026-08-20',
    status: 'COMPLETED'
  },
  projects: [
    { id: 'PetPal-iOS', name: 'PetPal iOS Client' },
    { id: 'PetPal-Backend', name: 'PetPal Java Backend' }
  ],
  tasks: [
    {
      id: 'MALL-101',
      title: 'Order State Machine & Anti-Duplication Token',
      project: 'PetPal-Backend',
      feature: 'PointMall',
      page_or_domain: 'OrderDomain',
      layer: 'domain',
      type: 'implementation',
      complexity: 'high',
      risk: 'high',
      status: 'DONE',
      dependencies: [],
      execution: { recommended: { agent_id: 'chatgpt', score: 96, reason: '订单状态机与幂等 Token 机制' } }
    },
    {
      id: 'MALL-102',
      title: 'Implement Apple Pay PassKit Integration',
      project: 'PetPal-iOS',
      feature: 'PointMall',
      page_or_domain: 'PaymentUI',
      layer: 'ui',
      type: 'implementation',
      complexity: 'medium',
      risk: 'medium',
      status: 'DONE',
      dependencies: ['MALL-101'],
      execution: { recommended: { agent_id: 'antigravity', score: 95, reason: 'PassKit 支付网关接入' } }
    }
  ]
}

// Initial multi-plan collection
export const INITIAL_ORCHESTRATOR_PLANS = [
  DEMO_HEALTH_PLAN,
  DEMO_BLE_PLAN,
  DEMO_FEED_PLAN,
  DEMO_MALL_PLAN
]

// Backward compatibility export
export const INITIAL_ORCHESTRATOR_PLAN = DEMO_HEALTH_PLAN

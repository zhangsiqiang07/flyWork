# 云效 API 集成方案设计

## 一、概述

### 1.1 目标
将阿里云云效（Yunxiao）的**组织管理**和**项目协作（Projex）**API 完整集成到 flyWork 桌面应用中，实现：
- 在 flyWork 中直接管理云效组织和项目
- 同步工作项（需求、缺陷、任务）到本地工作区
- 支持迭代管理和团队协作
- 与现有的 Git 操作和自动化流程深度整合

### 1.2 云效 API 版本
- **API 版本**: `2021-06-25`
- **服务接入点**:
  - 中心化：`openapi-rdc.aliyuncs.com`
  - 区域化：实例特定 URL

---

## 二、云效 API 能力清单

### 2.1 组织管理 API

| API | 方法 | 路径 | 功能 |
|-----|------|------|------|
| **ListOrganizations** | GET | `/oapi/v1/platform/organizations` | 查询用户所属的组织列表 |
| **SearchMembers** | POST | `/oapi/v1/platform/organizations/{organizationId}/members:search` | 搜索组织成员 |
| **GetMember** | GET | `/oapi/v1/platform/organizations/{organizationId}/members/{memberId}` | 查询成员详情 |
| **ReadMemberByUser** | GET | `/oapi/v1/platform/organizations/{organizationId}/members:user` | 通过用户ID查询成员 |

### 2.2 项目协作 API

| API | 方法 | 路径 | 功能 |
|-----|------|------|------|
| **CreateProject** | POST | `/oapi/v1/projex/organizations/{organizationId}/projects` | 创建项目 |
| **SearchProjects** | POST | `/oapi/v1/projex/organizations/{organizationId}/projects:search` | 搜索项目 |
| **ListProjectMembers** | GET | `/oapi/v1/projex/organizations/{organizationId}/projects/{projectId}/members` | 获取项目成员 |
| **UpdateProjectMember** | POST | `/oapi/v1/projex/organizations/{organizationId}/projects/{projectId}/members` | 添加/更新项目成员 |
| **UpdateProjectField** | PUT | `/oapi/v1/projex/organizations/{organizationId}/projects/{projectId}/fields` | 更新项目属性 |

### 2.3 工作项管理 API

| API | 方法 | 路径 | 功能 |
|-----|------|------|------|
| **CreateWorkitemV2** | POST | `/oapi/v1/projex/organizations/{organizationId}/workitems` | 创建工作项（需求/缺陷/任务/风险） |
| **ListWorkitems** | GET | `/organization/{organizationId}/listWorkitems` | 获取工作项列表 |
| **SearchWorkitems** | POST | `/oapi/v1/projex/organizations/{organizationId}/workitems:search` | 搜索工作项 |
| **UpdateWorkitemField** | PUT | `/oapi/v1/projex/organizations/{organizationId}/workitems/{workitemId}/fields` | 更新工作项字段 |
| **ListWorkItemAllFields** | GET | `/oapi/v1/projex/organizations/{organizationId}/workitems/fields` | 获取工作项字段定义 |
| **ListWorkItemWorkFlowStatus** | GET | `/oapi/v1/projex/organizations/{organizationId}/workitems/workflow/status` | 获取工作流状态 |
| **CreateWorkitemComment** | POST | `/oapi/v1/projex/organizations/{organizationId}/workitems/{workitemId}/comments` | 添加评论 |
| **ListWorkitemAttachments** | GET | `/oapi/v1/projex/organizations/{organizationId}/workitems/{workitemId}/attachments` | 获取附件列表 |

### 2.4 迭代管理 API

| API | 方法 | 路径 | 功能 |
|-----|------|------|------|
| **CreateSprint** | POST | `/oapi/v1/projex/organizations/{organizationId}/sprints` | 创建迭代 |
| **ListSprints** | GET | `/oapi/v1/projex/organizations/{organizationId}/sprints` | 获取迭代列表 |
| **GetSprintInfo** | GET | `/oapi/v1/projex/organizations/{organizationId}/sprints/{sprintId}` | 获取迭代详情 |
| **UpdateSprint** | PUT | `/oapi/v1/projex/organizations/{organizationId}/sprints/{sprintId}` | 更新迭代 |

### 2.5 认证方式
- **Header**: `x-yunxiao-token: <个人访问令牌>`
- **Path Parameter**: `organizationId`（组织ID）

---

## 三、flyWork 集成架构设计

### 3.1 模块划分

```
src/
├── main/
│   ├── services/
│   │   └── yunxiao/
│   │       ├── api.js              # 底层 HTTP 请求封装
│   │       ├── auth.js             # 认证管理（Token 存储/刷新）
│   │       ├── organization.js     # 组织管理 API
│   │       ├── project.js          # 项目协作 API
│   │       ├── workitem.js         # 工作项 API
│   │       └── sprint.js           # 迭代 API
│   └── index.js                    # 注册 IPC handlers
└── renderer/
    ├── views/
    │   └── YunxiaoIntegration.jsx  # 云效集成主视图
    ├── components/
    │   ├── YunxiaoSettings.jsx     # 设置面板（Token 配置）
    │   ├── YunxiaoProjects.jsx     # 项目列表
    │   ├── YunxiaoWorkitems.jsx    # 工作项看板
    │   └── YunxiaoSprints.jsx      # 迭代管理
    └── data/
        └── yunxiaoStore.js         # 状态管理
```

### 3.2 数据流设计

```
┌─────────────────┐
│   flyWork UI    │
│  (Renderer)     │
└────────┬────────┘
         │ IPC
         ▼
┌─────────────────┐
│  Main Process   │
│  Yunxiao API    │
│   Service       │
└────────┬────────┘
         │ HTTPS
         ▼
┌─────────────────┐
│  云效 OpenAPI   │
│ openapi-rdc.    │
│ aliyuncs.com    │
└─────────────────┘
```

---

## 四、功能设计

### 4.1 设置与认证

#### 4.1.1 Token 管理
- 用户在设置页面输入个人访问令牌（从云效后台获取）
- Token 加密存储在 `~/.flywork/yunxiao-token.enc`
- 支持多组织切换（一个 Token 可访问多个组织）

#### 4.1.2 组织选择
- 调用 `ListOrganizations` 获取用户所属组织
- 缓存组织信息到本地 `data.json`
- 支持切换当前活跃组织

### 4.2 项目同步

#### 4.2.1 项目导入
- 调用 `SearchProjects` 获取云效项目列表
- 用户选择项目后，自动创建对应的 flyWork 工作区
- 工作区关联云效项目ID，实现双向同步

#### 4.2.2 项目成员同步
- 调用 `ListProjectMembers` 获取项目成员
- 在工作区详情页显示团队成员
- 支持通过 `UpdateProjectMember` 添加/移除成员

### 4.3 工作项管理

#### 4.3.1 工作项同步
- 定期调用 `ListWorkitems` 同步项目工作项
- 工作项类型映射：
  - `Req` → 需求
  - `Bug` → 缺陷
  - `Task` → 任务
  - `Risk` → 风险

#### 4.3.2 工作项创建
- 在 flyWork 中直接创建工作项
- 支持选择类型、指派人员、设置优先级
- 调用 `CreateWorkitemV2` 提交到云效

#### 4.3.3 工作项看板
- 基于工作流状态展示看板视图
- 支持拖拽改变状态（调用 `UpdateWorkitemField`）
- 显示工作项详情、评论、附件

#### 4.3.4 收件箱集成
- 云效工作项可作为收件箱条目导入
- 收件箱条目可转化为云效工作项
- 实现"收集 → 分拣 → 执行"闭环

### 4.4 迭代管理

#### 4.4.1 迭代列表
- 调用 `ListSprints` 获取项目迭代
- 显示迭代时间线、进度、工作项统计

#### 4.4.2 迭代规划
- 创建新迭代（`CreateSprint`）
- 将工作项分配到迭代
- 更新迭代状态（`UpdateSprint`）

### 4.5 与现有功能整合

#### 4.5.1 Git 提交关联
- 在 AI 生成提交信息时，自动关联云效工作项ID
- 格式：`feat: 实现功能 #workitemId`
- 提交后自动更新工作项状态

#### 4.5.2 自动化流程
- 自动化步骤中支持调用云效 API
- 示例：构建成功后自动更新工作项状态为"已验证"
- 环境变量支持：`YUNXIAO_WORKITEM_ID`、`YUNXIAO_SPRINT_ID`

#### 4.5.3 命令中心
- 新增云效相关命令：
  - "同步云效工作项"
  - "创建云效任务"
  - "查看当前迭代"

---

## 五、实现计划

### 5.1 Phase 1: 基础集成（1-2 周）

#### 任务清单
- [ ] 创建 `src/main/services/yunxiao/` 目录结构
- [ ] 实现 `api.js`：HTTP 请求封装（fetch/axios）
- [ ] 实现 `auth.js`：Token 加密存储与读取
- [ ] 实现 `organization.js`：ListOrganizations, SearchMembers
- [ ] 添加 IPC handlers：`yunxiao-auth`, `yunxiao-list-orgs`
- [ ] 创建 `YunxiaoSettings.jsx`：Token 输入和组织选择界面
- [ ] 数据持久化：将 Token 和组织信息保存到 `data.json`

#### 验收标准
- 用户可以输入 Token 并通过验证
- 显示用户所属的组织列表
- 可以选择并切换活跃组织

### 5.2 Phase 2: 项目同步（1-2 周）

#### 任务清单
- [ ] 实现 `project.js`：SearchProjects, ListProjectMembers
- [ ] 添加 IPC handlers：`yunxiao-search-projects`, `yunxiao-list-members`
- [ ] 创建 `YunxiaoProjects.jsx`：项目列表和导入界面
- [ ] 实现项目导入功能：选择云效项目 → 创建 flyWork 工作区
- [ ] 工作区关联云效项目ID
- [ ] 成员信息显示在工作区详情页

#### 验收标准
- 可以搜索和查看云效项目列表
- 可以导入云效项目为 flyWork 工作区
- 工作区详情页显示项目成员

### 5.3 Phase 3: 工作项管理（2-3 周）

#### 任务清单
- [ ] 实现 `workitem.js`：ListWorkitems, CreateWorkitemV2, UpdateWorkitemField
- [ ] 添加 IPC handlers：`yunxiao-list-workitems`, `yunxiao-create-workitem`
- [ ] 创建 `YunxiaoWorkitems.jsx`：工作项列表和看板视图
- [ ] 实现工作项创建对话框
- [ ] 实现工作项状态更新（拖拽看板）
- [ ] 工作项评论和附件查看
- [ ] 收件箱集成：工作项 ↔ 收件箱条目转化

#### 验收标准
- 可以查看项目的工作项列表
- 可以创建新的工作项
- 可以通过看板拖拽更新工作项状态
- 收件箱可以转化为云效工作项

### 5.4 Phase 4: 迭代管理与深度整合（2 周）

#### 任务清单
- [ ] 实现 `sprint.js`：ListSprints, CreateSprint, UpdateSprint
- [ ] 添加 IPC handlers：`yunxiao-list-sprints`, `yunxiao-create-sprint`
- [ ] 创建 `YunxiaoSprints.jsx`：迭代时间线和规划界面
- [ ] Git 提交信息自动关联工作项ID
- [ ] 自动化流程支持云效 API 调用
- [ ] 命令中心添加云效相关命令

#### 验收标准
- 可以查看和创建迭代
- Git 提交可以关联云效工作项
- 自动化流程可以更新云效工作项状态

---

## 六、技术细节

### 6.1 HTTP 请求封装

```javascript
// src/main/services/yunxiao/api.js
import { getStoredToken } from './auth.js'

const YUNXIAO_API_BASE = 'https://openapi-rdc.aliyuncs.com'

export async function yunxiaoRequest(method, path, data = null, options = {}) {
  const token = await getStoredToken()
  if (!token) throw new Error('未配置云效访问令牌')

  const url = `${YUNXIAO_API_BASE}${path}`
  const headers = {
    'x-yunxiao-token': token,
    'Content-Type': 'application/json',
    ...options.headers
  }

  const response = await fetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : null
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.errorMsg || '云效 API 请求失败')
  }

  return response.json()
}
```

### 6.2 Token 加密存储

```javascript
// src/main/services/yunxiao/auth.js
import { safeStorage } from 'electron'
import { join } from 'path'
import { homedir } from 'os'
import { writeFileSync, readFileSync, existsSync } from 'fs'

const TOKEN_PATH = join(homedir(), '.flywork', 'yunxiao-token.enc')

export async function storeToken(token) {
  const encrypted = safeStorage.encryptString(token)
  writeFileSync(TOKEN_PATH, encrypted)
}

export async function getStoredToken() {
  if (!existsSync(TOKEN_PATH)) return null
  const encrypted = readFileSync(TOKEN_PATH)
  return safeStorage.decryptString(Buffer.from(encrypted))
}
```

### 6.3 IPC Handler 示例

```javascript
// src/main/index.js - setupIPC() 中添加
ipcMain.handle('yunxiao-list-organizations', async () => {
  try {
    const result = await yunxiaoRequest('GET', '/oapi/v1/platform/organizations')
    return { success: true, data: result }
  } catch (err) {
    return { success: false, error: err.message }
  }
})

ipcMain.handle('yunxiao-search-projects', async (_, { organizationId, query }) => {
  try {
    const result = await yunxiaoRequest('POST', 
      `/oapi/v1/projex/organizations/${organizationId}/projects:search`,
      { query, page: 1, perPage: 20 }
    )
    return { success: true, data: result }
  } catch (err) {
    return { success: false, error: err.message }
  }
})

ipcMain.handle('yunxiao-create-workitem', async (_, { organizationId, workitem }) => {
  try {
    const result = await yunxiaoRequest('POST',
      `/oapi/v1/projex/organizations/${organizationId}/workitems`,
      workitem
    )
    return { success: true, data: result }
  } catch (err) {
    return { success: false, error: err.message }
  }
})
```

### 6.4 数据模型扩展

```javascript
// 在 data.json 中新增字段
{
  "workspaces": [...],
  "yunxiao": {
    "tokenConfigured": true,
    "currentOrganizationId": "org-123456",
    "organizations": [
      {
        "id": "org-123456",
        "name": "我的团队",
        "logo": "https://..."
      }
    ],
    "projectMapping": {
      "ws-petpal": {
        "yunxiaoProjectId": "proj-789",
        "yunxiaoProjectName": "PetPal iOS",
        "lastSyncTime": "2026-08-04T10:00:00Z"
      }
    },
    "workitems": {
      "proj-789": [
        {
          "id": "wi-001",
          "subject": "修复 TabBar 闪烁问题",
          "category": "Bug",
          "status": "处理中",
          "assignedTo": "user-123",
          "sprintId": "sprint-456"
        }
      ]
    }
  }
}
```

---

## 七、安全考虑

### 7.1 Token 安全
- 使用 Electron 的 `safeStorage` API 加密存储 Token
- Token 不记录到日志文件
- 定期提示用户检查 Token 有效性

### 7.2 权限控制
- 工作区级别的云效项目绑定，避免越权访问
- 敏感操作（删除工作项、修改成员）需要二次确认
- 审计日志记录所有云效 API 调用

### 7.3 数据隔离
- 不同组织的 Token 和数据严格隔离
- 缓存数据定期清理，避免敏感信息残留

---

## 八、测试策略

### 8.1 单元测试
- API 请求封装的单元测试（mock HTTP 响应）
- Token 加密/解密的单元测试
- 数据同步逻辑的单元测试

### 8.2 集成测试
- 端到端的 Token 配置流程
- 项目导入和同步流程
- 工作项创建和更新流程

### 8.3 用户验收测试
- 真实云效环境下的功能验证
- 多组织切换场景测试
- 大批量数据同步性能测试

---

## 九、后续优化方向

### 9.1 离线支持
- 工作项离线缓存
- 断网时的本地编辑
- 网络恢复后的自动同步

### 9.2 Webhook 集成
- 订阅云效 Webhook 事件
- 工作项变更实时通知
- 构建状态实时更新

### 9.3 AI 增强
- AI 自动分类工作项
- 智能推荐工作项分配
- 自动生成迭代总结报告

---

## 十、参考资料

- [云效 API 概览](https://help.aliyun.com/zh/yunxiao/developer-reference/api-devops-2021-06-25-overview)
- [云效服务接入点](https://help.aliyun.com/zh/yunxiao/developer-reference/service-access-point-domain)
- [云效 OpenAPI 门户](https://next.api.aliyun.com/product/devops-rdc)
- [云效 CLI 使用指南](https://help.aliyun.com/zh/yunxiao/developer-reference/how-to-install-initialize-and-use-the-apsara-devops-cli)

---

## 十一、总结

本方案将云效的组织管理和项目协作能力完整集成到 flyWork，实现：

✅ **统一管理入口** - 在 flyWork 中直接管理云效组织和项目  
✅ **工作项闭环** - 从收集（收件箱）到执行（工作项）的完整流程  
✅ **深度整合** - Git 提交、自动化流程与云效工作项联动  
✅ **团队协作** - 成员管理、迭代规划、看板视图  

通过分阶段实施，可以逐步交付价值，同时保持代码质量和用户体验。

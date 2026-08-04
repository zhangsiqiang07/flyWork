# flyWork

[English](./README.md) | [中文](./README.zh-CN.md)

一款面向开发者的桌面效率应用，基于 Electron 和 React 构建。管理工作区、自动化开发流程，并集成 AI 编程助手。

## 功能特性

### 工作区管理
- 将项目组织为工作区，支持自定义路径
- 实时监控 Git 状态（分支、修改文件、最近提交）
- 快速访问工作区详情和近期活动

### Git 操作
- 完整的 Git 工作流：提交、推送、拉取、暂存、分支管理
- 基于 Claude Code CLI 的 AI 智能提交信息生成（支持规则引擎降级）
- 可视化分支管理和切换
- 细粒度的文件暂存/取消暂存控制

### 自动化流程
- 构建多步骤命令的自定义自动化管道
- 试运行模式，执行前预览效果
- 执行过程中实时流式输出
- 内置 Git 环境变量（分支、提交、作者信息）可用于脚本
- 动作白名单机制，确保安全可控执行

### AI 智能体集成
- 检测并集成本地 CLI 智能体：Claude Code、Codex/ChatGPT、OpenCode、Gemini
- 查看原生智能体存储中的项目特定会话
- 访问对话历史和线程消息

### 命令中心
- 通过 **⌥ Space**（Alt+Space）全局快捷键快速访问
- 执行常用操作：打开 Xcode、终端、Finder
- 直接从命令面板运行 Git 操作

### 其他特性
- 系统集成托盘，快速访问
- 活动日志，完整审计追踪
- 收件箱，收集待办事项
- 今日视图，专注当日任务
- 深色模式，支持 macOS 毛玻璃效果

## 技术栈

- **Electron** - 跨平台桌面应用框架
- **React 19** - UI 框架
- **Vite** - 构建工具和开发服务器
- **electron-vite** - Electron + Vite 集成
- **electron-builder** - 打包和分发

## 项目设置

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
npm run dev
```

启动开发模式，支持热重载。

### 构建

```bash
# Windows 平台
npm run build:win

# macOS 平台
npm run build:mac

# Linux 平台
npm run build:linux
```

构建输出位于 `dist` 目录。

## 数据存储

应用数据存储在 `~/.flywork/` 目录：
- `data.json` - 工作区、会话和应用状态
- `audit.log` - 活动和自动化执行日志

## 键盘快捷键

- **⌥ Space** - 打开命令中心

## 推荐的 IDE 配置

- [VSCode](https://code.visualstudio.com/) + [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) + [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)

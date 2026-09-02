import { exec, execSync } from 'child_process'
import { homedir } from 'os'
import { promisify } from 'util'
import { existsSync } from 'fs'

const execAsync = promisify(exec)

/**
 * Extended PATH to search for CLI tools in common user/system locations
 */
function getExtendedPathEnv() {
  const extraPaths = [
    `${homedir()}/.local/bin`,
    `${homedir()}/.opencode/bin`,
    `${homedir()}/.cargo/bin`,
    '/opt/homebrew/bin',
    '/opt/homebrew/sbin',
    '/usr/local/bin',
    '/usr/local/sbin',
    '/usr/bin',
    '/bin',
    '/usr/sbin',
    '/sbin'
  ].join(':')
  return `${extraPaths}:${process.env.PATH || ''}`
}

const envOpts = {
  env: { ...process.env, PATH: getExtendedPathEnv() },
  timeout: 4000,
  encoding: 'utf-8'
}

/**
 * Helper to run a command with timeout and return stdout
 */
async function runCmd(cmd) {
  try {
    const { stdout } = await execAsync(cmd, envOpts)
    return { ok: true, output: stdout.trim() }
  } catch (err) {
    return { ok: false, error: err.message }
  }
}

/**
 * Helper to find executable path
 */
function findBin(name) {
  try {
    const p = execSync(`which ${name} 2>/dev/null || command -v ${name} 2>/dev/null`, envOpts).trim()
    return p || null
  } catch {
    return null
  }
}

/**
 * Helper to measure network latency to a URL
 */
async function checkNetwork(url, displayName) {
  const start = Date.now()
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 4500)
    const resp = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal
    }).catch(async () => {
      // Fallback to GET with small range if HEAD is blocked
      return await fetch(url, {
        method: 'GET',
        headers: { Range: 'bytes=0-10' },
        signal: controller.signal
      })
    })
    clearTimeout(timeoutId)
    const latencyMs = Date.now() - start
    const status = resp.status < 500 ? 'ok' : 'warning'
    return {
      category: 'network',
      id: `net-${url}`,
      name: displayName,
      status,
      version: `${latencyMs} ms`,
      path: url,
      message: status === 'ok' ? `网络联通正常 (${resp.status})` : `服务器返回异常状态码: ${resp.status}`,
      remedy: null
    }
  } catch (err) {
    const latencyMs = Date.now() - start
    return {
      category: 'network',
      id: `net-${url}`,
      name: displayName,
      status: 'error',
      version: `${latencyMs} ms`,
      path: url,
      message: `网络连接失败: ${err.name === 'AbortError' ? '请求超时 (4.5s)' : err.message}`,
      remedy: '请检查当前网络连接、DNS 解析或本地科学上网代理配置。'
    }
  }
}

export async function runDiagnostics(options = {}) {
  const { jenkinsBaseUrl = null } = options
  const results = []

  // ==========================================
  // 1. Xcode & 移动开发工具链 (iOS Toolchain)
  // ==========================================
  // 1.1 xcode-select
  const xcodeSelectRes = await runCmd('xcode-select -p')
  if (xcodeSelectRes.ok) {
    const isFullXcode = xcodeSelectRes.output.includes('Xcode.app')
    results.push({
      category: 'xcode',
      id: 'xcode-select',
      name: 'Xcode 命令行工具 (CLT)',
      status: 'ok',
      version: isFullXcode ? 'Xcode.app 完整版' : 'Command Line Tools 独立版',
      path: xcodeSelectRes.output,
      message: '已正确指向活跃开发者目录',
      remedy: null
    })
  } else {
    results.push({
      category: 'xcode',
      id: 'xcode-select',
      name: 'Xcode 命令行工具 (CLT)',
      status: 'error',
      version: '未安装',
      path: null,
      message: '系统未检测到活跃的开发者工具目录，将无法编译与解析符号',
      remedy: '请在终端执行: xcode-select --install 或安装 Xcode'
    })
  }

  // 1.2 xcodebuild
  const xcodebuildRes = await runCmd('xcodebuild -version')
  if (xcodebuildRes.ok) {
    const lines = xcodebuildRes.output.split('\n')
    const versionStr = lines[0] || 'Xcode'
    const buildStr = lines[1] || ''
    results.push({
      category: 'xcode',
      id: 'xcodebuild',
      name: 'Xcode IDE 版本',
      status: 'ok',
      version: `${versionStr} ${buildStr}`.trim(),
      path: xcodeSelectRes.output || null,
      message: 'Xcode 编译器就绪',
      remedy: null
    })
  } else {
    results.push({
      category: 'xcode',
      id: 'xcodebuild',
      name: 'Xcode IDE 版本',
      status: 'warning',
      version: '未检测到完整 Xcode',
      path: null,
      message: '仅具备独立 CLT 或未关联 Xcode.app，部分复杂工程构建及归档可能受限',
      remedy: '前往 Mac App Store 下载安装完整版 Xcode'
    })
  }

  // 1.3 CocoaPods
  const podPath = findBin('pod')
  if (podPath) {
    const podVerRes = await runCmd('pod --version')
    results.push({
      category: 'xcode',
      id: 'cocoapods',
      name: 'CocoaPods 依赖管理',
      status: 'ok',
      version: podVerRes.ok ? `v${podVerRes.output}` : '已安装',
      path: podPath,
      message: '支持 Podfile 依赖安装与解析',
      remedy: null
    })
  } else {
    results.push({
      category: 'xcode',
      id: 'cocoapods',
      name: 'CocoaPods 依赖管理',
      status: 'warning',
      version: '未安装',
      path: null,
      message: '若当前项目使用 CocoaPods 管理依赖，将无法自动运行 pod install',
      remedy: '可通过 Homebrew 安装: brew install cocoapods'
    })
  }

  // 1.4 iOS 模拟器设备 (simctl)
  const simctlRes = await runCmd('xcrun simctl list devices available -j 2>/dev/null')
  if (simctlRes.ok) {
    try {
      const parsed = JSON.parse(simctlRes.output)
      const devices = parsed.devices || {}
      let totalDevices = 0
      Object.values(devices).forEach((list) => {
        if (Array.isArray(list)) totalDevices += list.length
      })
      results.push({
        category: 'xcode',
        id: 'simctl',
        name: 'iOS 模拟器运行环境',
        status: totalDevices > 0 ? 'ok' : 'warning',
        version: `${totalDevices} 台可用设备`,
        path: '/Library/Developer/CoreSimulator',
        message: totalDevices > 0 ? '已就绪，支持通用链接测试与应用调试' : '未检测到可用的模拟器运行时',
        remedy: totalDevices === 0 ? '打开 Xcode -> Settings -> Platforms 下载 iOS Simulator 镜像' : null
      })
    } catch {
      results.push({
        category: 'xcode',
        id: 'simctl',
        name: 'iOS 模拟器运行环境',
        status: 'ok',
        version: 'CoreSimulator 就绪',
        path: null,
        message: '已具备模拟器控制器 (xcrun simctl)',
        remedy: null
      })
    }
  } else {
    results.push({
      category: 'xcode',
      id: 'simctl',
      name: 'iOS 模拟器运行环境',
      status: 'warning',
      version: '不可用',
      path: null,
      message: '无法调用 xcrun simctl，模拟器联动调试功能将受限',
      remedy: '确保在完整 Xcode 环境下运行: sudo xcode-select -s /Applications/Xcode.app'
    })
  }

  // ==========================================
  // 2. 基础编译与语言环境 (Runtime & Tools)
  // ==========================================
  // 2.1 Git
  const gitPath = findBin('git')
  if (gitPath) {
    const gitVerRes = await runCmd('git --version')
    const gitUserRes = await runCmd('git config user.name')
    const gitEmailRes = await runCmd('git config user.email')
    const hasIdentity = gitUserRes.ok && gitEmailRes.ok && gitUserRes.output && gitEmailRes.output
    results.push({
      category: 'runtime',
      id: 'git',
      name: 'Git 版本控制',
      status: hasIdentity ? 'ok' : 'warning',
      version: gitVerRes.ok ? gitVerRes.output.replace('git version ', 'v') : '已安装',
      path: gitPath,
      message: hasIdentity
        ? `提交身份: ${gitUserRes.output} <${gitEmailRes.output}>`
        : '已安装但未配置全局 user.name / user.email',
      remedy: hasIdentity ? null : '配置命令: git config --global user.name "Your Name" && git config --global user.email "you@example.com"'
    })
  } else {
    results.push({
      category: 'runtime',
      id: 'git',
      name: 'Git 版本控制',
      status: 'error',
      version: '未安装',
      path: null,
      message: 'Git 是 flyWork 工作空间的核心基础，缺失将导致无法读取仓库',
      remedy: '安装命令: xcode-select --install 或 brew install git'
    })
  }

  // 2.2 Node.js & npm
  const nodePath = findBin('node')
  if (nodePath) {
    const nodeVerRes = await runCmd('node -v')
    const npmVerRes = await runCmd('npm -v')
    results.push({
      category: 'runtime',
      id: 'node',
      name: 'Node.js & npm',
      status: 'ok',
      version: `${nodeVerRes.ok ? nodeVerRes.output : ''} (npm ${npmVerRes.ok ? npmVerRes.output : '-'})`.trim(),
      path: nodePath,
      message: '本地前端与工具链运行时就绪',
      remedy: null
    })
  } else {
    results.push({
      category: 'runtime',
      id: 'node',
      name: 'Node.js 运行环境',
      status: 'warning',
      version: '未安装',
      path: null,
      message: '未检测到全局 Node.js，执行 npm 脚本或前端构建动作可能会失败',
      remedy: '推荐使用 nvm 或通过 Homebrew 安装: brew install node'
    })
  }

  // 2.3 Ruby
  const rubyPath = findBin('ruby')
  if (rubyPath) {
    const rubyVerRes = await runCmd('ruby -v')
    const verShort = rubyVerRes.ok ? rubyVerRes.output.split(' ')[1] : '已安装'
    results.push({
      category: 'runtime',
      id: 'ruby',
      name: 'Ruby 环境',
      status: 'ok',
      version: `v${verShort}`,
      path: rubyPath,
      message: '提供 CocoaPods 与 Fastlane 脚本执行底座',
      remedy: null
    })
  } else {
    results.push({
      category: 'runtime',
      id: 'ruby',
      name: 'Ruby 环境',
      status: 'warning',
      version: '未检测到',
      path: null,
      message: 'macOS 默认自带 Ruby，若缺失可能会影响 CocoaPods',
      remedy: '可使用 Homebrew 安装: brew install ruby'
    })
  }

  // 2.4 Python 3
  const pythonPath = findBin('python3') || findBin('python')
  if (pythonPath) {
    const pyVerRes = await runCmd(`${pythonPath} --version`)
    results.push({
      category: 'runtime',
      id: 'python',
      name: 'Python 3 运行环境',
      status: 'ok',
      version: pyVerRes.ok ? pyVerRes.output.replace('Python ', 'v') : '已安装',
      path: pythonPath,
      message: '支持崩溃日志预处理及自动化数据处理脚本',
      remedy: null
    })
  } else {
    results.push({
      category: 'runtime',
      id: 'python',
      name: 'Python 3 运行环境',
      status: 'warning',
      version: '未安装',
      path: null,
      message: '部分脚本及 LLDB 调试辅助可能依赖 Python3',
      remedy: '安装命令: brew install python'
    })
  }

  // 2.5 Homebrew
  const brewPath = findBin('brew')
  if (brewPath) {
    const brewVerRes = await runCmd('brew --version')
    const firstLine = brewVerRes.ok ? brewVerRes.output.split('\n')[0] : '已安装'
    results.push({
      category: 'runtime',
      id: 'homebrew',
      name: 'Homebrew 包管理器',
      status: 'ok',
      version: firstLine.replace('Homebrew ', 'v'),
      path: brewPath,
      message: '支持本地开发依赖快速扩充',
      remedy: null
    })
  } else {
    results.push({
      category: 'runtime',
      id: 'homebrew',
      name: 'Homebrew 包管理器',
      status: 'warning',
      version: '未安装',
      path: null,
      message: '建议安装 Homebrew 以便于管理开发包与 CLI 依赖',
      remedy: '官网安装命令: /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"'
    })
  }

  // ==========================================
  // 3. AI 编程智能体 (AI Agents CLI)
  // ==========================================
  // 3.1 Claude Code
  const claudePath = findBin('claude')
  if (claudePath) {
    const claudeVerRes = await runCmd('claude --version')
    results.push({
      category: 'ai',
      id: 'claude',
      name: 'Claude Code CLI',
      status: 'ok',
      version: claudeVerRes.ok ? claudeVerRes.output : '已就绪',
      path: claudePath,
      message: '支持智能编排代码规划、自动生成 Commit 与排错分析',
      remedy: null
    })
  } else {
    results.push({
      category: 'ai',
      id: 'claude',
      name: 'Claude Code CLI',
      status: 'warning',
      version: '未检测到',
      path: null,
      message: '安装后可解锁 flyWork 智能编排与 AI 智能体原生会话',
      remedy: '安装命令: npm install -g @anthropic-ai/claude-code'
    })
  }

  // 3.2 Codex / ChatGPT CLI
  const codexPath = findBin('codex')
  if (codexPath) {
    results.push({
      category: 'ai',
      id: 'codex',
      name: 'Codex / ChatGPT CLI',
      status: 'ok',
      version: '已就绪',
      path: codexPath,
      message: '支持基于 OpenAI 模型的代码辅助执行',
      remedy: null
    })
  } else {
    results.push({
      category: 'ai',
      id: 'codex',
      name: 'Codex / ChatGPT CLI',
      status: 'warning',
      version: '未配置',
      path: null,
      message: '未在 PATH 中找到 codex 可执行文件（可选）',
      remedy: null
    })
  }

  // 3.3 OpenCode
  const opencodePath = findBin('opencode')
  if (opencodePath) {
    results.push({
      category: 'ai',
      id: 'opencode',
      name: 'OpenCode CLI',
      status: 'ok',
      version: '已就绪',
      path: opencodePath,
      message: '支持开源大模型本地编程智能体',
      remedy: null
    })
  } else {
    results.push({
      category: 'ai',
      id: 'opencode',
      name: 'OpenCode CLI',
      status: 'warning',
      version: '未配置',
      path: null,
      message: '未检测到本地开源智能体 OpenCode（可选）',
      remedy: null
    })
  }

  // ==========================================
  // 4. 平台网络连通性 (Network Connectivity)
  // ==========================================
  const networkChecks = [
    checkNetwork('https://devops.aliyun.com', '阿里云效 (Yunxiao)'),
    checkNetwork('https://developer.apple.com', 'Apple Developer'),
    checkNetwork('https://github.com', 'GitHub')
  ]

  if (jenkinsBaseUrl && jenkinsBaseUrl.startsWith('http')) {
    networkChecks.push(checkNetwork(jenkinsBaseUrl, `Jenkins 实例 (${new URL(jenkinsBaseUrl).hostname})`))
  }

  const netResults = await Promise.all(networkChecks)
  results.push(...netResults)

  return results
}

import { exec, execSync, spawn } from 'child_process'
import { existsSync } from 'fs'
import { homedir } from 'os'
import { join, basename } from 'path'
import { promisify } from 'util'

const execAsync = promisify(exec)

const activeReportProcesses = new Map()

/**
 * Get comprehensive paths environment for finding CLI binaries
 */
function getExtendedPathEnv() {
  const extraPaths = [
    `${homedir()}/.local/bin`,
    `${homedir()}/.opencode/bin`,
    `${homedir()}/.nvm/versions/node/v24.12.0/bin`,
    `${homedir()}/.nvm/versions/node/v22.0.0/bin`,
    `${homedir()}/.nvm/versions/node/v20.0.0/bin`,
    `${homedir()}/.cargo/bin`,
    '/usr/local/bin',
    '/opt/homebrew/bin',
    '/opt/homebrew/sbin',
    '/usr/bin',
    '/bin',
    '/usr/sbin',
    '/sbin'
  ].join(':')
  return `${extraPaths}:${process.env.PATH || ''}`
}

/**
 * Detect available local CLI agents
 */
export function detectLocalAgentsInfo() {
  const pathEnv = getExtendedPathEnv()
  const checkCli = (cmd, displayName, defaultModel = '') => {
    try {
      const binPath = execSync(`which ${cmd} 2>/dev/null || command -v ${cmd} 2>/dev/null`, {
        env: { ...process.env, PATH: pathEnv },
        timeout: 2000,
        encoding: 'utf-8'
      }).trim()
      return {
        id: cmd,
        displayName,
        installed: Boolean(binPath),
        path: binPath || null,
        defaultModel
      }
    } catch {
      return {
        id: cmd,
        displayName,
        installed: false,
        path: null,
        defaultModel
      }
    }
  }

  return {
    codex: checkCli('codex', 'ChatGPT / Codex CLI', 'o3'),
    claude: checkCli('claude', 'Claude Code CLI', 'claude-3-7-sonnet'),
    gemini: checkCli('gemini', 'Google Gemini CLI', 'gemini-2.5-pro'),
    opencode: checkCli('opencode', 'OpenCode CLI', 'default'),
    ollama: checkCli('ollama', 'Ollama Local LLM', 'llama3'),
    builtin: {
      id: 'builtin',
      displayName: 'FlyDeck 智能合成引擎 (内置)',
      installed: true,
      path: 'Built-in Engine',
      defaultModel: 'FlyDeck Synthesizer'
    }
  }
}

/**
 * Helper to parse git log output
 */
function parseGitLogOutput(stdout, repoName, repoPath, currentBranch) {
  const commits = []
  const rawBlocks = stdout.split('COMMIT_START').filter(Boolean)

  for (const block of rawBlocks) {
    const endIdx = block.indexOf('COMMIT_END')
    if (endIdx === -1) continue

    const commitPart = block.slice(0, endIdx).trim()
    const statPart = block.slice(endIdx + 'COMMIT_END'.length).trim()

    const lines = commitPart.split('\n')
    if (lines.length < 7) continue

    const hash = lines[0]?.trim() || ''
    const shortHash = lines[1]?.trim() || ''
    const authorName = lines[2]?.trim() || 'Unknown'
    const authorEmail = lines[3]?.trim() || ''
    const dateIso = lines[4]?.trim() || ''
    const relativeDate = lines[5]?.trim() || ''
    const subject = lines.slice(6).join('\n').trim()

    let filesChanged = 0
    let insertions = 0
    let deletions = 0

    if (statPart) {
      const filesMatch = statPart.match(/(\d+)\s+files?\s+changed/i)
      const insMatch = statPart.match(/(\d+)\s+insertions?\(\+\)/i)
      const delMatch = statPart.match(/(\d+)\s+deletions?\(-\)/i)

      if (filesMatch) filesChanged = parseInt(filesMatch[1], 10)
      if (insMatch) insertions = parseInt(insMatch[1], 10)
      if (delMatch) deletions = parseInt(delMatch[1], 10)
    }

    commits.push({
      id: `${repoName}-${hash}`,
      hash,
      shortHash,
      author: authorName,
      authorEmail,
      date: dateIso ? dateIso.slice(0, 10) : '',
      fullDate: dateIso,
      relativeDate,
      subject,
      repoPath,
      repoName,
      branch: currentBranch,
      stats: {
        filesChanged,
        insertions,
        deletions,
        statSummary: statPart || ''
      },
      included: true
    })
  }

  return commits
}

/**
 * Extract weekly commits from one or multiple Git repositories
 */
export async function getWeeklyCommits({
  repoPaths = [],
  since = '',
  until = '',
  author = '',
  limit = 100
}) {
  const pathEnv = getExtendedPathEnv()
  const results = []

  for (const repoPath of repoPaths) {
    if (!repoPath || !existsSync(repoPath)) continue

    try {
      // 1. Resolve real repo root using git rev-parse
      let realRoot = repoPath
      try {
        realRoot =
          execSync('git rev-parse --show-toplevel 2>/dev/null', {
            cwd: repoPath,
            env: { ...process.env, PATH: pathEnv },
            encoding: 'utf-8',
            timeout: 2000
          }).trim() || repoPath
      } catch {
        // Not a git repo
        continue
      }

      const repoName = basename(realRoot) || 'Repository'
      let currentBranch = 'main'
      let repoAuthor = ''
      let allAuthors = []
      let latestCommitInfo = null
      let totalCommitsCount = 0

      // Get branch, configured user, all authors in repo, and latest commit info
      try {
        currentBranch =
          execSync('git rev-parse --abbrev-ref HEAD 2>/dev/null', {
            cwd: realRoot,
            env: { ...process.env, PATH: pathEnv },
            encoding: 'utf-8',
            timeout: 2000
          }).trim() || 'main'

        repoAuthor =
          execSync('git config user.name 2>/dev/null', {
            cwd: realRoot,
            env: { ...process.env, PATH: pathEnv },
            encoding: 'utf-8',
            timeout: 2000
          }).trim() || ''

        const authorsRaw = execSync('git log -100 --pretty=format:"%an" 2>/dev/null', {
          cwd: realRoot,
          env: { ...process.env, PATH: pathEnv },
          encoding: 'utf-8',
          timeout: 3000
        })
        allAuthors = Array.from(
          new Set(
            authorsRaw
              .split('\n')
              .map((s) => s.trim())
              .filter(Boolean)
          )
        )
        if (repoAuthor && !allAuthors.includes(repoAuthor)) {
          allAuthors.unshift(repoAuthor)
        }

        const latestRaw = execSync(
          'git log -1 --pretty=format:"%h|%an|%ad|%s" --date=short 2>/dev/null',
          {
            cwd: realRoot,
            env: { ...process.env, PATH: pathEnv },
            encoding: 'utf-8',
            timeout: 2000
          }
        ).trim()
        if (latestRaw) {
          const [lHash, lAuthor, lDate, lSub] = latestRaw.split('|')
          latestCommitInfo = { hash: lHash, author: lAuthor, date: lDate, subject: lSub }
        }

        const countRaw = execSync('git rev-list --count HEAD 2>/dev/null', {
          cwd: realRoot,
          env: { ...process.env, PATH: pathEnv },
          encoding: 'utf-8',
          timeout: 2000
        }).trim()
        totalCommitsCount = parseInt(countRaw, 10) || 0
      } catch {
        /* ignore */
      }

      // 2. Query commits with time/author filter
      const args = ['log']
      if (since) {
        args.push(`--since="${since}"`)
      }
      if (until) {
        args.push(`--until="${until}"`)
      }
      if (author && author !== 'ALL') {
        args.push(`--author="${author}"`)
      }
      if (limit) {
        args.push(`-n ${limit}`)
      }

      args.push('--pretty=format:COMMIT_START%n%H%n%h%n%an%n%ae%n%ad%n%ar%n%s%nCOMMIT_END')
      args.push('--date=iso')
      args.push('--shortstat')

      const cmd = `git ${args.join(' ')}`
      const { stdout } = await execAsync(cmd, {
        cwd: realRoot,
        env: { ...process.env, PATH: pathEnv },
        encoding: 'utf-8',
        timeout: 10000,
        maxBuffer: 1024 * 1024 * 10
      })

      const commits = parseGitLogOutput(stdout, repoName, realRoot, currentBranch)

      // 3. Fallback recent commits if filtered list is empty but repo has commits
      let fallbackRecentCommits = []
      if (commits.length === 0 && totalCommitsCount > 0) {
        try {
          const fallbackCmd = `git log -n 20 --pretty=format:COMMIT_START%n%H%n%h%n%an%n%ae%n%ad%n%ar%n%s%nCOMMIT_END --date=iso --shortstat`
          const fallbackRes = await execAsync(fallbackCmd, {
            cwd: realRoot,
            env: { ...process.env, PATH: pathEnv },
            encoding: 'utf-8',
            timeout: 5000
          })
          fallbackRecentCommits = parseGitLogOutput(
            fallbackRes.stdout,
            repoName,
            realRoot,
            currentBranch
          )
        } catch {
          /* ignore */
        }
      }

      results.push({
        repoPath: realRoot,
        repoName,
        branch: currentBranch,
        defaultAuthor: repoAuthor,
        allAuthors,
        latestCommit: latestCommitInfo,
        totalCommits: totalCommitsCount,
        commitCount: commits.length,
        commits,
        fallbackRecentCommits
      })
    } catch (err) {
      console.error(`Failed to fetch commits for ${repoPath}:`, err)
      results.push({
        repoPath,
        repoName: basename(repoPath),
        branch: 'unknown',
        error: err.message,
        commitCount: 0,
        commits: [],
        allAuthors: [],
        fallbackRecentCommits: []
      })
    }
  }

  return results
}

/**
 * Built-in intelligent AI synthesizer for weekly reports
 */
function generateBuiltinWeeklyReport({ commits = [], repoNames = [], dateRange = '' }) {
  const totalCommits = commits.length
  const now = new Date()

  // Categorize commits
  const features = []
  const bugfixes = []
  const refactors = []
  const improvements = []
  const docs = []
  const other = []

  commits.forEach((c) => {
    const s = c.subject.toLowerCase()
    if (
      s.startsWith('feat') ||
      s.includes('新增') ||
      s.includes('实现') ||
      s.includes('支持') ||
      s.includes('feature')
    ) {
      features.push(c)
    } else if (
      s.startsWith('fix') ||
      s.includes('修复') ||
      s.includes('bug') ||
      s.includes('解决') ||
      s.includes('问题')
    ) {
      bugfixes.push(c)
    } else if (
      s.startsWith('refactor') ||
      s.includes('重构') ||
      s.includes('优化') ||
      s.includes('perf')
    ) {
      refactors.push(c)
    } else if (s.startsWith('docs') || s.includes('文档') || s.includes('readme')) {
      docs.push(c)
    } else if (
      s.startsWith('chore') ||
      s.startsWith('ci') ||
      s.startsWith('build') ||
      s.includes('构建') ||
      s.includes('发布')
    ) {
      improvements.push(c)
    } else {
      other.push(c)
    }
  })

  const reposText = repoNames.length > 0 ? repoNames.join('、') : '当前项目'
  const timeText = dateRange || '本周'

  const lines = []
  lines.push(`# 📊 工作周报 (${todayText(now)})`)
  lines.push('')
  lines.push(
    `> **周期**：${timeText}  |  **关联仓库**：${reposText}  |  **提交总数**：${totalCommits} 次 Commit`
  )
  lines.push('')
  lines.push('---')
  lines.push('')
  lines.push('## 🌟 本周核心工作概览')
  lines.push(
    `本周重点围绕 **${reposText}** 展开研发与迭代工作。累计完成 **${totalCommits}** 项代码提交与业务改进，重点交付了 ${
      features.length > 0 ? `${features.length} 项核心功能需求` : '多项工程优化'
    }${bugfixes.length > 0 ? ` 并修复了 ${bugfixes.length} 个缺陷问题` : ''}，系统整体稳定性与用户体验得到进一步增强。`
  )
  lines.push('')

  // 1. Features
  lines.push('## 🚀 重点功能与需求交付')
  if (features.length > 0) {
    features.forEach((f) => {
      const cleanSubject = f.subject.replace(/^(feat(\([^)]+\))?:\s*)/i, '')
      lines.push(`- **${cleanSubject}**`)
      lines.push(
        `  - *仓库*：\`${f.repoName}\` (${f.branch}) · *提交*：\`${f.shortHash}\` · *作者*：${f.author} (${f.date})`
      )
      if (f.stats && f.stats.filesChanged > 0) {
        lines.push(
          `  - *变更规模*：${f.stats.filesChanged} 文件改动 (+${f.stats.insertions} / -${f.stats.deletions})`
        )
      }
    })
  } else {
    lines.push('- 本周主要集中于工程维护、架构优化与问题修复，无新增大型独立功能交付。')
  }
  lines.push('')

  // 2. Fixes & Refactors
  lines.push('## 🛠️ 缺陷修复与工程优化')
  if (bugfixes.length > 0 || refactors.length > 0 || improvements.length > 0) {
    bugfixes.forEach((f) => {
      const cleanSubject = f.subject.replace(/^(fix(\([^)]+\))?:\s*)/i, '')
      lines.push(
        `- 🐞 **[修复]** ${cleanSubject} (\`${f.repoName}\` · \`${f.shortHash}\` · ${f.author})`
      )
    })
    refactors.forEach((f) => {
      const cleanSubject = f.subject.replace(/^(refactor(\([^)]+\))?:\s*)/i, '')
      lines.push(
        `- ⚡ **[优化]** ${cleanSubject} (\`${f.repoName}\` · \`${f.shortHash}\` · ${f.author})`
      )
    })
    improvements.forEach((f) => {
      lines.push(
        `- 🔧 **[工程]** ${f.subject} (\`${f.repoName}\` · \`${f.shortHash}\` · ${f.author})`
      )
    })
  } else if (other.length > 0) {
    other.forEach((f) => {
      lines.push(`- 📝 ${f.subject} (\`${f.repoName}\` · \`${f.shortHash}\` · ${f.author})`)
    })
  } else {
    lines.push('- 暂无缺陷修复记录，主分支运行稳定。')
  }
  lines.push('')

  // 3. Documentation & Collaboration
  if (docs.length > 0) {
    lines.push('## 📚 文档与规范建设')
    docs.forEach((f) => {
      lines.push(`- 📖 ${f.subject} (\`${f.repoName}\` · ${f.author})`)
    })
    lines.push('')
  }

  // 4. Next Week Plan
  lines.push('## 📈 下周工作计划与展望')
  lines.push('1. 持续跟进本周交付特性的线上表现与回归测试，确保新版本交付质量。')
  lines.push('2. 推进下一阶段核心需求的设计评审与技术方案落地，完善前后端联调链路。')
  lines.push('3. 持续优化工程化脚本与自动化构建效率，提升代码覆盖率与交付节奏。')
  lines.push('')

  // 5. Risks & Notes
  lines.push('## ⚠️ 风险、阻塞点与协作建议')
  lines.push('- **当前进度**：整体进度符合预期，暂无重大阻塞风险。')
  lines.push('- **协作建议**：跨模块联调前建议提前同步接口契约，保障发版窗口准时交付。')
  lines.push('')

  return lines.join('\n')
}

function todayText(date) {
  const d = date || new Date()
  const weekNum = getWeekNumber(d)
  return `${d.getFullYear()}年第 ${weekNum} 周`
}

function getWeekNumber(d) {
  const target = new Date(d.valueOf())
  const dayNr = (d.getDay() + 6) % 7
  target.setDate(target.getDate() - dayNr + 3)
  const firstThursday = target.valueOf()
  target.setMonth(0, 1)
  if (target.getDay() !== 4) {
    target.setMonth(0, 1 + ((4 - target.getDay() + 7) % 7))
  }
  return 1 + Math.ceil((firstThursday - target) / 604800000)
}

/**
 * Execute local agent CLI or fallback to generate the weekly report
 */
export async function generateWeeklyReport({
  taskId,
  agentId = 'builtin',
  prompt = '',
  commits = [],
  repoNames = [],
  dateRange = '',
  workdir = homedir(),
  onChunk = () => {}
}) {
  const pathEnv = getExtendedPathEnv()
  const agents = detectLocalAgentsInfo()
  const selectedAgent = agents[agentId] || agents.builtin

  onChunk({ type: 'info', text: `[引擎准备] 选择执行引擎: ${selectedAgent.displayName}\n` })
  onChunk({
    type: 'info',
    text: `[数据解析] 汇集 ${commits.length} 条提交记录，涉及仓库: ${repoNames.join(', ') || '未指定'}\n`
  })

  // Format commits block for prompt injection
  const commitsText = commits
    .map(
      (c, i) =>
        `${i + 1}. [${c.repoName || 'Repo'}] [${c.shortHash}] (${c.date} 作者:${c.author}): ${c.subject}${c.stats?.statSummary ? ` (${c.stats.statSummary})` : ''}`
    )
    .join('\n')

  const resolvedPrompt = (prompt || '')
    .replaceAll('{commits}', commitsText)
    .replaceAll('{repoName}', repoNames.join('、') || '本地仓库')
    .replaceAll('{dateRange}', dateRange || '最近一周')
    .replaceAll('{author}', commits[0]?.author || '当前开发者')
    .replaceAll('{startDate}', dateRange.split('~')[0]?.trim() || '本周起始')
    .replaceAll('{endDate}', dateRange.split('~')[1]?.trim() || '今天')

  // If Builtin synthesizer or agent CLI not installed, run built-in generator
  if (agentId === 'builtin' || !selectedAgent.installed || !selectedAgent.path) {
    if (agentId !== 'builtin') {
      onChunk({
        type: 'warn',
        text: `⚠️ 本地未检测到 ${selectedAgent.displayName} 命令 (${agentId})，将自动无缝使用 FlyDeck 智能合成引擎生成周报...\n\n`
      })
    } else {
      onChunk({ type: 'info', text: `🚀 使用 FlyDeck 内置智能引擎进行高质周报合成...\n\n` })
    }

    // Progressive streaming generation for smooth UI
    const reportText = generateBuiltinWeeklyReport({ commits, repoNames, dateRange })
    const chunkSize = 60
    for (let i = 0; i < reportText.length; i += chunkSize) {
      const piece = reportText.slice(i, i + chunkSize)
      onChunk({ type: 'markdown-chunk', text: piece })
      await new Promise((r) => setTimeout(r, 18))
    }

    onChunk({ type: 'exit', text: `\n[生成完成] 周报已成功生成并缓存！` })
    return {
      success: true,
      report: reportText,
      engine: 'FlyDeck 智能合成引擎'
    }
  }

  // Run selected CLI agent
  return new Promise((resolve) => {
    onChunk({ type: 'info', text: `🚀 正在调用本地 CLI 智能体: ${selectedAgent.path}\n` })

    let spawnCmd = selectedAgent.id
    let spawnArgs = []

    if (agentId === 'codex') {
      spawnCmd = selectedAgent.path
      spawnArgs = ['exec', resolvedPrompt]
    } else if (agentId === 'claude') {
      spawnCmd = selectedAgent.path
      spawnArgs = ['-p', resolvedPrompt]
    } else if (agentId === 'gemini') {
      spawnCmd = selectedAgent.path
      spawnArgs = ['-p', resolvedPrompt]
    } else if (agentId === 'opencode') {
      spawnCmd = selectedAgent.path
      spawnArgs = ['run', resolvedPrompt]
    } else if (agentId === 'ollama') {
      spawnCmd = selectedAgent.path
      spawnArgs = ['run', 'llama3', resolvedPrompt]
    } else {
      spawnCmd = selectedAgent.path
      spawnArgs = [resolvedPrompt]
    }

    const proc = spawn(spawnCmd, spawnArgs, {
      cwd: workdir || homedir(),
      env: {
        ...process.env,
        PATH: pathEnv
      },
      detached: process.platform !== 'win32',
      stdio: ['pipe', 'pipe', 'pipe']
    })

    if (taskId) {
      activeReportProcesses.set(taskId, proc)
    }

    let stdoutBuf = ''
    let stderrBuf = ''

    proc.stdout.on('data', (chunk) => {
      const text = chunk.toString()
      stdoutBuf += text
      onChunk({ type: 'stdout', text })
      onChunk({ type: 'markdown-chunk', text })
    })

    proc.stderr.on('data', (chunk) => {
      const text = chunk.toString()
      stderrBuf += text
      onChunk({ type: 'stderr', text })
    })

    proc.on('close', (code) => {
      if (taskId) activeReportProcesses.delete(taskId)
      const wasCancelled = proc.__flyworkCancelled === true

      if (wasCancelled) {
        onChunk({ type: 'exit', text: `\n[已终止] 周报生成已由用户手动取消。` })
        resolve({ success: false, error: '生成已取消', wasCancelled: true })
        return
      }

      if (code === 0 && stdoutBuf.trim().length > 30) {
        onChunk({ type: 'exit', text: `\n[生成成功] ${selectedAgent.displayName} 执行完成！` })
        resolve({
          success: true,
          report: stdoutBuf.trim(),
          engine: selectedAgent.displayName
        })
      } else {
        // Fallback gracefully to built-in generator if CLI returned error or empty
        onChunk({
          type: 'warn',
          text: `\n⚠️ ${selectedAgent.displayName} 运行退出 (Code: ${code})，自动切换至 FlyDeck 智能引擎兜底生成...\n\n`
        })
        const fallbackReport = generateBuiltinWeeklyReport({ commits, repoNames, dateRange })
        onChunk({ type: 'markdown-chunk', text: fallbackReport })
        onChunk({ type: 'exit', text: `\n[兜底完成] 周报已成功生成并缓存！` })
        resolve({
          success: true,
          report: fallbackReport,
          engine: `${selectedAgent.displayName} (智能引擎兜底)`
        })
      }
    })

    proc.on('error', (err) => {
      if (taskId) activeReportProcesses.delete(taskId)
      onChunk({ type: 'stderr', text: `\n[CLI 进程异常] ${err.message}，正在启动内置引擎...\n` })
      const fallbackReport = generateBuiltinWeeklyReport({ commits, repoNames, dateRange })
      onChunk({ type: 'markdown-chunk', text: fallbackReport })
      resolve({
        success: true,
        report: fallbackReport,
        engine: 'FlyDeck 智能合成引擎 (异常兜底)'
      })
    })
  })
}

/**
 * Cancel an ongoing weekly report generation
 */
export function cancelWeeklyReportGeneration(taskId) {
  const proc = activeReportProcesses.get(taskId)
  if (!proc || proc.exitCode !== null || proc.killed) {
    return { success: false, error: '没有正在运行的任务' }
  }

  try {
    proc.__flyworkCancelled = true
    if (process.platform === 'win32') {
      proc.kill('SIGTERM')
    } else {
      process.kill(-proc.pid, 'SIGTERM')
      setTimeout(() => {
        if (activeReportProcesses.get(taskId) === proc && proc.exitCode === null) {
          try {
            process.kill(-proc.pid, 'SIGKILL')
          } catch {}
        }
      }, 3000)
    }
    return { success: true }
  } catch (err) {
    return { success: false, error: err.message }
  }
}

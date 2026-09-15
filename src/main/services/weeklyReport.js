import { exec, execSync, spawn } from 'child_process'
import { existsSync, readFileSync, readdirSync, statSync, openSync, readSync, closeSync } from 'fs'
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

let cachedAgentsInfo = null
let cachedAgentsTime = 0

/**
 * Detect available local CLI agents
 */
export function detectLocalAgentsInfo() {
  const now = Date.now()
  if (cachedAgentsInfo && now - cachedAgentsTime < 60000) {
    return cachedAgentsInfo
  }

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

  const result = {
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

  cachedAgentsInfo = result
  cachedAgentsTime = now
  return result
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

const repoMetaCache = new Map()
const REPO_META_TTL = 30000 // 30 seconds

/**
 * Extract weekly commits from one or multiple Git repositories asynchronously
 */
export async function getWeeklyCommits({
  repoPaths = [],
  since = '',
  until = '',
  author = '',
  limit = 100
}) {
  const pathEnv = getExtendedPathEnv()

  const repoPromises = repoPaths.map(async (repoPath) => {
    if (!repoPath || !existsSync(repoPath)) return null

    try {
      // 1. Resolve real repo root and current branch using a single async git rev-parse
      let realRoot = repoPath
      let currentBranch = 'main'
      try {
        const { stdout: revStdout } = await execAsync(
          'git rev-parse --show-toplevel --abbrev-ref HEAD 2>/dev/null',
          {
            cwd: repoPath,
            env: { ...process.env, PATH: pathEnv },
            encoding: 'utf-8',
            timeout: 3000
          }
        )
        const lines = revStdout
          .trim()
          .split('\n')
          .map((l) => l.trim())
          .filter(Boolean)
        if (lines[0]) realRoot = lines[0]
        if (lines[1]) currentBranch = lines[1]
      } catch {
        // Not a git repo
        return null
      }

      const repoName = basename(realRoot) || 'Repository'
      const cachedMeta = repoMetaCache.get(realRoot)
      let repoAuthor = ''
      let allAuthors = []
      let latestCommitInfo = null
      let totalCommitsCount = 0

      if (cachedMeta && Date.now() - cachedMeta.ts < REPO_META_TTL) {
        if (cachedMeta.branch) currentBranch = cachedMeta.branch
        repoAuthor = cachedMeta.repoAuthor || ''
        allAuthors = cachedMeta.allAuthors || []
        latestCommitInfo = cachedMeta.latestCommitInfo || null
        totalCommitsCount = cachedMeta.totalCommitsCount || 0
      } else {
        // Concurrently query branch metadata in parallel without blocking main thread
        const [authorRes, authorsRawRes, latestRawRes, countRawRes] = await Promise.allSettled([
          execAsync('git config user.name 2>/dev/null', {
            cwd: realRoot,
            env: { ...process.env, PATH: pathEnv },
            encoding: 'utf-8',
            timeout: 2000
          }),
          execAsync('git log -50 --pretty=format:"%an" 2>/dev/null', {
            cwd: realRoot,
            env: { ...process.env, PATH: pathEnv },
            encoding: 'utf-8',
            timeout: 2500
          }),
          execAsync('git log -1 --pretty=format:"%h|%an|%ad|%s" --date=short 2>/dev/null', {
            cwd: realRoot,
            env: { ...process.env, PATH: pathEnv },
            encoding: 'utf-8',
            timeout: 2000
          }),
          execAsync('git rev-list --count HEAD 2>/dev/null', {
            cwd: realRoot,
            env: { ...process.env, PATH: pathEnv },
            encoding: 'utf-8',
            timeout: 2000
          })
        ])

        if (authorRes.status === 'fulfilled' && authorRes.value?.stdout) {
          repoAuthor = authorRes.value.stdout.trim()
        }
        if (authorsRawRes.status === 'fulfilled' && authorsRawRes.value?.stdout) {
          allAuthors = Array.from(
            new Set(
              authorsRawRes.value.stdout
                .split('\n')
                .map((s) => s.trim())
                .filter(Boolean)
            )
          )
          if (repoAuthor && !allAuthors.includes(repoAuthor)) {
            allAuthors.unshift(repoAuthor)
          }
        }
        if (latestRawRes.status === 'fulfilled' && latestRawRes.value?.stdout) {
          const latestRaw = latestRawRes.value.stdout.trim()
          if (latestRaw) {
            const [lHash, lAuthor, lDate, lSub] = latestRaw.split('|')
            latestCommitInfo = { hash: lHash, author: lAuthor, date: lDate, subject: lSub }
          }
        }
        if (countRawRes.status === 'fulfilled' && countRawRes.value?.stdout) {
          totalCommitsCount = parseInt(countRawRes.value.stdout.trim(), 10) || 0
        }

        repoMetaCache.set(realRoot, {
          branch: currentBranch,
          repoAuthor,
          allAuthors,
          latestCommitInfo,
          totalCommitsCount,
          ts: Date.now()
        })
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

      return {
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
      }
    } catch (err) {
      console.error(`Failed to fetch commits for ${repoPath}:`, err)
      return {
        repoPath,
        repoName: basename(repoPath),
        branch: 'unknown',
        error: err.message,
        commitCount: 0,
        commits: [],
        allAuthors: [],
        fallbackRecentCommits: []
      }
    }
  })

  const settled = await Promise.all(repoPromises)
  return settled.filter(Boolean)
}

const sessionFileCache = new Map()

/**
 * Helper recursive search for session files in a directory with caching
 */
function findSessionFile(dir, targetId) {
  if (!existsSync(dir) || !targetId) return null
  const cacheKey = `${dir}::${targetId}`
  if (sessionFileCache.has(cacheKey)) {
    const cached = sessionFileCache.get(cacheKey)
    if (existsSync(cached)) return cached
    sessionFileCache.delete(cacheKey)
  }

  try {
    const entries = readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = join(dir, entry.name)
      if (entry.isDirectory()) {
        const found = findSessionFile(fullPath, targetId)
        if (found) {
          sessionFileCache.set(cacheKey, found)
          return found
        }
      } else if (entry.name.includes(targetId)) {
        sessionFileCache.set(cacheKey, fullPath)
        return fullPath
      }
    }
  } catch {}
  return null
}

/**
 * Helper to parse a Claude Code session JSONL file
 */
export function parseClaudeSessionFile(filePath) {
  try {
    if (!existsSync(filePath)) return null
    const stat = statSync(filePath)
    const sessionId = basename(filePath, '.jsonl')
    const content = readFileSync(filePath, 'utf-8')
    const lines = content.split('\n').filter(Boolean)

    let title = ''
    let firstUserMsg = ''
    let firstAssistantMsg = ''
    let projectCwd = ''
    let latestTimestamp = stat.mtimeMs
    let firstTimestamp = stat.birthtimeMs || stat.mtimeMs
    const messages = []

    for (const line of lines) {
      try {
        const item = JSON.parse(line)
        if (item.cwd && !projectCwd) {
          projectCwd = item.cwd
        }
        if (item.timestamp) {
          const itemTs = new Date(item.timestamp).getTime()
          if (itemTs > 0) {
            if (!firstTimestamp || itemTs < firstTimestamp) firstTimestamp = itemTs
            if (itemTs > latestTimestamp) latestTimestamp = itemTs
          }
        }

        if (item.type === 'user') {
          let text = ''
          if (typeof item.message?.content === 'string') {
            text = item.message.content
          } else if (Array.isArray(item.message?.content)) {
            text = item.message.content
              .filter((b) => b && (b.type === 'text' || typeof b === 'string'))
              .map((b) => (typeof b === 'string' ? b : b.text || ''))
              .join('\n')
          } else if (typeof item.content === 'string') {
            text = item.content
          }

          if (text && text.trim()) {
            const cleanText = text.trim()
            if (!firstUserMsg) firstUserMsg = cleanText
            messages.push({
              role: 'user',
              content: cleanText,
              time: item.timestamp
                ? new Date(item.timestamp).toLocaleTimeString('zh-CN', {
                    hour: '2-digit',
                    minute: '2-digit'
                  })
                : ''
            })
          }
        } else if (item.type === 'assistant') {
          let text = ''
          if (typeof item.message?.content === 'string') {
            text = item.message.content
          } else if (Array.isArray(item.message?.content)) {
            text = item.message.content
              .filter((b) => b && (b.type === 'text' || typeof b === 'string'))
              .map((b) => (typeof b === 'string' ? b : b.text || ''))
              .join('\n')
          } else if (typeof item.content === 'string') {
            text = item.content
          }

          if (text && text.trim()) {
            const cleanText = text.trim()
            if (!firstAssistantMsg) firstAssistantMsg = cleanText
            messages.push({
              role: 'assistant',
              content: cleanText,
              time: item.timestamp
                ? new Date(item.timestamp).toLocaleTimeString('zh-CN', {
                    hour: '2-digit',
                    minute: '2-digit'
                  })
                : ''
            })
          }
        } else if (item.type === 'last-prompt' && item.lastPrompt) {
          if (!title) title = item.lastPrompt.trim()
        }
      } catch {}
    }

    // Smart title determination:
    // If prompt is a commit message generator prompt, use assistant's first line
    if (
      (!title ||
        title.includes('你是一名资深软件工程师') ||
        title.includes('生成一条准确的中文提交信息')) &&
      firstAssistantMsg
    ) {
      const firstLineAsst =
        firstAssistantMsg.split('\n').map((l) => l.trim()).filter(Boolean)[0] || ''
      if (firstLineAsst && firstLineAsst.length >= 3 && !firstLineAsst.startsWith('```')) {
        title = firstLineAsst.slice(0, 80)
      }
    }

    if (!title) {
      title = firstUserMsg ? firstUserMsg.slice(0, 80) : `Claude Code 会话 ${sessionId.slice(0, 8)}`
    }
    const cleanTitle = title.split('\n').map((l) => l.trim()).filter(Boolean)[0] || title

    return {
      sessionId,
      title: cleanTitle.slice(0, 80),
      summary: cleanTitle.slice(0, 80),
      projectCwd,
      firstTimestamp,
      latestTimestamp,
      messageCount: messages.length,
      messages
    }
  } catch (err) {
    return null
  }
}

/**
 * Extract messages for a given session/thread from native agent files
 */
export function getAgentSessionMessages(sessionId, agentType = '') {
  if (!sessionId) return []
  const messages = []

  // 1. ChatGPT / Codex sessions
  if (
    !agentType ||
    agentType.toLowerCase().includes('codex') ||
    agentType.toLowerCase().includes('chatgpt')
  ) {
    const codexSessDir = join(homedir(), '.codex', 'sessions')
    const foundCodexFile = findSessionFile(codexSessDir, sessionId)
    if (foundCodexFile) {
      try {
        const content = readFileSync(foundCodexFile, 'utf-8')
        content
          .split('\n')
          .filter(Boolean)
          .forEach((line) => {
            try {
              const item = JSON.parse(line)
              if (item.type === 'event_msg' && item.payload) {
                const pType = item.payload.type
                if (pType === 'user_message' || pType === 'agent_message') {
                  const role = pType === 'user_message' ? 'user' : 'assistant'
                  const text =
                    item.payload.message || item.payload.text || item.payload.content || ''
                  if (text && typeof text === 'string') {
                    messages.push({
                      role,
                      content: text,
                      time: item.payload.timestamp
                        ? new Date(item.payload.timestamp).toLocaleTimeString('zh-CN', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })
                        : ''
                    })
                  }
                }
              }
            } catch {}
          })
      } catch {}
      if (messages.length > 0) return messages
    }
  }

  // 2. Claude Code
  if (!agentType || agentType.toLowerCase().includes('claude')) {
    // 2.1 Search in ~/.claude/projects/
    const claudeProjectsDir = join(homedir(), '.claude', 'projects')
    const foundClaudeFile = findSessionFile(claudeProjectsDir, sessionId)
    if (foundClaudeFile) {
      const parsed = parseClaudeSessionFile(foundClaudeFile)
      if (parsed && parsed.messages.length > 0) return parsed.messages
    }

    // 2.2 Search in ~/.claude/transcripts/
    const claudeTranscriptsDir = join(homedir(), '.claude', 'transcripts')
    const foundTranscriptFile = findSessionFile(claudeTranscriptsDir, sessionId)
    if (foundTranscriptFile) {
      const parsed = parseClaudeSessionFile(foundTranscriptFile)
      if (parsed && parsed.messages.length > 0) return parsed.messages
    }

    // 2.3 Fallback to ~/.claude/history.jsonl
    const claudeHist = join(homedir(), '.claude', 'history.jsonl')
    if (existsSync(claudeHist)) {
      try {
        const content = readFileSync(claudeHist, 'utf-8')
        content
          .split('\n')
          .filter(Boolean)
          .forEach((line) => {
            try {
              const item = JSON.parse(line)
              if (item.sessionId === sessionId || String(item.timestamp) === sessionId) {
                if (item.display && item.display !== 'status') {
                  const role =
                    item.display === 'assistant' || item.display === 'model' ? 'assistant' : 'user'
                  const text = typeof item.display === 'string' ? item.display : `命令记录`
                  messages.push({
                    role,
                    content: text,
                    time: item.timestamp
                      ? new Date(item.timestamp).toLocaleTimeString('zh-CN', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })
                      : ''
                  })
                }
              }
            } catch {}
          })
      } catch {}
      if (messages.length > 0) return messages
    }
  }

  // 3. Cursor Composer & Agent Transcripts
  if (!agentType || agentType.toLowerCase().includes('cursor')) {
    const cursorProjectsDir = join(homedir(), '.cursor', 'projects')
    const foundCursorFile = findSessionFile(cursorProjectsDir, sessionId)
    if (foundCursorFile) {
      try {
        const content = readFileSync(foundCursorFile, 'utf-8')
        content
          .split('\n')
          .filter(Boolean)
          .forEach((line) => {
            try {
              const item = JSON.parse(line)
              const role = item.role || item.message?.role
              let text = ''
              if (item.content && typeof item.content === 'string') text = item.content
              else if (item.message?.content) {
                if (typeof item.message.content === 'string') text = item.message.content
                else if (Array.isArray(item.message.content)) {
                  text = item.message.content.map((c) => c.text || '').join('\n')
                }
              }
              if (text && role) {
                const cleanText = text
                  .replace(/<user_query>([\s\S]*?)<\/user_query>/g, '$1')
                  .replace(/<[\s\S]*?>/g, '')
                  .trim()
                if (cleanText) {
                  messages.push({
                    role: role === 'user' ? 'user' : 'assistant',
                    content: cleanText,
                    time: ''
                  })
                }
              }
            } catch {}
          })
      } catch {}
      if (messages.length > 0) return messages
    }
  }

  // 4. Antigravity (Gemini) Conversations
  if (
    !agentType ||
    agentType.toLowerCase().includes('antigravity') ||
    agentType.toLowerCase().includes('gemini')
  ) {
    const brainDir = join(homedir(), '.gemini', 'antigravity', 'brain')
    const transcriptFile = join(brainDir, sessionId, '.system_generated', 'logs', 'transcript.jsonl')
    if (existsSync(transcriptFile)) {
      try {
        const content = readFileSync(transcriptFile, 'utf-8')
        content
          .split('\n')
          .filter(Boolean)
          .forEach((line) => {
            try {
              const item = JSON.parse(line)
              if (item.type === 'USER_INPUT' && item.content) {
                const cleanText = item.content.replace(/<[\s\S]*?>/g, '').trim()
                if (cleanText) {
                  messages.push({
                    role: 'user',
                    content: cleanText,
                    time: item.created_at
                      ? new Date(item.created_at).toLocaleTimeString('zh-CN', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })
                      : ''
                  })
                }
              } else if (item.type === 'PLANNER_RESPONSE' && item.content) {
                messages.push({
                  role: 'assistant',
                  content: item.content,
                  time: item.created_at
                    ? new Date(item.created_at).toLocaleTimeString('zh-CN', {
                        hour: '2-digit',
                        minute: '2-digit'
                      })
                    : ''
                })
              }
            } catch {}
          })
      } catch {}
      if (messages.length > 0) return messages
    }
  }

  return messages
}

let cachedAgentChatsKey = ''
let cachedAgentChatsRes = null
let cachedAgentChatsTime = 0
const AGENT_CHATS_CACHE_TTL = 15000 // 15 seconds

/**
 * Extract agent project chats/sessions for given repositories and date range
 */
export async function getWeeklyAgentChats({
  repoPaths = [],
  repoNames = [],
  since = '',
  until = '',
  agent = 'ALL'
}) {
  const cacheKey = JSON.stringify({
    repoPaths: (repoPaths || []).slice().sort(),
    repoNames: (repoNames || []).slice().sort(),
    since,
    until,
    agent
  })
  const now = Date.now()
  if (
    cachedAgentChatsRes &&
    cachedAgentChatsKey === cacheKey &&
    now - cachedAgentChatsTime < AGENT_CHATS_CACHE_TTL
  ) {
    return cachedAgentChatsRes
  }

  const chats = []
  const allDiscoveredChats = []
  const seenIds = new Set()

  // Compute timestamp boundaries
  const sinceMs = since ? new Date(`${since}T00:00:00`).getTime() : 0
  const untilMs = until ? new Date(`${until}T23:59:59`).getTime() : Infinity

  // Prepare normalized project identifiers for matching
  const targetNames = new Set(
    (repoNames || []).map((n) => n && n.toLowerCase().trim()).filter(Boolean)
  )
  const targetPaths = new Set(
    (repoPaths || []).map((p) => p && p.toLowerCase().trim()).filter(Boolean)
  )
  repoPaths.forEach((p) => {
    if (p) {
      const base = basename(p).toLowerCase().trim()
      if (base) targetNames.add(base)
    }
  })

  const matchesProject = (pPath, pName) => {
    const normName = (pName || '').toLowerCase().trim()
    const normPath = (pPath || '').toLowerCase().trim()
    if (!normName && !normPath) return false

    if (normName && targetNames.has(normName)) return true
    if (normPath && targetPaths.has(normPath)) return true

    for (const tPath of targetPaths) {
      if (normPath && tPath) {
        if (
          normPath === tPath ||
          normPath.endsWith(basename(tPath)) ||
          tPath.endsWith(basename(normPath))
        ) {
          return true
        }
      }
    }
    for (const tName of targetNames) {
      if (tName && tName.length >= 2) {
        if (normName && normName.length >= 2) {
          if (normName === tName || normName.includes(tName) || tName.includes(normName)) {
            return true
          }
        }
        if (normPath && normPath.length >= 2) {
          if (normPath.includes(tName) || basename(normPath) === tName) {
            return true
          }
        }
      }
    }
    return false
  }

  // 1. Query ChatGPT / Codex
  if (
    agent === 'ALL' ||
    agent.toLowerCase().includes('codex') ||
    agent.toLowerCase().includes('chatgpt')
  ) {
    const globStatePath = join(homedir(), '.codex', '.codex-global-state.json')
    const sessIndexPath = join(homedir(), '.codex', 'session_index.jsonl')

    if (existsSync(globStatePath) && existsSync(sessIndexPath)) {
      try {
        const globData = JSON.parse(readFileSync(globStatePath, 'utf-8'))
        const projects = globData['local-projects'] || {}
        const threadAssigns = globData['thread-project-assignments'] || {}
        const threadTitles = globData['thread-titles'] || {}
        const sidebarOrders = globData['sidebar-project-thread-orders'] || {}

        // Find matching projects in Codex
        const matchedProjects = {}
        Object.values(projects).forEach((p) => {
          const roots = Array.isArray(p.rootPaths)
            ? p.rootPaths
            : [p.rootPath, p.path].filter(Boolean)
          const isMatch =
            matchesProject(roots[0] || '', p.name || '') ||
            roots.some((rp) => matchesProject(rp, ''))
          if (isMatch) {
            matchedProjects[p.id] = {
              name: p.name || basename(roots[0] || '') || '项目',
              path: roots[0] || ''
            }
          }
        })

        const indexMap = {}
        const lines = readFileSync(sessIndexPath, 'utf-8').split('\n').filter(Boolean)
        lines.forEach((l) => {
          try {
            const item = JSON.parse(l)
            indexMap[item.id] = item
          } catch {}
        })

        const matchedThreadIds = new Map()

        // A) sidebar orders
        Object.entries(matchedProjects).forEach(([pId, pMeta]) => {
          if (sidebarOrders[pId]?.threadIds) {
            sidebarOrders[pId].threadIds.forEach((id) => {
              matchedThreadIds.set(id, { repoName: pMeta.name, repoPath: pMeta.path })
            })
          }
        })

        // B) thread assigns
        Object.entries(threadAssigns).forEach(([tId, assign]) => {
          if (assign && assign.projectId && matchedProjects[assign.projectId]) {
            const pMeta = matchedProjects[assign.projectId]
            if (!matchedThreadIds.has(tId)) {
              matchedThreadIds.set(tId, { repoName: pMeta.name, repoPath: pMeta.path })
            }
          } else if (assign && assign.cwd && matchesProject(assign.cwd, '')) {
            if (!matchedThreadIds.has(tId)) {
              matchedThreadIds.set(tId, {
                repoName: basename(assign.cwd) || '项目',
                repoPath: assign.cwd
              })
            }
          }
        })

        // C) Direct match thread_name
        lines.forEach((l) => {
          try {
            const item = JSON.parse(l)
            if (item.thread_name && matchesProject('', item.thread_name)) {
              if (!matchedThreadIds.has(item.id)) {
                matchedThreadIds.set(item.id, {
                  repoName: repoNames[0] || '项目',
                  repoPath: repoPaths[0] || ''
                })
              }
            }
          } catch {}
        })

        matchedThreadIds.forEach((meta, tId) => {
          if (seenIds.has(tId)) return
          const item = indexMap[tId] || {}
          const title = threadTitles[tId] || item.thread_name
          if (!title) return

          const dateObj = item.updated_at ? new Date(item.updated_at) : new Date(0)
          const ts = dateObj.getTime()
          const inRange = ts > 0 && ts >= sinceMs && ts <= untilMs

          const chatObj = {
            id: `codex-${tId}`,
            sessionId: tId,
            agent: 'ChatGPT / Codex',
            title,
            summary: title,
            repoName: meta.repoName || repoNames[0] || '项目',
            repoPath: meta.repoPath || repoPaths[0] || '',
            date: dateObj.toISOString().slice(0, 10),
            updatedAt: dateObj.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
            rawTimestamp: ts,
            messageCount: item.num_messages || 2,
            messages: [],
            preview: title,
            included: true
          }

          if (inRange) {
            seenIds.add(tId)
            chats.push(chatObj)
          } else if (ts > 0) {
            allDiscoveredChats.push(chatObj)
          }
        })
      } catch (err) {
        console.error('Failed to parse Codex chats for weekly report:', err)
      }
    }
  }

  // 2. Query Claude Code from ~/.claude/projects/
  if (agent === 'ALL' || agent.toLowerCase().includes('claude')) {
    const claudeProjectsDir = join(homedir(), '.claude', 'projects')
    if (existsSync(claudeProjectsDir)) {
      try {
        const pDirs = readdirSync(claudeProjectsDir, { withFileTypes: true })
        for (const dirent of pDirs) {
          if (!dirent.isDirectory()) continue
          const dName = dirent.name
          const fullProjDir = join(claudeProjectsDir, dName)
          const dNameLower = dName.toLowerCase()
          let isMatch = false
          let matchedRepoPath = ''
          let matchedRepoName = ''

          for (const rPath of targetPaths) {
            const encoded = rPath.replace(/[/\\]/g, '-').toLowerCase()
            const encodedWithLeading = (
              '-' +
              rPath.replace(/^[/\\]+/, '').replace(/[/\\]/g, '-')
            ).toLowerCase()
            if (
              dNameLower === encoded ||
              dNameLower === encodedWithLeading ||
              dNameLower.endsWith('-' + basename(rPath).toLowerCase())
            ) {
              isMatch = true
              matchedRepoPath = rPath
              matchedRepoName = basename(rPath)
              break
            }
          }

          if (!isMatch) {
            for (const rName of targetNames) {
              if (dNameLower.endsWith('-' + rName) || dNameLower === rName) {
                isMatch = true
                matchedRepoName = rName
                break
              }
            }
          }

          let sessionFiles = []
          try {
            sessionFiles = readdirSync(fullProjDir).filter((f) => f.endsWith('.jsonl'))
          } catch {}

          if (!isMatch && sessionFiles.length > 0) {
            try {
              const sampleLines = readFileSync(join(fullProjDir, sessionFiles[0]), 'utf-8')
                .split('\n')
                .slice(0, 10)
              for (const sl of sampleLines) {
                if (!sl) continue
                try {
                  const it = JSON.parse(sl)
                  if (it.cwd && matchesProject(it.cwd, basename(it.cwd))) {
                    isMatch = true
                    matchedRepoPath = it.cwd
                    matchedRepoName = basename(it.cwd)
                    break
                  }
                } catch {}
              }
            } catch {}
          }

          if (!isMatch) continue

          for (const sFile of sessionFiles) {
            const sId = basename(sFile, '.jsonl')
            if (seenIds.has(sId)) continue
            const fullSFile = join(fullProjDir, sFile)

            try {
              const sStat = statSync(fullSFile)
              const parsed = parseClaudeSessionFile(fullSFile)
              if (!parsed) continue

              const ts = parsed.latestTimestamp || sStat.mtimeMs
              const inRange = ts > 0 && ts >= sinceMs && ts <= untilMs
              const dateObj = new Date(ts)

              const chatObj = {
                id: `claude-${sId}`,
                sessionId: sId,
                agent: 'Claude Code',
                title: parsed.title,
                summary: parsed.summary,
                repoName: matchedRepoName || repoNames[0] || '项目',
                repoPath: matchedRepoPath || parsed.projectCwd || repoPaths[0] || '',
                date: dateObj.toISOString().slice(0, 10),
                updatedAt: dateObj.toLocaleTimeString('zh-CN', {
                  hour: '2-digit',
                  minute: '2-digit'
                }),
                rawTimestamp: ts,
                messageCount: parsed.messageCount || 1,
                messages: parsed.messages || [],
                preview: parsed.title,
                included: true
              }

              if (inRange) {
                seenIds.add(sId)
                chats.push(chatObj)
              } else if (ts > 0) {
                allDiscoveredChats.push(chatObj)
              }
            } catch {}
          }
        }
      } catch (err) {
        console.error('Failed to parse Claude projects for weekly report:', err)
      }
    }

    // Fallback: Also check ~/.claude/history.jsonl for older sessions not in projects
    const claudeHist = join(homedir(), '.claude', 'history.jsonl')
    if (existsSync(claudeHist)) {
      try {
        const lines = readFileSync(claudeHist, 'utf-8').split('\n').filter(Boolean)
        const sessionMap = new Map()

        lines.forEach((line) => {
          try {
            const item = JSON.parse(line)
            const p = item.project || ''
            if (matchesProject(p, basename(p))) {
              const sId = String(item.sessionId || item.timestamp)
              if (!sessionMap.has(sId)) {
                sessionMap.set(sId, {
                  sessionId: sId,
                  timestamp: item.timestamp || 0,
                  project: p,
                  displays: []
                })
              }
              if (item.display) {
                sessionMap.get(sId).displays.push({
                  text: item.display,
                  time: item.timestamp
                })
              }
            }
          } catch {}
        })

        sessionMap.forEach((sess, sId) => {
          if (seenIds.has(sId)) return
          const dateObj = sess.timestamp ? new Date(sess.timestamp) : new Date(0)
          const ts = dateObj.getTime()
          const inRange = ts > 0 && ts >= sinceMs && ts <= untilMs

          const firstUserDisplay = sess.displays.find(
            (d) => typeof d.text === 'string' && d.text.length > 2 && d.text !== 'status'
          )?.text
          const title = firstUserDisplay
            ? firstUserDisplay.slice(0, 60)
            : `Claude Code 会话 ${sId.slice(0, 8)}`

          const chatObj = {
            id: `claude-${sId}`,
            sessionId: sId,
            agent: 'Claude Code',
            title,
            summary: title,
            repoName: basename(sess.project) || repoNames[0] || '项目',
            repoPath: sess.project || repoPaths[0] || '',
            date: dateObj.toISOString().slice(0, 10),
            updatedAt: dateObj.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
            rawTimestamp: ts,
            messageCount: Math.max(1, sess.displays.length),
            messages: [],
            preview: title,
            included: true
          }

          if (inRange) {
            seenIds.add(sId)
            chats.push(chatObj)
          } else if (ts > 0) {
            allDiscoveredChats.push(chatObj)
          }
        })
      } catch (err) {
        console.error('Failed to parse Claude history fallback for weekly report:', err)
      }
    }
  }

  // 3. Query Cursor (Composer & Agent Transcripts)
  if (agent === 'ALL' || agent.toLowerCase().includes('cursor')) {
    const cursorProjectsDir = join(homedir(), '.cursor', 'projects')
    if (existsSync(cursorProjectsDir)) {
      try {
        const entries = readdirSync(cursorProjectsDir)
        for (const entry of entries) {
          const norm = entry.toLowerCase().replace(/-/g, '/')
          const isMatch =
            Array.from(targetPaths).some((tp) => norm.endsWith(tp.slice(1))) ||
            Array.from(targetNames).some((tn) => entry.toLowerCase().includes(tn))
          if (!isMatch) continue

          const transDir = join(cursorProjectsDir, entry, 'agent-transcripts')
          if (!existsSync(transDir)) continue

          const sIds = readdirSync(transDir)
          for (const sId of sIds) {
            if (seenIds.has(sId)) continue
            const jsonl = join(transDir, sId, `${sId}.jsonl`)
            if (!existsSync(jsonl)) continue
            try {
              const stat = statSync(jsonl)
              const ts = stat.mtimeMs
              const inRange = ts > 0 && ts >= sinceMs && ts <= untilMs

              let title = ''
              const lines = readFileSync(jsonl, 'utf-8').split('\n').filter(Boolean)
              for (const l of lines) {
                try {
                  const item = JSON.parse(l)
                  let text = ''
                  if (item.content && typeof item.content === 'string') text = item.content
                  else if (item.message?.content) {
                    if (typeof item.message.content === 'string') text = item.message.content
                    else if (Array.isArray(item.message.content)) {
                      text = item.message.content.map((c) => c.text || '').join('\n')
                    }
                  }
                  if (text) {
                    const cleanText = text
                      .replace(/<user_query>([\s\S]*?)<\/user_query>/g, '$1')
                      .replace(/<[\s\S]*?>/g, '')
                      .trim()
                    if (
                      (item.role === 'user' || item.message?.role === 'user') &&
                      !title &&
                      cleanText.length > 2
                    ) {
                      title = cleanText.slice(0, 60)
                      break
                    }
                  }
                } catch {}
              }
              if (!title) title = `Cursor 会话 ${sId.slice(0, 8)}`
              const chatObj = {
                id: `cursor-${sId}`,
                sessionId: sId,
                agent: 'Cursor Composer',
                title,
                summary: title,
                repoName: repoNames[0] || basename(entry) || '项目',
                repoPath: repoPaths[0] || '',
                date: new Date(ts).toISOString().slice(0, 10),
                updatedAt: new Date(ts).toLocaleTimeString('zh-CN', {
                  hour: '2-digit',
                  minute: '2-digit'
                }),
                rawTimestamp: ts,
                messageCount: 2,
                messages: [],
                preview: title,
                included: true
              }

              if (inRange) {
                seenIds.add(sId)
                chats.push(chatObj)
              } else if (ts > 0) {
                allDiscoveredChats.push(chatObj)
              }
            } catch {}
          }
        }
      } catch (err) {
        console.error('Failed to parse Cursor chats for weekly report:', err)
      }
    }
  }

  // 4. Query Antigravity (Gemini) Conversations
  if (
    agent === 'ALL' ||
    agent.toLowerCase().includes('antigravity') ||
    agent.toLowerCase().includes('gemini')
  ) {
    const brainDir = join(homedir(), '.gemini', 'antigravity', 'brain')
    if (existsSync(brainDir)) {
      try {
        const convos = readdirSync(brainDir)
        for (const cid of convos) {
          if (seenIds.has(cid)) continue
          const jsonl = join(brainDir, cid, '.system_generated', 'logs', 'transcript.jsonl')
          if (!existsSync(jsonl)) continue
          try {
            const stat = statSync(jsonl)
            const ts = stat.mtimeMs
            const inRange = ts > 0 && ts >= sinceMs && ts <= untilMs

            const fd = openSync(jsonl, 'r')
            const buf = Buffer.alloc(16384)
            const bytesRead = readSync(fd, buf, 0, 16384, 0)
            closeSync(fd)
            const header = buf.toString('utf8', 0, bytesRead)

            const isMatch =
              Array.from(targetPaths).some((tp) => header.includes(tp)) ||
              Array.from(targetNames).some((tn) => header.toLowerCase().includes(tn))
            if (!isMatch) continue

            let title = ''
            const lines = header.split('\n').filter(Boolean)
            for (const l of lines) {
              try {
                const item = JSON.parse(l)
                if (item.type === 'USER_INPUT' && item.content) {
                  const clean = item.content.replace(/<[\s\S]*?>/g, '').trim()
                  if (clean.length > 2) {
                    title = clean.slice(0, 60)
                    break
                  }
                }
              } catch {}
            }
            if (!title) title = `Antigravity 研讨 ${cid.slice(0, 8)}`

            const chatObj = {
              id: `antigravity-${cid}`,
              sessionId: cid,
              agent: 'Antigravity (Gemini)',
              title,
              summary: title,
              repoName: repoNames[0] || '项目',
              repoPath: repoPaths[0] || '',
              date: new Date(ts).toISOString().slice(0, 10),
              updatedAt: new Date(ts).toLocaleTimeString('zh-CN', {
                hour: '2-digit',
                minute: '2-digit'
              }),
              rawTimestamp: ts,
              messageCount: 2,
              messages: [],
              preview: title,
              included: true
            }

            if (inRange) {
              seenIds.add(cid)
              chats.push(chatObj)
            } else if (ts > 0) {
              allDiscoveredChats.push(chatObj)
            }
          } catch {}
        }
      } catch (err) {
        console.error('Failed to parse Antigravity chats for weekly report:', err)
      }
    }
  }

  // Sort descending by timestamp
  chats.sort((a, b) => b.rawTimestamp - a.rawTimestamp)
  allDiscoveredChats.sort((a, b) => b.rawTimestamp - a.rawTimestamp)

  // Attach fallback and total count properties to the array
  const fallbackRecentChats = allDiscoveredChats.slice(0, 40)
  chats.fallbackRecentChats = fallbackRecentChats
  chats.totalDiscoveredCount = chats.length + allDiscoveredChats.length

  cachedAgentChatsKey = cacheKey
  cachedAgentChatsRes = chats
  cachedAgentChatsTime = Date.now()

  return chats
}

/**
 * Built-in intelligent AI synthesizer for weekly reports
 */
function generateBuiltinWeeklyReport({
  commits = [],
  chatRecords = [],
  repoNames = [],
  dateRange = ''
}) {
  const totalCommits = commits.length
  const totalChats = chatRecords.length
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
    `> **周期**：${timeText}  |  **关联项目**：${reposText}  |  **代码提交**：${totalCommits} 次 Commit${
      totalChats > 0 ? `  |  **智能体会话**：${totalChats} 场研讨` : ''
    }`
  )
  lines.push('')
  lines.push('---')
  lines.push('')
  lines.push('## 🌟 本周核心工作概览')

  const agentNames = Array.from(new Set(chatRecords.map((c) => c.agent || '智能体')))
  const agentSummaryPhrase =
    totalChats > 0
      ? `，并与 **${agentNames.join('、')}** 开展了 **${totalChats}** 场深度技术研讨与方案攻坚`
      : ''

  lines.push(
    `本周重点围绕 **${reposText}** 展开研发与迭代工作。累计完成 **${totalCommits}** 项代码提交与业务改进${agentSummaryPhrase}。重点交付了 ${
      features.length > 0 ? `${features.length} 项核心功能需求` : '多项工程优化'
    }${bugfixes.length > 0 ? ` 并修复了 ${bugfixes.length} 个缺陷问题` : ''}，系统整体稳定性与研发交付质量得到进一步提升。`
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

  // 2. Agent Collaboration Section (NEW)
  if (chatRecords.length > 0) {
    lines.push('## 🤖 智能体研发协作与技术研讨')
    lines.push('本周在项目开发推进过程中，充分协同各个智能体开展技术方案推演、疑难排查与代码落地：')
    chatRecords.forEach((chat) => {
      const icon = chat.agent?.includes('Claude')
        ? '🤖'
        : chat.agent?.includes('Codex') || chat.agent?.includes('ChatGPT')
          ? '🧠'
          : '⚡'
      lines.push(
        `- ${icon} **[${chat.agent} · ${chat.repoName || '工程'}]** 《${chat.title || chat.summary}》 (${chat.date || chat.updatedAt || '本周'})`
      )
      if (chat.messages && chat.messages.length > 0) {
        const userMsg = chat.messages.find((m) => m.role === 'user')?.content?.trim()
        const assistantMsg = chat.messages
          .slice()
          .reverse()
          .find((m) => m.role === 'assistant')?.content?.trim()
        if (userMsg) {
          lines.push(`  - *研讨目标*：${userMsg.slice(0, 100)}...`)
        }
        if (assistantMsg) {
          lines.push(`  - *方案结论*：${assistantMsg.slice(0, 120)}...`)
        }
      } else if (chat.preview && chat.preview !== chat.title) {
        lines.push(`  - *讨论要点*：${chat.preview}`)
      } else if (chat.notes) {
        lines.push(`  - *讨论要点*：${chat.notes}`)
      }
    })
    lines.push('')
  }

  // 3. Fixes & Refactors
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

  // 4. Documentation & Collaboration
  if (docs.length > 0) {
    lines.push('## 📚 文档与规范建设')
    docs.forEach((f) => {
      lines.push(`- 📖 ${f.subject} (\`${f.repoName}\` · ${f.author})`)
    })
    lines.push('')
  }

  // 5. Next Week Plan
  lines.push('## 📈 下周工作计划与展望')
  lines.push('1. 持续跟进本周交付特性的线上表现与回归测试，确保新版本交付质量。')
  lines.push('2. 推进下一阶段核心需求的设计评审与技术方案落地，完善前后端联调链路。')
  if (chatRecords.length > 0) {
    lines.push('3. 针对智能体会话中已达成技术共识的设计方案，推进代码落地与集成验证。')
  }
  lines.push('4. 持续优化工程化脚本与自动化构建效率，提升代码覆盖率与交付节奏。')
  lines.push('')

  // 6. Risks & Notes
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
  chatRecords = [],
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
    text: `[数据解析] 汇集 ${commits.length} 条提交记录、${chatRecords.length} 场智能体研发会话，涉及项目: ${repoNames.join(', ') || '未指定'}\n`
  })

  // Format commits block for prompt injection
  const commitsText =
    commits.length > 0
      ? commits
          .map(
            (c, i) =>
              `${i + 1}. [${c.repoName || 'Repo'}] [${c.shortHash}] (${c.date} 作者:${c.author}): ${c.subject}${c.stats?.statSummary ? ` (${c.stats.statSummary})` : ''}`
          )
          .join('\n')
      : '（暂无代码提交记录）'

  // Enrich selected chat records with messages on demand if needed
  const enrichedChatRecords = (chatRecords || []).map((c) => {
    if (c.messages && c.messages.length > 0) return c
    try {
      const msgs = getAgentSessionMessages(c.sessionId, c.agent)
      return {
        ...c,
        messages: msgs,
        messageCount: msgs.length || c.messageCount || 1
      }
    } catch {
      return c
    }
  })

  // Format chat records block for prompt injection
  const chatsText =
    enrichedChatRecords.length > 0
      ? enrichedChatRecords
          .map((s, i) => {
            let msgSummary = ''
            if (s.messages && s.messages.length > 0) {
              const userMsg = s.messages.find((m) => m.role === 'user')?.content?.trim()
              const assistantMsg = s.messages
                .slice()
                .reverse()
                .find((m) => m.role === 'assistant')?.content?.trim()
              const parts = []
              if (userMsg) parts.push(`需求/目标: "${userMsg.slice(0, 120)}"`)
              if (assistantMsg) parts.push(`方案/产出: "${assistantMsg.slice(0, 160)}"`)
              if (parts.length > 0) msgSummary = `\n   - 对话要点: ${parts.join(' | ')}`
            } else if (s.preview && s.preview !== s.title) {
              msgSummary = `\n   - 研讨要点: ${s.preview}`
            } else if (s.notes) {
              msgSummary = `\n   - 研讨要点: ${s.notes}`
            }
            return `${i + 1}. [${s.agent || '智能体'}] [${s.repoName || '项目'}] (${s.date || s.updatedAt || '近期'}) 《${s.title || s.summary}》 (共 ${s.messageCount || s.messages?.length || 0} 轮对话)${msgSummary}`
          })
          .join('\n')
      : '（本周暂未勾选关联智能体聊天记录）'

  let resolvedPrompt = (prompt || '')
    .replaceAll('{commits}', commitsText)
    .replaceAll('{chatRecords}', chatsText)
    .replaceAll('{chats}', chatsText)
    .replaceAll('{repoName}', repoNames.join('、') || '本地仓库')
    .replaceAll('{dateRange}', dateRange || '最近一周')
    .replaceAll('{author}', commits[0]?.author || '当前开发者')
    .replaceAll('{startDate}', dateRange.split('~')[0]?.trim() || '本周起始')
    .replaceAll('{endDate}', dateRange.split('~')[1]?.trim() || '今天')

  // If prompt didn't have {chatRecords} but user selected chats, append them to prompt
  if (
    enrichedChatRecords.length > 0 &&
    !prompt.includes('{chatRecords}') &&
    !prompt.includes('{chats}')
  ) {
    resolvedPrompt += `\n\n【关联智能体研发会话与聊天记录】：\n${chatsText}`
  }

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
    const reportText = generateBuiltinWeeklyReport({
      commits,
      chatRecords: enrichedChatRecords,
      repoNames,
      dateRange
    })
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
        const fallbackReport = generateBuiltinWeeklyReport({
          commits,
          chatRecords,
          repoNames,
          dateRange
        })
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
      const fallbackReport = generateBuiltinWeeklyReport({
        commits,
        chatRecords,
        repoNames,
        dateRange
      })
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

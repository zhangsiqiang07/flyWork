import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

const DEFAULT_PROMPT = `请根据以下 Git 提交记录以及各个智能体关联项目的研发会话记录，为我生成一份专业、精炼、结构清晰的本周工作周报（Markdown 格式）。

周报内容结构要求：
1. 🌟 本周工作概览（用 2-3 句话总结本周的核心产出、业务价值与智能体协同成效）
2. 🚀 重点功能与需求交付（按模块/业务线分类，结合代码提交与智能体方案讨论突出重要改动）
3. 🤖 智能体研发协作与技术研讨（提炼与各个智能体协同解决的关键方案、架构设计、技术调研与问题排查）
4. 🛠️ 缺陷修复与工程优化（列出修复的 Bug、性能优化、重构及工程化改进）
5. 📈 下周工作计划与展望（基于本周进展与讨论合理推演下周工作重点）
6. ⚠️ 风险、阻塞点与协作建议（如有）

输出规范：
- 使用标准 Markdown 语法，层次分明，可直接用于团队周报或邮件汇报。
- 语言精炼专业，条理清晰，突出成果与业务价值。

【本周 Git 提交记录详情】：
{commits}

【关联智能体研发会话记录】：
{chatRecords}`

const TIME_PRESETS = [
  { id: '7d', label: '最近 7 天' },
  { id: 'this_week', label: '本周 (周一至今)' },
  { id: 'last_week', label: '上周' },
  { id: '14d', label: '最近 14 天' },
  { id: '30d', label: '最近 30 天' },
  { id: 'all', label: '全部近期提交 (推荐)' }
]

function formatTime(isoStr) {
  if (!isoStr) return ''
  try {
    const d = new Date(isoStr)
    return d.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  } catch {
    return isoStr
  }
}

function computeSinceUntil(preset, customSince, customUntil) {
  const now = new Date()
  if (preset === '7d') {
    const d = new Date(now.getTime() - 7 * 86400000)
    return { since: d.toISOString().slice(0, 10), until: '' }
  }
  if (preset === 'this_week') {
    const day = now.getDay() || 7
    const monday = new Date(now)
    monday.setDate(now.getDate() - (day - 1))
    return { since: monday.toISOString().slice(0, 10), until: '' }
  }
  if (preset === 'last_week') {
    const day = now.getDay() || 7
    const lastMon = new Date(now)
    lastMon.setDate(now.getDate() - (day - 1) - 7)
    const lastSun = new Date(lastMon)
    lastSun.setDate(lastMon.getDate() + 6)
    return { since: lastMon.toISOString().slice(0, 10), until: lastSun.toISOString().slice(0, 10) }
  }
  if (preset === '14d') {
    const d = new Date(now.getTime() - 14 * 86400000)
    return { since: d.toISOString().slice(0, 10), until: '' }
  }
  if (preset === '30d') {
    const d = new Date(now.getTime() - 30 * 86400000)
    return { since: d.toISOString().slice(0, 10), until: '' }
  }
  if (preset === 'all') {
    return { since: '', until: '' }
  }
  if (preset === 'custom') {
    return { since: customSince || '', until: customUntil || '' }
  }
  return { since: '', until: '' }
}

export default function WeeklyReport({
  workspaces = [],
  sessions = [],
  chatHistories = {},
  weeklyReports = [],
  setWeeklyReports,
  cachedRepos = [],
  setCachedRepos,
  cachedPrompt = '',
  setCachedPrompt,
  initialRepoPath = null
}) {
  // 1. Repositories state
  const [repos, setRepos] = useState([])
  const [selectedRepoPaths, setSelectedRepoPaths] = useState(new Set())

  // 2. Filter states
  const [timePreset, setTimePreset] = useState('7d')
  const [customSince, setCustomSince] = useState('')
  const [customUntil, setCustomUntil] = useState('')
  const [selectedAuthor, setSelectedAuthor] = useState('ALL')

  // 3. Commits state
  const [commitsData, setCommitsData] = useState([])
  const [isLoadingCommits, setIsLoadingCommits] = useState(false)
  const [selectedCommitIds, setSelectedCommitIds] = useState(new Set())
  const [manualCommits, setManualCommits] = useState([])

  // 3.1 Agent Chats state
  const [chatsData, setChatsData] = useState([])
  const [fallbackRecentChats, setFallbackRecentChats] = useState([])
  const [totalDiscoveredChatsCount, setTotalDiscoveredChatsCount] = useState(0)
  const [isLoadingChats, setIsLoadingChats] = useState(false)
  const [selectedChatIds, setSelectedChatIds] = useState(new Set())
  const [selectedChatAgent, setSelectedChatAgent] = useState('ALL')
  const [activeDetailChat, setActiveDetailChat] = useState(null)
  const [isLoadingDetailMessages, setIsLoadingDetailMessages] = useState(false)
  const [recordListTab, setRecordListTab] = useState('commits') // 'commits' | 'chats'

  // 4. Prompt state
  const [promptTemplate, setPromptTemplate] = useState(cachedPrompt || DEFAULT_PROMPT)
  const [showPromptEditor, setShowPromptEditor] = useState(false)

  // 5. Agents state
  const [agents, setAgents] = useState({})
  const [selectedAgentId, setSelectedAgentId] = useState('builtin')

  // 6. Generation & Output state
  const [isGenerating, setIsGenerating] = useState(false)
  const [activeTaskId, setActiveTaskId] = useState(null)
  const [activeReportId, setActiveReportId] = useState(null)
  const [currentReportContent, setCurrentReportContent] = useState('')
  const [currentReportTitle, setCurrentReportTitle] = useState('')
  const [viewMode, setViewMode] = useState('preview') // 'preview' | 'edit' | 'log'
  const [generationLogs, setGenerationLogs] = useState([])
  const [copyFeedback, setCopyFeedback] = useState(false)
  const [saveFeedback, setSaveFeedback] = useState(false)

  // 7. History Drawer state
  const [showHistoryDrawer, setShowHistoryDrawer] = useState(false)
  const [historySearch, setHistorySearch] = useState('')

  const logEndRef = useRef(null)
  const fetchCommitSeqRef = useRef(0)
  const fetchChatsSeqRef = useRef(0)

  // Initialize and merge repositories from workspaces + cached repos
  useEffect(() => {
    const map = new Map()

    // 1. From active workspaces
    workspaces.forEach((ws) => {
      if (ws.root) {
        map.set(ws.root, {
          path: ws.root,
          name: ws.name || ws.root.split('/').pop(),
          icon: ws.icon || '📁',
          isWorkspace: true
        })
      }
    })

    // 2. From cached repos
    if (Array.isArray(cachedRepos)) {
      cachedRepos.forEach((r) => {
        if (r && r.path && !map.has(r.path)) {
          map.set(r.path, {
            path: r.path,
            name: r.name || r.path.split('/').pop(),
            icon: r.icon || '📂',
            isWorkspace: false
          })
        }
      })
    }

    const merged = Array.from(map.values())
    setRepos((prev) => {
      if (
        prev.length === merged.length &&
        prev.every((r, i) => r.path === merged[i]?.path && r.name === merged[i]?.name)
      ) {
        return prev
      }
      return merged
    })

    // Default select initialRepoPath or retain existing selection or select all
    setSelectedRepoPaths((prev) => {
      if (initialRepoPath && map.has(initialRepoPath)) {
        if (prev.size === 1 && prev.has(initialRepoPath)) return prev
        return new Set([initialRepoPath])
      }
      if (prev && prev.size > 0) {
        const validSelections = Array.from(prev).filter((p) => map.has(p))
        if (validSelections.length > 0) {
          if (validSelections.length === prev.size) {
            return prev
          }
          return new Set(validSelections)
        }
      }
      return new Set(merged.map((r) => r.path))
    })
  }, [workspaces, cachedRepos, initialRepoPath])

  // Detect local agents
  useEffect(() => {
    async function checkAgents() {
      if (window.flywork?.detectLocalAgents) {
        try {
          const res = await window.flywork.detectLocalAgents()
          if (res) {
            setAgents(res)
            // Auto pick first available CLI agent or default to builtin
            if (res.codex?.installed) setSelectedAgentId('codex')
            else if (res.claude?.installed) setSelectedAgentId('claude')
            else if (res.gemini?.installed) setSelectedAgentId('gemini')
            else setSelectedAgentId('builtin')
          }
        } catch (e) {
          console.error('Failed to detect agents:', e)
        }
      }
    }
    checkAgents()
  }, [])

  // Auto-sync prompt changes to cache
  const handlePromptChange = (newPrompt) => {
    setPromptTemplate(newPrompt)
    if (setCachedPrompt) setCachedPrompt(newPrompt)
  }

  // Add custom repository via folder picker
  const handleAddRepository = async () => {
    if (!window.flywork?.showOpenDialog) return
    try {
      const res = await window.flywork.showOpenDialog({
        properties: ['openDirectory'],
        title: '选择要添加的 Git 仓库文件夹'
      })
      if (res && !res.canceled && res.filePaths && res.filePaths.length > 0) {
        const folderPath = res.filePaths[0]
        const folderName = folderPath.split('/').filter(Boolean).pop() || 'Repo'
        const newRepo = {
          path: folderPath,
          name: folderName,
          icon: '📂',
          isWorkspace: false
        }

        setRepos((prev) => {
          if (prev.some((r) => r.path === folderPath)) return prev
          const next = [...prev, newRepo]
          if (setCachedRepos) setCachedRepos(next.filter((r) => !r.isWorkspace))
          return next
        })
        setSelectedRepoPaths((prev) => new Set([...prev, folderPath]))
      }
    } catch (err) {
      console.error('Failed to add repo:', err)
    }
  }

  // Remove custom repository
  const handleRemoveRepo = (path) => {
    setRepos((prev) => {
      const next = prev.filter((r) => r.path !== path)
      if (setCachedRepos) setCachedRepos(next.filter((r) => !r.isWorkspace))
      return next
    })
    setSelectedRepoPaths((prev) => {
      const next = new Set(prev)
      next.delete(path)
      return next
    })
  }

  // Toggle single repo selection
  const handleToggleRepo = (path) => {
    setSelectedRepoPaths((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  // Select all / Invert repos
  const handleSelectAllRepos = () => {
    if (selectedRepoPaths.size === repos.length) {
      setSelectedRepoPaths(new Set())
    } else {
      setSelectedRepoPaths(new Set(repos.map((r) => r.path)))
    }
  }

  const selectedRepoPathsKey = useMemo(
    () => Array.from(selectedRepoPaths).sort().join(','),
    [selectedRepoPaths]
  )

  // Fetch commits from selected repositories
  const fetchCommits = useCallback(async () => {
    const activePaths = Array.from(selectedRepoPaths)
    if (activePaths.length === 0) {
      setCommitsData([])
      setSelectedCommitIds(new Set())
      setManualCommits([])
      return
    }

    const seq = ++fetchCommitSeqRef.current
    setIsLoadingCommits(true)
    try {
      const { since, until } = computeSinceUntil(timePreset, customSince, customUntil)

      if (window.flywork?.getWeeklyCommits) {
        const res = await window.flywork.getWeeklyCommits({
          repoPaths: activePaths,
          since,
          until,
          author: selectedAuthor === 'ALL' ? '' : selectedAuthor,
          limit: timePreset === 'all' ? 50 : 100
        })

        if (seq !== fetchCommitSeqRef.current) return

        if (res.success && Array.isArray(res.results)) {
          setCommitsData(res.results)
          setManualCommits([])

          // Default check all fetched commits
          const allIds = new Set()
          res.results.forEach((group) => {
            group.commits?.forEach((c) => allIds.add(c.id))
          })
          setSelectedCommitIds(allIds)
        }
      }
    } catch (err) {
      if (seq === fetchCommitSeqRef.current) {
        console.error('Failed to get commits:', err)
      }
    } finally {
      if (seq === fetchCommitSeqRef.current) {
        setIsLoadingCommits(false)
      }
    }
  }, [selectedRepoPathsKey, timePreset, customSince, customUntil, selectedAuthor])

  // Fetch commits whenever repos, time preset, or author changes
  useEffect(() => {
    fetchCommits()
  }, [fetchCommits])

  // Fetch agent chats from selected repositories & workspaces
  const fetchAgentChats = useCallback(async () => {
    const activePaths = Array.from(selectedRepoPaths)
    const activeRepoNames = repos
      .filter((r) => selectedRepoPaths.has(r.path))
      .map((r) => r.name)

    if (activePaths.length === 0) {
      setChatsData([])
      setSelectedChatIds(new Set())
      return
    }

    const seq = ++fetchChatsSeqRef.current
    setIsLoadingChats(true)
    try {
      const { since, until } = computeSinceUntil(timePreset, customSince, customUntil)
      let collectedChats = []

      // 1. Fetch native agent chats from main process
      if (window.flywork?.getWeeklyAgentChats) {
        try {
          const res = await window.flywork.getWeeklyAgentChats({
            repoPaths: activePaths,
            repoNames: activeRepoNames,
            since,
            until,
            agent: 'ALL'
          })
          if (res?.success && Array.isArray(res.chats)) {
            collectedChats.push(...res.chats)
            setFallbackRecentChats(res.fallbackRecentChats || [])
            setTotalDiscoveredChatsCount(res.totalDiscoveredCount || res.chats.length)
          }
        } catch (e) {
          console.error('Failed to get native agent chats:', e)
        }
      }

      if (seq !== fetchChatsSeqRef.current) return

      // 2. Also incorporate in-app workspace sessions matching selected repositories
      const seenSessionIds = new Set(collectedChats.map((c) => c.sessionId))

      const matchingWorkspaces = workspaces.filter(
        (ws) =>
          ws &&
          (activePaths.includes(ws.root) ||
            activeRepoNames.some((n) => n && ws.name?.toLowerCase().includes(n.toLowerCase())))
      )

      const sinceMs = since ? new Date(`${since}T00:00:00`).getTime() : 0
      const untilMs = until ? new Date(`${until}T23:59:59`).getTime() : Infinity

      matchingWorkspaces.forEach((ws) => {
        // A) Find sessions for this workspace
        const wsSessions = (sessions || []).filter((s) => s.workspaceId === ws.id)
        wsSessions.forEach((s) => {
          if (seenSessionIds.has(s.id)) return
          const dateObj = s.updatedAt ? new Date(s.updatedAt) : new Date()
          const ts = dateObj.getTime()
          if (ts > 0 && (ts < sinceMs || ts > untilMs)) return

          seenSessionIds.add(s.id)

          // Build messages list
          let msgs = Array.isArray(s.messages) ? s.messages : []
          if (msgs.length === 0 && s.notes) {
            msgs = [
              {
                role: 'assistant',
                content: s.notes,
                time: s.updatedAt ? formatTime(s.updatedAt) : ''
              }
            ]
          }

          const defaultAgentName =
            s.aiTasks?.[0]?.agent || ws.defaultAgent || 'FlyDeck AI'

          collectedChats.push({
            id: `app-sess-${s.id}`,
            sessionId: s.id,
            agent: defaultAgentName,
            title: s.title || `会话 ${s.id}`,
            summary: s.title || s.notes || '项目协作研讨',
            repoName: ws.name || '工作空间',
            repoPath: ws.root || '',
            date: dateObj.toISOString().slice(0, 10),
            updatedAt: formatTime(s.updatedAt),
            rawTimestamp: ts,
            messageCount: Math.max(msgs.length, s.aiTasks?.length || 1),
            messages: msgs,
            preview: s.notes || s.title || '工作空间研发推进',
            notes: s.notes,
            included: true
          })
        })

        // B) Check chatHistories for this workspace without explicit session
        if (chatHistories) {
          Object.entries(chatHistories).forEach(([tKey, hMsgs]) => {
            if (tKey.startsWith(ws.id) && Array.isArray(hMsgs) && hMsgs.length > 0) {
              const syntheticId = `history-${tKey}`
              if (!seenSessionIds.has(syntheticId)) {
                seenSessionIds.add(syntheticId)
                const parts = tKey.split('_')
                const inferredAgent = parts[1] || ws.defaultAgent || 'FlyDeck AI'
                collectedChats.push({
                  id: syntheticId,
                  sessionId: syntheticId,
                  agent: inferredAgent,
                  title: `《${ws.name} 智能分析与问答》`,
                  summary: hMsgs[0]?.content?.slice(0, 60) || 'AI 研发问答与建议',
                  repoName: ws.name,
                  repoPath: ws.root,
                  date: new Date().toISOString().slice(0, 10),
                  updatedAt: '最近',
                  rawTimestamp: Date.now(),
                  messageCount: hMsgs.length,
                  messages: hMsgs,
                  preview: hMsgs[0]?.content || '',
                  included: true
                })
              }
            }
          })
        }
      })

      if (seq !== fetchChatsSeqRef.current) return

      // Sort chats descending by time
      collectedChats.sort((a, b) => b.rawTimestamp - a.rawTimestamp)
      setChatsData(collectedChats)

      // Default check all fetched chats
      setSelectedChatIds(new Set(collectedChats.map((c) => c.id)))
    } catch (err) {
      if (seq === fetchChatsSeqRef.current) {
        console.error('Failed to get agent chats:', err)
      }
    } finally {
      if (seq === fetchChatsSeqRef.current) {
        setIsLoadingChats(false)
      }
    }
  }, [
    selectedRepoPathsKey,
    repos,
    timePreset,
    customSince,
    customUntil,
    workspaces,
    sessions,
    chatHistories
  ])

  // Handle loading fallback recent chats
  const handleLoadFallbackChats = useCallback(() => {
    if (!fallbackRecentChats || fallbackRecentChats.length === 0) return
    setChatsData((prev) => {
      const existingIds = new Set(prev.map((c) => c.id))
      const toAdd = fallbackRecentChats.filter((c) => !existingIds.has(c.id))
      const combined = [...prev, ...toAdd].sort((a, b) => b.rawTimestamp - a.rawTimestamp)
      setSelectedChatIds((prevSelected) => {
        const next = new Set(prevSelected)
        toAdd.forEach((c) => next.add(c.id))
        return next
      })
      return combined
    })
    setFallbackRecentChats([])
  }, [fallbackRecentChats])

  // Open and lazily load detailed messages for a chat
  const handleOpenDetailChat = useCallback(async (chat) => {
    if (!chat) return
    setActiveDetailChat(chat)

    // If chat already has detailed messages, no need to fetch
    if (Array.isArray(chat.messages) && chat.messages.length > 0) return

    if (window.flywork?.getWeeklyChatMessages) {
      setIsLoadingDetailMessages(true)
      try {
        const res = await window.flywork.getWeeklyChatMessages(chat.sessionId, chat.agent)
        if (res?.success && Array.isArray(res.messages)) {
          setActiveDetailChat((prev) =>
            prev && prev.id === chat.id ? { ...prev, messages: res.messages } : prev
          )
          setChatsData((prev) =>
            prev.map((c) =>
              c.id === chat.id
                ? { ...c, messages: res.messages, messageCount: res.messages.length || c.messageCount }
                : c
            )
          )
        }
      } catch (err) {
        console.error('Failed to load chat messages for detail:', err)
      } finally {
        setIsLoadingDetailMessages(false)
      }
    }
  }, [])

  // Fetch chats whenever repos or time preset changes
  useEffect(() => {
    fetchAgentChats()
  }, [fetchAgentChats])

  // Filtered chats by selected agent
  const allChatAgents = useMemo(() => {
    return Array.from(new Set(chatsData.map((c) => c.agent).filter(Boolean)))
  }, [chatsData])

  const filteredChats = useMemo(() => {
    if (selectedChatAgent === 'ALL') return chatsData
    return chatsData.filter((c) => c.agent === selectedChatAgent)
  }, [chatsData, selectedChatAgent])

  const includedChats = useMemo(() => {
    return chatsData.filter((c) => selectedChatIds.has(c.id))
  }, [chatsData, selectedChatIds])

  const handleToggleChat = (id) => {
    setSelectedChatIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleSelectAllChats = (selectAll) => {
    if (selectAll) {
      setSelectedChatIds(new Set(chatsData.map((c) => c.id)))
    } else {
      setSelectedChatIds(new Set())
    }
  }

  // Load fallback recent commits
  const handleLoadFallbackCommits = () => {
    const fallbackList = []
    const allIds = new Set()
    commitsData.forEach((g) => {
      if (g.fallbackRecentCommits && g.fallbackRecentCommits.length > 0) {
        fallbackList.push(...g.fallbackRecentCommits)
        g.fallbackRecentCommits.forEach((c) => allIds.add(c.id))
      }
    })
    setManualCommits(fallbackList)
    setSelectedCommitIds(allIds)
  }

  // All extracted commits flattened
  const allCommits = useMemo(() => {
    if (manualCommits.length > 0) return manualCommits
    return commitsData.flatMap((group) => group.commits || [])
  }, [commitsData, manualCommits])

  // Distinct authors collected across all repositories
  const allAuthorsMap = useMemo(() => {
    const authors = new Map()
    commitsData.forEach((g) => {
      if (g.defaultAuthor) {
        authors.set(g.defaultAuthor, { name: g.defaultAuthor, isCurrent: true, repo: g.repoName })
      }
      g.allAuthors?.forEach((a) => {
        if (a && !authors.has(a)) {
          authors.set(a, { name: a, isCurrent: a === g.defaultAuthor, repo: g.repoName })
        }
      })
      g.commits?.forEach((c) => {
        if (c.author && !authors.has(c.author)) {
          authors.set(c.author, { name: c.author, isCurrent: false, repo: c.repoName })
        }
      })
    })
    return Array.from(authors.values())
  }, [commitsData])

  // Filtered & Included commits for prompt
  const includedCommits = useMemo(() => {
    return allCommits.filter((c) => selectedCommitIds.has(c.id))
  }, [allCommits, selectedCommitIds])

  // Toggle commit inclusion
  const handleToggleCommit = (id) => {
    setSelectedCommitIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleSelectAllCommits = (selectAll) => {
    if (selectAll) {
      setSelectedCommitIds(new Set(allCommits.map((c) => c.id)))
    } else {
      setSelectedCommitIds(new Set())
    }
  }

  // Subscribe to streaming logs
  useEffect(() => {
    if (!window.flywork?.onWeeklyReportLogChunk) return
    const unsub = window.flywork.onWeeklyReportLogChunk((chunk) => {
      setGenerationLogs((prev) => [...prev, chunk])
      if (chunk.type === 'markdown-chunk' && chunk.text) {
        setCurrentReportContent((prev) => prev + chunk.text)
      }
      setTimeout(() => {
        if (logEndRef.current) logEndRef.current.scrollTop = logEndRef.current.scrollHeight
      }, 20)
    })
    return unsub
  }, [])

  // Start Weekly Report Generation
  const handleGenerateReport = async () => {
    if (includedCommits.length === 0 && includedChats.length === 0) {
      alert('请至少勾选 1 条 Git 提交记录或 1 场智能体会话！')
      return
    }

    const taskId = `report-task-${Date.now()}`
    setActiveTaskId(taskId)
    setIsGenerating(true)
    setCurrentReportContent('')
    setGenerationLogs([])
    setViewMode('preview')

    const selectedRepoNames = repos.filter((r) => selectedRepoPaths.has(r.path)).map((r) => r.name)

    const now = new Date()
    const title = `${now.getFullYear()}年第 ${getWeekNumber(now)} 周工作周报 (${selectedRepoNames.join('、') || '项目'})`
    setCurrentReportTitle(title)

    try {
      if (window.flywork?.generateWeeklyReport) {
        const res = await window.flywork.generateWeeklyReport({
          taskId,
          agentId: selectedAgentId,
          prompt: promptTemplate,
          commits: includedCommits,
          chatRecords: includedChats,
          repoNames: selectedRepoNames,
          dateRange: getDateRangeLabel(timePreset),
          workdir: Array.from(selectedRepoPaths)[0] || ''
        })

        if (res.success && res.report) {
          setCurrentReportContent(res.report)
          const newReportItem = {
            id: `report-${Date.now()}`,
            title,
            createdAt: new Date().toISOString(),
            period: getDateRangeLabel(timePreset),
            repoNames: selectedRepoNames,
            repoPaths: Array.from(selectedRepoPaths),
            agent: agents[selectedAgentId]?.displayName || selectedAgentId,
            prompt: promptTemplate,
            content: res.report,
            commitCount: includedCommits.length,
            chatCount: includedChats.length,
            commits: includedCommits.map((c) => ({
              hash: c.shortHash,
              subject: c.subject,
              repo: c.repoName,
              date: c.date,
              author: c.author
            })),
            chats: includedChats.map((c) => ({
              id: c.id,
              agent: c.agent,
              title: c.title,
              repo: c.repoName,
              date: c.date
            }))
          }

          setActiveReportId(newReportItem.id)
          setWeeklyReports((prev) => [newReportItem, ...(prev || [])])
        }
      }
    } catch (err) {
      console.error('Failed to generate report:', err)
    } finally {
      setIsGenerating(false)
      setActiveTaskId(null)
    }
  }

  // Cancel Generation
  const handleCancelGeneration = async () => {
    if (activeTaskId && window.flywork?.cancelWeeklyReport) {
      await window.flywork.cancelWeeklyReport(activeTaskId)
    }
    setIsGenerating(false)
  }

  // Save edits to current report
  const handleSaveCurrentReport = () => {
    if (!currentReportContent.trim()) return
    setSaveFeedback(true)
    setTimeout(() => setSaveFeedback(false), 2000)

    if (activeReportId) {
      setWeeklyReports((prev) =>
        prev.map((r) =>
          r.id === activeReportId
            ? { ...r, content: currentReportContent, title: currentReportTitle }
            : r
        )
      )
    } else {
      const newId = `report-${Date.now()}`
      const newReportItem = {
        id: newId,
        title: currentReportTitle || `工作周报 ${new Date().toLocaleDateString()}`,
        createdAt: new Date().toISOString(),
        period: getDateRangeLabel(timePreset),
        repoNames: repos.filter((r) => selectedRepoPaths.has(r.path)).map((r) => r.name),
        repoPaths: Array.from(selectedRepoPaths),
        agent: agents[selectedAgentId]?.displayName || '手动编辑',
        prompt: promptTemplate,
        content: currentReportContent,
        commitCount: includedCommits.length,
        chatCount: includedChats.length,
        commits: includedCommits.map((c) => ({
          hash: c.shortHash,
          subject: c.subject,
          repo: c.repoName,
          date: c.date,
          author: c.author
        })),
        chats: includedChats.map((c) => ({
          id: c.id,
          agent: c.agent,
          title: c.title,
          repo: c.repoName,
          date: c.date
        }))
      }
      setActiveReportId(newId)
      setWeeklyReports((prev) => [newReportItem, ...(prev || [])])
    }
  }

  // Copy Markdown to Clipboard
  const handleCopyMarkdown = () => {
    if (!currentReportContent) return
    navigator.clipboard.writeText(currentReportContent).then(() => {
      setCopyFeedback(true)
      setTimeout(() => setCopyFeedback(false), 2000)
    })
  }

  // Export as .md file
  const handleExportMarkdown = () => {
    if (!currentReportContent) return
    const blob = new Blob([currentReportContent], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${currentReportTitle || '工作周报'}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Load a historical report
  const handleLoadReport = (report) => {
    setActiveReportId(report.id)
    setCurrentReportTitle(report.title)
    setCurrentReportContent(report.content)
    setViewMode('preview')
    setShowHistoryDrawer(false)
  }

  // Delete a historical report
  const handleDeleteReport = (e, reportId) => {
    e.stopPropagation()
    if (!confirm('确定要删除这份历史周报吗？此操作无法撤销。')) return
    setWeeklyReports((prev) => prev.filter((r) => r.id !== reportId))
    if (activeReportId === reportId) {
      setActiveReportId(null)
      setCurrentReportContent('')
      setCurrentReportTitle('')
    }
  }

  // Filtered history list
  const filteredHistory = useMemo(() => {
    if (!historySearch.trim()) return weeklyReports || []
    const q = historySearch.toLowerCase()
    return (weeklyReports || []).filter(
      (r) =>
        r.title?.toLowerCase().includes(q) ||
        r.content?.toLowerCase().includes(q) ||
        r.repoNames?.some((n) => n.toLowerCase().includes(q))
    )
  }, [weeklyReports, historySearch])

  // Check if any repo has commits in history but 0 in current range
  const hasFallbackAvailable = useMemo(() => {
    return (
      allCommits.length === 0 &&
      commitsData.some((g) => g.fallbackRecentCommits && g.fallbackRecentCommits.length > 0)
    )
  }, [allCommits, commitsData])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' }}>
      {/* Header */}
      <div
        className="page-header"
        style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)' }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 22 }}>📊</span>
              <div className="page-title" style={{ margin: 0, fontSize: 18 }}>
                周报生成与管理
              </div>
              <span className="badge badge-blue" style={{ fontSize: 11 }}>
                Git 提交自动提取 + AI 智能体
              </span>
            </div>
            <div className="page-subtitle" style={{ marginTop: 3 }}>
              支持多 Git 仓库提交记录聚合、作者与时间筛选、提示词模板定制及本地 AI 智能体驱动生成。
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setShowHistoryDrawer((p) => !p)}
              style={{ fontSize: 12 }}
            >
              🕒 历史周报 ({weeklyReports.length})
            </button>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => {
                setActiveReportId(null)
                setCurrentReportContent('')
                setCurrentReportTitle('')
                setViewMode('preview')
              }}
              style={{ fontSize: 12 }}
            >
              + 新建周报
            </button>
          </div>
        </div>
      </div>

      {/* Main Body: 2 Columns (Config & Commits on Left, Preview/Editor on Right) */}
      <div
        style={{ display: 'grid', gridTemplateColumns: '480px 1fr', flex: 1, overflow: 'hidden' }}
      >
        {/* Left Column: Repository Selection, Filters, Prompt Template & Commits */}
        <div
          style={{
            borderRight: '1px solid var(--border)',
            overflowY: 'auto',
            padding: '16px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: 16
          }}
        >
          {/* Section 1: Git Repositories */}
          <div className="card" style={{ padding: 14 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 10
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: 'var(--text-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6
                }}
              >
                <span>📁 关联 Git 仓库</span>
                <span className="badge badge-purple" style={{ fontSize: 10 }}>
                  {selectedRepoPaths.size} / {repos.length} 已选
                </span>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ fontSize: 10, padding: '2px 6px' }}
                  onClick={handleSelectAllRepos}
                >
                  {selectedRepoPaths.size === repos.length ? '取消全选' : '全选'}
                </button>
                <button
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: 10, padding: '2px 8px' }}
                  onClick={handleAddRepository}
                >
                  + 添加仓库
                </button>
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                maxHeight: 160,
                overflowY: 'auto'
              }}
            >
              {repos.length === 0 ? (
                <div
                  style={{
                    fontSize: 11,
                    color: 'var(--text-muted)',
                    padding: '8px 0',
                    textAlign: 'center'
                  }}
                >
                  暂未关联任何 Git 仓库，点击上方「+ 添加仓库」选择本地工程目录。
                </div>
              ) : (
                repos.map((r) => {
                  const isChecked = selectedRepoPaths.has(r.path)
                  const repoData = commitsData.find((g) => g.repoPath === r.path)
                  const authorName = repoData?.defaultAuthor || repoData?.latestCommit?.author || ''
                  return (
                    <div
                      key={r.path}
                      onClick={() => handleToggleRepo(r.path)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 10px',
                        borderRadius: 6,
                        background: isChecked ? 'var(--bg-selected)' : 'var(--bg-elevated)',
                        border: `1px solid ${isChecked ? 'rgba(79,158,248,0.4)' : 'var(--border)'}`,
                        cursor: 'pointer',
                        transition: 'all 120ms ease'
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          minWidth: 0,
                          flex: 1
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}}
                          style={{
                            cursor: 'pointer',
                            accentColor: 'var(--accent-blue)',
                            flexShrink: 0
                          }}
                        />
                        <span style={{ fontSize: 14, flexShrink: 0 }}>{r.icon || '📁'}</span>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div
                            style={{
                              fontSize: 12,
                              fontWeight: 600,
                              color: 'var(--text-primary)',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 6
                            }}
                          >
                            <span
                              style={{
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                              }}
                            >
                              {r.name}
                            </span>
                            {authorName && (
                              <span
                                className="badge badge-gray"
                                style={{ fontSize: 9, padding: '1px 5px' }}
                              >
                                👤 {authorName}
                              </span>
                            )}
                          </div>
                          <div
                            style={{
                              fontSize: 10,
                              color: 'var(--text-muted)',
                              fontFamily: 'monospace',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              marginTop: 2
                            }}
                          >
                            {r.path}
                          </div>
                        </div>
                      </div>

                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          flexShrink: 0,
                          marginLeft: 8
                        }}
                      >
                        {repoData?.latestCommit && (
                          <span
                            style={{
                              fontSize: 10,
                              color: 'var(--accent-green)',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            ✓ {repoData.latestCommit.date}
                          </span>
                        )}
                        {!r.isWorkspace && (
                          <button
                            className="btn btn-ghost btn-icon btn-sm"
                            style={{ fontSize: 10, padding: 2, color: 'var(--accent-red)' }}
                            title="从列表移除此仓库"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleRemoveRepo(r.path)
                            }}
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* Section 2: Time Range & Author Filter */}
          <div className="card" style={{ padding: 14 }}>
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--text-secondary)',
                marginBottom: 10
              }}
            >
              ⏱️ 提交时间与作者筛选
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
              {TIME_PRESETS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setTimePreset(p.id)}
                  className={`btn btn-sm ${timePreset === p.id ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ fontSize: 11, padding: '3px 8px' }}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Author filter dropdown */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                background: 'var(--bg-elevated)',
                padding: '6px 10px',
                borderRadius: 6,
                border: '1px solid var(--border)'
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  flexShrink: 0
                }}
              >
                👤 提交作者:
              </span>
              <select
                value={selectedAuthor}
                onChange={(e) => setSelectedAuthor(e.target.value)}
                style={{ flex: 1, fontSize: 11, minHeight: 28, padding: '2px 8px' }}
              >
                <option value="ALL">👥 全部提交作者 ({allCommits.length} 条已提取)</option>
                {allAuthorsMap.map((author) => (
                  <option key={author.name} value={author.name}>
                    👤 {author.name} {author.isCurrent ? '(当前 Git 用户)' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Section 3: AI Agent & Prompt Template */}
          <div className="card" style={{ padding: 14 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 10
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: 'var(--text-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6
                }}
              >
                <span>🤖 智能体与提示词配置</span>
              </div>
              <button
                className="btn btn-ghost btn-sm"
                style={{ fontSize: 11, color: 'var(--accent-blue)', padding: '1px 6px' }}
                onClick={() => setShowPromptEditor((p) => !p)}
              >
                {showPromptEditor ? '收起提示词 ▴' : '编辑提示词 ▾'}
              </button>
            </div>

            {/* Agent Selector */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                marginBottom: showPromptEditor ? 10 : 0
              }}
            >
              <label style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                执行智能体 (自动检测本地环境):
              </label>
              <select
                value={selectedAgentId}
                onChange={(e) => setSelectedAgentId(e.target.value)}
                style={{ width: '100%', fontSize: 12 }}
              >
                <option value="builtin">⚡ FlyDeck 智能合成引擎 (内置高质推荐)</option>
                <option value="codex">
                  🧠 ChatGPT / Codex CLI {agents.codex?.installed ? '🟢 (已安装)' : '⚪ (未检测到)'}
                </option>
                <option value="claude">
                  🤖 Claude Code CLI {agents.claude?.installed ? '🟢 (已安装)' : '⚪ (未检测到)'}
                </option>
                <option value="gemini">
                  ✨ Google Gemini CLI {agents.gemini?.installed ? '🟢 (已安装)' : '⚪ (未检测到)'}
                </option>
                <option value="opencode">
                  💻 OpenCode CLI {agents.opencode?.installed ? '🟢 (已安装)' : '⚪ (未检测到)'}
                </option>
                <option value="ollama">
                  🦙 Ollama Local LLM {agents.ollama?.installed ? '🟢 (已安装)' : '⚪ (未检测到)'}
                </option>
              </select>
            </div>

            {/* Prompt Template Editor (Foldable) */}
            {showPromptEditor && (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                  marginTop: 10,
                  borderTop: '1px dashed var(--border)',
                  paddingTop: 10
                }}
              >
                <div
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                >
                  <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                    提示词模板 (已自动缓存持久化):
                  </span>
                  <button
                    className="btn btn-ghost btn-sm"
                    style={{ fontSize: 10, padding: '1px 6px' }}
                    onClick={() => handlePromptChange(DEFAULT_PROMPT)}
                  >
                    ↺ 恢复默认
                  </button>
                </div>
                <textarea
                  className="form-control"
                  style={{
                    height: 140,
                    fontSize: 11,
                    lineHeight: 1.5,
                    fontFamily: 'monospace',
                    resize: 'vertical'
                  }}
                  value={promptTemplate}
                  onChange={(e) => handlePromptChange(e.target.value)}
                  placeholder="可使用 {commits}、{repoName}、{dateRange}、{author} 等变量占位符..."
                />
                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                  可用变量：<code>{'{commits}'}</code> 提交列表、<code>{'{repoName}'}</code>{' '}
                  仓库名、<code>{'{dateRange}'}</code> 时间周期
                </div>
              </div>
            )}
          </div>

          {/* Section 4: Records Selection (Commits + Agent Chats Tabs) */}
          <div
            className="card"
            style={{ padding: 14, flex: 1, display: 'flex', flexDirection: 'column' }}
          >
            {/* Tab switchers */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
              <button
                type="button"
                className={`btn btn-sm ${recordListTab === 'commits' ? 'btn-primary' : 'btn-secondary'}`}
                style={{
                  flex: 1,
                  fontSize: 11,
                  padding: '5px 8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6
                }}
                onClick={() => setRecordListTab('commits')}
              >
                <span>📋 Git 提交</span>
                <span
                  className={`badge ${recordListTab === 'commits' ? 'badge-blue' : 'badge-gray'}`}
                  style={{ fontSize: 10 }}
                >
                  {includedCommits.length} / {allCommits.length}
                </span>
              </button>
              <button
                type="button"
                className={`btn btn-sm ${recordListTab === 'chats' ? 'btn-primary' : 'btn-secondary'}`}
                style={{
                  flex: 1,
                  fontSize: 11,
                  padding: '5px 8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6
                }}
                onClick={() => setRecordListTab('chats')}
              >
                <span>💬 智能体聊天</span>
                <span
                  className={`badge ${recordListTab === 'chats' ? 'badge-blue' : 'badge-purple'}`}
                  style={{ fontSize: 10 }}
                >
                  {includedChats.length} / {chatsData.length}
                </span>
              </button>
            </div>

            {recordListTab === 'commits' ? (
              <>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 10
                  }}
                >
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: 'var(--text-secondary)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6
                    }}
                  >
                    <span>📋 提取的提交记录</span>
                    <span className="badge badge-green" style={{ fontSize: 10 }}>
                      {includedCommits.length} / {allCommits.length} 条已勾选
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      className="btn btn-ghost btn-sm"
                      style={{ fontSize: 10, padding: '2px 6px' }}
                      onClick={() =>
                        handleSelectAllCommits(selectedCommitIds.size !== allCommits.length)
                      }
                    >
                      {selectedCommitIds.size === allCommits.length ? '全部取消' : '全选'}
                    </button>
                    <button
                      className="btn btn-ghost btn-icon btn-sm"
                      title="刷新提交记录"
                      onClick={fetchCommits}
                      disabled={isLoadingCommits}
                    >
                      🔄
                    </button>
                  </div>
                </div>

                {isLoadingCommits ? (
                  <div
                    style={{
                      padding: 24,
                      textAlign: 'center',
                      color: 'var(--text-muted)',
                      fontSize: 12
                    }}
                  >
                    <div
                      style={{
                        fontSize: 24,
                        marginBottom: 8,
                        animation: 'spin 1.2s linear infinite',
                        display: 'inline-block'
                      }}
                    >
                      ⟳
                    </div>
                    <div>正在从 Git 仓库拉取提交记录...</div>
                  </div>
                ) : allCommits.length === 0 ? (
                  <div
                    style={{
                      padding: '16px 12px',
                      textAlign: 'center',
                      color: 'var(--text-muted)',
                      fontSize: 12,
                      background: 'var(--bg-elevated)',
                      borderRadius: 8,
                      border: '1px dashed var(--border)'
                    }}
                  >
                    <div style={{ fontSize: 20, marginBottom: 6 }}>📭</div>
                    <div style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                      所选时间范围内暂无 Git 提交记录
                    </div>
                    {hasFallbackAvailable ? (
                      <div style={{ marginTop: 10 }}>
                        <div
                          style={{
                            fontSize: 11,
                            color: 'var(--text-secondary)',
                            marginBottom: 8
                          }}
                        >
                          仓库最近一次提交记录于较早时间，点击下方按钮可直接载入最近提交：
                        </div>
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                          <button
                            className="btn btn-primary btn-sm"
                            style={{ fontSize: 11 }}
                            onClick={handleLoadFallbackCommits}
                          >
                            👉 载入最近历史提交
                          </button>
                          <button
                            className="btn btn-secondary btn-sm"
                            style={{ fontSize: 11 }}
                            onClick={() => setTimePreset('all')}
                          >
                            切换至「全部近期提交」
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ fontSize: 11, marginTop: 6 }}>
                        可尝试在上方切换时间为「全部近期提交」或「最近 30 天」。
                      </div>
                    )}
                  </div>
                ) : (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 6,
                      maxHeight: 340,
                      overflowY: 'auto',
                      paddingRight: 4
                    }}
                  >
                    {allCommits.map((c) => {
                      const isSelected = selectedCommitIds.has(c.id)
                      return (
                        <div
                          key={c.id}
                          onClick={() => handleToggleCommit(c.id)}
                          style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: 8,
                            padding: '8px 10px',
                            borderRadius: 6,
                            background: isSelected
                              ? 'var(--bg-elevated)'
                              : 'rgba(255,255,255,0.015)',
                            border: `1px solid ${isSelected ? 'rgba(79,158,248,0.3)' : 'var(--border)'}`,
                            cursor: 'pointer',
                            transition: 'all 120ms ease'
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}}
                            style={{
                              marginTop: 2,
                              cursor: 'pointer',
                              accentColor: 'var(--accent-blue)'
                            }}
                          />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div
                              style={{
                                fontSize: 12,
                                fontWeight: 500,
                                color: 'var(--text-primary)',
                                lineHeight: 1.4,
                                wordBreak: 'break-word'
                              }}
                            >
                              {c.subject}
                            </div>
                            <div
                              style={{
                                fontSize: 10,
                                color: 'var(--text-muted)',
                                marginTop: 4,
                                display: 'flex',
                                gap: 8,
                                flexWrap: 'wrap',
                                alignItems: 'center'
                              }}
                            >
                              <span
                                className="badge badge-purple"
                                style={{ fontSize: 9, padding: '1px 5px' }}
                              >
                                👤 {c.author}
                              </span>
                              <span
                                className="badge badge-gray"
                                style={{ fontSize: 9, fontFamily: 'monospace' }}
                              >
                                📂 {c.repoName}
                              </span>
                              <code style={{ fontSize: 9, color: 'var(--accent-blue)' }}>
                                {c.shortHash}
                              </code>
                              <span>🕒 {c.date || c.relativeDate}</span>
                              {c.stats?.filesChanged > 0 && (
                                <span style={{ color: 'var(--accent-green)' }}>
                                  +{c.stats.insertions} / -{c.stats.deletions}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </>
            ) : (
              /* Chats Tab View */
              <>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 10,
                    gap: 8,
                    flexWrap: 'wrap'
                  }}
                >
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: 'var(--text-secondary)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6
                    }}
                  >
                    <span>💬 关联智能体聊天记录</span>
                    <span className="badge badge-purple" style={{ fontSize: 10 }}>
                      {includedChats.length} / {chatsData.length} 场已勾选
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    {allChatAgents.length > 1 && (
                      <select
                        value={selectedChatAgent}
                        onChange={(e) => setSelectedChatAgent(e.target.value)}
                        style={{ fontSize: 10, padding: '2px 6px', height: 24 }}
                      >
                        <option value="ALL">全部智能体</option>
                        {allChatAgents.map((ag) => (
                          <option key={ag} value={ag}>
                            {ag}
                          </option>
                        ))}
                      </select>
                    )}
                    {fallbackRecentChats.length > 0 && (
                      <button
                        className="btn btn-ghost btn-sm"
                        style={{
                          fontSize: 10,
                          padding: '2px 6px',
                          color: 'var(--accent-purple)',
                          border: '1px solid rgba(163,113,247,0.3)'
                        }}
                        title="载入更多历史智能体会话"
                        onClick={handleLoadFallbackChats}
                      >
                        + 载入历史会话 ({fallbackRecentChats.length})
                      </button>
                    )}
                    <button
                      className="btn btn-ghost btn-sm"
                      style={{ fontSize: 10, padding: '2px 6px' }}
                      onClick={() =>
                        handleSelectAllChats(selectedChatIds.size !== chatsData.length)
                      }
                    >
                      {selectedChatIds.size === chatsData.length ? '全部取消' : '全选'}
                    </button>
                    <button
                      className="btn btn-ghost btn-icon btn-sm"
                      title="刷新智能体会话记录"
                      onClick={fetchAgentChats}
                      disabled={isLoadingChats}
                    >
                      🔄
                    </button>
                  </div>
                </div>

                {isLoadingChats ? (
                  <div
                    style={{
                      padding: 24,
                      textAlign: 'center',
                      color: 'var(--text-muted)',
                      fontSize: 12
                    }}
                  >
                    <div
                      style={{
                        fontSize: 24,
                        marginBottom: 8,
                        animation: 'spin 1.2s linear infinite',
                        display: 'inline-block'
                      }}
                    >
                      ⟳
                    </div>
                    <div>正在解析各个智能体关联项目的会话与聊天记录...</div>
                  </div>
                ) : filteredChats.length === 0 ? (
                  <div
                    style={{
                      padding: '20px 14px',
                      textAlign: 'center',
                      color: 'var(--text-muted)',
                      fontSize: 12,
                      background: 'var(--bg-elevated)',
                      borderRadius: 8,
                      border: '1px dashed var(--border)'
                    }}
                  >
                    <div style={{ fontSize: 24, marginBottom: 8 }}>💬</div>
                    <div style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: 13 }}>
                      当前筛选范围内暂无智能体会话记录
                    </div>
                    {fallbackRecentChats.length > 0 ? (
                      <>
                        <div
                          style={{
                            fontSize: 11,
                            marginTop: 6,
                            lineHeight: 1.6,
                            maxWidth: 380,
                            margin: '6px auto 0'
                          }}
                        >
                          在当前时间筛选范围内未找到新会话，但在历史记录中为您找到了{' '}
                          <strong style={{ color: 'var(--accent-purple)' }}>
                            {fallbackRecentChats.length}
                          </strong>{' '}
                          场各个智能体（ChatGPT / Codex、Cursor、Claude Code、Antigravity 等）的研发交互记录。
                        </div>
                        <div
                          style={{
                            marginTop: 14,
                            display: 'flex',
                            gap: 8,
                            justifyContent: 'center'
                          }}
                        >
                          <button
                            className="btn btn-primary btn-sm"
                            style={{ fontSize: 11, padding: '5px 14px' }}
                            onClick={handleLoadFallbackChats}
                          >
                            👉 一键载入近期的 {fallbackRecentChats.length} 场智能体会话
                          </button>
                          <button
                            className="btn btn-ghost btn-sm"
                            style={{ fontSize: 11, padding: '5px 10px' }}
                            onClick={() => setTimePreset('all')}
                          >
                            切换为全部时间
                          </button>
                        </div>
                      </>
                    ) : (
                      <div style={{ fontSize: 11, marginTop: 6, lineHeight: 1.5 }}>
                        未检索到与所选项目匹配的智能体（ChatGPT/Codex、Claude
                        Code、Cursor、Antigravity）会话。
                        可尝试切换时间范围为“全部”或添加对应代码仓库。
                      </div>
                    )}
                  </div>
                ) : (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 6,
                      maxHeight: 340,
                      overflowY: 'auto',
                      paddingRight: 4
                    }}
                  >
                    {filteredChats.map((chat) => {
                      const isSelected = selectedChatIds.has(chat.id)
                      const getAgentStyle = (ag = '') => {
                        if (ag.includes('Claude')) return { icon: '🤖', badge: 'badge-purple' }
                        if (ag.includes('Codex') || ag.includes('ChatGPT'))
                          return { icon: '🧠', badge: 'badge-green' }
                        if (ag.includes('Cursor')) return { icon: '⚡', badge: 'badge-blue' }
                        if (ag.includes('Antigravity') || ag.includes('Gemini'))
                          return { icon: '🔮', badge: 'badge-purple' }
                        return { icon: '💬', badge: 'badge-gray' }
                      }
                      const { icon: agentIcon, badge: agentBadgeClass } = getAgentStyle(chat.agent)
                      return (
                        <div
                          key={chat.id}
                          onClick={() => handleToggleChat(chat.id)}
                          style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: 8,
                            padding: '8px 10px',
                            borderRadius: 6,
                            background: isSelected
                              ? 'var(--bg-elevated)'
                              : 'rgba(255,255,255,0.015)',
                            border: `1px solid ${isSelected ? 'rgba(163,113,247,0.35)' : 'var(--border)'}`,
                            cursor: 'pointer',
                            transition: 'all 120ms ease'
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}}
                            style={{
                              marginTop: 3,
                              cursor: 'pointer',
                              accentColor: 'var(--accent-purple)'
                            }}
                          />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: 6
                              }}
                            >
                              <div
                                style={{
                                  fontSize: 12,
                                  fontWeight: 600,
                                  color: 'var(--text-primary)',
                                  lineHeight: 1.4,
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                  flex: 1
                                }}
                              >
                                {chat.title || chat.summary}
                              </div>
                              <button
                                className="btn btn-ghost btn-sm"
                                style={{
                                  fontSize: 10,
                                  padding: '1px 6px',
                                  color: 'var(--accent-blue)',
                                  flexShrink: 0
                                }}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleOpenDetailChat(chat)
                                }}
                              >
                                👁️ 对话详情
                              </button>
                            </div>

                            {/* Preview quote */}
                            {chat.preview && (
                              <div
                                style={{
                                  fontSize: 11,
                                  color: 'var(--text-secondary)',
                                  background: 'var(--bg-base)',
                                  padding: '3px 8px',
                                  borderRadius: 4,
                                  marginTop: 4,
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                  borderLeft: '2px solid var(--accent-purple)'
                                }}
                              >
                                {chat.preview}
                              </div>
                            )}

                            <div
                              style={{
                                fontSize: 10,
                                color: 'var(--text-muted)',
                                marginTop: 4,
                                display: 'flex',
                                gap: 8,
                                flexWrap: 'wrap',
                                alignItems: 'center'
                              }}
                            >
                              <span
                                className={`badge ${agentBadgeClass}`}
                                style={{ fontSize: 9, padding: '1px 5px' }}
                              >
                                {agentIcon} {chat.agent}
                              </span>
                              <span
                                className="badge badge-gray"
                                style={{ fontSize: 9, fontFamily: 'monospace' }}
                              >
                                📂 {chat.repoName}
                              </span>
                              <span>🕒 {chat.date || chat.updatedAt}</span>
                              <span className="badge badge-blue" style={{ fontSize: 9 }}>
                                💬 {chat.messageCount || chat.messages?.length || 0} 轮交互
                              </span>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Action: Generate Button */}
          <div style={{ marginTop: 'auto' }}>
            {isGenerating ? (
              <button
                className="btn btn-danger"
                style={{
                  width: '100%',
                  padding: '10px 0',
                  fontSize: 13,
                  fontWeight: 600,
                  display: 'flex',
                  justifyContent: 'center',
                  gap: 8
                }}
                onClick={handleCancelGeneration}
              >
                <span>⏹ 正在生成中，点击中止</span>
              </button>
            ) : (
              <button
                className="btn btn-primary"
                style={{
                  width: '100%',
                  padding: '10px 0',
                  fontSize: 14,
                  fontWeight: 600,
                  display: 'flex',
                  justifyContent: 'center',
                  gap: 8
                }}
                onClick={handleGenerateReport}
                disabled={includedCommits.length === 0 && includedChats.length === 0}
              >
                <span>
                  🚀 一键生成本周周报 (
                  {includedCommits.length > 0 ? `${includedCommits.length} 提交` : ''}
                  {includedCommits.length > 0 && includedChats.length > 0 ? ' + ' : ''}
                  {includedChats.length > 0 ? `${includedChats.length} 智能体会话` : ''}
                  {includedCommits.length === 0 && includedChats.length === 0 ? '0 项已选' : ''})
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Right Column: Generated Report Preview, Markdown Editor & Logs */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            overflow: 'hidden',
            background: 'var(--bg-surface)'
          }}
        >
          {/* Top Bar for Report View */}
          <div
            style={{
              padding: '12px 20px',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'var(--bg-elevated)'
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                flex: 1,
                minWidth: 0,
                marginRight: 12
              }}
            >
              <span style={{ fontSize: 16 }}>📝</span>
              <input
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  width: '100%'
                }}
                value={currentReportTitle || '工作周报预览'}
                onChange={(e) => setCurrentReportTitle(e.target.value)}
                placeholder="周报标题..."
              />
            </div>

            {/* View Mode Switcher & Export Actions */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              <div
                style={{
                  display: 'flex',
                  background: 'var(--bg-base)',
                  borderRadius: 6,
                  padding: 2,
                  border: '1px solid var(--border)'
                }}
              >
                <button
                  className={`btn btn-sm ${viewMode === 'preview' ? 'btn-primary' : 'btn-ghost'}`}
                  style={{ fontSize: 11, padding: '2px 8px' }}
                  onClick={() => setViewMode('preview')}
                >
                  👁️ 预览
                </button>
                <button
                  className={`btn btn-sm ${viewMode === 'edit' ? 'btn-primary' : 'btn-ghost'}`}
                  style={{ fontSize: 11, padding: '2px 8px' }}
                  onClick={() => setViewMode('edit')}
                >
                  ✏️ 编辑
                </button>
                <button
                  className={`btn btn-sm ${viewMode === 'log' ? 'btn-primary' : 'btn-ghost'}`}
                  style={{ fontSize: 11, padding: '2px 8px' }}
                  onClick={() => setViewMode('log')}
                >
                  💻 运行日志 ({generationLogs.length})
                </button>
              </div>

              {currentReportContent && (
                <>
                  <button
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: 11 }}
                    onClick={handleCopyMarkdown}
                    title="复制 Markdown 内容到剪贴板"
                  >
                    {copyFeedback ? '✓ 已复制' : '📋 复制'}
                  </button>
                  <button
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: 11 }}
                    onClick={handleExportMarkdown}
                    title="导出为 .md 文件"
                  >
                    📄 导出
                  </button>
                  <button
                    className="btn btn-primary btn-sm"
                    style={{ fontSize: 11 }}
                    onClick={handleSaveCurrentReport}
                    title="保存到历史缓存"
                  >
                    {saveFeedback ? '✓ 已保存' : '💾 保存'}
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Main Content Area: Preview vs Edit vs Logs */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
            {viewMode === 'preview' &&
              (currentReportContent ? (
                <div
                  className="selectable"
                  style={{
                    fontSize: 13,
                    lineHeight: 1.8,
                    color: 'var(--text-primary)',
                    maxWidth: 880
                  }}
                >
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{currentReportContent}</ReactMarkdown>
                </div>
              ) : isGenerating ? (
                <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <div
                    style={{
                      fontSize: 36,
                      marginBottom: 12,
                      animation: 'spin 1.2s linear infinite',
                      display: 'inline-block'
                    }}
                  >
                    ⟳
                  </div>
                  <div style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 600 }}>
                    智能体正在基于提交历史深度分析并生成周报...
                  </div>
                  <div style={{ fontSize: 12, marginTop: 6 }}>
                    已分析 {includedCommits.length} 条 Git 提交记录，即将呈现完整 Markdown 报告。
                  </div>
                </div>
              ) : (
                <div className="empty-state" style={{ marginTop: 80 }}>
                  <div style={{ fontSize: 44 }}>📊</div>
                  <div className="empty-state-title">暂未生成周报内容</div>
                  <div className="empty-state-desc">
                    在左侧选择仓库与提交记录后，点击「一键生成本周周报」，或在右上角「历史周报」中选择历史周报查看。
                  </div>
                </div>
              ))}

            {viewMode === 'edit' && (
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                <textarea
                  className="form-control"
                  style={{
                    flex: 1,
                    width: '100%',
                    minHeight: 450,
                    fontSize: 13,
                    lineHeight: 1.7,
                    fontFamily: 'monospace',
                    padding: 16,
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    color: 'var(--text-primary)',
                    resize: 'none'
                  }}
                  value={currentReportContent}
                  onChange={(e) => setCurrentReportContent(e.target.value)}
                  placeholder="在此直接编辑周报 Markdown 内容..."
                />
              </div>
            )}

            {viewMode === 'log' && (
              <div
                ref={logEndRef}
                className="terminal-output selectable"
                style={{ height: '100%', maxHeight: 'none', fontSize: 12, padding: 16 }}
              >
                {generationLogs.length === 0 ? (
                  <div style={{ color: 'var(--text-muted)' }}>
                    暂无执行日志。点击生成后将在此流式打印调度日志。
                  </div>
                ) : (
                  generationLogs.map((l, i) => (
                    <div
                      key={i}
                      style={{
                        color:
                          l.type === 'stderr'
                            ? '#ff8080'
                            : l.type === 'warn'
                              ? 'var(--accent-amber)'
                              : l.type === 'info'
                                ? 'var(--accent-blue)'
                                : l.type === 'exit'
                                  ? 'var(--accent-green)'
                                  : '#e6edf3',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-all'
                      }}
                    >
                      {l.text}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Dialogue Detail Modal for Agent Chat */}
      {activeDetailChat && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            animation: 'fadeIn 120ms ease'
          }}
          onClick={() => setActiveDetailChat(null)}
        >
          <div
            style={{
              width: 700,
              maxHeight: '85vh',
              background: 'var(--bg-surface)',
              borderRadius: 12,
              border: '1px solid var(--border)',
              boxShadow: '0 20px 48px rgba(0,0,0,0.5)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '14px 20px',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'var(--bg-elevated)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 16 }}>💬</span>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                  智能体研发对话详情
                </span>
                <span className="badge badge-purple" style={{ fontSize: 11 }}>
                  {activeDetailChat.agent}
                </span>
                <span className="badge badge-gray" style={{ fontSize: 11 }}>
                  📂 {activeDetailChat.repoName}
                </span>
              </div>
              <button
                className="btn btn-ghost btn-icon btn-sm"
                onClick={() => setActiveDetailChat(null)}
              >
                ✕
              </button>
            </div>

            {/* Session Header Info */}
            <div
              style={{
                padding: '12px 20px',
                background: 'var(--bg-base)',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  flex: 1,
                  marginRight: 12
                }}
              >
                {activeDetailChat.title || activeDetailChat.summary}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>
                🕒 {activeDetailChat.date} {activeDetailChat.updatedAt}
              </div>
            </div>

            {/* Messages Stream */}
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '16px 20px',
                display: 'flex',
                flexDirection: 'column',
                gap: 12
              }}
            >
              {isLoadingDetailMessages ? (
                <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                  <div
                    style={{
                      fontSize: 24,
                      marginBottom: 8,
                      animation: 'spin 1.2s linear infinite',
                      display: 'inline-block'
                    }}
                  >
                    ⟳
                  </div>
                  <div style={{ fontSize: 12 }}>正在加载详细对话历史与上下文...</div>
                </div>
              ) : activeDetailChat.messages && activeDetailChat.messages.length > 0 ? (
                activeDetailChat.messages.map((m, idx) => {
                  const isUser = m.role === 'user'
                  return (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 4,
                        alignItems: isUser ? 'flex-end' : 'flex-start'
                      }}
                    >
                      <div
                        style={{
                          fontSize: 10,
                          color: 'var(--text-muted)',
                          padding: '0 4px'
                        }}
                      >
                        {isUser ? '👤 用户' : `🤖 ${activeDetailChat.agent}`}
                        {m.time && ` · ${m.time}`}
                      </div>
                      <div
                        style={{
                          maxWidth: '92%',
                          padding: '10px 14px',
                          borderRadius: isUser ? '12px 12px 2px 12px' : '2px 12px 12px 12px',
                          background: isUser ? 'var(--accent-blue-dim)' : 'var(--bg-elevated)',
                          border: `1px solid ${isUser ? 'rgba(79,158,248,0.3)' : 'var(--border)'}`,
                          fontSize: 12,
                          lineHeight: 1.65,
                          color: 'var(--text-primary)',
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word'
                        }}
                        className="selectable"
                      >
                        {m.content}
                      </div>
                    </div>
                  )
                })
              ) : (
                <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)' }}>
                  <div style={{ fontSize: 24, marginBottom: 8 }}>📭</div>
                  <div style={{ fontSize: 12 }}>
                    {activeDetailChat.notes || activeDetailChat.preview || '暂无详细文本消息'}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div
              style={{
                padding: '12px 20px',
                borderTop: '1px solid var(--border)',
                background: 'var(--bg-elevated)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  cursor: 'pointer',
                  fontSize: 12,
                  color: 'var(--text-primary)'
                }}
              >
                <input
                  type="checkbox"
                  checked={selectedChatIds.has(activeDetailChat.id)}
                  onChange={() => handleToggleChat(activeDetailChat.id)}
                  style={{ accentColor: 'var(--accent-purple)' }}
                />
                <span>勾选并纳入本周工作周报</span>
              </label>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setActiveDetailChat(null)}
              >
                完成关闭
              </button>
            </div>
          </div>
        </div>
      )}

      {/* History Drawer Modal / Sidebar */}
      {showHistoryDrawer && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            width: 360,
            background: 'var(--bg-surface)',
            borderLeft: '1px solid var(--border)',
            boxShadow: 'var(--shadow-xl)',
            zIndex: 100,
            display: 'flex',
            flexDirection: 'column',
            animation: 'fadeIn 150ms ease'
          }}
        >
          <div
            style={{
              padding: '14px 16px',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'var(--bg-elevated)'
            }}
          >
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--text-primary)',
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              <span>🕒 历史周报缓存</span>
              <span className="badge badge-purple" style={{ fontSize: 10 }}>
                {weeklyReports.length} 篇
              </span>
            </div>
            <button
              className="btn btn-ghost btn-icon btn-sm"
              onClick={() => setShowHistoryDrawer(false)}
            >
              ✕
            </button>
          </div>

          <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
            <input
              className="form-control"
              style={{ width: '100%', fontSize: 11, padding: '4px 8px' }}
              placeholder="搜索历史周报标题或内容..."
              value={historySearch}
              onChange={(e) => setHistorySearch(e.target.value)}
            />
          </div>

          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '10px 14px',
              display: 'flex',
              flexDirection: 'column',
              gap: 8
            }}
          >
            {filteredHistory.length === 0 ? (
              <div
                style={{
                  textAlign: 'center',
                  color: 'var(--text-muted)',
                  fontSize: 12,
                  padding: 30
                }}
              >
                暂无历史周报记录
              </div>
            ) : (
              filteredHistory.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleLoadReport(item)}
                  style={{
                    padding: '10px 12px',
                    borderRadius: 8,
                    background:
                      activeReportId === item.id ? 'var(--bg-selected)' : 'var(--bg-elevated)',
                    border: `1px solid ${activeReportId === item.id ? 'var(--accent-blue)' : 'var(--border)'}`,
                    cursor: 'pointer',
                    transition: 'all 120ms ease'
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: 4
                    }}
                  >
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: 'var(--text-primary)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {item.title}
                    </div>
                    <button
                      className="btn btn-ghost btn-icon btn-sm"
                      style={{ fontSize: 10, color: 'var(--accent-red)', padding: 2 }}
                      title="删除此周报"
                      onClick={(e) => handleDeleteReport(e, item.id)}
                    >
                      🗑️
                    </button>
                  </div>

                  <div
                    style={{
                      fontSize: 10,
                      color: 'var(--text-muted)',
                      display: 'flex',
                      gap: 8,
                      flexWrap: 'wrap'
                    }}
                  >
                    <span>📅 {formatTime(item.createdAt)}</span>
                    <span>🤖 {item.agent}</span>
                    <span>📋 {item.commitCount || 0} commits</span>
                    {item.chatCount > 0 && <span>💬 {item.chatCount} 场会话</span>}
                  </div>

                  {item.repoNames && item.repoNames.length > 0 && (
                    <div style={{ fontSize: 10, color: 'var(--accent-blue)', marginTop: 4 }}>
                      📁 {item.repoNames.join('、')}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
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

function getDateRangeLabel(preset) {
  const now = new Date()
  const todayStr = now.toISOString().slice(0, 10)
  if (preset === '7d') {
    const past = new Date(now.getTime() - 7 * 86400000).toISOString().slice(0, 10)
    return `${past} ~ ${todayStr}`
  }
  if (preset === '14d') {
    const past = new Date(now.getTime() - 14 * 86400000).toISOString().slice(0, 10)
    return `${past} ~ ${todayStr}`
  }
  if (preset === '30d') {
    const past = new Date(now.getTime() - 30 * 86400000).toISOString().slice(0, 10)
    return `${past} ~ ${todayStr}`
  }
  return `第 ${getWeekNumber(now)} 周 (${todayStr})`
}

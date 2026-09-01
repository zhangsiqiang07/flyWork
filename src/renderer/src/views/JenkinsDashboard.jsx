import { useState, useEffect, useRef, useCallback } from 'react'
import JenkinsSettingsModal from '../components/JenkinsSettingsModal'
import JenkinsBuildModal from '../components/JenkinsBuildModal'
import { ansiToHtml } from '../utils/ansi'

function formatDuration(ms) {
  if (!ms || ms <= 0) return '-'
  const seconds = Math.floor(ms / 1000)
  if (seconds < 60) return `${seconds}秒`
  const minutes = Math.floor(seconds / 60)
  const remainingSecs = seconds % 60
  if (minutes < 60) return `${minutes}分${remainingSecs}秒`
  const hours = Math.floor(minutes / 60)
  return `${hours}时${minutes % 60}分`
}

function formatRelTime(isoOrTimestamp) {
  if (!isoOrTimestamp) return '-'
  const d = new Date(isoOrTimestamp)
  const now = new Date()
  const diff = now - d
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`
  return `${Math.floor(diff / 86400000)}天前`
}

function findFirstJob(items) {
  for (const item of items) {
    if (!item.isFolder) return item
    if (item.children?.length > 0) {
      const found = findFirstJob(item.children)
      if (found) return found
    }
  }
  return null
}

export default function JenkinsDashboard() {
  // Config & Auth
  const [authStatus, setAuthStatus] = useState({ configured: false, baseUrl: '', username: '' })
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [loadingJobs, setLoadingJobs] = useState(false)

  // Jobs & Selection
  const [jobs, setJobs] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedJobPath, setSelectedJobPath] = useState(null)
  const [jobDetail, setJobDetail] = useState(null)
  const [loadingDetail, setLoadingDetail] = useState(false)

  // Build & Triggering
  const [isBuildModalOpen, setIsBuildModalOpen] = useState(false)
  const [activeQueueId, setActiveQueueId] = useState(null)
  const [queueStatusText, setQueueStatusText] = useState(null)

  // Logs & Viewing
  const [activeTab, setActiveTab] = useState('console') // 'console' | 'history'
  const [selectedBuildNumber, setSelectedBuildNumber] = useState(null)
  const [consoleLog, setConsoleLog] = useState('')
  const [loadingLog, setLoadingLog] = useState(false)
  const [isLogStreaming] = useState(true)
  const [logTextSize, setLogTextSize] = useState(0)
  const [hasMoreLog, setHasMoreLog] = useState(false)
  const [autoScroll, setAutoScroll] = useState(true)

  const terminalEndRef = useRef(null)

  // 1. 初始加载配置与任务
  useEffect(() => {
    let cancelled = false
    async function init() {
      try {
        if (!window.flywork?.jenkinsCheckAuth) return
        const auth = await window.flywork.jenkinsCheckAuth()
        if (cancelled || !auth?.success) return

        setAuthStatus({
          configured: auth.configured,
          baseUrl: auth.baseUrl || '',
          username: auth.username || ''
        })

        if (auth.configured) {
          setLoadingJobs(true)
          const res = await window.flywork?.jenkinsListJobs?.()
          if (!cancelled && res?.success) {
            setJobs(res.jobs || [])
            if (res.jobs?.length > 0) {
              setSelectedJobPath((prev) => {
                if (prev) return prev
                const first = findFirstJob(res.jobs)
                return first ? first.path : null
              })
            }
          }
        }
      } catch (err) {
        console.error('初始化 Jenkins 状态异常:', err)
      } finally {
        if (!cancelled) setLoadingJobs(false)
      }
    }

    init()
    return () => {
      cancelled = true
    }
  }, [])

  // 手动刷新全部任务
  const loadJobs = useCallback(async () => {
    setLoadingJobs(true)
    try {
      if (!window.flywork?.jenkinsListJobs) return
      const res = await window.flywork.jenkinsListJobs()
      if (res.success) {
        setJobs(res.jobs || [])
        if (res.jobs?.length > 0) {
          setSelectedJobPath((prev) => {
            if (prev) return prev
            const first = findFirstJob(res.jobs)
            return first ? first.path : null
          })
        }
      }
    } catch (err) {
      console.error('获取 Jenkins 任务列表失败:', err)
    } finally {
      setLoadingJobs(false)
    }
  }, [])

  // 3. 选中的任务变化时，异步加载任务详情
  useEffect(() => {
    if (!selectedJobPath) return

    let cancelled = false
    async function load() {
      await Promise.resolve()
      setLoadingDetail(true)
      setConsoleLog('')
      setLogTextSize(0)
      setHasMoreLog(false)
      setSelectedBuildNumber(null)

      try {
        const res = await window.flywork?.jenkinsGetJobDetail(selectedJobPath)
        if (!cancelled && res?.success) {
          setJobDetail(res.job)
          if (res.job?.lastBuild?.number) {
            setSelectedBuildNumber(res.job.lastBuild.number)
          }
        }
      } catch (err) {
        console.error('加载任务详情失败:', err)
      } finally {
        if (!cancelled) {
          setLoadingDetail(false)
        }
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [selectedJobPath])

  // 4. 轮询队列任务（当发起新构建后）
  useEffect(() => {
    if (!activeQueueId) return

    let isMounted = true
    const timerId = setTimeout(() => {
      if (isMounted) {
        setQueueStatusText('任务已加入构建队列，正在等待 Jenkins 分配执行节点...')
      }
    }, 0)

    const pollInterval = setInterval(async () => {
      try {
        const res = await window.flywork?.jenkinsGetQueueItem(activeQueueId)
        if (!isMounted) return

        if (res?.success && res.item) {
          if (res.item.executable?.number) {
            const newBuildNumber = res.item.executable.number
            setActiveQueueId(null)
            setQueueStatusText(null)
            setSelectedBuildNumber(newBuildNumber)
            setActiveTab('console')

            if (selectedJobPath) {
              const detailRes = await window.flywork?.jenkinsGetJobDetail(selectedJobPath)
              if (isMounted && detailRes?.success) {
                setJobDetail(detailRes.job)
              }
            }
          } else if (res.item.cancelled) {
            setActiveQueueId(null)
            setQueueStatusText('构建已在队列中被取消')
          } else if (res.item.why) {
            setQueueStatusText(`排队中: ${res.item.why}`)
          }
        }
      } catch (err) {
        console.warn('轮询队列状态异常:', err)
      }
    }, 2000)

    return () => {
      isMounted = false
      clearTimeout(timerId)
      clearInterval(pollInterval)
    }
  }, [activeQueueId, selectedJobPath])

  // 5. 初次或切换构建时拉取日志
  useEffect(() => {
    if (!selectedJobPath || !selectedBuildNumber) return

    let cancelled = false
    async function loadInitialLog() {
      setLoadingLog(true)
      setConsoleLog('')
      setLogTextSize(0)
      setHasMoreLog(true)

      try {
        const res = await window.flywork?.jenkinsGetBuildLog(
          selectedJobPath,
          selectedBuildNumber,
          0
        )
        if (!cancelled && res?.success) {
          setConsoleLog(res.text || '')
          setLogTextSize(res.textSize)
          setHasMoreLog(res.hasMore)

          if (autoScroll && terminalEndRef.current) {
            terminalEndRef.current.scrollIntoView({ behavior: 'smooth' })
          }
        }
      } catch (err) {
        console.error('获取日志异常:', err)
      } finally {
        if (!cancelled) {
          setLoadingLog(false)
        }
      }
    }

    loadInitialLog()
    return () => {
      cancelled = true
    }
  }, [selectedJobPath, selectedBuildNumber, autoScroll])

  const fetchFullLog = useCallback(async () => {
    if (!selectedJobPath || !selectedBuildNumber) return
    setLoadingLog(true)
    try {
      const res = await window.flywork?.jenkinsGetBuildLog(selectedJobPath, selectedBuildNumber, 0)
      if (res?.success) {
        setConsoleLog(res.text || '')
        setLogTextSize(res.textSize)
        setHasMoreLog(res.hasMore)
        if (autoScroll && terminalEndRef.current) {
          terminalEndRef.current.scrollIntoView({ behavior: 'smooth' })
        }
      }
    } catch (err) {
      console.error('重新获取日志异常:', err)
    } finally {
      setLoadingLog(false)
    }
  }, [selectedJobPath, selectedBuildNumber, autoScroll])

  // 6. 流式增量轮询日志
  useEffect(() => {
    if (!isLogStreaming || !hasMoreLog || !selectedJobPath || !selectedBuildNumber) return

    let cancelled = false
    const timer = setTimeout(async () => {
      try {
        const res = await window.flywork?.jenkinsGetBuildLog(
          selectedJobPath,
          selectedBuildNumber,
          logTextSize
        )
        if (!cancelled && res?.success) {
          if (res.text) {
            setConsoleLog((prev) => prev + res.text)
          }
          setLogTextSize(res.textSize)
          setHasMoreLog(res.hasMore)

          // 当日志输出结束（构建完成）时，立即拉取最新 Job 状态与列表
          if (!res.hasMore) {
            window.flywork?.jenkinsGetJobDetail(selectedJobPath).then((detailRes) => {
              if (!cancelled && detailRes?.success) {
                setJobDetail(detailRes.job)
              }
            })
            window.flywork?.jenkinsListJobs?.().then((jobsRes) => {
              if (!cancelled && jobsRes?.success) {
                setJobs(jobsRes.jobs || [])
              }
            })
          }

          if (autoScroll && terminalEndRef.current) {
            terminalEndRef.current.scrollIntoView({ behavior: 'smooth' })
          }
        }
      } catch (err) {
        console.warn('流式拉取日志异常:', err)
      }
    }, 2500)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [isLogStreaming, hasMoreLog, selectedJobPath, selectedBuildNumber, logTextSize, autoScroll])

  // 中止构建
  const handleStopBuild = async () => {
    if (!selectedJobPath || !selectedBuildNumber) return
    if (!confirm(`确定要中止构建 #${selectedBuildNumber} 吗？`)) return

    try {
      const res = await window.flywork?.jenkinsStopBuild(selectedJobPath, selectedBuildNumber)
      if (res?.success) {
        alert('中止请求已发送')
        setTimeout(() => {
          fetchFullLog()
        }, 1500)
      }
    } catch (err) {
      alert('中止失败: ' + err.message)
    }
  }

  // 复制完整日志
  const handleCopyLog = () => {
    if (!consoleLog) return
    navigator.clipboard.writeText(consoleLog)
    alert('日志已复制到剪贴板')
  }

  // 扁平化展开任务列表以供搜索
  const flattenJobs = (list, prefix = '') => {
    let acc = []
    for (const j of list) {
      const displayPath = prefix ? `${prefix} / ${j.name}` : j.name
      acc.push({ ...j, displayPath })
      if (j.children?.length > 0) {
        acc = acc.concat(flattenJobs(j.children, displayPath))
      }
    }
    return acc
  }

  const allFlatJobs = flattenJobs(jobs)
  const filteredJobs = allFlatJobs.filter((j) => {
    if (j.isFolder) return false
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return j.name?.toLowerCase().includes(q) || j.path?.toLowerCase().includes(q)
  })

  const renderStatusBadge = (status) => {
    switch (status) {
      case 'SUCCESS':
        return (
          <span
            style={{
              display: 'inline-block',
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: 'var(--accent-green)',
              boxShadow: '0 0 6px rgba(63, 185, 80, 0.5)',
              flexShrink: 0
            }}
            title="构建成功"
          />
        )
      case 'FAILURE':
        return (
          <span
            style={{
              display: 'inline-block',
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: 'var(--accent-red)',
              boxShadow: '0 0 6px rgba(248, 81, 73, 0.5)',
              flexShrink: 0
            }}
            title="构建失败"
          />
        )
      case 'BUILDING':
        return (
          <span
            style={{
              display: 'inline-block',
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: 'var(--accent-blue)',
              animation: 'spin 1.2s linear infinite',
              flexShrink: 0
            }}
            title="构建中"
          >
            ●
          </span>
        )
      case 'UNSTABLE':
        return (
          <span
            style={{
              display: 'inline-block',
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: 'var(--accent-amber)',
              flexShrink: 0
            }}
            title="不稳定"
          />
        )
      default:
        return (
          <span
            style={{
              display: 'inline-block',
              width: 8,
              height: 8,
              borderRadius: '50%',
              border: '1px solid var(--text-muted)',
              flexShrink: 0
            }}
            title="未构建/已禁用"
          />
        )
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* 顶部状态与操作栏 */}
      <div
        style={{
          padding: '14px 20px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'var(--bg-elevated)',
          flexShrink: 0
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: 'rgba(210, 153, 34, 0.15)',
              color: 'var(--accent-amber)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 'bold',
              fontSize: 16
            }}
          >
            J
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 16, fontWeight: 600 }}>Jenkins CI 控制中心</span>
              {authStatus.configured ? (
                <span
                  className="badge badge-green"
                  style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}
                >
                  <span
                    style={{
                      width: 5,
                      height: 5,
                      borderRadius: '50%',
                      background: 'var(--accent-green)'
                    }}
                  />
                  已连接 ({authStatus.username})
                </span>
              ) : (
                <span className="badge" style={{ fontSize: 11, color: 'var(--accent-amber)' }}>
                  未连接
                </span>
              )}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
              {authStatus.configured ? authStatus.baseUrl : '请先配置 Jenkins 服务地址与 API Token'}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {authStatus.configured && (
            <button
              className="btn btn-secondary"
              onClick={loadJobs}
              disabled={loadingJobs}
              style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <span
                style={{
                  display: 'inline-block',
                  animation: loadingJobs ? 'spin 1s linear infinite' : 'none'
                }}
              >
                ⟳
              </span>
              刷新
            </button>
          )}
          <button
            className="btn btn-secondary"
            onClick={() => setIsSettingsOpen(true)}
            style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}
          >
            ⚙ 配置服务
          </button>
        </div>
      </div>

      {/* 未配置时的引导视图 */}
      {!authStatus.configured ? (
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
            gap: 16,
            padding: 40,
            textAlign: 'center'
          }}
        >
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 16,
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 28,
              color: 'var(--accent-amber)'
            }}
          >
            ⚙
          </div>
          <div>
            <h3 style={{ margin: '0 0 8px 0', fontSize: 18, fontWeight: 600 }}>
              连接您的 Jenkins 服务器
            </h3>
            <p
              style={{
                margin: 0,
                fontSize: 13,
                color: 'var(--text-secondary)',
                maxWidth: 420,
                lineHeight: 1.6
              }}
            >
              仅需提供 Jenkins 地址、用户名以及在个人中心生成的 API
              Token，即可在此直接管理任务列表、触发构建并实时追踪控制台日志。
            </p>
          </div>
          <button
            className="btn btn-primary"
            onClick={() => setIsSettingsOpen(true)}
            style={{ padding: '8px 20px', fontSize: 13 }}
          >
            立即配置连接
          </button>
        </div>
      ) : (
        /* 已配置时的双栏主布局 */
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {/* 左侧：任务列表 */}
          <div
            style={{
              width: 320,
              borderRight: '1px solid var(--border)',
              display: 'flex',
              flexDirection: 'column',
              background: 'var(--bg-secondary)',
              flexShrink: 0
            }}
          >
            {/* 搜索框 */}
            <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>
              <input
                type="text"
                className="input"
                placeholder="搜索任务名称或路径..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  fontSize: 12,
                  padding: '6px 10px'
                }}
              />
            </div>

            {/* 任务列表内容 */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '6px 8px' }}>
              {loadingJobs && jobs.length === 0 ? (
                <div
                  style={{
                    padding: 24,
                    textAlign: 'center',
                    color: 'var(--text-muted)',
                    fontSize: 12
                  }}
                >
                  正在拉取 Jenkins 任务...
                </div>
              ) : filteredJobs.length === 0 ? (
                <div
                  style={{
                    padding: 24,
                    textAlign: 'center',
                    color: 'var(--text-muted)',
                    fontSize: 12
                  }}
                >
                  未找到匹配的任务
                </div>
              ) : (
                filteredJobs.map((j) => {
                  const isSelected = selectedJobPath === j.path
                  const itemStatus =
                    isSelected && jobDetail?.path === j.path ? jobDetail.status : j.status
                  const itemLastBuild =
                    isSelected && jobDetail?.path === j.path && jobDetail.lastBuild
                      ? jobDetail.lastBuild
                      : j.lastBuild

                  return (
                    <div
                      key={j.path}
                      onClick={() => setSelectedJobPath(j.path)}
                      style={{
                        padding: '9px 12px',
                        borderRadius: 6,
                        marginBottom: 4,
                        cursor: 'pointer',
                        background: isSelected ? 'var(--bg-hover)' : 'transparent',
                        border: isSelected ? '1px solid var(--border)' : '1px solid transparent',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        transition: 'background 120ms ease'
                      }}
                    >
                      {renderStatusBadge(itemStatus)}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: 13,
                            fontWeight: isSelected ? 600 : 500,
                            color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}
                        >
                          {j.name}
                        </div>
                        {j.displayPath !== j.name && (
                          <div
                            style={{
                              fontSize: 11,
                              color: 'var(--text-muted)',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              marginTop: 2
                            }}
                          >
                            {j.displayPath}
                          </div>
                        )}
                      </div>
                      {itemLastBuild && (
                        <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>
                          #{itemLastBuild.number}
                        </span>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* 右侧：任务详情与日志 */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {!jobDetail ? (
              <div
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--text-muted)',
                  fontSize: 13
                }}
              >
                {loadingDetail ? '正在加载任务详情...' : '请在左侧选择一个 Jenkins 任务'}
              </div>
            ) : (
              <>
                {/* 任务头部信息 */}
                <div
                  style={{
                    padding: '16px 20px',
                    borderBottom: '1px solid var(--border)',
                    background: 'var(--bg-primary)',
                    flexShrink: 0
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        {renderStatusBadge(jobDetail.status)}
                        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>
                          {jobDetail.fullName || jobDetail.name}
                        </h2>
                        {jobDetail.isParameterized && (
                          <span className="badge badge-purple" style={{ fontSize: 11 }}>
                            参数化构建
                          </span>
                        )}
                      </div>
                      {jobDetail.description && (
                        <p
                          style={{
                            margin: '6px 0 0 0',
                            fontSize: 12,
                            color: 'var(--text-secondary)'
                          }}
                        >
                          {jobDetail.description}
                        </p>
                      )}
                    </div>

                    {/* 操作按钮组 */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <button
                        className="btn btn-primary"
                        onClick={() => setIsBuildModalOpen(true)}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}
                      >
                        <span>▶</span>
                        {jobDetail.isParameterized ? '参数化构建' : '立即构建'}
                      </button>

                      {jobDetail.url && (
                        <button
                          className="btn btn-secondary"
                          onClick={() => window.flywork?.openUrl(jobDetail.url)}
                          title="在网页浏览器中查看 Jenkins 任务"
                          style={{ fontSize: 12 }}
                        >
                          浏览器打开 ↗
                        </button>
                      )}
                    </div>
                  </div>

                  {/* 排队通知横幅 */}
                  {queueStatusText && (
                    <div
                      style={{
                        marginTop: 12,
                        padding: '8px 12px',
                        borderRadius: 6,
                        background: 'rgba(88, 166, 255, 0.12)',
                        border: '1px solid rgba(88, 166, 255, 0.25)',
                        color: 'var(--accent-blue)',
                        fontSize: 12,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8
                      }}
                    >
                      <span
                        style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}
                      >
                        ⟳
                      </span>
                      <span>{queueStatusText}</span>
                    </div>
                  )}

                  {/* 标签栏：控制台输出 / 构建历史 */}
                  <div
                    style={{
                      display: 'flex',
                      gap: 16,
                      marginTop: 14,
                      borderBottom: '1px solid var(--border)'
                    }}
                  >
                    <div
                      onClick={() => setActiveTab('console')}
                      style={{
                        paddingBottom: 8,
                        cursor: 'pointer',
                        fontSize: 13,
                        fontWeight: activeTab === 'console' ? 600 : 500,
                        color:
                          activeTab === 'console' ? 'var(--text-primary)' : 'var(--text-muted)',
                        borderBottom:
                          activeTab === 'console'
                            ? '2px solid var(--accent-blue)'
                            : '2px solid transparent'
                      }}
                    >
                      控制台日志
                    </div>
                    <div
                      onClick={() => setActiveTab('history')}
                      style={{
                        paddingBottom: 8,
                        cursor: 'pointer',
                        fontSize: 13,
                        fontWeight: activeTab === 'history' ? 600 : 500,
                        color:
                          activeTab === 'history' ? 'var(--text-primary)' : 'var(--text-muted)',
                        borderBottom:
                          activeTab === 'history'
                            ? '2px solid var(--accent-blue)'
                            : '2px solid transparent'
                      }}
                    >
                      构建历史 ({jobDetail.builds?.length || 0})
                    </div>
                  </div>
                </div>

                {/* Tab 1: 控制台日志视图 */}
                {activeTab === 'console' && (
                  <div
                    style={{
                      flex: 1,
                      display: 'flex',
                      flexDirection: 'column',
                      overflow: 'hidden'
                    }}
                  >
                    {/* 日志顶部工具条 */}
                    <div
                      style={{
                        padding: '8px 16px',
                        background: 'var(--bg-secondary)',
                        borderBottom: '1px solid var(--border)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexShrink: 0
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span
                          style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}
                        >
                          构建号:
                        </span>
                        <select
                          className="input"
                          value={selectedBuildNumber || ''}
                          onChange={(e) => setSelectedBuildNumber(Number(e.target.value))}
                          style={{ fontSize: 12, padding: '3px 8px', height: 26 }}
                        >
                          {jobDetail.builds?.map((b) => (
                            <option key={b.number} value={b.number}>
                              #{b.number} ({b.result || 'BUILDING'})
                            </option>
                          ))}
                        </select>

                        {hasMoreLog && (
                          <span
                            className="badge badge-blue"
                            style={{ fontSize: 10, display: 'flex', alignItems: 'center', gap: 4 }}
                          >
                            <span
                              style={{
                                animation: 'spin 1s linear infinite',
                                display: 'inline-block'
                              }}
                            >
                              ⟳
                            </span>
                            正在输出
                          </span>
                        )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {hasMoreLog && (
                          <button
                            className="btn btn-danger"
                            onClick={handleStopBuild}
                            style={{ fontSize: 11, padding: '3px 8px' }}
                          >
                            中止构建
                          </button>
                        )}
                        <button
                          className="btn btn-ghost"
                          onClick={() => {
                            setAutoScroll((prev) => {
                              const next = !prev
                              if (next && terminalEndRef.current) {
                                terminalEndRef.current.scrollIntoView({ behavior: 'smooth' })
                              }
                              return next
                            })
                          }}
                          style={{ fontSize: 11 }}
                        >
                          {autoScroll ? '锁定滚动: 开' : '锁定滚动: 关'}
                        </button>
                        <button
                          className="btn btn-secondary"
                          onClick={handleCopyLog}
                          disabled={!consoleLog}
                          style={{ fontSize: 11, padding: '3px 8px' }}
                        >
                          复制日志
                        </button>
                        <button
                          className="btn btn-secondary"
                          onClick={fetchFullLog}
                          disabled={loadingLog}
                          style={{ fontSize: 11, padding: '3px 8px' }}
                        >
                          重新拉取
                        </button>
                      </div>
                    </div>

                    {/* 终端控制台黑底日志展示区 */}
                    <div
                      style={{
                        flex: 1,
                        background: '#0d1117',
                        color: '#c9d1d9',
                        padding: 16,
                        overflowY: 'auto',
                        fontFamily: "'SF Mono', 'Fira Code', 'Menlo', Consolas, monospace",
                        fontSize: 12,
                        lineHeight: 1.5,
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-all'
                      }}
                    >
                      {loadingLog && !consoleLog ? (
                        <div style={{ color: '#8b949e' }}>正在加载控制台输出...</div>
                      ) : !consoleLog ? (
                        <div style={{ color: '#8b949e' }}>暂无控制台日志</div>
                      ) : (
                        <div dangerouslySetInnerHTML={{ __html: ansiToHtml(consoleLog) }} />
                      )}
                      <div ref={terminalEndRef} />
                    </div>
                  </div>
                )}

                {/* Tab 2: 构建历史视图 */}
                {activeTab === 'history' && (
                  <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
                    {jobDetail.builds?.length === 0 ? (
                      <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 40 }}>
                        暂无历史构建记录
                      </div>
                    ) : (
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                        <thead>
                          <tr
                            style={{
                              borderBottom: '1px solid var(--border)',
                              textAlign: 'left',
                              color: 'var(--text-muted)'
                            }}
                          >
                            <th style={{ padding: '8px 12px' }}>构建号</th>
                            <th style={{ padding: '8px 12px' }}>结果</th>
                            <th style={{ padding: '8px 12px' }}>耗时</th>
                            <th style={{ padding: '8px 12px' }}>触发时间</th>
                            <th style={{ padding: '8px 12px', textAlign: 'right' }}>操作</th>
                          </tr>
                        </thead>
                        <tbody>
                          {jobDetail.builds.map((b) => (
                            <tr
                              key={b.number}
                              style={{
                                borderBottom: '1px solid var(--border)',
                                transition: 'background 120ms ease'
                              }}
                            >
                              <td style={{ padding: '10px 12px', fontWeight: 600 }}>#{b.number}</td>
                              <td style={{ padding: '10px 12px' }}>
                                {b.result === 'SUCCESS' && (
                                  <span className="badge badge-green" style={{ fontSize: 11 }}>
                                    成功
                                  </span>
                                )}
                                {b.result === 'FAILURE' && (
                                  <span className="badge badge-red" style={{ fontSize: 11 }}>
                                    失败
                                  </span>
                                )}
                                {b.result === 'ABORTED' && (
                                  <span className="badge" style={{ fontSize: 11 }}>
                                    已中止
                                  </span>
                                )}
                                {b.result === 'BUILDING' && (
                                  <span className="badge badge-blue" style={{ fontSize: 11 }}>
                                    构建中
                                  </span>
                                )}
                                {!['SUCCESS', 'FAILURE', 'ABORTED', 'BUILDING'].includes(
                                  b.result
                                ) && (
                                  <span className="badge" style={{ fontSize: 11 }}>
                                    {b.result}
                                  </span>
                                )}
                              </td>
                              <td style={{ padding: '10px 12px', color: 'var(--text-secondary)' }}>
                                {formatDuration(b.duration)}
                              </td>
                              <td style={{ padding: '10px 12px', color: 'var(--text-secondary)' }}>
                                {formatRelTime(b.timestamp)}
                              </td>
                              <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                                <button
                                  className="btn btn-ghost"
                                  onClick={() => {
                                    setSelectedBuildNumber(b.number)
                                    setActiveTab('console')
                                  }}
                                  style={{
                                    fontSize: 11,
                                    padding: '3px 8px',
                                    color: 'var(--accent-blue)'
                                  }}
                                >
                                  查看日志
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* 配置弹窗 */}
      <JenkinsSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onConfigSaved={async () => {
          const auth = await window.flywork?.jenkinsCheckAuth?.()
          if (auth?.success) {
            setAuthStatus({
              configured: auth.configured,
              baseUrl: auth.baseUrl || '',
              username: auth.username || ''
            })
            if (auth.configured) {
              loadJobs()
            }
          }
        }}
      />

      {/* 构建触发弹窗 */}
      <JenkinsBuildModal
        isOpen={isBuildModalOpen}
        job={jobDetail}
        onClose={() => setIsBuildModalOpen(false)}
        onBuildTriggered={({ queueId }) => {
          if (queueId) {
            setActiveQueueId(queueId)
          }
          setJobDetail((prev) => (prev ? { ...prev, status: 'BUILDING' } : prev))
          setJobs((prevJobs) =>
            prevJobs.map((j) => (j.path === selectedJobPath ? { ...j, status: 'BUILDING' } : j))
          )
          setTimeout(() => {
            if (selectedJobPath) {
              window.flywork?.jenkinsGetJobDetail(selectedJobPath).then((r) => {
                if (r?.success) setJobDetail(r.job)
              })
            }
            window.flywork?.jenkinsListJobs?.().then((r) => {
              if (r?.success) setJobs(r.jobs || [])
            })
          }, 1500)
        }}
      />
    </div>
  )
}

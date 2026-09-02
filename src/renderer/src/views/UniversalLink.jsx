/* eslint-disable react/prop-types */
import { useState } from 'react'

const PRESET_DOMAINS = [
  { label: 'Apple 官方', domain: 'apple.com' },
  { label: 'Bilibili', domain: 'bilibili.com' },
  { label: '知乎', domain: 'zhihu.com' },
  { label: 'GitHub', domain: 'github.com' }
]

export default function UniversalLink({
  workspaces = [],
  selectedWorkspaceId = null,
  hideHeader = false
}) {
  const [targetInput, setTargetInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [verifyResult, setVerifyResult] = useState(null)
  const [activeTab, setActiveTab] = useState('matcher') // 'matcher' | 'explorer' | 'simulator' | 'generator' | 'workspace'
  const [history, setHistory] = useState(() => {
    try {
      const savedHistory = localStorage.getItem('flywork_universallink_history')
      return savedHistory ? JSON.parse(savedHistory) : []
    } catch {
      return []
    }
  })

  // Local Workspace Inspection State
  const [activeWorkspaceId, setActiveWorkspaceId] = useState(selectedWorkspaceId || '')
  const [workspaceScanResult, setWorkspaceScanResult] = useState(null)
  const [workspaceScanLoading, setWorkspaceScanLoading] = useState(false)

  // URL Matcher State
  const [testUrlInput, setTestUrlInput] = useState('')
  const [testAppId, setTestAppId] = useState('')
  const [matchResult, setMatchResult] = useState(null)
  const [matchingLoading, setMatchingLoading] = useState(false)

  // AASA Explorer State
  const [explorerSource, setExplorerSource] = useState('direct') // 'direct' | 'cdn'
  const [copiedCode, setCopiedCode] = useState(false)
  const [copiedScanReport, setCopiedScanReport] = useState(false)
  const [copiedScanDomains, setCopiedScanDomains] = useState(false)
  const [copiedVerifyReport, setCopiedVerifyReport] = useState(false)
  const [copiedItemKey, setCopiedItemKey] = useState(null)

  // Simulator Test State
  const [simUrlInput, setSimUrlInput] = useState('')
  const [simRunning, setSimRunning] = useState(false)
  const [simResult, setSimResult] = useState(null)

  // AASA Generator State
  const [genTeamId, setGenTeamId] = useState('')
  const [genBundleId, setGenBundleId] = useState('')
  const [genFormat, setGenFormat] = useState('modern')
  const [genPaths, setGenPaths] = useState('/detail/*\n/user/*\n/articles/*')
  const [genExcludePaths, setGenExcludePaths] = useState('/pay/*\n/secret/*')
  const [generatedAasa, setGeneratedAasa] = useState(null)

  // Save history
  const saveToHistory = (domain) => {
    if (!domain) return
    setHistory((prev) => {
      const filtered = prev.filter((d) => d !== domain)
      const next = [domain, ...filtered].slice(0, 8)
      try {
        localStorage.setItem('flywork_universallink_history', JSON.stringify(next))
      } catch {
        // ignore
      }
      return next
    })
  }

  // Trigger Universal Link verification
  const handleVerify = async (inputToTest = null) => {
    const input = (inputToTest || targetInput).trim()
    if (!input) return

    setLoading(true)
    setVerifyResult(null)
    setMatchResult(null)

    try {
      const res = await window.flywork?.universalLinkVerify?.(input)
      setVerifyResult(res)

      if (res?.success !== false && res?.domain) {
        saveToHistory(res.domain)

        // Set default test URL
        if (res.testedInput?.includes('/')) {
          setTestUrlInput(res.testedInput)
          setSimUrlInput(res.testedInput)
        } else {
          const defaultUrl = `https://${res.domain}/`
          setTestUrlInput(defaultUrl)
          setSimUrlInput(defaultUrl)
        }

        // Default selected App ID for matcher
        if (res.aasaValidation?.summary?.apps?.length > 0) {
          setTestAppId(res.aasaValidation.summary.apps[0])
        }

        // If auto test matched
        if (res.autoTestResult) {
          setMatchResult(res.autoTestResult)
        }
      }
    } catch (err) {
      setVerifyResult({
        success: false,
        error: err.message || '执行通用链接验证异常'
      })
    } finally {
      setLoading(false)
    }
  }

  // Scan local workspace Xcode entitlements
  const handleScanWorkspace = async (wsId = null) => {
    const targetWsId = wsId || activeWorkspaceId
    const ws = workspaces.find((w) => w.id === targetWsId)
    if (!ws?.root) return

    setWorkspaceScanLoading(true)
    try {
      const res = await window.flywork?.universalLinkCheckWorkspace?.(ws.root)
      setWorkspaceScanResult(res)
    } catch (err) {
      setWorkspaceScanResult({
        found: false,
        error: err.message || '扫描本地工作区失败'
      })
    } finally {
      setWorkspaceScanLoading(false)
    }
  }

  // Run URL matcher against active AASA
  const handleTestUrlMatch = async () => {
    const aasaData =
      explorerSource === 'cdn'
        ? verifyResult?.appleCdn?.bodyJson
        : verifyResult?.activeAasa?.bodyJson

    if (!aasaData) {
      setMatchResult({
        matched: false,
        error: '尚未获取到有效的 AASA 数据，请先完成上方域名诊断'
      })
      return
    }

    if (!testUrlInput.trim()) return

    setMatchingLoading(true)
    try {
      const res = await window.flywork?.universalLinkTestUrl?.(
        aasaData,
        testUrlInput.trim(),
        testAppId || null
      )
      setMatchResult(res)
    } catch (err) {
      setMatchResult({
        matched: false,
        error: err.message || 'URL 规则匹配测试失败'
      })
    } finally {
      setMatchingLoading(false)
    }
  }

  // Trigger Simulator Open
  const handleSimOpen = async () => {
    const url = simUrlInput.trim() || testUrlInput.trim()
    if (!url) return

    setSimRunning(true)
    setSimResult(null)
    try {
      const res = await window.flywork?.universalLinkSimulatorOpen?.(url)
      setSimResult(res)
    } catch (err) {
      setSimResult({
        success: false,
        error: err.message || '模拟器调起执行异常'
      })
    } finally {
      setSimRunning(false)
    }
  }

  // Generate AASA template
  const handleGenerateAasa = async () => {
    const paths = genPaths
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
    const excludePaths = genExcludePaths
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)

    const components = []
    excludePaths.forEach((p) => {
      components.push({
        '/': p,
        exclude: true,
        comment: '排除路由拦截'
      })
    })
    paths.forEach((p) => {
      components.push({
        '/': p,
        comment: '允许唤起路由'
      })
    })
    components.push({ '/': '/*' })

    const legacyPaths = [...excludePaths.map((p) => `NOT ${p}`), ...paths, '*']

    try {
      const res = await window.flywork?.universalLinkGenerateTemplate?.({
        teamId: genTeamId || 'ABCDE12345',
        bundleId: genBundleId || 'com.company.app',
        paths: legacyPaths,
        components,
        format: genFormat
      })
      setGeneratedAasa(res)
    } catch (err) {
      console.error(err)
    }
  }

  const activeAasaJson =
    explorerSource === 'cdn' ? verifyResult?.appleCdn?.bodyJson : verifyResult?.activeAasa?.bodyJson

  const activeAasaRaw =
    explorerSource === 'cdn' ? verifyResult?.appleCdn?.bodyText : verifyResult?.activeAasa?.bodyText

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text)
    setCopiedCode(true)
    setTimeout(() => setCopiedCode(false), 2000)
  }

  const copyWithFeedback = (text, key) => {
    if (!text) return
    navigator.clipboard.writeText(text)
    setCopiedItemKey(key)
    setTimeout(() => setCopiedItemKey(null), 2000)
  }

  const copyWorkspaceScanReport = () => {
    if (!workspaceScanResult) return
    const currentWs = workspaces.find((w) => w.id === activeWorkspaceId)
    const lines = [
      `=== Apple Universal Links 本地 Xcode 工程扫描报告 ===`,
      `工作空间: ${currentWs?.name || '未知'} (${workspaceScanResult.workspaceRoot})`,
      `扫描时间: ${new Date().toLocaleString('zh-CN')}`,
      ``,
      `【Entitlements 文件】`,
      workspaceScanResult.entitlementsFiles?.length > 0
        ? workspaceScanResult.entitlementsFiles.map((f) => `  - ${f}`).join('\n')
        : '  (未找到 .entitlements 文件)',
      ``,
      `【关联域名配置 (com.apple.developer.associated-domains)】`,
      workspaceScanResult.domains?.length > 0
        ? workspaceScanResult.domains
            .map(
              (d) =>
                `  - ${d.raw}${d.hasDevMode ? ' [开发模式 ?mode=developer]' : ''}${d.hasMistakeHttps ? ' ⚠️格式错误(包含协议头)' : ''}`
            )
            .join('\n')
        : '  (未配置关联域名)',
      ``,
      `【识别到的 Bundle Identifier】`,
      workspaceScanResult.bundleIds?.length > 0
        ? workspaceScanResult.bundleIds.map((b) => `  - ${b}`).join('\n')
        : '  (未检测到)',
      ``,
      `【识别到的 Team ID】`,
      workspaceScanResult.teamIds?.length > 0
        ? workspaceScanResult.teamIds.map((t) => `  - ${t}`).join('\n')
        : '  (未检测到)'
    ]

    if (workspaceScanResult.warnings?.length > 0) {
      lines.push(``, `【配置警告与优化建议】`)
      workspaceScanResult.warnings.forEach((w) =>
        lines.push(`  ⚠️ [${w.file || '配置'}] ${w.message}`)
      )
    }

    navigator.clipboard.writeText(lines.join('\n'))
    setCopiedScanReport(true)
    setTimeout(() => setCopiedScanReport(false), 2000)
  }

  const copyAllWorkspaceDomains = () => {
    if (!workspaceScanResult?.domains?.length) return
    const text = workspaceScanResult.domains.map((d) => d.raw).join('\n')
    navigator.clipboard.writeText(text)
    setCopiedScanDomains(true)
    setTimeout(() => setCopiedScanDomains(false), 2000)
  }

  const copyVerifyReport = () => {
    if (!verifyResult) return
    const lines = [
      `=== Apple Universal Links 域名诊断扫描报告 ===`,
      `测试目标: ${verifyResult.testedInput || verifyResult.domain}`,
      `诊断时间: ${new Date(verifyResult.timestamp || Date.now()).toLocaleString('zh-CN')}`,
      `综合合规得分: ${verifyResult.score} / 100`,
      ``,
      `【1. 源站直接部署】`,
      `  - 部署路径: ${verifyResult.activeAasaLocation || '未找到'}`,
      `  - HTTP 状态: ${verifyResult.activeAasa?.status || '异常'} ${verifyResult.activeAasa?.statusText || ''}`,
      `  - 响应时间: ${verifyResult.activeAasa?.duration || 0}ms`,
      `  - Content-Type: ${verifyResult.activeAasa?.contentType || '未设置'}`,
      `  - 是否重定向: ${verifyResult.activeAasa?.isRedirect ? `是 -> ${verifyResult.activeAasa?.redirectLocation}` : '否 (合规)'}`,
      ``,
      `【2. Apple 官方 CDN 缓存 (iOS 14+)】`,
      `  - CDN 同步状态: ${verifyResult.cdnSyncStatus}`,
      `  - 说明: ${verifyResult.cdnSyncMessage || ''}`,
      `  - CDN 链接: https://app-site-association.cdn-apple.com/a/v1/${verifyResult.domain}`,
      ``,
      `【3. AASA 规范结构】`,
      `  - 是否合规: ${verifyResult.aasaValidation?.valid ? '是' : '否'}`,
      `  - 规范版本: ${verifyResult.aasaValidation?.format || '未知'}`,
      `  - 关联 App: ${(verifyResult.aasaValidation?.summary?.apps || []).join(', ') || '无'}`
    ]

    if (verifyResult.recommendations?.length > 0) {
      lines.push(``, `【优化建议】`)
      verifyResult.recommendations.forEach((rec, i) => lines.push(`  ${i + 1}. ${rec}`))
    }

    navigator.clipboard.writeText(lines.join('\n'))
    setCopiedVerifyReport(true)
    setTimeout(() => setCopiedVerifyReport(false), 2000)
  }

  return (
    <div
      style={{
        height: '100%',
        overflowY: 'auto',
        padding: '24px 32px',
        background: 'var(--bg-base)'
      }}
    >
      {/* Header Banner */}
      {!hideHeader && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 24 }}>🔗</span>
                <h1
                  style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}
                >
                  Apple Universal Links (通用链接) 验证工具
                </h1>
                <span
                  style={{
                    fontSize: 11,
                    padding: '2px 8px',
                    borderRadius: 'var(--radius-full)',
                    background: 'var(--accent-blue-dim)',
                    color: 'var(--accent-blue)',
                    fontWeight: 600
                  }}
                >
                  iOS 9 ~ 18 全面支持
                </span>
              </div>
              <p style={{ margin: '6px 0 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>
                一站式诊断域名 HTTPS 规范、Apple CDN 缓存同步、AASA 路由匹配与本地 Xcode 工程
                entitlements 配置
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Domain Input & Presets Bar */}
      <div
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-xl)',
          padding: '16px 20px',
          marginBottom: 20,
          boxShadow: 'var(--shadow-sm)'
        }}
      >
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <input
              type="text"
              placeholder="输入域名或完整 Universal Link (例如: bilibili.com 或 https://example.com/goods/123)..."
              value={targetInput}
              onChange={(e) => setTargetInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleVerify()
              }}
              style={{
                width: '100%',
                background: 'var(--bg-base)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                padding: '10px 14px',
                fontSize: 14,
                color: 'var(--text-primary)',
                outline: 'none',
                fontFamily: 'Menlo, Monaco, monospace'
              }}
            />
          </div>
          <button
            onClick={() => handleVerify()}
            disabled={loading || !targetInput.trim()}
            style={{
              padding: '0 24px',
              background: 'var(--accent-blue)',
              color: '#fff',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              fontSize: 13,
              fontWeight: 600,
              cursor: loading || !targetInput.trim() ? 'not-allowed' : 'pointer',
              opacity: loading || !targetInput.trim() ? 0.6 : 1,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              transition: 'background var(--transition-fast)'
            }}
          >
            {loading ? (
              <>
                <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>
                  ⟳
                </span>
                <span>诊断中...</span>
              </>
            ) : (
              <>
                <span>⚡ 开始诊断</span>
              </>
            )}
          </button>
        </div>

        {/* Quick Presets & History */}
        <div
          style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, flexWrap: 'wrap' }}
        >
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>快速测试:</span>
          {PRESET_DOMAINS.map((p) => (
            <button
              key={p.domain}
              onClick={() => {
                setTargetInput(p.domain)
                handleVerify(p.domain)
              }}
              style={{
                padding: '3px 10px',
                fontSize: 12,
                borderRadius: 'var(--radius-full)',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                color: 'var(--text-secondary)',
                cursor: 'pointer'
              }}
            >
              {p.label} ({p.domain})
            </button>
          ))}

          {history.length > 0 && (
            <>
              <div style={{ width: 1, height: 14, background: 'var(--border)', margin: '0 4px' }} />
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>近期历史:</span>
              {history.map((h) => (
                <button
                  key={h}
                  onClick={() => {
                    setTargetInput(h)
                    handleVerify(h)
                  }}
                  style={{
                    padding: '3px 10px',
                    fontSize: 12,
                    borderRadius: 'var(--radius-full)',
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border)',
                    color: 'var(--accent-blue)',
                    cursor: 'pointer'
                  }}
                >
                  {h}
                </button>
              ))}
            </>
          )}
        </div>
      </div>

      {/* Local Workspace Link Bar */}
      {workspaces && workspaces.length > 0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            padding: '10px 16px',
            marginBottom: 20
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 16 }}>🛠️</span>
            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
              关联本地 iOS 工作空间:
            </span>
            <select
              value={activeWorkspaceId}
              onChange={(e) => {
                setActiveWorkspaceId(e.target.value)
                setWorkspaceScanResult(null)
              }}
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                padding: '4px 10px',
                fontSize: 12,
                color: 'var(--text-primary)',
                outline: 'none'
              }}
            >
              <option value="">-- 选择本地项目工作空间 --</option>
              {workspaces.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} ({w.root})
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => handleScanWorkspace()}
              disabled={!activeWorkspaceId || workspaceScanLoading}
              style={{
                padding: '5px 12px',
                fontSize: 12,
                borderRadius: 'var(--radius-md)',
                background: 'var(--accent-teal-dim)',
                color: 'var(--accent-teal)',
                border: '1px solid rgba(38, 198, 218, 0.3)',
                cursor: !activeWorkspaceId || workspaceScanLoading ? 'not-allowed' : 'pointer',
                fontWeight: 600
              }}
            >
              {workspaceScanLoading ? '扫描中...' : '🔍 扫描 Xcode Entitlements 关联配置'}
            </button>
          </div>
        </div>
      )}

      {/* Workspace Scan Result Banner (if scanned) */}
      {workspaceScanResult && (
        <div
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            padding: '14px 18px',
            marginBottom: 20
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 10,
              flexWrap: 'wrap',
              gap: 8
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                📱 本地 Xcode 工程扫描结果
              </span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                ({workspaceScanResult.workspaceRoot})
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {workspaceScanResult.domains?.length > 0 && (
                <button
                  onClick={copyAllWorkspaceDomains}
                  style={{
                    padding: '3px 10px',
                    fontSize: 11,
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border)',
                    color: copiedScanDomains ? 'var(--accent-green)' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4
                  }}
                  title="复制所有关联域名列表"
                >
                  {copiedScanDomains ? '已复制域名 ✓' : '📋 复制全部域名'}
                </button>
              )}

              <button
                onClick={copyWorkspaceScanReport}
                style={{
                  padding: '3px 10px',
                  fontSize: 11,
                  borderRadius: 'var(--radius-sm)',
                  background: copiedScanReport ? 'var(--accent-green-dim)' : 'var(--bg-elevated)',
                  border: `1px solid ${copiedScanReport ? 'var(--accent-green)' : 'var(--border)'}`,
                  color: copiedScanReport ? 'var(--accent-green)' : 'var(--text-primary)',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4
                }}
                title="复制包含 Entitlements、Associated Domains、BundleID 与警告的完整报告"
              >
                {copiedScanReport ? '已复制扫描报告 ✓' : '📋 复制完整扫描报告'}
              </button>
            </div>
          </div>

          {workspaceScanResult.error ? (
            <div style={{ fontSize: 12, color: 'var(--accent-red)' }}>
              {workspaceScanResult.error}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12 }}>
              <div>
                <strong style={{ color: 'var(--text-secondary)' }}>发现 Entitlements: </strong>
                {workspaceScanResult.entitlementsFiles?.length > 0 ? (
                  workspaceScanResult.entitlementsFiles.map((f, i) => (
                    <code
                      key={i}
                      onClick={() => copyWithFeedback(f, `ent_${i}`)}
                      title="点击复制文件路径"
                      style={{
                        color: 'var(--accent-teal)',
                        marginRight: 8,
                        cursor: 'pointer',
                        padding: '1px 5px',
                        borderRadius: 3,
                        background:
                          copiedItemKey === `ent_${i}`
                            ? 'var(--accent-teal-dim)'
                            : 'var(--bg-elevated)'
                      }}
                    >
                      {f.split('/').pop()}
                      {copiedItemKey === `ent_${i}` ? ' (已复制)' : ''}
                    </code>
                  ))
                ) : (
                  <span style={{ color: 'var(--text-muted)' }}>未找到 .entitlements 文件</span>
                )}
              </div>

              <div>
                <strong style={{ color: 'var(--text-secondary)' }}>
                  关联域名 (associated-domains):{' '}
                </strong>
                {workspaceScanResult.domains?.length > 0 ? (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                    {workspaceScanResult.domains.map((d, i) => {
                      const isCurrentDomain =
                        verifyResult?.domain && d.cleanDomain === verifyResult.domain
                      const isCopied = copiedItemKey === `dom_${i}`
                      return (
                        <span
                          key={i}
                          onClick={() => copyWithFeedback(d.raw, `dom_${i}`)}
                          title="点击复制此域名配置"
                          style={{
                            padding: '2px 8px',
                            borderRadius: 'var(--radius-sm)',
                            background: isCopied
                              ? 'var(--accent-blue-dim)'
                              : isCurrentDomain
                                ? 'var(--accent-green-dim)'
                                : 'var(--bg-elevated)',
                            color: isCopied
                              ? 'var(--accent-blue)'
                              : isCurrentDomain
                                ? 'var(--accent-green)'
                                : 'var(--text-primary)',
                            border: `1px solid ${
                              isCopied
                                ? 'var(--accent-blue)'
                                : isCurrentDomain
                                  ? 'rgba(63,185,80,0.4)'
                                  : 'var(--border)'
                            }`,
                            fontFamily: 'monospace',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4
                          }}
                        >
                          {d.raw} {isCurrentDomain && '✓ 当前匹配'}
                          {d.hasDevMode && ' [developer mode]'}
                          {isCopied ? (
                            <span style={{ color: 'var(--accent-blue)', fontWeight: 600 }}>
                              ✓ 已复制
                            </span>
                          ) : (
                            <span style={{ opacity: 0.4, fontSize: 10 }}>📋</span>
                          )}
                        </span>
                      )
                    })}
                  </div>
                ) : (
                  <span style={{ color: 'var(--accent-amber)' }}>
                    未配置 com.apple.developer.associated-domains 域名！
                  </span>
                )}
              </div>

              {workspaceScanResult.bundleIds?.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <strong style={{ color: 'var(--text-secondary)' }}>识别到的 Bundle ID:</strong>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 2 }}>
                    {workspaceScanResult.bundleIds.map((bid, i) => {
                      const isCopied = copiedItemKey === `bid_${i}`
                      return (
                        <code
                          key={i}
                          onClick={() => copyWithFeedback(bid, `bid_${i}`)}
                          title="点击复制 Bundle Identifier"
                          style={{
                            color: 'var(--accent-blue)',
                            cursor: 'pointer',
                            padding: '2px 8px',
                            borderRadius: 'var(--radius-sm)',
                            background: isCopied ? 'var(--accent-blue-dim)' : 'var(--bg-elevated)',
                            border: `1px solid ${isCopied ? 'var(--accent-blue)' : 'var(--border)'}`,
                            wordBreak: 'break-all',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4
                          }}
                        >
                          {bid}
                          {isCopied ? (
                            <span style={{ color: 'var(--accent-blue)', fontWeight: 600 }}>
                              ✓ 已复制
                            </span>
                          ) : (
                            <span style={{ opacity: 0.4, fontSize: 10 }}>📋</span>
                          )}
                        </code>
                      )
                    })}
                  </div>
                </div>
              )}

              {workspaceScanResult.teamIds?.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <strong style={{ color: 'var(--text-secondary)' }}>Team ID:</strong>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {workspaceScanResult.teamIds.map((tid, i) => {
                      const isCopied = copiedItemKey === `tid_${i}`
                      return (
                        <code
                          key={i}
                          onClick={() => copyWithFeedback(tid, `tid_${i}`)}
                          title="点击复制 Team ID"
                          style={{
                            color: 'var(--accent-purple)',
                            cursor: 'pointer',
                            padding: '2px 8px',
                            borderRadius: 'var(--radius-sm)',
                            background: isCopied
                              ? 'var(--accent-purple-dim)'
                              : 'var(--bg-elevated)',
                            border: `1px solid ${isCopied ? 'var(--accent-purple)' : 'var(--border)'}`,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4
                          }}
                        >
                          {tid}
                          {isCopied ? (
                            <span style={{ color: 'var(--accent-purple)', fontWeight: 600 }}>
                              ✓ 已复制
                            </span>
                          ) : (
                            <span style={{ opacity: 0.4, fontSize: 10 }}>📋</span>
                          )}
                        </code>
                      )
                    })}
                  </div>
                </div>
              )}

              {workspaceScanResult.warnings?.length > 0 && (
                <div style={{ marginTop: 4 }}>
                  {workspaceScanResult.warnings.map((w, i) => (
                    <div
                      key={i}
                      style={{
                        color: 'var(--accent-amber)',
                        padding: '4px 8px',
                        background: 'var(--accent-amber-dim)',
                        borderRadius: 'var(--radius-sm)',
                        marginTop: 4
                      }}
                    >
                      ⚠️ {w.message}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Verification Results Section */}
      {verifyResult && (
        <>
          {/* Results Action Bar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 12
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                📊 诊断扫描结果: {verifyResult.domain}
              </span>
              {verifyResult.timestamp && (
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  ({new Date(verifyResult.timestamp).toLocaleTimeString('zh-CN')})
                </span>
              )}
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={copyVerifyReport}
                style={{
                  padding: '5px 12px',
                  fontSize: 12,
                  borderRadius: 'var(--radius-md)',
                  background: copiedVerifyReport ? 'var(--accent-green-dim)' : 'var(--bg-elevated)',
                  border: `1px solid ${copiedVerifyReport ? 'var(--accent-green)' : 'var(--border)'}`,
                  color: copiedVerifyReport ? 'var(--accent-green)' : 'var(--text-primary)',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6
                }}
              >
                {copiedVerifyReport ? '已复制诊断报告 ✓' : '📋 复制完整诊断报告'}
              </button>
            </div>
          </div>
          {/* Health Score & Diagnostic Cards */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: 16,
              marginBottom: 20
            }}
          >
            {/* Card 1: Direct HTTPS & AASA */}
            <div
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-lg)',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: 8
              }}
            >
              <div
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
              >
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
                  🌐 源站直接访问
                </span>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    padding: '2px 6px',
                    borderRadius: 4,
                    background:
                      verifyResult.activeAasa?.status === 200
                        ? 'var(--accent-green-dim)'
                        : 'var(--accent-red-dim)',
                    color:
                      verifyResult.activeAasa?.status === 200
                        ? 'var(--accent-green)'
                        : 'var(--accent-red)'
                  }}
                >
                  {verifyResult.activeAasa?.status === 200
                    ? '200 OK'
                    : verifyResult.activeAasa?.status || '异常'}
                </span>
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                {verifyResult.activeAasaLocation !== 'none'
                  ? verifyResult.activeAasaLocation
                  : '未探测到 AASA'}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                耗时: {verifyResult.activeAasa?.duration || 0}ms · 大小:{' '}
                {((verifyResult.activeAasa?.contentLength || 0) / 1024).toFixed(1)} KB
              </div>
              {verifyResult.activeAasa?.isRedirect && (
                <div style={{ fontSize: 11, color: 'var(--accent-red)' }}>
                  ⚠️ 检测到重定向 (Apple CDN 禁止重定向)
                </div>
              )}
            </div>

            {/* Card 2: Apple CDN Cache (iOS 14+) */}
            <div
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-lg)',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: 8
              }}
            >
              <div
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
              >
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
                  🍎 Apple 官方 CDN 缓存
                </span>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    padding: '2px 6px',
                    borderRadius: 4,
                    background:
                      verifyResult.cdnSyncStatus === 'synced'
                        ? 'var(--accent-green-dim)'
                        : verifyResult.cdnSyncStatus === 'outdated'
                          ? 'var(--accent-amber-dim)'
                          : 'var(--accent-red-dim)',
                    color:
                      verifyResult.cdnSyncStatus === 'synced'
                        ? 'var(--accent-green)'
                        : verifyResult.cdnSyncStatus === 'outdated'
                          ? 'var(--accent-amber)'
                          : 'var(--accent-red)'
                  }}
                >
                  {verifyResult.cdnSyncStatus === 'synced'
                    ? '已同步'
                    : verifyResult.cdnSyncStatus === 'outdated'
                      ? '缓存不一致'
                      : verifyResult.cdnSyncStatus === 'not_cached'
                        ? '未收录 (404)'
                        : '无法访问'}
                </span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.4 }}>
                {verifyResult.cdnSyncMessage}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                针对 iOS 14+ 线上环境生效
              </div>
            </div>

            {/* Card 3: AASA Schema & Format */}
            <div
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-lg)',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: 8
              }}
            >
              <div
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
              >
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
                  📑 AASA 规范结构
                </span>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    padding: '2px 6px',
                    borderRadius: 4,
                    background: verifyResult.aasaValidation?.valid
                      ? 'var(--accent-green-dim)'
                      : 'var(--accent-amber-dim)',
                    color: verifyResult.aasaValidation?.valid
                      ? 'var(--accent-green)'
                      : 'var(--accent-amber)'
                  }}
                >
                  {verifyResult.aasaValidation?.valid ? '合规通过' : '有待修正'}
                </span>
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                规范模式: {verifyResult.aasaValidation?.format || '未知'}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                关联 App 数量: {verifyResult.aasaValidation?.summary?.appCount || 0} 个
              </div>
            </div>

            {/* Card 4: Overall Health Score */}
            <div
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-lg)',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: 8
              }}
            >
              <div
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
              >
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
                  🎯 综合合规得分
                </span>
                <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent-blue)' }}>
                  {verifyResult.score} / 100
                </span>
              </div>
              <div
                style={{
                  height: 6,
                  borderRadius: 3,
                  background: 'var(--bg-elevated)',
                  overflow: 'hidden',
                  marginTop: 4
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${verifyResult.score}%`,
                    background:
                      verifyResult.score >= 80
                        ? 'var(--accent-green)'
                        : verifyResult.score >= 50
                          ? 'var(--accent-amber)'
                          : 'var(--accent-red)',
                    transition: 'width 300ms ease'
                  }}
                />
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {verifyResult.recommendations?.length === 0
                  ? '所有检查项均符合 Apple 规范'
                  : `存在 ${verifyResult.recommendations.length} 项优化建议`}
              </div>
            </div>
          </div>

          {/* Recommendations Banner (if any) */}
          {verifyResult.recommendations?.length > 0 && (
            <div
              style={{
                background: 'rgba(210, 153, 34, 0.08)',
                border: '1px solid rgba(210, 153, 34, 0.3)',
                borderRadius: 'var(--radius-md)',
                padding: '12px 16px',
                marginBottom: 20
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: 'var(--accent-amber)',
                  marginBottom: 6
                }}
              >
                💡 优化与排查建议:
              </div>
              <ul
                style={{
                  margin: 0,
                  paddingLeft: 18,
                  fontSize: 12,
                  color: 'var(--text-primary)',
                  lineHeight: 1.6
                }}
              >
                {verifyResult.recommendations.map((rec, i) => (
                  <li key={i}>{rec}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Navigation Tabs */}
          <div
            style={{
              display: 'flex',
              borderBottom: '1px solid var(--border)',
              marginBottom: 20
            }}
          >
            {[
              { id: 'matcher', label: '🎯 URL 规则匹配测试器' },
              { id: 'explorer', label: '🔍 AASA 文件查看器' },
              { id: 'simulator', label: '📲 iOS 模拟器调起调试' },
              { id: 'generator', label: '🛠️ AASA 生成助手' }
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                style={{
                  padding: '10px 20px',
                  fontSize: 13,
                  fontWeight: activeTab === t.id ? 600 : 400,
                  color: activeTab === t.id ? 'var(--accent-blue)' : 'var(--text-secondary)',
                  borderBottom:
                    activeTab === t.id ? '2px solid var(--accent-blue)' : '2px solid transparent',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  borderTopLeftRadius: 'var(--radius-md)',
                  borderTopRightRadius: 'var(--radius-md)'
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Tab 1: URL Matcher */}
          {activeTab === 'matcher' && (
            <div
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-xl)',
                padding: '20px'
              }}
            >
              <div style={{ marginBottom: 16 }}>
                <h3
                  style={{
                    margin: '0 0 4px 0',
                    fontSize: 14,
                    fontWeight: 600,
                    color: 'var(--text-primary)'
                  }}
                >
                  实时 URL 路由规则模拟器
                </h3>
                <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)' }}>
                  输入具体待测试的页面链接（包含路径与 Query 参数），模拟 iOS 系统在遇到该 Universal
                  Link 时的处理结果
                </p>
              </div>

              <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                <div style={{ flex: 1 }}>
                  <input
                    type="text"
                    value={testUrlInput}
                    onChange={(e) => setTestUrlInput(e.target.value)}
                    placeholder={`https://${verifyResult.domain}/path/to/item?id=123`}
                    style={{
                      width: '100%',
                      background: 'var(--bg-base)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-md)',
                      padding: '9px 12px',
                      fontSize: 13,
                      color: 'var(--text-primary)',
                      fontFamily: 'monospace'
                    }}
                  />
                </div>

                {verifyResult.aasaValidation?.summary?.apps?.length > 1 && (
                  <select
                    value={testAppId}
                    onChange={(e) => setTestAppId(e.target.value)}
                    style={{
                      background: 'var(--bg-base)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-md)',
                      padding: '8px 12px',
                      fontSize: 12,
                      color: 'var(--text-primary)'
                    }}
                  >
                    <option value="">全部 AppID</option>
                    {verifyResult.aasaValidation.summary.apps.map((app) => (
                      <option key={app} value={app}>
                        {app}
                      </option>
                    ))}
                  </select>
                )}

                <button
                  onClick={handleTestUrlMatch}
                  disabled={matchingLoading || !testUrlInput.trim()}
                  style={{
                    padding: '0 20px',
                    background: 'var(--accent-blue)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 'var(--radius-md)',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  {matchingLoading ? '测试中...' : '测试匹配'}
                </button>
              </div>

              {/* Match Result Output Banner */}
              {matchResult && (
                <div
                  style={{
                    borderRadius: 'var(--radius-lg)',
                    padding: '16px',
                    background: matchResult.matched
                      ? 'rgba(63, 185, 80, 0.1)'
                      : matchResult.isExcluded
                        ? 'rgba(224, 92, 92, 0.1)'
                        : 'rgba(139, 148, 158, 0.1)',
                    border: `1px solid ${
                      matchResult.matched
                        ? 'rgba(63, 185, 80, 0.3)'
                        : matchResult.isExcluded
                          ? 'rgba(224, 92, 92, 0.3)'
                          : 'var(--border)'
                    }`,
                    marginBottom: 16
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{ fontSize: 16 }}>
                      {matchResult.matched ? '✅' : matchResult.isExcluded ? '🛑' : '⚪'}
                    </span>
                    <span
                      style={{
                        fontSize: 14,
                        fontWeight: 700,
                        color: matchResult.matched
                          ? 'var(--accent-green)'
                          : matchResult.isExcluded
                            ? 'var(--accent-red)'
                            : 'var(--text-secondary)'
                      }}
                    >
                      {matchResult.matched
                        ? '成功匹配 Universal Link（iOS 将直接唤起 App）'
                        : matchResult.isExcluded
                          ? '命中排除规则（iOS 将留在 Safari 浏览器打开）'
                          : '未匹配任何规则（iOS 默认在 Safari 浏览器打开）'}
                    </span>
                  </div>

                  <div style={{ fontSize: 12, color: 'var(--text-primary)', marginTop: 4 }}>
                    {matchResult.reason}
                  </div>

                  {matchResult.matchedAppId && (
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                      生效 AppID:{' '}
                      <code style={{ color: 'var(--accent-blue)' }}>
                        {matchResult.matchedAppId}
                      </code>
                    </div>
                  )}
                </div>
              )}

              {/* Step-by-step Rule Breakdown */}
              {matchResult?.evaluations?.length > 0 && (
                <div>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: 'var(--text-secondary)',
                      marginBottom: 8
                    }}
                  >
                    规则匹配评估链路 (按优先级顺序执行):
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {matchResult.evaluations.map((ev, i) => (
                      <div
                        key={i}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '8px 12px',
                          background: ev.isHit
                            ? ev.isExcluded
                              ? 'rgba(224, 92, 92, 0.15)'
                              : 'rgba(63, 185, 80, 0.15)'
                            : 'var(--bg-elevated)',
                          border: `1px solid ${
                            ev.isHit
                              ? ev.isExcluded
                                ? 'rgba(224, 92, 92, 0.4)'
                                : 'rgba(63, 185, 80, 0.4)'
                              : 'var(--border)'
                          }`,
                          borderRadius: 'var(--radius-md)',
                          fontSize: 12
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span
                            style={{
                              fontSize: 11,
                              padding: '1px 6px',
                              borderRadius: 4,
                              background: 'var(--bg-base)',
                              color: 'var(--text-muted)'
                            }}
                          >
                            #{i + 1}
                          </span>
                          <span style={{ fontFamily: 'monospace', color: 'var(--text-primary)' }}>
                            {typeof ev.rule === 'string' ? ev.rule : JSON.stringify(ev.rule)}
                          </span>
                          {ev.isExcluded && (
                            <span
                              style={{
                                fontSize: 10,
                                padding: '1px 4px',
                                borderRadius: 3,
                                background: 'var(--accent-red-dim)',
                                color: 'var(--accent-red)'
                              }}
                            >
                              exclude
                            </span>
                          )}
                          {ev.comment && (
                            <span style={{ color: 'var(--text-muted)' }}>({ev.comment})</span>
                          )}
                        </div>

                        <div>
                          {ev.isHit ? (
                            <span
                              style={{
                                color: ev.isExcluded ? 'var(--accent-red)' : 'var(--accent-green)',
                                fontWeight: 600
                              }}
                            >
                              {ev.isExcluded ? '🛑 命中排除' : '✓ 命中唤起'}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)' }}>未匹配</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Tab 2: AASA Explorer */}
          {activeTab === 'explorer' && (
            <div
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-xl)',
                padding: '20px'
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 14
                }}
              >
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => setExplorerSource('direct')}
                    style={{
                      padding: '6px 12px',
                      fontSize: 12,
                      borderRadius: 'var(--radius-md)',
                      background:
                        explorerSource === 'direct' ? 'var(--accent-blue)' : 'var(--bg-elevated)',
                      color: explorerSource === 'direct' ? '#fff' : 'var(--text-secondary)',
                      border: '1px solid var(--border)',
                      cursor: 'pointer',
                      fontWeight: 600
                    }}
                  >
                    源站部署 ({verifyResult.activeAasaLocation || '未知'})
                  </button>
                  <button
                    onClick={() => setExplorerSource('cdn')}
                    style={{
                      padding: '6px 12px',
                      fontSize: 12,
                      borderRadius: 'var(--radius-md)',
                      background:
                        explorerSource === 'cdn' ? 'var(--accent-blue)' : 'var(--bg-elevated)',
                      color: explorerSource === 'cdn' ? '#fff' : 'var(--text-secondary)',
                      border: '1px solid var(--border)',
                      cursor: 'pointer',
                      fontWeight: 600
                    }}
                  >
                    Apple 官方 CDN 缓存 (iOS 14+)
                  </button>
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() =>
                      copyToClipboard(
                        activeAasaJson
                          ? JSON.stringify(activeAasaJson, null, 2)
                          : activeAasaRaw || ''
                      )
                    }
                    style={{
                      padding: '6px 12px',
                      fontSize: 12,
                      borderRadius: 'var(--radius-md)',
                      background: 'var(--bg-elevated)',
                      border: '1px solid var(--border)',
                      color: 'var(--text-primary)',
                      cursor: 'pointer'
                    }}
                  >
                    {copiedCode ? '已复制 ✓' : '📋 复制 JSON'}
                  </button>

                  <button
                    onClick={() => {
                      const element = document.createElement('a')
                      const file = new Blob([JSON.stringify(activeAasaJson || {}, null, 2)], {
                        type: 'application/json'
                      })
                      element.href = URL.createObjectURL(file)
                      element.download = 'apple-app-site-association'
                      document.body.appendChild(element)
                      element.click()
                      document.body.removeChild(element)
                    }}
                    style={{
                      padding: '6px 12px',
                      fontSize: 12,
                      borderRadius: 'var(--radius-md)',
                      background: 'var(--bg-elevated)',
                      border: '1px solid var(--border)',
                      color: 'var(--text-primary)',
                      cursor: 'pointer'
                    }}
                  >
                    💾 下载 AASA 文件
                  </button>
                </div>
              </div>

              {/* Code Pre Box */}
              <div
                style={{
                  background: '#090d13',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-lg)',
                  padding: 16,
                  fontFamily: 'Menlo, Monaco, Consolas, monospace',
                  fontSize: 12,
                  color: '#9cdcfe',
                  maxHeight: 500,
                  overflowY: 'auto',
                  lineHeight: 1.5,
                  whiteSpace: 'pre-wrap'
                }}
              >
                {activeAasaJson
                  ? JSON.stringify(activeAasaJson, null, 2)
                  : activeAasaRaw || '无返回内容'}
              </div>
            </div>
          )}

          {/* Tab 3: Simulator Debugger */}
          {activeTab === 'simulator' && (
            <div
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-xl)',
                padding: '20px'
              }}
            >
              <div style={{ marginBottom: 16 }}>
                <h3
                  style={{
                    margin: '0 0 4px 0',
                    fontSize: 14,
                    fontWeight: 600,
                    color: 'var(--text-primary)'
                  }}
                >
                  iOS 模拟器一键调起与联调 (xcrun simctl)
                </h3>
                <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)' }}>
                  自动检测当前已开机的 iOS 模拟器，并执行{' '}
                  <code>xcrun simctl openurl booted &lt;URL&gt;</code> 直接测试 Universal Link
                  唤起表现
                </p>
              </div>

              <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                <div style={{ flex: 1 }}>
                  <input
                    type="text"
                    value={simUrlInput}
                    onChange={(e) => setSimUrlInput(e.target.value)}
                    placeholder="待测试唤起的完整 Universal Link URL..."
                    style={{
                      width: '100%',
                      background: 'var(--bg-base)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-md)',
                      padding: '9px 12px',
                      fontSize: 13,
                      color: 'var(--text-primary)',
                      fontFamily: 'monospace'
                    }}
                  />
                </div>
                <button
                  onClick={handleSimOpen}
                  disabled={simRunning || !simUrlInput.trim()}
                  style={{
                    padding: '0 20px',
                    background: 'var(--accent-green)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 'var(--radius-md)',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: simRunning || !simUrlInput.trim() ? 'not-allowed' : 'pointer'
                  }}
                >
                  {simRunning ? '正在调起...' : '🚀 在模拟器中打开'}
                </button>
              </div>

              {/* Simctl Result Banner */}
              {simResult && (
                <div
                  style={{
                    padding: '12px 16px',
                    borderRadius: 'var(--radius-md)',
                    background: simResult.success
                      ? 'rgba(63, 185, 80, 0.1)'
                      : 'rgba(224, 92, 92, 0.1)',
                    border: `1px solid ${
                      simResult.success ? 'rgba(63, 185, 80, 0.3)' : 'rgba(224, 92, 92, 0.3)'
                    }`,
                    marginBottom: 16,
                    fontSize: 12
                  }}
                >
                  <div
                    style={{
                      fontWeight: 600,
                      color: simResult.success ? 'var(--accent-green)' : 'var(--accent-red)'
                    }}
                  >
                    {simResult.success ? '✓ 调起指令已发送至模拟器' : '✗ 调起失败'}
                  </div>
                  {simResult.error && (
                    <div style={{ color: 'var(--text-secondary)', marginTop: 4 }}>
                      {simResult.error}
                    </div>
                  )}
                  {simResult.command && (
                    <div
                      style={{ fontFamily: 'monospace', color: 'var(--text-muted)', marginTop: 4 }}
                    >
                      执行命令: {simResult.command}
                    </div>
                  )}
                </div>
              )}

              {/* Developer Tips for Universal Links Testing */}
              <div
                style={{
                  background: 'var(--bg-elevated)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '14px 16px',
                  fontSize: 12,
                  color: 'var(--text-secondary)',
                  lineHeight: 1.6
                }}
              >
                <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
                  💡 Universal Links 本地调试要点:
                </div>
                <div>
                  1. <strong>开发模式避免 CDN 延迟:</strong> 在 entitlements 的域名后追加{' '}
                  <code>?mode=developer</code>，iOS 就会直接向您的服务器拉取 AASA，而绕过 Apple CDN
                  缓存。
                </div>
                <div>
                  2. <strong>测试触发方式:</strong> 在备忘录 (Notes) 或信息 (Messages)
                  中点击链接，或者通过终端{' '}
                  <code>{'xcrun simctl openurl booted "https://..."'}</code> 触发。请勿在 Safari
                  地址栏中直接回车（直接回车会被 Safari 视为网页浏览而非唤起）。
                </div>
                <div>
                  3. <strong>跨域要求:</strong> Universal Link 唤起要求<strong>域名跨域</strong>
                  （即不能在当前网页的 JS 中通过 <code>location.href</code> 跳转到同域的 Universal
                  Link，否则 Safari 会直接在当前网页加载）。
                </div>
              </div>
            </div>
          )}

          {/* Tab 4: AASA Generator */}
          {activeTab === 'generator' && (
            <div
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-xl)',
                padding: '20px'
              }}
            >
              <div style={{ marginBottom: 16 }}>
                <h3
                  style={{
                    margin: '0 0 4px 0',
                    fontSize: 14,
                    fontWeight: 600,
                    color: 'var(--text-primary)'
                  }}
                >
                  AASA (apple-app-site-association) 规范生成助手
                </h3>
                <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)' }}>
                  无需手写复杂 JSON，填写参数一键生成符合 Apple Modern (iOS 13+) / Legacy
                  规范的配置文件
                </p>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 16,
                  marginBottom: 16
                }}
              >
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: 12,
                      fontWeight: 600,
                      color: 'var(--text-secondary)',
                      marginBottom: 6
                    }}
                  >
                    Apple Team ID (10位字符，如 ABCDE12345):
                  </label>
                  <input
                    type="text"
                    value={genTeamId}
                    onChange={(e) => setGenTeamId(e.target.value)}
                    placeholder="例如: ABCDE12345"
                    style={{
                      width: '100%',
                      background: 'var(--bg-base)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-md)',
                      padding: '8px 12px',
                      fontSize: 13,
                      color: 'var(--text-primary)'
                    }}
                  />
                </div>

                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: 12,
                      fontWeight: 600,
                      color: 'var(--text-secondary)',
                      marginBottom: 6
                    }}
                  >
                    App Bundle Identifier:
                  </label>
                  <input
                    type="text"
                    value={genBundleId}
                    onChange={(e) => setGenBundleId(e.target.value)}
                    placeholder="例如: com.example.myapp"
                    style={{
                      width: '100%',
                      background: 'var(--bg-base)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-md)',
                      padding: '8px 12px',
                      fontSize: 13,
                      color: 'var(--text-primary)'
                    }}
                  />
                </div>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 16,
                  marginBottom: 16
                }}
              >
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: 12,
                      fontWeight: 600,
                      color: 'var(--text-secondary)',
                      marginBottom: 6
                    }}
                  >
                    允许唤起的路径规则 (每行一条，支持 * 和 ? 通配符):
                  </label>
                  <textarea
                    rows={4}
                    value={genPaths}
                    onChange={(e) => setGenPaths(e.target.value)}
                    placeholder="/goods/*&#10;/user/*&#10;/detail/?"
                    style={{
                      width: '100%',
                      background: 'var(--bg-base)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-md)',
                      padding: '8px 12px',
                      fontSize: 12,
                      color: 'var(--text-primary)',
                      fontFamily: 'monospace'
                    }}
                  />
                </div>

                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: 12,
                      fontWeight: 600,
                      color: 'var(--text-secondary)',
                      marginBottom: 6
                    }}
                  >
                    排除在外的阻断路径 (每行一条，留在网页打开):
                  </label>
                  <textarea
                    rows={4}
                    value={genExcludePaths}
                    onChange={(e) => setGenExcludePaths(e.target.value)}
                    placeholder="/pay/*&#10;/secret/*"
                    style={{
                      width: '100%',
                      background: 'var(--bg-base)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-md)',
                      padding: '8px 12px',
                      fontSize: 12,
                      color: 'var(--text-primary)',
                      fontFamily: 'monospace'
                    }}
                  />
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 16
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
                    规范版本:
                  </span>
                  <label style={{ fontSize: 12, color: 'var(--text-primary)', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="format"
                      value="modern"
                      checked={genFormat === 'modern'}
                      onChange={(e) => setGenFormat(e.target.value)}
                      style={{ marginRight: 4 }}
                    />
                    Modern 现代规范 (iOS 13+ components)
                  </label>
                  <label style={{ fontSize: 12, color: 'var(--text-primary)', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="format"
                      value="hybrid"
                      checked={genFormat === 'hybrid'}
                      onChange={(e) => setGenFormat(e.target.value)}
                      style={{ marginRight: 4 }}
                    />
                    Hybrid 双规范兼容 (推荐)
                  </label>
                  <label style={{ fontSize: 12, color: 'var(--text-primary)', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="format"
                      value="legacy"
                      checked={genFormat === 'legacy'}
                      onChange={(e) => setGenFormat(e.target.value)}
                      style={{ marginRight: 4 }}
                    />
                    Legacy 旧版规范 (iOS 9~12 paths)
                  </label>
                </div>

                <button
                  onClick={handleGenerateAasa}
                  style={{
                    padding: '8px 20px',
                    background: 'var(--accent-blue)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 'var(--radius-md)',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  ⚡ 生成 AASA 配置
                </button>
              </div>

              {/* Generated AASA Preview */}
              {generatedAasa && (
                <div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: 8
                    }}
                  >
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
                      生成的 AASA JSON 预览:
                    </span>
                    <button
                      onClick={() => copyToClipboard(JSON.stringify(generatedAasa, null, 2))}
                      style={{
                        padding: '4px 10px',
                        fontSize: 11,
                        background: 'var(--bg-elevated)',
                        border: '1px solid var(--border)',
                        color: 'var(--text-primary)',
                        borderRadius: 'var(--radius-sm)',
                        cursor: 'pointer'
                      }}
                    >
                      {copiedCode ? '已复制 ✓' : '📋 复制内容'}
                    </button>
                  </div>
                  <pre
                    style={{
                      background: '#090d13',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-md)',
                      padding: 12,
                      fontSize: 12,
                      color: '#9cdcfe',
                      fontFamily: 'monospace',
                      maxHeight: 280,
                      overflowY: 'auto'
                    }}
                  >
                    {JSON.stringify(generatedAasa, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

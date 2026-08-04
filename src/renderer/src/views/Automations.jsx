import { useState, useRef, useEffect, useCallback } from 'react'
import EditAutomationModal from '../components/EditAutomationModal'

// Parse KEY=VALUE text supporting both newline and space-separated pairs
// Handles: "BUILD_ENV=dev\nSCHEME=PetPal" and "BUILD_ENV=dev SCHEME=PetPal"
function parseEnvText(text) {
  const result = {}
  if (!text) return result
  const lines = text.split('\n')
  lines.forEach(rawLine => {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) return
    const tokenRe = /([A-Za-z_][A-Za-z0-9_]*)=([^\s]*)/g
    let m
    while ((m = tokenRe.exec(line)) !== null) {
      const key = m[1].trim()
      let val = m[2].trim()
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1)
      }
      if (key) result[key] = val
    }
  })
  return result
}

const RISK_CONFIG = {
  readonly: { label: '只读', color: 'var(--text-secondary)', bg: 'var(--bg-hover)' },
  normal: { label: '普通', color: 'var(--accent-blue)', bg: 'var(--accent-blue-dim)' },
  modify: { label: '修改', color: 'var(--accent-amber)', bg: 'var(--accent-amber-dim)' },
  high: { label: '高风险', color: 'var(--accent-red)', bg: 'var(--accent-red-dim)' }
}

function formatRelTime(iso) {
  if (!iso) return '从"运行'
  const d = new Date(iso)
  const now = new Date()
  const diff = now - d
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`
  return `${Math.floor(diff / 86400000)}天前`
}

export default function AutomationsView({
  automations = [],
  workspaces = [],
  setAutomations,
  onSetContextPanel,
  onAskAI
}) {
  const [selectedAutomationId, setSelectedAutomationId] = useState(automations[0]?.id || null)
  const [runningStepKeys, setRunningStepKeys] = useState({})
  const [stepLogs, setStepLogs] = useState({})
  const [expandedStepId, setExpandedStepId] = useState(null)

  // Modal states
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [editingAutomation, setEditingAutomation] = useState(null)

  // Runtime Environment Preset selector state
  const [runtimeEnvPreset, setRuntimeEnvPreset] = useState('DEFAULT') // 'DEFAULT' | 'DEV' | 'TEST' | 'RELEASE' | 'CUSTOM'
  const [customRuntimeEnvText, setCustomRuntimeEnvText] = useState('')

  // Batch execution abort state
  const isAbortingRef = useRef(false)
  const activeStepKeyRef = useRef(null)
  const [isBatchRunning, setIsBatchRunning] = useState(false)

  // Streaming log state: { [stepKey]: { lines: [{type, text}], ...metadata } }
  const [streamingLogs, setStreamingLogs] = useState({})
  const logScrollRefs = useRef({})

  // Subscribe to streaming log chunks from main process
  useEffect(() => {
    if (!window.flywork?.onAutomationLogChunk) return
    const unsub = window.flywork.onAutomationLogChunk((chunk) => {
      const { stepKey, type, text } = chunk
      setStreamingLogs(prev => {
        const existing = prev[stepKey] || { lines: [] }
        return {
          ...prev,
          [stepKey]: { ...existing, lines: [...existing.lines, { type, text }] }
        }
      })
      // Auto-scroll to bottom
      setTimeout(() => {
        const el = logScrollRefs.current[stepKey]
        if (el) el.scrollTop = el.scrollHeight
      }, 30)
    })
    return unsub
  }, [])

  // Copy log state
  const [copiedLogKey, setCopiedLogKey] = useState(null)

  const handleCopyText = (text, key) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedLogKey(key)
      setTimeout(() => setCopiedLogKey(null), 2000)
    }).catch(() => {
      // fallback for Electron context
      const el = document.createElement('textarea')
      el.value = text
      el.style.position = 'fixed'
      el.style.opacity = '0'
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
      setCopiedLogKey(key)
      setTimeout(() => setCopiedLogKey(null), 2000)
    })
  }


  const selectedAutomation = automations.find(a => a.id === selectedAutomationId) || automations[0] || null
  const selectedWorkspace = workspaces.find(w => w.id === selectedAutomation?.workspaceId)

  // Replace dynamic template variables in command
  const resolveCommand = (cmd, ws) => {
    if (!cmd) return ''
    const rootPath = ws?.root || ''
    const branchName = ws?.gitBranch || 'main'
    const todayDate = new Date().toISOString().slice(0, 10)

    return cmd
      .replaceAll('${root}', rootPath)
      .replaceAll('${workspace.root}', rootPath)
      .replaceAll('${branch}', branchName)
      .replaceAll('${gitBranch}', branchName)
      .replaceAll('${date}', todayDate)
  }

  // Execute a single step (Real execution via IPC)
  const handleRunStep = async (autoId, step, dryRun = false) => {
    const key = `${autoId}-${step.id}`
    const targetAuto = automations.find(a => a.id === autoId)
    const ws = workspaces.find(w => w.id === targetAuto?.workspaceId)
    const resolvedCmd = resolveCommand(step.command, ws)

    // Compute runtime environment variable overrides
    let runtimeEnvOverrides = {}
    if (runtimeEnvPreset === 'DEV') {
      runtimeEnvOverrides = { BUILD_ENV: 'dev', SCHEME: 'PetPal' }
    } else if (runtimeEnvPreset === 'TEST') {
      runtimeEnvOverrides = { BUILD_ENV: 'test', SCHEME: 'PetPal' }
    } else if (runtimeEnvPreset === 'RELEASE') {
      runtimeEnvOverrides = { BUILD_ENV: 'release', SCHEME: 'PetPal' }
    } else if (runtimeEnvPreset === 'CUSTOM') {
      runtimeEnvOverrides = parseEnvText(customRuntimeEnvText)
    }

    // Merge ENV priority hierarchy:
    // 1. Flow default env (targetAuto.env)
    // 2. Step-specific env (step.env)
    // 3. Runtime selected env (runtimeEnvOverrides)
    const mergedEnv = {
      ...(targetAuto?.env || {}),
      ...(step.env || {}),
      ...runtimeEnvOverrides
    }

    // High risk confirmation gate
    if (step.risk === 'high' && !dryRun) {
      const envNotice = Object.keys(mergedEnv).length ? `\n生效环境变量: ${JSON.stringify(mergedEnv)}` : ''
      const confirmRun = window.confirm(
        `⚠️ 高风险步骤确认\n\n步骤名: "${step.name}"\n即将执行: ${resolvedCmd}${envNotice}\n\n注意：该步骤被标记为高风险操"（可能更改关键代码、发布或清理文件）。是否继续执行？`
      )
      if (!confirmRun) {
        return { success: false, aborted: true }
      }
    }

    setRunningStepKeys(prev => ({ ...prev, [key]: dryRun ? 'dryrun' : 'running' }))
    activeStepKeyRef.current = key
    setExpandedStepId(step.id)
    // Clear streaming log for this step before new run
    setStreamingLogs(prev => ({ ...prev, [key]: { lines: [] } }))

    let result = { success: false, output: '', error: '', exitCode: 1 }

    try {
      if (window.flywork?.executeAutomationStep) {
        result = await window.flywork.executeAutomationStep(resolvedCmd, ws?.root, mergedEnv, dryRun, key)
      } else {
        // Fallback for non-Electron web preview
        await new Promise(r => setTimeout(r, dryRun ? 600 : 1200))
        result = {
          success: true,
          exitCode: 0,
          output: dryRun ? `[Dry Run 模式] 将" ${ws?.root || '当前目录'} 执行: ${resolvedCmd}\n环境变量: ${JSON.stringify(mergedEnv)}` : `[执行完成] 命令: ${resolvedCmd}\n输出: 成功完成处理`,
          error: ''
        }
      }
    } catch (err) {
      result = { success: false, exitCode: 1, output: '', error: err.message }
    }

    const logEntry = {
      timestamp: new Date().toLocaleTimeString(),
      resolvedCmd,
      mergedEnv,
      output: result.output || '',
      error: result.error || '',
      exitCode: result.exitCode ?? 0,
      dryRun
    }

    setStepLogs(prev => ({ ...prev, [key]: logEntry }))
    setRunningStepKeys(prev => ({ ...prev, [key]: result.success ? 'complete' : 'failed' }))
    if (activeStepKeyRef.current === key) activeStepKeyRef.current = null

    // Update automation step status & lastRun in global state
    setAutomations(prev =>
      prev.map(a => {
        if (a.id !== autoId) return a
        const nextSteps = a.steps.map(s => (s.id === step.id ? { ...s, status: result.success ? 'complete' : 'failed' } : s))
        const hasFailed = nextSteps.some(s => s.status === 'failed')
        return {
          ...a,
          lastRun: new Date().toISOString(),
          lastStatus: hasFailed ? 'failed' : 'success',
          steps: nextSteps
        }
      })
    )

    return result
  }

  // Run all steps in sequence
  const handleRunAll = async (auto, dryRun = false) => {
    if (!auto || !auto.steps.length) return
    isAbortingRef.current = false
    setIsBatchRunning(true)

    let allSuccess = true

    for (let i = 0; i < auto.steps.length; i++) {
      if (isAbortingRef.current) {
        break
      }
      const step = auto.steps[i]
      const res = await handleRunStep(auto.id, step, dryRun)

      if (res.aborted || !res.success) {
        allSuccess = false
        break
      }
    }

    setIsBatchRunning(false)
  }

  const handleAbortBatch = async () => {
    isAbortingRef.current = true
    const activeStepKey = activeStepKeyRef.current
    if (activeStepKey && window.flywork?.cancelAutomationStep) {
      await window.flywork.cancelAutomationStep(activeStepKey)
    }
  }

  const handleSaveAutomation = (automationPayload) => {
    setAutomations(prev => {
      const exists = prev.some(a => a.id === automationPayload.id)
      if (exists) {
        return prev.map(a => (a.id === automationPayload.id ? automationPayload : a))
      }
      return [automationPayload, ...prev]
    })
    setSelectedAutomationId(automationPayload.id)
    setIsEditModalOpen(false)
    setEditingAutomation(null)
  }

  const handleDeleteAutomation = (autoId) => {
    setAutomations(prev => prev.filter(a => a.id !== autoId))
    if (selectedAutomationId === autoId) {
      const remaining = automations.filter(a => a.id !== autoId)
      setSelectedAutomationId(remaining[0]?.id || null)
    }
    setIsEditModalOpen(false)
    setEditingAutomation(null)
  }

  const handleAskAIError = (stepName, cmd, log) => {
    const errorDetails = log?.error || log?.output || '"知执行失败'
    const promptText = `请帮忙分析自动化步骤 「${stepName}」 的执行报错：\n\n执行命令：\`${cmd}\`\n退出状态码 (Exit Code)：${log?.exitCode}\n生效环境变量：\`\`\`json\n${JSON.stringify(log?.mergedEnv || {}, null, 2)}\n\`\`\`\n\n错误输出 (stderr / stdout)：\n\`\`\`\n${errorDetails}\n\`\`\``
    if (onAskAI) {
      onAskAI(promptText, selectedWorkspace?.id)
    } else if (onSetContextPanel) {
      onSetContextPanel('ai')
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div className="page-title">自动化</div>
          <div className="page-subtitle">"实脚"流式执行引擎 · 多层级环境变量覆盖 · 安全阻断门禁</div>
        </div>
        <button
          className="btn btn-primary btn-sm"
          onClick={() => {
            setEditingAutomation(null)
            setIsEditModalOpen(true)
          }}
        >
          + 新建自动化流程
        </button>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left Automation List */}
        <div style={{ width: 290, borderRight: '1px solid var(--border)', overflowY: 'auto', padding: 8 }}>
          {automations.map(auto => {
            const ws = workspaces.find(w => w.id === auto.workspaceId)
            const isSelected = selectedAutomation?.id === auto.id
            return (
              <div
                key={auto.id}
                className="card card-clickable"
                onClick={() => setSelectedAutomationId(auto.id)}
                style={{
                  padding: '12px 14px',
                  marginBottom: 6,
                  background: isSelected ? 'var(--bg-selected)' : 'var(--bg-surface)',
                  borderColor: isSelected ? 'var(--accent-blue)' : 'var(--border)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {auto.name}
                  </div>
                  <span className={`badge badge-${auto.lastStatus === 'success' ? 'green' : auto.lastStatus === 'failed' ? 'red' : 'gray'}`} style={{ fontSize: 10, flexShrink: 0, marginLeft: 8 }}>
                    {auto.lastStatus === 'success' ? '成功' : auto.lastStatus === 'failed' ? '失败' : '就绪'}
                  </span>
                </div>
                {ws && <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 2 }}>{ws.icon} {ws.name}</div>}
                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                  {auto.steps?.length || 0} 步骤 · 上次 {formatRelTime(auto.lastRun)}
                </div>
              </div>
            )
          })}

          <div
            className="card"
            style={{ padding: '12px 14px', border: '1px dashed var(--border)', background: 'transparent', cursor: 'pointer', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}
            onClick={() => {
              setEditingAutomation(null)
              setIsEditModalOpen(true)
            }}
          >
            + 新建自动化
          </div>
        </div>

        {/* Automation Detail */}
        {selectedAutomation ? (
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14, borderBottom: '1px solid var(--border)', paddingBottom: 14 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                  <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: -0.3 }}>{selectedAutomation.name}</span>
                  <button
                    className="btn btn-ghost btn-sm"
                    style={{ fontSize: 11, padding: '2px 8px' }}
                    onClick={() => {
                      setEditingAutomation(selectedAutomation)
                      setIsEditModalOpen(true)
                    }}
                  >
                    "️ 编辑
                  </button>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{selectedAutomation.description}</div>
                {selectedWorkspace && (
                  <div style={{ fontSize: 11, color: 'var(--accent-blue)', marginTop: 4 }}>
                    📍 绑定工"区: {selectedWorkspace.icon} {selectedWorkspace.name} ({selectedWorkspace.root})
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                {isBatchRunning ? (
                  <button className="btn btn-danger btn-sm" onClick={handleAbortBatch}>
                    ⏹ 终止运行
                  </button>
                ) : (
                  <>
                    <button className="btn btn-ghost btn-sm" onClick={() => handleRunAll(selectedAutomation, true)}>
                      ⚡ 全部 Dry Run
                    </button>
                    <button className="btn btn-primary btn-sm" onClick={() => handleRunAll(selectedAutomation, false)}>
                      ▶ 运行全部
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Runtime ENV Selector Control Bar */}
            <div
              style={{
                background: 'rgba(255, 255, 255, 0.025)',
                border: '1px solid var(--border)',
                borderRadius: 10,
                padding: '10px 14px',
                marginBottom: 16,
                display: 'flex',
                alignItems: 'center',
                justify: 'space-between',
                gap: 12
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span>⚡</span> 运行环境变量模式：
                </span>
                <select
                  className="form-control"
                  style={{ width: 280, fontSize: 11, padding: '4px 10px' }}
                  value={runtimeEnvPreset}
                  onChange={e => setRuntimeEnvPreset(e.target.value)}
                >
                  <option value="DEFAULT">⚙️ 默认环境变量（不选择时自动降级使用代码配置）</option>
                  <option value="DEV">🛠️ 开发环境覆盖 (BUILD_ENV=dev)</option>
                  <option value="TEST">🧪 测试环境覆盖 (BUILD_ENV=test)</option>
                  <option value="RELEASE">🚀 生产与发布覆盖 (BUILD_ENV=release)</option>
                  <option value="CUSTOM">"️ 运行时临时指定 (现"输入 KEY=VALUE)</option>
                </select>
              </div>

              {runtimeEnvPreset === 'CUSTOM' && (
                <input
                  type="text"
                  className="form-control"
                  style={{ flex: 1, fontSize: 11, fontFamily: 'monospace', padding: '4px 8px', maxWidth: 280 }}
                  placeholder="如 BUILD_ENV=staging SCHEME=YeShi"
                  value={customRuntimeEnvText}
                  onChange={e => setCustomRuntimeEnvText(e.target.value)}
                />
              )}

              {runtimeEnvPreset === 'DEFAULT' && (
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  将按配置自动合并【流程默认 ENV + 步骤专属 ENV + 内置 Git 变量】
                </span>
              )}
            </div>

            {/* Steps Flow */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {selectedAutomation.steps.map((step, idx) => {
                const stepKey = `${selectedAutomation.id}-${step.id}`
                const runStatus = runningStepKeys[stepKey] || step.status || 'pending'
                const riskConf = RISK_CONFIG[step.risk] || RISK_CONFIG.readonly
                const isExpanded = expandedStepId === step.id
                const log = stepLogs[stepKey]
                const resolvedCmd = resolveCommand(step.command, selectedWorkspace)

                return (
                  <div key={step.id || idx} className="flow-step" style={{ paddingBottom: idx < selectedAutomation.steps.length - 1 ? 20 : 0 }}>
                    {idx < selectedAutomation.steps.length - 1 && <div className="flow-step-line" />}
                    <div className={`flow-step-icon ${runStatus === 'complete' ? 'complete' : runStatus === 'running' || runStatus === 'dryrun' ? 'running' : runStatus === 'failed' ? 'failed' : ''}`} style={{ position: 'relative', zIndex: 1 }}>
                      {runStatus === 'complete' && <span style={{ color: 'var(--accent-green)', fontSize: 14 }}>"</span>}
                      {(runStatus === 'running' || runStatus === 'dryrun') && <span style={{ fontSize: 12, animation: 'spin 1s linear infinite', display: 'inline-block' }}>⟳</span>}
                      {runStatus === 'failed' && <span style={{ color: 'var(--accent-red)', fontSize: 12 }}>"</span>}
                      {runStatus === 'pending' && <span style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 600 }}>{idx + 1}</span>}
                    </div>

                    <div className="flow-step-content" style={{ width: '100%' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div className="flow-step-name">{step.name}</div>
                          <span className="badge" style={{ background: riskConf.bg, color: riskConf.color, fontSize: 10 }}>{riskConf.label}</span>
                          {step.env && Object.keys(step.env).length > 0 && (
                            <span className="badge badge-purple" style={{ fontSize: 10 }} title={`步骤专属变量: ${JSON.stringify(step.env)}`}>
                              步骤专属 ENV
                            </span>
                          )}
                        </div>
                        {log?.exitCode !== undefined && (
                          <span style={{ fontSize: 10, color: log.exitCode === 0 ? 'var(--accent-green)' : 'var(--accent-red)', fontFamily: 'monospace' }}>
                            Exit Code: {log.exitCode}
                          </span>
                        )}
                      </div>

                      <div
                        style={{
                          fontFamily: "'SF Mono', 'Fira Code', monospace",
                          fontSize: 11,
                          color: 'var(--text-secondary)',
                          background: 'var(--bg-elevated)',
                          border: '1px solid var(--border)',
                          padding: '7px 10px',
                          borderRadius: 6,
                          marginBottom: 10,
                          cursor: 'pointer',
                          userSelect: 'text',
                          WebkitUserSelect: 'text'
                        }}
                        onClick={() => setExpandedStepId(isExpanded ? null : step.id)}
                        title="点击展开或收起控制台日志"
                      >
                        <span style={{ color: 'var(--accent-teal)' }}>$ </span>{resolvedCmd}
                      </div>

                      {/* Expanded Real-Time Streaming Terminal Logs */}
                      {isExpanded && (() => {
                        const slog = streamingLogs[stepKey]
                        const hasStreaming = slog && slog.lines.length > 0
                        const isRunning = runStatus === 'running' || runStatus === 'dryrun'

                        // Build copyable text from streaming lines
                        const fullText = hasStreaming
                          ? `$ ${resolvedCmd}\n\n${slog.lines.map(l => l.text).join('')}`
                          : log ? `$ ${log.resolvedCmd}\n\n${log.output || ''}\n${log.error || ''}` : ''

                        return (
                          <div
                            style={{
                              background: '#090d13',
                              border: `1px solid ${isRunning ? 'var(--accent-blue)' : 'var(--border)'}`,
                              borderRadius: 8,
                              marginBottom: 8,
                              overflow: 'hidden',
                              transition: 'border-color 0.3s'
                            }}
                          >
                            {/* Terminal header bar */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 12px', background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={{ display: 'flex', gap: 5 }}>
                                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#ff5f56' }} />
                                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#ffbd2e' }} />
                                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#27c93f' }} />
                                </div>
                                <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                                  {selectedWorkspace?.root || '未关联工作区'} {isRunning && <span style={{ color: 'var(--accent-blue)', animation: 'pulse 1s ease-in-out infinite' }}>● 执行中</span>}
                                </span>
                              </div>
                              <div style={{ display: 'flex', gap: 6 }}>
                                {fullText && (
                                  <button
                                    type="button"
                                    className="btn btn-ghost btn-sm"
                                    style={{ fontSize: 10, padding: '1px 7px', color: 'var(--accent-blue)' }}
                                    onClick={(e) => { e.stopPropagation(); handleCopyText(fullText, `full-${stepKey}`) }}
                                  >
                                    {copiedLogKey === `full-${stepKey}` ? '" 已复制' : '📋 复制'}
                                  </button>
                                )}
                                {log?.mergedEnv && Object.keys(log.mergedEnv).length > 0 && (
                                  <span style={{ fontSize: 10, color: 'var(--accent-purple)', fontFamily: 'monospace' }}>
                                    ENV: {Object.keys(log.mergedEnv).join(', ')}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Terminal body: streaming output */}
                            <div
                              ref={el => { logScrollRefs.current[stepKey] = el }}
                              style={{
                                padding: '10px 14px',
                                fontSize: 11,
                                fontFamily: "'SF Mono', 'Fira Code', monospace",
                                maxHeight: 300,
                                overflowY: 'auto',
                                userSelect: 'text',
                                WebkitUserSelect: 'text',
                                lineHeight: 1.6
                              }}
                            >
                              {/* Command line */}
                              <div style={{ color: 'var(--accent-teal)', marginBottom: 6 }}>
                                <span style={{ color: 'rgba(255,255,255,0.3)' }}>$ </span>{resolvedCmd}
                              </div>

                              {/* Streaming log lines (real-time) */}
                              {hasStreaming ? (
                                <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                                  {slog.lines.map((line, i) => (
                                    <span
                                      key={i}
                                      style={{
                                        color: line.type === 'stderr' ? '#ff8080'
                                          : line.type === 'warn' ? 'var(--accent-amber)'
                                          : line.type === 'info' ? 'var(--accent-blue)'
                                          : line.type === 'exit' ? 'rgba(255,255,255,0.4)'
                                          : '#e6edf3'
                                      }}
                                    >{line.text}</span>
                                  ))}
                                  {isRunning && <span style={{ color: 'var(--accent-blue)', animation: 'blink 1s step-end infinite' }}>▋</span>}
                                </pre>
                              ) : !log ? (
                                <div style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                  暂无日志，点击"执行"或"Dry Run"开始运行此步骤。
                                </div>
                              ) : (
                                // Fallback: show final static log if no streaming
                                <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all', color: '#e6edf3' }}>
                                  {log.output}
                                  {log.error && <span style={{ color: '#ff8080' }}>{'\n'}{log.error}</span>}
                                </pre>
                              )}
                            </div>

                            {/* Failed step actions */}
                            {runStatus === 'failed' && (
                              <div style={{ padding: '6px 12px', borderTop: '1px dashed var(--border)', display: 'flex', justifyContent: 'flex-end' }}>
                                <button
                                  className="btn btn-secondary btn-sm"
                                  style={{ fontSize: 11, color: 'var(--accent-purple)', borderColor: 'var(--accent-purple-dim)' }}
                                  onClick={() => handleAskAIError(step.name, resolvedCmd, log)}
                                >
                                  🤖 呼叫 AI 分析报错
                                </button>
                              </div>
                            )}
                          </div>
                        )
                      })()}

                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => handleRunStep(selectedAutomation.id, step, true)}
                          disabled={runStatus === 'running' || runStatus === 'dryrun' || isBatchRunning}
                          style={{ fontSize: 11 }}
                        >
                          Dry Run
                        </button>
                        <button
                          className={`btn btn-sm ${step.risk === 'high' ? 'btn-danger' : 'btn-secondary'}`}
                          onClick={() => handleRunStep(selectedAutomation.id, step, false)}
                          disabled={runStatus === 'running' || runStatus === 'dryrun' || isBatchRunning}
                          style={{ fontSize: 11 }}
                        >
                          {runStatus === 'running' || runStatus === 'dryrun' ? '执行中...' : '执行'}
                        </button>
                        {runStatus === 'complete' && (
                          <span style={{ fontSize: 11, color: 'var(--accent-green)', marginLeft: 4 }}>" 执行成功</span>
                        )}
                        {runStatus === 'failed' && (
                          <span style={{ fontSize: 11, color: 'var(--accent-red)', marginLeft: 4 }}>" 执行失败</span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ) : (
          <div className="empty-state" style={{ flex: 1 }}>
            <div style={{ fontSize: 32 }}>⚙️</div>
            <div className="empty-state-title">请选择或新建一个自动化流程</div>
          </div>
        )}
      </div>

      {/* Edit / Create Modal */}
      {isEditModalOpen && (
        <EditAutomationModal
          automation={editingAutomation}
          workspaces={workspaces}
          onSave={handleSaveAutomation}
          onDelete={handleDeleteAutomation}
          onClose={() => {
            setIsEditModalOpen(false)
            setEditingAutomation(null)
          }}
        />
      )}
    </div>
  )
}

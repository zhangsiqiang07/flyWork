import { useState, useEffect, useCallback, useRef } from 'react'

const STEPS = [
  { key: 'convert', label: '① 格式转换', desc: '.plcrash → Apple .crash' },
  { key: 'uuid', label: '② UUID 核验', desc: 'dSYM vs Binary Images' },
  { key: 'symbolicate', label: '③ 符号化', desc: 'symbolicatecrash' },
  { key: 'parse', label: '④ 解析渲染', desc: '构建结构化报告' }
]

const STATUS_STYLE = {
  pending: { color: 'var(--text-muted)', bg: 'var(--bg-elevated)', icon: '○' },
  running: { color: 'var(--accent-blue)', bg: 'var(--accent-blue-dim)', icon: '⟳' },
  success: { color: 'var(--accent-green)', bg: 'var(--accent-green-dim)', icon: '✓' },
  failed: { color: 'var(--accent-red)', bg: 'var(--accent-red-dim)', icon: '✗' }
}

// Resolve a file path from a drag-drop File object.
// Electron 32+ removed File.path; use the exposed webUtils.getPathForFile with fallback.
const getFilePath = (file) => {
  try {
    return window.flywork?.getPathForFile?.(file) || file?.path || ''
  } catch {
    return file?.path || ''
  }
}

export default function CrashAnalysis({ hideHeader = false }) {
  const [toolchain, setToolchain] = useState(null)
  const [metas, setMetas] = useState([])
  const [selectedPath, setSelectedPath] = useState(null)
  const [archivePath, setArchivePath] = useState('')
  const [running, setRunning] = useState(false)
  const [steps, setSteps] = useState({})
  const [logs, setLogs] = useState([])
  const [report, setReport] = useState(null)
  const [history, setHistory] = useState([])
  const [tab, setTab] = useState('import')
  const [copied, setCopied] = useState(false)
  const logRef = useRef(null)

  // Toolchain self-check
  useEffect(() => {
    window.flywork?.crashToolchainCheck?.().then(setToolchain)
  }, [])

  // Subscribe to streaming log chunks
  useEffect(() => {
    if (!window.flywork?.onCrashLogChunk) return
    const unsub = window.flywork.onCrashLogChunk((chunk) => {
      const { step, type, text } = chunk
      setLogs((prev) => [...prev, { step, type, text }])
      setSteps((prev) => {
        const cur = prev[step] || { status: 'pending' }
        let status = cur.status
        if (type === 'info') status = 'running'
        else if (type === 'exit') status = text.includes('✓') ? 'success' : 'failed'
        else if (type === 'stderr' && cur.status !== 'success')
          status = cur.status === 'failed' ? 'failed' : 'running'
        return { ...prev, [step]: { status, detail: text } }
      })
      setTimeout(() => {
        if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
      }, 20)
    })
    return unsub
  }, [])

  const loadHistory = useCallback(async () => {
    const list = await window.flywork?.crashListReports?.()
    setHistory(Array.isArray(list) ? list : [])
  }, [])
  useEffect(() => {
    let cancelled = false
    async function fetchHistory() {
      const list = await window.flywork?.crashListReports?.()
      if (!cancelled) setHistory(Array.isArray(list) ? list : [])
    }
    fetchHistory()
    return () => {
      cancelled = true
    }
  }, [])

  const importPlcrash = async (paths) => {
    if (!paths?.length) return
    const { metas: m } = await window.flywork.crashImport(paths)
    setMetas(m)
    const ok = m.find((x) => !x.error)
    setSelectedPath(ok?.plcrashPath || m[0]?.plcrashPath || null)
    setReport(null)
    setSteps({})
    setLogs([])
    setTab('import')
  }

  const onPlcrashDrop = (e) => {
    e.preventDefault()
    const paths = Array.from(e.dataTransfer.files)
      .map((f) => getFilePath(f))
      .filter((p) => p?.endsWith('.plcrash'))
    if (paths.length) importPlcrash(paths)
  }

  const pickPlcrash = async () => {
    const res = await window.flywork.showOpenDialog({
      title: '选择 .plcrash 崩溃日志',
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'PLCrash', extensions: ['plcrash'] }]
    })
    if (res && !res.canceled && res.filePaths?.length) importPlcrash(res.filePaths)
  }

  const onArchiveDrop = (e) => {
    e.preventDefault()
    const f = e.dataTransfer.files[0]
    const p = getFilePath(f)
    if (p) setArchivePath(p)
  }

  const pickArchive = async () => {
    const res = await window.flywork.showOpenDialog({
      title: '选择符号文件 (.xcarchive / .dSYM / .dSYM.zip)',
      properties: ['openFile'],
      filters: [{ name: '符号文件', extensions: ['xcarchive', 'dSYM', 'zip'] }]
    })
    if (res && !res.canceled && res.filePaths?.length) setArchivePath(res.filePaths[0])
  }

  const runSymbolicate = async () => {
    if (!selectedPath || !archivePath || running) return
    setRunning(true)
    setLogs([])
    setSteps({})
    setReport(null)
    setTab('import')
    const reportId = `crash-${Date.now()}`
    const res = await window.flywork.crashSymbolicate(reportId, selectedPath, archivePath)
    setRunning(false)
    if (res?.success) {
      setReport(res.report)
      setTab('report')
      loadHistory()
    }
  }

  const openHistory = async (id) => {
    const r = await window.flywork.crashGetReport(id)
    if (r) {
      setReport(r)
      setTab('report')
    }
  }

  const deleteHistory = async (id, e) => {
    e.stopPropagation()
    await window.flywork.crashDeleteReport(id)
    loadHistory()
  }

  const exportJSON = () => {
    if (!report) return
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${report.meta?.incidentId || report.id}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const copyFull = () => {
    if (!report?.rawSymbolicated) return
    navigator.clipboard.writeText(report.rawSymbolicated).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const canRun = selectedPath && archivePath && !running && toolchain?.ok

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      {!hideHeader ? (
        <div
          style={{
            padding: '14px 20px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0
          }}
        >
          <div>
            <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)' }}>
              崩溃分析
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
              iOS .plcrash + dSYM 符号化 · 本地优先，dSYM 不外发
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {toolchain === null ? (
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>工具链检测中…</span>
            ) : (
              <>
                <ToolchainBadge ok={!!toolchain?.plcrashutil} label="plcrashutil" />
                <ToolchainBadge ok={!!toolchain?.symbolicatecrash} label="symbolicatecrash" />
                <ToolchainBadge ok={!!toolchain?.dwarfdump} label="dwarfdump" />
              </>
            )}
          </div>
        </div>
      ) : (
        <div
          style={{
            padding: '6px 20px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            gap: 8,
            background: 'var(--bg-elevated)',
            flexShrink: 0
          }}
        >
          <span style={{ fontSize: 11, color: 'var(--text-muted)', marginRight: 'auto' }}>
            PLCrash 符号化工具链状态:
          </span>
          {toolchain === null ? (
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>工具链检测中…</span>
          ) : (
            <>
              <ToolchainBadge ok={!!toolchain?.plcrashutil} label="plcrashutil" />
              <ToolchainBadge ok={!!toolchain?.symbolicatecrash} label="symbolicatecrash" />
              <ToolchainBadge ok={!!toolchain?.dwarfdump} label="dwarfdump" />
            </>
          )}
        </div>
      )}

      {/* Tabs */}
      <div
        style={{
          display: 'flex',
          gap: 4,
          padding: '0 20px',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0
        }}
      >
        {[
          { id: 'import', label: '导入与符号化' },
          { id: 'report', label: '报告', disabled: !report },
          { id: 'history', label: `历史 (${history.length})` }
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => !t.disabled && setTab(t.id)}
            disabled={t.disabled}
            style={{
              padding: '10px 14px',
              background: 'transparent',
              border: 'none',
              borderBottom: tab === t.id ? '2px solid var(--accent-blue)' : '2px solid transparent',
              color: t.disabled
                ? 'var(--text-muted)'
                : tab === t.id
                  ? 'var(--accent-blue)'
                  : 'var(--text-secondary)',
              fontSize: 13,
              fontWeight: 500,
              cursor: t.disabled ? 'default' : 'pointer',
              marginBottom: -1
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: 20 }}>
        {!toolchain?.ok && toolchain && <ToolchainWarning toolchain={toolchain} />}

        {tab === 'import' && (
          <ImportView
            metas={metas}
            selectedPath={selectedPath}
            onSelect={setSelectedPath}
            archivePath={archivePath}
            canRun={canRun}
            running={running}
            steps={steps}
            logs={logs}
            logRef={logRef}
            onPlcrashDrop={onPlcrashDrop}
            pickPlcrash={pickPlcrash}
            onArchiveDrop={onArchiveDrop}
            pickArchive={pickArchive}
            runSymbolicate={runSymbolicate}
            hasReport={!!report}
            onViewReport={() => setTab('report')}
          />
        )}

        {tab === 'report' && report && (
          <ReportView
            report={report}
            onExportJSON={exportJSON}
            onCopyFull={copyFull}
            copied={copied}
          />
        )}

        {tab === 'history' && (
          <HistoryView history={history} onOpen={openHistory} onDelete={deleteHistory} />
        )}
      </div>
    </div>
  )
}

/* ============ Sub Components ============ */

function ToolchainBadge({ ok, label }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        fontSize: 11,
        padding: '3px 8px',
        borderRadius: 'var(--radius-full)',
        background: ok ? 'var(--accent-green-dim)' : 'var(--accent-red-dim)',
        color: ok ? 'var(--accent-green)' : 'var(--accent-red)'
      }}
    >
      {ok ? '✓' : '✗'} {label}
    </span>
  )
}

function ToolchainWarning({ toolchain }) {
  return (
    <div
      style={{
        background: 'var(--accent-amber-dim)',
        border: '1px solid rgba(210,153,34,0.3)',
        borderRadius: 'var(--radius-lg)',
        padding: 14,
        marginBottom: 16,
        fontSize: 12,
        color: 'var(--text-warning)',
        lineHeight: 1.6
      }}
    >
      <strong>工具链不完整：</strong>
      {!toolchain?.plcrashutil && ' 内置 plcrashutil 缺失；'}
      {!toolchain?.symbolicatecrash &&
        ' symbolicatecrash 未找到（需安装完整 Xcode，仅 CLT 不可用）；'}
      {!toolchain?.dwarfdump && ' dwarfdump 未找到；'}
      请补齐后重试。
    </div>
  )
}

function Dropzone({ onDrop, onClick, title, hint, accept, active }) {
  const [hover, setHover] = useState(false)
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        setHover(true)
      }}
      onDragLeave={() => setHover(false)}
      onDrop={(e) => {
        setHover(false)
        onDrop(e)
      }}
      onClick={onClick}
      style={{
        border: `2px dashed ${hover || active ? 'var(--accent-blue)' : 'var(--border-hover)'}`,
        borderRadius: 'var(--radius-xl)',
        padding: '24px 20px',
        textAlign: 'center',
        cursor: 'pointer',
        background: hover ? 'var(--accent-blue-dim)' : 'var(--bg-surface)',
        transition: 'var(--transition-fast)'
      }}
    >
      <div style={{ fontSize: 24, marginBottom: 8 }}>{accept}</div>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
        {title}
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{hint}</div>
    </div>
  )
}

function ImportView(props) {
  const {
    metas,
    selectedPath,
    onSelect,
    archivePath,
    canRun,
    running,
    steps,
    logs,
    logRef,
    onPlcrashDrop,
    pickPlcrash,
    onArchiveDrop,
    pickArchive,
    runSymbolicate,
    hasReport,
    onViewReport
  } = props

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 920 }}>
      {/* Step 1: import plcrash */}
      <div>
        <div style={sectionLabelStyle}>1. 导入崩溃日志</div>
        <Dropzone
          onDrop={onPlcrashDrop}
          onClick={pickPlcrash}
          title={metas.length ? '继续拖入 .plcrash 或点击选择' : '拖入 .plcrash 文件，或点击选择'}
          hint="支持 PLCrashReporter 二进制格式，可多选"
          accept="📄"
          active={metas.length > 0}
        />
      </div>

      {/* Imported metas */}
      {metas.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {metas.map((m, i) => (
            <div
              key={m.plcrashPath || i}
              onClick={() => !m.error && onSelect(m.plcrashPath)}
              style={{
                padding: '12px 14px',
                borderRadius: 'var(--radius-lg)',
                border: `1px solid ${
                  selectedPath === m.plcrashPath ? 'var(--accent-blue)' : 'var(--border)'
                }`,
                background:
                  selectedPath === m.plcrashPath ? 'var(--accent-blue-dim)' : 'var(--bg-surface)',
                cursor: m.error ? 'default' : 'pointer'
              }}
            >
              {m.error ? (
                <div style={{ fontSize: 12, color: 'var(--accent-red)' }}>
                  ✗ {m.plcrashPath?.split('/').pop()}：{m.error}
                </div>
              ) : (
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 8
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                      {m.exceptionType || '未知异常'}
                      {m.signal && (
                        <span style={{ color: 'var(--accent-red)', marginLeft: 8 }}>
                          ({m.signal})
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 3 }}>
                      {m.appName} {m.appVersion}
                      {m.build ? ` (${m.build})` : ''} · {m.device} · {m.osVersion}
                    </div>
                  </div>
                  <div
                    style={{
                      fontSize: 10,
                      color: 'var(--text-muted)',
                      maxWidth: 280,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {m.plcrashPath}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Step 2: archive */}
      {selectedPath && (
        <div>
          <div style={sectionLabelStyle}>2. 拖入符号文件（单次，不持久化）</div>
          <Dropzone
            onDrop={onArchiveDrop}
            onClick={pickArchive}
            title={
              archivePath ? '已选择符号文件（点击重新选择）' : '拖入 .xcarchive / .dSYM / .dSYM.zip'
            }
            hint="按 UUID 自动匹配，关闭会话即释放"
            accept="🗂"
            active={!!archivePath}
          />
          {archivePath && (
            <div
              style={{
                fontSize: 11,
                color: 'var(--text-secondary)',
                marginTop: 6,
                padding: '0 4px',
                wordBreak: 'break-all'
              }}
            >
              {archivePath}
            </div>
          )}
        </div>
      )}

      {/* Run button */}
      {selectedPath && archivePath && (
        <button
          type="button"
          onClick={runSymbolicate}
          disabled={!canRun}
          style={{
            padding: '10px 20px',
            borderRadius: 'var(--radius-lg)',
            border: 'none',
            background: canRun ? 'var(--accent-blue)' : 'var(--bg-elevated)',
            color: canRun ? '#fff' : 'var(--text-muted)',
            fontSize: 13,
            fontWeight: 600,
            cursor: canRun ? 'pointer' : 'not-allowed',
            alignSelf: 'flex-start'
          }}
        >
          {running ? '符号化中…' : '▶ 开始符号化'}
        </button>
      )}

      {/* Pipeline + console */}
      {(running || logs.length > 0) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 4 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {STEPS.map((s) => {
              const st = steps[s.key] || { status: 'pending' }
              const style = STATUS_STYLE[st.status]
              return (
                <div
                  key={s.key}
                  style={{
                    flex: '1 1 180px',
                    minWidth: 180,
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-lg)',
                    background: style.bg,
                    border: `1px solid ${style.color}33`
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span
                      style={{
                        color: style.color,
                        fontSize: 14,
                        fontWeight: 700,
                        animation: st.status === 'running' ? 'spin 1s linear infinite' : 'none',
                        display: 'inline-block'
                      }}
                    >
                      {style.icon}
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                      {s.label}
                    </span>
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 4 }}>
                    {s.desc}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Console */}
          <div
            ref={logRef}
            style={{
              background: '#0a0d12',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              padding: 12,
              fontFamily: 'Menlo, Monaco, "Courier New", monospace',
              fontSize: 11,
              lineHeight: 1.6,
              height: 220,
              overflow: 'auto',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all'
            }}
          >
            {logs.length === 0 && <div style={{ color: 'var(--text-muted)' }}>等待输出…</div>}
            {logs.map((l, i) => (
              <div
                key={i}
                style={{
                  color:
                    l.type === 'stderr'
                      ? 'var(--accent-red)'
                      : l.type === 'exit'
                        ? l.text.includes('✓')
                          ? 'var(--accent-green)'
                          : 'var(--accent-red)'
                        : l.type === 'info'
                          ? 'var(--text-secondary)'
                          : 'var(--text-primary)'
                }}
              >
                <span style={{ color: 'var(--text-muted)', marginRight: 8 }}>[{l.step}]</span>
                {l.text}
              </div>
            ))}
          </div>

          {hasReport && !running && (
            <button
              type="button"
              onClick={onViewReport}
              style={{
                padding: '8px 16px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--accent-green)',
                background: 'var(--accent-green-dim)',
                color: 'var(--accent-green)',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                alignSelf: 'flex-start'
              }}
            >
              ✓ 查看报告 →
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function ReportView({ report, onExportJSON, onCopyFull, copied }) {
  const { meta, images, threads } = report
  const hitCount = (images || []).filter((i) => i.matched === 'hit').length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 980 }}>
      {/* Summary */}
      <div
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-xl)',
          padding: 16
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: 12,
            flexWrap: 'wrap',
            gap: 8
          }}
        >
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
            {meta.exceptionType || '未知异常'}
            {meta.signal && (
              <span style={{ color: 'var(--accent-red)', marginLeft: 10 }}>{meta.signal}</span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={onCopyFull} style={btnGhostStyle}>
              {copied ? '✓ 已复制' : '复制全文'}
            </button>
            <button type="button" onClick={onExportJSON} style={btnGhostStyle}>
              导出 JSON
            </button>
          </div>
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: 10
          }}
        >
          <MetaField label="进程" value={meta.appName} />
          <MetaField
            label="版本"
            value={`${meta.appVersion || '-'}${meta.build ? ` (${meta.build})` : ''}`}
          />
          <MetaField label="崩溃线程" value={`#${meta.crashedThread}`} highlight />
          <MetaField label="设备" value={meta.device} />
          <MetaField label="系统" value={meta.osVersion} />
          <MetaField label="时间" value={meta.timestamp} />
          <MetaField label="Incident ID" value={meta.incidentId} mono />
        </div>
      </div>

      {/* UUID Match Panel */}
      <div
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-xl)',
          padding: 16
        }}
      >
        <div
          style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 10 }}
        >
          UUID 匹配 · {hitCount}/{images?.length || 0} 命中
        </div>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            maxHeight: 200,
            overflow: 'auto'
          }}
        >
          {(images || []).map((img, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '5px 8px',
                borderRadius: 'var(--radius-sm)',
                background: img.matched === 'hit' ? 'var(--accent-green-dim)' : 'transparent',
                fontSize: 11,
                fontFamily: 'Menlo, Monaco, monospace'
              }}
            >
              <span
                style={{
                  color: img.matched === 'hit' ? 'var(--accent-green)' : 'var(--accent-red)',
                  fontWeight: 700
                }}
              >
                {img.matched === 'hit' ? '✓' : '✗'}
              </span>
              <span
                style={{
                  color: 'var(--text-primary)',
                  minWidth: 120,
                  maxWidth: 200,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}
              >
                {img.name}
              </span>
              <span
                style={{
                  color: 'var(--text-muted)',
                  flex: 1,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}
              >
                {img.uuid}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Threads */}
      <div
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-xl)',
          padding: 16
        }}
      >
        <div
          style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 10 }}
        >
          线程调用栈 · 共 {threads?.length || 0} 个
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {(threads || []).map((t) => (
            <ThreadBlock
              key={t.index}
              thread={t}
              isCrashed={t.crashed || t.index === meta.crashedThread}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function ThreadBlock({ thread, isCrashed }) {
  const [open, setOpen] = useState(isCrashed)
  return (
    <div
      style={{
        border: `1px solid ${isCrashed ? 'var(--accent-red)' : 'var(--border)'}`,
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden'
      }}
    >
      <div
        onClick={() => setOpen((o) => !o)}
        style={{
          padding: '8px 12px',
          background: isCrashed ? 'var(--accent-red-dim)' : 'var(--bg-elevated)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontSize: 12,
          fontWeight: 600
        }}
      >
        <span style={{ color: 'var(--text-secondary)' }}>{open ? '▼' : '▶'}</span>
        <span style={{ color: 'var(--text-primary)' }}>Thread {thread.index}</span>
        {isCrashed && <span style={{ color: 'var(--accent-red)', fontSize: 11 }}>· Crashed</span>}
        <span style={{ color: 'var(--text-muted)', fontSize: 11, marginLeft: 'auto' }}>
          {thread.frames?.length || 0} 帧
        </span>
      </div>
      {open && (
        <div style={{ padding: '4px 0' }}>
          {(thread.frames || []).map((f) => (
            <FrameLine key={f.index} frame={f} />
          ))}
        </div>
      )}
    </div>
  )
}

function FrameLine({ frame }) {
  return (
    <div
      style={{
        padding: '4px 12px 4px 28px',
        fontSize: 11,
        fontFamily: 'Menlo, Monaco, monospace',
        display: 'flex',
        gap: 8,
        alignItems: 'baseline',
        color: 'var(--text-secondary)',
        borderBottom: '1px solid var(--border-subtle)'
      }}
    >
      <span style={{ color: 'var(--text-muted)', minWidth: 24 }}>{frame.index}</span>
      <span
        style={{
          color: 'var(--accent-purple)',
          minWidth: 100,
          maxWidth: 160,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}
      >
        {frame.image}
      </span>
      <span style={{ color: 'var(--text-muted)' }}>{frame.pc}</span>
      {frame.symbol ? (
        <span style={{ color: 'var(--text-primary)' }}>
          {frame.symbol}
          {frame.file && (
            <span style={{ color: 'var(--accent-blue)' }}>
              {' '}
              ({frame.file}:{frame.line})
            </span>
          )}
        </span>
      ) : (
        <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>（未符号化）</span>
      )}
    </div>
  )
}

function HistoryView({ history, onOpen, onDelete }) {
  if (!history.length) {
    return (
      <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)', fontSize: 13 }}>
        暂无历史报告
      </div>
    )
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 920 }}>
      {history.map((r) => (
        <div
          key={r.id}
          onClick={() => onOpen(r.id)}
          style={{
            padding: '12px 14px',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border)',
            background: 'var(--bg-surface)',
            cursor: 'pointer',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
              {r.meta?.exceptionType || '未知异常'}
              {r.meta?.signal && (
                <span style={{ color: 'var(--accent-red)', marginLeft: 8 }}>{r.meta.signal}</span>
              )}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 3 }}>
              {r.meta?.appName} {r.meta?.appVersion} · {r.meta?.device} ·{' '}
              {new Date(r.createdAt).toLocaleString('zh-CN')}
            </div>
          </div>
          <button
            type="button"
            onClick={(e) => onDelete(r.id, e)}
            style={{
              padding: '4px 10px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-hover)',
              background: 'transparent',
              color: 'var(--accent-red)',
              fontSize: 11,
              cursor: 'pointer',
              flexShrink: 0
            }}
          >
            删除
          </button>
        </div>
      ))}
    </div>
  )
}

function MetaField({ label, value, mono, highlight }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>{label}</div>
      <div
        style={{
          fontSize: 12,
          color: highlight ? 'var(--accent-red)' : 'var(--text-primary)',
          fontWeight: highlight ? 600 : 500,
          fontFamily: mono ? 'Menlo, Monaco, monospace' : 'inherit',
          wordBreak: 'break-all'
        }}
      >
        {value || '-'}
      </div>
    </div>
  )
}

const sectionLabelStyle = {
  fontSize: 12,
  fontWeight: 600,
  color: 'var(--text-secondary)',
  marginBottom: 8,
  textTransform: 'uppercase',
  letterSpacing: 0.5
}

const btnGhostStyle = {
  padding: '5px 12px',
  borderRadius: 'var(--radius-md)',
  border: '1px solid var(--border-hover)',
  background: 'transparent',
  color: 'var(--text-secondary)',
  fontSize: 11,
  fontWeight: 500,
  cursor: 'pointer'
}

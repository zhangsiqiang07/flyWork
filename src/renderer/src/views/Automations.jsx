import { useState } from 'react'

const RISK_CONFIG = {
  readonly: { label: '只读', color: 'var(--text-secondary)', bg: 'var(--bg-hover)' },
  normal: { label: '普通', color: 'var(--accent-blue)', bg: 'var(--accent-blue-dim)' },
  modify: { label: '修改', color: 'var(--accent-amber)', bg: 'var(--accent-amber-dim)' },
  high: { label: '高风险', color: 'var(--accent-red)', bg: 'var(--accent-red-dim)' }
}

function formatRelTime(iso) {
  if (!iso) return '从未运行'
  const d = new Date(iso)
  const now = new Date()
  const diff = now - d
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`
  return `${Math.floor(diff / 86400000)}天前`
}

export default function AutomationsView({ automations, workspaces, setAutomations }) {
  const [selectedAutomation, setSelectedAutomation] = useState(automations[0] || null)
  const [runningSteps, setRunningSteps] = useState({})
  const [expandedStep, setExpandedStep] = useState(null)

  const handleRunStep = async (autoId, stepId, dryRun = false) => {
    const key = `${autoId}-${stepId}`
    setRunningSteps(prev => ({ ...prev, [key]: dryRun ? 'dryrun' : 'running' }))
    await new Promise(r => setTimeout(r, dryRun ? 600 : 1200))
    setRunningSteps(prev => ({ ...prev, [key]: 'done' }))
  }

  const getStepStatus = (autoId, step) => {
    const key = `${autoId}-${step.id}`
    if (runningSteps[key] === 'running') return 'running'
    if (runningSteps[key] === 'dryrun') return 'running'
    if (runningSteps[key] === 'done') return 'complete'
    return step.status
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="page-header">
        <div className="page-title">自动化</div>
        <div className="page-subtitle">预定义工作流，安全执行脚本序列 · 每步骤均可 Dry Run</div>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Automation List */}
        <div style={{ width: 280, borderRight: '1px solid var(--border)', overflowY: 'auto', padding: 8 }}>
          {automations.map(auto => {
            const ws = workspaces.find(w => w.id === auto.workspaceId)
            const isSelected = selectedAutomation?.id === auto.id
            return (
              <div
                key={auto.id}
                className={`card card-clickable ${isSelected ? '' : ''}`}
                onClick={() => setSelectedAutomation(auto)}
                style={{
                  padding: '12px 14px',
                  marginBottom: 6,
                  background: isSelected ? 'var(--bg-selected)' : 'var(--bg-surface)',
                  borderColor: isSelected ? 'var(--accent-blue)' : 'var(--border)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{auto.name}</div>
                  <span className={`badge badge-${auto.lastStatus === 'success' ? 'green' : 'red'}`} style={{ fontSize: 10, flexShrink: 0, marginLeft: 8 }}>
                    {auto.lastStatus === 'success' ? '成功' : '失败'}
                  </span>
                </div>
                {ws && <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 2 }}>{ws.icon} {ws.name}</div>}
                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{auto.steps.length} 步骤 · 上次 {formatRelTime(auto.lastRun)}</div>
              </div>
            )
          })}
          <div className="card" style={{ padding: '12px 14px', border: '1px dashed var(--border)', background: 'transparent', cursor: 'pointer', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
            + 新建自动化
          </div>
        </div>

        {/* Automation Detail */}
        {selectedAutomation ? (
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: -0.3, marginBottom: 4 }}>{selectedAutomation.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{selectedAutomation.description}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>上次运行: {formatRelTime(selectedAutomation.lastRun)}</div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                <button className="btn btn-ghost btn-sm" onClick={() => selectedAutomation.steps.forEach(step => handleRunStep(selectedAutomation.id, step.id, true))}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/></svg>
                  全部 Dry Run
                </button>
                <button className="btn btn-primary btn-sm">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                  运行全部
                </button>
              </div>
            </div>

            {/* Steps */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {selectedAutomation.steps.map((step, idx) => {
                const stepStatus = getStepStatus(selectedAutomation.id, step)
                const riskConf = RISK_CONFIG[step.risk] || RISK_CONFIG.readonly
                const isExpanded = expandedStep === step.id

                return (
                  <div key={step.id} className="flow-step" style={{ paddingBottom: idx < selectedAutomation.steps.length - 1 ? 20 : 0 }}>
                    {idx < selectedAutomation.steps.length - 1 && <div className="flow-step-line" />}
                    <div className={`flow-step-icon ${stepStatus}`} style={{ position: 'relative', zIndex: 1 }}>
                      {stepStatus === 'complete' && <span style={{ color: 'var(--accent-green)', fontSize: 14 }}>✓</span>}
                      {stepStatus === 'running' && <span style={{ fontSize: 12, animation: 'spin 1s linear infinite', display: 'inline-block' }}>⟳</span>}
                      {stepStatus === 'failed' && <span style={{ color: 'var(--accent-red)', fontSize: 12 }}>✕</span>}
                      {stepStatus === 'pending' && <span style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 600 }}>{idx + 1}</span>}
                    </div>
                    <div className="flow-step-content">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <div className="flow-step-name">{step.name}</div>
                        <span className="badge" style={{ background: riskConf.bg, color: riskConf.color, fontSize: 10 }}>{riskConf.label}</span>
                      </div>
                      <div
                        className="terminal-output"
                        style={{ fontSize: 11, marginBottom: 8, cursor: 'pointer', maxHeight: 36, overflow: 'hidden' }}
                        onClick={() => setExpandedStep(isExpanded ? null : step.id)}
                      >
                        {step.command}
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => handleRunStep(selectedAutomation.id, step.id, true)}
                          disabled={stepStatus === 'running'}
                          style={{ fontSize: 11 }}
                        >
                          Dry Run
                        </button>
                        <button
                          className={`btn btn-sm ${step.risk === 'high' ? 'btn-danger' : 'btn-secondary'}`}
                          onClick={() => handleRunStep(selectedAutomation.id, step.id, false)}
                          disabled={stepStatus === 'running'}
                          style={{ fontSize: 11 }}
                        >
                          {stepStatus === 'running' ? '执行中...' : '执行'}
                        </button>
                        {runningSteps[`${selectedAutomation.id}-${step.id}`] === 'done' && (
                          <span style={{ fontSize: 11, color: 'var(--accent-green)', alignSelf: 'center' }}>✓ 完成</span>
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
            <div className="empty-state-title">选择一个自动化流程</div>
          </div>
        )}
      </div>
    </div>
  )
}

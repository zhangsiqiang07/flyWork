import { useState } from 'react'

const RISK_CONFIG = {
  readonly: { label: '只读', color: 'var(--text-secondary)', bg: 'var(--bg-hover)', icon: '👁' },
  normal: { label: '普通', color: 'var(--accent-blue)', bg: 'var(--accent-blue-dim)', icon: '▶' },
  modify: { label: '修改', color: 'var(--accent-amber)', bg: 'var(--accent-amber-dim)', icon: '✏' },
  high: { label: '高风险', color: 'var(--accent-red)', bg: 'var(--accent-red-dim)', icon: '⚠' }
}

const MOCK_OUTPUTS = {
  'open-xcode': 'Xcode 已启动...\n正在打开 PetPal.xcworkspace',
  'git-pull': 'remote: Enumerating objects: 5, done.\nremote: Counting objects: 100% (5/5), done.\nUpdating a3f7c21..b9e2d45\nFast-forward\n PetPal/Views/Main/TabBarController.swift | 12 ++--\n 1 file changed, 6 insertions(+), 6 deletions(-)\n\n✓ 同步成功',
  'git-status': 'On branch fix/tabbar-video\nChanges not staged for commit:\n  modified:   PetPal/Views/VideoTab/VideoTabViewController.swift\n  modified:   PetPal/Views/Main/TabBarController.swift\n  modified:   PetPal/Utils/UIExtensions.swift\n  modified:   PetPal/Resources/Assets.xcassets/...\n\nUntracked files:\n  PetPal/Models/TabItem.swift',
  'run-tests': 'Test Suite \'PetPalTests\' started at 2026-08-04 11:45:00\nTest Case \'-[PetPalTests.TabBarTests testTabBarFlash]\' started.\nTest Case \'-[PetPalTests.TabBarTests testTabBarFlash]\' passed (0.023 seconds).\nTest Case \'-[PetPalTests.VideoTabTests testVideoLoad]\' started.\nTest Case \'-[PetPalTests.VideoTabTests testVideoLoad]\' passed (1.234 seconds).\n\nTest Suite \'PetPalTests\' passed at 2026-08-04 11:45:02.\n\t Executed 2 tests, with 0 failures (0 unexpected) in 1.257 seconds',
  'open-terminal': '终端已打开，当前目录:\n/Users/dimoo/Projects/PetPal',
  'open-finder': 'Finder 已打开项目目录'
}

export default function ActionRunner({ action, workspace, onClose }) {
  const [phase, setPhase] = useState('preview') // preview | confirm | running | done
  const [isDryRun, setIsDryRun] = useState(false)
  const [output, setOutput] = useState('')

  const riskConf = RISK_CONFIG[action.risk] || RISK_CONFIG.readonly
  const needsConfirm = action.risk === 'high'

  const handleExecute = (dry = false) => {
    setIsDryRun(dry)
    if (action.risk === 'high' && !dry && phase !== 'confirm') {
      setPhase('confirm')
      return
    }
    setPhase('running')
    
    // Simulate execution
    setTimeout(async () => {
      let result
      if (window.flywork) {
        result = await window.flywork.executeAction(action.id, workspace?.root, dry)
      } else {
        result = { success: true, output: dry ? `[DRY RUN] ${MOCK_OUTPUTS[action.id] || '命令将被执行'}` : (MOCK_OUTPUTS[action.id] || '执行成功') }
      }
      setOutput(result.output || result.error || (dry ? `[DRY RUN] ${action.name} - 模拟成功` : `${action.name} 执行成功`))
      setPhase('done')
    }, dry ? 500 : 1500)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: riskConf.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>
              {action.icon || riskConf.icon}
            </div>
            <div>
              <div className="modal-title">{action.name}</div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{workspace?.name}</div>
            </div>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>

        <div className="modal-body">
          {/* Risk Badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <span className="badge" style={{ background: riskConf.bg, color: riskConf.color }}>
              {riskConf.icon} {riskConf.label}
            </span>
            {action.risk === 'high' && (
              <span style={{ fontSize: 11, color: 'var(--accent-red)' }}>此操作需要二次确认</span>
            )}
          </div>

          {/* Command Preview */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 6 }}>执行命令预览</div>
            <div className="terminal-output" style={{ maxHeight: 80 }}>
              {action.dryRunOutput || `${action.id} --workdir ${workspace?.root || '.'}`}
            </div>
          </div>

          {/* Confirm phase */}
          {phase === 'confirm' && (
            <div style={{ background: 'var(--accent-red-dim)', border: '1px solid rgba(224,92,92,0.3)', borderRadius: 8, padding: 12, marginBottom: 16 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <span style={{ fontSize: 16, flexShrink: 0 }}>⚠️</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent-red)', marginBottom: 4 }}>高风险操作确认</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                    「{action.name}」属于高风险操作，执行后可能无法撤销。请确认您已理解操作后果。
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Output */}
          {(phase === 'running' || phase === 'done') && (
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                {phase === 'running' && <span className="animate-spin" style={{ display: 'inline-block', fontSize: 12 }}>⟳</span>}
                {phase === 'done' && <span style={{ color: 'var(--accent-green)' }}>✓</span>}
                {isDryRun ? 'Dry Run 输出' : '执行输出'}
              </div>
              <div className="terminal-output selectable">
                {phase === 'running' ? '正在执行...' : output}
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          {phase === 'preview' && (
            <>
              <button className="btn btn-ghost" onClick={() => handleExecute(true)}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/></svg>
                Dry Run
              </button>
              <button className="btn btn-secondary" onClick={onClose}>取消</button>
              <button
                className={`btn ${action.risk === 'high' ? 'btn-danger' : 'btn-primary'}`}
                onClick={() => handleExecute(false)}
              >
                {action.risk === 'high' ? '继续（高风险）' : '执行'}
              </button>
            </>
          )}
          {phase === 'confirm' && (
            <>
              <button className="btn btn-secondary" onClick={onClose}>取消</button>
              <button className="btn btn-danger" onClick={() => { setPhase('preview'); handleExecute(false) }}>
                确认执行
              </button>
            </>
          )}
          {phase === 'running' && (
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>执行中...</span>
          )}
          {phase === 'done' && (
            <>
              <button className="btn btn-ghost" onClick={() => { setPhase('preview'); setOutput('') }}>重新执行</button>
              <button className="btn btn-primary" onClick={onClose}>完成</button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

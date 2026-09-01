import { useState } from 'react'

export default function BatchAssignModal({
  isOpen,
  onClose,
  selectedTaskCount = 0,
  onApplyBySelection,
  onApplyByLayer,
  agentProfiles = []
}) {
  const [mode, setMode] = useState('layer') // layer | selection

  // Layer profile mapping state
  const [layerConfig, setLayerConfig] = useState({
    architecture: { agent: 'chatgpt' },
    domain: { agent: 'chatgpt' },
    data: { agent: 'antigravity' },
    state: { agent: 'antigravity' },
    ui: { agent: 'trae' },
    integration: { agent: 'antigravity' },
    test: { agent: 'claude-code' },
    review: { agent: 'chatgpt' }
  })

  // Selection direct target
  const [selectionTarget, setSelectionTarget] = useState({
    agent: 'antigravity'
  })

  if (!isOpen) return null

  const handleLayerChange = (layer, agentId) => {
    setLayerConfig((prev) => ({
      ...prev,
      [layer]: { agent: agentId }
    }))
  }

  const handleConfirm = () => {
    if (mode === 'layer') {
      onApplyByLayer(layerConfig)
    } else {
      onApplyBySelection(selectionTarget.agent, 'default')
    }
    onClose()
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.7)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: 20
      }}
    >
      <div
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-xl)',
          width: '100%',
          maxWidth: 600,
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: 'var(--shadow-xl)',
          overflow: 'hidden'
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '14px 18px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--bg-elevated)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 20 }}>⚡</span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                批量分配智能体 (Batch Assign Agents)
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                按工程架构分层批量指派或针对多选任务快速分配智能体
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary)',
              fontSize: 16,
              cursor: 'pointer'
            }}
          >
            ✕
          </button>
        </div>

        {/* Mode Switcher Tabs */}
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid var(--border)',
            background: 'var(--bg-base)'
          }}
        >
          <button
            onClick={() => setMode('layer')}
            style={{
              flex: 1,
              padding: '10px 0',
              background: 'transparent',
              border: 'none',
              borderBottom: mode === 'layer' ? '2px solid var(--accent-blue)' : '2px solid transparent',
              color: mode === 'layer' ? 'var(--text-primary)' : 'var(--text-secondary)',
              fontSize: 12,
              fontWeight: mode === 'layer' ? 600 : 400,
              cursor: 'pointer'
            }}
          >
            按架构分层策略批量映射 (Execution Profile)
          </button>
          <button
            onClick={() => setMode('selection')}
            style={{
              flex: 1,
              padding: '10px 0',
              background: 'transparent',
              border: 'none',
              borderBottom: mode === 'selection' ? '2px solid var(--accent-blue)' : '2px solid transparent',
              color: mode === 'selection' ? 'var(--text-primary)' : 'var(--text-secondary)',
              fontSize: 12,
              fontWeight: mode === 'selection' ? 600 : 400,
              cursor: 'pointer'
            }}
          >
            指派给当前勾选任务 ({selectedTaskCount})
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          {mode === 'layer' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>
                为不同架构分层配置负责的协同智能体（底层运行模型由各智能体环境默认驱动）：
              </div>

              {Object.entries(layerConfig).map(([layer, cfg]) => (
                <div
                  key={layer}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '130px 1fr',
                    alignItems: 'center',
                    gap: 12,
                    background: 'var(--bg-elevated)',
                    padding: '8px 12px',
                    borderRadius: 6,
                    border: '1px solid var(--border)'
                  }}
                >
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent-blue)', textTransform: 'uppercase' }}>
                    {layer}
                  </span>

                  <select
                    value={cfg.agent}
                    onChange={(e) => handleLayerChange(layer, e.target.value)}
                    style={{
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border)',
                      borderRadius: 4,
                      padding: '5px 8px',
                      fontSize: 12,
                      color: 'var(--text-primary)',
                      outline: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    {agentProfiles.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.avatar} {a.name} ({a.role || '智能体'})
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                将当前选中的 <strong style={{ color: 'var(--text-primary)' }}>{selectedTaskCount}</strong> 个任务统一指派给指定智能体：
              </div>

              {selectedTaskCount === 0 && (
                <div
                  style={{
                    background: 'rgba(210,153,34,0.1)',
                    border: '1px solid rgba(210,153,34,0.3)',
                    color: 'var(--accent-amber)',
                    padding: '8px 12px',
                    borderRadius: 6,
                    fontSize: 12
                  }}
                >
                  ⚠️ 提示：当前未勾选任何任务，请先在列表中勾选任务或使用「全选」。
                </div>
              )}

              <div>
                <label style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 6, fontWeight: 600 }}>
                  目标执行智能体 (Agent):
                </label>
                <select
                  value={selectionTarget.agent}
                  onChange={(e) => setSelectionTarget({ agent: e.target.value })}
                  style={{
                    width: '100%',
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border)',
                    borderRadius: 6,
                    padding: '8px 12px',
                    fontSize: 13,
                    color: 'var(--text-primary)',
                    outline: 'none',
                    cursor: 'pointer'
                  }}
                >
                  {agentProfiles.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.avatar} {a.name} ({a.role || '协同开发'})
                    </option>
                  ))}
                </select>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
                  💡 底层模型将自动继承所选智能体在环境中的默认模型配置。
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '12px 18px',
            borderTop: '1px solid var(--border)',
            background: 'var(--bg-elevated)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 10
          }}
        >
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: '1px solid var(--border)',
              color: 'var(--text-secondary)',
              padding: '6px 14px',
              borderRadius: 'var(--radius-md)',
              fontSize: 12,
              cursor: 'pointer'
            }}
          >
            取消
          </button>

          <button
            onClick={handleConfirm}
            disabled={mode === 'selection' && selectedTaskCount === 0}
            style={{
              background: 'var(--accent-blue)',
              border: 'none',
              color: '#fff',
              padding: '6px 16px',
              borderRadius: 'var(--radius-md)',
              fontSize: 12,
              fontWeight: 600,
              cursor: mode === 'selection' && selectedTaskCount === 0 ? 'not-allowed' : 'pointer',
              opacity: mode === 'selection' && selectedTaskCount === 0 ? 0.5 : 1
            }}
          >
            应用分配 (Apply)
          </button>
        </div>
      </div>
    </div>
  )
}

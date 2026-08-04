import { useState } from 'react'

const RISK_OPTIONS = [
  { value: 'readonly', label: '只读 (无副作用)', color: 'var(--text-secondary)' },
  { value: 'normal', label: '普通 (常规校验/测试)', color: 'var(--accent-blue)' },
  { value: 'modify', label: '修改 (改动代码/文件)', color: 'var(--accent-amber)' },
  { value: 'high', label: '高风险 (包含部署/清理/发布)', color: 'var(--accent-red)' }
]

function objectToEnvText(envObj) {
  if (!envObj || typeof envObj !== 'object') return ''
  return Object.entries(envObj).map(([k, v]) => `${k}=${v}`).join('\n')
}

function envTextToObject(envText) {
  const envObj = {}
  if (!envText) return envObj
  // Support both newline-separated and space-separated KEY=VALUE pairs
  // e.g. "BUILD_ENV=dev\nSCHEME=PetPal" or "BUILD_ENV=dev SCHEME=PetPal"
  // Split on newlines first, then handle space-separated pairs per line
  const lines = envText.split('\n')
  lines.forEach(rawLine => {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) return
    // Check if line contains multiple KEY=VALUE pairs separated by spaces
    // e.g. "BUILD_ENV=dev SCHEME=PetPal INSTALL_PODS=1"
    // Regex: matches KEY=VALUE tokens where VALUE ends before next KEY= or end of string
    const pairs = line.match(/[A-Za-z_][A-Za-z0-9_]*=[^\s=]*(\s+[^A-Za-z_])?/g)
    if (pairs && pairs.length > 1) {
      // Multiple KEY=VALUE on one line — parse each token
      let remaining = line
      const tokenRe = /([A-Za-z_][A-Za-z0-9_]*)=([^\s]*)/g
      let m
      while ((m = tokenRe.exec(line)) !== null) {
        const key = m[1].trim()
        let val = m[2].trim()
        // Strip surrounding quotes if any
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1)
        }
        if (key) envObj[key] = val
      }
    } else {
      // Single KEY=VALUE per line (standard format)
      const eqIdx = line.indexOf('=')
      if (eqIdx > 0) {
        const key = line.slice(0, eqIdx).trim()
        let val = line.slice(eqIdx + 1).trim()
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1)
        }
        if (key) envObj[key] = val
      }
    }
  })
  return envObj
}

export default function EditAutomationModal({ automation, workspaces, onSave, onDelete, onClose }) {
  const isEditing = Boolean(automation?.id)

  const [name, setName] = useState(automation?.name || '')
  const [workspaceId, setWorkspaceId] = useState(automation?.workspaceId || workspaces[0]?.id || '')
  const [description, setDescription] = useState(automation?.description || '')
  const [envText, setEnvText] = useState(objectToEnvText(automation?.env))
  const [steps, setSteps] = useState(
    automation?.steps ? automation.steps.map(s => ({
      ...s,
      envText: objectToEnvText(s.env)
    })) : [
      { id: `s-${Date.now()}-1`, name: '检查工程状态', command: 'git status --porcelain', risk: 'readonly', envText: '', status: 'pending' }
    ]
  )

  const handleAddStep = () => {
    setSteps(prev => [
      ...prev,
      {
        id: `s-${Date.now()}-${prev.length + 1}`,
        name: `步骤 ${prev.length + 1}`,
        command: 'echo "hello flyWork"',
        risk: 'normal',
        envText: '',
        status: 'pending'
      }
    ])
  }

  const handleUpdateStep = (index, field, value) => {
    setSteps(prev => {
      const next = [...prev]
      next[index] = { ...next[index], [field]: value }
      return next
    })
  }

  const handleRemoveStep = (index) => {
    if (steps.length <= 1) {
      alert('自动化流程至少需要保留一个步骤')
      return
    }
    setSteps(prev => prev.filter((_, i) => i !== index))
  }

  const handleMoveStep = (index, direction) => {
    const targetIndex = index + direction
    if (targetIndex < 0 || targetIndex >= steps.length) return
    setSteps(prev => {
      const next = [...prev]
      const temp = next[index]
      next[index] = next[targetIndex]
      next[targetIndex] = temp
      return next
    })
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!name.trim()) {
      alert('请输入自动化流程名称')
      return
    }

    const payload = {
      id: automation?.id || `auto-${Date.now()}`,
      name: name.trim(),
      workspaceId,
      description: description.trim() || '自定义自动化脚本流程',
      env: envTextToObject(envText),
      lastRun: automation?.lastRun || null,
      lastStatus: automation?.lastStatus || 'pending',
      steps: steps.map((s, idx) => ({
        id: s.id || `s-${Date.now()}-${idx}`,
        name: s.name || `步骤 ${idx + 1}`,
        command: s.command || 'echo ""',
        risk: s.risk || 'readonly',
        env: envTextToObject(s.envText),
        status: s.status || 'pending',
        output: s.output || '',
        error: s.error || ''
      }))
    }

    onSave(payload)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        style={{ width: 720, maxWidth: '92vw' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="modal-header">
          <div className="modal-title">
            <span style={{ fontSize: 18 }}>⚙️</span>
            <span>{isEditing ? '编辑自动化流程' : '新建自动化流程'}</span>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Name & Workspace */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 14 }}>
              <div>
                <label className="form-label">
                  流程名称 <span style={{ color: 'var(--accent-red)' }}>*</span>
                </label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="例如：PetPal 一键编译与发布"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <div>
                <label className="form-label">关联工作区</label>
                <select
                  className="form-control"
                  value={workspaceId}
                  onChange={e => setWorkspaceId(e.target.value)}
                >
                  {workspaces.map(w => (
                    <option key={w.id} value={w.id}>{w.icon} {w.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="form-label">流程简要描述</label>
              <input
                type="text"
                className="form-control"
                placeholder="说明该流程的具体作用和执行目标"
                value={description}
                onChange={e => setDescription(e.target.value)}
              />
            </div>

            {/* Flow Default Environment Variables */}
            <div>
              <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>流程默认环境变量 (Flow Default ENV)</span>
                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>运行未显式选择时默认生效，每行 KEY=VALUE</span>
              </label>
              <textarea
                className="form-control"
                style={{
                  height: 60,
                  fontSize: 11,
                  fontFamily: 'monospace',
                  lineHeight: 1.5,
                  resize: 'vertical'
                }}
                placeholder={`BUILD_ENV=dev\nSCHEME=PetPal`}
                value={envText}
                onChange={e => setEnvText(e.target.value)}
              />
            </div>

            {/* Built-in Git Environment Variables Hint */}
            <div
              style={{
                background: 'rgba(79, 158, 248, 0.06)',
                border: '1px solid rgba(79, 158, 248, 0.18)',
                borderRadius: 10,
                padding: '10px 14px',
                fontSize: 11,
                color: 'var(--text-secondary)'
              }}
            >
              <div style={{ fontWeight: 600, color: 'var(--accent-blue)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                <span>🌿</span> 系统内置与多层级变量覆盖机制：
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, fontSize: 10, color: 'var(--text-muted)' }}>
                <span><code>$GIT_BRANCH</code> 当前分支</span>
                <span><code>$GIT_COMMIT_HASH</code> Commit Hash</span>
                <span><code>$GIT_SHORT_SHA</code> 短 Hash</span>
                <span><code>$GIT_COMMIT_MSG</code> Commit 说明</span>
                <span>优先级: 运行时临时选择 &gt; 步骤专属 ENV &gt; 流程默认 ENV &gt; 内置 Git 变量</span>
              </div>
            </div>

            {/* Steps Editor */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <label className="form-label" style={{ marginBottom: 0 }}>
                  执行步骤序列 ({steps.length})
                </label>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={handleAddStep}
                  style={{ color: 'var(--accent-blue)', fontWeight: 600 }}
                >
                  + 添加步骤
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {steps.map((step, idx) => (
                  <div
                    key={step.id || idx}
                    style={{
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: 10,
                      padding: '12px 14px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent-blue)', width: 22 }}>#{idx + 1}</span>
                      <input
                        type="text"
                        className="form-control"
                        style={{ flex: 1, fontSize: 12, padding: '5px 10px' }}
                        placeholder="步骤名称"
                        value={step.name}
                        onChange={e => handleUpdateStep(idx, 'name', e.target.value)}
                      />
                      <select
                        className="form-control"
                        style={{ width: 150, fontSize: 11, padding: '5px 8px' }}
                        value={step.risk}
                        onChange={e => handleUpdateStep(idx, 'risk', e.target.value)}
                      >
                        {RISK_OPTIONS.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>

                      <div style={{ display: 'flex', gap: 2 }}>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          disabled={idx === 0}
                          onClick={() => handleMoveStep(idx, -1)}
                          title="上移"
                          style={{ padding: '2px 6px' }}
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          disabled={idx === steps.length - 1}
                          onClick={() => handleMoveStep(idx, 1)}
                          title="下移"
                          style={{ padding: '2px 6px' }}
                        >
                          ↓
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          style={{ color: 'var(--accent-red)', padding: '2px 6px' }}
                          onClick={() => handleRemoveStep(idx)}
                          title="删除步骤"
                        >
                          ✕
                        </button>
                      </div>
                    </div>

                    <div>
                      <input
                        type="text"
                        className="form-control"
                        style={{
                          width: '100%',
                          fontFamily: 'monospace',
                          fontSize: 11,
                          padding: '6px 10px',
                          background: 'rgba(0, 0, 0, 0.25)',
                          borderColor: 'rgba(255, 255, 255, 0.08)',
                          color: '#e6edf3'
                        }}
                        placeholder="Shell 指令 (例如 ./packaging/build.sh --env $BUILD_ENV --scheme $SCHEME)"
                        value={step.command}
                        onChange={e => handleUpdateStep(idx, 'command', e.target.value)}
                      />
                    </div>

                    {/* Step-specific Custom ENV */}
                    <div style={{ marginTop: 6 }}>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>步骤专属环境变量 (覆盖流程默认值)</span>
                        <span style={{ color: 'var(--accent-teal)', fontFamily: 'monospace' }}>在命令中用 $KEY 引用，如 $BUILD_ENV</span>
                      </div>
                      <textarea
                        className="form-control"
                        style={{
                          fontSize: 10,
                          fontFamily: 'monospace',
                          padding: '5px 8px',
                          background: 'rgba(0, 0, 0, 0.18)',
                          color: 'var(--text-secondary)',
                          height: 48,
                          resize: 'vertical',
                          lineHeight: 1.5
                        }}
                        placeholder={'INSTALL_PODS=1\nFASTLANE_LANE=build_dev\n# 每行一个变量 KEY=VALUE'}
                        value={step.envText || ''}
                        onChange={e => handleUpdateStep(idx, 'envText', e.target.value)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
            <div>
              {isEditing && (
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  onClick={() => {
                    if (confirm(`确定要删除自动化流程 "${name}" 吗？`)) {
                      onDelete(automation.id)
                    }
                  }}
                >
                  删除此流程
                </button>
              )}
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>
                取消
              </button>
              <button type="submit" className="btn btn-primary btn-sm">
                保存流程配置
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

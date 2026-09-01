/* eslint-disable react/prop-types */
import { useState, useEffect } from 'react'

function computeDefaultParams(parameters) {
  if (!parameters) return {}
  const initial = {}
  for (const p of parameters) {
    if (p.choices && p.choices.length > 0) {
      initial[p.name] = p.defaultValue || p.choices[0]
    } else if (p.type?.includes('Boolean')) {
      initial[p.name] = Boolean(p.defaultValue)
    } else {
      initial[p.name] = p.defaultValue !== undefined ? String(p.defaultValue) : ''
    }
  }
  return initial
}

export default function JenkinsBuildModal({ isOpen, job, onClose, onBuildTriggered }) {
  const defaultParams = computeDefaultParams(job?.parameters)
  const [customParams, setCustomParams] = useState({})
  const [dynamicChoices, setDynamicChoices] = useState({})
  const [loadingChoices, setLoadingChoices] = useState({})
  const [customInputMode, setCustomInputMode] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState(null)

  // 当打开弹窗时，如果存在 Git 分支参数且无初始选项，自动异步拉取 Jenkins 分支
  useEffect(() => {
    if (!isOpen || !job?.parameters) return
    let active = true

    for (const p of job.parameters) {
      if (p.isGitParameter) {
        window.flywork?.jenkinsGetParameterChoices(job.path, p.name, p.fullClass).then((res) => {
          if (!active) return
          if (res?.success && res.choices?.length > 0) {
            setDynamicChoices((prev) => ({ ...prev, [p.name]: res.choices }))
          }
        })
      }
    }

    return () => {
      active = false
    }
  }, [isOpen, job])

  if (!isOpen || !job) return null

  const isParameterized = job.parameters && job.parameters.length > 0
  const params = { ...defaultParams, ...customParams }

  const handleParamChange = (name, value) => {
    setCustomParams((prev) => ({ ...prev, [name]: value }))
  }

  const handleFetchBranchChoices = async (paramName, fullClass) => {
    setLoadingChoices((prev) => ({ ...prev, [paramName]: true }))
    try {
      const res = await window.flywork?.jenkinsGetParameterChoices(job.path, paramName, fullClass)
      if (res?.success && res.choices?.length > 0) {
        setDynamicChoices((prev) => ({ ...prev, [paramName]: res.choices }))
        if (!params[paramName]) {
          handleParamChange(paramName, res.choices[0])
        }
      } else {
        alert('未从 Jenkins 服务端拉取到可用分支列表，您可以直接手动输入分支名。')
      }
    } catch (err) {
      console.warn('拉取分支失败:', err)
    } finally {
      setLoadingChoices((prev) => ({ ...prev, [paramName]: false }))
    }
  }

  const handleSubmit = async (e) => {
    e?.preventDefault()
    setIsSubmitting(true)
    setError(null)

    try {
      const res = await window.flywork.jenkinsBuildJob(job.path, isParameterized ? params : null)
      if (res.success) {
        if (onBuildTriggered) {
          onBuildTriggered({
            jobPath: job.path,
            queueId: res.queueId,
            location: res.location
          })
        }
        onClose()
      } else {
        setError(res.error || '触发构建失败')
      }
    } catch (err) {
      setError('构建触发异常: ' + err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose} style={{ zIndex: 1100 }}>
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{ width: 560, maxWidth: '95vw', maxHeight: '85vh', overflowY: 'auto' }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 16
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: 'rgba(57, 197, 187, 0.15)',
                color: 'var(--accent-teal)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 16
              }}
            >
              ▶
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>
                {isParameterized ? '参数化构建' : '触发构建'}
              </h3>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)' }}>
                {job.fullName || job.name}
              </p>
            </div>
          </div>
          <button
            className="btn btn-ghost"
            onClick={onClose}
            style={{ padding: 4, borderRadius: 6, color: 'var(--text-muted)' }}
          >
            ✕
          </button>
        </div>

        {error && (
          <div
            style={{
              padding: '8px 12px',
              borderRadius: 6,
              background: 'rgba(248, 81, 73, 0.12)',
              border: '1px solid rgba(248, 81, 73, 0.25)',
              color: 'var(--accent-red)',
              fontSize: 12,
              marginBottom: 14
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {isParameterized ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 18 }}>
              {job.parameters.map((p) => {
                const isBoolean = p.type?.includes('Boolean')
                const isText = p.type?.includes('Text')
                const isGit = p.isGitParameter
                const choicesFromProp = p.choices || []
                const choicesFromDynamic = dynamicChoices[p.name] || []
                const activeChoices = Array.from(
                  new Set([...choicesFromProp, ...choicesFromDynamic])
                )
                const isChoice = activeChoices.length > 0 || isGit
                const isCustomMode = customInputMode[p.name] || (!isGit && !p.choices?.length)

                return (
                  <div key={p.name}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: 6
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <label
                          style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}
                        >
                          {p.name}
                        </label>
                        {isGit && (
                          <span
                            className="badge badge-purple"
                            style={{ fontSize: 10, padding: '1px 5px' }}
                          >
                            Git 分支/标签
                          </span>
                        )}
                      </div>
                      <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                        {p.type || 'String'}
                      </span>
                    </div>

                    {isChoice ? (
                      <div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <div style={{ flex: 1 }}>
                            {isCustomMode && activeChoices.length === 0 ? (
                              <input
                                type="text"
                                className="input"
                                placeholder={
                                  isGit ? '输入分支名，如 origin/main, feature/...' : '输入参数值'
                                }
                                value={params[p.name] ?? ''}
                                onChange={(e) => handleParamChange(p.name, e.target.value)}
                                style={{ width: '100%', boxSizing: 'border-box' }}
                              />
                            ) : customInputMode[p.name] ? (
                              <input
                                type="text"
                                className="input"
                                placeholder={isGit ? '输入自定义分支名...' : '输入自定义参数值...'}
                                value={params[p.name] ?? ''}
                                onChange={(e) => handleParamChange(p.name, e.target.value)}
                                style={{ width: '100%', boxSizing: 'border-box' }}
                              />
                            ) : (
                              <select
                                className="input"
                                value={params[p.name] ?? ''}
                                onChange={(e) => {
                                  if (e.target.value === '__custom__') {
                                    setCustomInputMode((prev) => ({ ...prev, [p.name]: true }))
                                  } else {
                                    handleParamChange(p.name, e.target.value)
                                  }
                                }}
                                style={{ width: '100%', boxSizing: 'border-box' }}
                              >
                                {activeChoices.map((c) => (
                                  <option key={c} value={c}>
                                    {c}
                                  </option>
                                ))}
                                <option value="__custom__">✎ 手动输入其他分支 / 参数...</option>
                              </select>
                            )}
                          </div>

                          {isGit && (
                            <button
                              type="button"
                              className="btn btn-secondary"
                              disabled={loadingChoices[p.name]}
                              onClick={() => handleFetchBranchChoices(p.name, p.fullClass)}
                              title="从 Jenkins 远程拉取所有分支选项"
                              style={{
                                fontSize: 11,
                                padding: '0 10px',
                                whiteSpace: 'nowrap',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 4
                              }}
                            >
                              <span
                                style={{
                                  animation: loadingChoices[p.name]
                                    ? 'spin 1s linear infinite'
                                    : 'none',
                                  display: 'inline-block'
                                }}
                              >
                                ⟳
                              </span>
                              {loadingChoices[p.name] ? '拉取中' : '刷新分支'}
                            </button>
                          )}

                          {customInputMode[p.name] && activeChoices.length > 0 && (
                            <button
                              type="button"
                              className="btn btn-ghost"
                              onClick={() =>
                                setCustomInputMode((prev) => ({ ...prev, [p.name]: false }))
                              }
                              style={{ fontSize: 11, padding: '0 8px' }}
                            >
                              返回列表
                            </button>
                          )}
                        </div>

                        {/* 分支快捷选择标签 */}
                        {isGit && activeChoices.length > 0 && (
                          <div
                            style={{
                              display: 'flex',
                              flexWrap: 'wrap',
                              gap: 4,
                              marginTop: 6
                            }}
                          >
                            {activeChoices.slice(0, 6).map((c) => (
                              <span
                                key={c}
                                onClick={() => handleParamChange(p.name, c)}
                                style={{
                                  fontSize: 10,
                                  padding: '2px 6px',
                                  borderRadius: 4,
                                  background:
                                    params[p.name] === c
                                      ? 'var(--accent-blue-dim)'
                                      : 'var(--bg-elevated)',
                                  color:
                                    params[p.name] === c
                                      ? 'var(--accent-blue)'
                                      : 'var(--text-secondary)',
                                  border: `1px solid ${
                                    params[p.name] === c ? 'var(--accent-blue)' : 'var(--border)'
                                  }`,
                                  cursor: 'pointer'
                                }}
                              >
                                {c}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : isBoolean ? (
                      <label
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          cursor: 'pointer',
                          fontSize: 13,
                          marginTop: 4
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={Boolean(params[p.name])}
                          onChange={(e) => handleParamChange(p.name, e.target.checked)}
                        />
                        <span>启用 / 勾选</span>
                      </label>
                    ) : isText ? (
                      <textarea
                        className="input"
                        rows={3}
                        value={params[p.name] ?? ''}
                        onChange={(e) => handleParamChange(p.name, e.target.value)}
                        style={{
                          width: '100%',
                          boxSizing: 'border-box',
                          fontFamily: 'monospace',
                          fontSize: 12
                        }}
                      />
                    ) : (
                      <input
                        type="text"
                        className="input"
                        value={params[p.name] ?? ''}
                        onChange={(e) => handleParamChange(p.name, e.target.value)}
                        style={{ width: '100%', boxSizing: 'border-box' }}
                      />
                    )}

                    {p.description && (
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                        {p.description}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            <div style={{ marginBottom: 18, fontSize: 13, color: 'var(--text-secondary)' }}>
              该任务无特殊构建参数，点击下方按钮将立即发起构建请求。
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              取消
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSubmitting}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              {isSubmitting && (
                <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>
                  ⟳
                </span>
              )}
              {isSubmitting ? '正在提交...' : '开始构建'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

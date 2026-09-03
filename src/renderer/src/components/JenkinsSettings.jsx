/* eslint-disable react/prop-types */
import { useState, useEffect } from 'react'

export default function JenkinsSettings({ onConfigChange, isModal = false, onClose }) {
  const [baseUrl, setBaseUrl] = useState('')
  const [username, setUsername] = useState('')
  const [token, setToken] = useState('')
  const [isConfigured, setIsConfigured] = useState(false)
  const [isValidating, setIsValidating] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  useEffect(() => {
    let active = true
    window.flywork?.jenkinsCheckAuth?.().then((res) => {
      if (!active || !res?.success) return
      setIsConfigured(res.configured)
      if (res.baseUrl) setBaseUrl(res.baseUrl)
      if (res.username) setUsername(res.username)
      if (res.configured) setToken('')
    })
    return () => {
      active = false
    }
  }, [])

  const handleValidateAndSave = async (e) => {
    e?.preventDefault()
    if (!baseUrl.trim()) {
      setError('请输入 Jenkins 服务器 URL')
      return
    }
    if (!username.trim()) {
      setError('请输入 Jenkins 用户名')
      return
    }
    if (!token.trim() && !isConfigured) {
      setError('请输入 Jenkins API Token')
      return
    }

    setIsValidating(true)
    setError(null)
    setSuccess(null)

    try {
      const res = await window.flywork.jenkinsValidateConfig({
        baseUrl: baseUrl.trim(),
        username: username.trim(),
        token: token.trim()
      })

      if (res.valid) {
        setSuccess('Jenkins 连接验证成功并已保存！')
        setIsConfigured(true)
        setToken('')
        if (onConfigChange) onConfigChange({ configured: true, baseUrl: baseUrl.trim() })
        if (isModal && onClose) {
          setTimeout(() => {
            onClose()
          }, 1000)
        }
      } else {
        setError(res.message || '连接失败，请检查配置')
      }
    } catch (err) {
      setError('验证失败: ' + err.message)
    } finally {
      setIsValidating(false)
    }
  }

  const handleLogout = async () => {
    if (!confirm('确定要清除已保存的 Jenkins 凭据与配置吗？')) return
    try {
      await window.flywork?.jenkinsLogout()
      setIsConfigured(false)
      setBaseUrl('')
      setUsername('')
      setToken('')
      setSuccess('已成功清除 Jenkins 配置')
      if (onConfigChange) onConfigChange({ configured: false, baseUrl: '' })
    } catch (err) {
      setError('清除配置失败: ' + err.message)
    }
  }

  return (
    <div className={isModal ? '' : 'card'} style={{ padding: isModal ? 0 : 20 }}>
      {/* Title block when rendered in non-modal setting */}
      {!isModal && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 16
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                background: 'rgba(210, 153, 34, 0.15)',
                color: 'var(--accent-amber)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 18
              }}
            >
              🏗️
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>
                Jenkins 持续集成服务配置
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                配置 Jenkins 实例 URL 与凭证以激活流水线状态监控、一键构建与实时日志
              </div>
            </div>
          </div>
          <div>
            {isConfigured ? (
              <span
                className="badge"
                style={{
                  background: 'var(--accent-green-dim)',
                  color: 'var(--accent-green)',
                  padding: '4px 10px'
                }}
              >
                ✓ 已连接并就绪
              </span>
            ) : (
              <span className="badge badge-gray" style={{ padding: '4px 10px' }}>
                未配置
              </span>
            )}
          </div>
        </div>
      )}

      {error && (
        <div
          style={{
            padding: '10px 14px',
            borderRadius: 'var(--radius-md)',
            background: 'var(--accent-red-dim)',
            color: 'var(--accent-red)',
            fontSize: 12,
            marginBottom: 16,
            display: 'flex',
            alignItems: 'center',
            gap: 8
          }}
        >
          <span>⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div
          style={{
            padding: '10px 14px',
            borderRadius: 'var(--radius-md)',
            background: 'var(--accent-green-dim)',
            color: 'var(--accent-green)',
            fontSize: 12,
            marginBottom: 16,
            display: 'flex',
            alignItems: 'center',
            gap: 8
          }}
        >
          <span>✓</span>
          <span>{success}</span>
        </div>
      )}

      <form onSubmit={handleValidateAndSave}>
        <div style={{ marginBottom: 14 }}>
          <label
            style={{
              display: 'block',
              fontSize: 12,
              fontWeight: 500,
              marginBottom: 6,
              color: 'var(--text-primary)'
            }}
          >
            Jenkins 服务器 URL <span style={{ color: 'var(--accent-red)' }}>*</span>
          </label>
          <input
            type="url"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="例如: https://jenkins.example.com 或 http://127.0.0.1:8080"
            className="input"
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: 6,
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
              fontSize: 13
            }}
          />
          <span
            style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, display: 'block' }}
          >
            Jenkins 服务的根访问路径，末尾无需斜杠
          </span>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label
            style={{
              display: 'block',
              fontSize: 12,
              fontWeight: 500,
              marginBottom: 6,
              color: 'var(--text-primary)'
            }}
          >
            用户名 (Username) <span style={{ color: 'var(--accent-red)' }}>*</span>
          </label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Jenkins 登录用户名"
            className="input"
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: 6,
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
              fontSize: 13
            }}
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label
            style={{
              display: 'block',
              fontSize: 12,
              fontWeight: 500,
              marginBottom: 6,
              color: 'var(--text-primary)'
            }}
          >
            API Token{' '}
            <span style={{ color: 'var(--accent-red)' }}>
              {isConfigured ? '(已配置，留空表示保持现有凭据)' : '*'}
            </span>
          </label>
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder={
              isConfigured ? '••••••••••••••••••••••••' : '粘贴您的 Jenkins 用户 API Token'
            }
            className="input"
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: 6,
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
              fontSize: 13
            }}
          />
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6, lineHeight: 1.5 }}>
            💡 如何获取: 登录 Jenkins → 点击右上角用户头像 → 点击左侧{' '}
            <strong>设置 (Configure)</strong> → 在 <strong>API Token</strong> 处点击{' '}
            <strong>Add new Token</strong> 生成并复制。
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingTop: 10,
            borderTop: '1px solid var(--border)'
          }}
        >
          {isConfigured ? (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleLogout}
              style={{ color: 'var(--accent-red)', borderColor: 'rgba(224, 92, 92, 0.3)' }}
            >
              清除配置
            </button>
          ) : (
            <div />
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            {isModal && onClose && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
                取消
              </button>
            )}
            <button
              type="submit"
              className="btn btn-primary btn-sm"
              disabled={isValidating}
              style={{ minWidth: 100 }}
            >
              {isValidating ? '正在验证...' : isConfigured ? '验证并更新' : '验证并保存'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}

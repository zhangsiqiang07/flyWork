/* eslint-disable react/prop-types */
import { useState, useEffect } from 'react'

export default function JenkinsSettingsModal({ isOpen, onClose, onConfigSaved }) {
  const [baseUrl, setBaseUrl] = useState('')
  const [username, setUsername] = useState('')
  const [token, setToken] = useState('')
  const [isConfigured, setIsConfigured] = useState(false)
  const [isValidating, setIsValidating] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  useEffect(() => {
    if (!isOpen) return
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
  }, [isOpen])

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
        if (onConfigSaved) onConfigSaved()
        setTimeout(() => {
          onClose()
        }, 1000)
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
      if (onConfigSaved) onConfigSaved()
    } catch (err) {
      setError('清除配置失败: ' + err.message)
    }
  }

  if (!isOpen) return null

  return (
    <div className="modal-backdrop" onClick={onClose} style={{ zIndex: 1100 }}>
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{ width: 540, maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto' }}
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
                background: 'rgba(210, 153, 34, 0.15)',
                color: 'var(--accent-amber)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 16
              }}
            >
              ⚙
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Jenkins 连接配置</h3>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)' }}>
                配置服务器地址与 API Token 即可实时管理 CI 任务
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

        {success && (
          <div
            style={{
              padding: '8px 12px',
              borderRadius: 6,
              background: 'rgba(63, 185, 80, 0.12)',
              border: '1px solid rgba(63, 185, 80, 0.25)',
              color: 'var(--accent-green)',
              fontSize: 12,
              marginBottom: 14
            }}
          >
            {success}
          </div>
        )}

        <form onSubmit={handleValidateAndSave}>
          <div style={{ marginBottom: 14 }}>
            <label
              style={{
                display: 'block',
                fontSize: 12,
                fontWeight: 600,
                marginBottom: 6,
                color: 'var(--text-primary)'
              }}
            >
              Jenkins Base URL <span style={{ color: 'var(--accent-red)' }}>*</span>
            </label>
            <input
              type="text"
              className="input"
              placeholder="如 https://jenkins.company.com 或 http://localhost:8080"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              style={{ width: '100%', boxSizing: 'border-box' }}
              required
            />
          </div>

          <div style={{ marginBottom: 14 }}>
            <label
              style={{
                display: 'block',
                fontSize: 12,
                fontWeight: 600,
                marginBottom: 6,
                color: 'var(--text-primary)'
              }}
            >
              用户名 (Username) <span style={{ color: 'var(--accent-red)' }}>*</span>
            </label>
            <input
              type="text"
              className="input"
              placeholder="如 admin 或您的 Jenkins 登录账号"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              style={{ width: '100%', boxSizing: 'border-box' }}
              required
            />
          </div>

          <div style={{ marginBottom: 14 }}>
            <label
              style={{
                display: 'block',
                fontSize: 12,
                fontWeight: 600,
                marginBottom: 6,
                color: 'var(--text-primary)'
              }}
            >
              API Token <span style={{ color: 'var(--accent-red)' }}>*</span>
            </label>
            <input
              type="password"
              className="input"
              placeholder={
                isConfigured
                  ? '已加密存储 (留空表示不修改)'
                  : '在 Jenkins 用户设置中生成的 API Token'
              }
              value={token}
              onChange={(e) => setToken(e.target.value)}
              style={{ width: '100%', boxSizing: 'border-box' }}
            />
          </div>

          {/* Token 获取指引提示 */}
          <div
            style={{
              padding: '10px 12px',
              borderRadius: 6,
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              fontSize: 12,
              color: 'var(--text-secondary)',
              marginBottom: 18,
              lineHeight: 1.5
            }}
          >
            <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
              💡 如何获取 Jenkins API Token？
            </div>
            <ol style={{ margin: 0, paddingLeft: 18 }}>
              <li>登录 Jenkins 网页端，点击右上角您的用户名进入个人中心。</li>
              <li>
                在左侧菜单点击 <strong>设置 (Configure)</strong>。
              </li>
              <li>
                找到 <strong>API Token</strong> 栏目，点击{' '}
                <strong>Add new Token (添加新 Token)</strong> 并生成。
              </li>
              <li>复制生成的 Token 粘贴到上方输入框中。</li>
            </ol>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: 16
            }}
          >
            {isConfigured ? (
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleLogout}
                style={{ fontSize: 12 }}
              >
                清除配置
              </button>
            ) : (
              <div />
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                取消
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={isValidating}
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              >
                {isValidating && (
                  <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>
                    ⟳
                  </span>
                )}
                {isValidating ? '正在验证连接...' : '测试并保存'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

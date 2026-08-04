import { useState, useEffect } from 'react'

export default function YunxiaoSettings({ onConfigChange }) {
  const [token, setToken] = useState('')
  const [isConfigured, setIsConfigured] = useState(false)
  const [isValidating, setIsValidating] = useState(false)
  const [organizations, setOrganizations] = useState([])
  const [currentOrgId, setCurrentOrgId] = useState(null)
  const [currentOrgName, setCurrentOrgName] = useState(null)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  // 初始化时检查配置状态
  useEffect(() => {
    checkAuthStatus()
  }, [])

  const checkAuthStatus = async () => {
    try {
      if (!window.flywork?.yunxiaoCheckAuth) {
        setError('云效 API 不可用')
        return
      }

      const result = await window.flywork.yunxiaoCheckAuth()
      if (result.success) {
        setIsConfigured(result.configured)
        setCurrentOrgId(result.currentOrganizationId)
        setCurrentOrgName(result.currentOrganizationName)

        if (result.configured) {
          // 已配置，加载组织列表
          await loadOrganizations()
        }
      } else {
        setError(result.error)
      }
    } catch (err) {
      setError('检查配置状态失败: ' + err.message)
    }
  }

  const loadOrganizations = async () => {
    try {
      if (!window.flywork?.yunxiaoListOrganizations) return

      const result = await window.flywork.yunxiaoListOrganizations()
      if (result.success) {
        setOrganizations(result.organizations || [])
      } else {
        setError('加载组织列表失败: ' + result.error)
      }
    } catch (err) {
      setError('加载组织列表失败: ' + err.message)
    }
  }

  const handleValidateToken = async () => {
    if (!token.trim()) {
      setError('请输入访问令牌')
      return
    }

    setIsValidating(true)
    setError(null)
    setSuccess(null)

    try {
      if (!window.flywork?.yunxiaoValidateToken) {
        setError('云效 API 不可用')
        return
      }

      const result = await window.flywork.yunxiaoValidateToken(token.trim())

      if (result.valid) {
        setSuccess('Token 验证成功！')
        setIsConfigured(true)
        setOrganizations(result.organizations || [])

        // 如果只有一个组织，自动选择
        if (result.organizations?.length === 1) {
          const org = result.organizations[0]
          await handleSelectOrganization(org.id, org.name)
        }

        if (onConfigChange) {
          onConfigChange({ configured: true, organizations: result.organizations })
        }
      } else {
        setError(result.message || 'Token 验证失败')
      }
    } catch (err) {
      setError('验证失败: ' + err.message)
    } finally {
      setIsValidating(false)
    }
  }

  const handleSelectOrganization = async (orgId, orgName) => {
    try {
      if (!window.flywork?.yunxiaoSetCurrentOrganization) {
        setError('云效 API 不可用')
        return
      }

      const result = await window.flywork.yunxiaoSetCurrentOrganization({
        organizationId: orgId,
        organizationName: orgName
      })

      if (result.success) {
        setCurrentOrgId(orgId)
        setCurrentOrgName(orgName)
        setSuccess(`已选择组织: ${orgName}`)
      } else {
        setError('设置组织失败: ' + result.error)
      }
    } catch (err) {
      setError('设置组织失败: ' + err.message)
    }
  }

  const handleLogout = async () => {
    try {
      if (!window.flywork?.yunxiaoLogout) {
        setError('云效 API 不可用')
        return
      }

      const result = await window.flywork.yunxiaoLogout()
      if (result.success) {
        setIsConfigured(false)
        setToken('')
        setOrganizations([])
        setCurrentOrgId(null)
        setCurrentOrgName(null)
        setSuccess('已退出登录')

        if (onConfigChange) {
          onConfigChange({ configured: false })
        }
      } else {
        setError('退出失败: ' + result.error)
      }
    } catch (err) {
      setError('退出失败: ' + err.message)
    }
  }

  return (
    <div style={{ padding: 24, maxWidth: 600 }}>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8, color: 'var(--text-primary)' }}>
          云效集成设置
        </h2>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          配置阿里云云效访问令牌，启用项目协作和工作项管理功能
        </p>
      </div>

      {/* 状态提示 */}
      {error && (
        <div style={{
          padding: '12px 16px',
          background: 'var(--accent-red-dim)',
          border: '1px solid var(--accent-red)',
          borderRadius: 8,
          marginBottom: 16,
          fontSize: 13,
          color: 'var(--accent-red)'
        }}>
          ⚠️ {error}
        </div>
      )}

      {success && (
        <div style={{
          padding: '12px 16px',
          background: 'var(--accent-green-dim)',
          border: '1px solid var(--accent-green)',
          borderRadius: 8,
          marginBottom: 16,
          fontSize: 13,
          color: 'var(--accent-green)'
        }}>
          ✓ {success}
        </div>
      )}

      {/* 未配置状态 */}
      {!isConfigured && (
        <div className="card" style={{ padding: 20 }}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 8, color: 'var(--text-primary)' }}>
              个人访问令牌
            </label>
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="请输入云效访问令牌"
              className="selectable"
              style={{
                width: '100%',
                padding: '10px 12px',
                fontSize: 13,
                border: '1px solid var(--border)',
                borderRadius: 6,
                background: 'var(--bg-elevated)',
                color: 'var(--text-primary)'
              }}
            />
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6, lineHeight: 1.5 }}>
              💡 在{' '}
              <a
                href="https://devops.aliyun.com/personalAccessToken"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: 'var(--accent-blue)' }}
              >
                云效个人设置
              </a>{' '}
              中创建访问令牌
            </div>
          </div>

          <button
            className="btn btn-primary"
            onClick={handleValidateToken}
            disabled={isValidating}
            style={{ width: '100%' }}
          >
            {isValidating ? '验证中...' : '验证并保存'}
          </button>
        </div>
      )}

      {/* 已配置状态 */}
      {isConfigured && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* 当前组织 */}
          <div className="card" style={{ padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 4 }}>
                  当前组织
                </div>
                <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>
                  {currentOrgName || '未选择'}
                </div>
              </div>
              <div style={{
                padding: '4px 10px',
                background: 'var(--accent-green-dim)',
                color: 'var(--accent-green)',
                borderRadius: 12,
                fontSize: 11,
                fontWeight: 500
              }}>
                ✓ 已连接
              </div>
            </div>

            {/* 组织选择 */}
            {organizations.length > 0 && (
              <div>
                <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>
                  切换组织
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {organizations.map((org) => (
                    <button
                      key={org.id}
                      className={`btn ${org.id === currentOrgId ? 'btn-secondary' : 'btn-ghost'}`}
                      onClick={() => handleSelectOrganization(org.id, org.name)}
                      style={{
                        justifyContent: 'flex-start',
                        padding: '8px 12px',
                        fontSize: 13
                      }}
                    >
                      <span style={{ marginRight: 8 }}>{org.id === currentOrgId ? '◉' : '○'}</span>
                      {org.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 操作按钮 */}
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="btn btn-secondary"
              onClick={handleLogout}
              style={{ flex: 1 }}
            >
              退出登录
            </button>
            <button
              className="btn btn-ghost"
              onClick={checkAuthStatus}
              style={{ flex: 1 }}
            >
              刷新状态
            </button>
          </div>
        </div>
      )}

      {/* 帮助信息 */}
      <div style={{ marginTop: 24, padding: 16, background: 'var(--bg-elevated)', borderRadius: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 8 }}>
          📖 使用说明
        </div>
        <ul style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.8, paddingLeft: 16, margin: 0 }}>
          <li>访问令牌用于调用云效 API，安全存储在本地</li>
          <li>配置后可在 flyWork 中管理云效项目和工作项</li>
          <li>支持多组织切换，方便管理不同团队的项目</li>
          <li>所有操作都会记录在审计日志中</li>
        </ul>
      </div>
    </div>
  )
}

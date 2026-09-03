/* eslint-disable react/prop-types */
import { useState, useEffect, useCallback, useMemo } from 'react'

export default function ProvisioningProfiles({ hideHeader = false }) {
  const [activeTab, setActiveTab] = useState('profiles') // 'profiles' | 'certs'
  const [profiles, setProfiles] = useState([])
  const [certs, setCerts] = useState([])
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState('all') // 'all' | 'valid' | 'expiring' | 'expired' | 'development' | 'enterprise'
  const [expandedProfileUuid, setExpandedProfileUuid] = useState(null)
  const [profileSubTab, setProfileSubTab] = useState({}) // { [uuid]: 'devices' | 'entitlements' | 'meta' }
  const [toastMsg, setToastMsg] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const [udidSearch, setUdidSearch] = useState('')

  const showToast = useCallback((msg) => {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(''), 2500)
  }, [])

  // 1. Load profiles and certs
  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      if (window.flywork?.mobileListProfiles) {
        const list = await window.flywork.mobileListProfiles()
        setProfiles(Array.isArray(list) ? list : [])
      }
      if (window.flywork?.mobileListKeychainCerts) {
        const cList = await window.flywork.mobileListKeychainCerts()
        setCerts(Array.isArray(cList) ? cList : [])
      }
    } catch (err) {
      console.error('Failed to load mobile provisioning data:', err)
      showToast('加载描述文件或证书失败')
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleOpenProfilesDir = useCallback(async () => {
    try {
      if (window.flywork?.mobileOpenProfilesDir) {
        const res = await window.flywork.mobileOpenProfilesDir()
        if (res?.success) {
          showToast('已在 Finder 中打开描述文件系统目录')
          return
        }
      }
      if (window.flywork?.openPath) {
        await window.flywork.openPath('~/Library/MobileDevice/Provisioning Profiles')
        showToast('已在 Finder 中打开描述文件系统目录')
      }
    } catch (err) {
      showToast(`打开目录失败: ${err.message}`)
    }
  }, [showToast])

  // Handle Drag and drop external .mobileprovision
  const handleDrop = async (e) => {
    e.preventDefault()
    setIsDragging(false)
    const files = e.dataTransfer.files
    if (!files || files.length === 0) return

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      if (file.name.endsWith('.mobileprovision')) {
        let filePath = file.path
        if (!filePath && window.flywork?.getPathForFile) {
          filePath = window.flywork.getPathForFile(file)
        }
        if (filePath && window.flywork?.mobileParseProfile) {
          try {
            const parsed = await window.flywork.mobileParseProfile(filePath)
            if (parsed) {
              setProfiles((prev) => [parsed, ...prev.filter((p) => p.uuid !== parsed.uuid)])
              setExpandedProfileUuid(parsed.uuid)
              showToast(`已成功解析外部描述文件: ${parsed.name}`)
            } else {
              showToast('解析描述文件失败，格式可能已损坏')
            }
          } catch (err) {
            showToast(`解析失败: ${err.message}`)
          }
        }
      } else {
        showToast('请拖入以 .mobileprovision 结尾的文件')
      }
    }
  }

  const handleCopy = (text, label) => {
    if (!text) return
    navigator.clipboard.writeText(text)
    showToast(`已复制 ${label || '内容'} 到剪贴板`)
  }

  const handleReveal = async (filePath) => {
    try {
      if (window.flywork?.mobileRevealFile) {
        await window.flywork.mobileRevealFile(filePath)
      } else if (window.flywork?.openPath) {
        await window.flywork.openPath(filePath)
      }
    } catch (err) {
      showToast(`打开失败: ${err.message}`)
    }
  }

  const handleDelete = async (profile) => {
    if (!window.confirm(`确定要永久删除描述文件 "${profile.name}" 吗？`)) return
    try {
      if (window.flywork?.mobileDeleteProfile) {
        const res = await window.flywork.mobileDeleteProfile(profile.filePath)
        if (res?.success) {
          setProfiles((prev) => prev.filter((p) => p.uuid !== profile.uuid))
          showToast('描述文件已删除')
        } else {
          showToast(`删除失败: ${res?.error || '未知错误'}`)
        }
      }
    } catch (err) {
      showToast(`删除失败: ${err.message}`)
    }
  }

  // Filter profiles
  const filteredProfiles = useMemo(() => {
    const q = searchQuery.toLowerCase().trim()
    return profiles.filter((p) => {
      // 1. Type filter
      if (filterType === 'valid' && p.isExpired) return false
      if (filterType === 'expiring' && (p.isExpired || p.daysRemaining > 30)) return false
      if (filterType === 'expired' && !p.isExpired) return false
      if (filterType === 'development' && p.profileType !== 'development') return false
      if (filterType === 'enterprise' && p.profileType !== 'enterprise') return false

      // 2. Query filter (matches Name, App ID, Team, UUID, or UDID!)
      if (!q) return true
      const matchesBasic =
        p.name.toLowerCase().includes(q) ||
        p.appId.toLowerCase().includes(q) ||
        p.teamName.toLowerCase().includes(q) ||
        p.teamId.toLowerCase().includes(q) ||
        p.uuid.toLowerCase().includes(q)

      if (matchesBasic) return true

      // UDID matching: if search looks like a UDID or matches any provisioned device
      if (p.devices && p.devices.some((d) => d.toLowerCase().includes(q))) {
        return true
      }

      return false
    })
  }, [profiles, searchQuery, filterType])

  // Summary counts
  const summary = useMemo(() => {
    let valid = 0
    let expiring = 0
    let expired = 0
    profiles.forEach((p) => {
      if (p.isExpired) expired++
      else {
        valid++
        if (p.daysRemaining <= 30) expiring++
      }
    })
    return { total: profiles.length, valid, expiring, expired }
  }, [profiles])

  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}
      onDragOver={(e) => {
        e.preventDefault()
        setIsDragging(true)
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
    >
      {/* Toast Notice */}
      {toastMsg && (
        <div
          style={{
            position: 'absolute',
            top: 20,
            right: 24,
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            padding: '8px 16px',
            borderRadius: 'var(--radius-md)',
            boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
            zIndex: 1000,
            fontSize: 12,
            color: 'var(--text-primary)'
          }}
        >
          {toastMsg}
        </div>
      )}

      {/* Dragging overlay */}
      {isDragging && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(56, 139, 253, 0.15)',
            border: '2px dashed var(--accent-blue)',
            zIndex: 2000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
            gap: 12,
            pointerEvents: 'none'
          }}
        >
          <div style={{ fontSize: 48 }}>📄</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>
            释放以解析此 .mobileprovision 描述文件
          </div>
        </div>
      )}

      {/* Page Header */}
      {!hideHeader ? (
        <div
          className="page-header"
          style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)' }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 12
            }}
          >
            <div>
              <div className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>🔏</span>
                <span>iOS 描述文件与证书查看器</span>
              </div>
              <div className="page-subtitle">
                解析系统与外部 Provisioning Profiles、UDID 设备查询、过期倒计时与 Keychain 签名证书
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="btn btn-secondary btn-sm"
                onClick={loadData}
                disabled={loading}
                style={{ gap: 6 }}
              >
                <span
                  style={{
                    display: 'inline-block',
                    animation: loading ? 'spin 1s linear infinite' : 'none'
                  }}
                >
                  🔄
                </span>
                <span>{loading ? '刷新中' : '刷新'}</span>
              </button>
              <button
                className="btn btn-secondary btn-sm"
                onClick={handleOpenProfilesDir}
                style={{ gap: 6 }}
              >
                <span>📂</span>
                <span>打开系统目录</span>
              </button>
            </div>
          </div>

          {/* Tab Switcher */}
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              className={`btn btn-sm ${activeTab === 'profiles' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setActiveTab('profiles')}
              style={{ gap: 6, fontSize: 12 }}
            >
              <span>📋</span>
              <span>描述文件 ({profiles.length})</span>
            </button>
            <button
              className={`btn btn-sm ${activeTab === 'certs' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setActiveTab('certs')}
              style={{ gap: 6, fontSize: 12 }}
            >
              <span>🔑</span>
              <span>Keychain 签名证书 ({certs.length})</span>
            </button>
          </div>
        </div>
      ) : (
        <div
          style={{
            padding: '8px 20px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--bg-elevated)',
            flexShrink: 0
          }}
        >
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              className={`btn btn-sm ${activeTab === 'profiles' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setActiveTab('profiles')}
              style={{ gap: 6, fontSize: 11, height: 26 }}
            >
              <span>📋</span>
              <span>描述文件 ({profiles.length})</span>
            </button>
            <button
              className={`btn btn-sm ${activeTab === 'certs' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setActiveTab('certs')}
              style={{ gap: 6, fontSize: 11, height: 26 }}
            >
              <span>🔑</span>
              <span>Keychain 证书 ({certs.length})</span>
            </button>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={loadData}
              disabled={loading}
              style={{ gap: 6, fontSize: 11, height: 26 }}
            >
              <span
                style={{
                  display: 'inline-block',
                  animation: loading ? 'spin 1s linear infinite' : 'none'
                }}
              >
                🔄
              </span>
              <span>{loading ? '刷新中' : '刷新'}</span>
            </button>
            <button
              className="btn btn-secondary btn-sm"
              onClick={handleOpenProfilesDir}
              style={{ gap: 6, fontSize: 11, height: 26 }}
            >
              <span>📂</span>
              <span>系统目录</span>
            </button>
          </div>
        </div>
      )}

      {/* Content Area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
        {/* ============================================== */}
        {/* TAB 1: 描述文件 (Profiles) */}
        {/* ============================================== */}
        {activeTab === 'profiles' && (
          <div>
            {/* Search & Filter Bar */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 12,
                marginBottom: 16
              }}
            >
              <div
                style={{ display: 'flex', gap: 8, alignItems: 'center', flex: 1, minWidth: 300 }}
              >
                <div
                  className="quick-input"
                  style={{ padding: '6px 12px', flex: 1, maxWidth: 440 }}
                >
                  <svg
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="var(--text-muted)"
                    strokeWidth="2"
                  >
                    <circle cx="11" cy="11" r="8" />
                    <path d="m21 21-4.35-4.35" />
                  </svg>
                  <input
                    placeholder="按描述文件名称、App ID、Team、或粘贴 UDID 搜索..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{ fontSize: 12 }}
                  />
                  {searchQuery && (
                    <button
                      className="btn btn-ghost btn-icon btn-sm"
                      onClick={() => setSearchQuery('')}
                      style={{ padding: 2, height: 'auto' }}
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Filter Pills */}
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {[
                    { id: 'all', label: `全部 (${summary.total})` },
                    { id: 'valid', label: `有效 (${summary.valid})` },
                    {
                      id: 'expiring',
                      label: `即将过期 (${summary.expiring})`,
                      color: 'var(--accent-amber)'
                    },
                    {
                      id: 'expired',
                      label: `已过期 (${summary.expired})`,
                      color: 'var(--accent-red)'
                    },
                    { id: 'development', label: '开发' },
                    { id: 'enterprise', label: '企业' }
                  ].map((f) => {
                    const isSelected = filterType === f.id
                    return (
                      <button
                        key={f.id}
                        className={`btn btn-sm ${isSelected ? 'btn-secondary' : 'btn-ghost'}`}
                        onClick={() => setFilterType(f.id)}
                        style={{
                          fontSize: 11,
                          borderColor: isSelected ? 'var(--accent-blue)' : 'transparent',
                          color: f.color || 'inherit'
                        }}
                      >
                        {f.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Drag drop hint */}
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                💡 支持将外部 <code>.mobileprovision</code> 文件直接拖入窗口即时解析
              </div>
            </div>

            {/* List */}
            {filteredProfiles.length === 0 ? (
              <div
                className="card"
                style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}
              >
                <div style={{ fontSize: 36, marginBottom: 12 }}>🔏</div>
                <div
                  style={{
                    fontSize: 15,
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                    marginBottom: 6
                  }}
                >
                  {searchQuery ? '未找到匹配的描述文件' : '本地暂未检测到描述文件'}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    maxWidth: 520,
                    margin: '0 auto',
                    lineHeight: 1.6,
                    marginBottom: 16
                  }}
                >
                  {searchQuery ? (
                    '尝试使用更短的关键词，或搜索其他 UDID 设备号'
                  ) : (
                    <>
                      <div>
                        系统默认扫描目录为：
                        <code
                          style={{
                            background: 'var(--bg-elevated)',
                            padding: '2px 6px',
                            borderRadius: 4
                          }}
                        >
                          ~/Library/MobileDevice/Provisioning Profiles
                        </code>
                      </div>
                      <div style={{ marginTop: 4, color: 'var(--text-muted)' }}>
                        若使用 Xcode 自动签名 (Automatic Signing)，Xcode
                        不一定会自动落盘物理文件。您可通过以下方式载入：
                      </div>
                    </>
                  )}
                </div>

                {!searchQuery && (
                  <div
                    style={{ display: 'flex', justifyContent: 'center', gap: 10, flexWrap: 'wrap' }}
                  >
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={handleOpenProfilesDir}
                      style={{ fontSize: 12, gap: 6 }}
                    >
                      <span>📂</span>
                      <span>打开系统扫描目录</span>
                    </button>
                    <div
                      style={{
                        fontSize: 11,
                        color: 'var(--accent-blue)',
                        display: 'flex',
                        alignItems: 'center'
                      }}
                    >
                      或直接从桌面/下载目录将 .mobileprovision 文件拖入此处
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {filteredProfiles.map((p) => {
                  const isExpanded = expandedProfileUuid === p.uuid
                  const currentSubTab = profileSubTab[p.uuid] || 'devices'

                  // Expiry status
                  let expiryBg = 'var(--accent-green-dim)'
                  let expiryColor = 'var(--accent-green)'
                  let expiryLabel = `剩余 ${p.daysRemaining} 天`

                  if (p.isExpired) {
                    expiryBg = 'var(--accent-red-dim)'
                    expiryColor = 'var(--accent-red)'
                    expiryLabel = '已过期'
                  } else if (p.daysRemaining <= 30) {
                    expiryBg = 'var(--accent-amber-dim)'
                    expiryColor = 'var(--accent-amber)'
                    expiryLabel = `仅剩 ${p.daysRemaining} 天到期`
                  }

                  // Type label
                  const typeLabels = {
                    development: {
                      label: '开发版 (Dev)',
                      bg: 'var(--accent-blue-dim)',
                      color: 'var(--accent-blue)'
                    },
                    adhoc: {
                      label: '分发版 (AdHoc)',
                      bg: 'var(--accent-purple-dim)',
                      color: 'var(--accent-purple)'
                    },
                    appstore: {
                      label: 'App Store',
                      bg: 'var(--accent-teal-dim)',
                      color: 'var(--accent-teal)'
                    },
                    enterprise: {
                      label: '企业版 (In-House)',
                      bg: 'var(--accent-amber-dim)',
                      color: 'var(--accent-amber)'
                    }
                  }
                  const typeConf = typeLabels[p.profileType] || {
                    label: p.profileType,
                    bg: 'var(--bg-hover)',
                    color: 'var(--text-secondary)'
                  }

                  // Filter devices if searching inside profile
                  const devicesList = p.devices || []
                  const filteredDevices = udidSearch
                    ? devicesList.filter((d) =>
                        d.toLowerCase().includes(udidSearch.toLowerCase().trim())
                      )
                    : devicesList

                  return (
                    <div
                      key={p.uuid}
                      className="card"
                      style={{
                        padding: '16px 20px',
                        borderLeft: p.isExpired
                          ? '3px solid var(--accent-red)'
                          : p.daysRemaining <= 30
                            ? '3px solid var(--accent-amber)'
                            : '3px solid var(--accent-green)'
                      }}
                    >
                      {/* Card Top Row */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          justifyContent: 'space-between',
                          gap: 16
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 8,
                              marginBottom: 6,
                              flexWrap: 'wrap'
                            }}
                          >
                            <span
                              style={{
                                fontSize: 15,
                                fontWeight: 600,
                                color: 'var(--text-primary)'
                              }}
                            >
                              {p.name}
                            </span>
                            <span
                              className="badge"
                              style={{
                                background: typeConf.bg,
                                color: typeConf.color,
                                fontSize: 10
                              }}
                            >
                              {typeConf.label}
                            </span>
                            <span
                              className="badge"
                              style={{ background: expiryBg, color: expiryColor, fontSize: 10 }}
                            >
                              {expiryLabel}
                            </span>
                            {p.provisionsAllDevices ? (
                              <span className="badge badge-gray" style={{ fontSize: 10 }}>
                                全设备支持
                              </span>
                            ) : (
                              <span className="badge badge-gray" style={{ fontSize: 10 }}>
                                {p.devicesCount} 台注册设备
                              </span>
                            )}
                          </div>

                          <div
                            style={{
                              display: 'flex',
                              flexWrap: 'wrap',
                              gap: 16,
                              fontSize: 12,
                              color: 'var(--text-secondary)'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ color: 'var(--text-muted)' }}>App ID:</span>
                              <code
                                style={{
                                  background: 'var(--bg-elevated)',
                                  padding: '1px 6px',
                                  borderRadius: 4,
                                  color: 'var(--text-primary)',
                                  fontSize: 11
                                }}
                              >
                                {p.appId}
                              </code>
                              <button
                                className="btn btn-ghost btn-icon btn-sm"
                                onClick={() => handleCopy(p.appId, 'App ID')}
                                title="复制 App ID"
                                style={{ padding: 2, height: 'auto' }}
                              >
                                📋
                              </button>
                            </div>

                            <div>
                              <span style={{ color: 'var(--text-muted)' }}>Team: </span>
                              <span>{p.teamName}</span>
                              {p.teamId && (
                                <span style={{ color: 'var(--text-muted)' }}> ({p.teamId})</span>
                              )}
                            </div>

                            <div>
                              <span style={{ color: 'var(--text-muted)' }}>到期时间: </span>
                              <span>
                                {p.expirationDate
                                  ? new Date(p.expirationDate).toLocaleDateString()
                                  : '-'}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Actions */}
                        <div
                          style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}
                        >
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleReveal(p.filePath)}
                            title="在 Finder 中显示该描述文件"
                            style={{ fontSize: 11 }}
                          >
                            Finder
                          </button>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleCopy(p.uuid, 'UUID')}
                            title="复制描述文件 UUID"
                            style={{ fontSize: 11 }}
                          >
                            复制 UUID
                          </button>
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => handleDelete(p)}
                            title="从本地删除"
                            style={{ color: 'var(--accent-red)', fontSize: 11 }}
                          >
                            删除
                          </button>
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => setExpandedProfileUuid(isExpanded ? null : p.uuid)}
                            style={{ fontSize: 11, gap: 4 }}
                          >
                            <span>{isExpanded ? '收起' : '详情'}</span>
                            <span>{isExpanded ? '▴' : '▾'}</span>
                          </button>
                        </div>
                      </div>

                      {/* Expanded Section */}
                      {isExpanded && (
                        <div
                          style={{
                            marginTop: 14,
                            paddingTop: 12,
                            borderTop: '1px solid var(--border)',
                            animation: 'fadeIn 150ms ease'
                          }}
                        >
                          {/* Inner Tabs */}
                          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                            <button
                              className={`btn btn-sm ${currentSubTab === 'devices' ? 'btn-primary' : 'btn-ghost'}`}
                              onClick={() =>
                                setProfileSubTab((prev) => ({ ...prev, [p.uuid]: 'devices' }))
                              }
                              style={{ fontSize: 11, height: 26 }}
                            >
                              📱 注册设备 ({devicesList.length})
                            </button>
                            <button
                              className={`btn btn-sm ${currentSubTab === 'entitlements' ? 'btn-primary' : 'btn-ghost'}`}
                              onClick={() =>
                                setProfileSubTab((prev) => ({ ...prev, [p.uuid]: 'entitlements' }))
                              }
                              style={{ fontSize: 11, height: 26 }}
                            >
                              🔐 权限 Entitlements ({Object.keys(p.entitlements || {}).length})
                            </button>
                            <button
                              className={`btn btn-sm ${currentSubTab === 'meta' ? 'btn-primary' : 'btn-ghost'}`}
                              onClick={() =>
                                setProfileSubTab((prev) => ({ ...prev, [p.uuid]: 'meta' }))
                              }
                              style={{ fontSize: 11, height: 26 }}
                            >
                              ℹ️ 完整路径与元数据
                            </button>
                          </div>

                          {/* Sub-tab 1: Devices */}
                          {currentSubTab === 'devices' && (
                            <div>
                              {p.provisionsAllDevices ? (
                                <div
                                  style={{
                                    fontSize: 12,
                                    color: 'var(--text-secondary)',
                                    padding: '8px 0'
                                  }}
                                >
                                  🏢 此描述文件为企业级 (ProvisionsAllDevices)，支持在所有合规 iOS
                                  设备上直接安装运行。
                                </div>
                              ) : devicesList.length === 0 ? (
                                <div
                                  style={{
                                    fontSize: 12,
                                    color: 'var(--text-muted)',
                                    padding: '8px 0'
                                  }}
                                >
                                  无注册设备（App Store 发布模式或未关联测试机）
                                </div>
                              ) : (
                                <div>
                                  <div
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'space-between',
                                      marginBottom: 8
                                    }}
                                  >
                                    <input
                                      type="text"
                                      placeholder="过滤此描述文件中的 UDID..."
                                      value={udidSearch}
                                      onChange={(e) => setUdidSearch(e.target.value)}
                                      className="input"
                                      style={{ width: 280, fontSize: 11, padding: '4px 8px' }}
                                    />
                                    <button
                                      className="btn btn-secondary btn-sm"
                                      onClick={() =>
                                        handleCopy(devicesList.join('\n'), '全部 UDID 列表')
                                      }
                                      style={{ fontSize: 11 }}
                                    >
                                      导出全部 UDID ({devicesList.length})
                                    </button>
                                  </div>

                                  <div
                                    style={{
                                      maxHeight: 180,
                                      overflowY: 'auto',
                                      background: 'var(--bg-elevated)',
                                      borderRadius: 'var(--radius-md)',
                                      padding: '8px 12px',
                                      display: 'grid',
                                      gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                                      gap: 6
                                    }}
                                  >
                                    {filteredDevices.map((udid) => (
                                      <div
                                        key={udid}
                                        style={{
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'space-between',
                                          padding: '3px 6px',
                                          borderRadius: 4,
                                          background: 'var(--bg-card)',
                                          fontSize: 11,
                                          fontFamily: 'monospace'
                                        }}
                                      >
                                        <span style={{ color: 'var(--text-secondary)' }}>
                                          {udid}
                                        </span>
                                        <button
                                          className="btn btn-ghost btn-icon btn-sm"
                                          onClick={() => handleCopy(udid, 'UDID')}
                                          title="复制此 UDID"
                                          style={{ padding: 2, height: 'auto' }}
                                        >
                                          📋
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Sub-tab 2: Entitlements */}
                          {currentSubTab === 'entitlements' && (
                            <div
                              style={{
                                maxHeight: 220,
                                overflowY: 'auto',
                                background: 'var(--bg-elevated)',
                                borderRadius: 'var(--radius-md)',
                                padding: 12,
                                fontSize: 11,
                                fontFamily: 'monospace'
                              }}
                            >
                              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <tbody>
                                  {Object.entries(p.entitlements || {}).map(([key, val]) => (
                                    <tr
                                      key={key}
                                      style={{ borderBottom: '1px solid var(--border)' }}
                                    >
                                      <td
                                        style={{
                                          padding: '6px 8px',
                                          color: 'var(--accent-blue)',
                                          width: '40%'
                                        }}
                                      >
                                        {key}
                                      </td>
                                      <td
                                        style={{ padding: '6px 8px', color: 'var(--text-primary)' }}
                                      >
                                        {typeof val === 'object'
                                          ? JSON.stringify(val)
                                          : String(val)}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}

                          {/* Sub-tab 3: Metadata */}
                          {currentSubTab === 'meta' && (
                            <div
                              style={{
                                fontSize: 11,
                                color: 'var(--text-secondary)',
                                lineHeight: 1.8
                              }}
                            >
                              <div>
                                <strong>UUID: </strong>
                                <code style={{ color: 'var(--accent-blue)' }}>{p.uuid}</code>
                              </div>
                              <div>
                                <strong>创建时间: </strong>
                                <span>
                                  {p.creationDate ? new Date(p.creationDate).toLocaleString() : '-'}
                                </span>
                              </div>
                              <div>
                                <strong>到期时间: </strong>
                                <span>
                                  {p.expirationDate
                                    ? new Date(p.expirationDate).toLocaleString()
                                    : '-'}
                                </span>
                              </div>
                              <div>
                                <strong>文件体积: </strong>
                                <span>{Math.round(p.fileSize / 1024)} KB</span>
                              </div>
                              <div>
                                <strong>本地存储路径: </strong>
                                <code style={{ wordBreak: 'break-all' }}>{p.filePath}</code>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ============================================== */}
        {/* TAB 2: Keychain 签名证书 (Certs) */}
        {/* ============================================== */}
        {activeTab === 'certs' && (
          <div>
            <div style={{ marginBottom: 16, fontSize: 12, color: 'var(--text-secondary)' }}>
              检测自当前 macOS 用户 Keychain 登录钥匙串中所有合法的代码签名身份 (Code Signing
              Identities)。
            </div>

            {certs.length === 0 ? (
              <div
                className="card"
                style={{ padding: 48, textAlign: 'center', color: 'var(--text-secondary)' }}
              >
                <div style={{ fontSize: 36, marginBottom: 12 }}>🔑</div>
                <div
                  style={{
                    fontSize: 15,
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                    marginBottom: 6
                  }}
                >
                  未在 Keychain 中检测到有效签名证书
                </div>
                <div style={{ fontSize: 12, maxWidth: 440, margin: '0 auto', lineHeight: 1.6 }}>
                  请在 Xcode → Settings → Accounts 中下载您的 Apple Developer
                  开发者证书，或在钥匙串访问中导入 .p12 证书
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {certs.map((c) => {
                  const isDist = c.type === 'distribution'
                  const isDevId = c.type === 'developer_id'

                  return (
                    <div
                      key={c.thumbprint}
                      className="card"
                      style={{
                        padding: '14px 18px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 16
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}
                        >
                          <span
                            style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}
                          >
                            {c.fullName}
                          </span>
                          <span
                            className="badge"
                            style={{
                              background: isDist
                                ? 'var(--accent-purple-dim)'
                                : isDevId
                                  ? 'var(--accent-amber-dim)'
                                  : 'var(--accent-blue-dim)',
                              color: isDist
                                ? 'var(--accent-purple)'
                                : isDevId
                                  ? 'var(--accent-amber)'
                                  : 'var(--accent-blue)',
                              fontSize: 10
                            }}
                          >
                            {isDist
                              ? 'Distribution (发布)'
                              : isDevId
                                ? 'Developer ID'
                                : 'Development (开发)'}
                          </span>
                        </div>

                        <div
                          style={{
                            fontSize: 11,
                            color: 'var(--text-muted)',
                            display: 'flex',
                            gap: 16
                          }}
                        >
                          <span>
                            指纹 SHA-1:{' '}
                            <code style={{ color: 'var(--text-secondary)' }}>{c.thumbprint}</code>
                          </span>
                          {c.teamOrUserId && (
                            <span>
                              Team/User ID: <strong>{c.teamOrUserId}</strong>
                            </span>
                          )}
                        </div>
                      </div>

                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleCopy(c.thumbprint, '证书指纹 SHA-1')}
                        style={{ fontSize: 11 }}
                      >
                        复制指纹
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

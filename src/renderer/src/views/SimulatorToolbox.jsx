/* eslint-disable react/prop-types */
import { useState, useEffect, useCallback, useMemo } from 'react'
import RealApnsPusher from '../components/RealApnsPusher'

const LOCATION_PRESETS = [
  { name: '北京 · 王府井', lat: '39.9087', lon: '116.4109', tag: '国内' },
  { name: '上海 · 陆家嘴', lat: '31.2397', lon: '121.5000', tag: '国内' },
  { name: '深圳 · 科技园', lat: '22.5401', lon: '113.9531', tag: '国内' },
  { name: '杭州 · 阿里西溪园区', lat: '30.2783', lon: '120.0242', tag: '国内' },
  { name: '硅谷 · Apple Park', lat: '37.3349', lon: '-122.0090', tag: '海外' },
  { name: '东京 · 涩谷', lat: '35.6580', lon: '139.7016', tag: '海外' },
  { name: '伦敦 · 塔桥', lat: '51.5055', lon: '-0.0754', tag: '海外' }
]

const PUSH_PRESETS = {
  basic: {
    name: '基础通知',
    title: '系统通知测试',
    body: '这是一条由 flyWork 发射的本地 APNs 模拟推送。',
    badge: 1,
    sound: 'default',
    customData: '{\n  "source": "flywork",\n  "click_action": "HOME"\n}'
  },
  deeplink: {
    name: '深链接跳转',
    title: '优惠券到账通知',
    body: '点击此通知以通过 Deep Link 唤起对应商品详情页。',
    badge: 3,
    sound: 'default',
    customData: '{\n  "url": "petpal://product/detail?id=8888",\n  "target_page": "promo"\n}'
  },
  silent: {
    name: '静默数据更新 (Background)',
    title: '',
    body: '',
    badge: 0,
    sound: '',
    customData: '{\n  "content-available": 1,\n  "sync_timestamp": 1725260000\n}'
  }
}

export default function SimulatorToolbox({ hideHeader = false }) {
  const [simulators, setSimulators] = useState([])
  const [physicalDevices, setPhysicalDevices] = useState([])
  const [loading, setLoading] = useState(false)
  const [selectedUdid, setSelectedUdid] = useState(null)
  const [deviceFilter, setDeviceFilter] = useState('all') // 'all' | 'physical' | 'simulator'
  const [activeTab, setActiveTab] = useState('push') // 'push' | 'location' | 'app' | 'url' | 'hardware'
  const [deviceSearch, setDeviceSearch] = useState('')
  const [toastMsg, setToastMsg] = useState('')

  // Push states
  const [pushMode, setPushMode] = useState('real') // 'real' | 'simctl'
  const [pushBundleId, setPushBundleId] = useState('com.example.app')
  const [pushTitle, setPushTitle] = useState('推送测试')
  const [pushBody, setPushBody] = useState('来自 flyWork 模拟器控制箱的即时消息')
  const [pushBadge, setPushBadge] = useState('1')
  const [pushSound, setPushSound] = useState('default')
  const [pushCustomJson, setPushCustomJson] = useState('{\n  "type": "test"\n}')
  const [isSendingPush, setIsSendingPush] = useState(false)

  // Location states
  const [lat, setLat] = useState('39.9087')
  const [lon, setLon] = useState('116.4109')

  // App & Sandbox & Launch states
  const [sandboxBundleId, setSandboxBundleId] = useState('com.example.app')
  const [launchBundleId, setLaunchBundleId] = useState('com.example.app')
  const [isInstalling, setIsInstalling] = useState(false)
  const [isLaunching, setIsLaunching] = useState(false)

  // URL & Clipboard states
  const [testUrl, setTestUrl] = useState('https://developer.apple.com')
  const [clipboardText, setClipboardText] = useState('')

  const showToast = useCallback((msg) => {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(''), 2500)
  }, [])

  // 1. Load simulator & physical devices
  const loadDevices = useCallback(async () => {
    setLoading(true)
    try {
      if (window.flywork?.simulatorList) {
        const res = await window.flywork.simulatorList()
        let sims = []
        let phys = []

        if (res && typeof res === 'object' && !Array.isArray(res)) {
          sims = Array.isArray(res.simulators) ? res.simulators : []
          phys = Array.isArray(res.physicalDevices) ? res.physicalDevices : []
        } else if (Array.isArray(res)) {
          sims = res
        }

        setSimulators(sims)
        setPhysicalDevices(phys)

        const all = [...phys, ...sims]
        if (all.length > 0) {
          setSelectedUdid((prev) => {
            if (prev && all.some((d) => d.udid === prev)) return prev
            // Priority: Online physical device > Booted simulator > first physical > first simulator
            const onlinePhys = phys.find((d) => d.state === 'Connected')
            if (onlinePhys) return onlinePhys.udid
            const bootedSim = sims.find((d) => d.state === 'Booted')
            if (bootedSim) return bootedSim.udid
            return all[0].udid
          })
        }
      }
    } catch (err) {
      console.error('Failed to load devices:', err)
      showToast('加载设备列表失败')
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    loadDevices()
  }, [loadDevices])

  const allDevices = useMemo(() => {
    return [...physicalDevices, ...simulators]
  }, [physicalDevices, simulators])

  const selectedDevice = useMemo(() => {
    return allDevices.find((d) => d.udid === selectedUdid) || null
  }, [allDevices, selectedUdid])

  useEffect(() => {
    if (selectedDevice?.isPhysical) {
      setPushMode('real')
    }
  }, [selectedDevice])

  // Actions
  const handleBoot = async (udid) => {
    showToast('正在启动模拟器...')
    try {
      const res = await window.flywork?.simulatorBoot(udid)
      if (res?.success) {
        showToast('模拟器已启动并打开')
        setTimeout(loadDevices, 1500)
      } else {
        showToast(`启动失败: ${res?.error || '未知错误'}`)
      }
    } catch (err) {
      showToast(`启动异常: ${err.message}`)
    }
  }

  const handleShutdown = async (udid) => {
    showToast('正在关闭模拟器...')
    try {
      const res = await window.flywork?.simulatorShutdown(udid)
      if (res?.success) {
        showToast('模拟器已关闭')
        setTimeout(loadDevices, 1000)
      } else {
        showToast(`关闭失败: ${res?.error || '未知错误'}`)
      }
    } catch (err) {
      showToast(`关闭异常: ${err.message}`)
    }
  }

  const handleRestart = async (udid) => {
    showToast('正在重启模拟器...')
    try {
      const res = await window.flywork?.simulatorRestart(udid)
      if (res?.success) {
        showToast('模拟器已重启')
        setTimeout(loadDevices, 2000)
      } else {
        showToast(`重启失败: ${res?.error || '未知错误'}`)
      }
    } catch (err) {
      showToast(`重启异常: ${err.message}`)
    }
  }

  const handleAppearance = async (udid, mode) => {
    try {
      const res = await window.flywork?.simulatorSetAppearance(udid, mode)
      if (res?.success) {
        showToast(`已切换至${mode === 'dark' ? '深色' : '浅色'}模式`)
      } else {
        showToast(`外观切换失败: ${res?.error || '请确保模拟器处于开机状态'}`)
      }
    } catch (err) {
      showToast(`外观切换异常: ${err.message}`)
    }
  }

  const handleSendPush = async () => {
    if (!selectedDevice) {
      showToast('请先在左侧选择目标设备')
      return
    }
    if (selectedDevice.isPhysical) {
      showToast('⚠️ 物理真机仅接受 Apple APNs 网关官方下发通知，无法本地伪造注入')
      return
    }
    if (selectedDevice.state !== 'Booted') {
      showToast('目标模拟器尚未开机，请先点击启动')
      return
    }
    if (!pushBundleId.trim()) {
      showToast('请输入 App Bundle ID')
      return
    }

    setIsSendingPush(true)
    try {
      let customDataObj = {}
      if (pushCustomJson.trim()) {
        try {
          customDataObj = JSON.parse(pushCustomJson)
        } catch {
          showToast('自定义 JSON 格式不合法')
          setIsSendingPush(false)
          return
        }
      }

      const payload = {
        SimulatorTargetBundle: pushBundleId.trim(),
        aps: {
          alert: {
            title: pushTitle,
            body: pushBody
          },
          badge: parseInt(pushBadge, 10) || 0,
          sound: pushSound || 'default'
        },
        ...customDataObj
      }

      const res = await window.flywork?.simulatorPush(
        selectedDevice.udid,
        pushBundleId.trim(),
        payload
      )
      if (res?.success) {
        showToast('✓ 模拟推送已发射成功！请在模拟器中查看横幅通知')
      } else {
        showToast(`推送失败: ${res?.error || '请确认 Bundle ID 是否正确'}`)
      }
    } catch (err) {
      showToast(`推送异常: ${err.message}`)
    } finally {
      setIsSendingPush(false)
    }
  }

  const handleSetLocation = async (latitude, longitude) => {
    if (!selectedDevice) return
    if (selectedDevice.isPhysical) {
      showToast('⚠️ 物理真机模拟定位需在 Xcode 或接入调试隧道时生效')
      return
    }
    try {
      const res = await window.flywork?.simulatorSetLocation(
        selectedDevice.udid,
        latitude,
        longitude
      )
      if (res?.success) {
        showToast(`✓ 已成功注入 GPS 坐标: (${latitude}, ${longitude})`)
      } else {
        showToast(`定位注入失败: ${res?.error || '需模拟器处于开机状态'}`)
      }
    } catch (err) {
      showToast(`定位注入异常: ${err.message}`)
    }
  }

  const handleClearLocation = async () => {
    if (!selectedDevice) return
    try {
      await window.flywork?.simulatorClearLocation(selectedDevice.udid)
      showToast('已清除模拟定位')
    } catch (err) {
      showToast(`清除失败: ${err.message}`)
    }
  }

  const handleOpenSandbox = async () => {
    if (!selectedDevice) return
    if (selectedDevice.isPhysical) {
      showToast('⚠️ 物理真机受 iOS 安全沙盒保护，无法直接在 Mac Finder 中打开本地目录')
      return
    }
    if (!sandboxBundleId.trim()) {
      showToast('请输入 App Bundle ID')
      return
    }
    try {
      const res = await window.flywork?.simulatorGetAppContainer(
        selectedDevice.udid,
        sandboxBundleId.trim()
      )
      if (res?.success) {
        showToast('已在 Finder 中打开应用沙盒数据目录')
      } else {
        showToast(res?.error || '打开沙盒失败')
      }
    } catch (err) {
      showToast(`沙盒打开失败: ${err.message}`)
    }
  }

  const handleLaunchApp = async () => {
    if (!selectedDevice) return
    if (!launchBundleId.trim()) {
      showToast('请输入 Bundle ID')
      return
    }
    setIsLaunching(true)
    showToast(`正在唤起应用 [${launchBundleId.trim()}]...`)
    try {
      const res = await window.flywork?.deviceLaunchApp?.(
        selectedDevice.udid,
        launchBundleId.trim(),
        selectedDevice.isPhysical
      )
      if (res?.success) {
        showToast(`✓ 应用已成功拉起运行`)
      } else {
        showToast(`启动失败: ${res?.error || '应用可能未安装或处于锁屏状态'}`)
      }
    } catch (err) {
      showToast(`启动异常: ${err.message}`)
    } finally {
      setIsLaunching(false)
    }
  }

  const handleOpenUrl = async () => {
    if (!selectedDevice || !testUrl.trim()) return
    if (selectedDevice.isPhysical) {
      showToast('⚠️ 物理真机 URL 唤起仅在连接且解除锁屏时生效')
    }
    try {
      const res = await window.flywork?.simulatorOpenUrl(selectedDevice.udid, testUrl.trim())
      if (res?.success) {
        showToast('已在设备中打开 URL')
      } else {
        showToast(`打开失败: ${res?.error || '请确保设备在线且处于解锁状态'}`)
      }
    } catch (err) {
      showToast(`打开异常: ${err.message}`)
    }
  }

  const handleSetClipboard = async () => {
    if (!selectedDevice || !clipboardText) return
    try {
      const res = await window.flywork?.simulatorSetClipboard(selectedDevice.udid, clipboardText)
      if (res?.success) {
        showToast('已写入模拟器剪贴板')
      } else {
        showToast(`写入失败: ${res?.error}`)
      }
    } catch (err) {
      showToast(`剪贴板同步异常: ${err.message}`)
    }
  }

  const handleCopy = (text, label) => {
    if (!text) return
    navigator.clipboard.writeText(text)
    showToast(`已复制 ${label || '内容'} 到剪贴板`)
  }

  // Filtered devices
  const filteredPhysicalDevices = useMemo(() => {
    const q = deviceSearch.toLowerCase().trim()
    return physicalDevices.filter((d) => {
      if (!q) return true
      return (
        d.name.toLowerCase().includes(q) ||
        d.marketingName.toLowerCase().includes(q) ||
        d.udid.toLowerCase().includes(q)
      )
    })
  }, [physicalDevices, deviceSearch])

  const filteredSimulators = useMemo(() => {
    const q = deviceSearch.toLowerCase().trim()
    return simulators.filter((d) => {
      if (!q) return true
      return d.name.toLowerCase().includes(q) || d.runtime.toLowerCase().includes(q)
    })
  }, [simulators, deviceSearch])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
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

      {/* Page Header */}
      {!hideHeader ? (
        <div
          className="page-header"
          style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>📱</span>
                <span>iOS 设备与模拟器控制箱</span>
              </div>
              <div className="page-subtitle">
                物理真机与虚拟机状态监控、APNs 模拟推送、GPS 定位 Mock、安装包部署与沙盒穿透
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="btn btn-secondary btn-sm"
                onClick={loadDevices}
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
                <span>{loading ? '刷新中' : '刷新设备'}</span>
              </button>
              <button
                className="btn btn-secondary btn-sm"
                onClick={async () => {
                  try {
                    await window.flywork?.simulatorOpenApp?.()
                  } catch {
                    showToast('无法唤起 Simulator App')
                  }
                }}
                style={{ gap: 6 }}
              >
                <span>🖥️</span>
                <span>唤起 Simulator</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div
          style={{
            padding: '8px 20px',
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
            已发现 <strong>{physicalDevices.length}</strong> 台物理真机，
            <strong>{simulators.length}</strong> 台 iOS 模拟器
          </span>
          <button
            className="btn btn-secondary btn-sm"
            onClick={loadDevices}
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
            <span>{loading ? '扫描中' : '刷新设备'}</span>
          </button>
          <button
            className="btn btn-secondary btn-sm"
            onClick={async () => {
              try {
                await window.flywork?.simulatorOpenApp?.()
              } catch {
                showToast('无法唤起 Simulator App')
              }
            }}
            style={{ gap: 6, fontSize: 11, height: 26 }}
          >
            <span>🖥️</span>
            <span>唤起 Simulator</span>
          </button>
        </div>
      )}

      {/* Main Split Layout */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* ===================================== */}
        {/* Left Side: Device Selection & Power */}
        {/* ===================================== */}
        <div
          style={{
            width: 320,
            borderRight: '1px solid var(--border)',
            display: 'flex',
            flexDirection: 'column',
            background: 'var(--bg-sidebar)'
          }}
        >
          {/* Search bar & Type filter */}
          <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>
            <div className="quick-input" style={{ padding: '4px 8px', marginBottom: 8 }}>
              <input
                placeholder="按名称、型号或系统过滤..."
                value={deviceSearch}
                onChange={(e) => setDeviceSearch(e.target.value)}
                style={{ fontSize: 11 }}
              />
            </div>

            {/* Segmented filter */}
            <div style={{ display: 'flex', gap: 4 }}>
              {[
                { id: 'all', label: `全部 (${allDevices.length})` },
                { id: 'physical', label: `📲 真机 (${physicalDevices.length})` },
                { id: 'simulator', label: `📱 模拟器 (${simulators.length})` }
              ].map((f) => (
                <button
                  key={f.id}
                  className={`btn btn-sm ${deviceFilter === f.id ? 'btn-secondary' : 'btn-ghost'}`}
                  onClick={() => setDeviceFilter(f.id)}
                  style={{
                    flex: 1,
                    fontSize: 10,
                    padding: '2px 4px',
                    height: 22,
                    borderColor: deviceFilter === f.id ? 'var(--accent-blue)' : 'transparent'
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Device list grouped */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '8px 10px' }}>
            {/* Group 1: 物理真机 (Physical Devices) */}
            {(deviceFilter === 'all' || deviceFilter === 'physical') && (
              <div style={{ marginBottom: 12 }}>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: 'var(--text-muted)',
                    padding: '4px 6px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4
                  }}
                >
                  <span>📲</span>
                  <span>物理真机 ({filteredPhysicalDevices.length})</span>
                </div>

                {filteredPhysicalDevices.length === 0 ? (
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', padding: '6px 8px' }}>
                    未检测到配对真机 (可通过 USB 连接 iPhone)
                  </div>
                ) : (
                  filteredPhysicalDevices.map((dev) => {
                    const isSelected = selectedUdid === dev.udid
                    const isOnline = dev.state === 'Connected'

                    return (
                      <div
                        key={dev.udid}
                        onClick={() => setSelectedUdid(dev.udid)}
                        style={{
                          padding: '8px 10px',
                          borderRadius: 'var(--radius-md)',
                          marginBottom: 4,
                          cursor: 'pointer',
                          background: isSelected ? 'var(--bg-elevated)' : 'transparent',
                          border: isSelected
                            ? '1px solid var(--accent-blue)'
                            : '1px solid transparent',
                          transition: 'all 120ms ease'
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            marginBottom: 2
                          }}
                        >
                          <span
                            style={{
                              fontSize: 12,
                              fontWeight: isSelected ? 600 : 500,
                              color: 'var(--text-primary)'
                            }}
                          >
                            {dev.name}
                          </span>
                          {isOnline ? (
                            <span
                              className="badge"
                              style={{
                                background: 'var(--accent-green-dim)',
                                color: 'var(--accent-green)',
                                fontSize: 9,
                                padding: '1px 5px'
                              }}
                            >
                              ● 在线
                            </span>
                          ) : (
                            <span
                              className="badge badge-gray"
                              style={{ fontSize: 9, padding: '1px 5px' }}
                            >
                              已配对
                            </span>
                          )}
                        </div>

                        <div
                          style={{
                            fontSize: 10,
                            color: 'var(--text-secondary)',
                            display: 'flex',
                            gap: 6
                          }}
                        >
                          <span>{dev.marketingName}</span>
                          {dev.osVersion && <span>· iOS {dev.osVersion}</span>}
                          {dev.developerMode === 'enabled' && (
                            <span style={{ color: 'var(--accent-teal)', marginLeft: 'auto' }}>
                              DevMode✓
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            )}

            {/* Group 2: iOS 模拟器 (Simulators) */}
            {(deviceFilter === 'all' || deviceFilter === 'simulator') && (
              <div>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: 'var(--text-muted)',
                    padding: '4px 6px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4
                  }}
                >
                  <span>📱</span>
                  <span>iOS 模拟器 ({filteredSimulators.length})</span>
                </div>

                {filteredSimulators.length === 0 ? (
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', padding: '6px 8px' }}>
                    无匹配模拟器
                  </div>
                ) : (
                  filteredSimulators.map((dev) => {
                    const isSelected = selectedUdid === dev.udid
                    const isBooted = dev.state === 'Booted'

                    return (
                      <div
                        key={dev.udid}
                        onClick={() => setSelectedUdid(dev.udid)}
                        style={{
                          padding: '8px 10px',
                          borderRadius: 'var(--radius-md)',
                          marginBottom: 4,
                          cursor: 'pointer',
                          background: isSelected ? 'var(--bg-elevated)' : 'transparent',
                          border: isSelected
                            ? '1px solid var(--accent-blue)'
                            : '1px solid transparent',
                          transition: 'all 120ms ease'
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            marginBottom: 2
                          }}
                        >
                          <span
                            style={{
                              fontSize: 12,
                              fontWeight: isSelected ? 600 : 500,
                              color: 'var(--text-primary)'
                            }}
                          >
                            {dev.name}
                          </span>
                          {isBooted ? (
                            <span
                              className="badge"
                              style={{
                                background: 'var(--accent-green-dim)',
                                color: 'var(--accent-green)',
                                fontSize: 9,
                                padding: '1px 5px'
                              }}
                            >
                              ● 运行中
                            </span>
                          ) : (
                            <span
                              className="badge badge-gray"
                              style={{ fontSize: 9, padding: '1px 5px' }}
                            >
                              关机
                            </span>
                          )}
                        </div>

                        <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>
                          <span>{dev.runtime}</span>
                          {dev.deviceType && (
                            <span style={{ color: 'var(--text-muted)' }}> · {dev.deviceType}</span>
                          )}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            )}
          </div>

          {/* Selected Device Controls Footer */}
          {selectedDevice && (
            <div
              style={{
                padding: '12px 14px',
                borderTop: '1px solid var(--border)',
                background: 'var(--bg-card)'
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 6
                }}
              >
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>当前选中设备:</span>
                <span
                  className="badge"
                  style={{
                    background: selectedDevice.isPhysical
                      ? 'var(--accent-purple-dim)'
                      : 'var(--accent-blue-dim)',
                    color: selectedDevice.isPhysical
                      ? 'var(--accent-purple)'
                      : 'var(--accent-blue)',
                    fontSize: 9
                  }}
                >
                  {selectedDevice.isPhysical ? '物理真机' : 'iOS 模拟器'}
                </span>
              </div>

              <div
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  marginBottom: 2
                }}
              >
                {selectedDevice.name}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 10 }}>
                {selectedDevice.marketingName || selectedDevice.runtime} ·{' '}
                {selectedDevice.osVersion
                  ? `iOS ${selectedDevice.osVersion}`
                  : selectedDevice.state}
              </div>

              {/* Controls specific to Simulator vs Physical */}
              {selectedDevice.isPhysical ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleCopy(selectedDevice.udid, '真机 UDID')}
                    style={{ fontSize: 11, gap: 4 }}
                  >
                    <span>📋</span>
                    <span>复制硬件 UDID</span>
                  </button>
                </div>
              ) : (
                <>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: 6,
                      marginBottom: 6
                    }}
                  >
                    {selectedDevice.state === 'Booted' ? (
                      <>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleShutdown(selectedDevice.udid)}
                          style={{ fontSize: 11, color: 'var(--accent-red)' }}
                        >
                          ⏹ 关闭
                        </button>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleRestart(selectedDevice.udid)}
                          style={{ fontSize: 11 }}
                        >
                          🔄 重启
                        </button>
                      </>
                    ) : (
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => handleBoot(selectedDevice.udid)}
                        style={{ gridColumn: 'span 2', fontSize: 12 }}
                      >
                        ▶ 启动模拟器
                      </button>
                    )}
                  </div>

                  {selectedDevice.state === 'Booted' && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => handleAppearance(selectedDevice.udid, 'dark')}
                        style={{ fontSize: 11 }}
                      >
                        🌙 深色
                      </button>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => handleAppearance(selectedDevice.udid, 'light')}
                        style={{ fontSize: 11 }}
                      >
                        ☀️ 浅色
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* ===================================== */}
        {/* Right Side: Function Toolset Tabs */}
        {/* ===================================== */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Tab Sub-Header */}
          <div
            style={{
              padding: '10px 20px',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              gap: 8,
              background: 'var(--bg-card)'
            }}
          >
            {[
              {
                id: 'app',
                label: selectedDevice?.isPhysical ? '📦 应用安装与唤起' : '📦 沙盒与应用'
              },
              { id: 'push', label: '🔔 APNs 模拟推送' },
              { id: 'location', label: '📍 定位模拟 (Mock)' },
              { id: 'url', label: '🔗 快捷链接与剪贴板' },
              ...(selectedDevice?.isPhysical
                ? [{ id: 'hardware', label: 'ℹ️ 硬件与系统信息' }]
                : [])
            ].map((t) => {
              const isCur = activeTab === t.id
              return (
                <button
                  key={t.id}
                  className={`btn btn-sm ${isCur ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => setActiveTab(t.id)}
                  style={{ fontSize: 12 }}
                >
                  {t.label}
                </button>
              )
            })}
          </div>

          {/* Notice banner if selecting Location on Physical Device */}
          {selectedDevice?.isPhysical && activeTab === 'location' && (
            <div
              style={{
                margin: '16px 24px 0 24px',
                padding: '10px 14px',
                background: 'rgba(210, 153, 34, 0.12)',
                border: '1px solid rgba(210, 153, 34, 0.3)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--accent-amber)',
                fontSize: 12,
                lineHeight: 1.5
              }}
            >
              <strong>💡 物理真机环境提示：</strong> 物理真机系统级 GPS 注入需通过 Xcode
              运行模式或特定调试描述文件注入。如需即时测试坐标逻辑，推荐在左侧选取一台「iOS
              模拟器」。
            </div>
          )}

          {/* Tab Content Box */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
            {/* ------------------------------------------- */}
            {/* Tab: 应用管理 (沙盒 / 安装 / 唤起) */}
            {/* ------------------------------------------- */}
            {activeTab === 'app' && (
              <div style={{ maxWidth: 640 }}>
                {/* Physical Device: Launch App */}
                {selectedDevice?.isPhysical && (
                  <div className="card" style={{ padding: 18, marginBottom: 16 }}>
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 600,
                        marginBottom: 8,
                        color: 'var(--text-primary)'
                      }}
                    >
                      🚀 唤起真机应用 (Process Launch)
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12 }}>
                      通过苹果 CoreDevice 在已解锁的 iPhone 上直接远程启动指定 Bundle ID 的应用。
                    </div>

                    <div style={{ display: 'flex', gap: 10 }}>
                      <input
                        type="text"
                        className="input"
                        value={launchBundleId}
                        onChange={(e) => setLaunchBundleId(e.target.value)}
                        placeholder="例如: com.example.petpal"
                        style={{ flex: 1, fontSize: 12 }}
                      />
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={handleLaunchApp}
                        disabled={isLaunching}
                        style={{ height: 32 }}
                      >
                        {isLaunching ? '启动中...' : '启动应用'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Simulator only: Sandbox Container Opener */}
                {!selectedDevice?.isPhysical && (
                  <div className="card" style={{ padding: 18, marginBottom: 16 }}>
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 600,
                        marginBottom: 8,
                        color: 'var(--text-primary)'
                      }}
                    >
                      📂 穿透打开 App 沙盒数据目录 (Sandbox Container)
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: 'var(--text-secondary)',
                        marginBottom: 12,
                        lineHeight: 1.5
                      }}
                    >
                      直接在 macOS Finder 中打开该应用沙盒目录，快速排查 <code>Documents</code>、
                      <code>Library/Caches</code> 及 <code>Preferences</code> 内部文件。
                    </div>

                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      <input
                        type="text"
                        className="input"
                        value={sandboxBundleId}
                        onChange={(e) => setSandboxBundleId(e.target.value)}
                        placeholder="输入 App Bundle ID (如 com.example.app)"
                        style={{ flex: 1, fontSize: 12 }}
                      />
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={handleOpenSandbox}
                        style={{ height: 32, fontSize: 12 }}
                      >
                        在 Finder 中定位
                      </button>
                    </div>
                  </div>
                )}

                {/* Universal: Drag and Drop Install App (.app or .ipa) */}
                <div className="card" style={{ padding: 18 }}>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      marginBottom: 8,
                      color: 'var(--text-primary)'
                    }}
                  >
                    📦 安装包快速安装 ({selectedDevice?.isPhysical ? '.ipa / .app' : '.app'})
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12 }}>
                    将构建好的{' '}
                    {selectedDevice?.isPhysical
                      ? 'iOS 签名安装包 (.ipa / .app)'
                      : '模拟器编译产物 (.app)'}{' '}
                    拖入此区域，直接部署至 <strong>{selectedDevice?.name || '当前设备'}</strong>。
                  </div>

                  <div
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={async (e) => {
                      e.preventDefault()
                      const files = e.dataTransfer.files
                      if (!files || files.length === 0) return
                      const file = files[0]
                      let filePath = file.path
                      if (!filePath && window.flywork?.getPathForFile) {
                        filePath = window.flywork.getPathForFile(file)
                      }
                      if (filePath && selectedDevice) {
                        setIsInstalling(true)
                        showToast(`正在向 ${selectedDevice.name} 安装应用...`)
                        try {
                          const res = await window.flywork?.simulatorInstallApp(
                            selectedDevice.udid,
                            filePath,
                            selectedDevice.isPhysical
                          )
                          if (res?.success) {
                            showToast(`✓ 应用已成功安装至 ${selectedDevice.name}！`)
                          } else {
                            showToast(`安装失败: ${res?.error || '签名或架构不兼容'}`)
                          }
                        } catch (err) {
                          showToast(`安装异常: ${err.message}`)
                        } finally {
                          setIsInstalling(false)
                        }
                      }
                    }}
                    style={{
                      border: '2px dashed var(--border)',
                      borderRadius: 'var(--radius-md)',
                      padding: 28,
                      textAlign: 'center',
                      background: 'var(--bg-elevated)'
                    }}
                  >
                    <div style={{ fontSize: 28, marginBottom: 6 }}>⬇️</div>
                    <div style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 500 }}>
                      {isInstalling
                        ? '正在部署安装中...'
                        : `拖拽 ${selectedDevice?.isPhysical ? '.ipa' : '.app'} 安装包至此处直接安装`}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ------------------------------------------- */}
            {/* Tab: APNs 推送调试 (双模: 真实 APNs / 模拟器伪造) */}
            {/* ------------------------------------------- */}
            {activeTab === 'push' && (
              <div style={{ maxWidth: 680 }}>
                {/* Push Mode Switcher */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 16,
                    padding: '4px',
                    background: 'var(--bg-elevated)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border)'
                  }}
                >
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button
                      className={`btn btn-sm ${pushMode === 'real' ? 'btn-primary' : 'btn-ghost'}`}
                      onClick={() => setPushMode('real')}
                      style={{ fontSize: 12, height: 28, gap: 6 }}
                    >
                      <span>📲</span>
                      <span>真实 APNs 远程推送 (SmartPush 模式)</span>
                    </button>
                    <button
                      className={`btn btn-sm ${pushMode === 'simctl' ? 'btn-primary' : 'btn-ghost'}`}
                      onClick={() => setPushMode('simctl')}
                      disabled={selectedDevice?.isPhysical}
                      style={{ fontSize: 12, height: 28, gap: 6 }}
                    >
                      <span>📱</span>
                      <span>模拟器本地伪造推送 (simctl)</span>
                    </button>
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', paddingRight: 8 }}>
                    {selectedDevice?.isPhysical
                      ? '📲 物理真机直连 Apple APNs 官方网关'
                      : pushMode === 'real'
                        ? '直连 Apple APNs 官方网关'
                        : '本地注入横幅，免证书'}
                  </span>
                </div>

                {pushMode === 'real' ? (
                  <RealApnsPusher defaultBundleId={pushBundleId} showToast={showToast} />
                ) : (
                  <div>
                    {/* Presets Row */}
                    <div style={{ marginBottom: 16 }}>
                      <label
                        style={{
                          display: 'block',
                          fontSize: 12,
                          fontWeight: 500,
                          marginBottom: 8,
                          color: 'var(--text-secondary)'
                        }}
                      >
                        快捷模版预设
                      </label>
                      <div style={{ display: 'flex', gap: 8 }}>
                        {Object.entries(PUSH_PRESETS).map(([k, p]) => (
                          <button
                            key={k}
                            className="btn btn-secondary btn-sm"
                            onClick={() => {
                              setPushTitle(p.title)
                              setPushBody(p.body)
                              setPushBadge(String(p.badge))
                              setPushSound(p.sound)
                              setPushCustomJson(p.customData)
                              showToast(`已载入模版: ${p.name}`)
                            }}
                            style={{ fontSize: 11 }}
                          >
                            {p.name}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="card" style={{ padding: 18, marginBottom: 16 }}>
                      <div style={{ marginBottom: 12 }}>
                        <label
                          style={{
                            display: 'block',
                            fontSize: 12,
                            fontWeight: 500,
                            marginBottom: 6
                          }}
                        >
                          目标应用 Bundle Identifier{' '}
                          <span style={{ color: 'var(--accent-red)' }}>*</span>
                        </label>
                        <input
                          type="text"
                          className="input"
                          value={pushBundleId}
                          onChange={(e) => setPushBundleId(e.target.value)}
                          placeholder="例如: com.example.petpal"
                          style={{ width: '100%', fontSize: 12 }}
                        />
                      </div>

                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '1fr 1fr',
                          gap: 12,
                          marginBottom: 12
                        }}
                      >
                        <div>
                          <label
                            style={{
                              display: 'block',
                              fontSize: 12,
                              fontWeight: 500,
                              marginBottom: 6
                            }}
                          >
                            通知标题 (Title)
                          </label>
                          <input
                            type="text"
                            className="input"
                            value={pushTitle}
                            onChange={(e) => setPushTitle(e.target.value)}
                            placeholder="推送主标题"
                            style={{ width: '100%', fontSize: 12 }}
                          />
                        </div>
                        <div>
                          <label
                            style={{
                              display: 'block',
                              fontSize: 12,
                              fontWeight: 500,
                              marginBottom: 6
                            }}
                          >
                            应用角标数字 (Badge)
                          </label>
                          <input
                            type="number"
                            className="input"
                            value={pushBadge}
                            onChange={(e) => setPushBadge(e.target.value)}
                            placeholder="1"
                            style={{ width: '100%', fontSize: 12 }}
                          />
                        </div>
                      </div>

                      <div style={{ marginBottom: 12 }}>
                        <label
                          style={{
                            display: 'block',
                            fontSize: 12,
                            fontWeight: 500,
                            marginBottom: 6
                          }}
                        >
                          通知正文 (Body)
                        </label>
                        <textarea
                          className="input"
                          value={pushBody}
                          onChange={(e) => setPushBody(e.target.value)}
                          rows={2}
                          placeholder="通知详细文案..."
                          style={{ width: '100%', fontSize: 12, resize: 'vertical' }}
                        />
                      </div>

                      <div style={{ marginBottom: 16 }}>
                        <label
                          style={{
                            display: 'block',
                            fontSize: 12,
                            fontWeight: 500,
                            marginBottom: 6
                          }}
                        >
                          自定义 Payload 扩展数据 (JSON 字典)
                        </label>
                        <textarea
                          className="input"
                          value={pushCustomJson}
                          onChange={(e) => setPushCustomJson(e.target.value)}
                          rows={4}
                          style={{
                            width: '100%',
                            fontSize: 11,
                            fontFamily: 'monospace',
                            resize: 'vertical'
                          }}
                        />
                      </div>

                      <button
                        className="btn btn-primary btn-sm"
                        onClick={handleSendPush}
                        disabled={isSendingPush || !selectedDevice || selectedDevice.isPhysical}
                        style={{ width: '100%', height: 34, fontSize: 13, gap: 6 }}
                      >
                        <span>🚀</span>
                        <span>{isSendingPush ? '正在推送...' : '向选中模拟器发射本地推送'}</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ------------------------------------------- */}
            {/* Tab: 定位模拟 (Mock Location) */}
            {/* ------------------------------------------- */}
            {activeTab === 'location' && (
              <div style={{ maxWidth: 640 }}>
                {/* City Preset Buttons */}
                <div style={{ marginBottom: 16 }}>
                  <label
                    style={{
                      display: 'block',
                      fontSize: 12,
                      fontWeight: 500,
                      marginBottom: 8,
                      color: 'var(--text-secondary)'
                    }}
                  >
                    常用城市坐标一键应用
                  </label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {LOCATION_PRESETS.map((p) => (
                      <button
                        key={p.name}
                        className="btn btn-secondary btn-sm"
                        disabled={selectedDevice?.isPhysical}
                        onClick={() => {
                          setLat(p.lat)
                          setLon(p.lon)
                          handleSetLocation(p.lat, p.lon)
                        }}
                        style={{ fontSize: 11 }}
                      >
                        {p.name}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="card" style={{ padding: 18 }}>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: 12,
                      marginBottom: 16
                    }}
                  >
                    <div>
                      <label
                        style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 6 }}
                      >
                        纬度 (Latitude)
                      </label>
                      <input
                        type="text"
                        className="input"
                        value={lat}
                        onChange={(e) => setLat(e.target.value)}
                        placeholder="例如: 39.9087"
                        style={{ width: '100%', fontSize: 12 }}
                      />
                    </div>
                    <div>
                      <label
                        style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 6 }}
                      >
                        经度 (Longitude)
                      </label>
                      <input
                        type="text"
                        className="input"
                        value={lon}
                        onChange={(e) => setLon(e.target.value)}
                        placeholder="例如: 116.4109"
                        style={{ width: '100%', fontSize: 12 }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 10 }}>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => handleSetLocation(lat, lon)}
                      disabled={selectedDevice?.isPhysical}
                      style={{ flex: 1, height: 32 }}
                    >
                      📍 注入模拟定位
                    </button>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={handleClearLocation}
                      disabled={selectedDevice?.isPhysical}
                      style={{ height: 32 }}
                    >
                      清除模拟定位
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ------------------------------------------- */}
            {/* Tab: 快捷链接与剪贴板 */}
            {/* ------------------------------------------- */}
            {activeTab === 'url' && (
              <div style={{ maxWidth: 640 }}>
                {/* URL Opener */}
                <div className="card" style={{ padding: 18, marginBottom: 16 }}>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      marginBottom: 8,
                      color: 'var(--text-primary)'
                    }}
                  >
                    🌐 唤起 URL / Universal Link / Scheme
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12 }}>
                    在设备中唤起指定协议或网页，支持调试通用链接跳转与自定义 URL Scheme。
                  </div>

                  <div style={{ display: 'flex', gap: 10 }}>
                    <input
                      type="text"
                      className="input"
                      value={testUrl}
                      onChange={(e) => setTestUrl(e.target.value)}
                      placeholder="例如: https://... 或 petpal://..."
                      style={{ flex: 1, fontSize: 12 }}
                    />
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={handleOpenUrl}
                      style={{ height: 32 }}
                    >
                      唤起跳转
                    </button>
                  </div>
                </div>

                {/* Clipboard (Simulators only) */}
                {!selectedDevice?.isPhysical && (
                  <div className="card" style={{ padding: 18 }}>
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 600,
                        marginBottom: 8,
                        color: 'var(--text-primary)'
                      }}
                    >
                      📋 同步至模拟器剪贴板 (pbcopy)
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12 }}>
                      输入长文本、复杂 Token 或
                      JSON，直接推入模拟器剪切板，无需在模拟器键盘上手动输入。
                    </div>

                    <textarea
                      className="input"
                      value={clipboardText}
                      onChange={(e) => setClipboardText(e.target.value)}
                      rows={3}
                      placeholder="粘贴或输入想要写入模拟器剪贴板的文本..."
                      style={{ width: '100%', fontSize: 12, marginBottom: 10, resize: 'vertical' }}
                    />

                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={handleSetClipboard}
                      disabled={!clipboardText}
                      style={{ height: 32 }}
                    >
                      写入模拟器剪贴板
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ------------------------------------------- */}
            {/* Tab: 真机硬件规格与系统信息 */}
            {/* ------------------------------------------- */}
            {activeTab === 'hardware' && selectedDevice?.isPhysical && (
              <div style={{ maxWidth: 640 }}>
                <div className="card" style={{ padding: 18, marginBottom: 16 }}>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      marginBottom: 12,
                      color: 'var(--text-primary)'
                    }}
                  >
                    📲 物理真机硬件规格与 CoreDevice 状态
                  </div>

                  <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                    <tbody>
                      <tr style={{ borderBottom: '1px solid var(--border)' }}>
                        <td
                          style={{ padding: '8px 4px', color: 'var(--text-muted)', width: '35%' }}
                        >
                          设备名称
                        </td>
                        <td
                          style={{
                            padding: '8px 4px',
                            fontWeight: 600,
                            color: 'var(--text-primary)'
                          }}
                        >
                          {selectedDevice.name}
                        </td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '8px 4px', color: 'var(--text-muted)' }}>市场型号</td>
                        <td style={{ padding: '8px 4px', color: 'var(--text-primary)' }}>
                          {selectedDevice.marketingName}
                        </td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '8px 4px', color: 'var(--text-muted)' }}>
                          iOS 系统版本
                        </td>
                        <td style={{ padding: '8px 4px', color: 'var(--text-primary)' }}>
                          iOS {selectedDevice.osVersion}{' '}
                          {selectedDevice.osBuild ? `(${selectedDevice.osBuild})` : ''}
                        </td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '8px 4px', color: 'var(--text-muted)' }}>
                          设备硬件 UDID
                        </td>
                        <td style={{ padding: '8px 4px', fontFamily: 'monospace' }}>
                          <span style={{ color: 'var(--accent-blue)' }}>{selectedDevice.udid}</span>
                          <button
                            className="btn btn-ghost btn-icon btn-sm"
                            onClick={() => handleCopy(selectedDevice.udid, 'UDID')}
                            style={{ marginLeft: 6, padding: 2, height: 'auto' }}
                          >
                            📋
                          </button>
                        </td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '8px 4px', color: 'var(--text-muted)' }}>
                          序列号 (Serial)
                        </td>
                        <td
                          style={{
                            padding: '8px 4px',
                            fontFamily: 'monospace',
                            color: 'var(--text-secondary)'
                          }}
                        >
                          {selectedDevice.serialNumber || '-'}
                        </td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '8px 4px', color: 'var(--text-muted)' }}>
                          硬件标识 (ECID)
                        </td>
                        <td
                          style={{
                            padding: '8px 4px',
                            fontFamily: 'monospace',
                            color: 'var(--text-secondary)'
                          }}
                        >
                          {selectedDevice.ecid || '-'}
                        </td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '8px 4px', color: 'var(--text-muted)' }}>
                          开发者模式 (Developer Mode)
                        </td>
                        <td style={{ padding: '8px 4px' }}>
                          {selectedDevice.developerMode === 'enabled' ? (
                            <span
                              className="badge"
                              style={{
                                background: 'var(--accent-green-dim)',
                                color: 'var(--accent-green)'
                              }}
                            >
                              已开启 (Enabled)
                            </span>
                          ) : (
                            <span
                              className="badge"
                              style={{
                                background: 'var(--accent-amber-dim)',
                                color: 'var(--accent-amber)'
                              }}
                            >
                              未开启 (请在真机设置 → 隐私与安全性开启)
                            </span>
                          )}
                        </td>
                      </tr>
                      <tr>
                        <td style={{ padding: '8px 4px', color: 'var(--text-muted)' }}>
                          连接状态 (Tunnel)
                        </td>
                        <td style={{ padding: '8px 4px' }}>
                          {selectedDevice.state === 'Connected' ? (
                            <span
                              className="badge"
                              style={{
                                background: 'var(--accent-green-dim)',
                                color: 'var(--accent-green)'
                              }}
                            >
                              ● 在线连接 (Connected via CoreDevice)
                            </span>
                          ) : (
                            <span className="badge badge-gray">已配对 (离线 / 待唤醒)</span>
                          )}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Quick Link to Provisioning */}
                <div
                  style={{
                    padding: '12px 16px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border)',
                    background: 'var(--bg-elevated)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}
                >
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    💡 想确认本地描述文件是否包含该设备？一键复制 UDID 到「描述文件与证书」中查询
                  </div>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleCopy(selectedDevice.udid, '真机 UDID')}
                    style={{ fontSize: 11, flexShrink: 0, marginLeft: 12 }}
                  >
                    复制该设备 UDID
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

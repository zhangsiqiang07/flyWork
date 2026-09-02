/* eslint-disable react/prop-types */
import { useState, useEffect, useMemo, useRef } from 'react'

const PUSH_TEMPLATES = {
  standard: {
    name: '标准横幅通知',
    title: '系统通知',
    subtitle: '',
    body: '这是一条来自 flyWork (SmartPush 模式) 的真实 APNs 远程推送！',
    badge: 1,
    sound: 'default',
    category: '',
    mutableContent: false,
    contentAvailable: false,
    customJson: '{\n  "source": "flywork_smartpush"\n}'
  },
  subtitleBadge: {
    name: '副标题与角标',
    title: '订单状态更新',
    subtitle: '您的包裹已出库',
    body: '顺丰速运正在火速配送中，请保持电话畅通。',
    badge: 5,
    sound: 'default',
    category: '',
    mutableContent: false,
    contentAvailable: false,
    customJson: '{\n  "order_id": "SF100862026"\n}'
  },
  richMedia: {
    name: '富媒体通知 (Service Extension)',
    title: '新品上架精选',
    subtitle: '',
    body: '点击横幅查看精美大图与独家优惠。',
    badge: 1,
    sound: 'default',
    category: 'NEWS_CATEGORY',
    mutableContent: true,
    contentAvailable: false,
    customJson: '{\n  "image_url": "https://developer.apple.com/assets/elements/icons/xcode/xcode-96x96_2x.png"\n}'
  },
  silent: {
    name: '静默数据更新 (Background)',
    title: '',
    subtitle: '',
    body: '',
    badge: 0,
    sound: '',
    category: '',
    mutableContent: false,
    contentAvailable: true,
    customJson: '{\n  "sync_action": "FETCH_MESSAGES",\n  "timestamp": 1725260000\n}'
  },
  deeplink: {
    name: '深链接跳转 (Deep Link)',
    title: '限时活动邀请',
    subtitle: '',
    body: '点击此通知直接唤起对应页面。',
    badge: 2,
    sound: 'default',
    category: '',
    mutableContent: false,
    contentAvailable: false,
    customJson: '{\n  "url": "petpal://store/detail?id=9988"\n}'
  }
}

export default function RealApnsPusher({ defaultBundleId = 'com.example.app', showToast }) {
  // Config state saved to localStorage
  const [environment, setEnvironment] = useState(() => localStorage.getItem('flywork_apns_env') || 'sandbox')
  const [authMode, setAuthMode] = useState(() => localStorage.getItem('flywork_apns_auth_mode') || 'token')
  const [p8Path, setP8Path] = useState(() => localStorage.getItem('flywork_apns_p8_path') || '')
  const [keyId, setKeyId] = useState(() => localStorage.getItem('flywork_apns_key_id') || '')
  const [teamId, setTeamId] = useState(() => localStorage.getItem('flywork_apns_team_id') || '')
  const [p12Path, setP12Path] = useState(() => localStorage.getItem('flywork_apns_p12_path') || '')
  const [p12Password, setP12Password] = useState('')
  const [bundleId, setBundleId] = useState(() => localStorage.getItem('flywork_apns_bundle_id') || defaultBundleId)

  // Target device token
  const [rawTokenInput, setRawTokenInput] = useState('')
  const [tokenHistory, setTokenHistory] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('flywork_apns_token_history') || '[]')
    } catch {
      return []
    }
  })

  // Headers
  const [pushType, setPushType] = useState('alert') // alert | background | voip
  const [priority, setPriority] = useState('10') // 10 (immediate) | 5 (power save)

  // Visual Payload fields
  const [title, setTitle] = useState(PUSH_TEMPLATES.standard.title)
  const [subtitle, setSubtitle] = useState('')
  const [body, setBody] = useState(PUSH_TEMPLATES.standard.body)
  const [badge, setBadge] = useState('1')
  const [sound, setSound] = useState('default')
  const [category, setCategory] = useState('')
  const [mutableContent, setMutableContent] = useState(false)
  const [contentAvailable, setContentAvailable] = useState(false)
  const [customJson, setCustomJson] = useState('{\n  "source": "flywork_smartpush"\n}')

  // View modes
  const [editorMode, setEditorMode] = useState('visual') // 'visual' | 'json'
  const [rawJsonText, setRawJsonText] = useState('')

  // Execution states
  const [sending, setSending] = useState(false)
  const [lastResult, setLastResult] = useState(null)
  const [verifyingP12, setVerifyingP12] = useState(false)
  const resultCardRef = useRef(null)

  // Persist configs
  useEffect(() => {
    localStorage.setItem('flywork_apns_env', environment)
  }, [environment])

  useEffect(() => {
    localStorage.setItem('flywork_apns_auth_mode', authMode)
  }, [authMode])

  useEffect(() => {
    localStorage.setItem('flywork_apns_p8_path', p8Path)
  }, [p8Path])

  useEffect(() => {
    localStorage.setItem('flywork_apns_key_id', keyId)
  }, [keyId])

  useEffect(() => {
    localStorage.setItem('flywork_apns_team_id', teamId)
  }, [teamId])

  useEffect(() => {
    localStorage.setItem('flywork_apns_p12_path', p12Path)
  }, [p12Path])

  useEffect(() => {
    localStorage.setItem('flywork_apns_bundle_id', bundleId)
  }, [bundleId])

  // Clean device token: remove <>, spaces, dashes
  const cleanToken = useMemo(() => {
    return rawTokenInput.replace(/[<>\s-]/g, '').trim()
  }, [rawTokenInput])

  const isTokenValid = cleanToken.length >= 32 && /^[0-9a-fA-F]+$/.test(cleanToken)

  // Build Payload JSON from visual form
  const builtPayloadObject = useMemo(() => {
    const aps = {}

    if (title || subtitle || body) {
      aps.alert = {}
      if (title) aps.alert.title = title
      if (subtitle) aps.alert.subtitle = subtitle
      if (body) aps.alert.body = body
    }

    if (badge !== '') {
      const bNum = parseInt(badge, 10)
      if (!isNaN(bNum)) aps.badge = bNum
    }

    if (sound) aps.sound = sound
    if (category) aps.category = category
    if (mutableContent) aps['mutable-content'] = 1
    if (contentAvailable) aps['content-available'] = 1

    let customData = {}
    if (customJson.trim()) {
      try {
        customData = JSON.parse(customJson)
      } catch {}
    }

    return {
      aps,
      ...customData
    }
  }, [title, subtitle, body, badge, sound, category, mutableContent, contentAvailable, customJson])

  // Sync JSON text when visual form changes and not editing in JSON mode
  useEffect(() => {
    if (editorMode === 'visual') {
      setRawJsonText(JSON.stringify(builtPayloadObject, null, 2))
    }
  }, [builtPayloadObject, editorMode])

  // Load a preset template
  const applyTemplate = (tpl) => {
    setTitle(tpl.title)
    setSubtitle(tpl.subtitle)
    setBody(tpl.body)
    setBadge(String(tpl.badge))
    setSound(tpl.sound)
    setCategory(tpl.category)
    setMutableContent(tpl.mutableContent)
    setContentAvailable(tpl.contentAvailable)
    setCustomJson(tpl.customJson)
    if (tpl.contentAvailable) {
      setPushType('background')
      setPriority('5')
    } else {
      setPushType('alert')
      setPriority('10')
    }
    showToast?.(`已载入模版: ${tpl.name}`)
  }

  // Handle file picker
  const chooseFile = async (type) => {
    try {
      if (window.flywork?.showOpenDialog) {
        const filters =
          type === 'p8'
            ? [{ name: 'Apple AuthKey (*.p8)', extensions: ['p8'] }]
            : [{ name: 'PKCS#12 Certificate (*.p12, *.pfx)', extensions: ['p12', 'pfx'] }]
        const res = await window.flywork.showOpenDialog({
          title: type === 'p8' ? '选择 .p8 鉴权密钥文件' : '选择 .p12 证书文件',
          filters,
          properties: ['openFile']
        })
        if (res && res.filePaths && res.filePaths.length > 0) {
          const p = res.filePaths[0]
          if (type === 'p8') {
            setP8Path(p)
            // Try auto-extracting Key ID from filename: AuthKey_9ABCDE1234.p8
            const match = p.match(/AuthKey_([A-Za-z0-9]{10})\.p8/)
            if (match && match[1]) {
              setKeyId(match[1])
            }
          } else {
            setP12Path(p)
          }
        }
      }
    } catch (err) {
      showToast?.(`选择文件失败: ${err.message}`)
    }
  }

  // Verify .p12 password
  const handleVerifyP12 = async () => {
    if (!p12Path) {
      showToast?.('请先选择 .p12 文件')
      return
    }
    setVerifyingP12(true)
    try {
      const res = await window.flywork?.apnsValidateP12?.(p12Path, p12Password)
      if (res?.success) {
        showToast?.('✓ .p12 证书及密码校验通过！')
      } else {
        showToast?.(res?.error || '校验失败')
      }
    } catch (err) {
      showToast?.(`校验异常: ${err.message}`)
    } finally {
      setVerifyingP12(false)
    }
  }

  // Send real APNs push
  const handleSendPush = async () => {
    // 1. Comprehensive Frontend Validations
    if (!cleanToken) {
      const errRes = {
        success: false,
        status: 'INPUT_ERROR',
        reason: 'MissingDeviceToken',
        friendlyTitle: '缺少 Device Token',
        friendlyTip: '尚未填写目标真机的 Device Token。',
        solutions: [
          '在真机代码中通过 application:didRegisterForRemoteNotificationsWithDeviceToken: 输出该 Token。',
          '若已复制，直接粘贴到上方 Device Token 输入框中即可。'
        ]
      }
      setLastResult(errRes)
      showToast?.('请输入目标真机 Device Token')
      return
    }

    if (!isTokenValid) {
      const errRes = {
        success: false,
        status: 'INPUT_ERROR',
        reason: 'InvalidDeviceToken',
        friendlyTitle: 'Device Token 格式异常',
        friendlyTip: `当前填写的 Token 长度为 ${cleanToken.length} 位，包含非法非十六进制字符。`,
        solutions: [
          '标准 iOS 硬件 Device Token 通常为 64 位纯十六进制字符串。',
          '请确认复制时没有丢失首尾字符。'
        ]
      }
      setLastResult(errRes)
      showToast?.('Device Token 格式异常，请核对')
      return
    }

    if (!bundleId.trim()) {
      const errRes = {
        success: false,
        status: 'INPUT_ERROR',
        reason: 'MissingBundleId',
        friendlyTitle: '缺少 Bundle ID',
        friendlyTip: '尚未填写目标 App 的 Bundle Identifier (Topic)。',
        solutions: ['在 Xcode 的 Target General 设置中查阅 Bundle Identifier（例如 com.example.app）。']
      }
      setLastResult(errRes)
      showToast?.('请输入 App Bundle ID')
      return
    }

    if (authMode === 'token') {
      if (!p8Path.trim() || !keyId.trim() || !teamId.trim()) {
        const errRes = {
          success: false,
          status: 'CONFIG_ERROR',
          reason: 'IncompleteTokenConfig',
          friendlyTitle: 'Token 凭证信息不完整',
          friendlyTip: '使用 Token 鉴权必须同时提供 .p8 密钥文件、10 位 Key ID 和 10 位 Team ID。',
          solutions: [
            !p8Path.trim() ? '❌ 未选择 AuthKey .p8 文件' : '✓ .p8 文件已选',
            !keyId.trim() ? '❌ 未填写 10 位 Key ID' : '✓ Key ID 已填',
            !teamId.trim() ? '❌ 未填写 10 位 Team ID' : '✓ Team ID 已填'
          ]
        }
        setLastResult(errRes)
        showToast?.('请补全 .p8 密钥、Key ID 及 Team ID')
        return
      }
    } else if (authMode === 'certificate') {
      if (!p12Path.trim()) {
        const errRes = {
          success: false,
          status: 'CONFIG_ERROR',
          reason: 'IncompleteCertConfig',
          friendlyTitle: '未选择证书文件',
          friendlyTip: '证书模式必须指定 Apple Push Services .p12 证书文件。',
          solutions: ['点击“选择文件”导入带有私钥的 .p12 文件。']
        }
        setLastResult(errRes)
        showToast?.('请选择 .p12 证书文件')
        return
      }
    }

    // Determine final payload
    let finalPayload = builtPayloadObject
    if (editorMode === 'json') {
      try {
        finalPayload = JSON.parse(rawJsonText)
      } catch (err) {
        const errRes = {
          success: false,
          status: 'JSON_SYNTAX_ERROR',
          reason: 'InvalidPayloadJson',
          friendlyTitle: 'Payload JSON 语法错误',
          friendlyTip: `当前编辑的 Raw JSON 格式不合法: ${err.message}`,
          solutions: ['请切换到 Raw JSON 模式检查是否有未闭合的括号或多余的逗号。']
        }
        setLastResult(errRes)
        showToast?.('JSON 语法错误，请检查格式')
        return
      }
    }

    setSending(true)
    showToast?.('正在直连 Apple APNs 官方网关...')

    try {
      if (!window.flywork?.apnsSendPush) {
        throw new Error('未检测到主进程 APNs 接口 (window.flywork.apnsSendPush 为空)。请关闭并重新启动 flyWork 应用以加载最新模块。')
      }

      const options = {
        environment,
        authMode,
        bundleId: bundleId.trim(),
        deviceToken: cleanToken,
        payload: finalPayload,
        pushType,
        priority: String(priority),
        expiration: 0
      }

      if (authMode === 'token') {
        options.p8Path = p8Path
        options.keyId = keyId.trim()
        options.teamId = teamId.trim()
      } else {
        options.p12Path = p12Path
        options.p12Password = p12Password
      }

      const res = await window.flywork.apnsSendPush(options)
      if (!res) {
        throw new Error('主进程返回了空响应 (undefined)，请检查主进程执行状态')
      }

      setLastResult(res)

      if (res?.success) {
        showToast?.('✓ 推送已成功送达 Apple APNs 网关！')
        setTokenHistory((prev) => {
          const filtered = prev.filter((t) => t.token !== cleanToken)
          const updated = [{ token: cleanToken, bundleId: bundleId.trim(), time: Date.now() }, ...filtered].slice(0, 10)
          localStorage.setItem('flywork_apns_token_history', JSON.stringify(updated))
          return updated
        })
      } else {
        showToast?.(`推送失败: ${res.reason || res.friendlyTitle || '请查看下方真实原因'}`)
      }
    } catch (err) {
      setLastResult({
        success: false,
        status: 'SYSTEM_EXCEPTION',
        reason: 'ClientException',
        friendlyTitle: '客户端系统异常',
        friendlyTip: err.message,
        solutions: [
          '请确认主进程 apnsService 模块是否已随 Electron 启动加载。',
          '重新启动 flyWork 客户端通常可解决热重载丢失接口的问题。'
        ],
        rawResponse: err.stack || err.message
      })
      showToast?.(`调用异常: ${err.message}`)
    } finally {
      setSending(false)
      // Smooth scroll to diagnostic console
      setTimeout(() => {
        resultCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      }, 100)
    }
  }

  // Copy diagnostic full report
  const copyDiagnosticReport = () => {
    if (!lastResult) return
    const report = {
      timestamp: new Date().toISOString(),
      environment,
      host: environment === 'production' ? 'https://api.push.apple.com' : 'https://api.sandbox.push.apple.com',
      authMode,
      bundleId,
      deviceToken: cleanToken,
      payload: editorMode === 'json' ? rawJsonText : builtPayloadObject,
      result: lastResult
    }
    navigator.clipboard.writeText(JSON.stringify(report, null, 2))
    showToast?.('✓ 已复制完整 APNs 诊断报告至剪贴板')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* 1. Header Bar: Environment & Auth Mode Switch */}
      <div
        className="card"
        style={{
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>推送环境:</span>
          <div style={{ display: 'flex', gap: 4 }}>
            <button
              className={`btn btn-sm ${environment === 'sandbox' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setEnvironment('sandbox')}
              style={{ fontSize: 11, height: 26, gap: 4 }}
            >
              <span>🛠</span>
              <span>开发环境 (Sandbox)</span>
            </button>
            <button
              className={`btn btn-sm ${environment === 'production' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setEnvironment('production')}
              style={{ fontSize: 11, height: 26, gap: 4 }}
            >
              <span>🚀</span>
              <span>生产环境 (Production)</span>
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>鉴权方式:</span>
          <div style={{ display: 'flex', gap: 4 }}>
            <button
              className={`btn btn-sm ${authMode === 'token' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setAuthMode('token')}
              style={{ fontSize: 11, height: 26, gap: 4 }}
            >
              <span>🔑</span>
              <span>Token 鉴权 (.p8) [推荐]</span>
            </button>
            <button
              className={`btn btn-sm ${authMode === 'certificate' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setAuthMode('certificate')}
              style={{ fontSize: 11, height: 26, gap: 4 }}
            >
              <span>📜</span>
              <span>证书文件 (.p12)</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Credentials Configuration Section */}
      <div className="card" style={{ padding: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span>{authMode === 'token' ? '🔑' : '📜'}</span>
          <span>{authMode === 'token' ? 'Apple Token (.p8) 凭证配置' : 'Apple Push Certificate (.p12) 凭证配置'}</span>
        </div>

        {authMode === 'token' ? (
          <div>
            {/* .p8 File selection */}
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>
                AuthKey 密钥文件 (.p8) <span style={{ color: 'var(--accent-red)' }}>*</span>
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="text"
                  className="input"
                  value={p8Path}
                  onChange={(e) => setP8Path(e.target.value)}
                  placeholder="拖拽或选择 AuthKey_XXXXXXXXXX.p8 文件路径"
                  style={{ flex: 1, fontSize: 11 }}
                />
                <button className="btn btn-secondary btn-sm" onClick={() => chooseFile('p8')} style={{ fontSize: 11, height: 30 }}>
                  选择文件
                </button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>
                  Key ID (10位) <span style={{ color: 'var(--accent-red)' }}>*</span>
                </label>
                <input
                  type="text"
                  className="input"
                  value={keyId}
                  onChange={(e) => setKeyId(e.target.value)}
                  placeholder="例如: 2X9R4HXF34"
                  maxLength={10}
                  style={{ width: '100%', fontSize: 11, fontFamily: 'monospace' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>
                  Team ID (10位) <span style={{ color: 'var(--accent-red)' }}>*</span>
                </label>
                <input
                  type="text"
                  className="input"
                  value={teamId}
                  onChange={(e) => setTeamId(e.target.value)}
                  placeholder="例如: 9ABCDE1234"
                  maxLength={10}
                  style={{ width: '100%', fontSize: 11, fontFamily: 'monospace' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>
                  App Bundle ID (Topic) <span style={{ color: 'var(--accent-red)' }}>*</span>
                </label>
                <input
                  type="text"
                  className="input"
                  value={bundleId}
                  onChange={(e) => setBundleId(e.target.value)}
                  placeholder="例如: com.example.app"
                  style={{ width: '100%', fontSize: 11 }}
                />
              </div>
            </div>
          </div>
        ) : (
          <div>
            {/* .p12 File & Password */}
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>
                推送证书文件 (.p12) <span style={{ color: 'var(--accent-red)' }}>*</span>
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="text"
                  className="input"
                  value={p12Path}
                  onChange={(e) => setP12Path(e.target.value)}
                  placeholder="选择导出的 Apple Push Services .p12 证书"
                  style={{ flex: 1, fontSize: 11 }}
                />
                <button className="btn btn-secondary btn-sm" onClick={() => chooseFile('p12')} style={{ fontSize: 11, height: 30 }}>
                  选择文件
                </button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>
                  证书导出密码 (Passphrase, 可空)
                </label>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input
                    type="password"
                    className="input"
                    value={p12Password}
                    onChange={(e) => setP12Password(e.target.value)}
                    placeholder="证书密码"
                    style={{ flex: 1, fontSize: 11 }}
                  />
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={handleVerifyP12}
                    disabled={verifyingP12 || !p12Path}
                    style={{ fontSize: 11, height: 30 }}
                  >
                    {verifyingP12 ? '验证中...' : '校验证书'}
                  </button>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>
                  App Bundle ID (Topic) <span style={{ color: 'var(--accent-red)' }}>*</span>
                </label>
                <input
                  type="text"
                  className="input"
                  value={bundleId}
                  onChange={(e) => setBundleId(e.target.value)}
                  placeholder="例如: com.example.app"
                  style={{ width: '100%', fontSize: 11 }}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 3. Target Device Token Section */}
      <div className="card" style={{ padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>📲</span>
            <span>目标真机 Device Token <span style={{ color: 'var(--accent-red)' }}>*</span></span>
          </div>

          {tokenHistory.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>历史 Token:</span>
              <select
                className="input"
                style={{ fontSize: 11, padding: '2px 8px', height: 26, maxWidth: 220 }}
                onChange={(e) => {
                  if (e.target.value) {
                    setRawTokenInput(e.target.value)
                  }
                }}
                defaultValue=""
              >
                <option value="" disabled>从历史记录选取...</option>
                {tokenHistory.map((item, idx) => (
                  <option key={idx} value={item.token}>
                    {item.token.slice(0, 8)}...{item.token.slice(-8)} ({item.bundleId})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 6 }}>
          支持直接粘贴带尖括号或空格的原始格式（如 <code>&lt;740f4707 bebcf74f ...&gt;</code>），系统将自动清洗为纯十六进制。
        </div>

        <textarea
          className="input"
          value={rawTokenInput}
          onChange={(e) => setRawTokenInput(e.target.value)}
          rows={2}
          placeholder="在此粘贴真机获取到的 Device Token (Hex)..."
          style={{ width: '100%', fontSize: 11, fontFamily: 'monospace', resize: 'vertical' }}
        />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
          <div style={{ fontSize: 11 }}>
            {cleanToken ? (
              isTokenValid ? (
                <span style={{ color: 'var(--accent-green)' }}>
                  ✓ 识别到 {cleanToken.length} 位有效 Hex Token
                </span>
              ) : (
                <span style={{ color: 'var(--accent-amber)' }}>
                  ⚠️ Token 长度或字符异常 ({cleanToken.length} 位)，请核验
                </span>
              )
            ) : (
              <span style={{ color: 'var(--text-muted)' }}>等待输入 Device Token</span>
            )}
          </div>

          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Push Type:</span>
              <select
                className="input"
                value={pushType}
                onChange={(e) => setPushType(e.target.value)}
                style={{ fontSize: 11, padding: '1px 6px', height: 24 }}
              >
                <option value="alert">alert (普通横幅)</option>
                <option value="background">background (静默后台)</option>
                <option value="voip">voip (网络电话)</option>
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Priority:</span>
              <select
                className="input"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                style={{ fontSize: 11, padding: '1px 6px', height: 24 }}
              >
                <option value="10">10 (立即送达)</option>
                <option value="5">5 (节能省电)</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Payload Editor (Visual vs Raw JSON) */}
      <div className="card" style={{ padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>快捷模版:</span>
            {Object.entries(PUSH_TEMPLATES).map(([k, tpl]) => (
              <button
                key={k}
                className="btn btn-secondary btn-sm"
                onClick={() => applyTemplate(tpl)}
                style={{ fontSize: 10, padding: '2px 8px', height: 22 }}
              >
                {tpl.name}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 4 }}>
            <button
              className={`btn btn-sm ${editorMode === 'visual' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setEditorMode('visual')}
              style={{ fontSize: 10, height: 22, padding: '2px 6px' }}
            >
              表单编辑
            </button>
            <button
              className={`btn btn-sm ${editorMode === 'json' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setEditorMode('json')}
              style={{ fontSize: 10, height: 22, padding: '2px 6px' }}
            >
              Raw JSON
            </button>
          </div>
        </div>

        {editorMode === 'visual' ? (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>
                  通知标题 (Title)
                </label>
                <input
                  type="text"
                  className="input"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="标题"
                  style={{ width: '100%', fontSize: 12 }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>
                  副标题 (Subtitle, 可选)
                </label>
                <input
                  type="text"
                  className="input"
                  value={subtitle}
                  onChange={(e) => setSubtitle(e.target.value)}
                  placeholder="副标题"
                  style={{ width: '100%', fontSize: 12 }}
                />
              </div>
            </div>

            <div style={{ marginBottom: 10 }}>
              <label style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>
                通知内容 (Body)
              </label>
              <textarea
                className="input"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={2}
                placeholder="通知正文内容..."
                style={{ width: '100%', fontSize: 12, resize: 'vertical' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>
                  角标 (Badge)
                </label>
                <input
                  type="number"
                  className="input"
                  value={badge}
                  onChange={(e) => setBadge(e.target.value)}
                  placeholder="1"
                  style={{ width: '100%', fontSize: 11 }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>
                  提示音 (Sound)
                </label>
                <input
                  type="text"
                  className="input"
                  value={sound}
                  onChange={(e) => setSound(e.target.value)}
                  placeholder="default"
                  style={{ width: '100%', fontSize: 11 }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>
                  分类 (Category)
                </label>
                <input
                  type="text"
                  className="input"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="例如: ACTION_CATEGORY"
                  style={{ width: '100%', fontSize: 11 }}
                />
              </div>
            </div>

            {/* Checkbox options */}
            <div style={{ display: 'flex', gap: 20, marginBottom: 10 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={mutableContent}
                  onChange={(e) => setMutableContent(e.target.checked)}
                />
                <span>mutable-content: 1 (富媒体扩展)</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={contentAvailable}
                  onChange={(e) => setContentAvailable(e.target.checked)}
                />
                <span>content-available: 1 (静默后台唤醒)</span>
              </label>
            </div>

            {/* Custom JSON payload */}
            <div>
              <label style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>
                业务自定义字段 (Custom JSON Payload)
              </label>
              <textarea
                className="input"
                value={customJson}
                onChange={(e) => setCustomJson(e.target.value)}
                rows={3}
                style={{ width: '100%', fontSize: 11, fontFamily: 'monospace', resize: 'vertical' }}
              />
            </div>
          </div>
        ) : (
          <div>
            <textarea
              className="input"
              value={rawJsonText}
              onChange={(e) => setRawJsonText(e.target.value)}
              rows={12}
              style={{ width: '100%', fontSize: 11, fontFamily: 'monospace', resize: 'vertical' }}
            />
          </div>
        )}
      </div>

      {/* 5. Execution Button */}
      <div>
        <button
          className="btn btn-primary"
          onClick={handleSendPush}
          disabled={sending}
          style={{ width: '100%', height: 38, fontSize: 14, gap: 8, fontWeight: 600 }}
        >
          <span>🚀</span>
          <span>{sending ? '正在直连 Apple APNs 网关发射推送...' : '向 Apple APNs 网关发射真实推送 (Send Push)'}</span>
        </button>
      </div>

      {/* 6. 常驻式的「📡 APNs 通讯日志与真实原因诊断中心」 */}
      <div
        ref={resultCardRef}
        className="card"
        style={{
          padding: 18,
          border: lastResult
            ? `1px solid ${lastResult.success ? 'var(--accent-green)' : 'var(--accent-red)'}`
            : '1px solid var(--border)',
          background: lastResult
            ? lastResult.success
              ? 'rgba(46, 160, 67, 0.06)'
              : 'rgba(248, 81, 73, 0.06)'
            : 'var(--bg-card)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 16 }}>{lastResult ? (lastResult.success ? '✅' : '❌') : '📡'}</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
              APNs 实时通讯日志与真实原因诊断
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {lastResult && (
              <button
                className="btn btn-secondary btn-sm"
                onClick={copyDiagnosticReport}
                style={{ fontSize: 11, height: 26, gap: 4 }}
              >
                <span>📋</span>
                <span>复制完整诊断报告</span>
              </button>
            )}
            <span
              className="badge"
              style={{
                fontSize: 10,
                padding: '2px 8px',
                background: sending
                  ? 'var(--accent-blue-dim)'
                  : lastResult
                    ? lastResult.success
                      ? 'var(--accent-green-dim)'
                      : 'var(--accent-red-dim)'
                    : 'var(--bg-elevated)',
                color: sending
                  ? 'var(--accent-blue)'
                  : lastResult
                    ? lastResult.success
                      ? 'var(--accent-green)'
                      : 'var(--accent-red)'
                    : 'var(--text-muted)'
              }}
            >
              {sending
                ? '⟳ 发送中'
                : lastResult
                  ? lastResult.success
                    ? '200 OK 成功'
                    : `失败 [${lastResult.status || 'ERROR'}]`
                  : '待命准备'}
            </span>
          </div>
        </div>

        {/* Ready / Idle state */}
        {!lastResult && !sending && (
          <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
            填入上方鉴权凭证与真机 Device Token 后，点击发射推送。系统将直接发起 HTTP/2 连接至 Apple 网关，并在此完整输出通讯状态、往返耗时与底层错误诊断。
          </div>
        )}

        {/* Sending state */}
        {sending && (
          <div style={{ fontSize: 12, color: 'var(--accent-blue)', lineHeight: 1.6 }}>
            ⟳ 正在向 <code>{environment === 'production' ? 'api.push.apple.com' : 'api.sandbox.push.apple.com'}</code> 发起 HTTP/2 安全握手，等待 Apple 网关确认...
          </div>
        )}

        {/* Detailed Result Card */}
        {lastResult && (
          <div style={{ fontSize: 12, lineHeight: 1.6 }}>
            {/* Header Result summary */}
            <div
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: lastResult.success ? 'var(--accent-green)' : 'var(--accent-red)',
                marginBottom: 8
              }}
            >
              {lastResult.success
                ? '✓ 恭喜！推送已成功送达 Apple APNs 官方网关并获得确认'
                : `✗ 推送失败: ${lastResult.friendlyTitle || lastResult.reason || '未知错误'}`}
            </div>

            {/* Success details */}
            {lastResult.success && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, color: 'var(--text-primary)' }}>
                <div>
                  <strong>Apple 官方追踪 ID (apns-id):</strong>{' '}
                  <code style={{ background: 'var(--bg-elevated)', padding: '2px 6px', borderRadius: 4, fontFamily: 'monospace' }}>
                    {lastResult.apnsId || '已由 Apple 分配'}
                  </code>
                </div>
                <div>
                  <strong>往返耗时:</strong> {lastResult.duration || 0} ms · <strong>通道环境:</strong> {environment === 'production' ? '线上生产环境' : '开发沙盒环境'}
                </div>
                <div style={{ color: 'var(--text-secondary)' }}>
                  目标真机硬件应已收到推送广播通知。若真机未亮屏弹窗，请核实真机是否开启了“专注模式/勿扰模式”或关闭了横幅通知权限。
                </div>
              </div>
            )}

            {/* Error Deep Analysis (The real reason display requested by user!) */}
            {!lastResult.success && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {/* 1. Real Reason Box */}
                <div
                  style={{
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    padding: 12
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontWeight: 600, color: 'var(--accent-red)' }}>
                      【真实失败原因】 {lastResult.reason || '未知原因'}
                    </span>
                    {lastResult.status && (
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        HTTP 状态码: <code>{lastResult.status}</code>
                      </span>
                    )}
                  </div>
                  <div style={{ color: 'var(--text-primary)', marginBottom: 6 }}>
                    {lastResult.friendlyTip || lastResult.error}
                  </div>

                  {/* Raw response snippet */}
                  {lastResult.rawResponse && (
                    <div style={{ marginTop: 6 }}>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Apple 原始返回消息体 (Raw Response):</span>
                      <pre
                        style={{
                          margin: '4px 0 0 0',
                          padding: '6px 8px',
                          background: 'var(--bg-base)',
                          borderRadius: 4,
                          fontSize: 11,
                          fontFamily: 'monospace',
                          overflowX: 'auto',
                          color: 'var(--text-secondary)'
                        }}
                      >
                        {typeof lastResult.rawResponse === 'object'
                          ? JSON.stringify(lastResult.rawResponse, null, 2)
                          : String(lastResult.rawResponse)}
                      </pre>
                    </div>
                  )}
                </div>

                {/* 2. Actionable Solutions Checklist */}
                {lastResult.solutions && lastResult.solutions.length > 0 && (
                  <div
                    style={{
                      background: 'rgba(210, 153, 34, 0.08)',
                      border: '1px solid rgba(210, 153, 34, 0.25)',
                      borderRadius: 'var(--radius-md)',
                      padding: 12
                    }}
                  >
                    <div style={{ fontWeight: 600, color: 'var(--accent-amber)', marginBottom: 6 }}>
                      💡 推荐排查方案与解决步骤：
                    </div>
                    <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--text-primary)' }}>
                      {lastResult.solutions.map((sol, sIdx) => (
                        <li key={sIdx} style={{ marginBottom: 4 }}>
                          {sol}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* 3. Communication Context parameters */}
                <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                  <span>网关: <code>{environment === 'production' ? 'api.push.apple.com' : 'api.sandbox.push.apple.com'}</code></span>
                  <span>Topic: <code>{bundleId || '-'}</code></span>
                  <span>Token: <code>{cleanToken ? `${cleanToken.slice(0, 8)}... (${cleanToken.length}位)` : '-'}</code></span>
                  {lastResult.duration && <span>耗时: {lastResult.duration} ms</span>}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

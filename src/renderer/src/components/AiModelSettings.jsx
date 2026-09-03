/* eslint-disable react/prop-types */
import { useState } from 'react'
import { getInitialAiProviders, getActiveProviderId } from '../utils/aiProviderStorage'

// 预设供应商模板 (类似 cc-switch)
const PROVIDER_TEMPLATES = {
  deepseek: {
    id: 'deepseek',
    name: 'DeepSeek 官方',
    icon: '🧠',
    baseUrl: 'https://api.deepseek.com/v1',
    model: 'deepseek-chat',
    keyPlaceholder: 'sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    keyHelpUrl: 'https://platform.deepseek.com/api_keys',
    desc: '推荐！高性价比，代码架构与 Mermaid 图表绘制能力顶尖'
  },
  siliconflow: {
    id: 'siliconflow',
    name: '硅基流动 (SiliconFlow)',
    icon: '🚀',
    baseUrl: 'https://api.siliconflow.cn/v1',
    model: 'deepseek-ai/DeepSeek-V3',
    keyPlaceholder: 'sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    keyHelpUrl: 'https://cloud.siliconflow.cn/account/ak',
    desc: '国内极速高并发托管，支持 DeepSeek-V3 与全尺寸开源大模型'
  },
  openai: {
    id: 'openai',
    name: 'OpenAI 官方',
    icon: '🌐',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
    keyPlaceholder: 'sk-proj-xxxxxxxxxxxxxxxxxxxxxxxx',
    keyHelpUrl: 'https://platform.openai.com/api-keys',
    desc: '业界基准模型，支持 GPT-4o、GPT-4o-mini'
  },
  qwen: {
    id: 'qwen',
    name: '阿里通义千问 (DashScope)',
    icon: '☁️',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    model: 'qwen-plus',
    keyPlaceholder: 'sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    keyHelpUrl: 'https://dashscope.console.aliyun.com/',
    desc: '阿里云兼容接口，中文理解与链路极速稳定'
  },
  moonshot: {
    id: 'moonshot',
    name: '月之暗面 (Kimi)',
    icon: '🌙',
    baseUrl: 'https://api.moonshot.cn/v1',
    model: 'moonshot-v1-8k',
    keyPlaceholder: 'sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    keyHelpUrl: 'https://platform.moonshot.cn/console/api-keys',
    desc: '长文本长上下文理解优异'
  },
  ollama: {
    id: 'ollama',
    name: 'Ollama 本地大模型',
    icon: '🦙',
    baseUrl: 'http://localhost:11434/v1',
    model: 'llama3:latest',
    keyPlaceholder: '本地模型免 Key (留空即可)',
    keyHelpUrl: 'https://ollama.com/',
    desc: '本地离线私有化运行，隐私绝对安全，无需 API Key'
  },
  custom: {
    id: 'custom',
    name: '自定义 OpenAI 兼容接口',
    icon: '🛠️',
    baseUrl: '',
    model: '',
    keyPlaceholder: 'API Key / 访问令牌...',
    keyHelpUrl: '',
    desc: '企业私有网关、OneAPI、NewAPI 或第三方聚合中转服务'
  }
}

export default function AiModelSettings({ onConfigChange }) {
  // 1. 加载 Providers 列表与激活 ID
  const [providers, setProviders] = useState(() => getInitialAiProviders())
  const [activeProviderId, setActiveProviderId] = useState(() => {
    const list = getInitialAiProviders()
    return getActiveProviderId(list)
  })

  // 测速状态字典: { [providerId]: { testing: boolean, latency?: number, success?: boolean, msg?: string } }
  const [pingStates, setPingStates] = useState({})

  // 模态弹窗状态：新增或编辑 Provider
  const [editingModalOpen, setEditingModalOpen] = useState(false)
  const [editingProvider, setEditingProvider] = useState(null) // null 表示新增
  const [modalFormData, setModalFormData] = useState({
    name: '',
    type: 'deepseek',
    baseUrl: '',
    apiKey: '',
    model: ''
  })
  const [showKey, setShowKey] = useState(false)
  const [modalTestResult, setModalTestResult] = useState(null)
  const [modalTesting, setModalTesting] = useState(false)

  // 同步持久化并广播给全局消费端 (如白板 AI 绘图)
  const persistProviders = (newProviders, newActiveId = activeProviderId) => {
    setProviders(newProviders)
    localStorage.setItem('flywork_ai_providers', JSON.stringify(newProviders))

    let effectiveActiveId = newActiveId
    if (!newProviders.some((p) => p.id === effectiveActiveId)) {
      effectiveActiveId = newProviders[0]?.id || ''
    }
    setActiveProviderId(effectiveActiveId)
    localStorage.setItem('flywork_ai_active_provider_id', effectiveActiveId)

    const activeItem = newProviders.find((p) => p.id === effectiveActiveId)
    if (activeItem) {
      const legacyCompat = {
        provider: activeItem.type,
        baseUrl: activeItem.baseUrl,
        apiKey: activeItem.apiKey,
        model: activeItem.model
      }
      localStorage.setItem('flywork_ai_model_config', JSON.stringify(legacyCompat))
      localStorage.setItem('flywork_ai_diagram_config', JSON.stringify(legacyCompat))
      window.dispatchEvent(
        new CustomEvent('flywork_ai_config_updated', {
          detail: { ...legacyCompat, providerId: activeItem.id, providerName: activeItem.name }
        })
      )
      if (onConfigChange) onConfigChange(legacyCompat)
    }
  }

  // 切换激活的 Provider
  const handleActivateProvider = (id) => {
    setActiveProviderId(id)
    persistProviders(providers, id)
  }

  // 打开新增弹窗
  const handleOpenAdd = () => {
    const defaultTmpl = PROVIDER_TEMPLATES.deepseek
    setEditingProvider(null)
    setModalFormData({
      name: defaultTmpl.name,
      type: defaultTmpl.id,
      baseUrl: defaultTmpl.baseUrl,
      apiKey: '',
      model: defaultTmpl.model
    })
    setShowKey(false)
    setModalTestResult(null)
    setEditingModalOpen(true)
  }

  // 打开编辑弹窗
  const handleOpenEdit = (p) => {
    setEditingProvider(p)
    setModalFormData({
      name: p.name,
      type: p.type || 'custom',
      baseUrl: p.baseUrl,
      apiKey: p.apiKey || '',
      model: p.model
    })
    setShowKey(false)
    setModalTestResult(null)
    setEditingModalOpen(true)
  }

  // 删除 Provider
  const handleDeleteProvider = (id) => {
    if (providers.length <= 1) {
      alert('至少需要保留一个 Provider 服务商！')
      return
    }
    const target = providers.find((p) => p.id === id)
    if (window.confirm(`确定要删除服务商 [${target?.name || id}] 吗？`)) {
      const nextList = providers.filter((p) => p.id !== id)
      persistProviders(nextList)
    }
  }

  // 模态弹窗内选择模板时，自动更新建议值
  const handleTemplateChange = (tmplKey) => {
    const tmpl = PROVIDER_TEMPLATES[tmplKey]
    if (tmpl) {
      setModalFormData((prev) => ({
        ...prev,
        type: tmplKey,
        name: prev.name && prev.name !== tmpl.name ? prev.name : tmpl.name,
        baseUrl: tmpl.baseUrl,
        model: tmpl.model
      }))
    }
  }

  // 连通性测试请求执行函数
  const executePing = async ({ baseUrl, apiKey, model, isLocalOllama }) => {
    const startTime = Date.now()
    if (!baseUrl || !baseUrl.trim()) {
      return { success: false, msg: '缺少服务地址 Base URL' }
    }
    if (!apiKey && !isLocalOllama) {
      return { success: false, msg: '缺少 API Key' }
    }

    try {
      if (window.flywork?.requestAiDiagram) {
        const res = await window.flywork.requestAiDiagram({
          baseUrl: baseUrl.trim(),
          apiKey: apiKey ? apiKey.trim() : '',
          model: model || 'deepseek-chat',
          prompt: 'ping',
          systemPrompt: 'Respond with exactly one word: pong'
        })
        const latency = Date.now() - startTime
        if (res.success) {
          return { success: true, latency, msg: `连通正常 (${latency}ms)` }
        } else {
          return { success: false, latency, msg: res.error || '连接超时或响应失败' }
        }
      } else {
        const endpoint = `${baseUrl.replace(/\/+$/, '')}/chat/completions`
        const headers = { 'Content-Type': 'application/json' }
        if (apiKey) headers['Authorization'] = `Bearer ${apiKey.trim()}`
        const res = await fetch(endpoint, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            model: model || 'deepseek-chat',
            messages: [{ role: 'user', content: 'ping' }],
            max_tokens: 5
          })
        })
        const latency = Date.now() - startTime
        if (res.ok) {
          return { success: true, latency, msg: `连通正常 (${latency}ms)` }
        } else {
          const errText = await res.text()
          return { success: false, latency, msg: `HTTP ${res.status}: ${errText}` }
        }
      }
    } catch (err) {
      return { success: false, msg: err.message || '网络请求错误' }
    }
  }

  // 单卡片独立测速
  const handlePingProvider = async (p) => {
    setPingStates((prev) => ({
      ...prev,
      [p.id]: { testing: true }
    }))
    const res = await executePing({
      baseUrl: p.baseUrl,
      apiKey: p.apiKey,
      model: p.model,
      isLocalOllama: p.type === 'ollama'
    })
    setPingStates((prev) => ({
      ...prev,
      [p.id]: { testing: false, ...res }
    }))
  }

  // 模态弹窗内的测试连通性
  const handleModalTest = async () => {
    setModalTesting(true)
    setModalTestResult(null)
    const res = await executePing({
      baseUrl: modalFormData.baseUrl,
      apiKey: modalFormData.apiKey,
      model: modalFormData.model,
      isLocalOllama: modalFormData.type === 'ollama'
    })
    setModalTesting(false)
    setModalTestResult(res)
  }

  // 保存（新增/编辑）Provider
  const handleSaveModal = (e) => {
    e?.preventDefault()
    if (!modalFormData.name.trim()) {
      alert('请输入 Provider 别名！')
      return
    }
    if (!modalFormData.baseUrl.trim()) {
      alert('请输入 Base URL 接口地址！')
      return
    }

    const tmpl = PROVIDER_TEMPLATES[modalFormData.type] || PROVIDER_TEMPLATES.custom
    let nextList
    let targetId

    if (editingProvider) {
      // 编辑
      targetId = editingProvider.id
      nextList = providers.map((p) => {
        if (p.id === targetId) {
          return {
            ...p,
            name: modalFormData.name.trim(),
            type: modalFormData.type,
            icon: tmpl.icon,
            baseUrl: modalFormData.baseUrl.trim(),
            apiKey: modalFormData.apiKey.trim(),
            model: modalFormData.model.trim() || tmpl.model
          }
        }
        return p
      })
    } else {
      // 新增
      targetId = `provider-${modalFormData.type}-${Date.now()}`
      const newProvider = {
        id: targetId,
        name: modalFormData.name.trim(),
        type: modalFormData.type,
        icon: tmpl.icon,
        baseUrl: modalFormData.baseUrl.trim(),
        apiKey: modalFormData.apiKey.trim(),
        model: modalFormData.model.trim() || tmpl.model,
        enabled: true,
        createdAt: Date.now()
      }
      nextList = [...providers, newProvider]
    }

    persistProviders(nextList, targetId)
    setEditingModalOpen(false)
  }

  const activeProvider = providers.find((p) => p.id === activeProviderId) || providers[0]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* 顶部总览状态看板 */}
      <div className="card" style={{ padding: 18 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 10,
                background: 'rgba(59, 130, 246, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 24
              }}
            >
              🔄
            </div>
            <div>
              <div
                style={{
                  fontSize: 15,
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8
                }}
              >
                <span>AI 服务商管理中心 (Providers)</span>
                <span
                  style={{
                    fontSize: 11,
                    padding: '2px 8px',
                    borderRadius: 10,
                    fontWeight: 500,
                    background: 'var(--accent-blue-dim)',
                    color: 'var(--accent-blue)'
                  }}
                >
                  已接入 {providers.length} 个服务节点
                </span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 3 }}>
                类似 cc-switch
                架构，支持添加多个模型服务商实例并随时无感切换，赋能白板架构绘图与全平台智能助手。
              </div>
            </div>
          </div>

          <button
            className="btn btn-sm btn-primary"
            onClick={handleOpenAdd}
            style={{ gap: 6, fontSize: 13, padding: '7px 16px' }}
          >
            <span>➕</span>
            <span>添加 Provider</span>
          </button>
        </div>

        {/* 当前活跃节点摘要条 */}
        {activeProvider && (
          <div
            style={{
              marginTop: 14,
              padding: '8px 12px',
              borderRadius: 6,
              background: 'rgba(59, 130, 246, 0.06)',
              border: '1px solid rgba(59, 130, 246, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: 12
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: 'var(--accent-green)', fontWeight: 'bold' }}>● 当前生效:</span>
              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                {activeProvider.icon} {activeProvider.name}
              </span>
              <span
                style={{
                  background: 'var(--bg-elevated)',
                  padding: '1px 6px',
                  borderRadius: 4,
                  fontSize: 11,
                  color: 'var(--text-secondary)'
                }}
              >
                {activeProvider.model}
              </span>
            </div>
            <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>
              画板 AI 与全局组件将默认调用此节点
            </div>
          </div>
        )}
      </div>

      {/* Provider 节点卡片列表 */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
          gap: 14
        }}
      >
        {providers.map((p) => {
          const isActive = p.id === activeProviderId
          const ping = pingStates[p.id]
          const isOllama = p.type === 'ollama'
          const hasKey = Boolean(p.apiKey || isOllama)

          return (
            <div
              key={p.id}
              className="card"
              style={{
                padding: 16,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                borderRadius: 8,
                border: isActive ? '1.5px solid var(--accent-blue)' : '1px solid var(--border)',
                background: isActive ? 'rgba(59, 130, 246, 0.04)' : 'var(--bg-elevated)',
                transition: 'all 0.15s ease',
                position: 'relative'
              }}
            >
              {/* 卡片头部 */}
              <div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 8
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 20 }}>{p.icon || '🤖'}</span>
                    <span
                      style={{
                        fontSize: 14,
                        fontWeight: 600,
                        color: isActive ? 'var(--accent-blue)' : 'var(--text-primary)'
                      }}
                    >
                      {p.name}
                    </span>
                  </div>

                  {isActive ? (
                    <span
                      style={{
                        fontSize: 11,
                        padding: '2px 8px',
                        borderRadius: 12,
                        background: 'var(--accent-green-dim)',
                        color: 'var(--accent-green)',
                        fontWeight: 600
                      }}
                    >
                      ● 当前激活
                    </span>
                  ) : (
                    <button
                      className="btn btn-xs btn-secondary"
                      onClick={() => handleActivateProvider(p.id)}
                      style={{ fontSize: 11, padding: '2px 8px' }}
                    >
                      设为激活
                    </button>
                  )}
                </div>

                {/* 节点详细参数信息 */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: 11,
                      color: 'var(--text-secondary)'
                    }}
                  >
                    <span>默认模型:</span>
                    <span
                      style={{
                        color: 'var(--text-primary)',
                        fontFamily: 'monospace',
                        fontWeight: 500
                      }}
                    >
                      {p.model}
                    </span>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: 11,
                      color: 'var(--text-secondary)'
                    }}
                  >
                    <span>Base URL:</span>
                    <span
                      title={p.baseUrl}
                      style={{
                        maxWidth: 200,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        color: 'var(--text-muted)',
                        fontFamily: 'monospace'
                      }}
                    >
                      {p.baseUrl || '未设置'}
                    </span>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: 11,
                      color: 'var(--text-secondary)'
                    }}
                  >
                    <span>API 凭证:</span>
                    <span
                      style={{
                        color: hasKey ? 'var(--accent-green)' : 'var(--accent-amber)',
                        fontWeight: 500
                      }}
                    >
                      {isOllama ? '免 Key (本地部署)' : hasKey ? '● 已配置密钥' : '○ 尚未配置 Key'}
                    </span>
                  </div>
                </div>

                {/* 测速结果条 */}
                {ping && (
                  <div
                    style={{
                      marginTop: 10,
                      padding: '4px 8px',
                      borderRadius: 4,
                      fontSize: 11,
                      lineHeight: 1.4,
                      background: ping.success
                        ? 'var(--accent-green-dim)'
                        : 'var(--accent-red-dim)',
                      color: ping.success ? 'var(--accent-green)' : 'var(--accent-red)',
                      border: `1px solid ${
                        ping.success ? 'rgba(74, 222, 128, 0.25)' : 'rgba(239, 68, 68, 0.25)'
                      }`
                    }}
                  >
                    {ping.testing
                      ? '⏳ 正在测速...'
                      : ping.success
                        ? `⚡ ${ping.msg}`
                        : `❌ ${ping.msg}`}
                  </div>
                )}
              </div>

              {/* 底部操作工具条 */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginTop: 14,
                  paddingTop: 10,
                  borderTop: '1px solid var(--border)'
                }}
              >
                <button
                  className="btn btn-xs btn-secondary"
                  onClick={() => handlePingProvider(p)}
                  disabled={ping?.testing}
                  style={{ gap: 4, fontSize: 11 }}
                >
                  <span>⚡</span>
                  <span>测速</span>
                </button>

                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    className="btn btn-xs btn-secondary"
                    onClick={() => handleOpenEdit(p)}
                    style={{ fontSize: 11 }}
                  >
                    ✏️ 编辑
                  </button>
                  <button
                    className="btn btn-xs btn-secondary"
                    onClick={() => handleDeleteProvider(p.id)}
                    style={{ fontSize: 11, color: 'var(--text-danger)' }}
                  >
                    🗑️
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* ==================================================== */}
      {/* 添加 / 编辑 Provider 模态弹窗 (Drawer Modal) */}
      {/* ==================================================== */}
      {editingModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            background: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20
          }}
        >
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: 540,
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: 24,
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
              border: '1px solid var(--border)'
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 16
              }}
            >
              <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>
                {editingProvider ? '✏️ 编辑服务商 Provider' : '➕ 添加新模型服务商 (Provider)'}
              </div>
              <button
                onClick={() => setEditingModalOpen(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  fontSize: 18,
                  color: 'var(--text-muted)',
                  cursor: 'pointer'
                }}
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={handleSaveModal}
              style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
            >
              {/* 快速预设模板选择 */}
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: 12,
                    fontWeight: 500,
                    color: 'var(--text-secondary)',
                    marginBottom: 6
                  }}
                >
                  预设服务商模板 (Template)
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {Object.values(PROVIDER_TEMPLATES).map((tmpl) => {
                    const isSelected = modalFormData.type === tmpl.id
                    return (
                      <button
                        key={tmpl.id}
                        type="button"
                        onClick={() => handleTemplateChange(tmpl.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '5px 10px',
                          borderRadius: 6,
                          border: isSelected
                            ? '1.5px solid var(--accent-blue)'
                            : '1px solid var(--border)',
                          background: isSelected
                            ? 'rgba(59, 130, 246, 0.12)'
                            : 'var(--bg-elevated)',
                          color: isSelected ? 'var(--accent-blue)' : 'var(--text-primary)',
                          fontSize: 12,
                          cursor: 'pointer'
                        }}
                      >
                        <span>{tmpl.icon}</span>
                        <span>{tmpl.name}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* 自定义别名 */}
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: 12,
                    fontWeight: 500,
                    color: 'var(--text-primary)',
                    marginBottom: 6
                  }}
                >
                  Provider 显示名称
                </label>
                <input
                  type="text"
                  value={modalFormData.name}
                  onChange={(e) => setModalFormData({ ...modalFormData, name: e.target.value })}
                  placeholder="例如：我的 DeepSeek 专线 / 硅基流动主力节点"
                  required
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 6,
                    border: '1px solid var(--border)',
                    background: 'var(--bg-base)',
                    color: 'var(--text-primary)',
                    fontSize: 13,
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* Base URL */}
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: 12,
                    fontWeight: 500,
                    color: 'var(--text-primary)',
                    marginBottom: 6
                  }}
                >
                  服务接口 Base URL
                </label>
                <input
                  type="text"
                  value={modalFormData.baseUrl}
                  onChange={(e) => setModalFormData({ ...modalFormData, baseUrl: e.target.value })}
                  placeholder="https://api.deepseek.com/v1"
                  required
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 6,
                    border: '1px solid var(--border)',
                    background: 'var(--bg-base)',
                    color: 'var(--text-primary)',
                    fontSize: 13,
                    fontFamily: 'monospace',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* API Key */}
              <div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: 12,
                    fontWeight: 500,
                    color: 'var(--text-primary)',
                    marginBottom: 6
                  }}
                >
                  <span>API Key 访问密钥</span>
                  {PROVIDER_TEMPLATES[modalFormData.type]?.keyHelpUrl && (
                    <a
                      href={PROVIDER_TEMPLATES[modalFormData.type].keyHelpUrl}
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: 'var(--accent-blue)', fontSize: 11, textDecoration: 'none' }}
                    >
                      获取 Key ↗
                    </a>
                  )}
                </div>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showKey ? 'text' : 'password'}
                    value={modalFormData.apiKey}
                    onChange={(e) => setModalFormData({ ...modalFormData, apiKey: e.target.value })}
                    placeholder={
                      modalFormData.type === 'ollama' ? '本地模型无需填 Key' : 'sk-xxxxxxxxxxxxxxxx'
                    }
                    disabled={modalFormData.type === 'ollama'}
                    style={{
                      width: '100%',
                      padding: '8px 36px 8px 12px',
                      borderRadius: 6,
                      border: '1px solid var(--border)',
                      background:
                        modalFormData.type === 'ollama' ? 'var(--bg-elevated)' : 'var(--bg-base)',
                      color: 'var(--text-primary)',
                      fontSize: 13,
                      fontFamily: 'monospace',
                      boxSizing: 'border-box'
                    }}
                  />
                  {modalFormData.type !== 'ollama' && (
                    <button
                      type="button"
                      onClick={() => setShowKey(!showKey)}
                      style={{
                        position: 'absolute',
                        right: 10,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-secondary)',
                        cursor: 'pointer',
                        fontSize: 14,
                        padding: 0
                      }}
                    >
                      {showKey ? '🙈' : '👁️'}
                    </button>
                  )}
                </div>
              </div>

              {/* Model */}
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: 12,
                    fontWeight: 500,
                    color: 'var(--text-primary)',
                    marginBottom: 6
                  }}
                >
                  默认模型 (Model Name)
                </label>
                <input
                  type="text"
                  value={modalFormData.model}
                  onChange={(e) => setModalFormData({ ...modalFormData, model: e.target.value })}
                  placeholder="deepseek-chat"
                  required
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 6,
                    border: '1px solid var(--border)',
                    background: 'var(--bg-base)',
                    color: 'var(--text-primary)',
                    fontSize: 13,
                    fontFamily: 'monospace',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* 弹窗连通性测试诊断条 */}
              {modalTestResult && (
                <div
                  style={{
                    padding: '8px 12px',
                    borderRadius: 6,
                    fontSize: 12,
                    background: modalTestResult.success
                      ? 'var(--accent-green-dim)'
                      : 'var(--accent-red-dim)',
                    color: modalTestResult.success ? 'var(--accent-green)' : 'var(--accent-red)',
                    border: `1px solid ${
                      modalTestResult.success ? 'rgba(74, 222, 128, 0.3)' : 'rgba(239, 68, 68, 0.3)'
                    }`
                  }}
                >
                  {modalTestResult.success ? '✅ ' : '❌ '}
                  {modalTestResult.msg}
                </div>
              )}

              {/* 底部按钮栏 */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginTop: 10,
                  paddingTop: 12,
                  borderTop: '1px solid var(--border)'
                }}
              >
                <button
                  type="button"
                  className="btn btn-sm btn-secondary"
                  onClick={handleModalTest}
                  disabled={modalTesting}
                  style={{ gap: 6, fontSize: 12 }}
                >
                  {modalTesting ? '正在测试...' : '⚡ 测试连通性'}
                </button>

                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    type="button"
                    className="btn btn-sm btn-secondary"
                    onClick={() => setEditingModalOpen(false)}
                    style={{ fontSize: 12 }}
                  >
                    取消
                  </button>
                  <button type="submit" className="btn btn-sm btn-primary" style={{ fontSize: 12 }}>
                    💾 保存并启用
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

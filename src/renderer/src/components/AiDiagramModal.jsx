import { useState, useEffect, useRef } from 'react'
import { parseMermaidToExcalidraw } from '@excalidraw/mermaid-to-excalidraw'

const DEFAULT_CONFIG = {
  provider: 'deepseek',
  baseUrl: 'https://api.deepseek.com/v1',
  apiKey: '',
  model: 'deepseek-chat'
}

const PROVIDER_PRESETS = {
  deepseek: {
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    model: 'deepseek-chat',
    hint: '性价比极高，结构化与流程图能力出众'
  },
  openai: {
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
    hint: '官方 OpenAI 接口'
  },
  qwen: {
    name: '通义千问 (DashScope)',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    model: 'qwen-plus',
    hint: '阿里云百炼兼容 OpenAI 协议'
  },
  ollama: {
    name: 'Ollama 本地模型',
    baseUrl: 'http://localhost:11434/v1',
    model: 'llama3:latest',
    hint: '本地私有化部署，免 Key'
  },
  custom: {
    name: '自定义接口 (OpenAI 格式)',
    baseUrl: '',
    model: '',
    hint: '任何兼容 OpenAI /chat/completions 的代理服务'
  }
}

const PRESET_PROMPTS = [
  {
    title: '微服务电商下单架构',
    prompt:
      '画一个现代微服务电商下单与支付架构图，包含客户端/App、API网关(Kong)、用户服务、订单服务、库存服务、支付网关，底层包含MySQL主从、Redis缓存和RabbitMQ消息队列。'
  },
  {
    title: '用户登录鉴权时序图',
    prompt:
      '画一个基于 JWT 与 Refresh Token 的无状态鉴权时序图(sequenceDiagram)，包含前端客户端、API网关、认证服务AuthServer与数据库。'
  },
  {
    title: 'CI/CD 自动化流水线',
    prompt:
      '画一个 GitOps 风格的 CI/CD 流水线状态流转图，从开发者提交代码、代码审查、SonarQube扫描、Docker构建、Harbor推送，到自动化部署到 K8s 集群。'
  },
  {
    title: '订单生命周期状态机',
    prompt:
      '画一个订单状态流转状态机图，包含：待支付、已支付、已发货、已签收、已取消、退款中、已退款等状态及触发事件。'
  }
]

const BUILTIN_DEMO_MERMAID = `graph TD
    Client["客户端\nWeb / App"] -->|HTTPS 请求| Gateway["API 网关\n(Kong)"]
    Gateway -->|JWT 校验| Auth["认证服务\n(AuthServer)"]
    Gateway -->|路由分发| OrderSvc["订单微服务\n(状态流转)"]
    Gateway -->|路由分发| PaySvc["支付微服务\n(多渠道)"]
    OrderSvc -->|缓存查询| Redis[("Redis 缓存\n集群")]
    OrderSvc -->|事务写入| MySQL[("MySQL 主库\n(读写分离)")]
    OrderSvc -->|异步下单| MQ["RabbitMQ\n消息队列"]
    MQ -->|消费消息| PaySvc
    PaySvc -->|回调通知| ThirdPay["微信 / 支付宝\n支付接口"]`

const REFINEMENT_PRESETS = [
  {
    label: '⚡ 增加 Redis 缓存',
    prompt: '在业务服务与数据层之间增加 Redis 缓存集群，用于热点数据加速'
  },
  { label: '🛡️ 增加限流与熔断', prompt: '在网关层增加限流熔断器，以及 API 鉴权校验' },
  {
    label: '📬 增加异步消息队列',
    prompt: '在核心服务后增加 RabbitMQ 异步消息队列，用于事件解耦与削峰'
  },
  {
    label: '🗄️ 数据库读写分离',
    prompt: '将数据库升级为 MySQL 主库（写）与从库（只读），并加同步链路'
  },
  { label: '⚠️ 补充异常重试分支', prompt: '对核心流程补充异常失败捕获、自动重试与告警通知分支' },
  { label: '📊 增加链路追踪监控', prompt: '在各服务节点增加 Prometheus 指标采集与分布式链路监控' }
]

const COLOR_THEMES = {
  default: {
    id: 'default',
    name: '经典黑白',
    desc: '最纯粹的极简手绘白板风',
    nodeBg: '#ffffff',
    nodeBorder: '#1e1e1e',
    arrowColor: '#1e1e1e',
    textColor: '#1e1e1e',
    fillStyle: 'hachure',
    badgeColors: ['#ffffff', '#868e96', '#1e1e1e']
  },
  techBlue: {
    id: 'techBlue',
    name: '极客科技蓝',
    desc: '清晰现代的云原生科技感',
    nodeBg: '#e7f5ff',
    nodeBorder: '#1971c2',
    arrowColor: '#228be6',
    textColor: '#1864ab',
    fillStyle: 'hachure',
    badgeColors: ['#e7f5ff', '#339af0', '#1864ab']
  },
  emeraldGreen: {
    id: 'emeraldGreen',
    name: '莫兰迪自然绿',
    desc: '清新舒适的低饱和森林色',
    nodeBg: '#ebfbee',
    nodeBorder: '#2b8a3e',
    arrowColor: '#40c057',
    textColor: '#2b8a3e',
    fillStyle: 'hachure',
    badgeColors: ['#ebfbee', '#51cf66', '#2b8a3e']
  },
  cyberPurple: {
    id: 'cyberPurple',
    name: '霓虹赛博紫',
    desc: '高级优雅的前沿创新感',
    nodeBg: '#f3f0ff',
    nodeBorder: '#6741d9',
    arrowColor: '#7950f2',
    textColor: '#5f3dc4',
    fillStyle: 'hachure',
    badgeColors: ['#f3f0ff', '#845ef7', '#5f3dc4']
  },
  sunsetOrange: {
    id: 'sunsetOrange',
    name: '落日暖阳橙',
    desc: '醒目温暖的高能商务色',
    nodeBg: '#fff4e6',
    nodeBorder: '#e8590c',
    arrowColor: '#fd7e14',
    textColor: '#d9480f',
    fillStyle: 'hachure',
    badgeColors: ['#fff4e6', '#ff922b', '#d9480f']
  },
  multiLayer: {
    id: 'multiLayer',
    name: '多彩架构分层',
    desc: '不同架构层级自动分配协调主题色',
    isMulti: true,
    palette: [
      { nodeBg: '#e7f5ff', nodeBorder: '#1971c2', arrowColor: '#228be6', textColor: '#1864ab' },
      { nodeBg: '#ebfbee', nodeBorder: '#2b8a3e', arrowColor: '#40c057', textColor: '#2b8a3e' },
      { nodeBg: '#f3f0ff', nodeBorder: '#6741d9', arrowColor: '#7950f2', textColor: '#5f3dc4' },
      { nodeBg: '#fff4e6', nodeBorder: '#e8590c', arrowColor: '#fd7e14', textColor: '#d9480f' },
      { nodeBg: '#fff0f6', nodeBorder: '#c2255c', arrowColor: '#e64980', textColor: '#a61e4d' }
    ],
    badgeColors: ['#1971c2', '#2b8a3e', '#6741d9', '#e8590c']
  },
  custom: {
    id: 'custom',
    name: '自定义配色',
    desc: '自由定义背景、边框与线条色值',
    isCustom: true,
    badgeColors: ['#339af0', '#fab005', '#f06595']
  }
}

// 给 Excalidraw 图元智能着色
function applyColorSchemeToElements(elements, themeConfig) {
  if (!elements || elements.length === 0 || !themeConfig || themeConfig.id === 'default') {
    return elements
  }

  // 多彩分层模式
  if (themeConfig.isMulti && themeConfig.palette) {
    let nodeIndex = 0
    const nodeThemeMap = {}
    return elements.map((el) => {
      if (el.type === 'rectangle' || el.type === 'diamond' || el.type === 'ellipse') {
        const pal = themeConfig.palette[nodeIndex % themeConfig.palette.length]
        nodeIndex++
        nodeThemeMap[el.id] = pal
        return {
          ...el,
          backgroundColor: pal.nodeBg,
          strokeColor: pal.nodeBorder,
          fillStyle: pal.fillStyle || 'hachure',
          roughness: el.roughness ?? 1
        }
      }
      if (el.type === 'arrow' || el.type === 'line') {
        return {
          ...el,
          strokeColor: themeConfig.palette[0].arrowColor
        }
      }
      if (el.type === 'text') {
        if (el.containerId && nodeThemeMap[el.containerId]) {
          return {
            ...el,
            strokeColor: nodeThemeMap[el.containerId].textColor
          }
        }
        return el
      }
      return el
    })
  }

  // 单一色系模式（或自定义配色）
  const { nodeBg, nodeBorder, arrowColor, textColor, fillStyle } = themeConfig
  return elements.map((el) => {
    if (el.type === 'rectangle' || el.type === 'diamond' || el.type === 'ellipse') {
      return {
        ...el,
        backgroundColor: nodeBg || el.backgroundColor,
        strokeColor: nodeBorder || el.strokeColor,
        fillStyle: fillStyle || 'hachure',
        roughness: el.roughness ?? 1
      }
    }
    if (el.type === 'arrow' || el.type === 'line') {
      return {
        ...el,
        strokeColor: arrowColor || el.strokeColor
      }
    }
    if (el.type === 'text') {
      return {
        ...el,
        strokeColor: textColor || el.strokeColor
      }
    }
    return el
  })
}

export default function AiDiagramModal({
  isOpen,
  onClose,
  onInsertElements,
  currentMermaid = '',
  onUpdateCurrentMermaid
}) {
  const [activeTab, setActiveTab] = useState('prompt') // 'prompt' | 'mermaid' | 'settings'
  const [mode, setMode] = useState('new') // 'new' | 'refine'
  const [promptText, setPromptText] = useState('')
  const [mermaidCode, setMermaidCode] = useState('')
  const [config, setConfig] = useState(() => {
    try {
      const saved = localStorage.getItem('flywork_ai_diagram_config')
      if (saved) return JSON.parse(saved)
    } catch (e) {
      console.error('Failed to load AI diagram config', e)
    }
    return DEFAULT_CONFIG
  })
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [statusText, setStatusText] = useState('')
  const [streamText, setStreamText] = useState('')
  const [streamDone, setStreamDone] = useState(false)
  const currentStreamIdRef = useRef('')
  const streamConsoleRef = useRef(null)

  // 配色方案与自定义调色板状态
  const [selectedThemeId, setSelectedThemeId] = useState(() => {
    return localStorage.getItem('flywork_ai_diagram_color_theme') || 'default'
  })
  const [customColors, setCustomColors] = useState(() => {
    try {
      const saved = localStorage.getItem('flywork_ai_diagram_custom_colors')
      if (saved) return JSON.parse(saved)
    } catch (e) {
      console.warn('Failed to load custom colors', e)
    }
    return {
      nodeBg: '#e7f5ff',
      nodeBorder: '#1971c2',
      arrowColor: '#228be6',
      textColor: '#1864ab',
      fillStyle: 'hachure'
    }
  })

  const handleSelectTheme = (themeId) => {
    setSelectedThemeId(themeId)
    localStorage.setItem('flywork_ai_diagram_color_theme', themeId)
  }

  const handleUpdateCustomColors = (newCustom) => {
    setCustomColors(newCustom)
    localStorage.setItem('flywork_ai_diagram_custom_colors', JSON.stringify(newCustom))
  }

  const getActiveThemeConfig = () => {
    if (selectedThemeId === 'custom') {
      return {
        id: 'custom',
        name: '自定义配色',
        ...customColors
      }
    }
    return COLOR_THEMES[selectedThemeId] || COLOR_THEMES.default
  }

  const renderColorSchemeSelector = () => (
    <div style={{ marginBottom: 16 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 8
        }}
      >
        <div
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--text-secondary)',
            display: 'flex',
            alignItems: 'center',
            gap: 6
          }}
        >
          <span>🎨 配色模板：</span>
          <span style={{ color: 'var(--text-accent)', fontWeight: 600 }}>
            {COLOR_THEMES[selectedThemeId]?.name || '经典黑白'}
          </span>
          <span style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 400 }}>
            ({COLOR_THEMES[selectedThemeId]?.desc || ''})
          </span>
        </div>
      </div>

      {/* 预设色板徽章列表 */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {Object.values(COLOR_THEMES).map((theme) => {
          const isSelected = selectedThemeId === theme.id
          return (
            <button
              key={theme.id}
              onClick={() => handleSelectTheme(theme.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 12px',
                borderRadius: 20,
                border: isSelected ? '1.5px solid var(--accent-blue)' : '1px solid var(--border)',
                background: isSelected ? 'rgba(59, 130, 246, 0.12)' : 'var(--bg-elevated)',
                color: isSelected ? 'var(--accent-blue)' : 'var(--text-primary)',
                fontSize: 12,
                fontWeight: isSelected ? 600 : 400,
                cursor: 'pointer',
                transition: 'all 0.15s'
              }}
            >
              {/* 三色点指示器 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                {theme.badgeColors.map((c, i) => (
                  <span
                    key={i}
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: c,
                      border: '1px solid rgba(0,0,0,0.15)',
                      display: 'inline-block'
                    }}
                  />
                ))}
              </div>
              <span>{theme.name}</span>
            </button>
          )
        })}
      </div>

      {/* 自定义配色展开面板 */}
      {selectedThemeId === 'custom' && (
        <div
          style={{
            marginTop: 12,
            padding: 14,
            borderRadius: 8,
            background: 'var(--bg-elevated)',
            border: '1px dashed var(--accent-blue)'
          }}
        >
          <div
            style={{
              fontSize: 12,
              color: 'var(--text-secondary)',
              marginBottom: 10,
              fontWeight: 500
            }}
          >
            🛠️ 自定义各组件色值与手绘填充：
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))',
              gap: 12
            }}
          >
            {/* 节点填充色 */}
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: 11,
                  color: 'var(--text-secondary)',
                  marginBottom: 4
                }}
              >
                节点填充色
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input
                  type="color"
                  value={customColors.nodeBg}
                  onChange={(e) =>
                    handleUpdateCustomColors({ ...customColors, nodeBg: e.target.value })
                  }
                  style={{
                    width: 26,
                    height: 26,
                    padding: 0,
                    border: 'none',
                    borderRadius: 4,
                    cursor: 'pointer'
                  }}
                />
                <span
                  style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text-primary)' }}
                >
                  {customColors.nodeBg}
                </span>
              </div>
            </div>

            {/* 节点边框色 */}
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: 11,
                  color: 'var(--text-secondary)',
                  marginBottom: 4
                }}
              >
                节点边框色
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input
                  type="color"
                  value={customColors.nodeBorder}
                  onChange={(e) =>
                    handleUpdateCustomColors({ ...customColors, nodeBorder: e.target.value })
                  }
                  style={{
                    width: 26,
                    height: 26,
                    padding: 0,
                    border: 'none',
                    borderRadius: 4,
                    cursor: 'pointer'
                  }}
                />
                <span
                  style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text-primary)' }}
                >
                  {customColors.nodeBorder}
                </span>
              </div>
            </div>

            {/* 连线与箭头色 */}
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: 11,
                  color: 'var(--text-secondary)',
                  marginBottom: 4
                }}
              >
                连线与箭头
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input
                  type="color"
                  value={customColors.arrowColor}
                  onChange={(e) =>
                    handleUpdateCustomColors({ ...customColors, arrowColor: e.target.value })
                  }
                  style={{
                    width: 26,
                    height: 26,
                    padding: 0,
                    border: 'none',
                    borderRadius: 4,
                    cursor: 'pointer'
                  }}
                />
                <span
                  style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text-primary)' }}
                >
                  {customColors.arrowColor}
                </span>
              </div>
            </div>

            {/* 文字颜色 */}
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: 11,
                  color: 'var(--text-secondary)',
                  marginBottom: 4
                }}
              >
                文字颜色
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input
                  type="color"
                  value={customColors.textColor}
                  onChange={(e) =>
                    handleUpdateCustomColors({ ...customColors, textColor: e.target.value })
                  }
                  style={{
                    width: 26,
                    height: 26,
                    padding: 0,
                    border: 'none',
                    borderRadius: 4,
                    cursor: 'pointer'
                  }}
                />
                <span
                  style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text-primary)' }}
                >
                  {customColors.textColor}
                </span>
              </div>
            </div>

            {/* 填充工艺 */}
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: 11,
                  color: 'var(--text-secondary)',
                  marginBottom: 4
                }}
              >
                手绘工艺
              </label>
              <select
                value={customColors.fillStyle || 'hachure'}
                onChange={(e) =>
                  handleUpdateCustomColors({ ...customColors, fillStyle: e.target.value })
                }
                style={{
                  width: '100%',
                  height: 26,
                  padding: '2px 6px',
                  borderRadius: 4,
                  border: '1px solid var(--border)',
                  background: 'var(--bg-base)',
                  color: 'var(--text-primary)',
                  fontSize: 11
                }}
              >
                <option value="hachure">手绘斜线 (Hachure)</option>
                <option value="solid">纯色平涂 (Solid)</option>
                <option value="cross-hatch">网状交叉 (Cross-hatch)</option>
              </select>
            </div>
          </div>

          {/* 实时微缩预览 */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              marginTop: 12,
              padding: '8px 14px',
              borderRadius: 6,
              background: 'rgba(0,0,0,0.2)',
              border: '1px solid var(--border)'
            }}
          >
            <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>实时预览：</span>
            <div
              style={{
                padding: '4px 10px',
                borderRadius: 4,
                background: customColors.nodeBg,
                border: `2px solid ${customColors.nodeBorder}`,
                color: customColors.textColor,
                fontSize: 11,
                fontWeight: 600
              }}
            >
              客户端/App
            </div>
            <div style={{ display: 'flex', alignItems: 'center', color: customColors.arrowColor }}>
              <span style={{ fontSize: 11, fontWeight: 'bold' }}>──▶</span>
            </div>
            <div
              style={{
                padding: '4px 10px',
                borderRadius: 4,
                background: customColors.nodeBg,
                border: `2px solid ${customColors.nodeBorder}`,
                color: customColors.textColor,
                fontSize: 11,
                fontWeight: 600
              }}
            >
              API微服务网关
            </div>
          </div>
        </div>
      )}
    </div>
  )

  const prevOpenRef = useRef(isOpen)

  // 每次打开弹窗时，如果画布已有图表，默认进入“在此图基础上完善”模式
  useEffect(() => {
    if (!prevOpenRef.current && isOpen) {
      setMode(currentMermaid && currentMermaid.trim() ? 'refine' : 'new')
      setStreamText('')
      setStreamDone(false)
      setErrorMsg('')
      setStatusText('')
    }
    prevOpenRef.current = isOpen
  }, [isOpen, currentMermaid])

  // 监听来自主进程的流式 Chunk 推送
  useEffect(() => {
    if (!window.flywork?.onAiDiagramChunk) return
    const unsubscribe = window.flywork.onAiDiagramChunk(({ streamId, fullText, done }) => {
      if (streamId && streamId === currentStreamIdRef.current) {
        setStreamText(fullText || '')
        if (done) {
          setStreamDone(true)
        }
        // 自动平滑滚动到底部
        if (streamConsoleRef.current) {
          streamConsoleRef.current.scrollTop = streamConsoleRef.current.scrollHeight
        }
      }
    })
    return () => {
      if (typeof unsubscribe === 'function') unsubscribe()
    }
  }, [])

  const saveConfig = (newConfig) => {
    setConfig(newConfig)
    localStorage.setItem('flywork_ai_diagram_config', JSON.stringify(newConfig))
  }

  const handleProviderChange = (pKey) => {
    const preset = PROVIDER_PRESETS[pKey]
    if (preset && pKey !== 'custom') {
      const updated = {
        ...config,
        provider: pKey,
        baseUrl: preset.baseUrl,
        model: preset.model
      }
      saveConfig(updated)
    } else {
      saveConfig({ ...config, provider: 'custom' })
    }
  }

  // 自动平铺清洗 Mermaid 中的 subgraph 语法，避免 Mermaid v11 DOM 查询缺陷导致降级为不可渲染的 SVG 图片
  function flattenMermaidSubgraphs(code) {
    if (!code) return code
    const lines = code.split('\n')
    const result = []
    for (const line of lines) {
      const trimmed = line.trim()
      // 忽略 subgraph 开头和对应的 end
      if (/^subgraph\s+/i.test(trimmed)) {
        continue
      }
      if (trimmed === 'end') {
        continue
      }
      result.push(line)
    }
    return result.join('\n')
  }

  // 将 Mermaid 代码转为 Excalidraw 并插入
  const insertMermaidToCanvas = async (code) => {
    try {
      setStatusText('正在将图表转换为手绘白板图元...')
      let cleaned = code.trim()
      if (cleaned.startsWith('```mermaid')) {
        cleaned = cleaned.replace(/^```mermaid\s*/, '').replace(/```$/, '')
      } else if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```\s*/, '').replace(/```$/, '')
      }
      cleaned = cleaned.trim()

      // 预平铺：去除 subgraph 嵌套，确保 100% 生成 Excalidraw 原生手绘图元，避免触发 SVG 降级
      const sanitizedCode = flattenMermaidSubgraphs(cleaned)

      let { elements, files } = await parseMermaidToExcalidraw(sanitizedCode, {
        flowchart: {
          curve: 'linear'
        },
        themeVariables: {
          fontSize: '14px'
        }
      })

      // 如果仍包含图片降级图元，彻底过滤为标准流程图语法
      if (elements && elements.some((el) => el.type === 'image')) {
        const pureFlowchart = sanitizedCode
          .replace(/\b(subgraph|end)\b/gi, '')
          .replace(/^\s*[\r\n]/gm, '')
        const fallbackRes = await parseMermaidToExcalidraw(pureFlowchart, {
          flowchart: { curve: 'linear' },
          themeVariables: { fontSize: '14px' }
        })
        if (fallbackRes.elements && fallbackRes.elements.length > 0) {
          elements = fallbackRes.elements
          files = fallbackRes.files
        }
      }

      if (!elements || elements.length === 0) {
        throw new Error('未生成有效图元，请检查 Mermaid 语法')
      }

      const activeTheme = getActiveThemeConfig()
      const coloredElements = applyColorSchemeToElements(elements, activeTheme)

      onInsertElements({
        elements: coloredElements,
        files,
        isRefine: mode === 'refine' && Boolean(currentMermaid)
      })

      if (typeof onUpdateCurrentMermaid === 'function') {
        onUpdateCurrentMermaid(cleaned)
      }

      onClose()
    } catch (err) {
      console.error('Mermaid parse error:', err)
      setErrorMsg(`转换为白板图元失败: ${err.message || err}`)
    } finally {
      setLoading(false)
      setStatusText('')
    }
  }

  // 调用大模型生成 / 增量完善 Mermaid
  const handleGenerate = async () => {
    setErrorMsg('')
    if (!promptText.trim()) {
      setErrorMsg('请输入你的绘图需求或修改意见')
      return
    }

    if (!config.apiKey && config.provider !== 'ollama') {
      setErrorMsg('请在右上方「模型设置」中配置大模型的 API Key，或切换为本地 Ollama。')
      return
    }

    setLoading(true)
    setStreamText('')
    setStreamDone(false)
    const streamId = 'stream_' + Date.now()
    currentStreamIdRef.current = streamId

    try {
      let systemPrompt = ''
      let finalPrompt = ''

      if (mode === 'refine' && currentMermaid && currentMermaid.trim()) {
        // 增量完善模式
        setStatusText('AI 正在基于当前图表进行增量完善与重新排版...')
        systemPrompt = `You are a world-class system architect and diagramming expert.
Your task is to ITERATIVELY REFINE and EXTEND an existing Mermaid diagram based on the user's modification request.

CRITICAL RULES:
1. ONLY return the updated Mermaid diagram inside \`\`\`mermaid ... \`\`\` code block.
2. Do not include any explanations, greetings, or pleasantries outside the code block.
3. Preserve existing nodes, node IDs, and core relationships to maintain design continuity.
4. Keep node titles readable, clear and concise (preferably 4-8 Chinese characters).
5. Avoid syntax errors: wrap node labels containing spaces, punctuation or special characters in quotes, e.g. Node["Label (Detail)"].
6. IMPORTANT for layout: Keep node width compact so it never overlaps arrows. If a label has more than 7 Chinese characters, ALWAYS use "\\n" to split into two balanced lines, e.g. Node["订单微服务\\n(核心状态)"] instead of one long line.
7. Edge/Arrow labels MUST be very short (2-6 Chinese characters), e.g. -->|HTTPS 请求| or -->|异步通知| to prevent covering lines.
8. CRITICAL: NEVER use "subgraph ... end" syntax! Excalidraw requires a flat flowchart. Represent layers directly with connected nodes.`

        finalPrompt = `【当前已有图表结构】：
\`\`\`mermaid
${currentMermaid.trim()}
\`\`\`

【本次增量完善需求】：
${promptText.trim()}

请在现有图表基础上完成增量修改，保留原有核心结构，输出更新后的完整 Mermaid 代码。`
      } else {
        // 全新建图模式
        setStatusText('AI 正在构思架构与流程图...')
        systemPrompt = `You are a world-class system architect and diagramming expert.
Your task is to convert the user's natural language architecture/flowchart request into standard, clean Mermaid syntax.

CRITICAL RULES:
1. ONLY return the Mermaid diagram code inside \`\`\`mermaid ... \`\`\` code block.
2. Do not include any explanations, greetings, or pleasantries outside the code block.
3. Supported types: flowchart (graph TD/graph LR), sequenceDiagram, classDiagram, stateDiagram-v2.
4. Keep node titles readable, clear and concise (preferably 4-8 Chinese characters).
5. Avoid syntax errors: wrap node labels containing spaces, punctuation or special characters in quotes, e.g. Node["Label (Detail)"].
6. IMPORTANT for layout: Keep node width compact so it never overlaps arrows. If a label has more than 7 Chinese characters, ALWAYS use "\\n" to split into two balanced lines, e.g. Node["订单微服务\\n(核心状态)"] instead of one long line.
7. Edge/Arrow labels MUST be very short (2-6 Chinese characters), e.g. -->|HTTPS 请求| or -->|异步通知| to prevent covering lines.
8. CRITICAL: NEVER use "subgraph ... end" syntax! Excalidraw requires a flat flowchart. Represent layers directly with connected nodes.`

        finalPrompt = promptText.trim()
      }

      // 优先走 Electron 主进程 IPC 请求（支持 stream 流式打字机）
      if (window.flywork?.requestAiDiagram) {
        const result = await window.flywork.requestAiDiagram({
          baseUrl: config.baseUrl,
          apiKey: config.apiKey,
          model: config.model || 'deepseek-chat',
          prompt: finalPrompt,
          systemPrompt,
          streamId
        })

        if (!result.success) {
          throw new Error(result.error)
        }

        await insertMermaidToCanvas(result.mermaid)
        return
      }

      // 降级回退（浏览器环境）
      const endpoint = `${config.baseUrl.replace(/\/+$/, '')}/chat/completions`
      const headers = {
        'Content-Type': 'application/json'
      }
      if (config.apiKey) {
        headers['Authorization'] = `Bearer ${config.apiKey.trim()}`
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: config.model || 'deepseek-chat',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: finalPrompt }
          ],
          temperature: 0.2
        })
      })

      if (!res.ok) {
        const errorText = await res.text()
        throw new Error(`API 响应错误 [${res.status}]: ${errorText}`)
      }

      const data = await res.json()
      const content = data.choices?.[0]?.message?.content || ''

      const match = content.match(/```(?:mermaid)?([\s\S]*?)```/)
      const parsedMermaid = match ? match[1].trim() : content.trim()

      if (!parsedMermaid) {
        throw new Error('大模型未返回有效的图表语法，请重试')
      }

      await insertMermaidToCanvas(parsedMermaid)
    } catch (err) {
      console.error('AI Generate Error:', err)
      setErrorMsg(`生成失败: ${err.message || err}`)
      setLoading(false)
      setStatusText('')
    }
  }

  const handleInsertDemo = async () => {
    setErrorMsg('')
    setLoading(true)
    await insertMermaidToCanvas(BUILTIN_DEMO_MERMAID)
  }

  if (!isOpen) return null

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(4px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: 720,
          maxWidth: '95vw',
          maxHeight: '90vh',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'fadeIn 0.2s ease'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--bg-base)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 28,
                height: 28,
                borderRadius: 6,
                background: 'linear-gradient(135deg, #a371f7, #4f9ef8)',
                color: '#fff'
              }}
            >
              ✨
            </span>
            <div>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>
                AI 智能绘图 (Text to Diagram)
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                自然语言一键转为手绘白板图，可任意二次编辑
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              padding: 6,
              borderRadius: 6,
              fontSize: 16
            }}
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid var(--border)',
            background: 'var(--bg-elevated)',
            padding: '0 16px'
          }}
        >
          <button
            onClick={() => {
              setActiveTab('prompt')
              setErrorMsg('')
            }}
            style={{
              padding: '10px 16px',
              background: 'transparent',
              border: 'none',
              borderBottom:
                activeTab === 'prompt' ? '2px solid var(--accent-blue)' : '2px solid transparent',
              color: activeTab === 'prompt' ? 'var(--text-primary)' : 'var(--text-secondary)',
              fontWeight: 500,
              fontSize: 13,
              cursor: 'pointer'
            }}
          >
            自然语言构图
          </button>
          <button
            onClick={() => {
              setActiveTab('mermaid')
              setErrorMsg('')
            }}
            style={{
              padding: '10px 16px',
              background: 'transparent',
              border: 'none',
              borderBottom:
                activeTab === 'mermaid' ? '2px solid var(--accent-blue)' : '2px solid transparent',
              color: activeTab === 'mermaid' ? 'var(--text-primary)' : 'var(--text-secondary)',
              fontWeight: 500,
              fontSize: 13,
              cursor: 'pointer'
            }}
          >
            直接导入 Mermaid
          </button>
          <button
            onClick={() => {
              setActiveTab('settings')
              setErrorMsg('')
            }}
            style={{
              marginLeft: 'auto',
              padding: '10px 16px',
              background: 'transparent',
              border: 'none',
              borderBottom:
                activeTab === 'settings'
                  ? '2px solid var(--accent-purple)'
                  : '2px solid transparent',
              color: activeTab === 'settings' ? 'var(--text-primary)' : 'var(--text-secondary)',
              fontWeight: 500,
              fontSize: 13,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            ⚙️ 模型设置
            {!config.apiKey && config.provider !== 'ollama' && (
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: 'var(--accent-amber)'
                }}
              />
            )}
          </button>
        </div>

        {/* Content Body */}
        <div style={{ padding: 20, overflowY: 'auto', flex: 1 }}>
          {errorMsg && (
            <div
              style={{
                marginBottom: 16,
                padding: '10px 14px',
                borderRadius: 8,
                background: 'rgba(224, 92, 92, 0.12)',
                border: '1px solid rgba(224, 92, 92, 0.3)',
                color: 'var(--text-danger)',
                fontSize: 12,
                lineHeight: 1.5
              }}
            >
              ⚠️ {errorMsg}
            </div>
          )}

          {activeTab === 'prompt' && (
            <div>
              {/* 模式选择器（在画布已有图表时透出） */}
              {currentMermaid && currentMermaid.trim() && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 14,
                    padding: '8px 12px',
                    borderRadius: 8,
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <button
                      onClick={() => setMode('refine')}
                      style={{
                        padding: '5px 12px',
                        borderRadius: 6,
                        border: 'none',
                        background: mode === 'refine' ? 'var(--accent-blue)' : 'transparent',
                        color: mode === 'refine' ? '#fff' : 'var(--text-secondary)',
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        transition: 'all 0.15s'
                      }}
                    >
                      <span>🔄</span>
                      <span>在当前图基础上完善</span>
                    </button>
                    <button
                      onClick={() => setMode('new')}
                      style={{
                        padding: '5px 12px',
                        borderRadius: 6,
                        border: 'none',
                        background: mode === 'new' ? 'var(--accent-blue)' : 'transparent',
                        color: mode === 'new' ? '#fff' : 'var(--text-secondary)',
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        transition: 'all 0.15s'
                      }}
                    >
                      <span>✨</span>
                      <span>创建全新图表</span>
                    </button>
                  </div>

                  <span
                    style={{
                      fontSize: 11,
                      color: 'var(--text-muted)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4
                    }}
                  >
                    基准拓扑已挂载 ({currentMermaid.trim().split('\n').length} 行)
                  </span>
                </div>
              )}

              <div style={{ marginBottom: 12 }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: 13,
                    fontWeight: 500,
                    color: 'var(--text-primary)',
                    marginBottom: 6
                  }}
                >
                  {mode === 'refine'
                    ? '输入你的完善需求（例如：增加 Redis 缓存、补充异常重试分支等）：'
                    : '输入你的架构或流程图需求：'}
                </label>
                <textarea
                  rows={mode === 'refine' ? 3 : 4}
                  value={promptText}
                  onChange={(e) => setPromptText(e.target.value)}
                  placeholder={
                    mode === 'refine'
                      ? '例如：在订单微服务与数据库之间加上 Redis 缓存集群，并在网关增加熔断限流...'
                      : '例如：帮我画一个高可用网关架构，包含负载均衡器、双机热备网关、内部服务路由、Redis 熔断限流器...'
                  }
                  style={{
                    width: '100%',
                    padding: 12,
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                    background: 'var(--bg-base)',
                    color: 'var(--text-primary)',
                    fontSize: 13,
                    fontFamily: 'inherit',
                    resize: 'vertical',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* 灵感模板（区分增量模式与建新图模式） */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>
                  {mode === 'refine'
                    ? '💡 点击一键选用常用增量完善方案：'
                    : '💡 点击使用预设灵感模板：'}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {mode === 'refine'
                    ? REFINEMENT_PRESETS.map((item, idx) => (
                        <button
                          key={idx}
                          onClick={() => setPromptText(item.prompt)}
                          style={{
                            padding: '5px 10px',
                            borderRadius: 6,
                            border: '1px solid var(--border)',
                            background: 'var(--bg-elevated)',
                            color: 'var(--text-primary)',
                            fontSize: 12,
                            cursor: 'pointer',
                            transition: 'all 0.15s'
                          }}
                          onMouseEnter={(e) =>
                            (e.currentTarget.style.borderColor = 'var(--accent-blue)')
                          }
                          onMouseLeave={(e) =>
                            (e.currentTarget.style.borderColor = 'var(--border)')
                          }
                        >
                          {item.label}
                        </button>
                      ))
                    : PRESET_PROMPTS.map((item, idx) => (
                        <button
                          key={idx}
                          onClick={() => setPromptText(item.prompt)}
                          style={{
                            padding: '5px 10px',
                            borderRadius: 6,
                            border: '1px solid var(--border)',
                            background: 'var(--bg-elevated)',
                            color: 'var(--text-primary)',
                            fontSize: 12,
                            cursor: 'pointer',
                            transition: 'all 0.15s'
                          }}
                          onMouseEnter={(e) =>
                            (e.currentTarget.style.borderColor = 'var(--accent-blue)')
                          }
                          onMouseLeave={(e) =>
                            (e.currentTarget.style.borderColor = 'var(--border)')
                          }
                        >
                          {item.title}
                        </button>
                      ))}
                </div>
              </div>

              {/* 🎨 图表配色方案选择 */}
              {renderColorSchemeSelector()}

              {/* 🚀 实时生成过程监视器控制台 */}
              {(loading || streamText) && (
                <div
                  style={{
                    marginBottom: 16,
                    borderRadius: 8,
                    border: '1px solid #30363d',
                    background: '#0d1117',
                    overflow: 'hidden',
                    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4)',
                    animation: 'fadeIn 0.2s ease'
                  }}
                >
                  {/* 控制台顶部状态栏 */}
                  <div
                    style={{
                      padding: '8px 14px',
                      background: '#161b22',
                      borderBottom: '1px solid #30363d',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: 12
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          background: streamDone ? '#2ea043' : '#58a6ff',
                          boxShadow: streamDone
                            ? '0 0 8px #2ea043'
                            : '0 0 8px rgba(88, 166, 255, 0.8)',
                          display: 'inline-block'
                        }}
                      />
                      <span style={{ color: '#e6edf3', fontWeight: 500 }}>
                        {statusText ||
                          (streamDone
                            ? '✅ 拓扑结构输出完毕，准备转换白板图元...'
                            : '⚡ 大模型正在实时输出 Mermaid 拓扑...')}
                      </span>
                    </div>
                    <span
                      style={{
                        color: '#8b949e',
                        fontSize: 11,
                        fontFamily: 'monospace'
                      }}
                    >
                      已生成 {streamText.length} 字符
                    </span>
                  </div>

                  {/* 实时打字机代码流 */}
                  <div
                    ref={streamConsoleRef}
                    style={{
                      padding: '12px 14px',
                      maxHeight: 170,
                      overflowY: 'auto',
                      fontFamily: 'Consolas, Monaco, "Courier New", monospace',
                      fontSize: 12,
                      lineHeight: 1.5,
                      color: '#7ee787',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-all',
                      background: '#0d1117'
                    }}
                  >
                    {streamText || (
                      <span style={{ color: '#8b949e', fontStyle: 'italic' }}>
                        正在建立推理连接，等待首批字符流返回...
                      </span>
                    )}
                    {!streamDone && loading && (
                      <span
                        style={{
                          display: 'inline-block',
                          width: 7,
                          height: 13,
                          background: '#7ee787',
                          marginLeft: 4,
                          verticalAlign: 'middle',
                          animation: 'pulse 1s infinite'
                        }}
                      >
                        ▊
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* 底部操作区 */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingTop: 12,
                  borderTop: '1px solid var(--border)'
                }}
              >
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  当前模型：
                  <span style={{ color: 'var(--text-accent)', fontWeight: 500, marginLeft: 4 }}>
                    {PROVIDER_PRESETS[config.provider]?.name || config.provider} ({config.model})
                  </span>
                </div>

                <div style={{ display: 'flex', gap: 10 }}>
                  {mode === 'new' && (
                    <button
                      onClick={handleInsertDemo}
                      disabled={loading}
                      style={{
                        padding: '8px 14px',
                        borderRadius: 6,
                        border: '1px solid var(--border)',
                        background: 'var(--bg-elevated)',
                        color: 'var(--text-secondary)',
                        fontSize: 12,
                        cursor: 'pointer'
                      }}
                    >
                      插入演示示例
                    </button>
                  )}
                  <button
                    onClick={handleGenerate}
                    disabled={loading}
                    style={{
                      padding: '8px 18px',
                      borderRadius: 6,
                      border: 'none',
                      background: loading ? 'var(--text-muted)' : 'var(--accent-blue)',
                      color: '#fff',
                      fontSize: 13,
                      fontWeight: 500,
                      cursor: loading ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6
                    }}
                  >
                    {loading
                      ? statusText || '生成中...'
                      : mode === 'refine'
                        ? '🔄 开始完善并更新画板'
                        : '✨ 开始构思并绘制'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'mermaid' && (
            <div>
              <div style={{ marginBottom: 12 }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: 13,
                    fontWeight: 500,
                    color: 'var(--text-primary)',
                    marginBottom: 6
                  }}
                >
                  粘贴 Mermaid 代码（支持 graph, sequenceDiagram, classDiagram 等）：
                </label>
                <textarea
                  rows={8}
                  value={mermaidCode}
                  onChange={(e) => setMermaidCode(e.target.value)}
                  placeholder={BUILTIN_DEMO_MERMAID}
                  style={{
                    width: '100%',
                    padding: 12,
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                    background: 'var(--bg-base)',
                    color: '#a5d6ff',
                    fontSize: 12,
                    fontFamily: 'monospace',
                    resize: 'vertical',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* 🎨 图表配色方案选择 */}
              {renderColorSchemeSelector()}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  onClick={() => setMermaidCode(BUILTIN_DEMO_MERMAID)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: 6,
                    border: '1px solid var(--border)',
                    background: 'var(--bg-elevated)',
                    color: 'var(--text-secondary)',
                    fontSize: 12,
                    cursor: 'pointer'
                  }}
                >
                  填充示例代码
                </button>
                <button
                  onClick={() => insertMermaidToCanvas(mermaidCode || BUILTIN_DEMO_MERMAID)}
                  disabled={loading}
                  style={{
                    padding: '8px 18px',
                    borderRadius: 6,
                    border: 'none',
                    background: 'var(--accent-green)',
                    color: '#fff',
                    fontSize: 13,
                    fontWeight: 500,
                    cursor: loading ? 'not-allowed' : 'pointer'
                  }}
                >
                  导入到白板
                </button>
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: 12,
                    color: 'var(--text-secondary)',
                    marginBottom: 6
                  }}
                >
                  模型供应商 (Provider)
                </label>
                <select
                  value={config.provider}
                  onChange={(e) => handleProviderChange(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: 6,
                    border: '1px solid var(--border)',
                    background: 'var(--bg-base)',
                    color: 'var(--text-primary)',
                    fontSize: 13
                  }}
                >
                  {Object.entries(PROVIDER_PRESETS).map(([key, item]) => (
                    <option key={key} value={key}>
                      {item.name}
                    </option>
                  ))}
                </select>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                  {PROVIDER_PRESETS[config.provider]?.hint}
                </div>
              </div>

              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: 12,
                    color: 'var(--text-secondary)',
                    marginBottom: 6
                  }}
                >
                  API Base URL
                </label>
                <input
                  type="text"
                  value={config.baseUrl}
                  onChange={(e) => saveConfig({ ...config, baseUrl: e.target.value })}
                  placeholder="https://api.deepseek.com/v1"
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: 6,
                    border: '1px solid var(--border)',
                    background: 'var(--bg-base)',
                    color: 'var(--text-primary)',
                    fontSize: 13,
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: 12,
                    color: 'var(--text-secondary)',
                    marginBottom: 6
                  }}
                >
                  API Key
                </label>
                <input
                  type="password"
                  value={config.apiKey}
                  onChange={(e) => saveConfig({ ...config, apiKey: e.target.value })}
                  placeholder={config.provider === 'ollama' ? '本地模型无需填 Key' : 'sk-...'}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: 6,
                    border: '1px solid var(--border)',
                    background: 'var(--bg-base)',
                    color: 'var(--text-primary)',
                    fontSize: 13,
                    boxSizing: 'border-box'
                  }}
                />
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                  配置仅保存在本地设备，不会上传至任何第三方服务器。
                </div>
              </div>

              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: 12,
                    color: 'var(--text-secondary)',
                    marginBottom: 6
                  }}
                >
                  模型名称 (Model)
                </label>
                <input
                  type="text"
                  value={config.model}
                  onChange={(e) => saveConfig({ ...config, model: e.target.value })}
                  placeholder="deepseek-chat / gpt-4o-mini"
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: 6,
                    border: '1px solid var(--border)',
                    background: 'var(--bg-base)',
                    color: 'var(--text-primary)',
                    fontSize: 13,
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
                <button
                  onClick={() => setActiveTab('prompt')}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 6,
                    border: 'none',
                    background: 'var(--accent-blue)',
                    color: '#fff',
                    fontSize: 13,
                    cursor: 'pointer'
                  }}
                >
                  保存并去生成图表
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

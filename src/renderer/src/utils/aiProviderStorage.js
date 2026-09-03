// 全局 AI Provider 节点存储与初始化模块 (类似 cc-switch)

export const DEFAULT_PROVIDERS = [
  {
    id: 'provider-deepseek-default',
    name: 'DeepSeek 官方',
    type: 'deepseek',
    icon: '🧠',
    baseUrl: 'https://api.deepseek.com/v1',
    apiKey: '',
    model: 'deepseek-chat',
    enabled: true,
    createdAt: Date.now()
  }
]

/**
 * 健壮获取已配置的 Providers 列表。
 * 如果本地存储为空，自动从旧配置迁移或初始化默认 DeepSeek 节点，并回写 localStorage。
 */
export function getInitialAiProviders() {
  try {
    const saved = localStorage.getItem('flywork_ai_providers')
    if (saved) {
      const parsed = JSON.parse(saved)
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed
      }
    }

    // 平滑兼容历史旧单例配置
    const legacy =
      localStorage.getItem('flywork_ai_model_config') ||
      localStorage.getItem('flywork_ai_diagram_config')
    let initialList = []

    if (legacy) {
      try {
        const parsedLegacy = JSON.parse(legacy)
        const type = parsedLegacy.provider || 'deepseek'
        let name = 'DeepSeek 官方'
        let icon = '🧠'
        if (type === 'openai') {
          name = 'OpenAI 官方'
          icon = '🌐'
        } else if (type === 'qwen') {
          name = '阿里通义千问'
          icon = '☁️'
        } else if (type === 'ollama') {
          name = 'Ollama 本地'
          icon = '🦙'
        } else if (type === 'siliconflow') {
          name = '硅基流动'
          icon = '🚀'
        }

        initialList = [
          {
            id: `provider-${type}-${Date.now()}`,
            name,
            type,
            icon,
            baseUrl: parsedLegacy.baseUrl || 'https://api.deepseek.com/v1',
            apiKey: parsedLegacy.apiKey || '',
            model: parsedLegacy.model || 'deepseek-chat',
            enabled: true,
            createdAt: Date.now()
          }
        ]
      } catch (err) {
        console.warn('Failed to parse legacy AI config', err)
      }
    }

    if (!initialList || initialList.length === 0) {
      initialList = DEFAULT_PROVIDERS
    }

    // 自动回写，保证全局统一
    localStorage.setItem('flywork_ai_providers', JSON.stringify(initialList))
    if (!localStorage.getItem('flywork_ai_active_provider_id')) {
      localStorage.setItem('flywork_ai_active_provider_id', initialList[0].id)
    }

    return initialList
  } catch (e) {
    console.warn('Failed to get initial AI providers', e)
    return DEFAULT_PROVIDERS
  }
}

/**
 * 获取当前激活的 Provider ID
 */
export function getActiveProviderId(providersList = []) {
  try {
    const activeId = localStorage.getItem('flywork_ai_active_provider_id')
    if (activeId && providersList.some((p) => p.id === activeId)) {
      return activeId
    }
  } catch (e) {
    console.warn('Failed to get active provider id', e)
  }
  return providersList[0]?.id || DEFAULT_PROVIDERS[0].id
}

/**
 * 激活指定的 Provider 并全局广播
 */
export function switchActiveProvider(providerId, providersList = []) {
  const target = providersList.find((p) => p.id === providerId)
  if (!target) return null

  localStorage.setItem('flywork_ai_active_provider_id', target.id)

  const legacyCompat = {
    provider: target.type,
    baseUrl: target.baseUrl,
    apiKey: target.apiKey,
    model: target.model
  }
  localStorage.setItem('flywork_ai_model_config', JSON.stringify(legacyCompat))
  localStorage.setItem('flywork_ai_diagram_config', JSON.stringify(legacyCompat))

  window.dispatchEvent(
    new CustomEvent('flywork_ai_config_updated', {
      detail: {
        ...legacyCompat,
        providerId: target.id,
        providerName: target.name
      }
    })
  )

  return target
}

/**
 * Jenkins REST API 客户端封装
 * 包含 Basic Auth 鉴权、CSRF Crumb 自动管理、错误规范化
 */

import { getConfig, getStoredToken } from './auth.js'

export class JenkinsError extends Error {
  constructor(message, code = 'JENKINS_ERROR', statusCode = 500) {
    super(message)
    this.name = 'JenkinsError'
    this.code = code
    this.statusCode = statusCode
  }
}

let cachedCrumb = null
let crumbFetchTime = 0
const CRUMB_TTL = 30 * 60 * 1000 // 30 minutes

/**
 * 获取 CSRF Crumb 令牌（如果 Jenkins 开启了 CSRF 保护）
 */
async function fetchCrumb(baseUrl, authHeader) {
  const now = Date.now()
  if (cachedCrumb && now - crumbFetchTime < CRUMB_TTL) {
    return cachedCrumb
  }

  try {
    const url = `${baseUrl}/crumbIssuer/api/json`
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 8000)

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: authHeader,
        Accept: 'application/json'
      },
      signal: controller.signal
    })

    clearTimeout(timeoutId)

    if (response.ok) {
      const data = await response.json()
      if (data && data.crumbRequestField && data.crumb) {
        cachedCrumb = {
          field: data.crumbRequestField,
          value: data.crumb
        }
        crumbFetchTime = now
        console.log('[Jenkins API] CSRF Crumb 获取成功:', cachedCrumb.field)
        return cachedCrumb
      }
    } else if (response.status === 404) {
      // CSRF 保护未开启或无 crumbIssuer 插件
      cachedCrumb = null
      crumbFetchTime = now
      return null
    }
  } catch (err) {
    console.warn('[Jenkins API] 获取 CSRF Crumb 失败或已禁用:', err.message)
  }

  return null
}

/**
 * 统一执行 Jenkins HTTP 请求
 */
export async function jenkinsRequest(method, path, data = null, options = {}) {
  const config = getConfig()
  const token = await getStoredToken()

  if (!config?.baseUrl || !config?.username || !token) {
    throw new JenkinsError('未配置 Jenkins 服务地址、用户名或 API Token', 'AUTH_REQUIRED', 401)
  }

  const baseUrl = config.baseUrl.replace(/\/+$/, '')
  const authHeader = 'Basic ' + Buffer.from(`${config.username}:${token}`).toString('base64')

  let crumb = null
  if (['POST', 'PUT', 'DELETE'].includes(method.toUpperCase())) {
    crumb = await fetchCrumb(baseUrl, authHeader)
  }

  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  const url = `${baseUrl}${normalizedPath}`

  const headers = {
    Authorization: authHeader,
    ...options.headers
  }

  if (crumb) {
    headers[crumb.field] = crumb.value
  }

  // 默认 Accept 为 json，除非指定 rawText / logText
  if (!headers.Accept && !options.rawText) {
    headers.Accept = 'application/json'
  }

  const reqConfig = {
    method: method.toUpperCase(),
    headers
  }

  if (data) {
    if (typeof data === 'string') {
      reqConfig.body = data
    } else if (data instanceof URLSearchParams) {
      reqConfig.body = data.toString()
      headers['Content-Type'] = 'application/x-www-form-urlencoded'
    } else {
      reqConfig.body = JSON.stringify(data)
      headers['Content-Type'] = 'application/json'
    }
  }

  const timeoutMs = options.timeout || 30000
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
  reqConfig.signal = controller.signal

  try {
    console.log(`[Jenkins API] ${reqConfig.method} ${url}`)
    let response = await fetch(url, reqConfig)
    clearTimeout(timeoutId)

    // 如果是 POST 遇到 403，尝试重置 Crumb 并重试一次
    if (
      response.status === 403 &&
      ['POST', 'PUT', 'DELETE'].includes(reqConfig.method) &&
      !options._isRetry
    ) {
      console.warn('[Jenkins API] 遇到 403 权限异常，尝试刷新 CSRF Crumb 并重试...')
      cachedCrumb = null
      crumbFetchTime = 0
      return jenkinsRequest(method, path, data, { ...options, _isRetry: true })
    }

    if (options.returnFullResponse) {
      return response
    }

    if (options.rawText) {
      if (!response.ok) {
        throw new JenkinsError(
          `HTTP ${response.status}: ${response.statusText}`,
          'HTTP_ERROR',
          response.status
        )
      }
      return await response.text()
    }

    // Jenkins 触发构建成功通常返回 201 Created，且无响应 Body
    if (response.status === 201) {
      const location = response.headers.get('location') || ''
      return {
        success: true,
        status: 201,
        location
      }
    }

    if (!response.ok) {
      const errText = await response.text().catch(() => '')
      throw new JenkinsError(
        `Jenkins API 请求失败 [HTTP ${response.status}]: ${errText || response.statusText}`,
        'API_ERROR',
        response.status
      )
    }

    const contentType = response.headers.get('content-type') || ''
    if (contentType.includes('application/json')) {
      return await response.json()
    } else {
      return await response.text()
    }
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new JenkinsError('请求超时，请检查 Jenkins 服务器网络连接', 'TIMEOUT', 408)
    }
    if (error instanceof JenkinsError) {
      throw error
    }
    throw new JenkinsError(error.message || '未知 Jenkins 网络错误', 'NETWORK_ERROR', 500)
  }
}

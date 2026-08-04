/**
 * 云效 API 请求封装
 * 提供统一的 HTTP 请求接口，处理认证、错误和重试逻辑
 */

import { getStoredToken } from './auth.js'

// 云效 API 基础配置
export const YUNXIAO_CONFIG = {
  // 中心化接入点
  CENTER_BASE: 'https://openapi-rdc.aliyuncs.com',
  // API 版本
  API_VERSION: '2021-06-25'
}

/**
 * 通用云效 API 请求方法
 * @param {string} method - HTTP 方法 (GET, POST, PUT, DELETE)
 * @param {string} path - API 路径
 * @param {object} data - 请求体数据（POST/PUT）
 * @param {object} options - 额外选项
 * @param {string} options.organizationId - 组织ID（用于构建路径）
 * @param {object} options.headers - 额外请求头
 * @param {boolean} options.useRegion - 是否使用区域化接入点
 * @returns {Promise<object>} API 响应数据
 */
export async function yunxiaoRequest(method, path, data = null, options = {}) {
  const token = await getStoredToken()
  if (!token) {
    throw new YunxiaoError('未配置云效访问令牌', 'AUTH_REQUIRED')
  }

  // 构建完整 URL
  const baseUrl = options.useRegion && options.regionEndpoint
    ? options.regionEndpoint
    : YUNXIAO_CONFIG.CENTER_BASE

  const url = `${baseUrl}${path}`

  // 构建请求头
  const headers = {
    'x-yunxiao-token': token,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    ...options.headers
  }

  // 构建请求配置
  const config = {
    method,
    headers,
    timeout: 30000 // 30秒超时
  }

  // 添加请求体（仅 POST/PUT）
  if (data && (method === 'POST' || method === 'PUT')) {
    config.body = JSON.stringify(data)
  }

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), config.timeout)

    console.log('[Yunxiao API] 请求:', method, url)
    const response = await fetch(url, {
      ...config,
      signal: controller.signal
    })

    clearTimeout(timeoutId)

    console.log('[Yunxiao API] 响应状态:', response.status, response.statusText)

    // 解析响应
    const responseData = await response.json().catch(() => ({}))

    console.log('[Yunxiao API] 响应数据:', JSON.stringify(responseData, null, 2))

    // 检查响应状态
    if (!response.ok) {
      const errorMsg = responseData.errorMsg || responseData.message || `HTTP ${response.status}`
      const errorCode = responseData.errorCode || responseData.code || 'UNKNOWN_ERROR'

      throw new YunxiaoError(errorMsg, errorCode, response.status)
    }

    // 检查业务状态
    if (responseData.success === false) {
      throw new YunxiaoError(
        responseData.errorMsg || 'API 返回业务错误',
        responseData.errorCode || 'BUSINESS_ERROR'
      )
    }

    return responseData
  } catch (error) {
    // 处理网络错误
    if (error.name === 'AbortError') {
      throw new YunxiaoError('请求超时，请检查网络连接', 'TIMEOUT')
    }

    // 处理 YunxiaoError
    if (error instanceof YunxiaoError) {
      throw error
    }

    // 处理其他错误
    throw new YunxiaoError(
      error.message || '网络请求失败',
      'NETWORK_ERROR'
    )
  }
}

/**
 * GET 请求快捷方法
 */
export async function yunxiaoGet(path, options = {}) {
  return yunxiaoRequest('GET', path, null, options)
}

/**
 * POST 请求快捷方法
 */
export async function yunxiaoPost(path, data, options = {}) {
  return yunxiaoRequest('POST', path, data, options)
}

/**
 * PUT 请求快捷方法
 */
export async function yunxiaoPut(path, data, options = {}) {
  return yunxiaoRequest('PUT', path, data, options)
}

/**
 * DELETE 请求快捷方法
 */
export async function yunxiaoDelete(path, options = {}) {
  return yunxiaoRequest('DELETE', path, null, options)
}

/**
 * 云效 API 错误类
 */
export class YunxiaoError extends Error {
  constructor(message, code = 'UNKNOWN', statusCode = null) {
    super(message)
    this.name = 'YunxiaoError'
    this.code = code
    this.statusCode = statusCode
  }

  /**
   * 判断是否为认证错误
   */
  isAuthError() {
    return this.code === 'AUTH_REQUIRED' ||
           this.code === 'INVALID_TOKEN' ||
           this.statusCode === 401
  }

  /**
   * 判断是否为权限错误
   */
  isPermissionError() {
    return this.statusCode === 403 || this.code === 'PERMISSION_DENIED'
  }

  /**
   * 判断是否为资源不存在
   */
  isNotFoundError() {
    return this.statusCode === 404 || this.code === 'NOT_FOUND'
  }
}

/**
 * API 请求日志记录（可选，用于调试）
 */
export function enableRequestLogging() {
  const originalFetch = global.fetch

  global.fetch = async (url, options) => {
    const startTime = Date.now()
    console.log(`[Yunxiao API] → ${options?.method || 'GET'} ${url}`)

    try {
      const response = await originalFetch(url, options)
      const duration = Date.now() - startTime

      console.log(`[Yunxiao API] ← ${response.status} (${duration}ms)`)

      return response
    } catch (error) {
      const duration = Date.now() - startTime
      console.error(`[Yunxiao API] ✗ Error (${duration}ms):`, error.message)

      throw error
    }
  }
}

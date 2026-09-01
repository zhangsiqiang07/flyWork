/**
 * Jenkins 认证与配置管理
 * 使用 Electron safeStorage API 加密存储访问令牌
 */

import { safeStorage } from 'electron'
import { join } from 'path'
import { homedir } from 'os'
import { writeFileSync, readFileSync, existsSync, mkdirSync, unlinkSync } from 'fs'

const FLYWORK_DIR = join(homedir(), '.flywork')
const TOKEN_PATH = join(FLYWORK_DIR, 'jenkins-token.enc')
const CONFIG_PATH = join(FLYWORK_DIR, 'jenkins-config.json')

function ensureDir() {
  if (!existsSync(FLYWORK_DIR)) {
    mkdirSync(FLYWORK_DIR, { recursive: true })
  }
}

export function isSafeStorageAvailable() {
  return safeStorage.isEncryptionAvailable()
}

/**
 * 存储 Jenkins API Token（加密）
 */
export async function storeToken(token) {
  if (!token || typeof token !== 'string') {
    throw new Error('无效的 Jenkins API Token')
  }

  ensureDir()

  if (!isSafeStorageAvailable()) {
    console.warn('[Jenkins Auth] safeStorage 不可用，使用降级存储方案')
    const encoded = Buffer.from(token).toString('base64')
    writeFileSync(TOKEN_PATH + '.fallback', encoded, 'utf-8')
    return
  }

  try {
    const encrypted = safeStorage.encryptString(token)
    writeFileSync(TOKEN_PATH, encrypted)
    console.log('[Jenkins Auth] Token 已加密存储')
  } catch (error) {
    console.error('[Jenkins Auth] Token 存储失败:', error)
    throw new Error('无法存储访问令牌: ' + error.message)
  }
}

/**
 * 获取已存储的 Jenkins API Token（解密）
 */
export async function getStoredToken() {
  ensureDir()

  if (existsSync(TOKEN_PATH)) {
    if (!isSafeStorageAvailable()) {
      console.warn('[Jenkins Auth] safeStorage 不可用，无法解密')
      return null
    }

    try {
      const encrypted = readFileSync(TOKEN_PATH)
      return safeStorage.decryptString(Buffer.from(encrypted))
    } catch (error) {
      console.error('[Jenkins Auth] Token 解密失败:', error)
      return null
    }
  }

  const fallbackPath = TOKEN_PATH + '.fallback'
  if (existsSync(fallbackPath)) {
    try {
      const encoded = readFileSync(fallbackPath, 'utf-8')
      return Buffer.from(encoded, 'base64').toString('utf-8')
    } catch (error) {
      console.error('[Jenkins Auth] 降级 Token 读取失败:', error)
    }
  }

  return null
}

/**
 * 删除已存储的 Token
 */
export async function deleteStoredToken() {
  ensureDir()
  try {
    if (existsSync(TOKEN_PATH)) {
      unlinkSync(TOKEN_PATH)
    }
    if (existsSync(TOKEN_PATH + '.fallback')) {
      unlinkSync(TOKEN_PATH + '.fallback')
    }
    console.log('[Jenkins Auth] Token 已删除')
  } catch (error) {
    console.error('[Jenkins Auth] Token 删除失败:', error)
    throw new Error('无法删除访问令牌: ' + error.message)
  }
}

/**
 * 存储 Jenkins 服务器配置（URL、用户名等）
 */
export function storeConfig(config) {
  ensureDir()
  try {
    const cleanUrl = (config.baseUrl || '').trim().replace(/\/+$/, '')
    const configData = {
      baseUrl: cleanUrl,
      username: (config.username || '').trim(),
      updatedAt: new Date().toISOString()
    }
    writeFileSync(CONFIG_PATH, JSON.stringify(configData, null, 2), 'utf-8')
    console.log('[Jenkins Auth] 配置已存储')
    return configData
  } catch (error) {
    console.error('[Jenkins Auth] 配置存储失败:', error)
    throw new Error('无法存储配置: ' + error.message)
  }
}

/**
 * 获取 Jenkins 配置
 */
export function getConfig() {
  ensureDir()
  if (!existsSync(CONFIG_PATH)) {
    return null
  }
  try {
    const content = readFileSync(CONFIG_PATH, 'utf-8')
    return JSON.parse(content)
  } catch (error) {
    console.error('[Jenkins Auth] 配置读取失败:', error)
    return null
  }
}

/**
 * 检查是否已配置完整认证信息
 */
export async function hasStoredAuth() {
  const config = getConfig()
  const token = await getStoredToken()
  return !!(config?.baseUrl && config?.username && token)
}

/**
 * 验证连接及凭据有效性
 */
export async function validateConnection(baseUrl, username, token) {
  try {
    const cleanUrl = (baseUrl || '').trim().replace(/\/+$/, '')
    if (!cleanUrl) throw new Error('请输入 Jenkins 服务器 URL')
    if (!username?.trim()) throw new Error('请输入 Jenkins 用户名')
    if (!token?.trim()) throw new Error('请输入 API Token')

    const authHeader =
      'Basic ' + Buffer.from(`${username.trim()}:${token.trim()}`).toString('base64')
    const testUrl = `${cleanUrl}/api/json?tree=nodeName,numExecutors`

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 12000)

    const response = await fetch(testUrl, {
      method: 'GET',
      headers: {
        Authorization: authHeader,
        Accept: 'application/json'
      },
      signal: controller.signal
    })

    clearTimeout(timeoutId)

    if (response.status === 401 || response.status === 403) {
      return {
        valid: false,
        message: '认证失败：用户名或 API Token 错误（HTTP ' + response.status + '）'
      }
    }

    if (!response.ok) {
      return {
        valid: false,
        message: `连接失败：HTTP ${response.status} ${response.statusText}`
      }
    }

    const data = await response.json().catch(() => ({}))

    // 验证成功后持久化配置和 token
    await storeToken(token.trim())
    storeConfig({ baseUrl: cleanUrl, username: username.trim() })

    return {
      valid: true,
      message: 'Jenkins 连接并验证成功！',
      data
    }
  } catch (error) {
    if (error.name === 'AbortError') {
      return { valid: false, message: '连接超时，请检查 Jenkins 服务器网络及地址' }
    }
    return { valid: false, message: error.message || '连接失败' }
  }
}

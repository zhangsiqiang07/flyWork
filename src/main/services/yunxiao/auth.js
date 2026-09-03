/**
 * 云效认证管理
 * 使用 Electron safeStorage API 加密存储访问令牌
 */

import { safeStorage } from 'electron'
import { join } from 'path'
import { homedir } from 'os'
import { writeFileSync, readFileSync, existsSync, mkdirSync, unlinkSync } from 'fs'

// Token 存储路径
const FLYWORK_DIR = join(homedir(), '.flywork')
const TOKEN_PATH = join(FLYWORK_DIR, 'yunxiao-token.enc')
const CONFIG_PATH = join(FLYWORK_DIR, 'yunxiao-config.json')

/**
 * 确保存储目录存在
 */
function ensureDir() {
  if (!existsSync(FLYWORK_DIR)) {
    mkdirSync(FLYWORK_DIR, { recursive: true })
  }
}

/**
 * 检查 safeStorage 是否可用
 * @returns {boolean}
 */
export function isSafeStorageAvailable() {
  return safeStorage.isEncryptionAvailable()
}

/**
 * 存储云效访问令牌（加密）
 * @param {string} token - 访问令牌
 * @throws {Error} 如果加密不可用或存储失败
 */
export async function storeToken(token) {
  if (!token || typeof token !== 'string') {
    throw new Error('无效的访问令牌')
  }

  ensureDir()

  // 检查加密可用性
  if (!isSafeStorageAvailable()) {
    // 降级方案：使用 Base64 编码（不推荐，仅作为后备）
    console.warn('[Yunxiao Auth] safeStorage 不可用，使用降级存储方案')
    const encoded = Buffer.from(token).toString('base64')
    writeFileSync(TOKEN_PATH + '.fallback', encoded, 'utf-8')
    return
  }

  try {
    // 使用 Electron safeStorage 加密
    const encrypted = safeStorage.encryptString(token)
    writeFileSync(TOKEN_PATH, encrypted)
    console.log('[Yunxiao Auth] Token 已加密存储')
  } catch (error) {
    console.error('[Yunxiao Auth] Token 存储失败:', error)
    throw new Error('无法存储访问令牌: ' + error.message)
  }
}

/**
 * 读取已存储的云效访问令牌（解密）
 * @returns {Promise<string|null>} 访问令牌，如果不存在返回 null
 */
export async function getStoredToken() {
  ensureDir()

  // 优先尝试加密存储
  if (existsSync(TOKEN_PATH)) {
    if (!isSafeStorageAvailable()) {
      console.warn('[Yunxiao Auth] safeStorage 不可用，无法解密')
      return null
    }

    try {
      const encrypted = readFileSync(TOKEN_PATH)
      const token = safeStorage.decryptString(Buffer.from(encrypted))
      return token
    } catch (error) {
      console.error('[Yunxiao Auth] Token 解密失败:', error)
      return null
    }
  }

  // 降级方案：尝试读取 Base64 编码的后备存储
  const fallbackPath = TOKEN_PATH + '.fallback'
  if (existsSync(fallbackPath)) {
    try {
      const encoded = readFileSync(fallbackPath, 'utf-8')
      const token = Buffer.from(encoded, 'base64').toString('utf-8')
      console.warn('[Yunxiao Auth] 使用降级存储方案读取 Token')
      return token
    } catch (error) {
      console.error('[Yunxiao Auth] 降级 Token 读取失败:', error)
    }
  }

  return null
}

/**
 * 删除已存储的访问令牌
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
    console.log('[Yunxiao Auth] Token 已删除')
  } catch (error) {
    console.error('[Yunxiao Auth] Token 删除失败:', error)
    throw new Error('无法删除访问令牌: ' + error.message)
  }
}

/**
 * 检查是否已配置访问令牌
 * @returns {Promise<boolean>}
 */
export async function hasStoredToken() {
  const token = await getStoredToken()
  return token !== null && token.length > 0
}

/**
 * 存储云效配置（组织信息等）
 * @param {object} config - 配置对象
 */
export function storeConfig(config) {
  ensureDir()

  try {
    const configData = {
      ...config,
      updatedAt: new Date().toISOString()
    }
    writeFileSync(CONFIG_PATH, JSON.stringify(configData, null, 2), 'utf-8')
    console.log('[Yunxiao Auth] 配置已存储')
  } catch (error) {
    console.error('[Yunxiao Auth] 配置存储失败:', error)
    throw new Error('无法存储配置: ' + error.message)
  }
}

/**
 * 读取云效配置
 * @returns {object|null} 配置对象
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
    console.error('[Yunxiao Auth] 配置读取失败:', error)
    return null
  }
}

/**
 * 更新配置中的当前组织
 * @param {string} organizationId - 组织ID
 * @param {string} organizationName - 组织名称（可选）
 */
export function setCurrentOrganization(organizationId, organizationName = null) {
  const config = getConfig() || {}

  config.currentOrganizationId = organizationId
  if (organizationName) {
    config.currentOrganizationName = organizationName
  }

  storeConfig(config)
}

/**
 * 获取当前组织ID
 * @returns {string|null}
 */
export function getCurrentOrganizationId() {
  const config = getConfig()
  return config?.currentOrganizationId || null
}

/**
 * 设置当前 Token 用户信息
 * @param {object} user - 用户信息对象
 */
export function setCurrentUser(user) {
  const config = getConfig() || {}
  config.currentUser = user
  storeConfig(config)
}

/**
 * 获取当前登录用户/Token对应的用户信息
 * @param {string} organizationId - 组织ID（可选）
 * @returns {Promise<object|null>} 用户信息
 */
export async function getCurrentUser(organizationId = null) {
  const config = getConfig() || {}
  const orgId = organizationId || config.currentOrganizationId || null
  const { yunxiaoGet } = await import('./api.js')

  const candidateEndpoints = [
    '/oapi/v1/platform/user',
    '/oapi/v1/user',
    '/oapi/v1/platform/user/current',
    '/oapi/v1/platform/users/current',
    '/oapi/v1/platform/currentUser',
    '/oapi/v1/user/current',
    orgId ? `/oapi/v1/platform/organizations/${encodeURIComponent(orgId)}/user` : null,
    orgId ? `/oapi/v1/platform/organizations/${encodeURIComponent(orgId)}/user:current` : null,
    orgId ? `/oapi/v1/platform/organizations/${encodeURIComponent(orgId)}/members:current` : null
  ].filter(Boolean)

  for (const ep of candidateEndpoints) {
    try {
      console.log(`[Yunxiao Auth] 正在调用 ${ep} 获取当前用户信息...`)
      const res = await yunxiaoGet(ep)
      const data = res?.result || res?.data || res
      if (
        data &&
        (data.id || data.userId || data.identifier || data.name || data.username || data.account)
      ) {
        const user = {
          id: String(data.id || data.userId || data.identifier || ''),
          name: String(data.name || data.nickName || data.realName || data.username || ''),
          username: String(data.username || data.account || data.email || ''),
          nickName: String(data.nickName || ''),
          account: String(data.account || data.email || ''),
          avatar: String(data.avatar || data.avatarUrl || '')
        }
        console.log('[Yunxiao Auth] 成功获取当前 Token 用户:', user.name, user.id, user.username)
        config.currentUser = user
        storeConfig(config)
        return user
      }
    } catch (err) {
      console.warn(`[Yunxiao Auth] 尝试从 ${ep} 获取当前用户失败:`, err.message)
    }
  }

  if (config.currentUser) {
    return config.currentUser
  }

  return null
}

/**
 * 验证 Token 是否有效（通过调用 API 测试）
 * @param {string} token - 访问令牌
 * @returns {Promise<{valid: boolean, organizations: Array}>}
 */
export async function validateToken(token) {
  try {
    console.log('[Yunxiao Auth] 开始验证 Token...')

    // 临时存储 Token 以进行验证
    await storeToken(token)
    console.log('[Yunxiao Auth] Token 已临时存储')

    // 导入 API 模块（延迟导入避免循环依赖）
    const { yunxiaoGet } = await import('./api.js')

    // 尝试获取组织列表
    console.log('[Yunxiao Auth] 调用组织列表 API...')
    const response = await yunxiaoGet('/oapi/v1/platform/organizations')

    console.log('[Yunxiao Auth] API 响应类型:', typeof response, Array.isArray(response))
    console.log('[Yunxiao Auth] API 响应:', JSON.stringify(response, null, 2))

    // 云效 API 直接返回数组，或者包装在 result/data 中
    let organizations = []

    if (Array.isArray(response)) {
      // API 直接返回数组
      organizations = response
    } else if (response && typeof response === 'object') {
      // API 返回对象，尝试从不同字段提取
      organizations = response.result || response.data || response.organizations || []

      // 如果还是数组，使用它
      if (!Array.isArray(organizations)) {
        organizations = []
      }
    }

    if (organizations.length >= 0) {
      console.log('[Yunxiao Auth] Token 验证成功，获取到', organizations.length, '个组织')
      let user = null
      try {
        user = await getCurrentUser()
      } catch (e) {
        console.warn('[Yunxiao Auth] 获取当前用户失败:', e.message)
      }
      return {
        valid: true,
        organizations: organizations,
        currentUser: user,
        message: `Token 验证成功，找到 ${organizations.length} 个组织`
      }
    }

    console.warn('[Yunxiao Auth] API 响应格式不符合预期:', response)
    return {
      valid: false,
      organizations: [],
      message: 'Token 验证失败：API 响应格式异常'
    }
  } catch (error) {
    console.error('[Yunxiao Auth] Token 验证失败:', error)
    console.error('[Yunxiao Auth] 错误详情:', {
      message: error.message,
      code: error.code,
      statusCode: error.statusCode,
      stack: error.stack
    })

    // 验证失败时清除 Token
    await deleteStoredToken()

    return {
      valid: false,
      organizations: [],
      message: error.message || 'Token 验证失败'
    }
  }
}

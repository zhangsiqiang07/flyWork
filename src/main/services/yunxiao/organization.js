/**
 * 云效组织管理 API
 * 提供组织、成员相关的数据访问接口
 */

import { yunxiaoGet, yunxiaoPost } from './api.js'
import { getCurrentOrganizationId } from './auth.js'

/**
 * 获取用户所属的组织列表
 * @param {string} userId - 用户ID（可选,默认当前用户）
 * @returns {Promise<Array>} 组织列表
 */
export async function listOrganizations(userId = null) {
  const params = userId ? `?userId=${encodeURIComponent(userId)}` : ''
  const response = await yunxiaoGet(`/oapi/v1/platform/organizations${params}`)

  // 云效 API 直接返回数组
  const organizations = Array.isArray(response) ? response : (response.result || response.data || [])

  return {
    organizations: organizations,
    requestId: response.requestId || null
  }
}

/**
 * 搜索组织成员
 * @param {object} options - 搜索选项
 * @param {string} options.organizationId - 组织ID（可选，默认使用当前组织）
 * @param {string} options.query - 搜索关键词
 * @param {Array<string>} options.deptIds - 部门ID列表
 * @param {boolean} options.includeChildren - 是否包含子部门
 * @param {Array<string>} options.roleIds - 角色ID列表
 * @param {Array<string>} options.statuses - 成员状态列表
 * @param {number} options.page - 页码
 * @param {number} options.perPage - 每页数量
 * @param {string} options.nextToken - 分页令牌
 * @returns {Promise<object>} 成员列表和分页信息
 */
export async function searchMembers(options = {}) {
  const organizationId = options.organizationId || getCurrentOrganizationId()
  if (!organizationId) {
    throw new Error('未指定组织ID')
  }

  const {
    query,
    deptIds,
    includeChildren,
    roleIds,
    statuses,
    page = 1,
    perPage = 20,
    nextToken
  } = options

  // 构建请求体
  const body = {}

  if (query) body.query = query
  if (deptIds && deptIds.length > 0) body.deptIds = deptIds
  if (includeChildren !== undefined) body.includeChildren = includeChildren
  if (roleIds && roleIds.length > 0) body.roleIds = roleIds
  if (statuses && statuses.length > 0) body.statuses = statuses
  if (page) body.page = page
  if (perPage) body.perPage = perPage
  if (nextToken) body.nextToken = nextToken

  const path = `/oapi/v1/platform/organizations/${organizationId}/members:search`
  const response = await yunxiaoPost(path, body)

  return {
    members: response.result || [],
    totalCount: response.totalCount || 0,
    nextToken: response.nextToken,
    requestId: response.requestId
  }
}

/**
 * 获取成员详情
 * @param {string} memberId - 成员ID
 * @param {string} organizationId - 组织ID（可选）
 * @returns {Promise<object>} 成员信息
 */
export async function getMember(memberId, organizationId = null) {
  const orgId = organizationId || getCurrentOrganizationId()
  if (!orgId) {
    throw new Error('未指定组织ID')
  }

  const path = `/oapi/v1/platform/organizations/${orgId}/members/${memberId}`
  const response = await yunxiaoGet(path)

  return response.result || response
}

/**
 * 通过用户ID查询成员信息
 * @param {string} userId - 用户ID
 * @param {string} organizationId - 组织ID（可选）
 * @returns {Promise<object>} 成员信息
 */
export async function getMemberByUser(userId, organizationId = null) {
  const orgId = organizationId || getCurrentOrganizationId()
  if (!orgId) {
    throw new Error('未指定组织ID')
  }

  const path = `/oapi/v1/platform/organizations/${orgId}/members:user?userId=${encodeURIComponent(userId)}`
  const response = await yunxiaoGet(path)

  return response.result || response
}

/**
 * 获取组织详情
 * @param {string} organizationId - 组织ID（可选）
 * @returns {Promise<object>} 组织信息
 */
export async function getOrganization(organizationId = null) {
  const orgId = organizationId || getCurrentOrganizationId()
  if (!orgId) {
    throw new Error('未指定组织ID')
  }

  const path = `/oapi/v1/platform/organizations/${orgId}`
  const response = await yunxiaoGet(path)

  return response.result || response
}

/**
 * 获取组织部门列表
 * @param {string} organizationId - 组织ID（可选）
 * @returns {Promise<Array>} 部门列表
 */
export async function listDepartments(organizationId = null) {
  const orgId = organizationId || getCurrentOrganizationId()
  if (!orgId) {
    throw new Error('未指定组织ID')
  }

  const path = `/oapi/v1/platform/organizations/${orgId}/departments`
  const response = await yunxiaoGet(path)

  return response.result || []
}

/**
 * 获取组织角色列表
 * @param {string} organizationId - 组织ID（可选）
 * @returns {Promise<Array>} 角色列表
 */
export async function listRoles(organizationId = null) {
  const orgId = organizationId || getCurrentOrganizationId()
  if (!orgId) {
    throw new Error('未指定组织ID')
  }

  const path = `/oapi/v1/platform/organizations/${orgId}/roles`
  const response = await yunxiaoGet(path)

  return response.result || []
}

/**
 * 批量获取成员信息
 * @param {Array<string>} memberIds - 成员ID列表
 * @param {string} organizationId - 组织ID（可选）
 * @returns {Promise<Array>} 成员信息列表
 */
export async function getMembersBatch(memberIds, organizationId = null) {
  if (!memberIds || memberIds.length === 0) {
    return []
  }

  const orgId = organizationId || getCurrentOrganizationId()
  if (!orgId) {
    throw new Error('未指定组织ID')
  }

  // 分批查询（每批最多50个）
  const batchSize = 50
  const results = []

  for (let i = 0; i < memberIds.length; i += batchSize) {
    const batch = memberIds.slice(i, i + batchSize)

    const searchResult = await searchMembers({
      organizationId: orgId,
      memberIds: batch,
      perPage: batchSize
    })

    results.push(...searchResult.members)
  }

  return results
}

/**
 * 成员信息缓存管理
 */
const memberCache = new Map()
const CACHE_TTL = 5 * 60 * 1000 // 5分钟

/**
 * 从缓存获取成员信息
 * @param {string} memberId - 成员ID
 * @returns {object|null}
 */
export function getCachedMember(memberId) {
  const cached = memberCache.get(memberId)
  if (!cached) return null

  // 检查是否过期
  if (Date.now() - cached.timestamp > CACHE_TTL) {
    memberCache.delete(memberId)
    return null
  }

  return cached.data
}

/**
 * 缓存成员信息
 * @param {string} memberId - 成员ID
 * @param {object} memberData - 成员数据
 */
export function cacheMember(memberId, memberData) {
  memberCache.set(memberId, {
    data: memberData,
    timestamp: Date.now()
  })
}

/**
 * 清除成员缓存
 */
export function clearMemberCache() {
  memberCache.clear()
}

/**
 * 获取成员显示名称（带缓存）
 * @param {string} memberId - 成员ID
 * @param {string} organizationId - 组织ID（可选）
 * @returns {Promise<string>} 成员名称
 */
export async function getMemberDisplayName(memberId, organizationId = null) {
  // 先查缓存
  const cached = getCachedMember(memberId)
  if (cached) {
    return cached.name || cached.displayName || memberId
  }

  // 缓存未命中，查询 API
  try {
    const member = await getMember(memberId, organizationId)
    cacheMember(memberId, member)

    return member.name || member.displayName || memberId
  } catch (error) {
    console.error(`[Yunxiao] 获取成员 ${memberId} 信息失败:`, error)
    return memberId
  }
}

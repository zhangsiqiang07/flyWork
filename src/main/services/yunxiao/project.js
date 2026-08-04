/**
 * 云效项目管理 API
 * 提供项目相关的数据访问接口
 */

import { yunxiaoGet, yunxiaoPost } from './api.js'
import { getCurrentOrganizationId } from './auth.js'

function extractProjects(response) {
  const candidates = [
    response?.projects,
    response?.projectList,
    response?.items,
    response?.result?.projects,
    response?.result?.projectList,
    response?.result?.items,
    response?.data?.projects,
    response?.data?.projectList,
    response?.data?.items,
    response?.result,
    response?.data,
    response
  ]
  return candidates.find(Array.isArray) || []
}

/**
 * 搜索项目
 * @param {object} options - 搜索选项
 * @param {string} options.organizationId - 组织ID（可选）
 * @param {string} options.query - 搜索关键词
 * @param {number} options.page - 页码
 * @param {number} options.perPage - 每页数量
 * @returns {Promise<object>} 项目列表
 */
export async function searchProjects(options = {}) {
  const organizationId = options.organizationId || getCurrentOrganizationId()
  if (!organizationId) {
    throw new Error('未指定组织ID')
  }

  const { query = '', page = 1, perPage = 20 } = options

  const path = `/oapi/v1/projex/organizations/${encodeURIComponent(organizationId)}/projects:search`
  const body = {
    conditions: query
      ? JSON.stringify({
          conditionGroups: [
            [
              {
                className: 'string',
                fieldIdentifier: 'name',
                format: 'input',
                operator: 'CONTAINS',
                toValue: null,
                value: [query]
              }
            ]
          ]
        })
      : '',
    extraConditions: '',
    orderBy: 'gmtCreate',
    page,
    perPage,
    sort: 'desc'
  }

  const response = await yunxiaoPost(path, body)
  const projects = extractProjects(response)

  return {
    projects: Array.isArray(projects) ? projects : [],
    totalCount:
      response.totalCount || response.count || (Array.isArray(projects) ? projects.length : 0),
    nextToken: response.nextToken || null,
    requestId: response.requestId || null
  }
}

/**
 * 获取项目详情
 * @param {string} projectId - 项目ID
 * @param {string} organizationId - 组织ID（可选）
 * @returns {Promise<object>} 项目信息
 */
export async function getProject(projectId, organizationId = null) {
  const orgId = organizationId || getCurrentOrganizationId()
  if (!orgId) {
    throw new Error('未指定组织ID')
  }

  const path = `/oapi/v1/projex/organizations/${orgId}/projects/${projectId}`
  const response = await yunxiaoGet(path)

  return response.result || response.data || response
}

/**
 * 获取项目成员
 * @param {string} projectId - 项目ID
 * @param {string} organizationId - 组织ID（可选）
 * @returns {Promise<Array>} 成员列表
 */
export async function listProjectMembers(projectId, organizationId = null) {
  const orgId = organizationId || getCurrentOrganizationId()
  if (!orgId) {
    throw new Error('未指定组织ID')
  }

  const path = `/oapi/v1/projex/organizations/${orgId}/projects/${projectId}/members`
  const response = await yunxiaoGet(path)

  const members = Array.isArray(response)
    ? response
    : response.members || response.result || response.data || []
  return Array.isArray(members) ? members : []
}

/**
 * 创建项目
 * @param {object} projectData - 项目数据
 * @param {string} projectData.name - 项目名称
 * @param {string} projectData.customCode - 项目代码
 * @param {string} projectData.scope - 项目范围
 * @param {string} projectData.templateId - 模板ID
 * @param {string} projectData.description - 项目描述（可选）
 * @param {string} organizationId - 组织ID（可选）
 * @returns {Promise<object>} 创建的项目信息
 */
export async function createProject(projectData, organizationId = null) {
  const orgId = organizationId || getCurrentOrganizationId()
  if (!orgId) {
    throw new Error('未指定组织ID')
  }

  const path = `/oapi/v1/projex/organizations/${orgId}/projects`
  const response = await yunxiaoPost(path, projectData)

  return response.result || response.data || response
}

/**
 * 更新项目字段
 * @param {string} projectId - 项目ID
 * @param {object} fields - 要更新的字段
 * @param {string} organizationId - 组织ID（可选）
 * @returns {Promise<object>} 更新结果
 */
export async function updateProjectField(projectId, fields, organizationId = null) {
  const orgId = organizationId || getCurrentOrganizationId()
  if (!orgId) {
    throw new Error('未指定组织ID')
  }

  const { yunxiaoPut } = await import('./api.js')
  const path = `/oapi/v1/projex/organizations/${orgId}/projects/${projectId}/fields`
  const response = await yunxiaoPut(path, fields)

  return response.result || response.data || response
}

/**
 * 获取项目列表（简化版，用于快速加载）
 * @param {string} organizationId - 组织ID（可选）
 * @returns {Promise<Array>} 项目列表
 */
export async function listProjects(organizationId = null) {
  const result = await searchProjects({ organizationId, perPage: 100 })
  return result.projects
}

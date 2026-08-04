/** 云效迭代 API。 */
import { yunxiaoGet, yunxiaoPost, yunxiaoPut } from './api.js'
import { getCurrentOrganizationId } from './auth.js'

function organizationIdOrThrow(organizationId) {
  const id = organizationId || getCurrentOrganizationId()
  if (!id) throw new Error('请先选择云效组织')
  return id
}
function listFrom(response) {
  const list = response?.sprints || response?.result || response?.data || response
  return Array.isArray(list) ? list : []
}

export async function listSprints(options = {}) {
  const orgId = organizationIdOrThrow(options.organizationId)
  if (!options.projectId) throw new Error('请选择项目后再查看迭代')
  const params = new URLSearchParams({
    page: String(options.page || 1),
    perPage: String(options.perPage || 100)
  })
  if (options.status?.length) params.set('status', options.status.join(','))
  const suffix = params.toString() ? `?${params}` : ''
  const response = await yunxiaoGet(
    `/oapi/v1/projex/organizations/${encodeURIComponent(orgId)}/projects/${encodeURIComponent(options.projectId)}/sprints${suffix}`
  )
  return { sprints: listFrom(response), totalCount: response?.totalCount || 0 }
}

export async function getSprintInfo(sprintId, projectId, organizationId = null) {
  const orgId = organizationIdOrThrow(organizationId)
  if (!projectId) throw new Error('未指定项目')
  const response = await yunxiaoGet(
    `/oapi/v1/projex/organizations/${encodeURIComponent(orgId)}/projects/${encodeURIComponent(projectId)}/sprints/${encodeURIComponent(sprintId)}`
  )
  return response?.result || response?.data || response
}

export async function createSprint(sprint, organizationId = null) {
  const orgId = organizationIdOrThrow(organizationId)
  if (!sprint?.name?.trim() || !sprint.projectId) throw new Error('迭代名称和项目不能为空')
  const { projectId, ...payload } = sprint
  const response = await yunxiaoPost(
    `/oapi/v1/projex/organizations/${encodeURIComponent(orgId)}/projects/${encodeURIComponent(projectId)}/sprints`,
    payload
  )
  return response?.result || response?.data || response
}

export async function updateSprint(sprintId, sprint, organizationId = null) {
  const orgId = organizationIdOrThrow(organizationId)
  if (!sprint?.projectId) throw new Error('未指定项目')
  const { projectId, ...payload } = sprint
  const response = await yunxiaoPut(
    `/oapi/v1/projex/organizations/${encodeURIComponent(orgId)}/projects/${encodeURIComponent(projectId)}/sprints/${encodeURIComponent(sprintId)}`,
    payload
  )
  return response?.result || response?.data || response
}

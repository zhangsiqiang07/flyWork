/** 云效工作项 API。 */
import { yunxiaoGet, yunxiaoPost, yunxiaoPut } from './api.js'
import { getCurrentOrganizationId, getStoredToken } from './auth.js'

function organizationIdOrThrow(organizationId) {
  const id = organizationId || getCurrentOrganizationId()
  if (!id) throw new Error('请先选择云效组织')
  return id
}

function extractList(response, keys) {
  for (const key of keys) {
    if (Array.isArray(response?.[key])) return response[key]
  }
  if (Array.isArray(response)) return response
  if (Array.isArray(response?.result)) return response.result
  if (Array.isArray(response?.data)) return response.data
  return []
}

function detectImageContentType(content, declaredType) {
  if (declaredType.startsWith('image/')) return declaredType.split(';')[0]
  if (content.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])))
    return 'image/png'
  if (content.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) return 'image/jpeg'
  if (content.subarray(0, 6).toString('ascii') === 'GIF87a' || content.subarray(0, 6).toString('ascii') === 'GIF89a')
    return 'image/gif'
  if (content.subarray(0, 4).toString('ascii') === 'RIFF' && content.subarray(8, 12).toString('ascii') === 'WEBP')
    return 'image/webp'
  if (content.subarray(0, 512).toString('utf8').trimStart().startsWith('<svg')) return 'image/svg+xml'
  return null
}

export async function listWorkitems(options = {}) {
  const organizationId = organizationIdOrThrow(options.organizationId)
  if (!options.projectId) throw new Error('请选择项目后再查看工作项')
  const perPage = Math.min(Math.max(Number(options.perPage || 100), 1), 200)
  const response = await yunxiaoPost(
    `/oapi/v1/projex/organizations/${encodeURIComponent(organizationId)}/workitems:search`,
    {
      category: options.category || 'Bug,Task,Req,Risk',
      conditions: options.conditions || '',
      orderBy: 'gmtCreate',
      page: Number(options.page || 1),
      perPage,
      sort: 'desc',
      spaceId: String(options.projectId),
      spaceType: 'Project'
    }
  )
  const workitems = extractList(response, ['workitems', 'items', 'data'])
  return {
    workitems,
    totalCount: response?.totalCount || workitems.length,
    hasMore: workitems.length === perPage
  }
}

export async function getWorkitem(workitemId, organizationId = null) {
  const orgId = organizationIdOrThrow(organizationId)
  if (!workitemId) throw new Error('未指定工作项')
  const response = await yunxiaoGet(
    `/oapi/v1/projex/organizations/${encodeURIComponent(orgId)}/workitems/${encodeURIComponent(workitemId)}`
  )
  return response?.result || response?.data || response
}

export async function getWorkitemImage(imageUrl, workitemId, organizationId = null) {
  let url = new URL(imageUrl)
  const fileIdentifier = url.searchParams.get('fileIdentifier')
  if (fileIdentifier && workitemId && url.hostname === 'devops.aliyun.com') {
    const orgId = organizationIdOrThrow(organizationId)
    const file = await yunxiaoGet(
      `/oapi/v1/projex/organizations/${encodeURIComponent(orgId)}/workitems/${encodeURIComponent(workitemId)}/files/${encodeURIComponent(fileIdentifier)}`
    )
    const fileUrl = file?.url || file?.result?.url || file?.data?.url
    if (!fileUrl) throw new Error('未获取到云效附件下载地址')
    url = new URL(fileUrl)
  }
  const isYunxiaoAsset =
    url.protocol === 'https:' &&
    (url.hostname === 'devops.aliyun.com' ||
      url.hostname.endsWith('.aliyun.com') ||
      url.hostname.endsWith('.aliyuncs.com'))
  if (!isYunxiaoAsset) throw new Error('仅支持加载云效图片')

  const token = await getStoredToken()
  const response = await fetch(url, {
    headers: token ? { 'x-yunxiao-token': token } : {}
  })
  if (!response.ok) throw new Error(`图片加载失败（HTTP ${response.status}）`)
  const contentLength = Number(response.headers.get('content-length') || 0)
  if (contentLength > 15 * 1024 * 1024) throw new Error('图片文件过大')
  const binary = Buffer.from(await response.arrayBuffer())
  if (binary.length > 15 * 1024 * 1024) throw new Error('图片文件过大')
  const contentType = detectImageContentType(binary, response.headers.get('content-type') || '')
  if (!contentType) throw new Error('链接不是可显示的图片资源')
  const content = binary.toString('base64')
  return `data:${contentType};base64,${content}`
}

export async function createWorkitem(workitem, organizationId = null) {
  const orgId = organizationIdOrThrow(organizationId)
  const required = ['subject', 'spaceId', 'assignedTo', 'workitemTypeId']
  for (const field of required) if (!workitem?.[field]) throw new Error(`缺少工作项字段：${field}`)
  const response = await yunxiaoPost(
    `/oapi/v1/projex/organizations/${encodeURIComponent(orgId)}/workitems`,
    workitem
  )
  return response?.result || response?.data || response
}

export async function listProjectWorkitemTypes(projectId, category, organizationId = null) {
  const orgId = organizationIdOrThrow(organizationId)
  if (!projectId || !category) throw new Error('缺少项目或工作项分类')
  const params = new URLSearchParams({ category })
  const response = await yunxiaoGet(
    `/oapi/v1/projex/organizations/${encodeURIComponent(orgId)}/projects/${encodeURIComponent(projectId)}/workitemTypes?${params}`
  )
  return extractList(response, ['workitemTypes']).map((type) => ({
    ...type,
    identifier: type.identifier || type.id,
    category: type.category || type.categoryId || category
  }))
}

export async function updateWorkitemField(workitemId, fields, organizationId = null) {
  const orgId = organizationIdOrThrow(organizationId)
  if (!workitemId) throw new Error('未指定工作项')
  const payload = Array.isArray(fields)
    ? Object.fromEntries(fields.map(({ fieldIdentifier, value }) => [fieldIdentifier, value]))
    : fields || {}
  const response = await yunxiaoPut(
    `/oapi/v1/projex/organizations/${encodeURIComponent(orgId)}/workitems/${encodeURIComponent(workitemId)}`,
    payload
  )
  return response?.result || response?.data || response
}

export async function listWorkitemFields(options = {}) {
  const orgId = organizationIdOrThrow(options.organizationId)
  const params = new URLSearchParams()
  if (options.projectId) params.set('spaceIdentifier', options.projectId)
  if (options.workitemTypeIdentifier)
    params.set('workitemTypeIdentifier', options.workitemTypeIdentifier)
  const suffix = params.toString() ? `?${params}` : ''
  const response = await yunxiaoGet(
    `/oapi/v1/projex/organizations/${encodeURIComponent(orgId)}/workitems/fields${suffix}`
  )
  return extractList(response, ['fields', 'result', 'data'])
}

export async function listWorkflowStatuses(options = {}) {
  const orgId = organizationIdOrThrow(options.organizationId)
  if (!options.projectId || !options.workitemTypeId) return []
  const response = await yunxiaoGet(
    `/oapi/v1/projex/organizations/${encodeURIComponent(orgId)}/projects/${encodeURIComponent(options.projectId)}/workitemTypes/${encodeURIComponent(options.workitemTypeId)}/workflows`
  )
  return extractList(response, ['statuses', 'workflows', 'result', 'data'])
}

export async function createWorkitemComment(workitemId, content, organizationId = null) {
  const orgId = organizationIdOrThrow(organizationId)
  if (!content?.trim()) throw new Error('评论内容不能为空')
  const response = await yunxiaoPost(
    `/oapi/v1/projex/organizations/${encodeURIComponent(orgId)}/workitems/${encodeURIComponent(workitemId)}/comments`,
    { content: content.trim() }
  )
  return response?.result || response?.data || response
}

export async function listWorkitemComments(workitemId, organizationId = null) {
  const orgId = organizationIdOrThrow(organizationId)
  const response = await yunxiaoGet(
    `/oapi/v1/projex/organizations/${encodeURIComponent(orgId)}/workitems/${encodeURIComponent(workitemId)}/comments`
  )
  return extractList(response, ['comments'])
}

export async function listWorkitemAttachments(workitemId, organizationId = null) {
  const orgId = organizationIdOrThrow(organizationId)
  const response = await yunxiaoGet(
    `/oapi/v1/projex/organizations/${encodeURIComponent(orgId)}/workitems/${encodeURIComponent(workitemId)}/attachments`
  )
  return extractList(response, ['attachments', 'result', 'data'])
}

/**
 * Jenkins 任务（Job）与构建（Build）管理
 */

import { jenkinsRequest, JenkinsError } from './api.js'

/**
 * 将 jobPath 转为 Jenkins REST 规范的路径
 * 如 "folder1/my-job" -> "/job/folder1/job/my-job"
 */
export function formatJobPath(jobPath) {
  if (!jobPath) return ''
  if (Array.isArray(jobPath)) {
    return '/job/' + jobPath.map(encodeURIComponent).join('/job/')
  }

  const clean = String(jobPath).replace(/^\/+|\/+$/g, '')
  if (!clean) return ''

  // 如果已经包含了 /job/ 结构，先清理
  const parts = clean
    .split('/')
    .filter((p) => p && p !== 'job')
    .map(encodeURIComponent)

  return '/job/' + parts.join('/job/')
}

/**
 * 将 Jenkins 状态颜色转换为统一状态字符串
 */
export function mapColorToStatus(color, lastBuild = null) {
  if (lastBuild?.building || (color && color.endsWith('_anime'))) {
    return 'BUILDING'
  }
  if (lastBuild?.result && lastBuild.result !== 'UNKNOWN') {
    return lastBuild.result
  }
  if (!color) return 'NOT_BUILT'
  const baseColor = color.replace('_anime', '')

  switch (baseColor) {
    case 'blue':
    case 'green':
      return 'SUCCESS'
    case 'red':
      return 'FAILURE'
    case 'yellow':
      return 'UNSTABLE'
    case 'aborted':
      return 'ABORTED'
    case 'disabled':
      return 'DISABLED'
    case 'notbuilt':
    case 'nobuilt':
    default:
      return 'NOT_BUILT'
  }
}

/**
 * 递归解析 Jenkins 任务树节点
 */
function parseJobNode(rawJob, parentPath = '') {
  const name = rawJob.name || ''
  const currentPath = parentPath ? `${parentPath}/${name}` : name
  const isFolder =
    Array.isArray(rawJob.jobs) ||
    (rawJob._class &&
      (rawJob._class.includes('Folder') ||
        rawJob._class.includes('OrganizationFolder') ||
        rawJob._class.includes('WorkflowMultiBranchProject')))

  const lastBuild = rawJob.lastBuild
    ? {
        number: rawJob.lastBuild.number,
        result: rawJob.lastBuild.result || (rawJob.lastBuild.building ? 'BUILDING' : 'UNKNOWN'),
        timestamp: rawJob.lastBuild.timestamp,
        duration: rawJob.lastBuild.duration,
        building: !!rawJob.lastBuild.building
      }
    : null

  const job = {
    name,
    fullName: rawJob.fullName || currentPath,
    path: currentPath,
    url: rawJob.url || '',
    color: rawJob.color || '',
    status: mapColorToStatus(rawJob.color, lastBuild),
    isFolder: !!isFolder,
    buildable: rawJob.buildable !== false,
    inQueue: !!rawJob.inQueue,
    lastBuild,
    children: []
  }

  if (Array.isArray(rawJob.jobs) && rawJob.jobs.length > 0) {
    job.children = rawJob.jobs.map((child) => parseJobNode(child, currentPath))
  }

  return job
}

/**
 * 获取所有 Jenkins 任务树列表（支持多层 Folders 嵌套）
 */
export async function listJobs() {
  const treeParam = [
    'name',
    'url',
    'color',
    'buildable',
    'inQueue',
    'lastBuild[number,result,timestamp,duration,building]',
    '_class',
    'jobs[name,url,color,buildable,inQueue,lastBuild[number,result,timestamp,duration,building],_class,jobs[name,url,color,buildable,inQueue,lastBuild[number,result,timestamp,duration,building],_class]]'
  ].join(',')

  const data = await jenkinsRequest('GET', `/api/json?tree=jobs[${treeParam}]`)

  if (!data || !Array.isArray(data.jobs)) {
    return []
  }

  return data.jobs.map((rawJob) => parseJobNode(rawJob))
}

/**
 * 解析 fillValueItems 接口返回的选项数据
 */
function parseValueItemsResponse(data) {
  if (!data) return []

  if (Array.isArray(data)) {
    return data.map((item) => (typeof item === 'object' ? item.value || item.name : String(item)))
  }

  if (typeof data === 'object') {
    if (data.data?.values && Array.isArray(data.data.values)) {
      return data.data.values.map((v) => (typeof v === 'object' ? v.value || v.name : String(v)))
    }
    if (data.values && Array.isArray(data.values)) {
      return data.values.map((v) => (typeof v === 'object' ? v.value || v.name : String(v)))
    }
  }

  if (typeof data === 'string') {
    const optionMatches = [
      ...data.matchAll(/<option[^>]*value=["']([^"']*)["'][^>]*>([^<]*)<\/option>/gi)
    ]
    if (optionMatches.length > 0) {
      return optionMatches.map((m) => m[1] || m[2].trim())
    }
  }

  return []
}

/**
 * 从 Job 属性定义中提取参数化构建元数据并自动去重
 */
function extractParameterDefinitions(data) {
  const paramMap = new Map()

  const processParam = (p) => {
    if (!p || !p.name) return
    const name = p.name
    const fullClass = p._class || p.type || ''
    const type = (p.type || fullClass).split('.').pop()

    let defaultValue = ''
    if (p.defaultParameterValue && p.defaultParameterValue.value !== undefined) {
      defaultValue = p.defaultParameterValue.value
    } else if (p.defaultValue !== undefined) {
      defaultValue = p.defaultValue
    }

    let choices = []
    if (Array.isArray(p.choices)) {
      choices = p.choices
    } else if (Array.isArray(p.allValueItems?.values)) {
      choices = p.allValueItems.values.map((v) =>
        typeof v === 'object' ? v.value || v.name : String(v)
      )
    }

    const isGitParameter =
      type === 'GitParameterDefinition' ||
      fullClass.includes('gitparameter') ||
      fullClass.includes('GitParameter') ||
      name.toUpperCase().includes('BRANCH') ||
      name.toUpperCase().includes('GIT_TAG')

    // 若已存在此参数名（Jenkins 经常在 property 和 actions 中同时返回同一参数），进行合并去重
    const existing = paramMap.get(name)
    if (existing) {
      if (!existing.choices?.length && choices?.length) {
        existing.choices = choices
      }
      if (!existing.defaultValue && defaultValue) {
        existing.defaultValue = defaultValue
      }
      if (fullClass) {
        existing.fullClass = fullClass
      }
      if (isGitParameter) {
        existing.isGitParameter = true
      }
      return
    }

    paramMap.set(name, {
      name,
      type,
      fullClass,
      description: p.description || '',
      defaultValue,
      choices,
      isGitParameter
    })
  }

  if (Array.isArray(data.property)) {
    for (const prop of data.property) {
      if (Array.isArray(prop.parameterDefinitions)) {
        prop.parameterDefinitions.forEach(processParam)
      }
    }
  }

  if (Array.isArray(data.actions)) {
    for (const action of data.actions) {
      if (Array.isArray(action.parameterDefinitions)) {
        action.parameterDefinitions.forEach(processParam)
      }
    }
  }

  return Array.from(paramMap.values())
}

/**
 * 动态拉取参数选项（如 Git Parameter 插件的分支列表）
 */
export async function getParameterChoices(jobPath, paramName, fullClass = '') {
  const prefix = formatJobPath(jobPath)
  const encodedParam = encodeURIComponent(paramName)

  // 尝试的 API 路径优先级
  const endpoints = []
  if (fullClass) {
    endpoints.push(`${prefix}/descriptorByName/${fullClass}/fillValueItems?param=${encodedParam}`)
  }
  endpoints.push(
    `${prefix}/descriptorByName/net.uaznia.lukanus.hudson.plugins.gitparameter.GitParameterDefinition/fillValueItems?param=${encodedParam}`,
    `${prefix}/descriptorByName/GitParameterDefinition/fillValueItems?param=${encodedParam}`,
    `${prefix}/descriptorByName/com.cwctravel.hudson.plugins.extended_choice_parameter.ExtendedChoiceParameterDefinition/fillValueItems?param=${encodedParam}`,
    `${prefix}/fillValueItems?param=${encodedParam}`
  )

  for (const endpoint of endpoints) {
    try {
      const data = await jenkinsRequest('GET', endpoint)
      const choices = parseValueItemsResponse(data)
      if (choices && choices.length > 0) {
        return { success: true, choices }
      }
    } catch {
      // 继续尝试下一个可能端点
    }
  }

  return { success: true, choices: [] }
}

/**
 * 获取单个 Job 详细信息（含参数定义、历史构建列表）
 */
export async function getJobDetail(jobPath) {
  const prefix = formatJobPath(jobPath)
  const treeParam = [
    'name',
    'fullName',
    'url',
    'color',
    'buildable',
    'description',
    'inQueue',
    'nextBuildNumber',
    'lastBuild[number,result,timestamp,duration,building]',
    'lastSuccessfulBuild[number,timestamp]',
    'lastFailedBuild[number,timestamp]',
    'builds[number,result,timestamp,duration,building]',
    'property[parameterDefinitions[name,type,_class,description,defaultParameterValue[value],choices,allValueItems[values[name,value]]]]',
    'actions[parameterDefinitions[name,type,_class,description,defaultParameterValue[value],choices,allValueItems[values[name,value]]]]'
  ].join(',')

  const data = await jenkinsRequest('GET', `${prefix}/api/json?tree=${treeParam}`)

  const parameters = extractParameterDefinitions(data)

  const builds = Array.isArray(data.builds)
    ? data.builds.map((b) => ({
        number: b.number,
        result: b.result || (b.building ? 'BUILDING' : 'UNKNOWN'),
        timestamp: b.timestamp,
        duration: b.duration,
        building: !!b.building
      }))
    : []

  return {
    name: data.name,
    fullName: data.fullName || data.name,
    path: jobPath,
    url: data.url,
    color: data.color,
    status: mapColorToStatus(data.color, data.lastBuild),
    description: data.description || '',

    inQueue: !!data.inQueue,
    nextBuildNumber: data.nextBuildNumber,
    lastBuild: data.lastBuild
      ? {
          number: data.lastBuild.number,
          result: data.lastBuild.result || (data.lastBuild.building ? 'BUILDING' : 'UNKNOWN'),
          timestamp: data.lastBuild.timestamp,
          duration: data.lastBuild.duration,
          building: !!data.lastBuild.building
        }
      : null,
    lastSuccessfulBuild: data.lastSuccessfulBuild,
    lastFailedBuild: data.lastFailedBuild,
    parameters,
    isParameterized: parameters.length > 0,
    builds
  }
}

/**
 * 触发运行 Job 构建
 * @param {string} jobPath - 任务路径
 * @param {object|null} parameters - 参数键值对
 */
export async function buildJob(jobPath, parameters = null) {
  const prefix = formatJobPath(jobPath)
  let endpoint = ''
  let postData = null

  if (parameters && Object.keys(parameters).length > 0) {
    endpoint = `${prefix}/buildWithParameters`
    const formParams = new URLSearchParams()
    for (const [key, value] of Object.entries(parameters)) {
      formParams.append(key, value !== undefined && value !== null ? String(value) : '')
    }
    postData = formParams
  } else {
    endpoint = `${prefix}/build`
  }

  const result = await jenkinsRequest('POST', endpoint, postData)

  let queueId = null
  if (result.location) {
    const match = result.location.match(/\/queue\/item\/(\d+)\//)
    if (match) {
      queueId = match[1]
    }
  }

  return {
    success: true,
    location: result.location,
    queueId
  }
}

/**
 * 获取队列排队项状态（用于跟踪排队并获取生成的 buildNumber）
 */
export async function getQueueItem(queueId) {
  if (!queueId) throw new JenkinsError('缺少 queueId', 'INVALID_ARGUMENT')
  const data = await jenkinsRequest('GET', `/queue/item/${queueId}/api/json`)

  const item = {
    id: data.id,
    blocked: !!data.blocked,
    buildable: !!data.buildable,
    cancelled: !!data.cancelled,
    why: data.why || null,
    executable: data.executable
      ? {
          number: data.executable.number,
          url: data.executable.url
        }
      : null
  }

  return item
}

/**
 * 取消队列中的构建任务
 */
export async function cancelQueueItem(queueId) {
  if (!queueId) throw new JenkinsError('缺少 queueId', 'INVALID_ARGUMENT')
  await jenkinsRequest('POST', `/queue/cancelItem?id=${queueId}`)
  return { success: true }
}

/**
 * 获取构建控制台增量日志 (Progressive Text)
 * @param {string} jobPath - 任务路径
 * @param {number} buildNumber - 构建号
 * @param {number} start - 字节偏移量 (从 0 开始)
 */
export async function getBuildLog(jobPath, buildNumber, start = 0) {
  const prefix = formatJobPath(jobPath)
  const path = `${prefix}/${buildNumber}/logText/progressiveText?start=${start}`

  const response = await jenkinsRequest('GET', path, null, {
    returnFullResponse: true
  })

  if (!response.ok) {
    throw new JenkinsError(
      `获取日志失败 [HTTP ${response.status}]: ${response.statusText}`,
      'LOG_ERROR',
      response.status
    )
  }

  const text = await response.text()
  const textSizeHeader = response.headers.get('x-text-size')
  const moreDataHeader = response.headers.get('x-more-data')

  const textSize = textSizeHeader ? parseInt(textSizeHeader, 10) : start + text.length
  const hasMore = moreDataHeader === 'true'

  return {
    text,
    textSize,
    hasMore
  }
}

/**
 * 停止/中止正在运行的构建
 */
export async function stopBuild(jobPath, buildNumber) {
  const prefix = formatJobPath(jobPath)
  await jenkinsRequest('POST', `${prefix}/${buildNumber}/stop`)
  return { success: true }
}

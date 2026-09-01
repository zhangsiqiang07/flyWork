import { exec } from 'child_process'
import { existsSync, readFileSync, readdirSync, statSync } from 'fs'
import { join, basename } from 'path'
import { promisify } from 'util'
import { URL } from 'url'

const execAsync = promisify(exec)

/**
 * Clean and parse domain from user input (can be domain, hostname, or full URL)
 */
export function extractDomainAndUrl(input) {
  let raw = (input || '').trim()
  if (!raw) return { domain: '', url: null, error: '请输入域名或完整链接' }

  // If user entered only domain (e.g. example.com or example.com/path)
  if (!raw.startsWith('http://') && !raw.startsWith('https://')) {
    raw = 'https://' + raw
  }

  try {
    const parsed = new URL(raw)
    const domain = parsed.hostname.toLowerCase()
    return {
      domain,
      url: parsed,
      raw
    }
  } catch (err) {
    return { domain: '', url: null, error: `无效的 URL 格式: ${err.message}` }
  }
}

/**
 * Fetch a URL with detailed network inspection (status, redirects, headers, timing, SSL)
 */
async function inspectFetch(targetUrl, timeoutMs = 8000) {
  const startTime = Date.now()
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

    const response = await fetch(targetUrl, {
      method: 'GET',
      redirect: 'manual', // Do not automatically follow redirects, detect them!
      headers: {
        'User-Agent': 'Apple-AASA-Verifier/1.0 (Macintosh; Intel Mac OS X; flyWork)',
        Accept: 'application/json, text/plain, */*'
      },
      signal: controller.signal
    })

    clearTimeout(timeoutId)
    const duration = Date.now() - startTime

    const status = response.status
    const statusText = response.statusText
    const headers = {}
    response.headers.forEach((val, key) => {
      headers[key.toLowerCase()] = val
    })

    const contentType = headers['content-type'] || ''
    const location = headers['location'] || ''
    const isRedirect = status >= 300 && status < 400

    let bodyText = ''
    let bodyJson = null
    let jsonError = null

    try {
      bodyText = await response.text()
      if (bodyText) {
        try {
          bodyJson = JSON.parse(bodyText)
        } catch (e) {
          jsonError = e.message
        }
      }
    } catch {
      bodyText = ''
    }

    return {
      success: true,
      status,
      statusText,
      headers,
      contentType,
      isRedirect,
      redirectLocation: location,
      bodyText,
      bodyJson,
      jsonError,
      duration,
      contentLength: bodyText.length,
      url: targetUrl
    }
  } catch (err) {
    const duration = Date.now() - startTime
    let errorMessage = err.message || '网络请求失败'
    let isSslError = false

    if (err.name === 'AbortError') {
      errorMessage = `请求超时 (${timeoutMs}ms)`
    } else if (
      errorMessage.includes('certificate') ||
      errorMessage.includes('SSL') ||
      errorMessage.includes('CERT_')
    ) {
      isSslError = true
      errorMessage = `SSL/TLS 证书校验失败: ${errorMessage}`
    }

    return {
      success: false,
      error: errorMessage,
      isSslError,
      duration,
      url: targetUrl
    }
  }
}

/**
 * Validate AASA structure and return diagnostics (checks, warnings, errors)
 */
export function validateAasa(data) {
  const issues = []
  const warnings = []
  const summary = {
    valid: false,
    format: 'unknown',
    appCount: 0,
    apps: []
  }

  if (!data || typeof data !== 'object') {
    issues.push({
      level: 'error',
      code: 'INVALID_JSON',
      message: 'AASA 文件内容不是有效的 JSON 对象'
    })
    return { valid: false, issues, warnings, summary }
  }

  if (!data.applinks) {
    issues.push({
      level: 'error',
      code: 'MISSING_APPLINKS',
      message: '缺少必须的根节点 "applinks"'
    })
  }

  const applinks = data.applinks || {}
  const details = applinks.details

  if (!details) {
    issues.push({
      level: 'error',
      code: 'MISSING_DETAILS',
      message: '"applinks" 节点下缺少 "details" 数组或对象'
    })
    return { valid: false, issues, warnings, summary }
  }

  // Details can be an array or (legacy dictionary format)
  const detailList = Array.isArray(details) ? details : [details]
  if (detailList.length === 0) {
    warnings.push({
      level: 'warning',
      code: 'EMPTY_DETAILS',
      message: '"applinks.details" 为空列表，未配置任何 App 关联'
    })
  }

  let hasModern = false
  let hasLegacy = false
  const registeredApps = new Set()

  const APP_ID_REGEX = /^[A-Z0-9]{10}\.[a-zA-Z0-9.\-_]+$/

  detailList.forEach((detail, index) => {
    if (!detail || typeof detail !== 'object') {
      issues.push({
        level: 'error',
        code: 'INVALID_DETAIL_ITEM',
        message: `details[${index}] 格式错误，应为 JSON 对象`
      })
      return
    }

    // Modern format uses 'appIDs' and 'components'
    // Legacy format uses 'appID' and 'paths'
    const appIDs = detail.appIDs || (detail.appID ? [detail.appID] : [])
    const components = detail.components
    const paths = detail.paths

    if (appIDs.length === 0) {
      issues.push({
        level: 'error',
        code: 'MISSING_APP_ID',
        message: `details[${index}] 缺少 "appIDs" 或 "appID" 标识`
      })
    }

    appIDs.forEach((id) => {
      registeredApps.add(id)
      if (!APP_ID_REGEX.test(id)) {
        warnings.push({
          level: 'warning',
          code: 'MALFORMED_APP_ID',
          message: `AppID "${id}" 格式不规范。标准格式应为: 10位 TeamID + 点号 + BundleID (如: ABCDE12345.com.example.app)`
        })
      }
    })

    if (components !== undefined) {
      hasModern = true
      if (!Array.isArray(components)) {
        issues.push({
          level: 'error',
          code: 'COMPONENTS_NOT_ARRAY',
          message: `details[${index}].components 应为数组`
        })
      } else {
        components.forEach((c, cIdx) => {
          if (!c || typeof c !== 'object') {
            issues.push({
              level: 'error',
              code: 'COMPONENT_NOT_OBJECT',
              message: `details[${index}].components[${cIdx}] 应为规则对象`
            })
          } else {
            if (c['/'] === undefined && c['?'] === undefined && c['#'] === undefined) {
              warnings.push({
                level: 'warning',
                code: 'COMPONENT_NO_MATCHER',
                message: `details[${index}].components[${cIdx}] 未包含任何匹配规则 ('/', '?' 或 '#')`
              })
            }
          }
        })
      }
    }

    if (paths !== undefined) {
      hasLegacy = true
      if (!Array.isArray(paths)) {
        issues.push({
          level: 'error',
          code: 'PATHS_NOT_ARRAY',
          message: `details[${index}].paths 应为字符串数组`
        })
      } else {
        paths.forEach((p, pIdx) => {
          if (typeof p !== 'string') {
            issues.push({
              level: 'error',
              code: 'PATH_NOT_STRING',
              message: `details[${index}].paths[${pIdx}] 应为字符串`
            })
          }
        })
      }
    }

    if (components === undefined && paths === undefined) {
      issues.push({
        level: 'error',
        code: 'MISSING_RULES',
        message: `details[${index}] 既未包含 Modern 规范的 "components"，也未包含 Legacy 规范的 "paths"`
      })
    }
  })

  if (hasModern && hasLegacy) {
    summary.format = 'hybrid (Modern + Legacy)'
  } else if (hasModern) {
    summary.format = 'modern (iOS 13+)'
  } else if (hasLegacy) {
    summary.format = 'legacy (iOS 9-12)'
  }

  summary.appCount = registeredApps.size
  summary.apps = Array.from(registeredApps)
  summary.valid = issues.length === 0

  return {
    valid: summary.valid,
    format: summary.format,
    issues,
    warnings,
    summary
  }
}

/**
 * Match a target URL against AASA data according to Apple Universal Link matching rules
 */
export function matchUrlAgainstAasa(aasaJson, targetUrlString, targetAppId = null) {
  let urlObj
  try {
    urlObj = new URL(
      targetUrlString.startsWith('http') ? targetUrlString : `https://${targetUrlString}`
    )
  } catch (err) {
    return {
      matched: false,
      error: `无效的目标测试链接: ${err.message}`
    }
  }

  const pathName = urlObj.pathname || '/'
  const searchParams = urlObj.searchParams
  const fragment = urlObj.hash ? urlObj.hash.replace(/^#/, '') : ''

  const details = aasaJson?.applinks?.details
  if (!details) {
    return {
      matched: false,
      reason: 'AASA 未包含有效的 applinks.details 配置'
    }
  }

  const detailList = Array.isArray(details) ? details : [details]
  const matchEvaluation = []

  for (let dIndex = 0; dIndex < detailList.length; dIndex++) {
    const detail = detailList[dIndex]
    const appIDs = detail.appIDs || (detail.appID ? [detail.appID] : ['未知 AppID'])

    // If targetAppId is specified, skip unrelated details
    if (targetAppId && !appIDs.some((id) => id.includes(targetAppId))) {
      continue
    }

    // 1. Check Modern format components
    if (Array.isArray(detail.components)) {
      for (let cIndex = 0; cIndex < detail.components.length; cIndex++) {
        const comp = detail.components[cIndex]
        const isExcluded = Boolean(comp.exclude)
        const pathRule = comp['/']
        const queryRule = comp['?']
        const fragmentRule = comp['#']

        let pathMatches = true
        let queryMatches = true
        let fragmentMatches = true

        // Match Path
        if (pathRule !== undefined) {
          pathMatches = matchAppleWildcard(pathRule, pathName)
        }

        // Match Query
        if (queryRule !== undefined && typeof queryRule === 'object') {
          for (const [qKey, qPattern] of Object.entries(queryRule)) {
            const actualVal = searchParams.get(qKey)
            if (actualVal === null) {
              queryMatches = false
              break
            }
            if (qPattern && !matchAppleWildcard(qPattern, actualVal)) {
              queryMatches = false
              break
            }
          }
        }

        // Match Fragment
        if (fragmentRule !== undefined) {
          fragmentMatches = matchAppleWildcard(fragmentRule, fragment)
        }

        const isHit = pathMatches && queryMatches && fragmentMatches

        matchEvaluation.push({
          format: 'modern',
          appIDs,
          ruleIndex: cIndex,
          rule: comp,
          isHit,
          isExcluded,
          comment: comp.comment || ''
        })

        // Apple matches first matching component in order!
        if (isHit) {
          if (isExcluded) {
            return {
              matched: false,
              isExcluded: true,
              matchedAppId: appIDs[0],
              ruleType: 'modern',
              rule: comp,
              reason: `命中排除规则 (exclude: true): "${pathRule || JSON.stringify(comp)}"，iOS 将不会唤起 App`,
              evaluations: matchEvaluation
            }
          } else {
            return {
              matched: true,
              isExcluded: false,
              matchedAppId: appIDs[0],
              appIDs,
              ruleType: 'modern',
              rule: comp,
              reason: `成功命中 Universal Link 匹配规则: "${pathRule || JSON.stringify(comp)}"`,
              evaluations: matchEvaluation
            }
          }
        }
      }
    }

    // 2. Check Legacy format paths
    if (Array.isArray(detail.paths)) {
      for (let pIndex = 0; pIndex < detail.paths.length; pIndex++) {
        const rawPathRule = detail.paths[pIndex]
        const isExcluded = rawPathRule.trim().startsWith('NOT ')
        const actualRule = isExcluded ? rawPathRule.trim().substring(4).trim() : rawPathRule.trim()

        const isHit = matchAppleWildcard(actualRule, pathName)

        matchEvaluation.push({
          format: 'legacy',
          appIDs,
          ruleIndex: pIndex,
          rule: rawPathRule,
          isHit,
          isExcluded
        })

        if (isHit) {
          if (isExcluded) {
            return {
              matched: false,
              isExcluded: true,
              matchedAppId: appIDs[0],
              ruleType: 'legacy',
              rule: rawPathRule,
              reason: `命中 Legacy 排除规则 ("${rawPathRule}")，iOS 将不会唤起 App`,
              evaluations: matchEvaluation
            }
          } else {
            return {
              matched: true,
              isExcluded: false,
              matchedAppId: appIDs[0],
              appIDs,
              ruleType: 'legacy',
              rule: rawPathRule,
              reason: `成功命中 Legacy Universal Link 路径: "${rawPathRule}"`,
              evaluations: matchEvaluation
            }
          }
        }
      }
    }
  }

  return {
    matched: false,
    isExcluded: false,
    reason: '该 URL 未匹配 AASA 中的任何路由组件或路径规则，默认在 Safari 中打开网页',
    evaluations: matchEvaluation
  }
}

/**
 * Match Apple's wildcard syntax:
 * '*' matches 0 or more characters
 * '?' matches exactly 1 character
 * Case-sensitive
 */
function matchAppleWildcard(pattern, text) {
  if (pattern === '*') return true
  if (pattern === text) return true

  // Escape regex special chars except * and ?
  let regexStr = '^'
  for (let i = 0; i < pattern.length; i++) {
    const char = pattern[i]
    if (char === '*') {
      regexStr += '.*'
    } else if (char === '?') {
      regexStr += '.'
    } else if (['.', '+', '^', '$', '{', '}', '(', ')', '|', '[', ']', '\\'].includes(char)) {
      regexStr += '\\' + char
    } else {
      regexStr += char
    }
  }
  regexStr += '$'

  try {
    const regex = new RegExp(regexStr)
    return regex.test(text)
  } catch {
    return false
  }
}

/**
 * Comprehensive Universal Link Verification for a domain or URL
 */
export async function verifyUniversalLink(inputUrlOrDomain) {
  const { domain, url: parsedUrl, error } = extractDomainAndUrl(inputUrlOrDomain)
  if (error) {
    return {
      success: false,
      error,
      timestamp: new Date().toISOString()
    }
  }

  const results = {
    domain,
    testedInput: inputUrlOrDomain,
    timestamp: new Date().toISOString(),
    httpsCheck: null,
    wellKnownAasa: null,
    rootAasa: null,
    activeAasa: null, // The winning direct AASA response
    appleCdn: null,
    aasaValidation: null,
    cdnSyncStatus: 'unknown',
    score: 0, // 0 - 100 health score
    recommendations: []
  }

  // 1. Fetch .well-known/apple-app-site-association
  const wellKnownUrl = `https://${domain}/.well-known/apple-app-site-association`
  const rootUrl = `https://${domain}/apple-app-site-association`
  const appleCdnUrl = `https://app-site-association.cdn-apple.com/a/v1/${domain}`

  const [wellKnownRes, rootRes, appleCdnRes] = await Promise.all([
    inspectFetch(wellKnownUrl, 6000),
    inspectFetch(rootUrl, 6000),
    inspectFetch(appleCdnUrl, 8000)
  ])

  results.wellKnownAasa = wellKnownRes
  results.rootAasa = rootRes
  results.appleCdn = appleCdnRes

  // Determine active direct AASA
  if (wellKnownRes.success && wellKnownRes.status === 200 && wellKnownRes.bodyJson) {
    results.activeAasa = wellKnownRes
    results.activeAasaLocation = '/.well-known/apple-app-site-association'
  } else if (rootRes.success && rootRes.status === 200 && rootRes.bodyJson) {
    results.activeAasa = rootRes
    results.activeAasaLocation = '/apple-app-site-association'
  } else if (wellKnownRes.success && wellKnownRes.bodyText) {
    results.activeAasa = wellKnownRes
    results.activeAasaLocation = '/.well-known/apple-app-site-association'
  } else {
    results.activeAasa = rootRes.success ? rootRes : wellKnownRes
    results.activeAasaLocation = 'none'
  }

  // 2. Direct HTTPS & Server Diagnostics
  const checks = []
  let score = 0

  const active = results.activeAasa
  if (!active || !active.success) {
    checks.push({
      name: 'HTTPS 访问',
      status: 'error',
      detail: active?.error || '无法通过 HTTPS 访问该域名'
    })
    results.recommendations.push(
      '确保服务器已正确配置 HTTPS 并绑定了有效合规的 SSL 证书（自签名证书无法被 iOS 信任）'
    )
  } else {
    checks.push({
      name: 'HTTPS 访问',
      status: 'success',
      detail: `响应时间: ${active.duration}ms`
    })
    score += 25

    // Check HTTP Status Code
    if (active.status === 200) {
      checks.push({
        name: 'HTTP 状态码 (200 OK)',
        status: 'success',
        detail: '返回 200 OK'
      })
      score += 25
    } else if (active.isRedirect) {
      checks.push({
        name: '重定向拦截 (Redirect)',
        status: 'error',
        detail: `状态码 ${active.status} 重定向至 ${active.redirectLocation}`
      })
      results.recommendations.push(
        'Apple 官方禁止 AASA 文件经过任何重定向（301/302），请确保直接返回 200 OK'
      )
    } else {
      checks.push({
        name: 'HTTP 状态码',
        status: 'error',
        detail: `返回异常状态码: ${active.status} ${active.statusText}`
      })
      results.recommendations.push('AASA 文件未正常部署，必须直接返回 HTTP 200 OK 且无需身份验证')
    }

    // Check Content-Type
    const ct = (active.contentType || '').toLowerCase()
    if (ct.includes('application/json')) {
      checks.push({
        name: 'Content-Type 响应头',
        status: 'success',
        detail: active.contentType
      })
      score += 15
    } else if (ct.includes('pkcs7') || ct.includes('text/plain')) {
      checks.push({
        name: 'Content-Type 响应头',
        status: 'warning',
        detail: `${active.contentType} (建议修改为 application/json)`
      })
      score += 10
      results.recommendations.push('建议将响应头 Content-Type 设置为 application/json')
    } else {
      checks.push({
        name: 'Content-Type 响应头',
        status: 'warning',
        detail: `${active.contentType || '未设置'} (标准为 application/json)`
      })
      results.recommendations.push('Content-Type 未设置为 application/json，部分客户端抓取可能受阻')
    }

    // Check Path (.well-known is strongly recommended by Apple)
    if (wellKnownRes.status === 200) {
      checks.push({
        name: '部署路径 (.well-known)',
        status: 'success',
        detail: '位于 /.well-known/apple-app-site-association (现代 iOS 标准路径)'
      })
      score += 10
    } else if (rootRes.status === 200) {
      checks.push({
        name: '部署路径 (根路径)',
        status: 'warning',
        detail: '位于 /apple-app-site-association (建议同时部署至 /.well-known/ 目录)'
      })
      score += 5
      results.recommendations.push(
        '建议优先将 AASA 文件部署至 /.well-known/apple-app-site-association'
      )
    }

    // Check File Size (< 128KB recommended by Apple)
    const sizeKb = (active.contentLength / 1024).toFixed(1)
    if (active.contentLength < 128 * 1024) {
      checks.push({
        name: '文件体积',
        status: 'success',
        detail: `${sizeKb} KB (符合 < 128KB 限制)`
      })
      score += 5
    } else {
      checks.push({
        name: '文件体积过大',
        status: 'error',
        detail: `${sizeKb} KB (超过了 Apple 建议的 128KB 限制)`
      })
      results.recommendations.push('AASA 文件大小超过 128KB，系统可能拒绝下载该文件')
    }
  }

  // 3. Validate AASA Content Structure
  if (active?.bodyJson) {
    const aasaVal = validateAasa(active.bodyJson)
    results.aasaValidation = aasaVal
    if (aasaVal.valid) {
      score += 20
    }
  } else if (active?.jsonError) {
    results.aasaValidation = {
      valid: false,
      issues: [
        {
          level: 'error',
          code: 'JSON_PARSE_ERROR',
          message: `JSON 解析失败: ${active.jsonError}`
        }
      ],
      warnings: [],
      summary: { valid: false, format: 'invalid', appCount: 0, apps: [] }
    }
    results.recommendations.push('AASA 文件必须为严格合法的 JSON，不要带有末尾逗号或注释')
  }

  // 4. Check Apple CDN Cache (iOS 14+)
  if (appleCdnRes.success && appleCdnRes.status === 200 && appleCdnRes.bodyJson) {
    // Compare Apple CDN content with Direct AASA
    const directStr = JSON.stringify(active?.bodyJson || {})
    const cdnStr = JSON.stringify(appleCdnRes.bodyJson)
    const isSynced = directStr === cdnStr

    results.cdnSyncStatus = isSynced ? 'synced' : 'outdated'
    if (isSynced) {
      results.cdnSyncMessage = 'Apple 官方 CDN 已同步最新 AASA 配置'
    } else {
      results.cdnSyncMessage =
        'Apple CDN 内容与源站暂不一致（Apple CDN 通常在 24~48 小时内完成拉取更新）'
      results.recommendations.push(
        'Apple 官方 CDN 缓存通常有 24-48 小时延迟。本地测试可使用 ?mode=developer 避开 CDN'
      )
    }
  } else if (appleCdnRes.status === 404) {
    results.cdnSyncStatus = 'not_cached'
    results.cdnSyncMessage =
      'Apple CDN 尚未索引此域名的 AASA 文件 (HTTP 404)。新域名上线通常需要数小时至一天被 Apple CDN 爬虫拉取'
    results.recommendations.push(
      'iOS 14+ 默认通过 Apple CDN 加载。若需立即本地调试，请在 entitlements 中使用 applinks:<domain>?mode=developer'
    )
  } else {
    results.cdnSyncStatus = 'unreachable'
    results.cdnSyncMessage = `无法查询 Apple CDN: ${appleCdnRes.error || appleCdnRes.status}`
  }

  results.checks = checks
  results.score = Math.min(100, score)

  // If user entered a path or query in the input URL, run a test match automatically!
  if (parsedUrl && (parsedUrl.pathname !== '/' || parsedUrl.search)) {
    if (active?.bodyJson) {
      results.autoTestResult = matchUrlAgainstAasa(active.bodyJson, parsedUrl.toString())
    }
  }

  return results
}

/**
 * Scan a local workspace directory for Xcode entitlements & project.pbxproj to inspect associated-domains
 */
export async function checkWorkspaceAssociatedDomains(workspaceRoot) {
  if (!workspaceRoot || !existsSync(workspaceRoot)) {
    return {
      found: false,
      error: '工作空间目录不存在'
    }
  }

  const results = {
    found: false,
    workspaceRoot,
    entitlementsFiles: [],
    domains: [],
    xcodeProjects: [],
    bundleIds: [],
    teamIds: [],
    warnings: [],
    recommendations: []
  }

  try {
    // Recursive search for .entitlements and .pbxproj files (capped depth 4)
    function walk(dir, depth = 0) {
      if (depth > 4) return
      let entries = []
      try {
        entries = readdirSync(dir)
      } catch {
        return
      }

      for (const entry of entries) {
        if (
          entry === '.git' ||
          entry === 'node_modules' ||
          entry === 'Pods' ||
          entry === 'build' ||
          entry === 'DerivedData'
        ) {
          continue
        }
        const fullPath = join(dir, entry)
        try {
          const stat = statSync(fullPath)
          if (stat.isDirectory()) {
            if (entry.endsWith('.xcodeproj')) {
              results.xcodeProjects.push(fullPath)
            }
            walk(fullPath, depth + 1)
          } else if (stat.isFile()) {
            if (entry.endsWith('.entitlements')) {
              results.entitlementsFiles.push(fullPath)
            }
          }
        } catch {
          // ignore
        }
      }
    }

    walk(workspaceRoot, 0)

    // Parse each entitlements file
    for (const entPath of results.entitlementsFiles) {
      try {
        const content = readFileSync(entPath, 'utf8')
        // Check for com.apple.developer.associated-domains
        if (content.includes('com.apple.developer.associated-domains')) {
          results.found = true
          // Match all <string> entries under associated-domains
          const matchBlock = content.match(
            /<key>com\.apple\.developer\.associated-domains<\/key>[\s\S]*?<array>([\s\S]*?)<\/array>/
          )
          if (matchBlock && matchBlock[1]) {
            const stringMatches = matchBlock[1].matchAll(/<string>(.*?)<\/string>/g)
            for (const sm of stringMatches) {
              const rawDomain = sm[1].trim()
              const isApplink = rawDomain.startsWith('applinks:')
              const hasDevMode = rawDomain.includes('?mode=developer')
              const hasMistakeHttps =
                rawDomain.includes('applinks:https://') || rawDomain.includes('applinks:http://')

              results.domains.push({
                file: basename(entPath),
                fullPath: entPath,
                raw: rawDomain,
                isApplink,
                hasDevMode,
                hasMistakeHttps,
                cleanDomain: rawDomain
                  .replace(/^applinks:/, '')
                  .replace(/\?mode=developer.*$/, '')
                  .replace(/^https?:\/\//, '')
              })

              if (hasMistakeHttps) {
                results.warnings.push({
                  file: basename(entPath),
                  message: `配置错误: "${rawDomain}" 包含协议头。正确格式为 "applinks:${rawDomain.replace(/applinks:https?:\/\//, '')}"（不要加 https://）`
                })
              }
            }
          }
        }
      } catch (readErr) {
        console.error(`Error reading ${entPath}:`, readErr)
      }
    }

    // Inspect project.pbxproj to extract PRODUCT_BUNDLE_IDENTIFIER & DEVELOPMENT_TEAM
    for (const projDir of results.xcodeProjects) {
      const pbxPath = join(projDir, 'project.pbxproj')
      if (existsSync(pbxPath)) {
        try {
          const pbxContent = readFileSync(pbxPath, 'utf8')
          // Extract PRODUCT_BUNDLE_IDENTIFIER
          const bundleMatches = pbxContent.matchAll(
            /PRODUCT_BUNDLE_IDENTIFIER\s*=\s*"?([a-zA-Z0-9.\-_$(){}]+)"?;/g
          )
          for (const bm of bundleMatches) {
            const bid = bm[1]
            if (bid && !bid.includes('$') && !results.bundleIds.includes(bid)) {
              results.bundleIds.push(bid)
            }
          }
          // Extract DEVELOPMENT_TEAM
          const teamMatches = pbxContent.matchAll(/DEVELOPMENT_TEAM\s*=\s*"?([A-Z0-9]{10})"?;/g)
          for (const tm of teamMatches) {
            const tid = tm[1]
            if (tid && !results.teamIds.includes(tid)) {
              results.teamIds.push(tid)
            }
          }
        } catch {
          // ignore
        }
      }
    }
  } catch (err) {
    return {
      found: false,
      error: `扫描工程失败: ${err.message}`
    }
  }

  return results
}

/**
 * Open target Universal Link URL in a booted iOS Simulator using xcrun simctl
 */
export async function openUrlInSimulator(targetUrl) {
  if (!targetUrl) {
    return { success: false, error: '缺少测试目标 URL' }
  }

  try {
    // Check if xcrun is available and find booted devices
    const { stdout: devicesOutput } = await execAsync('xcrun simctl list devices booted -j', {
      timeout: 3000
    })

    let hasBooted = false
    try {
      const parsed = JSON.parse(devicesOutput)
      const devices = parsed.devices || {}
      for (const list of Object.values(devices)) {
        if (Array.isArray(list) && list.some((d) => d.state === 'Booted')) {
          hasBooted = true
          break
        }
      }
    } catch {
      hasBooted = devicesOutput.includes('Booted')
    }

    if (!hasBooted) {
      return {
        success: false,
        error:
          '未检测到已启动的 iOS 模拟器。请先在 Xcode 中启动一台模拟器，或者运行 "open -a Simulator"'
      }
    }

    // Execute simctl openurl
    const command = `xcrun simctl openurl booted "${targetUrl.replace(/"/g, '\\"')}"`
    const { stdout, stderr } = await execAsync(command, { timeout: 5000 })

    return {
      success: true,
      command,
      stdout: stdout || '已发送指令至 iOS 模拟器',
      stderr
    }
  } catch (err) {
    return {
      success: false,
      error: `模拟器调用失败: ${err.message}`,
      command: `xcrun simctl openurl booted "${targetUrl}"`
    }
  }
}

/**
 * Generate standard AASA JSON file template
 */
export function generateAasaTemplate({
  teamId,
  bundleId,
  paths = [],
  components = [],
  format = 'modern'
}) {
  const tId = (teamId || 'TEAMID1234').trim().toUpperCase()
  const bId = (bundleId || 'com.example.myapp').trim()
  const appId = `${tId}.${bId}`

  if (format === 'legacy') {
    return {
      applinks: {
        apps: [],
        details: [
          {
            appID: appId,
            paths: paths.length > 0 ? paths : ['/detail/*', 'NOT /secret/*', '*']
          }
        ]
      }
    }
  }

  // Modern (or hybrid)
  const defaultComponents = [
    {
      '/': '/goods/*',
      '?': { id: '?*' },
      comment: '商品详情页匹配'
    },
    {
      '/': '/user/*',
      comment: '用户主页'
    },
    {
      '/': '/pay/*',
      exclude: true,
      comment: '安全拦截: 禁止网页唤起支付页'
    },
    {
      '/': '/*'
    }
  ]

  const modernDetails = [
    {
      appIDs: [appId],
      components: components.length > 0 ? components : defaultComponents
    }
  ]

  if (format === 'hybrid') {
    return {
      applinks: {
        apps: [],
        details: [
          ...modernDetails,
          {
            appID: appId,
            paths: paths.length > 0 ? paths : ['/goods/*', 'NOT /pay/*', '*']
          }
        ]
      }
    }
  }

  return {
    applinks: {
      apps: [],
      details: modernDetails
    }
  }
}

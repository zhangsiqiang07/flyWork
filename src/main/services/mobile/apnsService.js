import http2 from 'http2'
import crypto from 'crypto'
import fs from 'fs'

const APNS_ENDPOINTS = {
  sandbox: 'https://api.sandbox.push.apple.com',
  production: 'https://api.push.apple.com'
}

const APNS_ERRORS = {
  BadDeviceToken: {
    title: '设备令牌无效 (BadDeviceToken)',
    desc: 'Apple APNs 网关无法识别该 Device Token，或该 Token 与当前请求的网关环境冲突。',
    solutions: [
      '环境匹配检查：如果 App 是 Xcode 联机编译调试运行，请将环境选为【🛠 开发环境 (Sandbox)】；如果是 TestFlight 或 App Store 安装，请切换为【🚀 生产环境 (Production)】。',
      'Token 时效性检查：请确保粘贴的是真机最近一次启动在 didRegisterForRemoteNotificationsWithDeviceToken 中获取的完整最新 Token。',
      '真机设备确认：请勿使用模拟器的虚构 UUID，必须为真机硬件分配的 64 位 Hex 字符串。'
    ]
  },
  InvalidPushType: {
    title: '推送类型与应用不匹配 (InvalidPushType)',
    desc: 'apns-push-type 头部指定了不兼容的推送类型（例如选成了 voip 但 Topic 未带 .voip 后缀，或非 PushKit 令牌）。',
    solutions: [
      '解决方案：请在 Token 输入框右下方的【Push Type】下拉菜单中，将类型修改为【alert (普通横幅)】。',
      '如果确实在调试网络电话 (VoIP)，Bundle ID 必须带有 .voip 后缀（如 com.foresightx.petpal.voip），且 Token 必须由 iOS PushKit 框架生成。'
    ]
  },
  DeviceTokenNotForTopic: {
    title: 'Token 与 Bundle ID 不匹配 (DeviceTokenNotForTopic)',
    desc: '目标 Device Token 对应的 App 与当前填写的 Bundle ID (Topic) 不属于同一款应用。',
    solutions: [
      '请检查 App 的 CFBundleIdentifier（例如 com.company.app），确保与真机上实际运行的应用完全一致。',
      '如果使用了 Notification Service Extension，请填写主 App 的 Bundle ID，而非扩展的 Bundle ID。'
    ]
  },
  BadCertificate: {
    title: '证书无效 (BadCertificate)',
    desc: '提供的 .p12 证书文件已损坏、格式错误或密码不正确。',
    solutions: [
      '请重新从钥匙串中导出 Apple Push Services 证书（确保包含关联的私钥，格式为 .p12）。',
      '检查导出密码是否正确填写。'
    ]
  },
  BadCertificateEnvironment: {
    title: '证书与环境不匹配 (BadCertificateEnvironment)',
    desc: '所使用的 .p12 证书环境与当前选择的推送通道冲突。',
    solutions: [
      'Apple Development 证书只能连接【开发环境 (Sandbox)】。',
      'Apple Production 证书只能连接【生产环境 (Production)】。',
      '请在上方切换环境或更换对应环境的证书。'
    ]
  },
  ExpiredProviderToken: {
    title: '鉴权令牌已过期 (ExpiredProviderToken)',
    desc: '.p8 鉴权 JWT 的有效时长已超过 Apple 规定的 60 分钟。',
    solutions: ['系统已为您自动清除旧缓存并重新签发，请重新尝试发送。']
  },
  InvalidProviderToken: {
    title: '鉴权密钥信息有误 (InvalidProviderToken)',
    desc: '.p8 密钥文件、Key ID 或 Team ID 不正确，Apple 拒绝了签名认证。',
    solutions: [
      '核对 10 位的 Key ID：可在 Apple Developer 网站 Keys 列表查看。',
      '核对 10 位的 Team ID：可在 Apple 开发者中心右上角查看团队 ID。',
      '核对 .p8 密钥：确保该密钥已勾选启用 Apple Push Notifications service (APNs)。'
    ]
  },
  MissingProviderToken: {
    title: '缺少鉴权令牌 (MissingProviderToken)',
    desc: '请求头中未附带有效的 Authorization 头部。',
    solutions: ['请确认 .p8 密钥与 Key ID/Team ID 是否完整填写。']
  },
  TopicDisallowed: {
    title: '该 App 未开通推送权限 (TopicDisallowed)',
    desc: '该 Bundle ID 尚未在 Apple Developer Portal 中启用 Push Notifications 功能。',
    solutions: [
      '前往 Apple Developer 后台 -> Identifiers -> 选中对应的 App ID。',
      '勾选 Capabilities 中的【Push Notifications】并保存，随后重新打包工程。'
    ]
  },
  Unregistered: {
    title: '设备已注销或卸载 (Unregistered)',
    desc: '该真机上已卸载该应用，或用户在系统设置中彻底关闭了通知权限。',
    solutions: ['重新在真机上运行该 App，重新授权推送并获取最新的 Device Token。']
  },
  PayloadTooLarge: {
    title: '推送内容过大 (PayloadTooLarge)',
    desc: 'Payload 体积超出了 Apple APNs 限制。',
    solutions: [
      '普通 alert 通知 JSON 体积不能超过 4096 字节 (4KB)。',
      'VoIP 通知不能超过 5120 字节 (5KB)。',
      '精简自定义 JSON 数据或移除过长字段。'
    ]
  },
  TooManyRequests: {
    title: '请求过于频繁 (TooManyRequests)',
    desc: '短时间内向 Apple APNs 网关发送了过多请求，触发了苹果限流机制。',
    solutions: ['请等待数秒后再次尝试。']
  },
  InternalServerError: {
    title: 'Apple APNs 内部错误 (InternalServerError)',
    desc: 'Apple 官方服务器发生瞬时异常。',
    solutions: ['通常为苹果端网络抖动，请稍后重新发送。']
  },
  MissingConfig: {
    title: '配置信息不完整',
    desc: '发起推送所需的必要凭证参数缺失。',
    solutions: ['请检查 .p8 密钥路径、Key ID、Team ID 或 .p12 证书路径。']
  },
  NetworkError: {
    title: '网络连接异常',
    desc: '当前 Mac 无法直连 Apple APNs 官方网关服务器。',
    solutions: [
      '请检查当前 Mac 的网络连接是否正常。',
      '如果开启了科学上网或企业代理，请确认代理未拦截 443 端口的 HTTP/2 协议。'
    ]
  }
}

// In-memory token cache: { [cacheKey]: { token: string, expiresAt: number } }
const tokenCache = new Map()

/**
 * Generate an ES256 JWT token for Apple APNs Provider Authentication (.p8)
 */
export function generateApnsJwt(p8ContentOrPath, keyId, teamId) {
  let p8Key = p8ContentOrPath
  if (fs.existsSync(p8ContentOrPath)) {
    p8Key = fs.readFileSync(p8ContentOrPath, 'utf-8')
  }

  const cacheKey = `${teamId}_${keyId}`
  const now = Math.floor(Date.now() / 1000)
  const cached = tokenCache.get(cacheKey)

  // Reuse token if valid for at least 10 more minutes
  if (cached && cached.expiresAt > now + 600) {
    return cached.token
  }

  const header = Buffer.from(JSON.stringify({ alg: 'ES256', kid: keyId.trim() })).toString(
    'base64url'
  )
  const claims = Buffer.from(
    JSON.stringify({
      iss: teamId.trim(),
      iat: now
    })
  ).toString('base64url')

  const unsignedToken = `${header}.${claims}`
  const signature = crypto
    .sign('sha256', Buffer.from(unsignedToken), {
      key: p8Key,
      dsaEncoding: 'ieee-p1363'
    })
    .toString('base64url')

  const jwt = `${unsignedToken}.${signature}`
  tokenCache.set(cacheKey, {
    token: jwt,
    expiresAt: now + 3000 // Cache for 50 minutes
  })

  return jwt
}

/**
 * Clean device token: strip spaces, dashes, angle brackets
 */
export function cleanDeviceToken(rawToken) {
  if (!rawToken) return ''
  return rawToken.replace(/[<>\s-]/g, '').trim()
}

/**
 * Send real APNs push via HTTP/2
 */
export async function sendRealApnsPush(options) {
  const {
    environment = 'sandbox',
    authMode = 'token',
    p8Path,
    keyId,
    teamId,
    p12Path,
    p12Password = '',
    bundleId,
    deviceToken,
    payload,
    pushType = 'alert',
    priority = '10',
    expiration = 0
  } = options

  const token = cleanDeviceToken(deviceToken)
  const host = APNS_ENDPOINTS[environment] || APNS_ENDPOINTS.sandbox
  const startTime = Date.now()

  // Base metadata for debugging
  const meta = {
    environment,
    host,
    authMode,
    bundleId: bundleId?.trim() || '',
    deviceTokenLength: token ? token.length : 0,
    pushType,
    priority
  }

  // 1. Parameter Validations
  if (!token) {
    return {
      success: false,
      status: 'VALIDATION_ERROR',
      reason: 'MissingDeviceToken',
      error: 'Device Token 不能为空，请输入目标真机的 Device Token',
      friendlyTip: '请先在上方输入或粘贴目标真机的 Device Token。',
      solutions: ['真机启动时通过 didRegisterForRemoteNotificationsWithDeviceToken 打印获取。'],
      meta
    }
  }

  if (token.length < 32) {
    return {
      success: false,
      status: 'VALIDATION_ERROR',
      reason: 'InvalidTokenLength',
      error: `Device Token 长度异常 (${token.length} 位)，正常苹果 Token 为 64 位纯十六进制字符`,
      friendlyTip: '请核实粘贴的 Token 是否完整无缺失。',
      solutions: ['检查是否有末尾字符被截断。'],
      meta
    }
  }

  if (!bundleId || !bundleId.trim()) {
    return {
      success: false,
      status: 'VALIDATION_ERROR',
      reason: 'MissingBundleId',
      error: 'App Bundle Identifier (Topic) 不能为空',
      friendlyTip: '请填写目标 App 的 Bundle Identifier（例如 com.example.app）。',
      solutions: ['在 Xcode 的 General -> Identity -> Bundle Identifier 查看。'],
      meta
    }
  }

  if (authMode === 'token') {
    if (!p8Path || !p8Path.trim()) {
      return {
        success: false,
        status: 'CONFIG_ERROR',
        reason: 'MissingP8Path',
        error: '未指定 .p8 密钥文件，请点击“选择文件”导入 AuthKey.p8',
        friendlyTip: 'Token 鉴权模式需要提供从 Apple 开发者后台下载的 AuthKey_*.p8 密钥文件。',
        solutions: ['登录 developer.apple.com -> Keys -> 创建或下载 APNs 密钥文件。'],
        meta
      }
    }
    if (!fs.existsSync(p8Path)) {
      return {
        success: false,
        status: 'CONFIG_ERROR',
        reason: 'P8FileNotFound',
        error: `指定的 .p8 密钥文件不存在: ${p8Path}`,
        friendlyTip: '请核对该 .p8 文件的物理路径是否正确。',
        solutions: ['重新点击“选择文件”定位该 .p8 密钥。'],
        meta
      }
    }
    if (!keyId || !keyId.trim()) {
      return {
        success: false,
        status: 'CONFIG_ERROR',
        reason: 'MissingKeyId',
        error: '未填写 10 位 Key ID',
        friendlyTip: '请输入生成该 .p8 密钥时的 10 位 Key ID（如 2X9R4HXF34）。',
        solutions: ['在 Apple Developer 后台 Keys 列表中可查阅 Key ID。'],
        meta
      }
    }
    if (!teamId || !teamId.trim()) {
      return {
        success: false,
        status: 'CONFIG_ERROR',
        reason: 'MissingTeamId',
        error: '未填写 10 位 Team ID',
        friendlyTip: '请输入 Apple 开发者账号的 10 位团队 Team ID（如 9ABCDE1234）。',
        solutions: ['登录 developer.apple.com 右上角账号名下方可查阅 Team ID。'],
        meta
      }
    }
  } else if (authMode === 'certificate') {
    if (!p12Path || !p12Path.trim()) {
      return {
        success: false,
        status: 'CONFIG_ERROR',
        reason: 'MissingP12Path',
        error: '未指定 .p12 证书文件，请点击“选择文件”导入',
        friendlyTip: '证书模式需要从 macOS 钥匙串中导出包含私钥的 .p12 证书。',
        solutions: ['打开 macOS 钥匙串访问 -> 找到 Apple Push Services 证书 -> 导出为 .p12。'],
        meta
      }
    }
    if (!fs.existsSync(p12Path)) {
      return {
        success: false,
        status: 'CONFIG_ERROR',
        reason: 'P12FileNotFound',
        error: `指定的 .p12 证书文件不存在: ${p12Path}`,
        friendlyTip: '请核对 .p12 证书文件的物理路径是否正确。',
        solutions: ['重新点击“选择文件”定位证书。'],
        meta
      }
    }
  }

  return new Promise((resolve) => {
    let client = null
    let authorizationHeader = null

    try {
      if (authMode === 'token') {
        const jwt = generateApnsJwt(p8Path, keyId, teamId)
        authorizationHeader = `bearer ${jwt}`
        client = http2.connect(host, { timeout: 10000 })
      } else {
        const pfxBuffer = fs.readFileSync(p12Path)
        client = http2.connect(host, {
          pfx: pfxBuffer,
          passphrase: p12Password || '',
          timeout: 10000
        })
      }
    } catch (err) {
      const duration = Date.now() - startTime
      return resolve({
        success: false,
        status: 'INIT_ERROR',
        reason: 'ClientInitFailed',
        error: `初始化 APNs 连接通道失败: ${err.message}`,
        friendlyTip: '构建 HTTP/2 安全传输上下文时发生异常，通常由证书损坏或密钥算法不支持引起。',
        solutions: [err.message],
        duration,
        meta
      })
    }

    client.on('error', (err) => {
      const duration = Date.now() - startTime
      const errReason = err.code || 'NetworkError'
      const guide = APNS_ERRORS[errReason] || APNS_ERRORS.NetworkError

      resolve({
        success: false,
        status: 'NETWORK_ERROR',
        reason: errReason,
        error: `连接 Apple APNs 网关失败: ${err.message}`,
        friendlyTip: `${guide.desc} (${err.message})`,
        solutions: guide.solutions,
        duration,
        meta
      })
      try {
        client.close()
      } catch {}
    })

    client.on('timeout', () => {
      const duration = Date.now() - startTime
      resolve({
        success: false,
        status: 'TIMEOUT',
        reason: 'ConnectionTimeout',
        error: '连接 Apple APNs 网关超时 (10秒未响应)',
        friendlyTip: '网络往返超时，请检查是否处于受限内网环境，或当前网络访问苹果网关不稳定。',
        solutions: ['检查网络连通性', '切换蜂窝热点重试'],
        duration,
        meta
      })
      try {
        client.destroy()
      } catch {}
    })

    const payloadString = typeof payload === 'string' ? payload : JSON.stringify(payload)

    const headers = {
      ':method': 'POST',
      ':path': `/3/device/${token}`,
      'apns-topic': bundleId.trim(),
      'apns-push-type': pushType || 'alert',
      'apns-priority': String(priority || '10'),
      'apns-expiration': String(expiration ?? 0),
      'content-length': Buffer.byteLength(payloadString)
    }

    if (authorizationHeader) {
      headers['authorization'] = authorizationHeader
    }

    const req = client.request(headers)

    let responseHeaders = {}
    let responseBody = ''

    req.on('response', (headers) => {
      responseHeaders = headers
    })

    req.setEncoding('utf8')
    req.on('data', (chunk) => {
      responseBody += chunk
    })

    req.on('end', () => {
      const duration = Date.now() - startTime
      const status = responseHeaders[':status']
      const apnsId = responseHeaders['apns-id'] || ''

      try {
        client.close()
      } catch {}

      if (status === 200) {
        resolve({
          success: true,
          status: 200,
          apnsId,
          duration,
          environment,
          rawResponse: responseBody || '(空响应体 200 OK)',
          message: '推送已成功送达 Apple APNs 网关！真机将即刻收到通知。',
          meta
        })
      } else {
        let errorData = null
        try {
          errorData = JSON.parse(responseBody)
        } catch {
          errorData = { reason: responseBody || 'Unknown' }
        }

        const reason = errorData?.reason || (responseBody ? responseBody.trim() : `HTTP_${status}`)
        const guide = APNS_ERRORS[reason] || {
          title: `Apple 错误: ${reason}`,
          desc: `Apple 网关返回 HTTP 状态码 ${status}。`,
          solutions: [`响应内容: ${responseBody || '无返回消息体'}`]
        }

        // Invalidate token cache if token expired
        if (reason === 'ExpiredProviderToken') {
          tokenCache.delete(`${teamId}_${keyId}`)
        }

        resolve({
          success: false,
          status,
          apnsId,
          reason,
          rawResponse: responseBody || '(无响应体)',
          friendlyTitle: guide.title,
          friendlyTip: guide.desc,
          solutions: guide.solutions,
          duration,
          timestamp: errorData?.timestamp,
          error: `[HTTP ${status}] ${reason}: ${guide.desc}`,
          meta
        })
      }
    })

    req.on('error', (err) => {
      const duration = Date.now() - startTime
      try {
        client.close()
      } catch {}
      resolve({
        success: false,
        status: 'STREAM_ERROR',
        reason: err.code || 'StreamError',
        error: `HTTP/2 请求数据流异常: ${err.message}`,
        friendlyTip: '在与 Apple APNs 服务器进行数据流通讯时发生底层网络错误。',
        solutions: [err.message],
        duration,
        meta
      })
    })

    req.write(payloadString)
    req.end()
  })
}

/**
 * Validate a .p12 certificate file and passphrase
 */
export function validateP12Certificate(p12Path, password = '') {
  try {
    if (!fs.existsSync(p12Path)) {
      return { success: false, error: '证书文件不存在' }
    }
    const pfxBuffer = fs.readFileSync(p12Path)
    crypto.createSecureContext({
      pfx: pfxBuffer,
      passphrase: password
    })
    return { success: true, message: '证书文件及密码校验通过，可正常用于推送鉴权' }
  } catch (err) {
    return {
      success: false,
      error: `证书校验失败: ${err.message.includes('mac verify failure') ? '证书密码错误，请重新确认导出密码' : err.message}`
    }
  }
}

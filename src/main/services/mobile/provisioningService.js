import { exec, execSync } from 'child_process'
import { readdirSync, existsSync, unlinkSync, statSync, readFileSync } from 'fs'
import { join, basename } from 'path'
import { homedir } from 'os'
import { promisify } from 'util'

const execAsync = promisify(exec)

const PROFILES_DIR = join(homedir(), 'Library', 'MobileDevice', 'Provisioning Profiles')

function decodeXml(str) {
  if (!str) return ''
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
}

/**
 * Pure Node.js Apple Property List (plist) XML parser
 * Handles <dict>, <array>, <string>, <integer>, <real>, <date>, <true/>, <false/>, <data>
 */
function parsePlistXml(xmlStr) {
  if (!xmlStr) return null
  const plistMatch = xmlStr.match(/<plist[^>]*>([\s\S]*?)<\/plist>/)
  if (!plistMatch) return null

  const str = plistMatch[1].trim()
  const tagRegex = /<(\/?)([a-zA-Z0-9]+)(\/?)>/g
  let tag
  const tokenList = []
  let lastIndex = 0

  while ((tag = tagRegex.exec(str)) !== null) {
    const textBetween = str.slice(lastIndex, tag.index).trim()
    if (textBetween) {
      tokenList.push({ type: 'text', val: textBetween })
    }
    tokenList.push({
      type: 'tag',
      name: tag[2],
      isClose: tag[1] === '/',
      isSelfClose: tag[3] === '/'
    })
    lastIndex = tagRegex.lastIndex
  }

  let pos = 0

  function parseValue() {
    if (pos >= tokenList.length) return null
    const tok = tokenList[pos++]

    if (tok.type === 'tag') {
      if (tok.name === 'dict') {
        if (tok.isSelfClose) return {}
        const obj = {}
        while (pos < tokenList.length) {
          const next = tokenList[pos]
          if (next.type === 'tag' && next.name === 'dict' && next.isClose) {
            pos++
            break
          }
          if (next.type === 'tag' && next.name === 'key') {
            pos++ // consume <key>
            const keyNameTok = tokenList[pos++]
            const keyName = decodeXml(keyNameTok?.val || '')
            if (
              tokenList[pos]?.type === 'tag' &&
              tokenList[pos]?.name === 'key' &&
              tokenList[pos]?.isClose
            ) {
              pos++ // consume </key>
            }
            const val = parseValue()
            obj[keyName] = val
          } else {
            pos++
          }
        }
        return obj
      } else if (tok.name === 'array') {
        if (tok.isSelfClose) return []
        const arr = []
        while (pos < tokenList.length) {
          const next = tokenList[pos]
          if (next.type === 'tag' && next.name === 'array' && next.isClose) {
            pos++
            break
          }
          arr.push(parseValue())
        }
        return arr
      } else if (tok.name === 'true') {
        return true
      } else if (tok.name === 'false') {
        return false
      } else if (['string', 'integer', 'real', 'date', 'data'].includes(tok.name)) {
        if (tok.isSelfClose) return tok.name === 'integer' || tok.name === 'real' ? 0 : ''
        let val = ''
        if (tokenList[pos] && tokenList[pos].type === 'text') {
          val = tokenList[pos++].val
        }
        if (
          tokenList[pos] &&
          tokenList[pos].type === 'tag' &&
          tokenList[pos].name === tok.name &&
          tokenList[pos].isClose
        ) {
          pos++
        }
        if (tok.name === 'integer') return parseInt(val, 10) || 0
        if (tok.name === 'real') return parseFloat(val) || 0
        if (tok.name === 'string') return decodeXml(val)
        return val
      }
    }
    return null
  }

  return parseValue()
}

/**
 * Extract raw XML plist from .mobileprovision envelope
 */
function extractPlistXml(filePath) {
  // Strategy 1: Fast direct slice between <?xml and </plist>
  try {
    const raw = readFileSync(filePath, 'binary')
    const start = raw.indexOf('<?xml')
    const end = raw.indexOf('</plist>')
    if (start !== -1 && end !== -1 && end > start) {
      return raw.slice(start, end + 8)
    }
  } catch {}

  // Strategy 2: Fallback to macOS security cms -D
  try {
    const cmd = `/usr/bin/security cms -D -i "${filePath}"`
    return execSync(cmd, {
      maxBuffer: 20 * 1024 * 1024,
      timeout: 5000,
      encoding: 'utf-8'
    })
  } catch (err) {
    console.error(`security cms failed for ${filePath}:`, err.message)
  }

  return null
}

/**
 * Parses a single .mobileprovision file
 */
function parseProfile(filePath) {
  if (!existsSync(filePath)) return null
  try {
    const xml = extractPlistXml(filePath)
    if (!xml) {
      console.warn(`Could not extract XML from profile: ${filePath}`)
      return null
    }

    const data = parsePlistXml(xml)
    if (!data) {
      console.warn(`Could not parse plist XML for: ${filePath}`)
      return null
    }

    const now = new Date()
    const expDate = data.ExpirationDate ? new Date(data.ExpirationDate) : null
    const isExpired = expDate ? expDate < now : false
    const daysRemaining = expDate
      ? Math.ceil((expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      : 0

    // Extract App ID / bundle identifier
    const entitlements = data.Entitlements || {}
    const appId =
      entitlements['application-identifier'] ||
      entitlements['com.apple.application-identifier'] ||
      data.AppIDName ||
      '未知 App ID'

    const teamName = data.TeamName || '未知 Team'
    const teamId = (data.TeamIdentifier && data.TeamIdentifier[0]) || ''
    const devices = Array.isArray(data.ProvisionedDevices) ? data.ProvisionedDevices : []
    const provisionsAllDevices = Boolean(data.ProvisionsAllDevices)

    // Profile type inference
    let profileType = 'development'
    if (provisionsAllDevices) {
      profileType = 'enterprise'
    } else if (data.getTaskAllow === false || entitlements['get-task-allow'] === false) {
      profileType = devices.length > 0 ? 'adhoc' : 'appstore'
    } else {
      profileType = 'development'
    }

    const stat = statSync(filePath)

    return {
      filePath,
      fileName: basename(filePath),
      name: data.Name || basename(filePath, '.mobileprovision'),
      uuid: data.UUID || '',
      appId,
      teamName,
      teamId,
      profileType, // 'development' | 'adhoc' | 'appstore' | 'enterprise'
      creationDate: data.CreationDate || null,
      expirationDate: data.ExpirationDate || null,
      isExpired,
      daysRemaining,
      devicesCount: provisionsAllDevices ? -1 : devices.length,
      provisionsAllDevices,
      devices, // array of UDIDs
      entitlements,
      fileSize: stat.size
    }
  } catch (err) {
    console.error(`Failed to parse profile ${filePath}:`, err.message)
    return null
  }
}

/**
 * Scan all installed provisioning profiles in ~/Library/MobileDevice/Provisioning Profiles/
 */
export async function listInstalledProfiles() {
  if (!existsSync(PROFILES_DIR)) {
    return []
  }

  try {
    const files = readdirSync(PROFILES_DIR).filter((f) => {
      const lower = f.toLowerCase()
      return lower.endsWith('.mobileprovision') || lower.endsWith('.provisionprofile')
    })

    const list = []
    for (const f of files) {
      const fullPath = join(PROFILES_DIR, f)
      const parsed = parseProfile(fullPath)
      if (parsed) {
        list.push(parsed)
      }
    }
    // Sort: soonest expiring first
    list.sort((a, b) => {
      if (!a.expirationDate) return 1
      if (!b.expirationDate) return -1
      return new Date(a.expirationDate) - new Date(b.expirationDate)
    })
    return list
  } catch (err) {
    console.error('Failed to list installed profiles:', err)
    return []
  }
}

/**
 * Parse a custom or drag-and-dropped profile file
 */
export async function parseCustomProfile(filePath) {
  return parseProfile(filePath)
}

/**
 * Delete a profile from the standard profiles directory
 */
export async function deleteProfile(filePath) {
  try {
    if (existsSync(filePath)) {
      unlinkSync(filePath)
      return { success: true }
    }
    return { success: false, error: '文件不存在' }
  } catch (err) {
    return { success: false, error: err.message }
  }
}

/**
 * List all code signing certificates in macOS Keychain using `security find-identity`
 */
export async function listKeychainCertificates() {
  try {
    const { stdout } = await execAsync('/usr/bin/security find-identity -v -p codesigning')
    const lines = stdout.split('\n')
    const certs = []

    for (const line of lines) {
      // Example line: 1) 1234567890ABCDEF... "Apple Development: Name (ID)"
      const match = line.match(/^\s*\d+\)\s+([A-Fa-f0-9]{40})\s+"([^"]+)"/)
      if (match) {
        const sha1 = match[1]
        const fullName = match[2]

        let certType = 'other'
        if (fullName.includes('Apple Development') || fullName.includes('iPhone Developer')) {
          certType = 'development'
        } else if (
          fullName.includes('Apple Distribution') ||
          fullName.includes('iPhone Distribution')
        ) {
          certType = 'distribution'
        }

        certs.push({
          sha1,
          fullName,
          certType,
          status: 'valid'
        })
      }
    }

    return certs
  } catch (err) {
    console.error('Failed to list keychain certificates:', err)
    return []
  }
}

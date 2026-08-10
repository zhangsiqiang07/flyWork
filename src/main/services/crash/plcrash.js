// Crash symbolication — plcrashutil wrapper & Apple .crash parsing.
// Pipeline step 1: convert .plcrash (protobuf binary) to Apple .crash text.
import { app } from 'electron'
import { spawn } from 'child_process'
import { existsSync, statSync, writeFileSync } from 'fs'
import { join } from 'path'

// Resolve the plcrashutil binary.
// - Packaged: process.resourcesPath/plcrashutil (via electron-builder extraResources)
// - Dev: <project>/resources/plcrashutil (electron-vite bundles main into out/main)
// - Fallback: user bin, then bare 'plcrashutil' (PATH, only works with shell)
export function resolvePlcrashutil() {
  const candidates = []
  try {
    if (app.isPackaged) candidates.push(join(process.resourcesPath, 'plcrashutil'))
  } catch {
    /* ignore */
  }
  try {
    candidates.push(join(process.cwd(), 'resources', 'plcrashutil'))
  } catch {
    /* ignore */
  }
  try {
    candidates.push(join(__dirname, '..', '..', 'resources', 'plcrashutil'))
  } catch {
    /* ignore */
  }
  try {
    candidates.push(join(__dirname, '..', '..', '..', 'resources', 'plcrashutil'))
  } catch {
    /* ignore */
  }
  candidates.push('/Users/dimoo/bin/plcrashutil')
  for (const p of candidates) {
    try {
      if (existsSync(p) && statSync(p).mode & 0o111) return p
    } catch {
      /* ignore */
    }
  }
  return 'plcrashutil'
}

export function isPlcrashutilAvailable() {
  const p = resolvePlcrashutil()
  return p !== 'plcrashutil' && existsSync(p)
}

// Convert .plcrash to Apple .crash text via `plcrashutil convert --format=ios`.
// onLog(type, text) receives streaming diagnostics (type: info|stderr).
export function convertPlcrash(reportPath, outCrashPath, onLog = () => {}) {
  return new Promise((resolve) => {
    const bin = resolvePlcrashutil()
    onLog('info', `$ ${bin} convert --format=ios "${reportPath}"`)
    const proc = spawn(bin, ['convert', '--format=ios', reportPath], {
      stdio: ['ignore', 'pipe', 'pipe']
    })
    let stdout = ''
    let stderr = ''
    proc.stdout.on('data', (c) => {
      stdout += c.toString()
    })
    proc.stderr.on('data', (c) => {
      const t = c.toString()
      stderr += t
      onLog('stderr', t)
    })
    proc.on('close', (code) => {
      if (code === 0) {
        try {
          writeFileSync(outCrashPath, stdout, 'utf-8')
          onLog('info', `✓ 转换完成，生成 ${stdout.length} 字节 Apple .crash`)
          resolve({ ok: true, log: stderr, convertedText: stdout })
        } catch (e) {
          resolve({ ok: false, error: e.message, log: stderr })
        }
      } else {
        onLog('stderr', `✗ plcrashutil 退出码 ${code}`)
        resolve({ ok: false, error: stderr || `exit ${code}`, log: stderr })
      }
    })
    proc.on('error', (e) => {
      onLog('stderr', `[进程错误] ${e.message}`)
      resolve({ ok: false, error: e.message, log: stderr })
    })
  })
}

// Parse the `Binary Images:` section of an Apple .crash text.
// Each line: 0xSTART - 0xEND  NAME  ARCH  <UUID>  /path
export function extractBinaryImages(crashText) {
  const lines = crashText.split('\n')
  const startIdx = lines.findIndex((l) => /^Binary Images:/.test(l))
  if (startIdx === -1) return []
  const re = /^(0x[0-9a-fA-F]+)\s+-\s+(0x[0-9a-fA-F]+)\s+(\S+)\s+(\S+)\s+<([0-9A-Fa-f-]+)>\s*(.*)$/
  const images = []
  for (let i = startIdx + 1; i < lines.length; i++) {
    const m = lines[i].match(re)
    if (m) {
      images.push({
        name: m[3],
        arch: m[4],
        uuid: m[5].toLowerCase(),
        start: m[1],
        end: m[2],
        path: m[6].trim()
      })
    }
  }
  return images
}

// Parse the metadata header of an Apple .crash text into CrashReport.meta.
export function extractMeta(crashText) {
  const get = (re) => {
    const m = crashText.match(re)
    return m ? m[1].trim() : ''
  }
  const exceptionType = get(/^Exception Type:\s+(.+)$/m)
  const signal = (exceptionType.match(/\((SIG\w+)\)/) || [])[1] || ''
  const crashedThread = parseInt(get(/^Triggered by Thread:\s+(\d+)/m) || '0', 10)
  const incidentId = get(/^Incident Identifier:\s+(.+)$/m)
  const versionLine = get(/^Version:\s+(.+)$/m)
  let appVersion = ''
  let build = ''
  if (versionLine) {
    const vm = versionLine.match(/^(\S+)\s+\(([^)]+)\)\s*$/)
    if (vm) {
      appVersion = vm[1]
      build = vm[2]
    } else {
      appVersion = versionLine
    }
  }
  const processLine = get(/^Process:\s+(.+)$/m)
  let appName = ''
  if (processLine) {
    const pm = processLine.match(/^(\S+)\s+\[/)
    appName = pm ? pm[1] : processLine
  }
  const osVersion = get(/^OS Version:\s+(.+)$/m)
  const device = get(/^Hardware Model:\s+(.+)$/m)
  const timestamp = get(/^Date\/Time:\s+(.+)$/m)
  return {
    incidentId,
    appName,
    appVersion,
    build,
    device,
    osVersion,
    timestamp,
    exceptionType,
    signal,
    crashedThread
  }
}

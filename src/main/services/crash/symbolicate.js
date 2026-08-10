// Crash symbolication — symbolicatecrash wrapper & symbolicated .crash parsing.
// Pipeline step 3 & 4: run symbolicatecrash, then parse the result into structured threads.
import { spawn, exec } from 'child_process'
import { promisify } from 'util'
import { existsSync } from 'fs'
import { join } from 'path'
import { extractMeta, extractBinaryImages } from './plcrash.js'

const execAsync = promisify(exec)

// Locate symbolicatecrash. Requires full Xcode (not just CLT).
// Async — `xcrun --find` can take seconds on first call; must not block the Electron main process.
export async function findSymbolicatecrash() {
  try {
    const { stdout } = await execAsync('xcrun --find symbolicatecrash 2>/dev/null', {
      encoding: 'utf-8'
    })
    const p = stdout.trim()
    if (p && existsSync(p)) return p
  } catch {
    /* ignore */
  }
  // Fallback: DVTFoundation.framework bundled with Xcode
  try {
    let devDir = process.env.DEVELOPER_DIR
    if (!devDir) {
      const { stdout } = await execAsync('xcode-select -p', { encoding: 'utf-8' })
      devDir = stdout.trim()
    }
    const cand = join(
      devDir,
      '..',
      'SharedFrameworks',
      'DVTFoundation.framework',
      'Versions',
      'A',
      'Resources',
      'symbolicatecrash'
    )
    if (existsSync(cand)) return cand
  } catch {
    /* ignore */
  }
  return null
}

export async function isSymbolicatecrashAvailable() {
  return !!(await findSymbolicatecrash())
}

// Run `symbolicatecrash <converted.crash> <dSYM/xcarchive>`.
// stdout is the symbolicated result (captured, NOT streamed to log — it is not progress).
// stderr is diagnostics (streamed). DEVELOPER_DIR is exported per reference script.
// Returns { ok, text, log }
export async function symbolicate(convertedCrashPath, symbolPath, onLog = () => {}) {
  const sym = await findSymbolicatecrash()
  if (!sym) {
    onLog('stderr', '✗ 未找到 symbolicatecrash，请安装完整 Xcode（仅 CLT 不可用）')
    return { ok: false, error: 'symbolicatecrash not found' }
  }
  let devDir = process.env.DEVELOPER_DIR
  if (!devDir) {
    try {
      const { stdout } = await execAsync('xcode-select -p', { encoding: 'utf-8' })
      devDir = stdout.trim()
    } catch {
      devDir = ''
    }
  }
  onLog('info', `$ symbolicatecrash "${convertedCrashPath}" "${symbolPath}"`)
  return new Promise((resolve) => {
    const proc = spawn(sym, [convertedCrashPath, symbolPath], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, DEVELOPER_DIR: devDir }
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
        onLog('info', `✓ 符号化完成（${stdout.length} 字节）`)
        resolve({ ok: true, text: stdout, log: stderr })
      } else {
        onLog('stderr', `✗ symbolicatecrash 退出码 ${code}`)
        resolve({ ok: false, error: stderr || `exit ${code}`, text: stdout, log: stderr })
      }
    })
    proc.on('error', (e) => {
      onLog('stderr', `[进程错误] ${e.message}`)
      resolve({ ok: false, error: e.message })
    })
  })
}

// Parse a symbolicated .crash text into structured threads.
// Frame formats handled:
//   0  App  0xADDR  -[VC viewDidLoad] + 123 (VC.swift:42)
//   0  App  0xADDR  0x10a3b4000 + 30485                    (unsymbolicated)
//   0  App  0xADDR  0x10a3b4000 + 30485 (VC.swift:42)      (partial)
export function parseThreads(text) {
  const threads = []
  const lines = text.split('\n')
  let current = null
  let inBinaryImages = false
  const headerRe = /^Thread\s+(\d+)(\s+Crashed)?:\s*$/
  const frameRe = /^(\d+)\s+(\S+)\s+(0x[0-9a-fA-F]+)\s+(.*)$/
  for (const line of lines) {
    if (/^Binary Images:/.test(line)) {
      inBinaryImages = true
      continue
    }
    if (inBinaryImages) continue
    const hm = line.match(headerRe)
    if (hm) {
      current = { index: parseInt(hm[1], 10), crashed: !!hm[2], frames: [] }
      threads.push(current)
      continue
    }
    if (!current) continue
    const fm = line.match(frameRe)
    if (!fm) continue
    const rest = fm[4].trim()
    const frame = {
      index: parseInt(fm[1], 10),
      image: fm[2],
      pc: fm[3],
      symbol: null,
      file: null,
      line: null
    }
    // Extract trailing (file:line) if present
    const fileLineM = rest.match(/\(([^():]+):(\d+)\)\s*$/)
    let woFile = rest
    if (fileLineM) {
      frame.file = fileLineM[1]
      frame.line = parseInt(fileLineM[2], 10)
      woFile = rest.slice(0, fileLineM.index).trim()
    }
    // Extract symbol from "symbol + offset" (only if not a raw address frame)
    if (!woFile.startsWith('0x')) {
      const plusIdx = woFile.lastIndexOf(' + ')
      if (plusIdx > 0) {
        frame.symbol = woFile.slice(0, plusIdx).trim()
      } else {
        frame.symbol = woFile || null
      }
    }
    current.frames.push(frame)
  }
  return threads
}

// Full parse of a symbolicated .crash into { meta, images, threads }.
export function parseSymbolicatedCrash(text) {
  return {
    meta: extractMeta(text),
    images: extractBinaryImages(text),
    threads: parseThreads(text)
  }
}

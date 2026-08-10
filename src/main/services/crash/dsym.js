// Crash symbolication — dSYM / xcarchive resolution & UUID matching.
// Pipeline step 2: resolve symbol source, read dSYM UUIDs, match against crash Binary Images.
import { spawn, execFile } from 'child_process'
import { promisify } from 'util'
import { existsSync, mkdtempSync, readdirSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

const execFileAsync = promisify(execFile)

// Resolve a symbol source path into a concrete .dSYM directory.
// Accepts: .xcarchive / .app.dSYM / .app.dSYM.zip
// Returns { dsymPath, tmpDir?, error? }
export async function resolveArchive(archivePath, onLog = () => {}) {
  if (!archivePath || !existsSync(archivePath)) {
    return { dsymPath: null, error: '符号文件路径不存在' }
  }

  if (archivePath.toLowerCase().endsWith('.zip')) {
    const tmp = mkdtempSync(join(tmpdir(), 'flywork-dsym-'))
    onLog('info', `解压 ${archivePath} → ${tmp}`)
    try {
      await execFileAsync('unzip', ['-q', '-o', archivePath, '-d', tmp])
      const found = findDsym(tmp)
      if (!found) {
        onLog('stderr', '✗ zip 内未找到 .dSYM 目录')
        return { dsymPath: null, tmpDir: tmp, error: 'zip 内未找到 .dSYM' }
      }
      return { dsymPath: found, tmpDir: tmp }
    } catch (e) {
      return { dsymPath: null, tmpDir: tmp, error: `解压失败: ${e.message}` }
    }
  }

  if (archivePath.endsWith('.xcarchive')) {
    const dSYMsDir = join(archivePath, 'dSYMs')
    if (!existsSync(dSYMsDir)) {
      return { dsymPath: null, error: 'xcarchive 内无 dSYMs 目录' }
    }
    const found = findDsym(dSYMsDir)
    return found ? { dsymPath: found } : { dsymPath: null, error: 'xcarchive/dSYMs 内无 .dSYM' }
  }

  if (archivePath.endsWith('.dSYM')) {
    return { dsymPath: archivePath }
  }

  return { dsymPath: null, error: '不支持的符号文件类型（需 .xcarchive / .dSYM / .dSYM.zip）' }
}

// Recursively find the first .dSYM bundle under a directory.
function findDsym(dir) {
  try {
    const entries = readdirSync(dir, { withFileTypes: true })
    for (const e of entries) {
      if (e.isDirectory() && e.name.endsWith('.dSYM')) return join(dir, e.name)
    }
    for (const e of entries) {
      if (e.isDirectory()) {
        const r = findDsym(join(dir, e.name))
        if (r) return r
      }
    }
  } catch {
    /* ignore */
  }
  return null
}

// Read UUIDs from a .dSYM via `dwarfdump --uuid`.
// Output format: "UUID: 16A1B2C3-... (arm64) App.app.dSYM/Contents/Resources/DWARF/App"
// Returns { ok, uuids: [{ uuid, arch, name }], log }
export function dsymUuids(dsymPath, onLog = () => {}) {
  return new Promise((resolve) => {
    const proc = spawn('dwarfdump', ['--uuid', dsymPath], {
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
      const uuids = []
      const re = /UUID:\s+([0-9A-Fa-f-]+)\s+\((\S+)\)\s+(.*)/
      for (const line of stdout.split('\n')) {
        const m = line.match(re)
        if (m) {
          const name = (m[3] || '').split('/').pop() || ''
          uuids.push({ uuid: m[1].toLowerCase(), arch: m[2], name })
        }
      }
      onLog('info', `dSYM UUID: ${uuids.map((u) => u.uuid).join(', ') || '(无)'}`)
      resolve({ ok: code === 0, uuids, log: stderr })
    })
    proc.on('error', (e) => {
      onLog('stderr', `[进程错误] ${e.message}`)
      resolve({ ok: false, uuids: [], error: e.message })
    })
  })
}

// Match crash Binary Images against dSYM UUIDs.
// Returns images annotated with { dsymUuid, matched: 'hit'|'missing' }.
export function matchUuids(images, dsymUuidList) {
  const dsymSet = new Set((dsymUuidList || []).map((u) => u.uuid.toLowerCase()))
  return images.map((img) => {
    const u = (img.uuid || '').toLowerCase()
    return {
      ...img,
      dsymUuid: u,
      matched: u && dsymSet.has(u) ? 'hit' : 'missing'
    }
  })
}

// Clean up a temporary extraction directory (best-effort).
export function cleanupTmpDir(tmpDir) {
  if (!tmpDir) return
  try {
    rmSync(tmpDir, { recursive: true, force: true })
  } catch {
    /* ignore */
  }
}

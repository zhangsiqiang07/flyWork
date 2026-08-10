// Crash symbolication — report assembly & independent persistence.
// Per v1.1 decision: crash reports persist to ~/.flywork/crash-reports.json,
// fully decoupled from the renderer-driven data.json (which is overwritten on every save).
import { join } from 'path'
import { homedir } from 'os'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'

const REPORTS_PATH = join(homedir(), '.flywork', 'crash-reports.json')

function ensureDataDir() {
  const dir = join(homedir(), '.flywork')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
}

export function listReports() {
  ensureDataDir()
  try {
    if (!existsSync(REPORTS_PATH)) return []
    const all = JSON.parse(readFileSync(REPORTS_PATH, 'utf-8'))
    return Array.isArray(all) ? all : []
  } catch {
    return []
  }
}

export function getReport(id) {
  return listReports().find((r) => r.id === id) || null
}

export function saveReport(report) {
  ensureDataDir()
  const all = listReports()
  const idx = all.findIndex((r) => r.id === report.id)
  if (idx >= 0) all[idx] = report
  else all.unshift(report)
  writeFileSync(REPORTS_PATH, JSON.stringify(all, null, 2), 'utf-8')
  return report
}

export function deleteReport(id) {
  ensureDataDir()
  const all = listReports().filter((r) => r.id !== id)
  writeFileSync(REPORTS_PATH, JSON.stringify(all, null, 2), 'utf-8')
  return { success: true }
}

// Assemble a canonical CrashReport object.
export function buildReport({ meta, images, threads, rawSymbolicated, reportId }) {
  return {
    id: reportId || `crash-${Date.now()}`,
    createdAt: new Date().toISOString(),
    meta,
    images,
    threads,
    rawSymbolicated: rawSymbolicated || ''
  }
}

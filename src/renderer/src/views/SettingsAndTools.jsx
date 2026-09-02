/* eslint-disable react/prop-types */
import { useState, useEffect, useCallback, useMemo } from 'react'
import YunxiaoSettings from '../components/YunxiaoSettings'
import JenkinsSettings from '../components/JenkinsSettings'
import NetworkHelper from '../components/NetworkHelper'

// Category configuration for audit log categorization
const AUDIT_CATEGORIES = {
  all: { label: '全部', color: 'var(--text-secondary)', bg: 'var(--bg-hover)' },
  action: { label: '命令与执行', color: 'var(--accent-teal)', bg: 'var(--accent-teal-dim)' },
  yunxiao: { label: '云效服务', color: 'var(--accent-blue)', bg: 'var(--accent-blue-dim)' },
  jenkins: { label: 'Jenkins CI', color: 'var(--accent-purple)', bg: 'var(--accent-purple-dim)' },
  crash: { label: '崩溃分析', color: 'var(--accent-red)', bg: 'var(--accent-red-dim)' },
  weekly_ai: { label: '周报与 AI', color: 'var(--accent-amber)', bg: 'var(--accent-amber-dim)' }
}

const DOCTOR_CATEGORIES = {
  all: '全部检测',
  xcode: '🍎 iOS / Xcode',
  runtime: '⚙️ 基础编译环境',
  ai: '🤖 AI 智能体 CLI',
  network: '🌐 平台网络连通性'
}

function parseAuditLog(rawLog, index) {
  const type = String(rawLog.type || 'UNKNOWN').toUpperCase()
  const timestamp = rawLog.timestamp || new Date().toISOString()
  const id = `audit-${timestamp}-${index}`

  let category = 'action'
  let title = '系统操作'
  let detail = ''
  let statusBadge = { label: '记录', color: 'var(--text-secondary)', bg: 'var(--bg-hover)' }
  let icon = '📋'

  if (type.startsWith('YUNXIAO')) {
    category = 'yunxiao'
    icon = '☁️'
    const action = rawLog.action || type
    if (action === 'TOKEN_VALIDATED') {
      title = '云效: 个人访问令牌验证通过'
      detail = '用户 Token 校验成功并完成授权'
      statusBadge = { label: '授权有效', color: 'var(--accent-green)', bg: 'var(--accent-green-dim)' }
    } else if (action === 'TOKEN_DELETED') {
      title = '云效: 用户退出登录'
      detail = '已清除本地保存的个人访问令牌'
      statusBadge = { label: '已退出', color: 'var(--accent-amber)', bg: 'var(--accent-amber-dim)' }
    } else if (action === 'SET_ORGANIZATION') {
      title = `云效: 切换企业组织 [${rawLog.organizationId || ''}]`
      detail = '已更新当前活跃的云效企业组织'
      statusBadge = { label: '已切换', color: 'var(--accent-blue)', bg: 'var(--accent-blue-dim)' }
    } else if (action === 'CREATE') {
      title = `云效: 创建项目 [${rawLog.projectId || ''}]`
      detail = '成功创建并登记云效项目'
      statusBadge = { label: '创建成功', color: 'var(--accent-green)', bg: 'var(--accent-green-dim)' }
    } else if (action === 'UPDATE_FIELD') {
      title = `云效: 更新工作项 [${rawLog.workitemId || ''}]`
      detail = `变更工作项字段内容`
      statusBadge = { label: '已更新', color: 'var(--accent-blue)', bg: 'var(--accent-blue-dim)' }
    } else if (action === 'ADD_COMMENT') {
      title = `云效: 添加工作项评论 [${rawLog.workitemId || ''}]`
      detail = '成功发表工作项讨论评论'
      statusBadge = { label: '已评论', color: 'var(--accent-purple)', bg: 'var(--accent-purple-dim)' }
    } else if (action === 'UPDATE') {
      title = `云效: 迭代更新 [${rawLog.sprintId || ''}]`
      detail = '更新敏捷迭代状态'
      statusBadge = { label: '已更新', color: 'var(--accent-blue)', bg: 'var(--accent-blue-dim)' }
    } else {
      title = `云效操作: ${action}`
      detail = JSON.stringify(rawLog)
    }
  } else if (type.startsWith('JENKINS')) {
    category = 'jenkins'
    icon = '🏗️'
    const action = rawLog.action || type
    if (action === 'CONFIG_VALIDATED') {
      title = `Jenkins: 实例连接成功`
      detail = `已验证服务地址: ${rawLog.baseUrl || ''}`
      statusBadge = { label: '连接正常', color: 'var(--accent-green)', bg: 'var(--accent-green-dim)' }
    } else if (action === 'BUILD_JOB') {
      title = `Jenkins: 触发流水线构建 [${rawLog.jobPath || ''}]`
      detail = `构建编号: #${rawLog.buildNumber || '队列中'} | 成功入队`
      statusBadge = { label: '构建触发', color: 'var(--accent-blue)', bg: 'var(--accent-blue-dim)' }
    } else if (action === 'CANCEL_QUEUE') {
      title = `Jenkins: 取消排队任务 [Queue #${rawLog.queueId || ''}]`
      detail = '已主动从构建队列中取消该任务'
      statusBadge = { label: '已取消', color: 'var(--accent-amber)', bg: 'var(--accent-amber-dim)' }
    } else if (action === 'STOP_BUILD') {
      title = `Jenkins: 终止构建 [${rawLog.jobPath || ''} #${rawLog.buildNumber || ''}]`
      detail = '已主动终止正在运行的构建'
      statusBadge = { label: '已中止', color: 'var(--accent-red)', bg: 'var(--accent-red-dim)' }
    } else if (action === 'LOGOUT') {
      title = 'Jenkins: 注销服务连接'
      detail = '已清除本地保存的连接配置'
      statusBadge = { label: '已注销', color: 'var(--text-secondary)', bg: 'var(--bg-hover)' }
    } else {
      title = `Jenkins 任务: ${action}`
      detail = JSON.stringify(rawLog)
    }
  } else if (type.startsWith('CRASH')) {
    category = 'crash'
    icon = '💥'
    if (type === 'CRASH_SYMBOLICATE') {
      title = '崩溃分析: 启动符号化解析'
      detail = `日志: ${rawLog.plcrashPath?.split('/').pop() || '未知'} | dSYM 归档: ${rawLog.archivePath?.split('/').pop() || '未知'}`
      statusBadge = { label: '解析中', color: 'var(--accent-blue)', bg: 'var(--accent-blue-dim)' }
    } else if (type === 'CRASH_RESULT') {
      if (rawLog.success) {
        title = `崩溃分析: 符号化完成 [${rawLog.reportId || ''}]`
        detail = '已成功生成符号化报告并解析堆栈'
        statusBadge = { label: '解析成功', color: 'var(--accent-green)', bg: 'var(--accent-green-dim)' }
      } else {
        title = `崩溃分析: 符号化失败 [${rawLog.reportId || ''}]`
        detail = `失败原因: ${rawLog.error || '未知错误'}`
        statusBadge = { label: '解析失败', color: 'var(--accent-red)', bg: 'var(--accent-red-dim)' }
      }
    } else if (type === 'CRASH_DELETE') {
      title = `崩溃分析: 删除报告 [${rawLog.reportId || ''}]`
      detail = '已清理本地存储的崩溃历史报告'
      statusBadge = { label: '已删除', color: 'var(--text-secondary)', bg: 'var(--bg-hover)' }
    } else {
      title = `崩溃分析事件: ${type}`
      detail = JSON.stringify(rawLog)
    }
  } else if (type.startsWith('WEEKLY_REPORT') || type === 'AI') {
    category = 'weekly_ai'
    icon = '📝'
    if (type === 'WEEKLY_REPORT_CANCEL') {
      title = '周报助手: 取消生成任务'
      detail = `任务 ID: ${rawLog.taskId || '未知'}`
      statusBadge = { label: '已取消', color: 'var(--accent-amber)', bg: 'var(--accent-amber-dim)' }
    } else if (type === 'WEEKLY_REPORT_GENERATE') {
      title = '周报助手: 发起周报 AI 生成'
      detail = `关联仓库数: ${rawLog.reposCount || 0}`
      statusBadge = { label: '生成中', color: 'var(--accent-blue)', bg: 'var(--accent-blue-dim)' }
    } else {
      title = `周报与 AI: ${type}`
      detail = JSON.stringify(rawLog)
    }
  } else {
    // Actions / Execution
    category = 'action'
    if (type === 'BLOCKED') {
      icon = '🛡️'
      title = `安全拦截: 未在动作白名单`
      detail = `动作 ID: ${rawLog.actionId || '未知'} | 拦截原因: ${rawLog.reason || '不在安全允许列表中'}`
      statusBadge = { label: '已拦截', color: 'var(--accent-red)', bg: 'var(--accent-red-dim)' }
    } else if (type === 'EXECUTE') {
      icon = '⚡'
      title = `动作执行: ${rawLog.name || rawLog.actionId || '本地脚本'}`
      detail = `工作目录: ${rawLog.workdir || '.'}`
      statusBadge = { label: '开始执行', color: 'var(--accent-blue)', bg: 'var(--accent-blue-dim)' }
    } else if (type === 'DRY_RUN') {
      icon = '🧪'
      title = `试运行预演: ${rawLog.name || rawLog.actionId || '本地脚本'}`
      detail = `工作目录: ${rawLog.workdir || '.'} | 仅验证命令不产生实际写入`
      statusBadge = { label: 'Dry Run', color: 'var(--accent-amber)', bg: 'var(--accent-amber-dim)' }
    } else if (type === 'RESULT') {
      const isSuccess = rawLog.success ?? (rawLog.exitCode === 0)
      icon = isSuccess ? '✅' : '❌'
      title = `执行结束: ${rawLog.actionId || '任务'} (退出码: ${rawLog.exitCode ?? 0})`
      detail = isSuccess ? '命令成功完成执行' : `命令异常退出 (Exit Code: ${rawLog.exitCode})`
      statusBadge = isSuccess
        ? { label: '执行成功', color: 'var(--accent-green)', bg: 'var(--accent-green-dim)' }
        : { label: '执行失败', color: 'var(--accent-red)', bg: 'var(--accent-red-dim)' }
    } else {
      title = `系统操作: ${rawLog.name || rawLog.type}`
      detail = rawLog.detail || JSON.stringify(rawLog)
      statusBadge = { label: type, color: 'var(--text-secondary)', bg: 'var(--bg-hover)' }
    }
  }

  return {
    id,
    type,
    category,
    title,
    detail,
    timestamp,
    statusBadge,
    icon,
    raw: rawLog
  }
}

function formatTime(iso) {
  try {
    const d = new Date(iso)
    if (isNaN(d.getTime())) return iso
    return d.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  } catch {
    return iso
  }
}

export default function SettingsAndTools({
  initialTab = 'audit-log',
  onYunxiaoConfigChange,
  onJenkinsConfigChange
}) {
  // Normalize initial tab
  const resolveTab = (tab) => {
    if (tab === 'yunxiao' || tab === 'jenkins') return 'services'
    if (tab === 'doctor' || tab === 'environment') return 'doctor'
    if (tab === 'about') return 'about'
    return 'audit-log'
  }

  const [activeTab, setActiveTab] = useState(resolveTab(initialTab))
  const [prevInitialTab, setPrevInitialTab] = useState(initialTab)
  const [serviceTab, setServiceTab] = useState(initialTab === 'jenkins' ? 'jenkins' : 'yunxiao')

  // Audit log states
  const [logs, setLogs] = useState([])
  const [loadingLogs, setLoadingLogs] = useState(false)
  const [logPath, setLogPath] = useState('~/.flywork/audit.log')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [expandedLogId, setExpandedLogId] = useState(null)
  const [toastMsg, setToastMsg] = useState('')

  // Environment Doctor states
  const [doctorResults, setDoctorResults] = useState([])
  const [doctorLoading, setDoctorLoading] = useState(false)
  const [doctorCategory, setDoctorCategory] = useState('all')
  const [copiedCmd, setCopiedCmd] = useState(null)

  if (initialTab !== prevInitialTab) {
    setPrevInitialTab(initialTab)
    setActiveTab(resolveTab(initialTab))
    if (initialTab === 'jenkins') setServiceTab('jenkins')
    if (initialTab === 'yunxiao') setServiceTab('yunxiao')
  }

  const showToast = useCallback((msg) => {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(''), 2500)
  }, [])

  // 1. Audit logs loader
  const loadAuditLogs = useCallback(async () => {
    setLoadingLogs(true)
    try {
      if (window.flywork?.getAuditLogPath) {
        const p = await window.flywork.getAuditLogPath()
        if (p) setLogPath(p)
      }
      if (window.flywork?.getAuditLog) {
        const rawList = await window.flywork.getAuditLog()
        if (Array.isArray(rawList)) {
          const parsed = rawList.map((item, idx) => parseAuditLog(item, idx))
          setLogs(parsed)
        }
      }
    } catch (err) {
      console.error('Failed to load audit logs:', err)
      showToast('加载审计日志失败')
    } finally {
      setLoadingLogs(false)
    }
  }, [showToast])

  // 2. Doctor diagnostics loader
  const runDoctor = useCallback(async () => {
    setDoctorLoading(true)
    try {
      if (window.flywork?.runEnvironmentDoctor) {
        const results = await window.flywork.runEnvironmentDoctor()
        if (Array.isArray(results)) {
          setDoctorResults(results)
        }
      }
    } catch (err) {
      console.error('Environment doctor run failed:', err)
      showToast('运行环境诊断失败')
    } finally {
      setDoctorLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    if (activeTab === 'audit-log') {
      let isMounted = true
      setLoadingLogs(true)
      const fetchLogs = async () => {
        try {
          if (window.flywork?.getAuditLogPath) {
            const p = await window.flywork.getAuditLogPath()
            if (p && isMounted) setLogPath(p)
          }
          if (window.flywork?.getAuditLog) {
            const rawList = await window.flywork.getAuditLog()
            if (Array.isArray(rawList) && isMounted) {
              const parsed = rawList.map((item, idx) => parseAuditLog(item, idx))
              setLogs(parsed)
            }
          }
        } catch (err) {
          console.error('Failed to load audit logs:', err)
        } finally {
          if (isMounted) setLoadingLogs(false)
        }
      }
      fetchLogs()
      return () => {
        isMounted = false
      }
    } else if (activeTab === 'doctor') {
      if (doctorResults.length === 0) {
        runDoctor()
      }
    }
  }, [activeTab, runDoctor, doctorResults.length])

  const handleOpenLogFile = async () => {
    try {
      if (window.flywork?.openAuditLog) {
        const res = await window.flywork.openAuditLog()
        if (res && !res.success) {
          showToast(`打开失败: ${res.error || '文件不存在'}`)
        }
      } else if (window.flywork?.openPath) {
        await window.flywork.openPath(logPath)
      }
    } catch (err) {
      showToast(`打开失败: ${err.message}`)
    }
  }

  const handleClearLog = async () => {
    if (!window.confirm('确定要清空本地所有审计日志记录吗？该操作不可撤销。')) return
    try {
      if (window.flywork?.clearAuditLog) {
        const res = await window.flywork.clearAuditLog()
        if (res?.success) {
          setLogs([])
          showToast('审计日志已清空')
        } else {
          showToast(`清空失败: ${res?.error || '未知原因'}`)
        }
      }
    } catch (err) {
      showToast(`清空失败: ${err.message}`)
    }
  }

  const handleCopyCmd = (cmd) => {
    if (!cmd) return
    navigator.clipboard.writeText(cmd)
    setCopiedCmd(cmd)
    setTimeout(() => setCopiedCmd(null), 2000)
    showToast('命令已复制到剪贴板')
  }

  // Filter logs by category and search query
  const filteredLogs = useMemo(() => {
    const q = searchQuery.toLowerCase().trim()
    return logs.filter((log) => {
      if (selectedCategory !== 'all' && log.category !== selectedCategory) {
        return false
      }
      if (!q) return true
      return (
        log.title.toLowerCase().includes(q) ||
        log.detail.toLowerCase().includes(q) ||
        log.type.toLowerCase().includes(q) ||
        JSON.stringify(log.raw).toLowerCase().includes(q)
      )
    })
  }, [logs, selectedCategory, searchQuery])

  const categoryCounts = useMemo(() => {
    const counts = { all: logs.length }
    logs.forEach((log) => {
      counts[log.category] = (counts[log.category] || 0) + 1
    })
    return counts
  }, [logs])

  // Doctor metrics summary
  const doctorSummary = useMemo(() => {
    let ok = 0
    let warning = 0
    let error = 0
    doctorResults.forEach((item) => {
      if (item.status === 'ok') ok++
      else if (item.status === 'warning') warning++
      else if (item.status === 'error') error++
    })
    return { ok, warning, error, total: doctorResults.length }
  }, [doctorResults])

  const filteredDoctorResults = useMemo(() => {
    if (doctorCategory === 'all') return doctorResults
    return doctorResults.filter((i) => i.category === doctorCategory)
  }, [doctorResults, doctorCategory])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Toast notice */}
      {toastMsg && (
        <div
          style={{
            position: 'absolute',
            top: 20,
            right: 24,
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            padding: '8px 16px',
            borderRadius: 'var(--radius-md)',
            boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
            zIndex: 1000,
            fontSize: 12,
            color: 'var(--text-primary)',
            animation: 'fadeIn 150ms ease'
          }}
        >
          {toastMsg}
        </div>
      )}

      {/* Page Header */}
      <div className="page-header" style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div>
            <div className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>⚙️</span>
              <span>设置与工具</span>
            </div>
            <div className="page-subtitle">开发者操作审计、本地环境医生体检、企业平台集成与系统配置</div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div style={{ display: 'flex', gap: 6 }}>
          {[
            { id: 'audit-log', label: '审计日志', icon: '📋' },
            { id: 'doctor', label: '环境医生', icon: '🩺' },
            { id: 'network', label: '网络与端口', icon: '🌐' },
            { id: 'services', label: '服务集成', icon: '🔌' },
            { id: 'about', label: '系统与关于', icon: 'ℹ️' }
          ].map((tab) => {
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                className={`btn btn-sm ${isActive ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setActiveTab(tab.id)}
                style={{ fontSize: 12, gap: 6 }}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Content Area */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {/* ==================================================== */}
        {/* 1. 审计日志 Tab */}
        {/* ==================================================== */}
        {activeTab === 'audit-log' && (
          <div style={{ padding: '16px 24px', display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Toolbar */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 12,
                marginBottom: 16
              }}
            >
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flex: 1, minWidth: 260 }}>
                <div className="quick-input" style={{ padding: '5px 10px', flex: 1, maxWidth: 360 }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2">
                    <circle cx="11" cy="11" r="8" />
                    <path d="m21 21-4.35-4.35" />
                  </svg>
                  <input
                    placeholder="按操作、状态、关键词检索审计事件..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{ fontSize: 12 }}
                  />
                  {searchQuery && (
                    <button
                      className="btn btn-ghost btn-icon btn-sm"
                      onClick={() => setSearchQuery('')}
                      style={{ padding: 2, height: 'auto' }}
                    >
                      ✕
                    </button>
                  )}
                </div>

                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {Object.entries(AUDIT_CATEGORIES).map(([key, conf]) => {
                    const count = categoryCounts[key] || 0
                    if (key !== 'all' && count === 0) return null
                    const isSelected = selectedCategory === key
                    return (
                      <button
                        key={key}
                        className={`btn btn-sm ${isSelected ? 'btn-secondary' : 'btn-ghost'}`}
                        onClick={() => setSelectedCategory(key)}
                        style={{
                          fontSize: 11,
                          borderColor: isSelected ? 'var(--accent-blue)' : 'transparent'
                        }}
                      >
                        {conf.label} ({count})
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={loadAuditLogs}
                  disabled={loadingLogs}
                  title="重新加载最新日志"
                  style={{ gap: 4, fontSize: 12 }}
                >
                  <span style={{ display: 'inline-block', animation: loadingLogs ? 'spin 1s linear infinite' : 'none' }}>
                    🔄
                  </span>
                  <span>{loadingLogs ? '刷新中' : '刷新'}</span>
                </button>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={handleOpenLogFile}
                  title={`在外部打开: ${logPath}`}
                  style={{ gap: 4, fontSize: 12 }}
                >
                  <span>📂</span>
                  <span>打开日志文件</span>
                </button>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={handleClearLog}
                  title="清空当前日志文件内容"
                  style={{ gap: 4, fontSize: 12, color: 'var(--accent-red)' }}
                >
                  <span>🗑️</span>
                  <span>清空</span>
                </button>
              </div>
            </div>

            {/* Path info hint */}
            <div
              style={{
                fontSize: 11,
                color: 'var(--text-muted)',
                marginBottom: 12,
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              <span>日志持久化存储路径:</span>
              <code
                style={{
                  background: 'var(--bg-elevated)',
                  padding: '2px 6px',
                  borderRadius: 4,
                  color: 'var(--text-secondary)'
                }}
              >
                {logPath}
              </code>
              <span style={{ marginLeft: 'auto' }}>共 {filteredLogs.length} 条有效记录</span>
            </div>

            {/* Timeline / List */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {filteredLogs.length === 0 ? (
                <div className="empty-state" style={{ marginTop: 60 }}>
                  <div style={{ fontSize: 36 }}>📋</div>
                  <div className="empty-state-title">暂无匹配的审计记录</div>
                  <div className="empty-state-desc">
                    {searchQuery ? '未找到符合检索条件的审计日志，可尝试调整过滤词' : '本地暂无操作产生，执行动作、云效同步或构建后将自动写入'}
                  </div>
                </div>
              ) : (
                <div className="timeline">
                  {filteredLogs.map((item, idx) => {
                    const isExpanded = expandedLogId === item.id
                    return (
                      <div
                        key={item.id}
                        className="timeline-item"
                        style={{
                          animation: `fadeIn 120ms ease ${Math.min(idx * 15, 300)}ms both`,
                          paddingBottom: 16
                        }}
                      >
                        <div
                          className="timeline-icon"
                          style={{
                            background: item.statusBadge.bg,
                            border: `1px solid ${item.statusBadge.color}44`
                          }}
                        >
                          <span style={{ fontSize: 12 }}>{item.icon}</span>
                        </div>

                        <div className="timeline-content" style={{ flex: 1 }}>
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'flex-start',
                              justifyContent: 'space-between',
                              gap: 12
                            }}
                          >
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                                  {item.title}
                                </span>
                                <span
                                  className="badge"
                                  style={{
                                    background: item.statusBadge.bg,
                                    color: item.statusBadge.color,
                                    fontSize: 10,
                                    flexShrink: 0
                                  }}
                                >
                                  {item.statusBadge.label}
                                </span>
                                <span
                                  className="badge badge-gray"
                                  style={{ fontSize: 10, flexShrink: 0 }}
                                >
                                  {item.type}
                                </span>
                              </div>

                              <div
                                style={{
                                  fontSize: 12,
                                  color: 'var(--text-secondary)',
                                  lineHeight: 1.5,
                                  wordBreak: 'break-word'
                                }}
                              >
                                {item.detail}
                              </div>
                            </div>

                            <div
                              style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'flex-end',
                                gap: 6,
                                flexShrink: 0
                              }}
                            >
                              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                {formatTime(item.timestamp)}
                              </span>
                              <button
                                className="btn btn-ghost btn-sm"
                                onClick={() => setExpandedLogId(isExpanded ? null : item.id)}
                                style={{ fontSize: 10, padding: '2px 6px', height: 'auto' }}
                              >
                                {isExpanded ? '收起详情 ▴' : '原始数据 ▾'}
                              </button>
                            </div>
                          </div>

                          {/* Raw JSON detail card */}
                          {isExpanded && (
                            <div
                              style={{
                                marginTop: 10,
                                background: 'var(--bg-elevated)',
                                border: '1px solid var(--border)',
                                borderRadius: 'var(--radius-md)',
                                padding: '10px 12px',
                                fontSize: 11,
                                fontFamily: 'var(--font-mono, monospace)',
                                color: 'var(--text-secondary)',
                                overflowX: 'auto',
                                animation: 'fadeIn 150ms ease'
                              }}
                            >
                              <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                                {JSON.stringify(item.raw, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ==================================================== */}
        {/* 2. 环境医生 (Environment Doctor) Tab [新增 P0] */}
        {/* ==================================================== */}
        {activeTab === 'doctor' && (
          <div style={{ padding: '20px 24px', maxWidth: 960 }}>
            {/* Header / Health Overview Card */}
            <div
              className="card"
              style={{
                padding: '16px 20px',
                marginBottom: 20,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 16
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 10,
                    background:
                      doctorSummary.error > 0
                        ? 'var(--accent-red-dim)'
                        : doctorSummary.warning > 0
                          ? 'var(--accent-amber-dim)'
                          : 'var(--accent-green-dim)',
                    color:
                      doctorSummary.error > 0
                        ? 'var(--accent-red)'
                        : doctorSummary.warning > 0
                          ? 'var(--accent-amber)'
                          : 'var(--accent-green)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 22
                  }}
                >
                  {doctorLoading ? '🔄' : doctorSummary.error > 0 ? '❌' : doctorSummary.warning > 0 ? '⚠️' : '✅'}
                </div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>
                    {doctorLoading
                      ? '正在体检本地研发环境...'
                      : doctorSummary.error > 0
                        ? '环境存在阻碍性缺失项'
                        : doctorSummary.warning > 0
                          ? '环境基本可用，有可优化项'
                          : '研发环境健康完善，全组件就绪'}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', gap: 12 }}>
                    <span>已检测 {doctorSummary.total} 个关键组件</span>
                    <span style={{ color: 'var(--accent-green)' }}>● {doctorSummary.ok} 项就绪</span>
                    {doctorSummary.warning > 0 && <span style={{ color: 'var(--accent-amber)' }}>● {doctorSummary.warning} 项建议优化</span>}
                    {doctorSummary.error > 0 && <span style={{ color: 'var(--accent-red)' }}>● {doctorSummary.error} 项异常/缺失</span>}
                  </div>
                </div>
              </div>

              <button
                className="btn btn-primary btn-sm"
                onClick={runDoctor}
                disabled={doctorLoading}
                style={{ gap: 6 }}
              >
                <span style={{ display: 'inline-block', animation: doctorLoading ? 'spin 1s linear infinite' : 'none' }}>
                  🔄
                </span>
                <span>{doctorLoading ? '诊断中...' : '重新体检'}</span>
              </button>
            </div>

            {/* Category Filter Pills */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
              {Object.entries(DOCTOR_CATEGORIES).map(([key, label]) => {
                const isSelected = doctorCategory === key
                return (
                  <button
                    key={key}
                    className={`btn btn-sm ${isSelected ? 'btn-secondary' : 'btn-ghost'}`}
                    onClick={() => setDoctorCategory(key)}
                    style={{
                      fontSize: 12,
                      borderColor: isSelected ? 'var(--accent-blue)' : 'transparent'
                    }}
                  >
                    {label}
                  </button>
                )
              })}
            </div>

            {/* Diagnostic Item List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {doctorLoading && doctorResults.length === 0 ? (
                <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>
                  <div style={{ fontSize: 28, marginBottom: 10 }}>🩺</div>
                  <div>正在运行 Xcode、Git、AI 智能体及平台连通性体检，请稍候...</div>
                </div>
              ) : filteredDoctorResults.map((item) => {
                const isOk = item.status === 'ok'
                const isWarn = item.status === 'warning'
                const isErr = item.status === 'error'

                const statusColor = isOk ? 'var(--accent-green)' : isWarn ? 'var(--accent-amber)' : 'var(--accent-red)'
                const statusBg = isOk ? 'var(--accent-green-dim)' : isWarn ? 'var(--accent-amber-dim)' : 'var(--accent-red-dim)'
                const statusLabel = isOk ? '已就绪' : isWarn ? '建议优化' : '缺失/异常'

                return (
                  <div
                    key={item.id}
                    className="card"
                    style={{
                      padding: '14px 18px',
                      borderLeft: `3px solid ${statusColor}`
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                            {item.name}
                          </span>
                          <span className="badge" style={{ background: statusBg, color: statusColor, fontSize: 10 }}>
                            {statusLabel}
                          </span>
                          {item.version && (
                            <span className="badge badge-gray" style={{ fontSize: 10 }}>
                              {item.version}
                            </span>
                          )}
                        </div>

                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 4 }}>
                          {item.message}
                        </div>

                        {item.path && (
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                            <span>检测路径 / 目标: </span>
                            <code style={{ background: 'var(--bg-elevated)', padding: '1px 5px', borderRadius: 4 }}>
                              {item.path}
                            </code>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Remedy hint & command */}
                    {item.remedy && (
                      <div
                        style={{
                          marginTop: 10,
                          padding: '8px 12px',
                          background: 'var(--bg-elevated)',
                          borderRadius: 'var(--radius-md)',
                          border: '1px solid var(--border)',
                          fontSize: 12,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 12
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ color: 'var(--accent-amber)', fontWeight: 500, marginRight: 6 }}>
                            💡 修复指引:
                          </span>
                          <span style={{ color: 'var(--text-primary)', wordBreak: 'break-all' }}>
                            {item.remedy}
                          </span>
                        </div>
                        {item.remedy.includes(' ') && (
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => {
                              // Extract command portion if formatted as "请在终端执行: xxx"
                              const match = item.remedy.match(/(:|\"|\')(.*)/)
                              const cmd = match ? match[2].replace(/[\"\']/g, '').trim() : item.remedy
                              handleCopyCmd(cmd)
                            }}
                            style={{ fontSize: 11, flexShrink: 0 }}
                          >
                            {copiedCmd ? '✓ 已复制' : '复制命令'}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ==================================================== */}
        {/* 3. 网络与端口助手 (Network & Ports Helper) Tab [新增 P2] */}
        {/* ==================================================== */}
        {activeTab === 'network' && (
          <div style={{ padding: '16px 24px', maxWidth: 880 }}>
            <NetworkHelper showToast={showToast} />
          </div>
        )}

        {/* ==================================================== */}
        {/* 4. 服务集成 (Services Integration) Tab */}
        {/* ==================================================== */}
        {activeTab === 'services' && (
          <div style={{ padding: '16px 24px', maxWidth: 840 }}>
            {/* Sub-nav toggle for Yunxiao & Jenkins */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <button
                className={`btn btn-sm ${serviceTab === 'yunxiao' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setServiceTab('yunxiao')}
                style={{ gap: 6, fontSize: 12 }}
              >
                <span>☁️</span>
                <span>阿里云效 (Yunxiao)</span>
              </button>
              <button
                className={`btn btn-sm ${serviceTab === 'jenkins' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setServiceTab('jenkins')}
                style={{ gap: 6, fontSize: 12 }}
              >
                <span>🏗️</span>
                <span>Jenkins CI 持续集成</span>
              </button>
            </div>

            {serviceTab === 'yunxiao' && (
              <YunxiaoSettings
                onConfigChange={(config) => {
                  if (onYunxiaoConfigChange) onYunxiaoConfigChange(config)
                }}
              />
            )}

            {serviceTab === 'jenkins' && (
              <JenkinsSettings
                onConfigChange={(config) => {
                  if (onJenkinsConfigChange) onJenkinsConfigChange(config)
                }}
              />
            )}
          </div>
        )}

        {/* ==================================================== */}
        {/* 4. 系统与关于 Tab */}
        {/* ==================================================== */}
        {activeTab === 'about' && (
          <div style={{ padding: '24px', maxWidth: 800 }}>
            <div className="card" style={{ padding: 20, marginBottom: 16 }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
                flyWork 开发者工作台
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 16 }}>
                面向开发者的效能桌面应用。整合 Git 多分支管理、AI 自动化代码与周报编排、云效项目协同、Jenkins 持续集成与 iOS 崩溃符号化分析。
              </div>

              <div className="divider" style={{ margin: '16px 0' }} />

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>应用版本</div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>v1.0.0</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>主运行时</div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>Electron + React 19</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>全局命令中心快捷键</div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--accent-blue)' }}>⌥ Space / ⌘ K</div>
                </div>
              </div>
            </div>

            <div className="card" style={{ padding: 20 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12 }}>
                本地持久化存储说明
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>应用核心数据</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>~/.flywork/data.json</div>
                  </div>
                  <span className="badge badge-gray" style={{ fontSize: 11 }}>工作空间、会话状态</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>操作审计日志</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>~/.flywork/audit.log</div>
                  </div>
                  <span className="badge badge-gray" style={{ fontSize: 11 }}>安全拦截、执行追踪</span>
                </div>
              </div>

              <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={async () => {
                    try {
                      if (window.flywork?.openPath) {
                        const path = logPath.substring(0, logPath.lastIndexOf('/'))
                        await window.flywork.openPath(path)
                      }
                    } catch (err) {
                      showToast(`打开失败: ${err.message}`)
                    }
                  }}
                  style={{ gap: 6, fontSize: 12 }}
                >
                  <span>📁</span>
                  <span>打开本地存储目录</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

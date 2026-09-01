import { useState, useRef } from 'react'

export default function PrdDecomposeModal({
  isOpen,
  onClose,
  onImportPlan,
  workspaces = [],
  onAddWorkspace
}) {
  const [prdTitle, setPrdTitle] = useState('宠物健康历史报告与应激分析重构')
  const [featureName, setFeatureName] = useState('HealthReport')
  const [plannerAgent, setPlannerAgent] = useState('chatgpt')
  const [importMode, setImportMode] = useState('file') // 'file' (Drag/Select) | 'text' (Direct Input)

  // Selected workspace IDs
  const [selectedWorkspaceIds, setSelectedWorkspaceIds] = useState(() => {
    if (workspaces.length > 0) return [workspaces[0].id]
    return ['PetPal-iOS', 'PetPal-Backend']
  })

  // PRD Text Content
  const [prdText, setPrdText] = useState(`## 3.2 历史报告列表与应激分析
1. 列表页支持分页拉取（20条/页），支持下拉刷新重置与本地离线缓存展示。
2. 状态机规范：.idle / .loading / .loaded(items) / .empty / .error(msg)。
3. 提供重试闭包与全局错误码映射机制。
4. 详情页支持应激等级趋势图与可视化风险标签卡片。
5. 针对离线状态需有完整 SQLite/Room 本地数据库缓存兜底。`)

  // File metadata for imported file
  const [importedFileInfo, setImportedFileInfo] = useState(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isDecomposing, setIsDecomposing] = useState(false)
  const [generatedPlan, setGeneratedPlan] = useState(null)
  const fileInputRef = useRef(null)

  if (!isOpen) return null

  // Workspaces list with default fallbacks if none configured
  const availableWorkspaces =
    workspaces.length > 0
      ? workspaces
      : [
          { id: 'PetPal-iOS', name: 'PetPal-iOS', icon: '📱', root: '/Projects/PetPal-iOS', gitBranch: 'main' },
          { id: 'PetPal-Android', name: 'PetPal-Android', icon: '🤖', root: '/Projects/PetPal-Android', gitBranch: 'develop' },
          { id: 'PetPal-Backend', name: 'PetPal-Backend', icon: '☕', root: '/Projects/PetPal-Backend', gitBranch: 'main' }
        ]

  const handleToggleWorkspace = (id) => {
    setSelectedWorkspaceIds((prev) =>
      prev.includes(id) ? (prev.length > 1 ? prev.filter((x) => x !== id) : prev) : [...prev, id]
    )
  }

  // Handle local file read from drag or selection
  const processDocumentFile = async (file, filePath = null) => {
    try {
      let content = ''
      let fileName = file.name || 'document.md'
      let fileSize = file.size || 0

      // Priority 1: Use native electron path if available
      let nativePath = filePath
      if (!nativePath && window.flywork?.getPathForFile) {
        nativePath = window.flywork.getPathForFile(file)
      }

      if (nativePath && window.flywork?.readTextFile) {
        const res = await window.flywork.readTextFile(nativePath)
        if (res.success) {
          content = res.content
          fileName = res.fileName || fileName
          fileSize = res.size || fileSize
        }
      }

      // Priority 2: Standard HTML5 FileReader fallback
      if (!content && typeof file.text === 'function') {
        content = await file.text()
      }

      if (content) {
        setPrdText(content)
        setImportedFileInfo({
          name: fileName,
          size: fileSize,
          charCount: content.length
        })

        // Auto infer title if file has heading
        const titleMatch = content.match(/^#+\s+(.+)$/m)
        if (titleMatch && titleMatch[1]) {
          setPrdTitle(titleMatch[1].trim())
        }
      }
    } catch (err) {
      console.error('[PrdDecomposeModal] Failed to read file:', err)
    }
  }

  // Drag & Drop Handlers
  const handleDragOver = (e) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleDrop = async (e) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0]
      await processDocumentFile(file)
    }
  }

  // File Picker Dialog Handler
  const handleSelectLocalFile = async () => {
    if (window.flywork?.showOpenDialog && window.flywork?.readTextFile) {
      const result = await window.flywork.showOpenDialog({
        title: '选择 PRD 需求文档',
        properties: ['openFile'],
        filters: [
          { name: 'PRD Documents (*.md, *.txt, *.markdown, *.json)', extensions: ['md', 'txt', 'markdown', 'json', 'yaml', 'yml'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      })

      if (result && !result.canceled && result.filePaths?.length > 0) {
        const filePath = result.filePaths[0]
        const res = await window.flywork.readTextFile(filePath)
        if (res.success) {
          setPrdText(res.content)
          setImportedFileInfo({
            name: res.fileName,
            size: res.size,
            charCount: res.content.length
          })
          const titleMatch = res.content.match(/^#+\s+(.+)$/m)
          if (titleMatch && titleMatch[1]) {
            setPrdTitle(titleMatch[1].trim())
          }
        }
        return
      }
    }

    // Fallback file input
    fileInputRef.current?.click()
  }

  const handleNativeFileInputChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      processDocumentFile(e.target.files[0])
    }
  }

  // AI PRD Decompose Execution
  const handleDecompose = async () => {
    if (!prdText.trim()) return
    setIsDecomposing(true)

    const selectedProjectsData = availableWorkspaces
      .filter((w) => selectedWorkspaceIds.includes(w.id))
      .map((w) => ({
        id: w.id,
        name: w.name,
        root: w.root,
        platform: w.tags?.[0] || 'Local Project'
      }))

    try {
      if (window.flywork?.orchestratorDecomposePrd) {
        const res = await window.flywork.orchestratorDecomposePrd(prdText, {
          title: prdTitle,
          featureName,
          targetProjects: selectedProjectsData.map((p) => p.name)
        })
        if (res.success && res.plan) {
          setGeneratedPlan({
            ...res.plan,
            projects: selectedProjectsData
          })
        }
      } else {
        // Simulation Fallback
        setTimeout(() => {
          setGeneratedPlan({
            planId: `PLAN-${Date.now().toString().slice(-4)}`,
            title: prdTitle,
            feature: featureName,
            projects: selectedProjectsData,
            tasks: [
              {
                id: 'AUTO-101',
                title: 'Define Domain Entity & Stress Enum',
                layer: 'domain',
                status: 'READY',
                project: selectedProjectsData[0]?.name || 'App-Client',
                dependencies: [],
                execution: { recommended: { agent_id: 'chatgpt', model_id: 'gpt-4o', score: 96 } }
              },
              {
                id: 'AUTO-102',
                title: 'Implement Local Storage Repository',
                layer: 'data',
                status: 'BLOCKED',
                project: selectedProjectsData[0]?.name || 'App-Client',
                dependencies: ['AUTO-101'],
                execution: { recommended: { agent_id: 'antigravity', model_id: 'auto', score: 95 } }
              },
              {
                id: 'AUTO-103',
                title: 'Build UI Layout Skeleton',
                layer: 'ui',
                status: 'READY',
                project: selectedProjectsData[0]?.name || 'App-Client',
                dependencies: [],
                execution: { recommended: { agent_id: 'trae', model_id: 'claude-3-5-sonnet', score: 92 } }
              }
            ]
          })
          setIsDecomposing(false)
        }, 1200)
        return
      }
    } catch (err) {
      console.error('Decomposition error:', err)
    } finally {
      setIsDecomposing(false)
    }
  }

  const handleConfirmImport = () => {
    if (generatedPlan) {
      onImportPlan(generatedPlan)
      onClose()
    }
  }

  const handleInsertTemplate = () => {
    setPrdText(`## 1. 业务目标与需求概述
支持用户在 App 端查看最新的健康评估报告与历史应激变化曲线。

## 2. 核心功能规范
1. 【列表展示】：支持每页 20 条分页拉取与下拉刷新，异常时支持重试。
2. 【离线缓存】：无网络时展示 SQLite 本地缓存数据。
3. 【详情图表】：可视化展示心率波动与应激等级趋势图。

## 3. 跨端工程契约
- iOS: SwiftUI + Combine MVVM
- Android: Jetpack Compose + Kotlin Coroutines
- Backend: RESTful API + Redis 缓存`)
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.75)',
        backdropFilter: 'blur(5px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: 20
      }}
    >
      <div
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-xl)',
          width: '100%',
          maxWidth: 820,
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: 'var(--shadow-xl)',
          overflow: 'hidden'
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '16px 22px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--bg-elevated)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 'var(--radius-md)',
                background: 'linear-gradient(135deg, rgba(79,158,248,0.25), rgba(139,92,246,0.25))',
                border: '1px solid rgba(79,158,248,0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 16
              }}
            >
              ✨
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
                新建需求 & PRD 任务智能拆解 (Decompose PRD)
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                关联当前工作空间工程，支持文档拖拽/选择/文本输入，一键生成六层 Task DAG
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary)',
              fontSize: 18,
              cursor: 'pointer'
            }}
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Section 1: Meta Inputs */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 4, fontWeight: 600 }}>
                需求标题 (Requirement Title):
              </label>
              <input
                type="text"
                value={prdTitle}
                onChange={(e) => setPrdTitle(e.target.value)}
                placeholder="例如：宠物健康报告与应激分析优化"
                style={{
                  width: '100%',
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  padding: '7px 10px',
                  fontSize: 12,
                  color: 'var(--text-primary)',
                  outline: 'none'
                }}
              />
            </div>

            <div>
              <label style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 4, fontWeight: 600 }}>
                功能特性名 (Feature Name):
              </label>
              <input
                type="text"
                value={featureName}
                onChange={(e) => setFeatureName(e.target.value)}
                placeholder="HealthReport"
                style={{
                  width: '100%',
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  padding: '7px 10px',
                  fontSize: 12,
                  color: 'var(--text-primary)',
                  outline: 'none'
                }}
              />
            </div>

            <div>
              <label style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 4, fontWeight: 600 }}>
                规划智能体 (Planner Agent):
              </label>
              <select
                value={plannerAgent}
                onChange={(e) => setPlannerAgent(e.target.value)}
                style={{
                  width: '100%',
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  padding: '7px 10px',
                  fontSize: 12,
                  color: 'var(--text-primary)',
                  outline: 'none'
                }}
              >
                <option value="chatgpt">🤖 ChatGPT (o3-mini / 4o)</option>
                <option value="antigravity">✨ Antigravity Planner</option>
              </select>
            </div>
          </div>

          {/* Section 2: Associated Workspaces (当前存在的工作空间) */}
          <div
            style={{
              background: 'var(--bg-elevated)',
              padding: '12px 14px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>
                  📁 关联当前工作空间工程 (Workspaces)
                </span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>（多选，任务将分配至对应工程）</span>
              </div>

              {onAddWorkspace && (
                <button
                  onClick={onAddWorkspace}
                  style={{
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border)',
                    color: 'var(--accent-blue)',
                    padding: '3px 8px',
                    borderRadius: 4,
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  + 关联本地新工程文件夹
                </button>
              )}
            </div>

            {/* Workspace Checkbox Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8 }}>
              {availableWorkspaces.map((ws) => {
                const isSelected = selectedWorkspaceIds.includes(ws.id)
                return (
                  <div
                    key={ws.id}
                    onClick={() => handleToggleWorkspace(ws.id)}
                    style={{
                      background: isSelected ? 'rgba(79,158,248,0.12)' : 'var(--bg-surface)',
                      border: isSelected ? '1px solid var(--accent-blue)' : '1px solid var(--border)',
                      borderRadius: 6,
                      padding: '8px 10px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      transition: 'all 120ms ease'
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {}}
                      style={{ cursor: 'pointer' }}
                    />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span>{ws.icon || '📁'}</span>
                        <span
                          style={{
                            fontSize: 12,
                            fontWeight: 600,
                            color: isSelected ? 'var(--accent-blue)' : 'var(--text-primary)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          {ws.name}
                        </span>
                      </div>
                      <div
                        style={{
                          fontSize: 10,
                          color: 'var(--text-secondary)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          marginTop: 2
                        }}
                      >
                        {ws.root || ws.description || '本地工程目录'}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Section 3: PRD Multi-Modal Import (文件选择 / 拖拽 / 文本) */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>
                  📄 PRD 需求内容导入方式
                </span>
                {/* Mode Tabs */}
                <div style={{ display: 'flex', background: 'var(--bg-elevated)', padding: 2, borderRadius: 6, border: '1px solid var(--border)' }}>
                  <button
                    onClick={() => setImportMode('file')}
                    style={{
                      background: importMode === 'file' ? 'var(--accent-blue-dim)' : 'transparent',
                      color: importMode === 'file' ? 'var(--accent-blue)' : 'var(--text-secondary)',
                      border: 'none',
                      padding: '3px 8px',
                      borderRadius: 4,
                      fontSize: 11,
                      fontWeight: importMode === 'file' ? 600 : 400,
                      cursor: 'pointer'
                    }}
                  >
                    📥 文档拖拽 / 选择导入
                  </button>
                  <button
                    onClick={() => setImportMode('text')}
                    style={{
                      background: importMode === 'text' ? 'var(--accent-blue-dim)' : 'transparent',
                      color: importMode === 'text' ? 'var(--accent-blue)' : 'var(--text-secondary)',
                      border: 'none',
                      padding: '3px 8px',
                      borderRadius: 4,
                      fontSize: 11,
                      fontWeight: importMode === 'text' ? 600 : 400,
                      cursor: 'pointer'
                    }}
                  >
                    ✍️ 直接编辑 / 粘贴文本
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={handleInsertTemplate}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--accent-blue)',
                    fontSize: 11,
                    cursor: 'pointer'
                  }}
                >
                  📝 插入标准 PRD 模板
                </button>
              </div>
            </div>

            {/* Mode 1: Drag & Drop Zone */}
            {importMode === 'file' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={handleSelectLocalFile}
                  style={{
                    border: `2px dashed ${isDragging ? 'var(--accent-blue)' : 'var(--border)'}`,
                    borderRadius: 'var(--radius-xl)',
                    padding: '24px 20px',
                    textAlign: 'center',
                    cursor: 'pointer',
                    background: isDragging ? 'var(--accent-blue-dim)' : 'var(--bg-elevated)',
                    transition: 'all 120ms ease'
                  }}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".md,.txt,.markdown,.json,.yaml,.yml"
                    onChange={handleNativeFileInputChange}
                    style={{ display: 'none' }}
                  />

                  <div style={{ fontSize: 32, marginBottom: 8 }}>📄</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
                    {isDragging ? '松开鼠标立即导入文档' : '拖拽 PRD 文档至此处，或点击浏览本地文件'}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                    支持 Markdown (.md, .markdown)、纯文本 (.txt)、Swagger/Apifox (.json, .yaml)
                  </div>
                </div>

                {/* Imported File Info Pill */}
                {importedFileInfo && (
                  <div
                    style={{
                      background: 'rgba(63,185,80,0.1)',
                      border: '1px solid rgba(63,185,80,0.3)',
                      padding: '8px 12px',
                      borderRadius: 6,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: 11
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ color: 'var(--accent-green)', fontWeight: 700 }}>✓ 已加载文件:</span>
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{importedFileInfo.name}</span>
                      <span style={{ color: 'var(--text-secondary)' }}>
                        ({(importedFileInfo.size / 1024).toFixed(1)} KB · {importedFileInfo.charCount} 字符)
                      </span>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setImportedFileInfo(null)
                        setPrdText('')
                      }}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-danger)',
                        fontSize: 11,
                        cursor: 'pointer'
                      }}
                    >
                      清除
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Mode 2: Direct Text Editor (also preview when file is loaded) */}
            <div style={{ marginTop: importMode === 'file' ? 10 : 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                  {importMode === 'file' ? 'PRD 解析预览 / 可编辑内容:' : '编辑 PRD Markdown 内容:'}
                </span>
                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{prdText.length} 字符</span>
              </div>
              <textarea
                rows={importMode === 'file' ? 5 : 8}
                value={prdText}
                onChange={(e) => setPrdText(e.target.value)}
                placeholder="粘贴 PRD 需求内容..."
                style={{
                  width: '100%',
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  padding: '10px 12px',
                  fontSize: 12,
                  color: 'var(--text-primary)',
                  fontFamily: 'monospace',
                  lineHeight: 1.5,
                  outline: 'none',
                  resize: 'vertical'
                }}
              />
            </div>
          </div>

          {/* Action to Decompose */}
          <div>
            <button
              onClick={handleDecompose}
              disabled={isDecomposing || !prdText.trim()}
              style={{
                background: 'linear-gradient(135deg, #4f9ef8, #8b5cf6)',
                border: 'none',
                color: '#fff',
                padding: '9px 20px',
                borderRadius: 'var(--radius-md)',
                fontSize: 13,
                fontWeight: 600,
                cursor: isDecomposing ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                boxShadow: '0 0 16px rgba(79,158,248,0.3)'
              }}
            >
              <span>{isDecomposing ? '⏳' : '⚡'}</span>
              {isDecomposing ? 'AI 架构规划中（推导工程任务与 DAG 依赖）...' : '启动智能拆解 (Decompose PRD)'}
            </button>
          </div>

          {/* Generated Plan Preview Box */}
          {generatedPlan && (
            <div
              style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--accent-green)',
                borderRadius: 'var(--radius-md)',
                padding: '12px 16px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-green)' }}>
                  ✓ 拆解成功：已生成 {generatedPlan.tasks?.length || 0} 个工程分层任务
                </span>
                <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                  已自动完成 DAG 依赖拓扑推导与 Agent 推荐
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10, maxHeight: 160, overflowY: 'auto' }}>
                {(generatedPlan.tasks || []).map((t) => (
                  <div
                    key={t.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: 'var(--bg-surface)',
                      padding: '6px 10px',
                      borderRadius: 4,
                      fontSize: 11,
                      border: '1px solid var(--border)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ color: 'var(--accent-blue)', fontFamily: 'monospace', fontWeight: 700 }}>
                        {t.id}
                      </span>
                      <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{t.title}</span>
                      <span style={{ color: 'var(--text-secondary)' }}>({t.layer})</span>
                    </div>
                    <span style={{ color: 'var(--accent-green)', fontWeight: 600 }}>
                      {t.execution?.recommended?.agent_id || 'chatgpt'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: '12px 22px',
            borderTop: '1px solid var(--border)',
            background: 'var(--bg-elevated)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 10
          }}
        >
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: '1px solid var(--border)',
              color: 'var(--text-secondary)',
              padding: '7px 16px',
              borderRadius: 'var(--radius-md)',
              fontSize: 12,
              cursor: 'pointer'
            }}
          >
            取消
          </button>

          <button
            onClick={handleConfirmImport}
            disabled={!generatedPlan}
            style={{
              background: generatedPlan ? 'var(--accent-blue)' : 'var(--bg-surface)',
              border: 'none',
              color: generatedPlan ? '#fff' : 'var(--text-muted)',
              padding: '7px 18px',
              borderRadius: 'var(--radius-md)',
              fontSize: 12,
              fontWeight: 600,
              cursor: generatedPlan ? 'pointer' : 'not-allowed'
            }}
          >
            应用并进入编排面板 (Apply)
          </button>
        </div>
      </div>
    </div>
  )
}

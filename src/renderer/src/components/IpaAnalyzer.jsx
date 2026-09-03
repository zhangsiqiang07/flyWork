/* eslint-disable react/prop-types */
import { useState, useCallback, useMemo } from 'react'

const CATEGORY_COLORS = {
  executable: '#3b82f6', // blue
  frameworks: '#8b5cf6', // purple
  assets: '#10b981', // green
  fonts: '#f59e0b', // amber
  scripts: '#06b6d4', // cyan
  models: '#a855f7', // purple-pink
  data: '#6366f1', // indigo
  media: '#ec4899', // pink
  localization: '#14b8a6', // teal
  plugins: '#0284c7', // light blue
  other: '#64748b' // slate
}

const CATEGORY_NAMES = {
  executable: '主可执行程序',
  frameworks: '动态库 (Frameworks)',
  assets: '图片与资产 (Assets)',
  fonts: '字体文件 (Fonts)',
  scripts: '代码脚本与 Web 资源',
  models: 'AI 模型与着色器',
  data: '数据与数据库',
  media: '音视频多媒体',
  localization: '多语言与配置',
  plugins: 'App 扩展插件',
  other: '其他未归类文件'
}

export default function IpaAnalyzer({ showToast }) {
  const [analyzing, setAnalyzing] = useState(false)
  const [analysisResult, setAnalysisResult] = useState(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const [activeTab, setActiveTab] = useState('overview') // 'overview' | 'frameworks' | 'extensions' | 'files' | 'recommendations'
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('all')
  const [inspectingFile, setInspectingFile] = useState(null)

  // Trigger analysis for a given file path
  const runAnalysis = useCallback(
    async (filePath) => {
      if (!filePath) return
      setAnalyzing(true)
      setErrorMsg('')
      showToast?.('正在解压并深度拆解分析安装包...')

      try {
        if (!window.flywork?.ipaAnalyze) {
          throw new Error(
            '未检测到 IPA 分析接口 (window.flywork.ipaAnalyze 为空)，请重启应用以生效最新模块。'
          )
        }

        const res = await window.flywork.ipaAnalyze(filePath)
        if (res?.success) {
          setAnalysisResult(res)
          setSelectedCategoryFilter('all')
          showToast?.(`✓ 成功完成 ${res.appName} 体积分析！`)
        } else {
          setErrorMsg(res?.error || '分析失败')
          showToast?.(`分析失败: ${res?.error || '未知错误'}`)
        }
      } catch (err) {
        setErrorMsg(err.message)
        showToast?.(`分析异常: ${err.message}`)
      } finally {
        setAnalyzing(false)
      }
    },
    [showToast]
  )

  // Handle Drag & Drop
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
    const files = e.dataTransfer.files
    if (!files || files.length === 0) return

    const file = files[0]
    let filePath = file.path
    if (!filePath && window.flywork?.getPathForFile) {
      filePath = window.flywork.getPathForFile(file)
    }

    if (filePath) {
      await runAnalysis(filePath)
    }
  }

  // Open file dialog picker
  const handlePickFile = async () => {
    try {
      if (window.flywork?.showOpenDialog) {
        const res = await window.flywork.showOpenDialog({
          title: '选择 iOS 安装包或应用程序',
          filters: [
            { name: 'iOS 安装包或应用 (*.ipa, *.app, *.zip)', extensions: ['ipa', 'app', 'zip'] }
          ],
          properties: ['openFile']
        })
        if (res && res.filePaths && res.filePaths.length > 0) {
          await runAnalysis(res.filePaths[0])
        }
      }
    } catch (err) {
      showToast?.(`选择文件失败: ${err.message}`)
    }
  }

  // Filter frameworks
  const filteredFrameworks = useMemo(() => {
    if (!analysisResult?.frameworksList) return []
    if (!searchQuery.trim()) return analysisResult.frameworksList
    const q = searchQuery.toLowerCase()
    return analysisResult.frameworksList.filter((f) => f.name.toLowerCase().includes(q))
  }, [analysisResult, searchQuery])

  // Filter extensions
  const filteredExtensions = useMemo(() => {
    if (!analysisResult?.extensionBreakdown) return []
    if (!searchQuery.trim()) return analysisResult.extensionBreakdown
    const q = searchQuery.toLowerCase()
    return analysisResult.extensionBreakdown.filter((item) => item.ext.toLowerCase().includes(q))
  }, [analysisResult, searchQuery])

  // Filter files by category and query
  const filteredFiles = useMemo(() => {
    if (!analysisResult?.allFiles) return []
    let list = analysisResult.allFiles

    if (selectedCategoryFilter && selectedCategoryFilter !== 'all') {
      list = list.filter((f) => f.type === selectedCategoryFilter)
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      list = list.filter(
        (f) => f.name.toLowerCase().includes(q) || f.path.toLowerCase().includes(q)
      )
    }

    return list
  }, [analysisResult, selectedCategoryFilter, searchQuery])

  // Jump to files tab with specific category
  const viewCategoryFiles = (catKey) => {
    setSelectedCategoryFilter(catKey)
    setSearchQuery('')
    setActiveTab('files')
  }

  // Jump to files tab with specific extension
  const viewExtensionFiles = (ext) => {
    setSelectedCategoryFilter('all')
    setSearchQuery(ext)
    setActiveTab('files')
  }

  // Copy full JSON report
  const copyReport = () => {
    if (!analysisResult) return
    navigator.clipboard.writeText(JSON.stringify(analysisResult, null, 2))
    showToast?.('✓ 已复制完整 IPA 体积分析报告 (JSON)')
  }

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{
        padding: '16px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        position: 'relative',
        minHeight: '100%'
      }}
    >
      {/* Global Drag & Drop Overlay (Active even when a package is already analyzed) */}
      {isDragging && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.85)',
            backdropFilter: 'blur(6px)',
            border: '3px dashed var(--accent-blue)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
            gap: 14,
            pointerEvents: 'none'
          }}
        >
          <div style={{ fontSize: 56 }}>📦</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#fff' }}>
            释放以分析此安装包 (.ipa / .app)
          </div>
          <div style={{ fontSize: 13, color: 'rgba(255, 255, 255, 0.75)' }}>
            将立即替换并深度拆解新的 iOS 安装包资产结构
          </div>
        </div>
      )}

      {/* Analyzing Banner */}
      {analyzing && (
        <div
          className="card"
          style={{
            padding: '12px 18px',
            background: 'var(--accent-blue-dim)',
            border: '1px solid var(--accent-blue)',
            color: 'var(--accent-blue)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            fontSize: 13,
            fontWeight: 500
          }}
        >
          <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>⟳</span>
          <span>正在解压并深度拆解分析新安装包，请稍候...</span>
        </div>
      )}

      {/* 1. Drag & Drop Hero Zone (when no result) */}
      {!analysisResult ? (
        <div
          style={{
            border: `2px dashed ${isDragging ? 'var(--accent-blue)' : 'var(--border)'}`,
            borderRadius: 'var(--radius-lg)',
            padding: '48px 24px',
            textAlign: 'center',
            background: isDragging ? 'rgba(59, 130, 246, 0.08)' : 'var(--bg-card)',
            transition: 'all 200ms ease',
            cursor: 'pointer'
          }}
          onClick={handlePickFile}
        >
          <div style={{ fontSize: 44, marginBottom: 12 }}>📦</div>
          <div
            style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}
          >
            {analyzing
              ? '正在深度解压与拆解分析安装包...'
              : '拖拽 iOS .ipa 安装包或 .app 文件至此处'}
          </div>
          <div
            style={{
              fontSize: 12,
              color: 'var(--text-secondary)',
              maxWidth: 540,
              margin: '0 auto 16px auto',
              lineHeight: 1.6
            }}
          >
            系统将毫秒级深度遍历解封应用，高精拆解主二进制 (Mach-O)、三方动态库
            (Frameworks)、Assets.car 资产、字体库
            (Fonts)、JS/Web代码包、AI/CoreML模型、数据文件及多语言配置，并出具瘦身优化建议。
          </div>
          <button
            className="btn btn-primary btn-sm"
            onClick={(e) => {
              e.stopPropagation()
              handlePickFile()
            }}
            disabled={analyzing}
            style={{ fontSize: 12, gap: 6 }}
          >
            <span>📂</span>
            <span>{analyzing ? '分析中...' : '选择 .ipa 或 .app 文件'}</span>
          </button>

          {errorMsg && (
            <div style={{ marginTop: 16, color: 'var(--accent-red)', fontSize: 12 }}>
              ❌ {errorMsg}
            </div>
          )}
        </div>
      ) : (
        <div
          className="card"
          style={{
            padding: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 10,
                background: 'var(--accent-blue-dim)',
                color: 'var(--accent-blue)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 22,
                flexShrink: 0
              }}
            >
              📱
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
                  {analysisResult.appName}
                </span>
                <span className="badge" style={{ fontSize: 10, background: 'var(--bg-elevated)' }}>
                  v{analysisResult.version} ({analysisResult.buildNumber})
                </span>
                <span
                  className="badge"
                  style={{
                    fontSize: 10,
                    background: 'var(--accent-teal-dim)',
                    color: 'var(--accent-teal)'
                  }}
                >
                  {analysisResult.architectures?.join(', ')}
                </span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                Bundle ID: <code>{analysisResult.bundleId}</code> · 目标系统:{' '}
                <code>{analysisResult.minOsVersion}</code> · 文件:{' '}
                <code>{analysisResult.fileName}</code>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>(可直接拖入新包)</span>
            <button
              className="btn btn-secondary btn-sm"
              onClick={copyReport}
              style={{ fontSize: 11, height: 28, gap: 4 }}
            >
              <span>📋</span>
              <span>导出 JSON</span>
            </button>
            <button
              className="btn btn-primary btn-sm"
              onClick={handlePickFile}
              style={{ fontSize: 11, height: 28, gap: 4 }}
            >
              <span>🔄</span>
              <span>选择其他包</span>
            </button>
          </div>
        </div>
      )}

      {/* 2. Analysis Results Dashboard */}
      {analysisResult && (
        <>
          {/* Key Metrics Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
              gap: 12
            }}
          >
            <div className="card" style={{ padding: '12px 16px' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
                {analysisResult.isIpa ? '📦 IPA 压缩包体积' : '📁 安装包体积'}
              </div>
              <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--accent-blue)' }}>
                {analysisResult.formattedCompressedSize !== 'N/A'
                  ? analysisResult.formattedCompressedSize
                  : analysisResult.formattedInstalledSize}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 2 }}>
                App Store 下载估算体积
              </div>
            </div>

            <div className="card" style={{ padding: '12px 16px' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
                📲 解压落盘占用体积
              </div>
              <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>
                {analysisResult.formattedInstalledSize}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 2 }}>
                设备实际占用磁盘空间
              </div>
            </div>

            <div className="card" style={{ padding: '12px 16px' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
                📚 动态库 (Frameworks)
              </div>
              <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--accent-purple)' }}>
                {analysisResult.categories.frameworks?.formatted || '0 B'}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 2 }}>
                共 {analysisResult.categories.frameworks?.count || 0} 个三方/私有库
              </div>
            </div>

            <div className="card" style={{ padding: '12px 16px' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
                🔤 字体与脚本资产
              </div>
              <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--accent-amber)' }}>
                {(analysisResult.categories.fonts?.size || 0) +
                  (analysisResult.categories.scripts?.size || 0) >
                0
                  ? `${analysisResult.categories.fonts?.formatted || '0 B'} / ${analysisResult.categories.scripts?.formatted || '0 B'}`
                  : '0 B'}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 2 }}>
                字体: {analysisResult.categories.fonts?.percent || 0}% · 脚本:{' '}
                {analysisResult.categories.scripts?.percent || 0}%
              </div>
            </div>

            <div className="card" style={{ padding: '12px 16px' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
                💡 瘦身与优化建议
              </div>
              <div
                style={{
                  fontSize: 20,
                  fontWeight: 700,
                  color: analysisResult.recommendations.some(
                    (r) => r.type === 'danger' || r.type === 'warning'
                  )
                    ? 'var(--accent-red)'
                    : 'var(--accent-green)'
                }}
              >
                {analysisResult.recommendations.length} 项
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 2 }}>
                高价值瘦身改进建议
              </div>
            </div>
          </div>

          {/* Visual Category Breakdown Progress Bar */}
          <div className="card" style={{ padding: 16 }}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--text-primary)',
                marginBottom: 10
              }}
            >
              📊 安装包体积构成高精细分分布
            </div>

            {/* Segmented Color Bar */}
            <div
              style={{
                display: 'flex',
                height: 20,
                borderRadius: 'var(--radius-sm)',
                overflow: 'hidden',
                background: 'var(--bg-elevated)',
                marginBottom: 12
              }}
            >
              {Object.entries(analysisResult.categories).map(([catKey, cat]) => {
                const pct = parseFloat(cat.percent)
                if (pct <= 0.1) return null
                return (
                  <div
                    key={catKey}
                    title={`${cat.icon} ${cat.label}: ${cat.formatted} (${cat.percent}%) - ${cat.desc}`}
                    onClick={() => viewCategoryFiles(catKey)}
                    style={{
                      width: `${pct}%`,
                      background: cat.color || CATEGORY_COLORS[catKey] || '#64748b',
                      transition: 'width 300ms ease',
                      cursor: 'pointer'
                    }}
                  />
                )
              })}
            </div>

            {/* Legend Pills */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {Object.entries(analysisResult.categories).map(([catKey, cat]) => {
                const pct = parseFloat(cat.percent)
                if (cat.size === 0 && pct === 0) return null
                return (
                  <div
                    key={catKey}
                    onClick={() => viewCategoryFiles(catKey)}
                    title={`点击查看属于「${cat.label}」的文件清单`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      fontSize: 11,
                      padding: '3px 8px',
                      background: 'var(--bg-elevated)',
                      borderRadius: 'var(--radius-sm)',
                      cursor: 'pointer',
                      border: '1px solid var(--border)'
                    }}
                  >
                    <span>{cat.icon}</span>
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 2,
                        background: cat.color || CATEGORY_COLORS[catKey] || '#64748b',
                        display: 'inline-block'
                      }}
                    />
                    <span style={{ color: 'var(--text-secondary)' }}>{cat.label}:</span>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                      {cat.formatted}
                    </span>
                    <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>
                      ({cat.percent}%)
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Sub Navigation Tabs */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: '1px solid var(--border)',
              paddingBottom: 8
            }}
          >
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {[
                { id: 'overview', label: '总体细分诊断', icon: '📋' },
                {
                  id: 'extensions',
                  label: `文件后缀排行 (${analysisResult.extensionBreakdown?.length || 0})`,
                  icon: '📊'
                },
                {
                  id: 'frameworks',
                  label: `动态库排行 (${analysisResult.frameworksList?.length || 0})`,
                  icon: '📚'
                },
                { id: 'files', label: `文件穿透检索 (${filteredFiles.length})`, icon: '🎨' },
                {
                  id: 'recommendations',
                  label: `瘦身优化建议 (${analysisResult.recommendations?.length || 0})`,
                  icon: '💡'
                }
              ].map((t) => (
                <button
                  key={t.id}
                  className={`btn btn-sm ${activeTab === t.id ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => setActiveTab(t.id)}
                  style={{ fontSize: 12, height: 28, gap: 6 }}
                >
                  <span>{t.icon}</span>
                  <span>{t.label}</span>
                </button>
              ))}
            </div>

            {(activeTab === 'frameworks' ||
              activeTab === 'extensions' ||
              activeTab === 'files') && (
              <input
                type="text"
                className="input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="搜索扩展名、文件名或路径..."
                style={{ fontSize: 11, padding: '2px 8px', height: 26, width: 200 }}
              />
            )}
          </div>

          {/* Tab 1: Overview with detailed Breakdown */}
          {activeTab === 'overview' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: 14 }}>
              {/* Category Breakdown Table */}
              <div className="card" style={{ padding: 16 }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 10
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                    全景资产分类颗粒度统计 (点击穿透查看明细)
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    共 {analysisResult.allFilesCount} 个文件
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {Object.entries(analysisResult.categories).map(([catKey, cat]) => (
                    <div
                      key={catKey}
                      onClick={() => viewCategoryFiles(catKey)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 10px',
                        background: 'var(--bg-elevated)',
                        borderRadius: 'var(--radius-sm)',
                        cursor: 'pointer',
                        transition: 'background 150ms ease'
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.background = 'var(--bg-elevated)')
                      }
                      title={`点击筛选属于「${cat.label}」的文件`}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          minWidth: 0,
                          flex: 1
                        }}
                      >
                        <span style={{ fontSize: 14 }}>{cat.icon}</span>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span
                              style={{
                                fontSize: 12,
                                fontWeight: 600,
                                color: 'var(--text-primary)'
                              }}
                            >
                              {cat.label}
                            </span>
                            {catKey === 'other' && (
                              <span
                                className="badge"
                                style={{
                                  fontSize: 9,
                                  background: 'var(--bg-hover)',
                                  color: 'var(--text-muted)'
                                }}
                              >
                                细碎杂项
                              </span>
                            )}
                          </div>
                          <div
                            style={{
                              fontSize: 10,
                              color: 'var(--text-muted)',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis'
                            }}
                          >
                            {cat.desc}
                          </div>
                        </div>
                      </div>

                      <div
                        style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}
                      >
                        <span
                          style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}
                        >
                          {cat.formatted}
                        </span>
                        <span
                          style={{
                            fontSize: 11,
                            color: 'var(--text-muted)',
                            width: 44,
                            textAlign: 'right'
                          }}
                        >
                          {cat.percent}%
                        </span>
                        <span style={{ fontSize: 11, color: 'var(--accent-blue)', opacity: 0.8 }}>
                          查看 →
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Assets.car & Bundles info */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="card" style={{ padding: 16 }}>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      marginBottom: 10,
                      color: 'var(--text-primary)'
                    }}
                  >
                    Assets Catalog 编录摘要
                  </div>
                  {analysisResult.assetsCarInfo ? (
                    <div style={{ fontSize: 12, lineHeight: 1.6, color: 'var(--text-primary)' }}>
                      <div style={{ marginBottom: 6 }}>
                        <strong>已编录资产总数:</strong>{' '}
                        {analysisResult.assetsCarInfo.renditionCount} 个
                      </div>
                      <div
                        style={{ color: 'var(--text-secondary)', marginBottom: 8, fontSize: 11 }}
                      >
                        Apple assetutil 已对包含的切图完成按机型 Thinning 压缩。
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>编录图片抽样：</div>
                      <div
                        style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 3 }}
                      >
                        {analysisResult.assetsCarInfo.assets.slice(0, 4).map((a, idx) => (
                          <div
                            key={idx}
                            style={{
                              fontSize: 10,
                              display: 'flex',
                              justifyContent: 'space-between',
                              fontFamily: 'monospace'
                            }}
                          >
                            <span>{a.name}</span>
                            <span style={{ color: 'var(--text-muted)' }}>
                              {a.scale}x · {a.idiom}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                      未单独检测到 Assets.car。散落图片建议放入 Images.xcassets 统一管理。
                    </div>
                  )}
                </div>

                {/* Bundles directory info */}
                {analysisResult.bundlesList?.length > 0 && (
                  <div className="card" style={{ padding: 16 }}>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        marginBottom: 8,
                        color: 'var(--text-primary)'
                      }}
                    >
                      包含的嵌套资源包 (Bundles, {analysisResult.bundlesList.length} 个)
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {analysisResult.bundlesList.slice(0, 5).map((b, idx) => (
                        <div
                          key={idx}
                          style={{
                            fontSize: 11,
                            display: 'flex',
                            justifyContent: 'space-between',
                            padding: '4px 6px',
                            background: 'var(--bg-elevated)',
                            borderRadius: 4
                          }}
                        >
                          <code style={{ fontSize: 10 }}>{b.name}</code>
                          <span style={{ fontWeight: 600 }}>{b.formattedSize}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tab 2: Extension Breakdown (NEW!) */}
          {activeTab === 'extensions' && (
            <div className="card" style={{ padding: 16 }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 12
                }}
              >
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                    文件后缀类型分布排行 (按文件拓展名聚合)
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                    直观揭秘到底是哪类文件在膨胀安装包体积，点击任意后缀可查看所属所有文件
                  </div>
                </div>
              </div>

              {filteredExtensions.length === 0 ? (
                <div
                  style={{
                    textAlign: 'center',
                    padding: 24,
                    color: 'var(--text-muted)',
                    fontSize: 12
                  }}
                >
                  无匹配后缀
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {filteredExtensions.map((item, idx) => (
                    <div
                      key={idx}
                      onClick={() => viewExtensionFiles(item.ext)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 12px',
                        background: 'var(--bg-elevated)',
                        borderRadius: 'var(--radius-sm)',
                        cursor: 'pointer'
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.background = 'var(--bg-elevated)')
                      }
                      title={`点击筛选所有 ${item.ext} 文件`}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)', width: 24 }}>
                          #{idx + 1}
                        </span>
                        <code
                          style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-blue)' }}
                        >
                          {item.ext}
                        </code>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          {item.ext === '.framework'
                            ? '动态库目录'
                            : item.ext === '.car'
                              ? 'Xcode Asset Catalog 矢量编译切图'
                              : item.ext === '.ttf' || item.ext === '.otf'
                                ? '字体文件'
                                : item.ext === '.jsbundle' || item.ext === '.bundle'
                                  ? 'JavaScript / React Native 代码包'
                                  : item.ext === '.png' ||
                                      item.ext === '.jpg' ||
                                      item.ext === '.webp'
                                    ? '离散图片资源'
                                    : item.ext === '.strings' || item.ext === '.stringsdict'
                                      ? '多语言本地化文件'
                                      : item.ext === '.json'
                                        ? 'JSON 静态配置文件'
                                        : item.ext === '.sqlite' || item.ext === '.db'
                                          ? '本地 SQLite 数据库'
                                          : item.ext === '.metallib'
                                            ? 'Metal 着色器图形库'
                                            : item.ext === '.caf' ||
                                                item.ext === '.wav' ||
                                                item.ext === '.mp3'
                                              ? '音频素材'
                                              : '其他资源文件'}
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                        <div
                          style={{
                            width: 120,
                            height: 6,
                            background: 'var(--bg-card)',
                            borderRadius: 3,
                            overflow: 'hidden'
                          }}
                        >
                          <div
                            style={{
                              width: `${Math.min(parseFloat(item.percent), 100)}%`,
                              height: '100%',
                              background: 'var(--accent-blue)'
                            }}
                          />
                        </div>
                        <span
                          style={{
                            fontSize: 12,
                            fontWeight: 600,
                            color: 'var(--text-primary)',
                            width: 70,
                            textAlign: 'right'
                          }}
                        >
                          {item.formattedSize}
                        </span>
                        <span
                          style={{
                            fontSize: 11,
                            color: 'var(--text-muted)',
                            width: 48,
                            textAlign: 'right'
                          }}
                        >
                          {item.percent}%
                        </span>
                        <span style={{ fontSize: 11, color: 'var(--accent-blue)' }}>
                          查看文件 →
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tab 3: Frameworks Ranking */}
          {activeTab === 'frameworks' && (
            <div className="card" style={{ padding: 16 }}>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  marginBottom: 12,
                  color: 'var(--text-primary)'
                }}
              >
                第三方与内部动态库 (Frameworks) 体积排行
              </div>

              {filteredFrameworks.length === 0 ? (
                <div
                  style={{
                    textAlign: 'center',
                    padding: 24,
                    color: 'var(--text-muted)',
                    fontSize: 12
                  }}
                >
                  未包含或未找到匹配的 Framework
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {filteredFrameworks.map((fw, idx) => {
                    const isHeavy = fw.size > 5 * 1024 * 1024
                    return (
                      <div
                        key={idx}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '8px 12px',
                          background: 'var(--bg-elevated)',
                          borderRadius: 'var(--radius-sm)',
                          borderLeft: `3px solid ${fw.isDebug ? 'var(--accent-red)' : isHeavy ? 'var(--accent-amber)' : 'var(--accent-purple)'}`
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ fontSize: 11, color: 'var(--text-muted)', width: 20 }}>
                            #{idx + 1}
                          </span>
                          <span
                            style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}
                          >
                            {fw.name}
                          </span>
                          {fw.isDylib && (
                            <span
                              className="badge"
                              style={{
                                background: 'var(--accent-blue-dim)',
                                color: 'var(--accent-blue)',
                                fontSize: 9
                              }}
                            >
                              .dylib 动态库
                            </span>
                          )}
                          {fw.isDebug && (
                            <span
                              className="badge"
                              style={{
                                background: 'rgba(239, 68, 68, 0.15)',
                                color: 'var(--accent-red)',
                                fontSize: 9,
                                fontWeight: 600
                              }}
                            >
                              🚨 Debug 调试版
                            </span>
                          )}
                          {isHeavy && !fw.isDebug && (
                            <span
                              className="badge"
                              style={{
                                background: 'var(--accent-amber-dim)',
                                color: 'var(--accent-amber)',
                                fontSize: 9
                              }}
                            >
                              超大库 &gt; 5MB
                            </span>
                          )}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <span
                            style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}
                          >
                            {fw.formattedSize}
                          </span>
                          <span
                            style={{
                              fontSize: 11,
                              color: 'var(--text-muted)',
                              width: 60,
                              textAlign: 'right'
                            }}
                          >
                            占库 {fw.percent}%
                          </span>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => setInspectingFile(fw)}
                            style={{ fontSize: 10, height: 22, padding: '0 6px', gap: 4 }}
                          >
                            <span>🔬</span>
                            <span>深度剖析</span>
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Tab 4: All Files with Deep Category Filter */}
          {activeTab === 'files' && (
            <div className="card" style={{ padding: 16 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 12,
                  flexWrap: 'wrap',
                  gap: 8
                }}
              >
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                    全量资产文件深度检索与穿透
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                    支持按分类快速筛选，点击分类药丸即可过滤出目标资源
                  </div>
                </div>

                {/* Category Pills Filter */}
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  <button
                    className={`btn btn-sm ${selectedCategoryFilter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setSelectedCategoryFilter('all')}
                    style={{ fontSize: 10, height: 24, padding: '0 8px' }}
                  >
                    全部
                  </button>
                  {Object.entries(CATEGORY_NAMES).map(([k, label]) => (
                    <button
                      key={k}
                      className={`btn btn-sm ${selectedCategoryFilter === k ? 'btn-primary' : 'btn-ghost'}`}
                      onClick={() => setSelectedCategoryFilter(k)}
                      style={{ fontSize: 10, height: 24, padding: '0 6px' }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {selectedCategoryFilter !== 'all' && (
                <div
                  style={{
                    padding: '6px 12px',
                    background: 'var(--accent-blue-dim)',
                    color: 'var(--accent-blue)',
                    fontSize: 11,
                    borderRadius: 4,
                    marginBottom: 10,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}
                >
                  <span>
                    当前正筛选查看：
                    <strong>
                      {CATEGORY_NAMES[selectedCategoryFilter] || selectedCategoryFilter}
                    </strong>{' '}
                    下的文件清单 (共 {filteredFiles.length} 个)
                  </span>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => setSelectedCategoryFilter('all')}
                    style={{ fontSize: 10, height: 20, padding: '0 6px' }}
                  >
                    清除筛选
                  </button>
                </div>
              )}

              {filteredFiles.length === 0 ? (
                <div
                  style={{
                    textAlign: 'center',
                    padding: 24,
                    color: 'var(--text-muted)',
                    fontSize: 12
                  }}
                >
                  无匹配文件
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {filteredFiles.slice(0, 100).map((file, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '6px 10px',
                        background: 'var(--bg-elevated)',
                        borderRadius: 'var(--radius-sm)'
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          overflow: 'hidden',
                          minWidth: 0,
                          flex: 1
                        }}
                      >
                        <span
                          style={{
                            fontSize: 10,
                            color: 'var(--text-muted)',
                            width: 24,
                            flexShrink: 0
                          }}
                        >
                          #{idx + 1}
                        </span>
                        <span
                          className="badge"
                          style={{
                            fontSize: 9,
                            flexShrink: 0,
                            background: `${CATEGORY_COLORS[file.type] || '#64748b'}20`,
                            color: CATEGORY_COLORS[file.type] || 'var(--text-secondary)'
                          }}
                        >
                          {CATEGORY_NAMES[file.type] || file.type}
                        </span>
                        {file.isDebug && (
                          <span
                            className="badge"
                            style={{
                              background: 'rgba(239, 68, 68, 0.15)',
                              color: 'var(--accent-red)',
                              fontSize: 9,
                              fontWeight: 600,
                              flexShrink: 0
                            }}
                          >
                            🚨 Debug 调试库
                          </span>
                        )}
                        <span
                          style={{
                            fontSize: 11,
                            fontFamily: 'monospace',
                            color: 'var(--text-primary)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}
                          title={file.path}
                        >
                          {file.path}
                        </span>
                      </div>

                      <div
                        style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}
                      >
                        <span
                          style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)' }}
                        >
                          {file.formattedSize}
                        </span>
                        <span
                          style={{
                            fontSize: 10,
                            color: 'var(--text-muted)',
                            width: 44,
                            textAlign: 'right'
                          }}
                        >
                          {file.percent}%
                        </span>
                        {(file.machOInfo ||
                          file.ext === '.dylib' ||
                          file.type === 'executable' ||
                          file.type === 'frameworks') && (
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => setInspectingFile(file)}
                            style={{ fontSize: 10, height: 22, padding: '0 6px', gap: 3 }}
                            title="深度查看 Mach-O 内部代码段、数据段、符号表与依赖库"
                          >
                            <span>🔬</span>
                            <span>剖析</span>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  {filteredFiles.length > 100 && (
                    <div
                      style={{
                        textAlign: 'center',
                        padding: 8,
                        fontSize: 11,
                        color: 'var(--text-muted)'
                      }}
                    >
                      仅展示前 100 个最大文件（已包含绝大部分体积）
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Tab 5: Optimization Recommendations */}
          {activeTab === 'recommendations' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {analysisResult.recommendations.map((rec, idx) => {
                let borderCol = 'var(--accent-green)'
                let bgCol = 'rgba(16, 185, 129, 0.08)'
                let icon = '✅'

                if (rec.type === 'danger') {
                  borderCol = 'var(--accent-red)'
                  bgCol = 'rgba(239, 68, 68, 0.08)'
                  icon = '🚨'
                } else if (rec.type === 'warning' || rec.type === 'caution') {
                  borderCol = 'var(--accent-amber)'
                  bgCol = 'rgba(245, 158, 11, 0.08)'
                  icon = '⚠️'
                }

                return (
                  <div
                    key={idx}
                    className="card"
                    style={{
                      padding: 16,
                      borderLeft: `4px solid ${borderCol}`,
                      background: bgCol
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <span style={{ fontSize: 16 }}>{icon}</span>
                      <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                        {rec.title}
                      </span>
                    </div>

                    <div
                      style={{
                        fontSize: 12,
                        color: 'var(--text-primary)',
                        marginBottom: 8,
                        lineHeight: 1.5
                      }}
                    >
                      {rec.desc}
                    </div>

                    {rec.impact && (
                      <div style={{ fontSize: 11, color: 'var(--accent-blue)', marginBottom: 4 }}>
                        <strong>预计影响：</strong> {rec.impact}
                      </div>
                    )}

                    <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                      <strong>建议方案：</strong> {rec.solution}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* 6. Mach-O Binary Deep Inspection Modal */}
      {inspectingFile && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(4px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20
          }}
          onClick={() => setInspectingFile(null)}
        >
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: 760,
              maxHeight: '88vh',
              overflowY: 'auto',
              padding: 24,
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: 12
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 10,
                    background: inspectingFile.isDebug
                      ? 'rgba(239, 68, 68, 0.15)'
                      : 'var(--accent-purple-dim)',
                    color: inspectingFile.isDebug ? 'var(--accent-red)' : 'var(--accent-purple)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 22,
                    flexShrink: 0
                  }}
                >
                  🔬
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
                      {inspectingFile.name}
                    </span>
                    {inspectingFile.isDebug && (
                      <span
                        className="badge"
                        style={{
                          background: 'rgba(239, 68, 68, 0.15)',
                          color: 'var(--accent-red)',
                          fontSize: 10
                        }}
                      >
                        🚨 Debug 调试版动态库
                      </span>
                    )}
                    <span className="badge badge-gray" style={{ fontSize: 10 }}>
                      {inspectingFile.machOInfo?.architectures?.join(', ') || 'arm64'}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                    相对路径: <code>{inspectingFile.path}</code> · 体积:{' '}
                    <strong>{inspectingFile.formattedSize}</strong> ({inspectingFile.percent}%
                    全包占比)
                  </div>
                </div>
              </div>

              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setInspectingFile(null)}
                style={{ fontSize: 16, width: 28, height: 28, padding: 0 }}
              >
                ✕
              </button>
            </div>

            {/* Debug Root Cause Diagnostic Box */}
            {(inspectingFile.isDebug || inspectingFile.name.toLowerCase().includes('debug')) && (
              <div
                style={{
                  padding: 16,
                  borderRadius: 'var(--radius-md)',
                  background: 'rgba(239, 68, 68, 0.08)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 18 }}>🚨</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-red)' }}>
                    深度根因诊断：为什么该动态库高达 {inspectingFile.formattedSize}？
                  </span>
                </div>

                <div style={{ fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.6 }}>
                  该文件包含 <strong>.debug</strong> 标识，是由于在 <strong>Debug 模式</strong>{' '}
                  下直接编译并打包入 IPA 所致：
                </div>

                <div
                  style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 11 }}
                >
                  <div
                    style={{
                      padding: 10,
                      background: 'var(--bg-card)',
                      borderRadius: 6,
                      border: '1px solid var(--border)'
                    }}
                  >
                    <div style={{ fontWeight: 600, color: 'var(--accent-red)', marginBottom: 4 }}>
                      1. 未剥离 DWARF 调试符号 (占 60%~80%)
                    </div>
                    <div style={{ color: 'var(--text-secondary)' }}>
                      包含完整源代码路径、行号表、函数内部局部变量定义与 AST 类型元数据，未执行
                      strip 剥离。
                    </div>
                  </div>

                  <div
                    style={{
                      padding: 10,
                      background: 'var(--bg-card)',
                      borderRadius: 6,
                      border: '1px solid var(--border)'
                    }}
                  >
                    <div style={{ fontWeight: 600, color: 'var(--accent-red)', marginBottom: 4 }}>
                      2. 未开启编译器最高优化 (-O0)
                    </div>
                    <div style={{ color: 'var(--text-secondary)' }}>
                      Debug 模式默认禁用内联与死代码删除 (Dead Code
                      Elimination)，保留了所有未调用的冗余指令。
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    padding: '8px 12px',
                    background: 'var(--bg-card)',
                    borderRadius: 6,
                    border: '1px solid var(--border)',
                    fontSize: 11,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: 8
                  }}
                >
                  <div>
                    <span style={{ color: 'var(--accent-green)', fontWeight: 600 }}>
                      💡 预期瘦身效果：
                    </span>
                    <span style={{ color: 'var(--text-primary)' }}>
                      切换为 Release 或执行符号剥离后，该库体积预计将缩减至{' '}
                      <strong>10MB ~ 15MB</strong> (直接减负约 35MB~40MB)！
                    </span>
                  </div>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => {
                      navigator.clipboard.writeText(`xcrun strip -x "${inspectingFile.name}"`)
                      showToast?.('✓ 已复制终端 strip 剥离命令')
                    }}
                    style={{ fontSize: 10, height: 24, flexShrink: 0, gap: 4 }}
                  >
                    <span>📋</span>
                    <span>复制 Strip 命令</span>
                  </button>
                </div>
              </div>
            )}

            {/* Mach-O Segments Breakdown (if available) */}
            {inspectingFile.machOInfo?.segments?.length > 0 ? (
              <>
                <div>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                      marginBottom: 8
                    }}
                  >
                    Mach-O 二进制段 (Segments) 体积分布
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      height: 16,
                      borderRadius: 'var(--radius-sm)',
                      overflow: 'hidden',
                      background: 'var(--bg-elevated)',
                      marginBottom: 10
                    }}
                  >
                    {inspectingFile.machOInfo.segments.map((seg, sIdx) => {
                      const colors = [
                        '#3b82f6',
                        '#8b5cf6',
                        '#6366f1',
                        '#f59e0b',
                        '#ef4444',
                        '#10b981'
                      ]
                      return (
                        <div
                          key={sIdx}
                          title={`${seg.name}: ${seg.formattedSize} (${seg.percent}%)`}
                          style={{
                            width: `${seg.percent}%`,
                            background: colors[sIdx % colors.length],
                            transition: 'width 200ms ease'
                          }}
                        />
                      )
                    })}
                  </div>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                      gap: 8
                    }}
                  >
                    {inspectingFile.machOInfo.segments.map((seg, sIdx) => (
                      <div
                        key={sIdx}
                        style={{
                          padding: '8px 10px',
                          background: 'var(--bg-elevated)',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: 11
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            fontWeight: 600,
                            marginBottom: 2
                          }}
                        >
                          <code>{seg.name}</code>
                          <span style={{ color: 'var(--text-primary)' }}>
                            {seg.formattedSize} ({seg.percent}%)
                          </span>
                        </div>
                        <div style={{ color: 'var(--text-muted)', fontSize: 10 }}>{seg.desc}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Top Sections Breakdown */}
                {inspectingFile.machOInfo?.topSections?.length > 0 && (
                  <div>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: 'var(--text-primary)',
                        marginBottom: 8
                      }}
                    >
                      核心节 (Sections) 细分排行
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {inspectingFile.machOInfo.topSections.map((sec, secIdx) => (
                        <div
                          key={secIdx}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '6px 10px',
                            background: 'var(--bg-elevated)',
                            borderRadius: 'var(--radius-sm)',
                            fontSize: 11
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 10, color: 'var(--text-muted)', width: 20 }}>
                              #{secIdx + 1}
                            </span>
                            <code style={{ fontWeight: 700, color: 'var(--accent-blue)' }}>
                              {sec.name}
                            </code>
                            <span className="badge badge-gray" style={{ fontSize: 9 }}>
                              {sec.segment}
                            </span>
                            <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>
                              {sec.desc}
                            </span>
                          </div>
                          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                            {sec.formattedSize}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Linked Libraries */}
                {inspectingFile.machOInfo?.linkedLibraries?.length > 0 && (
                  <div>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: 'var(--text-primary)',
                        marginBottom: 6
                      }}
                    >
                      依赖的动态库与系统框架 ({inspectingFile.machOInfo.linkedLibraries.length} 个)
                    </div>
                    <div
                      style={{
                        maxHeight: 120,
                        overflowY: 'auto',
                        padding: 8,
                        background: 'var(--bg-elevated)',
                        borderRadius: 'var(--radius-sm)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 4
                      }}
                    >
                      {inspectingFile.machOInfo.linkedLibraries.map((lib, lIdx) => (
                        <div
                          key={lIdx}
                          style={{
                            fontSize: 10,
                            fontFamily: 'monospace',
                            color: 'var(--text-muted)'
                          }}
                        >
                          • {lib}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div
                style={{
                  padding: 16,
                  background: 'var(--bg-elevated)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: 12,
                  color: 'var(--text-muted)'
                }}
              >
                该二进制在解压临时分析目录中已归档，建议查看上方针对该库的剥离优化建议。
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

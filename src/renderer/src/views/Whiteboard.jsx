import { useState, useRef, useCallback } from 'react'
import {
  Excalidraw,
  convertToExcalidrawElements,
  exportToBlob,
  exportToSvg
} from '@excalidraw/excalidraw'
import '@excalidraw/excalidraw/index.css'
import AiDiagramModal from '../components/AiDiagramModal'

const STORAGE_KEY = 'flywork_whiteboard_scene_v1'

function getInitialData() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const parsed = JSON.parse(saved)
      return {
        elements: parsed.elements || [],
        appState: {
          ...(parsed.appState || {}),
          theme: 'dark'
        },
        files: parsed.files || {}
      }
    }
  } catch (e) {
    console.warn('Failed to parse saved whiteboard data', e)
  }
  return {
    appState: {
      theme: 'dark',
      viewBackgroundColor: '#121212'
    }
  }
}

export default function Whiteboard() {
  const [excalidrawAPI, setExcalidrawAPI] = useState(null)
  const [aiModalOpen, setAiModalOpen] = useState(false)
  const [exportMenuOpen, setExportMenuOpen] = useState(false)
  const [theme, setTheme] = useState('dark')
  const [toastMsg, setToastMsg] = useState('')
  const [initialData] = useState(() => getInitialData())
  const [currentMermaid, setCurrentMermaid] = useState(() => {
    return localStorage.getItem('flywork_whiteboard_active_mermaid') || ''
  })
  const saveTimerRef = useRef(null)

  const handleUpdateMermaid = (code) => {
    setCurrentMermaid(code)
    try {
      localStorage.setItem('flywork_whiteboard_active_mermaid', code)
    } catch (e) {
      console.warn('Failed to save mermaid code', e)
    }
  }

  // 提示 Toast
  const showToast = (msg) => {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(''), 3000)
  }

  // 自动防抖保存当前画布（含 elements、appState 和 files）
  const handleSceneChange = useCallback(
    (elements, appState) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      saveTimerRef.current = setTimeout(() => {
        try {
          const toSave = {
            elements: elements.filter((el) => !el.isDeleted),
            appState: {
              viewBackgroundColor: appState.viewBackgroundColor,
              theme: appState.theme
            },
            files: excalidrawAPI ? excalidrawAPI.getFiles() : {}
          }
          localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave))
        } catch (err) {
          console.warn('Auto-save error:', err)
        }
      }, 1000)
    },
    [excalidrawAPI]
  )

  // 插入 AI 生成的图元
  const handleInsertElements = useCallback(
    ({ elements, files, isRefine }) => {
      if (!excalidrawAPI) return

      // Mermaid 解析出来的只是骨架 (Skeleton)，通过官方转换器生成原生图元
      // 保持 Mermaid 布局引擎 (Dagre) 严丝合缝计算出的节点与连线拓扑几何坐标，杜绝坐标偏移导致连线穿透
      const convertedElements = convertToExcalidrawElements(elements || [], {
        regenerateIds: false
      })

      if (!convertedElements || convertedElements.length === 0) {
        showToast('未能生成有效图元')
        return
      }

      let positionedElements = convertedElements
      let mergedElements = []

      if (isRefine) {
        // 如果是增量完善，直接用最新全量更新图元替换，保持连贯性
        positionedElements = convertedElements
        mergedElements = convertedElements
      } else {
        const currentElements = excalidrawAPI.getSceneElements() || []
        let offsetY = 0
        if (currentElements.length > 0) {
          const maxY = currentElements.reduce(
            (max, el) => Math.max(max, el.y + (el.height || 0)),
            0
          )
          offsetY = maxY + 80
        }
        positionedElements = convertedElements.map((el) => ({
          ...el,
          y: el.y + offsetY
        }))
        mergedElements = [...currentElements, ...positionedElements]
      }

      if (files) {
        excalidrawAPI.addFiles(Object.values(files))
      }

      // 将新生成的元素设为初始选中态，触发 Excalidraw 内部的文本自动对齐与测量，彻底消除遮挡
      const selectedIds = {}
      positionedElements.forEach((el) => {
        selectedIds[el.id] = true
      })

      excalidrawAPI.updateScene({
        elements: mergedElements,
        appState: {
          selectedElementIds: selectedIds
        },
        commitToHistory: true
      })

      setTimeout(() => {
        try {
          excalidrawAPI.scrollToContent(positionedElements, {
            fitToViewport: true,
            viewportZoomFactor: 0.8
          })
        } catch (e) {
          console.warn('Scroll to content failed', e)
        }
      }, 50)

      showToast(
        isRefine
          ? `已成功增量完善架构图（${positionedElements.length} 个图元）！`
          : `已成功插入 ${positionedElements.length} 个手绘图元！`
      )
    },
    [excalidrawAPI]
  )

  // 清空画布
  const handleClear = () => {
    if (!excalidrawAPI) return
    if (window.confirm('确定要清空画布上的所有图形吗？')) {
      excalidrawAPI.resetScene()
      localStorage.removeItem(STORAGE_KEY)
      localStorage.removeItem('flywork_whiteboard_active_mermaid')
      setCurrentMermaid('')
      showToast('画布已清空')
    }
  }

  // 导出 PNG 图片
  const handleExportPng = async () => {
    setExportMenuOpen(false)
    if (!excalidrawAPI) return
    const elements = (excalidrawAPI.getSceneElements() || []).filter((el) => !el.isDeleted)
    if (elements.length === 0) {
      showToast('画布上没有图形，无需导出')
      return
    }

    try {
      showToast('正在生成 PNG 图片...')
      const blob = await exportToBlob({
        elements,
        appState: {
          ...excalidrawAPI.getAppState(),
          exportWithDarkMode: theme === 'dark'
        },
        files: excalidrawAPI.getFiles(),
        mimeType: 'image/png',
        quality: 1,
        exportPadding: 24
      })

      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `flywork-diagram-${new Date().toISOString().slice(0, 10)}.png`
      link.click()
      URL.revokeObjectURL(url)
      showToast('已成功导出 PNG 图片！')
    } catch (err) {
      console.error('Export PNG error:', err)
      showToast(`导出 PNG 失败: ${err.message}`)
    }
  }

  // 导出 SVG 矢量图片
  const handleExportSvg = async () => {
    setExportMenuOpen(false)
    if (!excalidrawAPI) return
    const elements = (excalidrawAPI.getSceneElements() || []).filter((el) => !el.isDeleted)
    if (elements.length === 0) {
      showToast('画布上没有图形，无需导出')
      return
    }

    try {
      showToast('正在生成 SVG 矢量图...')
      const svg = await exportToSvg({
        elements,
        appState: {
          ...excalidrawAPI.getAppState(),
          exportWithDarkMode: theme === 'dark'
        },
        files: excalidrawAPI.getFiles(),
        exportPadding: 24
      })

      const svgString = new XMLSerializer().serializeToString(svg)
      const blob = new Blob([svgString], { type: 'image/svg+xml' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `flywork-diagram-${new Date().toISOString().slice(0, 10)}.svg`
      link.click()
      URL.revokeObjectURL(url)
      showToast('已成功导出 SVG 矢量图！')
    } catch (err) {
      console.error('Export SVG error:', err)
      showToast(`导出 SVG 失败: ${err.message}`)
    }
  }

  // 导出 JSON 工程文件
  const handleExportJson = () => {
    setExportMenuOpen(false)
    if (!excalidrawAPI) return
    const elements = excalidrawAPI.getSceneElements()
    const appState = excalidrawAPI.getAppState()
    const data = JSON.stringify({ elements, appState }, null, 2)

    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `flywork-diagram-${new Date().toISOString().slice(0, 10)}.excalidraw`
    link.click()
    URL.revokeObjectURL(url)
    showToast('已导出为 .excalidraw 工程文件')
  }

  // 切换主题
  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark'
    setTheme(nextTheme)
    if (excalidrawAPI) {
      excalidrawAPI.updateScene({
        appState: {
          theme: nextTheme,
          viewBackgroundColor: nextTheme === 'dark' ? '#121212' : '#ffffff'
        }
      })
    }
  }

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        background: 'var(--bg-base)',
        overflow: 'hidden'
      }}
    >
      {/* 顶部控制栏 */}
      <div
        style={{
          height: 48,
          padding: '0 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid var(--border)',
          background: 'var(--bg-surface)',
          zIndex: 10,
          flexShrink: 0
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 16 }}>🎨</span>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
              画板 / 架构图
            </span>
          </div>
          <span
            style={{
              fontSize: 11,
              padding: '2px 8px',
              borderRadius: 'var(--radius-full)',
              background: 'var(--accent-purple-dim)',
              color: 'var(--accent-purple)',
              fontWeight: 500
            }}
          >
            Excalidraw Native
          </span>
        </div>

        {/* 顶部操作区 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* ✨ AI 绘图核心按钮 */}
          <button
            onClick={() => setAiModalOpen(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 14px',
              borderRadius: 6,
              border: 'none',
              background: 'linear-gradient(135deg, #a371f7, #4f9ef8)',
              color: '#fff',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(79, 158, 248, 0.35)',
              transition: 'transform 0.1s ease'
            }}
            onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.97)')}
            onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
          >
            <span>✨</span>
            <span>AI 智能绘图</span>
          </button>

          <button
            onClick={toggleTheme}
            title="切换暗黑/明亮主题"
            style={{
              padding: '6px 10px',
              borderRadius: 6,
              border: '1px solid var(--border)',
              background: 'var(--bg-elevated)',
              color: 'var(--text-secondary)',
              fontSize: 12,
              cursor: 'pointer'
            }}
          >
            {theme === 'dark' ? '☀️ 明亮' : '🌙 暗黑'}
          </button>

          {/* 导出菜单 */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setExportMenuOpen(!exportMenuOpen)}
              title="导出图片或工程文件"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '6px 12px',
                borderRadius: 6,
                border: '1px solid var(--border)',
                background: 'var(--bg-elevated)',
                color: 'var(--text-primary)',
                fontSize: 12,
                cursor: 'pointer'
              }}
            >
              <span>📥 导出</span>
              <span style={{ fontSize: 10, opacity: 0.7 }}>{exportMenuOpen ? '▲' : '▼'}</span>
            </button>

            {exportMenuOpen && (
              <>
                <div
                  style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    zIndex: 99
                  }}
                  onClick={() => setExportMenuOpen(false)}
                />
                <div
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 6px)',
                    right: 0,
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
                    zIndex: 100,
                    minWidth: 170,
                    padding: '6px 0',
                    animation: 'fadeIn 0.15s ease'
                  }}
                >
                  <button
                    onClick={handleExportPng}
                    style={{
                      width: '100%',
                      padding: '8px 14px',
                      background: 'transparent',
                      border: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      color: 'var(--text-primary)',
                      fontSize: 12,
                      cursor: 'pointer',
                      textAlign: 'left'
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <span>🖼️</span>
                    <span>导出 PNG 图片</span>
                  </button>

                  <button
                    onClick={handleExportSvg}
                    style={{
                      width: '100%',
                      padding: '8px 14px',
                      background: 'transparent',
                      border: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      color: 'var(--text-primary)',
                      fontSize: 12,
                      cursor: 'pointer',
                      textAlign: 'left'
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <span>📐</span>
                    <span>导出 SVG 矢量图</span>
                  </button>

                  <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />

                  <button
                    onClick={handleExportJson}
                    style={{
                      width: '100%',
                      padding: '8px 14px',
                      background: 'transparent',
                      border: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      color: 'var(--text-secondary)',
                      fontSize: 12,
                      cursor: 'pointer',
                      textAlign: 'left'
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <span>📄</span>
                    <span>导出 .excalidraw 工程</span>
                  </button>
                </div>
              </>
            )}
          </div>

          <button
            onClick={handleClear}
            title="清空画布"
            style={{
              padding: '6px 10px',
              borderRadius: 6,
              border: '1px solid var(--border)',
              background: 'var(--bg-elevated)',
              color: 'var(--text-danger)',
              fontSize: 12,
              cursor: 'pointer'
            }}
          >
            清空
          </button>
        </div>
      </div>

      {/* Excalidraw 画布渲染区域 */}
      <div
        style={{
          flex: 1,
          width: '100%',
          height: 'calc(100% - 48px)',
          position: 'relative'
        }}
      >
        <Excalidraw
          excalidrawAPI={(api) => setExcalidrawAPI(api)}
          initialData={initialData}
          onChange={handleSceneChange}
          theme={theme}
          UIOptions={{
            canvasActions: {
              changeViewBackgroundColor: true,
              clearCanvas: false,
              loadScene: true,
              saveToActiveFile: true,
              theme: true
            }
          }}
        />
      </div>

      {/* AI 绘图弹窗 */}
      <AiDiagramModal
        isOpen={aiModalOpen}
        onClose={() => setAiModalOpen(false)}
        onInsertElements={handleInsertElements}
        currentMermaid={currentMermaid}
        onUpdateCurrentMermaid={handleUpdateMermaid}
      />

      {/* Toast 提示 */}
      {toastMsg && (
        <div
          style={{
            position: 'absolute',
            bottom: 24,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(28, 35, 51, 0.95)',
            border: '1px solid var(--border-active)',
            color: 'var(--text-primary)',
            padding: '8px 16px',
            borderRadius: 8,
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
            fontSize: 13,
            fontWeight: 500,
            zIndex: 100,
            pointerEvents: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            animation: 'fadeIn 0.2s ease'
          }}
        >
          <span>💡</span>
          <span>{toastMsg}</span>
        </div>
      )}
    </div>
  )
}

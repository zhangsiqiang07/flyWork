/* eslint-disable react/prop-types */
import { useState, useEffect, useMemo } from 'react'
import { PROMPT_PLATFORMS, compilePromptForShot } from '../data/mockDramaProjects'
import {
  loadDramaProjects,
  saveDramaProjects,
  getActiveProjectId,
  setActiveProjectId,
  updateShotInProject
} from '../utils/dramaStorage'
import { loadVideoTasks, saveVideoTasks } from '../utils/videoStorage'

export default function VideoStudio({ workspaces = [], onOpenWorkspace, onAddNewWorkspace }) {
  // === 模式切换：'pipeline' (短剧项目工坊 - 主流红果模式) | 'lab' (单片快速实验室) ===
  const [studioMode, setStudioMode] = useState('pipeline')

  // === 短剧项目系统状态 ===
  const [dramaProjects, setDramaProjects] = useState(() => loadDramaProjects())
  const [activeProjectId, setCurrentActiveProjectId] = useState(() =>
    getActiveProjectId(loadDramaProjects())
  )
  const [activeDramaTab, setActiveDramaTab] = useState('tasks') // 'story' | 'characters' | 'script' | 'tasks' | 'timeline'
  const [selectedEpisodeId, setSelectedEpisodeId] = useState('EP01')
  const [selectedShotId, setSelectedShotId] = useState('EP01-SC01-SH004')
  const [promptPlatform, setPromptPlatform] = useState('seedance')

  // 新建短剧项目弹窗状态
  const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')
  const [newProjectGenre, setNewProjectGenre] = useState('都市 / 豪门复仇 / 爽剧')
  const [newProjectFormat, setNewProjectFormat] = useState('9:16')
  const [newProjectEpisodes, setNewProjectEpisodes] = useState(80)
  const [workspaceOption, setWorkspaceOption] = useState('create_new') // 'create_new' | 'link_existing'
  const [selectedExistingWsId, setSelectedExistingWsId] = useState(workspaces[0]?.id || '')

  // 外部素材拖拽回填 URL 状态
  const [backfillUrlInput, setBackfillUrlInput] = useState('')
  const [isLocalGenerating, setIsLocalGenerating] = useState(false)
  const [localGenProgress, setLocalGenProgress] = useState(0)

  // === 单片实验室系统状态 (保留原有能力) ===
  const [labPrompt, setLabPrompt] = useState(
    'Ultra high definition product demo, a sleek futuristic iOS mobile application interface with glowing glassmorphism cards, fluid spring animations, dynamic island expanding, neon light reflections on dark titanium body, cinematic lighting, 60fps.'
  )
  const [labTasks, setLabTasks] = useState(() => loadVideoTasks())

  // 通用状态
  const [toastMsg, setToastMsg] = useState('')

  // 提示 Toast
  const showToast = (msg) => {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(''), 2600)
  }

  // 持久化短剧项目
  useEffect(() => {
    saveDramaProjects(dramaProjects)
  }, [dramaProjects])

  // 持久化单片任务
  useEffect(() => {
    saveVideoTasks(labTasks)
  }, [labTasks])

  // 当前激活短剧项目
  const currentProject = useMemo(() => {
    return dramaProjects.find((p) => p.id === activeProjectId) || dramaProjects[0] || null
  }, [dramaProjects, activeProjectId])

  // 关联的工作空间
  const linkedWorkspace = useMemo(() => {
    if (!currentProject?.workspaceId) return null
    return workspaces.find((w) => w.id === currentProject.workspaceId) || null
  }, [workspaces, currentProject])

  // 当前激活剧集
  const currentEpisode = useMemo(() => {
    if (!currentProject?.episodes) return null
    return (
      currentProject.episodes.find((ep) => ep.id === selectedEpisodeId) ||
      currentProject.episodes[0] ||
      null
    )
  }, [currentProject, selectedEpisodeId])

  // 当前剧集内所有镜头列表展平
  const allShotsInEpisode = useMemo(() => {
    if (!currentEpisode?.scenes) return []
    const list = []
    currentEpisode.scenes.forEach((sc) => {
      ;(sc.shots || []).forEach((sh) => {
        list.push({ ...sh, sceneNumber: sc.sceneNumber, location: sc.location })
      })
    })
    return list
  }, [currentEpisode])

  // 当前选中的 Shot
  const currentShot = useMemo(() => {
    if (!allShotsInEpisode.length) return null
    return allShotsInEpisode.find((sh) => sh.id === selectedShotId) || allShotsInEpisode[0]
  }, [allShotsInEpisode, selectedShotId])

  // 当前 Shot 关联的角色
  const shotCharacter = useMemo(() => {
    if (!currentShot?.characterId || !currentProject?.characters) return null
    return currentProject.characters.find((c) => c.id === currentShot.characterId) || null
  }, [currentShot, currentProject])

  // 编译后的 Prompt
  const compiledPrompt = useMemo(() => {
    if (!currentShot) return ''
    return compilePromptForShot(currentShot, shotCharacter, currentProject, promptPlatform)
  }, [currentShot, shotCharacter, currentProject, promptPlatform])

  // 项目总镜头统计
  const projectStats = useMemo(() => {
    if (!currentProject?.episodes) return { total: 0, completed: 0, percentage: 0 }
    let total = 0
    let completed = 0
    currentProject.episodes.forEach((ep) => {
      ;(ep.scenes || []).forEach((sc) => {
        ;(sc.shots || []).forEach((sh) => {
          total++
          if (sh.status === 'COMPLETED') completed++
        })
      })
    })
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0
    return { total, completed, percentage }
  }, [currentProject])

  // 切换短剧项目
  const handleSelectProject = (projId) => {
    setCurrentActiveProjectId(projId)
    setActiveProjectId(projId)
    showToast(`已切换至项目：${dramaProjects.find((p) => p.id === projId)?.name}`)
  }

  // 新建短剧项目
  const handleCreateProjectSubmit = async () => {
    if (!newProjectName.trim()) {
      showToast('请输入短剧项目名称')
      return
    }

    let finalWorkspaceId = null
    let finalWorkspaceRoot = null

    if (workspaceOption === 'create_new') {
      try {
        if (window.flywork?.dramaCreateWorkspace) {
          const res = await window.flywork.dramaCreateWorkspace({
            projectName: newProjectName.trim()
          })
          if (res.success && res.workspace) {
            finalWorkspaceId = res.workspace.id
            finalWorkspaceRoot = res.folderPath
            if (onAddNewWorkspace) {
              onAddNewWorkspace(res.workspace)
            }
          }
        }
      } catch (err) {
        console.error('Failed to create workspace on disk', err)
      }
    } else if (workspaceOption === 'link_existing' && selectedExistingWsId) {
      finalWorkspaceId = selectedExistingWsId
      const targetWs = workspaces.find((w) => w.id === selectedExistingWsId)
      if (targetWs) finalWorkspaceRoot = targetWs.root
    }

    const newProj = {
      id: `proj-${Date.now()}`,
      name: newProjectName.trim(),
      platform: '红果短剧',
      format: newProjectFormat,
      genre: newProjectGenre,
      totalEpisodes: newProjectEpisodes,
      currentEpisodeIndex: 1,
      coverUrl:
        'https://images.unsplash.com/photo-1518791841217-8f162f1e1131?w=800&auto=format&fit=crop&q=80',
      workspaceId: finalWorkspaceId,
      workspaceRoot: finalWorkspaceRoot,
      updatedAt: Date.now(),
      storyBible: {
        tagline: '一段震撼人心的全新短剧故事，充满反转与爽点。',
        worldview: '宏大世界观设定...',
        coreTropes: ['逆袭打脸', '双强联手', '极致爽感'],
        plotPhases: [
          { phase: '起 (EP01~10)', title: '入局', desc: '主角身陷绝境破局' },
          { phase: '承 (EP11~35)', title: '崛起', desc: '展露锋芒逐步反扑' },
          { phase: '转合 (EP36~80)', title: '巅峰', desc: '终极对决问鼎巅峰' }
        ],
        secrets: ['核心秘密：身世之谜与幕后黑手隐藏在祖传玉佩中。']
      },
      characters: [
        {
          id: `CHAR_${Date.now()}`,
          name: '主角',
          role: '领衔主演',
          age: 24,
          persona: '坚韧不拔，深沉冷静',
          voiceId: 'zh_female_heroine',
          voiceName: '飒爽主角音',
          avatar:
            'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80',
          outfits: [
            { id: 'OUTFIT_DEFAULT', name: '专属经典款', scene: '全局通用', desc: '现代干练高定装' }
          ],
          keyframes: []
        }
      ],
      episodes: [
        {
          id: 'EP01',
          episodeNumber: 1,
          title: '第 1 集 · 风暴前夕',
          hook: '故事第一秒的高能开场钩子。',
          climax: '本集核心冲突高潮爆发。',
          endingHook: '结尾关键悬念反转。',
          scenes: [
            {
              id: 'SC01',
              sceneNumber: 1,
              location: '核心主场景',
              time: '日',
              atmosphere: '紧张压抑',
              shots: [
                {
                  id: `EP01-SC01-SH001`,
                  shotIndex: 1,
                  name: '镜头 1 · 气氛开场',
                  shotSize: 'wide',
                  shotSizeLabel: '全景 (Wide)',
                  camera: 'zoom-in',
                  cameraLabel: '平缓推进',
                  characterId: null,
                  outfitId: null,
                  action: '环境全景快速扫过，营造开局压迫感。',
                  dialogue: '',
                  duration: 3.0,
                  status: 'PROMPT_READY',
                  keyframeUrl: '',
                  videoUrl: '',
                  notes: '请在外部网页生成或使用本地引擎'
                }
              ]
            }
          ]
        }
      ]
    }

    setDramaProjects((prev) => [newProj, ...prev])
    setCurrentActiveProjectId(newProj.id)
    setActiveProjectId(newProj.id)
    setIsNewProjectModalOpen(false)
    setNewProjectName('')
    showToast(
      `🎉 短剧项目《${newProj.name}》创建成功${finalWorkspaceRoot ? '，已绑定本地工作空间' : ''}`
    )
  }

  // 更新当前 Shot 属性或状态
  const handleUpdateCurrentShot = (updates) => {
    if (!currentShot) return
    const updated = updateShotInProject(
      dramaProjects,
      currentProject.id,
      currentEpisode.id,
      currentShot.id,
      updates
    )
    setDramaProjects(updated)
  }

  // 外部素材回填处理（拖拽文件进入）
  const handleDropBackfill = (e) => {
    e.preventDefault()
    e.stopPropagation()
    const file = e.dataTransfer?.files?.[0]
    if (!file) return

    const isVideo = file.type.startsWith('video/') || file.name.endsWith('.mp4')
    const isImage = file.type.startsWith('image/')

    const reader = new FileReader()
    reader.onload = async (event) => {
      const dataUrl = event.target.result

      // 若绑定了本地工作空间，写入物理磁盘
      if (currentProject?.workspaceRoot && window.flywork?.dramaSaveAsset) {
        try {
          const ext = isVideo ? 'mp4' : 'png'
          const relPath = `assets/shots/${currentShot.id}.${ext}`
          await window.flywork.dramaSaveAsset({
            workspaceRoot: currentProject.workspaceRoot,
            relativePath: relPath,
            base64Data: dataUrl
          })
        } catch (err) {
          console.warn('Could not write asset to disk', err)
        }
      }

      if (isVideo) {
        handleUpdateCurrentShot({
          status: 'COMPLETED',
          videoUrl: dataUrl,
          notes: '已由外部网页生成并回填完成'
        })
        showToast(`✓ 已成功回填【${currentShot.name}】视频素材，状态变更为已成片！`)
      } else if (isImage) {
        handleUpdateCurrentShot({
          status: 'VIDEO_WAITING',
          keyframeUrl: dataUrl,
          notes: '已回填关键帧分镜，等待视频片段'
        })
        showToast(`✓ 已成功回填分镜关键帧！`)
      }
    }
    reader.readAsDataURL(file)
  }

  // 粘贴网络 URL 回填
  const handleUrlBackfill = () => {
    if (!backfillUrlInput.trim()) {
      showToast('请输入素材图片或视频的有效 URL')
      return
    }
    const isVideo =
      backfillUrlInput.includes('.mp4') ||
      backfillUrlInput.includes('video') ||
      backfillUrlInput.includes('sample')

    if (isVideo) {
      handleUpdateCurrentShot({
        status: 'COMPLETED',
        videoUrl: backfillUrlInput.trim(),
        notes: '已通过 URL 回填成片'
      })
      showToast('✓ 视频素材 URL 回填成功！')
    } else {
      handleUpdateCurrentShot({
        status: 'VIDEO_WAITING',
        keyframeUrl: backfillUrlInput.trim(),
        notes: '分镜图 URL 已回填'
      })
      showToast('✓ 分镜关键帧 URL 回填成功！')
    }
    setBackfillUrlInput('')
  }

  // 模拟本地 / API 调度生成
  const handleRunLocalGen = () => {
    if (isLocalGenerating) return
    setIsLocalGenerating(true)
    setLocalGenProgress(5)
    showToast('🚀 已调度生成引擎，开始渲染镜头...')

    const interval = setInterval(() => {
      setLocalGenProgress((prev) => {
        const next = prev + Math.floor(Math.random() * 20) + 15
        if (next >= 100) {
          clearInterval(interval)
          setIsLocalGenerating(false)
          handleUpdateCurrentShot({
            status: 'COMPLETED',
            videoUrl:
              'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
            notes: '本地引擎渲染完成'
          })
          showToast(`✨ 镜头【${currentShot.name}】生成完成！`)
          return 100
        }
        return next
      })
    }, 400)
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: 'var(--bg-base)',
        color: 'var(--text-primary)',
        overflow: 'hidden'
      }}
    >
      {/* Toast 提示框 */}
      {toastMsg && (
        <div
          style={{
            position: 'fixed',
            top: 64,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--accent-blue)',
            color: 'var(--text-primary)',
            padding: '8px 18px',
            borderRadius: 'var(--radius-full)',
            fontSize: 12,
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            animation: 'fadeIn 180ms ease'
          }}
        >
          <span>✨</span>
          <span>{toastMsg}</span>
        </div>
      )}

      {/* 顶部主导航栏 */}
      <div
        style={{
          height: 52,
          padding: '0 16px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--bg-surface)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 20 }}>🎬</span>
            <span style={{ fontSize: 15, fontWeight: 700 }}>AI 短剧工坊</span>
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                padding: '2px 6px',
                borderRadius: 'var(--radius-full)',
                background: 'linear-gradient(135deg, #a371f7, #e05c5c)',
                color: '#fff'
              }}
            >
              红果原生
            </span>
          </div>

          <div style={{ height: 18, width: 1, background: 'var(--border)' }} />

          {/* 模式选择 */}
          <div
            style={{
              display: 'flex',
              background: 'var(--bg-base)',
              padding: 2,
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border)'
            }}
          >
            <button
              onClick={() => setStudioMode('pipeline')}
              style={{
                background: studioMode === 'pipeline' ? 'var(--bg-elevated)' : 'transparent',
                color: studioMode === 'pipeline' ? 'var(--text-primary)' : 'var(--text-secondary)',
                border: 'none',
                padding: '4px 10px',
                borderRadius: 'var(--radius-sm)',
                fontSize: 12,
                fontWeight: studioMode === 'pipeline' ? 600 : 400,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 5
              }}
            >
              <span>📽️</span>
              <span>短剧项目工程</span>
            </button>
            <button
              onClick={() => setStudioMode('lab')}
              style={{
                background: studioMode === 'lab' ? 'var(--bg-elevated)' : 'transparent',
                color: studioMode === 'lab' ? 'var(--text-primary)' : 'var(--text-secondary)',
                border: 'none',
                padding: '4px 10px',
                borderRadius: 'var(--radius-sm)',
                fontSize: 12,
                fontWeight: studioMode === 'lab' ? 600 : 400,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 5
              }}
            >
              <span>🧪</span>
              <span>单片实验室</span>
            </button>
          </div>
        </div>

        {/* 项目维度选择器与工作空间穿透 */}
        {studioMode === 'pipeline' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* 项目下拉选择 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>项目:</span>
              <select
                value={activeProjectId}
                onChange={(e) => handleSelectProject(e.target.value)}
                style={{
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-primary)',
                  fontSize: 12,
                  fontWeight: 600,
                  padding: '4px 8px',
                  borderRadius: 'var(--radius-md)',
                  outline: 'none',
                  cursor: 'pointer'
                }}
              >
                {dramaProjects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.totalEpisodes}集 · {p.format})
                  </option>
                ))}
              </select>
            </div>

            {/* 新建项目按钮 */}
            <button
              onClick={() => setIsNewProjectModalOpen(true)}
              style={{
                background: 'var(--accent-blue-dim)',
                border: '1px solid rgba(79,158,248,0.3)',
                color: 'var(--accent-blue)',
                padding: '4px 10px',
                borderRadius: 'var(--radius-md)',
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4
              }}
            >
              <span>+</span>
              <span>新建短剧项目</span>
            </button>

            {/* 关联的工作空间穿透徽章 */}
            {linkedWorkspace ? (
              <div
                onClick={() => onOpenWorkspace && onOpenWorkspace(linkedWorkspace.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '4px 8px',
                  background: 'rgba(163,113,247,0.1)',
                  border: '1px solid rgba(163,113,247,0.3)',
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                  fontSize: 11,
                  color: 'var(--accent-purple)'
                }}
                title={`点击直接打开本地工作空间: ${linkedWorkspace.root}`}
              >
                <span>{linkedWorkspace.icon || '📁'}</span>
                <span style={{ fontWeight: 600 }}>{linkedWorkspace.name}</span>
                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>↗</span>
              </div>
            ) : (
              <div
                style={{
                  fontSize: 11,
                  color: 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4
                }}
              >
                <span>📁 未关联空间</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 视图主体：短剧项目流水线 (Pipeline Mode) */}
      {/* ========================================================================= */}
      {studioMode === 'pipeline' && (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          {/* 项目概览信息与二级功能 Tab */}
          <div
            style={{
              padding: '10px 20px',
              borderBottom: '1px solid var(--border)',
              background: 'var(--bg-surface)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexShrink: 0
            }}
          >
            {/* 二级导航标签 */}
            <div style={{ display: 'flex', gap: 6 }}>
              {[
                { id: 'tasks', label: '🎛️ 最小任务工作台', desc: 'Shot 执行与回填' },
                { id: 'story', label: '📖 剧情设定 (Story Bible)', desc: '爽点与阶段' },
                { id: 'characters', label: '👥 角色资产 (Characters)', desc: '服化道与立绘' },
                { id: 'script', label: '🎬 剧本与分集 (Script)', desc: '80集分镜目录' },
                { id: 'timeline', label: '🎞️ 成片时间轴 (Timeline)', desc: '整集成片预览' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveDramaTab(tab.id)}
                  style={{
                    background: activeDramaTab === tab.id ? 'var(--bg-elevated)' : 'transparent',
                    border: `1px solid ${activeDramaTab === tab.id ? 'var(--accent-blue)' : 'var(--border)'}`,
                    color:
                      activeDramaTab === tab.id ? 'var(--accent-blue)' : 'var(--text-secondary)',
                    borderRadius: 'var(--radius-md)',
                    padding: '6px 14px',
                    fontSize: 12,
                    fontWeight: activeDramaTab === tab.id ? 700 : 500,
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    gap: 2,
                    transition: 'all var(--transition-fast)'
                  }}
                >
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>

            {/* 当前项目进度卡 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                  已完成镜头: {projectStats.completed} / {projectStats.total}
                </span>
                <div
                  style={{
                    width: 100,
                    height: 4,
                    background: 'var(--bg-base)',
                    borderRadius: 2,
                    overflow: 'hidden',
                    marginTop: 3
                  }}
                >
                  <div
                    style={{
                      width: `${projectStats.percentage}%`,
                      height: '100%',
                      background: 'var(--accent-green)'
                    }}
                  />
                </div>
              </div>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: 'var(--accent-green)',
                  background: 'var(--accent-green-dim)',
                  padding: '2px 8px',
                  borderRadius: 'var(--radius-full)'
                }}
              >
                {projectStats.percentage}% 成片
              </span>
            </div>
          </div>

          {/* Tab 页面切换展示 */}
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
            {/* 1. 🎛️ 最小任务工作台 (Shot Tasks & Dual Backfill) */}
            {activeDramaTab === 'tasks' && (
              <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                {/* 左列：当前集的所有 Shot 最小任务列表 */}
                <div
                  style={{
                    width: 320,
                    borderRight: '1px solid var(--border)',
                    background: 'var(--bg-surface)',
                    display: 'flex',
                    flexDirection: 'column',
                    flexShrink: 0
                  }}
                >
                  <div
                    style={{
                      padding: '12px 14px',
                      borderBottom: '1px solid var(--border)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}
                  >
                    <div style={{ fontSize: 12, fontWeight: 700 }}>
                      📑 {currentEpisode?.title || '第 1 集'} · 镜头清单
                    </div>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                      共 {allShotsInEpisode.length} 镜头
                    </span>
                  </div>

                  <div
                    style={{
                      flex: 1,
                      overflowY: 'auto',
                      padding: 8,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 6
                    }}
                  >
                    {allShotsInEpisode.map((sh) => {
                      const isSelected = sh.id === selectedShotId
                      const statusMap = {
                        COMPLETED: {
                          label: '✓ 已成片',
                          color: 'var(--accent-green)',
                          bg: 'var(--accent-green-dim)'
                        },
                        VIDEO_WAITING: {
                          label: '⏳ 待视频回填',
                          color: 'var(--accent-amber)',
                          bg: 'var(--accent-amber-dim)'
                        },
                        PROMPT_READY: {
                          label: '📝 提示词就绪',
                          color: 'var(--accent-blue)',
                          bg: 'var(--accent-blue-dim)'
                        },
                        DRAFT: {
                          label: '📄 草稿',
                          color: 'var(--text-muted)',
                          bg: 'var(--bg-base)'
                        }
                      }
                      const st = statusMap[sh.status] || statusMap.DRAFT

                      return (
                        <div
                          key={sh.id}
                          onClick={() => setSelectedShotId(sh.id)}
                          style={{
                            padding: 10,
                            borderRadius: 'var(--radius-md)',
                            background: isSelected ? 'var(--bg-elevated)' : 'var(--bg-base)',
                            border: `1px solid ${isSelected ? 'var(--accent-blue)' : 'var(--border)'}`,
                            cursor: 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 4
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center'
                            }}
                          >
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 700,
                                color: isSelected ? 'var(--accent-blue)' : 'var(--text-primary)'
                              }}
                            >
                              {sh.name}
                            </span>
                            <span
                              style={{
                                fontSize: 9,
                                padding: '1px 5px',
                                borderRadius: 3,
                                background: st.bg,
                                color: st.color,
                                fontWeight: 600
                              }}
                            >
                              {st.label}
                            </span>
                          </div>
                          <div
                            style={{
                              fontSize: 11,
                              color: 'var(--text-secondary)',
                              lineHeight: 1.3,
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden'
                            }}
                          >
                            {sh.action}
                          </div>
                          <div
                            style={{
                              display: 'flex',
                              gap: 6,
                              fontSize: 10,
                              color: 'var(--text-muted)',
                              marginTop: 2
                            }}
                          >
                            <span>{sh.shotSizeLabel}</span>
                            <span>·</span>
                            <span>{sh.cameraLabel}</span>
                            <span>·</span>
                            <span>{sh.duration}s</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* 右列：选中的 Shot 任务工作区 (Prompt 编译器 + 双模生成与回填 + 视听卡片) */}
                <div
                  style={{
                    flex: 1,
                    overflowY: 'auto',
                    padding: 24,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 20
                  }}
                >
                  {currentShot ? (
                    <>
                      {/* 头部元数据 */}
                      <div
                        style={{
                          background: 'var(--bg-surface)',
                          border: '1px solid var(--border)',
                          borderRadius: 'var(--radius-lg)',
                          padding: 16
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'flex-start'
                          }}
                        >
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ fontSize: 16, fontWeight: 800 }}>
                                {currentShot.name}
                              </span>
                              <span
                                style={{
                                  fontSize: 11,
                                  padding: '2px 6px',
                                  borderRadius: 4,
                                  background: 'var(--bg-elevated)',
                                  border: '1px solid var(--border)',
                                  color: 'var(--accent-purple)'
                                }}
                              >
                                {currentShot.id}
                              </span>
                              <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                                场景: {currentShot.location}
                              </span>
                            </div>
                            <div
                              style={{
                                fontSize: 12,
                                color: 'var(--text-secondary)',
                                marginTop: 6,
                                lineHeight: 1.5
                              }}
                            >
                              <strong>剧本动作:</strong> {currentShot.action}
                            </div>
                            {currentShot.dialogue && (
                              <div
                                style={{ fontSize: 12, color: 'var(--accent-blue)', marginTop: 4 }}
                              >
                                <strong>台词对白:</strong> “{currentShot.dialogue}”
                              </div>
                            )}
                          </div>

                          {/* 镜头规格属性 */}
                          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                            <span
                              style={{
                                fontSize: 11,
                                padding: '3px 8px',
                                background: 'var(--bg-elevated)',
                                borderRadius: 4
                              }}
                            >
                              景别: {currentShot.shotSizeLabel}
                            </span>
                            <span
                              style={{
                                fontSize: 11,
                                padding: '3px 8px',
                                background: 'var(--bg-elevated)',
                                borderRadius: 4
                              }}
                            >
                              机位: {currentShot.cameraLabel}
                            </span>
                            <span
                              style={{
                                fontSize: 11,
                                padding: '3px 8px',
                                background: 'var(--bg-elevated)',
                                borderRadius: 4
                              }}
                            >
                              时长: {currentShot.duration}s
                            </span>
                          </div>
                        </div>

                        {/* 关联角色与服装 */}
                        {shotCharacter && (
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 10,
                              marginTop: 12,
                              paddingTop: 10,
                              borderTop: '1px solid var(--border)'
                            }}
                          >
                            <img
                              src={shotCharacter.avatar}
                              alt={shotCharacter.name}
                              style={{
                                width: 28,
                                height: 28,
                                borderRadius: '50%',
                                objectFit: 'cover'
                              }}
                            />
                            <span style={{ fontSize: 12, fontWeight: 600 }}>
                              出场角色: {shotCharacter.name}
                            </span>
                            <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                              服化道:{' '}
                              {shotCharacter.outfits?.find((o) => o.id === currentShot.outfitId)
                                ?.name || '默认高定礼服'}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* 核心功能：Prompt 编译器 (结合本地无大模型痛点，支持一键复制与外跳) */}
                      <div
                        style={{
                          background: 'var(--bg-surface)',
                          border: '1px solid var(--border)',
                          borderRadius: 'var(--radius-lg)',
                          padding: 16
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: 10
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 13, fontWeight: 700 }}>
                              ⚡ 工业级 Prompt 编译器
                            </span>
                            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                              自动装配角色立绘 + 服饰 + 场景 + 运镜
                            </span>
                          </div>

                          {/* 目标平台切换 */}
                          <div style={{ display: 'flex', gap: 4 }}>
                            {PROMPT_PLATFORMS.map((plat) => (
                              <button
                                key={plat.id}
                                onClick={() => setPromptPlatform(plat.id)}
                                style={{
                                  padding: '3px 8px',
                                  fontSize: 11,
                                  background:
                                    promptPlatform === plat.id
                                      ? 'var(--accent-blue-dim)'
                                      : 'var(--bg-elevated)',
                                  border: `1px solid ${promptPlatform === plat.id ? 'var(--accent-blue)' : 'var(--border)'}`,
                                  color:
                                    promptPlatform === plat.id
                                      ? 'var(--accent-blue)'
                                      : 'var(--text-secondary)',
                                  borderRadius: 'var(--radius-sm)',
                                  cursor: 'pointer'
                                }}
                              >
                                {plat.icon} {plat.name}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* 编译结果文本框 */}
                        <div
                          style={{
                            background: 'var(--bg-base)',
                            border: '1px solid var(--border)',
                            borderRadius: 'var(--radius-md)',
                            padding: 12,
                            fontSize: 12,
                            lineHeight: 1.6,
                            color: 'var(--text-primary)',
                            whiteSpace: 'pre-wrap',
                            maxHeight: 120,
                            overflowY: 'auto',
                            fontFamily: 'monospace'
                          }}
                        >
                          {compiledPrompt}
                        </div>

                        {/* 操作栏：复制与外跳 */}
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            marginTop: 10
                          }}
                        >
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(compiledPrompt)
                                showToast('✓ 已将该镜头专业 Prompt 复制至剪贴板')
                              }}
                              style={{
                                background: 'linear-gradient(135deg, #4f9ef8, #8b5cf6)',
                                border: 'none',
                                color: '#fff',
                                padding: '6px 14px',
                                borderRadius: 'var(--radius-md)',
                                fontSize: 12,
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6
                              }}
                            >
                              <span>📋</span>
                              <span>一键复制提示词 (Copy Prompt)</span>
                            </button>

                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(
                                  'blurry, distorted, bad anatomy, deformed fingers, extra limbs, watermark, oversaturated'
                                )
                                showToast('✓ 已复制通用负向提示词')
                              }}
                              style={{
                                background: 'var(--bg-elevated)',
                                border: '1px solid var(--border)',
                                color: 'var(--text-secondary)',
                                padding: '6px 12px',
                                borderRadius: 'var(--radius-md)',
                                fontSize: 11,
                                cursor: 'pointer'
                              }}
                            >
                              复制负向词 (Negative)
                            </button>
                          </div>

                          {/* 网页端快捷外跳 */}
                          <div
                            style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11 }}
                          >
                            <span style={{ color: 'var(--text-muted)' }}>外跳网页端生成:</span>
                            <a
                              href="https://jimeng.jianying.com"
                              target="_blank"
                              rel="noreferrer"
                              style={{ color: 'var(--accent-blue)', textDecoration: 'none' }}
                            >
                              即梦 ↗
                            </a>
                            <a
                              href="https://klingai.kuaishou.com"
                              target="_blank"
                              rel="noreferrer"
                              style={{ color: 'var(--accent-blue)', textDecoration: 'none' }}
                            >
                              可灵 ↗
                            </a>
                            <a
                              href="https://hailuoai.video"
                              target="_blank"
                              rel="noreferrer"
                              style={{ color: 'var(--accent-blue)', textDecoration: 'none' }}
                            >
                              海螺 ↗
                            </a>
                          </div>
                        </div>
                      </div>

                      {/* 双模完成通道：通道 A 本地/API生成 + 通道 B 外部素材拖拽回填 */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                        {/* 通道 A：本地/API一键调度 */}
                        <div
                          style={{
                            background: 'var(--bg-surface)',
                            border: '1px solid var(--border)',
                            borderRadius: 'var(--radius-lg)',
                            padding: 16,
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between'
                          }}
                        >
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>
                              🖥️ 通道 A: 本地 / API 极速生成
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                              调用本地配置的端点或内置仿真引擎直接出片
                            </div>
                          </div>

                          {isLocalGenerating ? (
                            <div style={{ margin: '20px 0' }}>
                              <div
                                style={{
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  fontSize: 11,
                                  marginBottom: 4
                                }}
                              >
                                <span>渲染执行中...</span>
                                <span>{localGenProgress}%</span>
                              </div>
                              <div
                                style={{
                                  height: 6,
                                  background: 'var(--bg-base)',
                                  borderRadius: 3,
                                  overflow: 'hidden'
                                }}
                              >
                                <div
                                  style={{
                                    width: `${localGenProgress}%`,
                                    height: '100%',
                                    background: 'var(--accent-blue)',
                                    transition: 'width 200ms ease'
                                  }}
                                />
                              </div>
                            </div>
                          ) : (
                            <div
                              style={{
                                margin: '16px 0',
                                fontSize: 11,
                                color: 'var(--text-secondary)'
                              }}
                            >
                              基座: 通义万相 (Wan 2.1) · 9:16 竖屏 · {currentShot.duration}s
                            </div>
                          )}

                          <button
                            onClick={handleRunLocalGen}
                            disabled={isLocalGenerating}
                            style={{
                              padding: '10px 14px',
                              background: isLocalGenerating
                                ? 'var(--bg-elevated)'
                                : 'var(--accent-blue-dim)',
                              border: '1px solid rgba(79,158,248,0.3)',
                              color: 'var(--accent-blue)',
                              borderRadius: 'var(--radius-md)',
                              fontSize: 12,
                              fontWeight: 700,
                              cursor: isLocalGenerating ? 'not-allowed' : 'pointer'
                            }}
                          >
                            {isLocalGenerating ? '正在渲染生成...' : '立即调度引擎生成'}
                          </button>
                        </div>

                        {/* 通道 B: 外部网页素材拖拽回填区 (核心解决本地无模型痛点) */}
                        <div
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={handleDropBackfill}
                          style={{
                            background: 'var(--bg-surface)',
                            border: '1px dashed var(--accent-purple)',
                            borderRadius: 'var(--radius-lg)',
                            padding: 16,
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between'
                          }}
                        >
                          <div>
                            <div
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                marginBottom: 4
                              }}
                            >
                              <span
                                style={{
                                  fontSize: 13,
                                  fontWeight: 700,
                                  color: 'var(--accent-purple)'
                                }}
                              >
                                📥 通道 B: 外部网页素材拖拽回填 (推荐)
                              </span>
                              <span
                                style={{
                                  fontSize: 10,
                                  padding: '1px 5px',
                                  borderRadius: 3,
                                  background: 'var(--accent-purple-dim)',
                                  color: 'var(--accent-purple)'
                                }}
                              >
                                无需本地模型
                              </span>
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                              在网页生成好后，直接将图片或 MP4 文件拖放至此
                            </div>
                          </div>

                          {/* 拖拽感应区 */}
                          <div
                            style={{
                              margin: '12px 0',
                              padding: '14px',
                              background: 'var(--bg-base)',
                              borderRadius: 'var(--radius-md)',
                              textAlign: 'center',
                              cursor: 'pointer'
                            }}
                          >
                            <div style={{ fontSize: 20 }}>📁 ⬇️</div>
                            <div style={{ fontSize: 11, fontWeight: 600, marginTop: 4 }}>
                              拖拽 .mp4 视频或关键帧图片到此处
                            </div>
                            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                              自动保存并完成当前 Shot 最小任务
                            </div>
                          </div>

                          {/* 粘贴 URL 回填 */}
                          <div style={{ display: 'flex', gap: 6 }}>
                            <input
                              type="text"
                              value={backfillUrlInput}
                              onChange={(e) => setBackfillUrlInput(e.target.value)}
                              placeholder="或在此粘贴素材视频/图片网络 URL..."
                              style={{
                                flex: 1,
                                background: 'var(--bg-base)',
                                border: '1px solid var(--border)',
                                borderRadius: 'var(--radius-sm)',
                                color: 'var(--text-primary)',
                                fontSize: 11,
                                padding: '4px 8px',
                                outline: 'none'
                              }}
                            />
                            <button
                              onClick={handleUrlBackfill}
                              style={{
                                background: 'var(--bg-elevated)',
                                border: '1px solid var(--border)',
                                color: 'var(--text-primary)',
                                borderRadius: 'var(--radius-sm)',
                                padding: '4px 10px',
                                fontSize: 11,
                                cursor: 'pointer'
                              }}
                            >
                              回填
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* 当前 Shot 视听预览卡片 */}
                      <div
                        style={{
                          background: 'var(--bg-surface)',
                          border: '1px solid var(--border)',
                          borderRadius: 'var(--radius-lg)',
                          padding: 16
                        }}
                      >
                        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>
                          📺 镜头素材预览 (Keyframe & Video)
                        </div>

                        {currentShot.videoUrl ? (
                          <div style={{ display: 'flex', gap: 16 }}>
                            <video
                              src={currentShot.videoUrl}
                              controls
                              loop
                              style={{
                                width: 260,
                                height: 146,
                                borderRadius: 'var(--radius-md)',
                                background: '#000',
                                objectFit: 'contain'
                              }}
                            />
                            <div
                              style={{
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'space-between'
                              }}
                            >
                              <div>
                                <span
                                  style={{
                                    fontSize: 11,
                                    fontWeight: 700,
                                    color: 'var(--accent-green)'
                                  }}
                                >
                                  ✓ 已完成成片绑定
                                </span>
                                <div
                                  style={{
                                    fontSize: 11,
                                    color: 'var(--text-secondary)',
                                    marginTop: 4
                                  }}
                                >
                                  素材规格: 9:16 竖屏 · {currentShot.duration} 秒 · 60fps
                                </div>
                                <div
                                  style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}
                                >
                                  备注: {currentShot.notes}
                                </div>
                              </div>
                              <div>
                                <button
                                  onClick={() =>
                                    handleUpdateCurrentShot({
                                      status: 'PROMPT_READY',
                                      videoUrl: ''
                                    })
                                  }
                                  style={{
                                    background: 'transparent',
                                    border: '1px solid var(--border)',
                                    color: 'var(--text-danger)',
                                    padding: '4px 8px',
                                    borderRadius: 'var(--radius-sm)',
                                    fontSize: 11,
                                    cursor: 'pointer'
                                  }}
                                >
                                  清除素材重新生成
                                </button>
                              </div>
                            </div>
                          </div>
                        ) : currentShot.keyframeUrl ? (
                          <div style={{ display: 'flex', gap: 16 }}>
                            <img
                              src={currentShot.keyframeUrl}
                              alt="Keyframe"
                              style={{
                                width: 140,
                                height: 140,
                                borderRadius: 'var(--radius-md)',
                                objectFit: 'cover'
                              }}
                            />
                            <div
                              style={{
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'space-between'
                              }}
                            >
                              <div>
                                <span
                                  style={{
                                    fontSize: 11,
                                    fontWeight: 700,
                                    color: 'var(--accent-amber)'
                                  }}
                                >
                                  ⏳ 关键帧已锁定，待生成视频
                                </span>
                                <div
                                  style={{
                                    fontSize: 11,
                                    color: 'var(--text-secondary)',
                                    marginTop: 4
                                  }}
                                >
                                  可以使用图生视频 (I2V) 模式将该图片带入网页端生成
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div
                            style={{
                              padding: 24,
                              background: 'var(--bg-base)',
                              borderRadius: 'var(--radius-md)',
                              textAlign: 'center',
                              color: 'var(--text-muted)',
                              fontSize: 12
                            }}
                          >
                            暂无视听素材，请在上方复制 Prompt
                            去网页端生成后拖入回填，或点击本地极速生成。
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                      请在左侧选择一个镜头
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 2. 📖 剧情设定 (Story Bible) */}
            {activeDramaTab === 'story' && (
              <div
                style={{
                  flex: 1,
                  overflowY: 'auto',
                  padding: 24,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 20
                }}
              >
                {/* 核心梗概 */}
                <div
                  style={{
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-lg)',
                    padding: 18
                  }}
                >
                  <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>
                    🔥 核心设定与爽点标语 (Tagline)
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      color: 'var(--text-primary)',
                      lineHeight: 1.6,
                      background: 'var(--bg-base)',
                      padding: 12,
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border)'
                    }}
                  >
                    {currentProject.storyBible?.tagline}
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                    {currentProject.storyBible?.coreTropes?.map((t, idx) => (
                      <span
                        key={idx}
                        style={{
                          fontSize: 11,
                          padding: '3px 8px',
                          background: 'var(--accent-blue-dim)',
                          color: 'var(--accent-blue)',
                          borderRadius: 'var(--radius-full)'
                        }}
                      >
                        #{t}
                      </span>
                    ))}
                  </div>
                </div>

                {/* 世界观 */}
                <div
                  style={{
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-lg)',
                    padding: 18
                  }}
                >
                  <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>
                    🌍 世界观与商战舞台 (Worldview)
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                    {currentProject.storyBible?.worldview}
                  </div>
                </div>

                {/* 三阶段大纲 */}
                <div
                  style={{
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-lg)',
                    padding: 18
                  }}
                >
                  <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>
                    📈 80 集三幕式进阶大纲 (Plot Phases)
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                    {currentProject.storyBible?.plotPhases?.map((p, idx) => (
                      <div
                        key={idx}
                        style={{
                          background: 'var(--bg-base)',
                          padding: 12,
                          borderRadius: 'var(--radius-md)',
                          border: '1px solid var(--border)'
                        }}
                      >
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent-blue)' }}>
                          {p.phase}
                        </div>
                        <div
                          style={{
                            fontSize: 12,
                            fontWeight: 700,
                            margin: '4px 0',
                            color: 'var(--text-primary)'
                          }}
                        >
                          {p.title}
                        </div>
                        <div
                          style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.4 }}
                        >
                          {p.desc}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 秘密与伏笔 */}
                <div
                  style={{
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-lg)',
                    padding: 18
                  }}
                >
                  <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>
                    🔒 伏笔与机密暗线 (Secrets)
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {currentProject.storyBible?.secrets?.map((s, idx) => (
                      <div
                        key={idx}
                        style={{
                          fontSize: 12,
                          color: 'var(--text-secondary)',
                          padding: '6px 10px',
                          background: 'var(--bg-base)',
                          borderRadius: 'var(--radius-sm)'
                        }}
                      >
                        {s}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* 3. 👥 角色资产 (Character Bible) */}
            {activeDramaTab === 'characters' && (
              <div
                style={{
                  flex: 1,
                  overflowY: 'auto',
                  padding: 24,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 20
                }}
              >
                <div style={{ fontSize: 14, fontWeight: 700 }}>
                  🎭 核心角色与服化道资产库 ({currentProject.characters?.length || 0})
                </div>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                    gap: 16
                  }}
                >
                  {currentProject.characters?.map((c) => (
                    <div
                      key={c.id}
                      style={{
                        background: 'var(--bg-surface)',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-lg)',
                        overflow: 'hidden',
                        display: 'flex',
                        flexDirection: 'column'
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          padding: 16,
                          gap: 14,
                          borderBottom: '1px solid var(--border)'
                        }}
                      >
                        <img
                          src={c.avatar}
                          alt={c.name}
                          style={{
                            width: 56,
                            height: 56,
                            borderRadius: '50%',
                            objectFit: 'cover',
                            border: '2px solid var(--border)'
                          }}
                        />
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: 15, fontWeight: 700 }}>{c.name}</span>
                            <span
                              style={{
                                fontSize: 10,
                                padding: '1px 6px',
                                background: 'var(--accent-blue-dim)',
                                color: 'var(--accent-blue)',
                                borderRadius: 3
                              }}
                            >
                              {c.role}
                            </span>
                          </div>
                          <div
                            style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}
                          >
                            年龄: {c.age} · {c.persona}
                          </div>
                          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
                            声音: {c.voiceName}
                          </div>
                        </div>
                      </div>

                      {/* 服装库 */}
                      <div style={{ padding: 14 }}>
                        <div
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            color: 'var(--text-secondary)',
                            marginBottom: 6
                          }}
                        >
                          👗 服化道造型 Outfits ({c.outfits?.length || 0}):
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {c.outfits?.map((o) => (
                            <div
                              key={o.id}
                              style={{
                                background: 'var(--bg-base)',
                                padding: '6px 8px',
                                borderRadius: 'var(--radius-sm)',
                                fontSize: 11
                              }}
                            >
                              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                                {o.name}
                              </span>
                              <span style={{ color: 'var(--text-muted)', marginLeft: 6 }}>
                                ({o.scene})
                              </span>
                              <div
                                style={{
                                  color: 'var(--text-secondary)',
                                  marginTop: 2,
                                  fontSize: 10
                                }}
                              >
                                {o.desc}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 4. 🎬 剧本与分集 (Script & Episodes) */}
            {activeDramaTab === 'script' && (
              <div
                style={{
                  flex: 1,
                  overflowY: 'auto',
                  padding: 24,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 16
                }}
              >
                <div
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                >
                  <div style={{ fontSize: 14, fontWeight: 700 }}>
                    🎬 剧本分集目录 (总计划 {currentProject.totalEpisodes} 集)
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {currentProject.episodes?.map((ep) => (
                      <button
                        key={ep.id}
                        onClick={() => setSelectedEpisodeId(ep.id)}
                        style={{
                          padding: '4px 10px',
                          background:
                            selectedEpisodeId === ep.id
                              ? 'var(--accent-blue)'
                              : 'var(--bg-surface)',
                          color: selectedEpisodeId === ep.id ? '#fff' : 'var(--text-secondary)',
                          border: '1px solid var(--border)',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: 11,
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        {ep.id}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 选中的剧集详细剧情 */}
                {currentEpisode && (
                  <div
                    style={{
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-lg)',
                      padding: 18
                    }}
                  >
                    <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 8 }}>
                      {currentEpisode.title}
                    </div>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(3, 1fr)',
                        gap: 12,
                        marginBottom: 16
                      }}
                    >
                      <div
                        style={{
                          background: 'var(--bg-base)',
                          padding: 10,
                          borderRadius: 'var(--radius-md)'
                        }}
                      >
                        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                          HOOK (开篇钩子)
                        </div>
                        <div style={{ fontSize: 11, marginTop: 4 }}>{currentEpisode.hook}</div>
                      </div>
                      <div
                        style={{
                          background: 'var(--bg-base)',
                          padding: 10,
                          borderRadius: 'var(--radius-md)'
                        }}
                      >
                        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                          CLIMAX (本集高潮)
                        </div>
                        <div style={{ fontSize: 11, marginTop: 4 }}>{currentEpisode.climax}</div>
                      </div>
                      <div
                        style={{
                          background: 'var(--bg-base)',
                          padding: 10,
                          borderRadius: 'var(--radius-md)'
                        }}
                      >
                        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                          ENDING HOOK (留钩悬念)
                        </div>
                        <div style={{ fontSize: 11, marginTop: 4 }}>
                          {currentEpisode.endingHook}
                        </div>
                      </div>
                    </div>

                    {/* 场次与镜头列表 */}
                    <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>
                      场次与分镜细分:
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {currentEpisode.scenes?.map((sc) => (
                        <div
                          key={sc.id}
                          style={{
                            background: 'var(--bg-base)',
                            border: '1px solid var(--border)',
                            borderRadius: 'var(--radius-md)',
                            padding: 12
                          }}
                        >
                          <div
                            style={{
                              fontSize: 12,
                              fontWeight: 700,
                              color: 'var(--accent-blue)',
                              marginBottom: 6
                            }}
                          >
                            SCENE {sc.sceneNumber} · {sc.location} ({sc.time}) - {sc.atmosphere}
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {sc.shots?.map((sh) => (
                              <div
                                key={sh.id}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  padding: '6px 10px',
                                  background: 'var(--bg-elevated)',
                                  borderRadius: 'var(--radius-sm)'
                                }}
                              >
                                <div>
                                  <span style={{ fontSize: 11, fontWeight: 600 }}>{sh.name}</span>
                                  <span
                                    style={{
                                      fontSize: 10,
                                      color: 'var(--text-muted)',
                                      marginLeft: 8
                                    }}
                                  >
                                    {sh.shotSizeLabel} · {sh.cameraLabel} · {sh.duration}s
                                  </span>
                                </div>
                                <button
                                  onClick={() => {
                                    setSelectedShotId(sh.id)
                                    setActiveDramaTab('tasks')
                                  }}
                                  style={{
                                    background: 'var(--accent-blue-dim)',
                                    border: 'none',
                                    color: 'var(--accent-blue)',
                                    fontSize: 10,
                                    padding: '2px 6px',
                                    borderRadius: 3,
                                    cursor: 'pointer'
                                  }}
                                >
                                  前往执行 ↗
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 5. 🎞️ 成片时间轴 (Episode Timeline & Preview) */}
            {activeDramaTab === 'timeline' && (
              <div
                style={{
                  flex: 1,
                  overflowY: 'auto',
                  padding: 24,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 20
                }}
              >
                <div
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                >
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700 }}>
                      🎞️ {currentEpisode?.title} · 全集时间轴总览
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                      已就绪镜头将自动拼接为完整成片轨道，支持一键打包导出
                    </div>
                  </div>
                  <button
                    onClick={() =>
                      showToast('✓ 已导出剪映项目工程草稿文件至当前工作空间 assets/ 目录')
                    }
                    style={{
                      background: 'linear-gradient(135deg, #a371f7, #4f9ef8)',
                      border: 'none',
                      color: '#fff',
                      padding: '8px 14px',
                      borderRadius: 'var(--radius-md)',
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    📦 导出剪映素材包 / 项目包
                  </button>
                </div>

                {/* 时间轴轨道 */}
                <div
                  style={{
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-lg)',
                    padding: 20,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 14
                  }}
                >
                  <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 10 }}>
                    {allShotsInEpisode.map((sh, idx) => {
                      const isReady = sh.status === 'COMPLETED'
                      return (
                        <div
                          key={sh.id}
                          style={{
                            width: 160,
                            height: 100,
                            borderRadius: 'var(--radius-md)',
                            border: `1px solid ${isReady ? 'var(--accent-green)' : 'var(--border)'}`,
                            background: isReady ? '#0a0d12' : 'var(--bg-base)',
                            position: 'relative',
                            overflow: 'hidden',
                            flexShrink: 0,
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                            padding: 8
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span
                              style={{
                                fontSize: 10,
                                fontWeight: 700,
                                color: isReady ? 'var(--accent-green)' : 'var(--text-muted)'
                              }}
                            >
                              #{idx + 1} {sh.name.split('·')[0]}
                            </span>
                            <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>
                              {sh.duration}s
                            </span>
                          </div>
                          <div
                            style={{
                              fontSize: 10,
                              color: isReady ? 'var(--text-primary)' : 'var(--text-muted)',
                              lineHeight: 1.2
                            }}
                          >
                            {sh.action.slice(0, 20)}...
                          </div>
                          <div
                            style={{
                              fontSize: 9,
                              color: isReady ? 'var(--accent-green)' : 'var(--accent-amber)'
                            }}
                          >
                            {isReady ? '✓ 渲染已就绪' : '⏳ 待回填'}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 视图主体：单片快速实验室 (Lab Mode - 保留原有自由生成能力) */}
      {/* ========================================================================= */}
      {studioMode === 'lab' && (
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          <div
            style={{
              width: 440,
              borderRight: '1px solid var(--border)',
              background: 'var(--bg-surface)',
              padding: 16,
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: 14
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 700 }}>🧪 自由单片生成控制台</div>
            <textarea
              value={labPrompt}
              onChange={(e) => setLabPrompt(e.target.value)}
              rows={4}
              placeholder="输入自由生成提示词..."
              style={{
                width: '100%',
                background: 'var(--bg-base)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-primary)',
                padding: 8,
                fontSize: 12
              }}
            />
            <button
              onClick={() => {
                if (!labPrompt.trim()) return
                const newTask = {
                  id: `lab-${Date.now()}`,
                  title: labPrompt.slice(0, 20) + '...',
                  posterUrl:
                    'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80',
                  createdAt: Date.now()
                }
                setLabTasks((prev) => [newTask, ...prev])
                showToast('🚀 实验室任务已提交')
              }}
              style={{
                padding: '10px 14px',
                background: 'linear-gradient(135deg, #4f9ef8, #8b5cf6)',
                border: 'none',
                color: '#fff',
                borderRadius: 'var(--radius-md)',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              立即生成
            </button>
          </div>
          <div style={{ flex: 1, padding: 24, overflowY: 'auto' }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>🎬 实验室作品列表</div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                gap: 12
              }}
            >
              {labTasks.map((t) => (
                <div
                  key={t.id}
                  style={{
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    overflow: 'hidden'
                  }}
                >
                  <img
                    src={t.posterUrl}
                    alt={t.title}
                    style={{ width: '100%', height: 110, objectFit: 'cover' }}
                  />
                  <div style={{ padding: 8, fontSize: 11, fontWeight: 600 }}>{t.title}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 弹窗：新建短剧项目 (支持新建独立工作空间 / 关联已有工作空间) */}
      {/* ========================================================================= */}
      {isNewProjectModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999
          }}
        >
          <div
            style={{
              width: 500,
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-xl)',
              padding: 24,
              boxShadow: '0 16px 48px rgba(0,0,0,0.7)',
              display: 'flex',
              flexDirection: 'column',
              gap: 16
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 16, fontWeight: 800 }}>🎬 新建红果 AI 短剧项目</div>
              <button
                onClick={() => setIsNewProjectModalOpen(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  fontSize: 16,
                  cursor: 'pointer'
                }}
              >
                ×
              </button>
            </div>

            {/* 短剧名称 */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
                短剧名称
              </label>
              <input
                type="text"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                placeholder="例如：《重生之真假千金复仇记》"
                style={{
                  width: '100%',
                  marginTop: 6,
                  padding: '8px 10px',
                  background: 'var(--bg-base)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--text-primary)',
                  fontSize: 12,
                  outline: 'none'
                }}
              />
            </div>

            {/* 题材与规格 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
                  题材分类
                </label>
                <select
                  value={newProjectGenre}
                  onChange={(e) => setNewProjectGenre(e.target.value)}
                  style={{
                    width: '100%',
                    marginTop: 6,
                    padding: '8px 10px',
                    background: 'var(--bg-base)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--text-primary)',
                    fontSize: 12,
                    outline: 'none'
                  }}
                >
                  <option value="都市 / 豪门复仇 / 爽剧">都市 / 豪门复仇 / 爽剧</option>
                  <option value="战神归来 / 逆袭打脸">战神归来 / 逆袭打脸</option>
                  <option value="古言 / 穿书 / 甜宠千金">古言 / 穿书 / 甜宠千金</option>
                  <option value="玄幻 / 修仙宗门 / 无敌流">玄幻 / 修仙宗门 / 无敌流</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
                  画幅制式
                </label>
                <select
                  value={newProjectFormat}
                  onChange={(e) => setNewProjectFormat(e.target.value)}
                  style={{
                    width: '100%',
                    marginTop: 6,
                    padding: '8px 10px',
                    background: 'var(--bg-base)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--text-primary)',
                    fontSize: 12,
                    outline: 'none'
                  }}
                >
                  <option value="9:16">9:16 (红果短剧原生竖屏)</option>
                  <option value="16:9">16:9 (横屏微电影)</option>
                </select>
              </div>
            </div>

            {/* 计划集数 */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
                计划总集数 (Episodes)
              </label>
              <input
                type="number"
                min="1"
                max="200"
                value={newProjectEpisodes}
                onChange={(e) => setNewProjectEpisodes(parseInt(e.target.value, 10) || 80)}
                style={{
                  width: '100%',
                  marginTop: 6,
                  padding: '8px 10px',
                  background: 'var(--bg-base)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--text-primary)',
                  fontSize: 12,
                  outline: 'none'
                }}
              />
            </div>

            {/* 核心亮点：工作空间关联 / 自动新建模式 */}
            <div
              style={{
                background: 'var(--bg-base)',
                padding: 12,
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border)'
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>
                📁 工作空间绑定策略
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    fontSize: 12,
                    cursor: 'pointer'
                  }}
                >
                  <input
                    type="radio"
                    name="wsOption"
                    value="create_new"
                    checked={workspaceOption === 'create_new'}
                    onChange={() => setWorkspaceOption('create_new')}
                  />
                  <span>
                    <strong>为该项目新建独立工作空间</strong>（自动创建标准短剧资产目录，加入
                    flyWork 侧边栏）
                  </span>
                </label>

                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    fontSize: 12,
                    cursor: 'pointer'
                  }}
                >
                  <input
                    type="radio"
                    name="wsOption"
                    value="link_existing"
                    checked={workspaceOption === 'link_existing'}
                    onChange={() => setWorkspaceOption('link_existing')}
                  />
                  <span>关联现有已有工作空间</span>
                </label>

                {workspaceOption === 'link_existing' && (
                  <select
                    value={selectedExistingWsId}
                    onChange={(e) => setSelectedExistingWsId(e.target.value)}
                    style={{
                      width: '100%',
                      marginTop: 4,
                      padding: '6px 8px',
                      background: 'var(--bg-elevated)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-sm)',
                      color: 'var(--text-primary)',
                      fontSize: 11
                    }}
                  >
                    {workspaces.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name} ({w.root})
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            {/* 底部按钮 */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 6 }}>
              <button
                onClick={() => setIsNewProjectModalOpen(false)}
                style={{
                  background: 'transparent',
                  border: '1px solid var(--border)',
                  color: 'var(--text-secondary)',
                  padding: '8px 14px',
                  borderRadius: 'var(--radius-md)',
                  fontSize: 12,
                  cursor: 'pointer'
                }}
              >
                取消
              </button>
              <button
                onClick={handleCreateProjectSubmit}
                style={{
                  background: 'linear-gradient(135deg, #4f9ef8, #8b5cf6)',
                  border: 'none',
                  color: '#fff',
                  padding: '8px 16px',
                  borderRadius: 'var(--radius-md)',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                确认创建
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

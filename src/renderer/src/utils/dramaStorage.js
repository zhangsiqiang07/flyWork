// AI 短剧本地持久化与数据流转管理 (Drama Storage & State Management)

import { DEFAULT_DRAMA_PROJECTS } from '../data/mockDramaProjects'

const DRAMA_STORAGE_KEY = 'flywork_drama_projects_v1'
const ACTIVE_PROJECT_KEY = 'flywork_drama_active_project_id_v1'

/**
 * 加载所有短剧项目
 */
export function loadDramaProjects() {
  try {
    const raw = localStorage.getItem(DRAMA_STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed
      }
    }
  } catch (err) {
    console.warn('[dramaStorage] Failed to load projects, fallback to defaults', err)
  }
  return DEFAULT_DRAMA_PROJECTS
}

/**
 * 保存短剧项目列表
 */
export function saveDramaProjects(projects) {
  try {
    localStorage.setItem(DRAMA_STORAGE_KEY, JSON.stringify(projects))
  } catch (err) {
    console.error('[dramaStorage] Failed to save projects', err)
  }
}

/**
 * 获取当前激活项目 ID
 */
export function getActiveProjectId(projects = []) {
  try {
    const saved = localStorage.getItem(ACTIVE_PROJECT_KEY)
    if (saved && projects.some((p) => p.id === saved)) {
      return saved
    }
  } catch (err) {
    console.warn('[dramaStorage] Error getting active project id', err)
  }
  return projects[0]?.id || null
}

/**
 * 切换并保存当前激活项目 ID
 */
export function setActiveProjectId(projectId) {
  try {
    localStorage.setItem(ACTIVE_PROJECT_KEY, projectId)
  } catch (err) {
    console.warn('[dramaStorage] Error setting active project id', err)
  }
}

/**
 * 更新某个项目的具体 Shot 镜头（包括外部素材回填、状态流转）
 */
export function updateShotInProject(projects, projectId, episodeId, shotId, updates) {
  return projects.map((proj) => {
    if (proj.id !== projectId) return proj

    const updatedEpisodes = (proj.episodes || []).map((ep) => {
      if (ep.id !== episodeId) return ep

      const updatedScenes = (ep.scenes || []).map((sc) => {
        const updatedShots = (sc.shots || []).map((sh) => {
          if (sh.id === shotId) {
            return {
              ...sh,
              ...updates,
              updatedAt: Date.now()
            }
          }
          return sh
        })
        return { ...sc, shots: updatedShots }
      })

      return { ...ep, scenes: updatedScenes }
    })

    return {
      ...proj,
      episodes: updatedEpisodes,
      updatedAt: Date.now()
    }
  })
}

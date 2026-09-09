import { INITIAL_VIDEO_ASSETS } from '../data/videoStudioMockData'

const TASKS_STORAGE_KEY = 'flywork_video_tasks_v1'
const SETTINGS_STORAGE_KEY = 'flywork_video_studio_settings_v1'

/**
 * 获取持久化的视频生成历史和任务列表
 */
export function loadVideoTasks() {
  try {
    const raw = localStorage.getItem(TASKS_STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed
      }
    }
  } catch (err) {
    console.warn('[videoStorage] Failed to load tasks, using initial assets', err)
  }
  return INITIAL_VIDEO_ASSETS
}

/**
 * 保存视频任务列表
 */
export function saveVideoTasks(tasks) {
  try {
    localStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(tasks))
  } catch (err) {
    console.error('[videoStorage] Failed to save video tasks', err)
  }
}

/**
 * 获取保存的默认创作参数（如上次使用的模型、画幅等）
 */
export function loadVideoStudioSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY)
    if (raw) {
      return JSON.parse(raw)
    }
  } catch (err) {
    console.warn('[videoStorage] Failed to load studio settings', err)
  }
  return {
    model: 'wan-2.1',
    aspectRatio: '16:9',
    resolution: '1080p',
    duration: 5,
    camera: 'zoom-in',
    motion: 6,
    activeTab: 'text-to-video'
  }
}

/**
 * 保存创作偏好配置
 */
export function saveVideoStudioSettings(settings) {
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings))
  } catch (err) {
    console.error('[videoStorage] Failed to save studio settings', err)
  }
}

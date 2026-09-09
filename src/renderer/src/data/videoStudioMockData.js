// 视频工坊预设数据与主流 AI 视频模型配置

export const VIDEO_MODELS = [
  {
    id: 'kling-1.5',
    name: '快手可灵 (Kling 1.5)',
    provider: 'Kuaishou',
    badge: '推荐',
    avatar: '🎬',
    description: '电影级画面质感与物理规律拟真，擅长大动态与复杂运镜',
    maxDuration: 10,
    resolutions: ['720p', '1080p'],
    supportsImageToVideo: true,
    supportsCameraControl: true
  },
  {
    id: 'wan-2.1',
    name: '通义万相 (Wan 2.1)',
    provider: 'Alibaba',
    badge: '全新',
    avatar: '🌊',
    description: '开源最强视频基座之一，中英双语提示词理解精准，画面细节丰富',
    maxDuration: 10,
    resolutions: ['720p', '1080p'],
    supportsImageToVideo: true,
    supportsCameraControl: true
  },
  {
    id: 'cogvideox-flash',
    name: '智谱清影 (CogVideoX)',
    provider: 'Zhipu AI',
    badge: '极速',
    avatar: '⚡',
    description: '高效轻量化生成，渲染响应迅速，动作连贯性优秀',
    maxDuration: 10,
    resolutions: ['720p', '1080p'],
    supportsImageToVideo: true,
    supportsCameraControl: true
  },
  {
    id: 'hailuo-video-01',
    name: 'MiniMax 海螺 (Video-01)',
    provider: 'MiniMax',
    badge: '热门',
    avatar: '🐚',
    description: '超强镜头语言与高保真人物面部表情，画质色彩层次饱满',
    maxDuration: 6,
    resolutions: ['720p', '1080p'],
    supportsImageToVideo: true,
    supportsCameraControl: true
  },
  {
    id: 'runway-gen3',
    name: 'Runway Gen-3 Alpha',
    provider: 'Runway',
    badge: '专业',
    avatar: '🛸',
    description: '好莱坞级影视特效与光影质感，精确运镜速度与曲线控制',
    maxDuration: 10,
    resolutions: ['720p', '1080p', '4K'],
    supportsImageToVideo: true,
    supportsCameraControl: true
  },
  {
    id: 'comfyui-local',
    name: 'ComfyUI 本地/私有流',
    provider: 'Custom Endpoint',
    badge: '私有化',
    avatar: '🎛️',
    description: '连接本地或云端 ComfyUI 工作流节点，完全可控定制',
    maxDuration: 15,
    resolutions: ['720p', '1080p', '4K'],
    supportsImageToVideo: true,
    supportsCameraControl: true
  }
]

export const ASPECT_RATIOS = [
  {
    id: '16:9',
    label: '16:9 横屏',
    desc: '桌面/宽屏/B站/演示',
    width: 1920,
    height: 1080,
    icon: '🖥️'
  },
  {
    id: '9:16',
    label: '9:16 竖屏',
    desc: '移动端/短视频/抖音',
    width: 1080,
    height: 1920,
    icon: '📱'
  },
  {
    id: '1:1',
    label: '1:1 方形',
    desc: '社交动态/头像/小部件',
    width: 1080,
    height: 1080,
    icon: '⏹️'
  },
  {
    id: '4:3',
    label: '4:3 经典',
    desc: '复古显示/平板窗口',
    width: 1440,
    height: 1080,
    icon: '📺'
  },
  {
    id: '21:9',
    label: '21:9 宽银幕',
    desc: '电影巨幕/全景沉浸',
    width: 2560,
    height: 1080,
    icon: '🎞️'
  }
]

export const CAMERA_MOVEMENTS = [
  { id: 'static', label: '固定机位 (Static)', icon: '🔒', desc: '机位静止，主体动作自然流动' },
  {
    id: 'zoom-in',
    label: '平缓推进 (Zoom In)',
    icon: '🔍',
    desc: '镜头平稳向前推近，聚焦视觉中心'
  },
  {
    id: 'zoom-out',
    label: '缓慢拉远 (Zoom Out)',
    icon: '🔭',
    desc: '镜头缓缓向后拉远，展现宏大环境'
  },
  {
    id: 'pan-horizontal',
    label: '水平横摇 (Pan)',
    icon: '↔️',
    desc: '镜头从左至右或由右至左平移扫视'
  },
  {
    id: 'tilt-vertical',
    label: '上下俯仰 (Tilt)',
    icon: '↕️',
    desc: '镜头自下而上仰拍或从上至下俯拍'
  },
  {
    id: 'orbit',
    label: '360° 环绕 (Orbit)',
    icon: '🔄',
    desc: '围绕主体进行圆周运动，呈现立体空间'
  }
]

export const PROMPT_PRESETS = [
  {
    title: '📱 iOS 移动端动效流光',
    category: '产品演示',
    prompt:
      'Ultra high definition product demo, a sleek futuristic iOS mobile application interface with glowing glassmorphism cards, fluid spring animations, dynamic island expanding, neon light reflections on dark titanium body, cinematic lighting, 60fps.',
    aspectRatio: '9:16',
    model: 'wan-2.1',
    camera: 'zoom-in'
  },
  {
    title: '💻 现代开发者桌面与控制台',
    category: '科技工作流',
    prompt:
      'Cinematic close-up of a developer workstation at night, multi-screen matrix displaying real-time code streams, git topology graph and 3D terminal nodes, gentle ambient neon cyber glow, slow forward dolly movement, 8k resolution, photorealistic.',
    aspectRatio: '16:9',
    model: 'kling-1.5',
    camera: 'zoom-in'
  },
  {
    title: '🚀 AI Agent 智能体协同网络',
    category: '概念视觉',
    prompt:
      'Futuristic abstract visualization of multi-agent AI nodes communicating with glowing optic fiber beams, glowing data particles floating, digital twin matrix, clean minimalist aesthetic, smooth camera pan, masterpiece.',
    aspectRatio: '16:9',
    model: 'cogvideox-flash',
    camera: 'pan-horizontal'
  },
  {
    title: '🏙️ 赛博朋克雨夜未来都市',
    category: '电影级场景',
    prompt:
      'Drone flying through a rain-slicked cyberpunk metropolis at dusk, towering neon holographic billboards reflecting in wet asphalt, flying vehicles cruising between skyscrapers, hyper-realistic, dramatic volumetric fog and anamorphic lens flare.',
    aspectRatio: '21:9',
    model: 'runway-gen3',
    camera: 'orbit'
  },
  {
    title: '🌱 自然微距光影变幻',
    category: '自然美学',
    prompt:
      'Macro cinematography of morning dew drops on a vibrant emerald leaf, golden hour sunlight refracting rainbow bokeh, soft breeze swaying gently, ultra slow motion 120fps, highly detailed texture.',
    aspectRatio: '16:9',
    model: 'hailuo-video-01',
    camera: 'zoom-in'
  }
]

// 预设的高质量示例视频资源（支持开箱即看与回放）
export const INITIAL_VIDEO_ASSETS = [
  {
    id: 'vid-demo-001',
    title: 'FlyDeck 开发者交互动效演示',
    prompt:
      'Ultra high definition product demo, a sleek futuristic iOS mobile application interface with glowing glassmorphism cards, fluid spring animations, dynamic island expanding.',
    negativePrompt: 'blurry, lowres, distorted, watermark, flickering',
    model: 'wan-2.1',
    aspectRatio: '16:9',
    resolution: '1080p',
    duration: 5,
    camera: 'zoom-in',
    motion: 6,
    seed: 8847192,
    status: 'completed',
    progress: 100,
    createdAt: Date.now() - 3600 * 1000 * 4,
    videoUrl:
      'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    posterUrl:
      'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80',
    tags: ['UI动效', '产品演示', '1080p']
  },
  {
    id: 'vid-demo-002',
    title: '智能体拓扑与控制台数据流',
    prompt:
      'Cinematic close-up of a developer workstation at night, multi-screen matrix displaying real-time code streams, git topology graph and 3D terminal nodes, gentle ambient neon cyber glow.',
    negativePrompt: 'overexposed, noisy, stuttering, text artifacts',
    model: 'kling-1.5',
    aspectRatio: '16:9',
    resolution: '1080p',
    duration: 5,
    camera: 'pan-horizontal',
    motion: 5,
    seed: 3948172,
    status: 'completed',
    progress: 100,
    createdAt: Date.now() - 3600 * 1000 * 12,
    videoUrl:
      'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
    posterUrl:
      'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=800&auto=format&fit=crop&q=80',
    tags: ['数据流', '科技风', 'Kling']
  },
  {
    id: 'vid-demo-003',
    title: '未来都市流光飞驰',
    prompt:
      'Drone flying through a rain-slicked cyberpunk metropolis at dusk, towering neon holographic billboards reflecting in wet asphalt.',
    negativePrompt: 'low quality, cartoon, oversaturated, jump cuts',
    model: 'runway-gen3',
    aspectRatio: '21:9',
    resolution: '4K',
    duration: 10,
    camera: 'orbit',
    motion: 8,
    seed: 5201948,
    status: 'completed',
    progress: 100,
    createdAt: Date.now() - 3600 * 1000 * 24,
    videoUrl:
      'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WeAreGoingOnBullrun.mp4',
    posterUrl:
      'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=800&auto=format&fit=crop&q=80',
    tags: ['电影级', '4K', 'Runway']
  }
]

export const STORYBOARD_DEFAULT_SHOTS = [
  {
    id: 'shot-1',
    name: '镜头 1 · 全景引子',
    prompt:
      'A wide aerial shot panning over modern software innovation campus at sunrise, glass buildings reflecting morning sunlight.',
    camera: 'pan-horizontal',
    duration: 3,
    transition: 'fade'
  },
  {
    id: 'shot-2',
    name: '镜头 2 · 核心特写',
    prompt:
      'Medium close-up of a developer typing on mechanical keyboard, glowing code editor interface reflections in glasses.',
    camera: 'zoom-in',
    duration: 4,
    transition: 'dissolve'
  },
  {
    id: 'shot-3',
    name: '镜头 3 · 交互绽放',
    prompt:
      'Dynamic 3D holograph interface floating in mid-air, AI agents dispatching tasks, smooth energetic lighting bursts.',
    camera: 'orbit',
    duration: 3,
    transition: 'cut'
  }
]

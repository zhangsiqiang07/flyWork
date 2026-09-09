// 红果主流 AI 短剧项目与工业化流水线领域模型 (Drama Projects & Pipeline Data)

export const PROMPT_PLATFORMS = [
  { id: 'seedance', name: '即梦 / Seedance', badge: '红果官方原生', icon: '⚡' },
  { id: 'kling', name: '快手可灵 (Kling)', badge: '大动态强物理', icon: '🎬' },
  { id: 'hailuo', name: 'MiniMax 海螺', badge: '微表情神态', icon: '🐚' },
  { id: 'wan', name: '通义万相 (Wan 2.1)', badge: '双语细节质感', icon: '🌊' }
]

export const DEFAULT_DRAMA_PROJECTS = [
  {
    id: 'proj-rebirth-001',
    name: '《重生后我拒绝豪门联姻》',
    platform: '红果短剧',
    format: '9:16',
    genre: '都市 / 重生 / 豪门爽剧 / 复仇大女主',
    totalEpisodes: 80,
    currentEpisodeIndex: 1,
    coverUrl:
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&auto=format&fit=crop&q=80',
    workspaceId: null, // 可关联已有工作空间，或绑定新建的工作空间
    workspaceRoot: null,
    updatedAt: Date.now() - 1000 * 3600 * 2,

    // 1. 剧情与设定知识库 (Story Bible)
    storyBible: {
      tagline: '上一世惨死火海，重生回订婚当天当众退婚反杀，联手商界巨擘夺回千亿家产。',
      worldview:
        '现代华都顶级商界圈层，林、顾、陆三大世家表面利益捆绑，暗中残酷角逐。商战不仅在股市与并购，更涉及私生血统与上一代隐匿遗嘱。',
      coreTropes: ['重生退婚', '白切黑大女主', '马甲掉落', '双强联手', '反派全员火葬场'],
      plotPhases: [
        {
          phase: '第一阶段 (EP01~EP10)',
          title: '当众退婚 · 绝地反杀',
          desc: '订婚宴冷血退婚，断绝渣男吸血后路，自立门户建立新集团，初遇轮椅大佬陆沉。'
        },
        {
          phase: '第二阶段 (EP11~EP35)',
          title: '撕碎伪善 · 商战截胡',
          desc: '揭穿伪善养妹剽窃证据，在跨国并购案中反向做空顾氏，夺得家族核心专利。'
        },
        {
          phase: '第三阶段 (EP36~EP80)',
          title: '真假继承 · 终极清算',
          desc: '解开爷爷遗嘱之谜与车祸真相，将害死母亲与前世真凶送入法网，终登首富宝座。'
        }
      ],
      secrets: [
        '秘密 1: 顾承三年前伪造了林晚母亲的心脏手术知情同意书，直接导致林母不治身亡。',
        '秘密 2: 陆沉的轮椅伪装仅是为了避开家族暗杀，其真实身份为跨国暗网资本幕后操盘手。',
        '秘密 3: 林家真正的控股公证遗嘱原件，藏在西郊祖宅老钟摆夹层中。'
      ]
    },

    // 2. 角色资产库 (Character Bible & Assets)
    characters: [
      {
        id: 'CHAR_LINWAN',
        name: '林晚',
        role: '女主角',
        age: 25,
        persona: '清冷孤傲、智谋过人、克制隐忍、杀伐果断',
        voiceId: 'zh_female_cold_sovereign',
        voiceName: '清冷御姐音 (CosyVoice-01)',
        avatar:
          'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80',
        outfits: [
          {
            id: 'OUTFIT_BLACK_DRESS',
            name: '黑色抹胸晚礼服',
            scene: 'EP01订婚宴 / 晚宴',
            desc: '修身黑色丝绒长裙，搭配银色冷光锁骨链，极致清冷压迫感。'
          },
          {
            id: 'OUTFIT_WHITE_SUIT',
            name: '干练白色商务西装',
            scene: '商战谈判 / 股东大会',
            desc: '剪裁利落的纯白意式定制西服，内搭丝绸衬衣，职场大女主锋芒毕露。'
          },
          {
            id: 'OUTFIT_CASUAL',
            name: '极简居家墨绿衬衫',
            scene: '私人公寓 / 筹谋复仇',
            desc: '低饱和墨绿色真丝长衬衫，微卷长发自然散落。'
          }
        ],
        keyframes: [
          {
            type: '正脸标准相',
            url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80'
          },
          {
            type: '45°微冷侧颜',
            url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400&auto=format&fit=crop&q=80'
          },
          {
            type: '嘲讽冷笑神态',
            url: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=400&auto=format&fit=crop&q=80'
          }
        ]
      },
      {
        id: 'CHAR_GUCHENG',
        name: '顾承',
        role: '反派前未婚夫',
        age: 27,
        persona: '自负狂妄、利欲熏心、表面斯文败类、情绪极易失控',
        voiceId: 'zh_male_arrogant_noble',
        voiceName: '狂妄矜贵男声',
        avatar:
          'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&auto=format&fit=crop&q=80',
        outfits: [
          {
            id: 'OUTFIT_GU_SUIT',
            name: '深灰暗纹定制三件套',
            scene: '订婚宴 / 商务会议',
            desc: '深灰色名贵西服套装，佩戴金丝无框眼镜，假装名门贵公子。'
          }
        ],
        keyframes: [
          {
            type: '轻蔑冷笑',
            url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&auto=format&fit=crop&q=80'
          },
          {
            type: '恼羞成怒',
            url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&auto=format&fit=crop&q=80'
          }
        ]
      },
      {
        id: 'CHAR_LUCHEN',
        name: '陆沉',
        role: '男主角',
        age: 28,
        persona: '陆氏实际掌舵人、暗黑偏执、深不可测、唯对女主例外相护',
        voiceId: 'zh_male_deep_ruler',
        voiceName: '低沉磁性帝王音',
        avatar:
          'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=400&auto=format&fit=crop&q=80',
        outfits: [
          {
            id: 'OUTFIT_LU_COAT',
            name: '黑羊绒长款大衣',
            scene: '走廊擦肩 / 雨夜接应',
            desc: '纯黑色高级羊绒大衣，佩戴黑色皮质手套，手持暗银龙首手杖。'
          }
        ],
        keyframes: [
          {
            type: '深邃沉思',
            url: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=400&auto=format&fit=crop&q=80'
          }
        ]
      }
    ],

    // 3. 剧本与分集 (Episodes, Scenes, Shots: 最小原子任务)
    episodes: [
      {
        id: 'EP01',
        episodeNumber: 1,
        title: '当众退婚，换我做你的噩梦',
        hook: '女主惨烈火海记忆突醒，惊现于三年前订婚典礼现场。',
        climax: '当众掀翻婚戒托盘，红酒泼上渣男脸颊宣布解除婚约。',
        endingHook: '在走廊与轮椅大佬陆沉相遇，陆沉递上手帕：“林小姐，打得好。”',
        scenes: [
          {
            id: 'SC01',
            sceneNumber: 1,
            location: '顾家奢华宴会厅',
            time: '夜',
            atmosphere: '水晶吊灯璀璨、名流云集、香槟杯交错、暗流涌动',
            shots: [
              {
                id: 'EP01-SC01-SH001',
                shotIndex: 1,
                name: '镜头 1 · 奢华宴会厅全景',
                shotSize: 'wide',
                shotSizeLabel: '全景 (Wide)',
                camera: 'pan-horizontal',
                cameraLabel: '水平横摇 (Pan)',
                characterId: null,
                outfitId: null,
                action: '宴会厅吊灯散发耀眼金芒，宾客衣着华丽举杯交谈，记者闪光灯闪烁。',
                dialogue: '',
                duration: 3.0,
                status: 'COMPLETED', // COMPLETED | VIDEO_WAITING | KEYFRAME_WAITING | PROMPT_READY | DRAFT
                keyframeUrl:
                  'https://images.unsplash.com/photo-1519671482749-fd09be7ccebf?w=800&auto=format&fit=crop&q=80',
                videoUrl:
                  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
                notes: '渲染已完成，已合入时间轴'
              },
              {
                id: 'EP01-SC01-SH002',
                shotIndex: 2,
                name: '镜头 2 · 林晚重生睁眼特写',
                shotSize: 'medium_closeup',
                shotSizeLabel: '中近景 (MCU)',
                camera: 'zoom-in',
                cameraLabel: '平缓推进 (Zoom In)',
                characterId: 'CHAR_LINWAN',
                outfitId: 'OUTFIT_BLACK_DRESS',
                action:
                  '舞台中央的林晚猛然睁开双眼，睫毛轻颤，眼底的迷茫在两秒内瞬间化作凌厉冰霜。',
                dialogue: '（旁白）上一世的火，这辈子，我来替你们点。',
                duration: 3.5,
                status: 'COMPLETED',
                keyframeUrl:
                  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&auto=format&fit=crop&q=80',
                videoUrl:
                  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
                notes: '已由可灵生成，微表情连贯'
              },
              {
                id: 'EP01-SC01-SH003',
                shotIndex: 3,
                name: '镜头 3 · 顾承傲慢逼婚递戒',
                shotSize: 'closeup',
                shotSizeLabel: '特写 (CU)',
                camera: 'static',
                cameraLabel: '固定机位 (Static)',
                characterId: 'CHAR_GUCHENG',
                outfitId: 'OUTFIT_GU_SUIT',
                action: '顾承不耐烦地推了推金丝眼镜，居高临下递出钻戒绒盒，嘴角挂着不屑冷嘲。',
                dialogue: '林晚，能嫁进顾家是你高攀，把手伸出来，别不知好歹。',
                duration: 4.0,
                status: 'VIDEO_WAITING', // 等待外部回填或本地渲染
                keyframeUrl:
                  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&auto=format&fit=crop&q=80',
                videoUrl: '',
                notes: '关键帧已锁定，待网页生成视频回填'
              },
              {
                id: 'EP01-SC01-SH004',
                shotIndex: 4,
                name: '镜头 4 · 女主当众掀翻婚戒退婚',
                shotSize: 'medium_closeup',
                shotSizeLabel: '中近景 (MCU)',
                camera: 'orbit',
                cameraLabel: '360°环绕 (Orbit)',
                characterId: 'CHAR_LINWAN',
                outfitId: 'OUTFIT_BLACK_DRESS',
                action: '林晚冷笑一声，抬手直接将钻戒托盘狠狠掀翻在红地毯上，昂首与顾承冰冷对视。',
                dialogue: '这婚，我不结了。从今天起，顾林两家恩断义绝！',
                duration: 4.5,
                status: 'PROMPT_READY',
                keyframeUrl: '',
                videoUrl: '',
                notes: '提示词已编译完毕，可一键复制到即梦/可灵网页端生成'
              }
            ]
          },
          {
            id: 'SC02',
            sceneNumber: 2,
            location: '宴会厅幽暗大理石走廊',
            time: '夜',
            atmosphere: '冷色调顶灯、空旷回音、神秘莫测',
            shots: [
              {
                id: 'EP01-SC02-SH005',
                shotIndex: 5,
                name: '镜头 5 · 轮椅大佬陆沉初登场',
                shotSize: 'medium',
                shotSizeLabel: '中景 (Medium)',
                camera: 'zoom-in',
                cameraLabel: '平缓推进 (Zoom In)',
                characterId: 'CHAR_LUCHEN',
                outfitId: 'OUTFIT_LU_COAT',
                action:
                  '陆沉坐在轮椅上，戴着黑手套的指尖微抬，递上一块纯丝手帕，深邃黑眸凝视林晚。',
                dialogue: '林小姐，手脏了，擦擦吧。',
                duration: 3.5,
                status: 'DRAFT',
                keyframeUrl: '',
                videoUrl: '',
                notes: '第一集压轴留钩镜头'
              }
            ]
          }
        ]
      },
      {
        id: 'EP02',
        episodeNumber: 2,
        title: '顾家气急败坏，商界大地震',
        hook: '退婚丑闻光速登上同城热搜头条，顾氏股价开盘暴跌。',
        climax: '顾老爷子震怒砸杯，扬言全行业封杀林晚名下独立公司。',
        endingHook: '林晚在陆沉引荐下，直接截胡顾氏准备三个月的千万跨国独家代理权。',
        scenes: []
      }
    ]
  }
]

/**
 * Prompt 编译器：根据当前 Shot 的元数据、角色资产、服装与机位，编译出符合各大主流平台语法规范的高命中率提示词
 */
export function compilePromptForShot(shot, character, project, targetPlatform = 'seedance') {
  const charName = character?.name || '女主'
  const outfitDesc =
    character?.outfits?.find((o) => o.id === shot.outfitId)?.desc ||
    character?.outfits?.[0]?.desc ||
    '高定礼服'
  const action = shot.action || '冷冷注视前方'
  const cameraLabel = shot.cameraLabel || '平缓运镜'
  const shotSize = shot.shotSizeLabel || '中景'
  const format = project?.format === '9:16' ? '竖屏9:16' : '横屏16:9'

  if (targetPlatform === 'seedance') {
    // 即梦 / Seedance 规范：偏重中英结合、结构化描述、主体清晰度
    return [
      `【红果短剧原生镜头】${format}，${shotSize}，${cameraLabel}。`,
      `主体角色：${charName}，25岁东方女性，精致清冷五官，神情冷峻坚毅。`,
      `服装与造型：${outfitDesc}。`,
      `环境与光影：顾家顶级豪华宴会厅夜景，香槟色水晶灯微光折射，背景虚化光斑，电影感柔光。`,
      `核心动作表演：${action}。动作自然丝滑，面部微表情层次分明，眼神具有强烈叙事张力。`,
      `画面规格：8k高保真画质，细腻皮肤纹理，masterpiece，cinematic lighting，无多余手指，音画契合。`
    ].join('\n')
  }

  if (targetPlatform === 'kling') {
    // 快手可灵 Kling 规范：强调物理运镜与连贯性动作
    return [
      `Cinematic vertical short drama (${format}), ${shotSize}, ${cameraLabel}.`,
      `Character: ${charName}, elegant and cold Chinese woman, 25 years old.`,
      `Outfit: ${outfitDesc}.`,
      `Action: ${action}. The motion is fluid and mechanically accurate, intense eye contact.`,
      `Environment: luxury high-end banquet hall, warm ambient lights, photorealistic reflections, 4k ultra realistic, 60fps.`
    ].join('\n')
  }

  // 通义万相 / 海螺 通用规范
  return `红果高品质短剧微电影镜头，${shotSize}，${cameraLabel}。角色【${charName}】穿着${outfitDesc}。动作细节：${action}。环境为豪华现代宴会厅，电影质感布光，高动态范围，写实电影级人物质感。`
}

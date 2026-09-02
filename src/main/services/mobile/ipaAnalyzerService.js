import { exec } from 'child_process'
import {
  existsSync,
  statSync,
  readdirSync,
  readFileSync,
  rmSync,
  mkdtempSync
} from 'fs'
import { join, basename, extname } from 'path'
import { tmpdir } from 'os'
import { promisify } from 'util'

const execAsync = promisify(exec)

/**
 * Format bytes into human-readable string (KB, MB, GB)
 */
export function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 B'
  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i]
}

/**
 * Minimal Plist parser to extract string values from XML
 */
function extractPlistValue(xml, key) {
  if (!xml) return null
  const regex = new RegExp(`<key>${key}</key>\\s*<string>([\\s\\S]*?)</string>`, 'i')
  const match = xml.match(regex)
  return match ? match[1].trim() : null
}

const SECTION_DESCRIPTIONS = {
  __text: '机器指令代码 (Executable Machine Code)',
  __cstring: '常量只读字符串字面量 (Constant String Literals)',
  __const: '只读数据与常量 (Constant Data)',
  __objc_methname: 'Objective-C 方法名列表',
  __objc_classname: 'Objective-C 类名列表',
  __objc_methtype: 'Objective-C 方法签名类型',
  __objc_classlist: 'Objective-C 类定义指针列表',
  __objc_selrefs: 'Objective-C 选择子引用',
  __objc_data: 'Objective-C 类数据结构',
  __objc_const: 'Objective-C 只读类信息',
  __swift5_typeref: 'Swift 运行时类型引用元数据',
  __swift5_types: 'Swift 结构体/枚举/类元数据',
  __swift5_fieldmd: 'Swift 属性与字段元数据',
  __swift5_proto: 'Swift 协议遵循元数据',
  __swift5_reflstr: 'Swift 反射字符串',
  __data: '已初始化的全局变量与静态变量',
  __bss: '未初始化的全局变量占位',
  __debug_info: 'DWARF 核心调试符号与类型树',
  __debug_line: 'DWARF 源码行号与指令对应表',
  __debug_str: 'DWARF 调试符号字符串表',
  __debug_loc: 'DWARF 变量局部位置列表',
  __debug_abbrev: 'DWARF 缩写声明表',
  __unwind_info: '异常堆栈回溯与展开信息',
  __eh_frame: '异常处理帧信息',
  __oslogstring: '系统日志打印格式字符串'
}

const SEGMENT_DESCRIPTIONS = {
  __TEXT: '代码与只读段 (只读指令与元数据)',
  __DATA: '可读写数据段 (全局与静态变量)',
  __DATA_CONST: '只读数据常量段',
  __LINKEDIT: '动态链接与符号表 (符号表、重定位、签名)',
  __DWARF: 'DWARF 调试信息段 (未剥离的符号与行号)'
}

/**
 * Deep inspection of a Mach-O binary (.dylib, executable, framework binary)
 */
export async function inspectMachOBinary(binaryPath) {
  if (!existsSync(binaryPath)) return null
  try {
    // 1. Get architectures via lipo
    let architectures = []
    try {
      const { stdout: lipoOut } = await execAsync(`/usr/bin/lipo -info "${binaryPath}"`, { timeout: 6000 })
      const archMatch = lipoOut.match(/are:\s+(.*)$/m) || lipoOut.match(/architecture:\s+(.*)$/m)
      if (archMatch) {
        architectures = archMatch[1].trim().split(/\s+/)
      }
    } catch {}

    if (architectures.length === 0) {
      try {
        const { stdout: fileOut } = await execAsync(`/usr/bin/file "${binaryPath}"`, { timeout: 6000 })
        if (fileOut.includes('arm64')) architectures.push('arm64')
        if (fileOut.includes('x86_64')) architectures.push('x86_64')
        if (fileOut.includes('armv7')) architectures.push('armv7')
      } catch {}
    }

    // 2. Run size -m to get segment & section breakdown
    const segments = []
    const allSections = []
    let totalBinarySize = 0

    try {
      const { stdout: sizeOut } = await execAsync(`/usr/bin/size -m "${binaryPath}"`, { timeout: 8000 })
      const lines = sizeOut.split('\n')
      let currentSegment = null

      for (const line of lines) {
        const segMatch = line.match(/^Segment\s+([^:]+):\s+(\d+)/)
        if (segMatch) {
          const segName = segMatch[1].trim()
          const segSize = parseInt(segMatch[2], 10)
          if (segName !== '__PAGEZERO') {
            currentSegment = {
              name: segName,
              size: segSize,
              formattedSize: formatBytes(segSize),
              desc: SEGMENT_DESCRIPTIONS[segName] || 'Mach-O 数据段',
              sections: []
            }
            segments.push(currentSegment)
            totalBinarySize += segSize
          }
          continue
        }

        const secMatch = line.match(/^\s+Section\s+([^:]+):\s+(\d+)/)
        if (secMatch && currentSegment) {
          const secName = secMatch[1].trim()
          const secSize = parseInt(secMatch[2], 10)
          const secObj = {
            name: secName,
            segment: currentSegment.name,
            size: secSize,
            formattedSize: formatBytes(secSize),
            desc: SECTION_DESCRIPTIONS[secName] || '代码或数据节'
          }
          currentSegment.sections.push(secObj)
          allSections.push(secObj)
        }
      }

      // Calculate percentages for segments
      for (const seg of segments) {
        seg.percent = totalBinarySize > 0 ? ((seg.size / totalBinarySize) * 100).toFixed(1) : '0'
      }
    } catch {}

    // 3. Run otool -L to get linked dependencies
    const linkedLibraries = []
    try {
      const { stdout: otoolOut } = await execAsync(`/usr/bin/otool -L "${binaryPath}"`, { timeout: 8000 })
      const otoolLines = otoolOut.split('\n').slice(1)
      for (const line of otoolLines) {
        const trimmed = line.trim()
        if (trimmed) {
          const libPath = trimmed.split(' ')[0]
          if (libPath && libPath !== binaryPath) {
            linkedLibraries.push(libPath)
          }
        }
      }
    } catch {}

    // Sort sections by size descending
    allSections.sort((a, b) => b.size - a.size)

    const isDebug =
      binaryPath.toLowerCase().includes('.debug.') ||
      binaryPath.toLowerCase().includes('debug') ||
      segments.some((s) => s.name === '__DWARF') ||
      allSections.some((s) => s.name.startsWith('__debug_'))

    // Estimate stripping potential
    const dwarfSegment = segments.find((s) => s.name === '__DWARF')
    const linkeditSegment = segments.find((s) => s.name === '__LINKEDIT')
    let estimatedStripSavings = 0
    if (dwarfSegment) estimatedStripSavings += dwarfSegment.size
    if (isDebug && linkeditSegment) estimatedStripSavings += linkeditSegment.size * 0.6

    return {
      fileName: basename(binaryPath),
      architectures,
      isFatBinary: architectures.length > 1,
      isDebug,
      segments,
      topSections: allSections.slice(0, 16),
      linkedLibraries,
      hasDebugSymbols: isDebug || dwarfSegment !== undefined,
      estimatedStripSavings: formatBytes(estimatedStripSavings),
      stripCommand: `xcrun strip -x "${basename(binaryPath)}"`
    }
  } catch {
    return null
  }
}

/**
 * Recursive file scanner that deeply categorizes app bundle components
 */
function scanDirectory(dirPath, rootAppPath, executableName) {
  const result = {
    totalSize: 0,
    executableSize: 0,
    frameworksSize: 0,
    assetsSize: 0,
    fontsSize: 0,
    scriptsSize: 0,
    modelsSize: 0,
    dataSize: 0,
    mediaSize: 0,
    localizationSize: 0,
    bundlesSize: 0,
    pluginsSize: 0,
    otherSize: 0,
    frameworksList: [],
    bundlesList: [],
    allFiles: []
  }

  const FONT_EXTS = new Set(['.ttf', '.otf', '.ttc', '.woff', '.woff2'])
  const SCRIPT_EXTS = new Set(['.jsbundle', '.js', '.mjs', '.cjs', '.map', '.html', '.htm', '.css', '.wasm'])
  const MODEL_EXTS = new Set([
    '.mlmodelc',
    '.mlmodel',
    '.tflite',
    '.onnx',
    '.metallib',
    '.metal',
    '.usdz',
    '.scnassets',
    '.dae',
    '.obj',
    '.gltf'
  ])
  const DATA_EXTS = new Set(['.sqlite', '.sqlite3', '.db', '.realm', '.json', '.geojson', '.xml', '.csv', '.dat'])
  const LOCALIZATION_EXTS = new Set(['.strings', '.stringsdict', '.plist', '.mobileprovision', '.nib', '.storyboardc'])
  const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.svg', '.gif', '.heic', '.pdf', '.ico', '.bmp', '.tiff'])
  const MEDIA_EXTS = new Set(['.mp3', '.wav', '.m4a', '.caf', '.aac', '.mp4', '.mov', '.m4v', '.ogg'])

  function traverse(currentPath) {
    let entries = []
    try {
      entries = readdirSync(currentPath, { withFileTypes: true })
    } catch {
      return
    }

    for (const entry of entries) {
      const fullPath = join(currentPath, entry.name)
      const relPath = fullPath.replace(rootAppPath, '').replace(/^\//, '')

      if (entry.isSymbolicLink()) {
        continue
      }

      if (entry.isDirectory()) {
        // Special 1: Frameworks
        if (entry.name.endsWith('.framework')) {
          let fwSize = 0
          try {
            fwSize = calculateDirSize(fullPath)
          } catch {}
          result.frameworksSize += fwSize
          result.totalSize += fwSize

          // Look for inner binary
          const fwBinaryName = entry.name.replace('.framework', '')
          const innerBinaryPath = join(fullPath, fwBinaryName)

          result.frameworksList.push({
            name: entry.name,
            size: fwSize,
            path: relPath,
            fullPath: existsSync(innerBinaryPath) ? innerBinaryPath : fullPath,
            isFramework: true
          })
          result.allFiles.push({
            path: relPath,
            name: entry.name,
            size: fwSize,
            type: 'frameworks',
            ext: '.framework',
            fullPath: existsSync(innerBinaryPath) ? innerBinaryPath : fullPath
          })
          // Framework is an isolated binary entity, do not recurse inside
          continue
        } else if (entry.name.endsWith('.bundle')) {
          // Record bundle directory size for overview
          let bSize = 0
          try {
            bSize = calculateDirSize(fullPath)
          } catch {}
          result.bundlesList.push({
            name: entry.name,
            size: bSize,
            path: relPath
          })
          // Traverse inside .bundle to precisely categorize its inner fonts, images, scripts!
          traverse(fullPath)
          continue
        } else if (entry.name.endsWith('.mlmodelc') || entry.name.endsWith('.scnassets')) {
          let mSize = 0
          try {
            mSize = calculateDirSize(fullPath)
          } catch {}
          result.modelsSize += mSize
          result.totalSize += mSize
          result.allFiles.push({
            path: relPath,
            name: entry.name,
            size: mSize,
            type: 'models',
            ext: extname(entry.name).toLowerCase(),
            fullPath
          })
          continue
        } else {
          traverse(fullPath)
        }
      } else if (entry.isFile()) {
        let size = 0
        try {
          size = statSync(fullPath).size
        } catch {
          continue
        }

        result.totalSize += size
        const ext = extname(entry.name).toLowerCase()
        const isDebugName = entry.name.toLowerCase().includes('debug')

        let fileType = 'other'

        // Check if main executable
        if (entry.name === executableName && currentPath === rootAppPath) {
          result.executableSize += size
          fileType = 'executable'
        } else if (ext === '.dylib') {
          // Explicitly categorize .dylib into frameworks / dynamic libraries!
          result.frameworksSize += size
          fileType = 'frameworks'
          result.frameworksList.push({
            name: entry.name,
            size,
            path: relPath,
            isDylib: true,
            isDebug: isDebugName,
            fullPath
          })
        } else if (entry.name === 'Assets.car') {
          result.assetsSize += size
          fileType = 'assets'
        } else if (IMAGE_EXTS.has(ext)) {
          result.assetsSize += size
          fileType = 'assets'
        } else if (FONT_EXTS.has(ext)) {
          result.fontsSize += size
          fileType = 'fonts'
        } else if (SCRIPT_EXTS.has(ext) || entry.name === 'main.jsbundle' || entry.name.includes('.bundle')) {
          result.scriptsSize += size
          fileType = 'scripts'
        } else if (MODEL_EXTS.has(ext)) {
          result.modelsSize += size
          fileType = 'models'
        } else if (DATA_EXTS.has(ext)) {
          result.dataSize += size
          fileType = 'data'
        } else if (MEDIA_EXTS.has(ext)) {
          result.mediaSize += size
          fileType = 'media'
        } else if (LOCALIZATION_EXTS.has(ext) || relPath.includes('.lproj/')) {
          result.localizationSize += size
          fileType = 'localization'
        } else if (relPath.startsWith('PlugIns/')) {
          result.pluginsSize += size
          fileType = 'plugins'
        } else {
          result.otherSize += size
          fileType = 'other'
        }

        result.allFiles.push({
          path: relPath,
          name: entry.name,
          size,
          type: fileType,
          ext: ext || '(无后缀)',
          isDebug: isDebugName,
          fullPath
        })
      }
    }
  }

  traverse(rootAppPath)
  return result
}

function calculateDirSize(dirPath) {
  let size = 0
  const entries = readdirSync(dirPath, { withFileTypes: true })
  for (const entry of entries) {
    if (entry.isSymbolicLink()) continue
    const full = join(dirPath, entry.name)
    if (entry.isDirectory()) {
      size += calculateDirSize(full)
    } else if (entry.isFile()) {
      try {
        size += statSync(full).size
      } catch {}
    }
  }
  return size
}

/**
 * Deep inspection of Assets.car using macOS built-in assetutil
 */
export async function inspectAssetsCar(assetsCarPath) {
  if (!existsSync(assetsCarPath)) return null
  try {
    const { stdout } = await execAsync(`/usr/bin/assetutil -I "${assetsCarPath}"`, {
      maxBuffer: 20 * 1024 * 1024,
      timeout: 10000
    })
    const items = JSON.parse(stdout)
    if (!Array.isArray(items)) return null

    const assetSummary = []
    let totalRenditionCount = 0

    for (const item of items) {
      if (item.Name) {
        totalRenditionCount++
        assetSummary.push({
          name: item.Name,
          assetType: item.AssetType || 'Image',
          scale: item.Scale || 1,
          size: item.SizeOnDisk || 0,
          idiom: item.Idiom || 'universal'
        })
      }
    }

    return {
      renditionCount: totalRenditionCount,
      assets: assetSummary.slice(0, 100)
    }
  } catch {
    return null
  }
}

/**
 * Main Analyzer function
 * Accepts an .ipa, .app, or .zip file path
 */
export async function analyzeIpa(filePath) {
  if (!existsSync(filePath)) {
    return { success: false, error: `文件不存在: ${filePath}` }
  }

  const stat = statSync(filePath)
  const isDirectory = stat.isDirectory()
  const isIpa = filePath.toLowerCase().endsWith('.ipa') || filePath.toLowerCase().endsWith('.zip')
  const isApp = filePath.toLowerCase().endsWith('.app')

  if (!isIpa && !isApp && !isDirectory) {
    return { success: false, error: '不支持的文件格式，请提供 .ipa 安装包或 .app 应用程序目录' }
  }

  let tempDir = null
  let appBundlePath = null

  try {
    if (isIpa) {
      tempDir = mkdtempSync(join(tmpdir(), 'flywork-ipa-'))
      await execAsync(`/usr/bin/unzip -q -o "${filePath}" "Payload/*" -d "${tempDir}"`, {
        timeout: 60000
      })

      const payloadDir = join(tempDir, 'Payload')
      if (!existsSync(payloadDir)) {
        return { success: false, error: '解压失败: 未在 IPA 包中找到 Payload 目录' }
      }

      const apps = readdirSync(payloadDir).filter((f) => f.endsWith('.app'))
      if (apps.length === 0) {
        return { success: false, error: '未在 Payload 中检测到 .app 应用程序包' }
      }
      appBundlePath = join(payloadDir, apps[0])
    } else {
      appBundlePath = filePath
    }

    // 1. Parse Info.plist
    let appName = basename(appBundlePath, '.app')
    let bundleId = 'unknown'
    let version = '1.0.0'
    let buildNumber = '1'
    let minOsVersion = 'iOS 13.0'
    let executableName = appName

    const infoPlistPath = join(appBundlePath, 'Info.plist')
    if (existsSync(infoPlistPath)) {
      try {
        const rawPlist = readFileSync(infoPlistPath, 'utf-8')
        appName =
          extractPlistValue(rawPlist, 'CFBundleDisplayName') ||
          extractPlistValue(rawPlist, 'CFBundleName') ||
          appName
        bundleId = extractPlistValue(rawPlist, 'CFBundleIdentifier') || bundleId
        version = extractPlistValue(rawPlist, 'CFBundleShortVersionString') || version
        buildNumber = extractPlistValue(rawPlist, 'CFBundleVersion') || buildNumber
        minOsVersion = extractPlistValue(rawPlist, 'MinimumOSVersion') || minOsVersion
        executableName = extractPlistValue(rawPlist, 'CFBundleExecutable') || executableName
      } catch {}
    }

    // 2. Scan main executable file
    let architectures = []
    const execPath = join(appBundlePath, executableName)

    if (existsSync(execPath)) {
      try {
        const { stdout } = await execAsync(`/usr/bin/file "${execPath}"`)
        if (stdout.includes('arm64')) architectures.push('arm64')
        if (stdout.includes('x86_64')) architectures.push('x86_64')
        if (stdout.includes('armv7')) architectures.push('armv7')
      } catch {}
    }

    // 3. Deep Recursive directory scan with explicit classification
    const scan = scanDirectory(appBundlePath, appBundlePath, executableName)

    // 4. Sort frameworks by size descending
    scan.frameworksList.sort((a, b) => b.size - a.size)

    // 5. Sort all files for Top 50 largest files
    scan.allFiles.sort((a, b) => b.size - a.size)

    // Pre-inspect Mach-O binary structures for the top binaries (executables, dylibs, frameworks)
    const binaryCandidates = scan.allFiles.filter(
      (f) =>
        f.type === 'executable' ||
        f.type === 'frameworks' ||
        f.ext === '.dylib' ||
        f.name.endsWith('.dylib')
    )

    for (const binFile of binaryCandidates.slice(0, 10)) {
      if (binFile.fullPath && existsSync(binFile.fullPath)) {
        try {
          binFile.machOInfo = await inspectMachOBinary(binFile.fullPath)
        } catch {}
      }
    }

    // Also inspect main executable if found
    if (existsSync(execPath)) {
      try {
        const mainMachO = await inspectMachOBinary(execPath)
        const mainExecInFiles = scan.allFiles.find((f) => f.type === 'executable')
        if (mainExecInFiles) {
          mainExecInFiles.machOInfo = mainMachO
        }
      } catch {}
    }

    const topFiles = scan.allFiles.slice(0, 50)

    // 6. Optional Assets.car inspect
    let assetsCarInfo = null
    const assetsCarPath = join(appBundlePath, 'Assets.car')
    if (existsSync(assetsCarPath)) {
      assetsCarInfo = await inspectAssetsCar(assetsCarPath)
    }

    const compressedSize = isIpa ? stat.size : null
    const installedSize = scan.totalSize || 1

    // 7. Calculate Extension Breakdown
    const extMap = {}
    for (const f of scan.allFiles) {
      if (f.type === 'frameworks' && f.name.endsWith('.framework')) {
        extMap['.framework'] = (extMap['.framework'] || 0) + f.size
        continue
      }
      const ext = f.name === 'Assets.car' ? '.car' : f.ext || '(无后缀)'
      extMap[ext] = (extMap[ext] || 0) + f.size
    }

    const extensionBreakdown = Object.entries(extMap)
      .map(([ext, size]) => ({
        ext,
        size,
        formattedSize: formatBytes(size),
        percent: ((size / installedSize) * 100).toFixed(1)
      }))
      .sort((a, b) => b.size - a.size)

    // 8. Generate Intelligent Optimization Recommendations
    const recommendations = []

    // A. PRIORITY 1: Check for Debug dylibs / binaries
    const debugBinaries = scan.allFiles.filter(
      (f) =>
        (f.ext === '.dylib' || f.type === 'frameworks' || f.type === 'executable') &&
        (f.name.toLowerCase().includes('.debug.') || f.name.toLowerCase().includes('debug') || f.isDebug)
    )

    if (debugBinaries.length > 0) {
      const debugTotal = debugBinaries.reduce((s, f) => s + f.size, 0)
      const primaryDebug = debugBinaries[0]
      recommendations.push({
        type: 'danger',
        title: `🚨 检测到大型 Debug 调试版动态库: ${primaryDebug.name} (${primaryDebug.formattedSize || formatBytes(primaryDebug.size)})`,
        desc: `该动态库带有 .debug 标识，占总包体积 ${((debugTotal / installedSize) * 100).toFixed(1)}%！Debug 模式构建未启用编译器最高优化 (-O3)，且在 Mach-O 中保留了庞大的未剥离 DWARF 调试符号表与行号元数据。`,
        impact: `通过 Release 模式构建 + 符号剥离 (Strip)，预计可直接暴降 65% ~ 80% 体积 (直接减负约 ${formatBytes(debugTotal * 0.7)})！`,
        solution: `1. 确保使用 Release 方案打包 (Xcode -> Scheme -> Edit Scheme -> Archive 设为 Release)；2. 在 Build Settings 开启 "Strip Linked Product = YES" 与 "Deployment Postprocessing = YES"；3. 亦可在终端执行 strip 剥离命令: xcrun strip -x "${primaryDebug.name}"。`
      })
    }

    // B. Check for loose large images
    const largeLooseImages = scan.allFiles.filter(
      (f) => f.type === 'assets' && f.name !== 'Assets.car' && f.size > 150 * 1024
    )
    if (largeLooseImages.length > 0) {
      recommendations.push({
        type: 'warning',
        title: `检测到 ${largeLooseImages.length} 个大于 150KB 的散落图片`,
        desc: '散落存放在 Bundle 中的离散图片不会被 Assets.car 进行矢量化与切图压缩。',
        impact: `潜在可节省约 ${formatBytes(largeLooseImages.reduce((sum, i) => sum + i.size * 0.4, 0))}`,
        solution: '建议将散落图片迁移至 Xcode Assets Catalog (Images.xcassets) 中统一管理并启用压缩。'
      })
    }

    // C. Check for oversized frameworks (> 5MB)
    const heavyFrameworks = scan.frameworksList.filter((fw) => fw.size > 5 * 1024 * 1024)
    if (heavyFrameworks.length > 0) {
      recommendations.push({
        type: 'caution',
        title: `发现 ${heavyFrameworks.length} 个超大动态库 / SDK (> 5MB)`,
        desc: `以下库体积较大：${heavyFrameworks.map((f) => `${f.name} (${formatBytes(f.size)})`).join(', ')}。`,
        impact: `占总动态库体积 ${((heavyFrameworks.reduce((sum, f) => sum + f.size, 0) / (scan.frameworksSize || 1)) * 100).toFixed(1)}%`,
        solution: '检查是否引入了不需要的子模块，或考虑转为静态库 (Static Framework) 以便编译器执行死代码剥离。'
      })
    }

    // D. Check for source map (*.map) leaks in production bundle
    const mapFiles = scan.allFiles.filter((f) => f.ext === '.map' || f.name.endsWith('.js.map'))
    if (mapFiles.length > 0) {
      const mapTotal = mapFiles.reduce((s, f) => s + f.size, 0)
      recommendations.push({
        type: 'danger',
        title: `安装包中泄露了 Source Map 源码映射文件 (${mapFiles.length} 个)`,
        desc: 'Source Map 文件通常用于调试，不应打包进正式 IPA，不仅大幅膨胀体积，还存在源码泄漏安全隐患。',
        impact: `可直接移除并节省 ${formatBytes(mapTotal)}`,
        solution: '请在前端/打包配置（Webpack / Metro / Vite）中关闭生产环境 sourcemap 输出。'
      })
    }

    // E. Check for oversized custom fonts (> 2MB)
    const heavyFonts = scan.allFiles.filter((f) => f.type === 'fonts' && f.size > 2 * 1024 * 1024)
    if (heavyFonts.length > 0) {
      const fontTotal = heavyFonts.reduce((s, f) => s + f.size, 0)
      recommendations.push({
        type: 'warning',
        title: `检测到 ${heavyFonts.length} 个超大字体文件 (> 2MB)`,
        desc: `字体文件：${heavyFonts.map((f) => `${f.name} (${formatBytes(f.size)})`).join(', ')} 占比较大。中文字库通常包含两万多字形，绝大多数未在 App 中用到。`,
        impact: `子集化裁剪后潜在可节省约 ${formatBytes(fontTotal * 0.7)}`,
        solution: '建议使用字蛛 (Font-Spider) 或 Python fonttools 工具进行字体子集化 (Subsetting)，仅保留 App 常用字符。'
      })
    }

    // F. General health recommendation
    if (recommendations.length === 0) {
      recommendations.push({
        type: 'success',
        title: '安装包资产结构良好',
        desc: '未检测到 Debug 调试库残留、散落大图或超大字体，资源组织健康。',
        solution: '持续关注大版本发版时的第三方动态库增长即可。'
      })
    }

    return {
      success: true,
      appName,
      bundleId,
      version,
      buildNumber,
      minOsVersion,
      architectures: architectures.length > 0 ? architectures : ['arm64'],
      filePath,
      fileName: basename(filePath),
      isIpa,
      compressedSize,
      installedSize,
      formattedCompressedSize: compressedSize ? formatBytes(compressedSize) : 'N/A',
      formattedInstalledSize: formatBytes(installedSize),
      categories: {
        executable: {
          key: 'executable',
          label: '主可执行程序 (Mach-O)',
          size: scan.executableSize,
          formatted: formatBytes(scan.executableSize),
          percent: ((scan.executableSize / installedSize) * 100).toFixed(1),
          color: '#3b82f6',
          icon: '🧱',
          desc: 'App 核心原生编译二进制代码'
        },
        frameworks: {
          key: 'frameworks',
          label: '动态库 (Frameworks & Dylibs)',
          size: scan.frameworksSize,
          formatted: formatBytes(scan.frameworksSize),
          percent: ((scan.frameworksSize / installedSize) * 100).toFixed(1),
          count: scan.frameworksList.length,
          color: '#8b5cf6',
          icon: '📚',
          desc: '动态链接库 (.dylib) 与三方 SDK'
        },
        assets: {
          key: 'assets',
          label: '图片与设计资产',
          size: scan.assetsSize,
          formatted: formatBytes(scan.assetsSize),
          percent: ((scan.assetsSize / installedSize) * 100).toFixed(1),
          color: '#10b981',
          icon: '🎨',
          desc: 'Assets.car 及离散 PNG/JPG/WebP 图片'
        },
        fonts: {
          key: 'fonts',
          label: '字体文件 (Fonts)',
          size: scan.fontsSize,
          formatted: formatBytes(scan.fontsSize),
          percent: ((scan.fontsSize / installedSize) * 100).toFixed(1),
          color: '#f59e0b',
          icon: '🔤',
          desc: '.ttf, .otf, .ttc 等中英文字体文件'
        },
        scripts: {
          key: 'scripts',
          label: '代码包与 Web 资源',
          size: scan.scriptsSize,
          formatted: formatBytes(scan.scriptsSize),
          percent: ((scan.scriptsSize / installedSize) * 100).toFixed(1),
          color: '#06b6d4',
          icon: '💻',
          desc: 'React Native jsbundle, Web HTML/JS/CSS 等'
        },
        models: {
          key: 'models',
          label: 'AI 模型与着色器',
          size: scan.modelsSize,
          formatted: formatBytes(scan.modelsSize),
          percent: ((scan.modelsSize / installedSize) * 100).toFixed(1),
          color: '#a855f7',
          icon: '🤖',
          desc: 'CoreML 模型 (.mlmodelc), Metal 着色器, 3D 资产'
        },
        data: {
          key: 'data',
          label: '数据与数据库文件',
          size: scan.dataSize,
          formatted: formatBytes(scan.dataSize),
          percent: ((scan.dataSize / installedSize) * 100).toFixed(1),
          color: '#6366f1',
          icon: '🗄',
          desc: '.sqlite, .db, .json, .realm, .xml 等静态数据'
        },
        media: {
          key: 'media',
          label: '音视频多媒体',
          size: scan.mediaSize,
          formatted: formatBytes(scan.mediaSize),
          percent: ((scan.mediaSize / installedSize) * 100).toFixed(1),
          color: '#ec4899',
          icon: '🔊',
          desc: '.mp3, .wav, .caf, .mp4 等音频与视频'
        },
        localization: {
          key: 'localization',
          label: '多语言与配置信息',
          size: scan.localizationSize,
          formatted: formatBytes(scan.localizationSize),
          percent: ((scan.localizationSize / installedSize) * 100).toFixed(1),
          color: '#14b8a6',
          icon: '🌐',
          desc: '.strings, .stringsdict, .plist, 描述文件'
        },
        plugins: {
          key: 'plugins',
          label: 'App 扩展插件 (Extensions)',
          size: scan.pluginsSize,
          formatted: formatBytes(scan.pluginsSize),
          percent: ((scan.pluginsSize / installedSize) * 100).toFixed(1),
          color: '#0284c7',
          icon: '🧩',
          desc: 'Widget, NotificationService 等独立扩展'
        },
        other: {
          key: 'other',
          label: '其他未归类细碎文件',
          size: scan.otherSize,
          formatted: formatBytes(scan.otherSize),
          percent: ((scan.otherSize / installedSize) * 100).toFixed(1),
          color: '#64748b',
          icon: '📄',
          desc: '其他未归入上述细分门类的细碎文件'
        }
      },
      extensionBreakdown,
      frameworksList: scan.frameworksList.map((fw) => ({
        ...fw,
        formattedSize: formatBytes(fw.size),
        percent: ((fw.size / (scan.frameworksSize || 1)) * 100).toFixed(1)
      })),
      topFiles: topFiles.map((f) => ({
        ...f,
        formattedSize: formatBytes(f.size),
        percent: ((f.size / installedSize) * 100).toFixed(2)
      })),
      allFilesCount: scan.allFiles.length,
      allFiles: scan.allFiles.map((f) => ({
        ...f,
        formattedSize: formatBytes(f.size),
        percent: ((f.size / installedSize) * 100).toFixed(2)
      })),
      bundlesList: scan.bundlesList.map((b) => ({
        ...b,
        formattedSize: formatBytes(b.size)
      })),
      assetsCarInfo,
      recommendations
    }
  } catch (err) {
    return {
      success: false,
      error: `分析安装包失败: ${err.message}`
    }
  } finally {
    if (tempDir && existsSync(tempDir)) {
      try {
        rmSync(tempDir, { recursive: true, force: true })
      } catch {}
    }
  }
}

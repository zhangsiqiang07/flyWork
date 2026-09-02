import { exec } from 'child_process'
import { writeFileSync, readFileSync, unlinkSync, existsSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { promisify } from 'util'

const execAsync = promisify(exec)

/**
 * List all available iOS simulators from xcrun simctl
 */
export async function listSimulators() {
  try {
    const { stdout } = await execAsync('xcrun simctl list devices available -j', {
      timeout: 5000,
      encoding: 'utf-8'
    })

    const data = JSON.parse(stdout)
    const devicesMap = data.devices || {}
    const list = []

    for (const [runtimeKey, devices] of Object.entries(devicesMap)) {
      let runtimeName = runtimeKey.replace('com.apple.CoreSimulator.SimRuntime.', '').replace(/-/g, ' ')
      if (runtimeName.startsWith('iOS ')) {
        runtimeName = runtimeName.replace('iOS ', 'iOS ')
      }

      if (Array.isArray(devices)) {
        devices.forEach((dev) => {
          if (dev.isAvailable !== false) {
            list.push({
              udid: dev.udid,
              name: dev.name,
              state: dev.state, // 'Booted' | 'Shutdown'
              runtime: runtimeName,
              deviceType: dev.deviceTypeIdentifier ? dev.deviceTypeIdentifier.split('.').pop() : '',
              dataPath: dev.dataPath || null,
              logPath: dev.logPath || null,
              lastBootedAt: dev.lastBootedAt || null,
              isPhysical: false,
              kind: 'simulator'
            })
          }
        })
      }
    }

    // Sort: 'Booted' devices at the very top, then by name
    list.sort((a, b) => {
      if (a.state === 'Booted' && b.state !== 'Booted') return -1
      if (a.state !== 'Booted' && b.state === 'Booted') return 1
      return a.name.localeCompare(b.name)
    })

    return list
  } catch (err) {
    console.error('Failed to list simulators:', err)
    return []
  }
}

/**
 * List physical iOS devices (connected or paired via USB/WiFi) from xcrun devicectl
 */
export async function listPhysicalDevices() {
  const tmpFile = join(tmpdir(), `devicectl_${Date.now()}_${Math.random().toString(36).slice(2)}.json`)
  try {
    await execAsync(`xcrun devicectl list devices -j "${tmpFile}"`, {
      timeout: 5000,
      encoding: 'utf-8'
    })
    if (!existsSync(tmpFile)) return []
    const raw = readFileSync(tmpFile, 'utf-8')
    const data = JSON.parse(raw)
    const devices = data.result?.devices || []

    const list = devices.map((d) => {
      const isConnected = d.connectionProperties?.tunnelState === 'connected'
      const isPaired = d.connectionProperties?.pairingState === 'paired'

      return {
        udid: d.hardwareProperties?.udid || d.identifier,
        identifier: d.identifier,
        name: d.deviceProperties?.name || d.hardwareProperties?.marketingName || 'iPhone',
        marketingName: d.hardwareProperties?.marketingName || 'iPhone',
        productType: d.hardwareProperties?.productType || '',
        serialNumber: d.hardwareProperties?.serialNumber || '',
        ecid: d.hardwareProperties?.ecid ? String(d.hardwareProperties.ecid) : '',
        osVersion: d.deviceProperties?.osVersionNumber || '',
        osBuild: d.deviceProperties?.osBuildUpdate || '',
        developerMode: d.deviceProperties?.developerModeStatus || 'unknown',
        tunnelState: d.connectionProperties?.tunnelState || 'unavailable',
        pairingState: d.connectionProperties?.pairingState || 'unknown',
        state: isConnected ? 'Connected' : isPaired ? 'Paired' : 'Offline',
        isPhysical: true,
        kind: 'physical'
      }
    })

    // Sort: Connected (online) devices first, then paired, then by name
    list.sort((a, b) => {
      if (a.state === 'Connected' && b.state !== 'Connected') return -1
      if (a.state !== 'Connected' && b.state === 'Connected') return 1
      return a.name.localeCompare(b.name)
    })

    return list
  } catch (err) {
    console.error('Failed to list physical devices via devicectl:', err.message)
    return []
  } finally {
    if (existsSync(tmpFile)) {
      try { unlinkSync(tmpFile) } catch {}
    }
  }
}

/**
 * List all devices (simulators + physical devices)
 */
export async function listAllDevices() {
  const [simulators, physicalDevices] = await Promise.all([
    listSimulators(),
    listPhysicalDevices()
  ])
  return {
    simulators,
    physicalDevices
  }
}

/**
 * Boot simulator and bring up Simulator app
 */
export async function bootSimulator(udid) {
  try {
    await execAsync(`xcrun simctl boot "${udid}" 2>/dev/null || true`)
    await execAsync('open -a Simulator')
    return { success: true }
  } catch (err) {
    return { success: false, error: err.message }
  }
}

/**
 * Shutdown simulator
 */
export async function shutdownSimulator(udid) {
  try {
    await execAsync(`xcrun simctl shutdown "${udid}"`)
    return { success: true }
  } catch (err) {
    return { success: false, error: err.message }
  }
}

/**
 * Restart simulator
 */
export async function restartSimulator(udid) {
  try {
    await execAsync(`xcrun simctl shutdown "${udid}" 2>/dev/null || true`)
    await execAsync(`xcrun simctl boot "${udid}"`)
    await execAsync('open -a Simulator')
    return { success: true }
  } catch (err) {
    return { success: false, error: err.message }
  }
}

/**
 * Bring Simulator.app to foreground
 */
export async function openSimulatorApp() {
  try {
    await execAsync('open -a Simulator')
    return { success: true }
  } catch (err) {
    return { success: false, error: err.message }
  }
}

/**
 * Toggle appearance: dark / light
 */
export async function setAppearance(udid, appearance) {
  try {
    const mode = appearance === 'dark' ? 'dark' : 'light'
    await execAsync(`xcrun simctl ui "${udid}" appearance ${mode}`)
    return { success: true }
  } catch (err) {
    return { success: false, error: err.message }
  }
}

/**
 * Send simulated APNs push notification to simulator
 */
export async function sendPushNotification(udid, bundleId, payload) {
  const tmpFile = join(tmpdir(), `sim_push_${Date.now()}_${Math.random().toString(36).slice(2)}.json`)
  try {
    const jsonContent = typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2)
    writeFileSync(tmpFile, jsonContent, 'utf-8')
    await execAsync(`xcrun simctl push "${udid}" "${bundleId}" "${tmpFile}"`)
    return { success: true }
  } catch (err) {
    return { success: false, error: err.message }
  } finally {
    if (existsSync(tmpFile)) {
      try { unlinkSync(tmpFile) } catch {}
    }
  }
}

/**
 * Set GPS mock location
 */
export async function setLocation(udid, lat, lon) {
  try {
    await execAsync(`xcrun simctl location "${udid}" set ${lat},${lon}`)
    return { success: true }
  } catch (err) {
    return { success: false, error: err.message }
  }
}

/**
 * Clear GPS mock location
 */
export async function clearLocation(udid) {
  try {
    await execAsync(`xcrun simctl location "${udid}" clear`)
    return { success: true }
  } catch (err) {
    return { success: false, error: err.message }
  }
}

/**
 * Open URL or Deep Link in Simulator
 */
export async function openUrl(udid, url) {
  try {
    await execAsync(`xcrun simctl openurl "${udid}" "${url}"`)
    return { success: true }
  } catch (err) {
    return { success: false, error: err.message }
  }
}

/**
 * Install .app or .ipa onto simulator or physical device
 */
export async function installApp(udid, appPath, isPhysical = false) {
  try {
    if (isPhysical) {
      await execAsync(`xcrun devicectl device install app --device "${udid}" "${appPath}"`, {
        timeout: 90000
      })
    } else {
      await execAsync(`xcrun simctl install "${udid}" "${appPath}"`, {
        timeout: 45000
      })
    }
    return { success: true }
  } catch (err) {
    return { success: false, error: err.message }
  }
}

/**
 * Launch App on physical device or simulator
 */
export async function launchApp(udid, bundleId, isPhysical = false) {
  try {
    if (isPhysical) {
      await execAsync(`xcrun devicectl device process launch --device "${udid}" "${bundleId}"`, {
        timeout: 20000
      })
    } else {
      await execAsync(`xcrun simctl launch "${udid}" "${bundleId}"`, {
        timeout: 15000
      })
    }
    return { success: true }
  } catch (err) {
    return { success: false, error: err.message }
  }
}

/**
 * Get App sandbox container path (e.g. data path for Documents/Caches)
 */
export async function getAppContainer(udid, bundleId) {
  try {
    const { stdout } = await execAsync(`xcrun simctl get_app_container "${udid}" "${bundleId}" data`)
    const containerPath = stdout.trim()
    return { success: true, path: containerPath }
  } catch (err) {
    return { success: false, error: `未找到 ${bundleId} 的应用数据沙盒，应用可能尚未安装或运行过` }
  }
}

/**
 * Set simulator clipboard content
 */
export async function setClipboard(udid, text) {
  try {
    await execAsync(`printf "%s" "${text.replace(/"/g, '\\"')}" | xcrun simctl pbcopy "${udid}"`)
    return { success: true }
  } catch (err) {
    return { success: false, error: err.message }
  }
}

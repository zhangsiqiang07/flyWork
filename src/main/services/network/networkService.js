import { exec } from 'child_process'
import { networkInterfaces } from 'os'
import { promisify } from 'util'

const execAsync = promisify(exec)

/**
 * Retrieve all local network interfaces and identify primary Wi-Fi / LAN IP
 */
export async function getNetworkInterfaces() {
  const nets = networkInterfaces()
  const list = []
  let primaryIp = ''

  for (const [name, netList] of Object.entries(nets)) {
    if (!netList) continue
    for (const net of netList) {
      // Skip loopback and internal
      if (net.internal) continue

      const isIpv4 = net.family === 'IPv4' || net.family === 4
      const isWifi = name === 'en0'
      const isEthernet = name === 'en1' || name.startsWith('eth')

      const item = {
        name,
        address: net.address,
        family: isIpv4 ? 'IPv4' : 'IPv6',
        netmask: net.netmask,
        mac: net.mac,
        isWifi,
        isEthernet,
        cidr: net.cidr
      }

      list.push(item)

      // Guess primary LAN IP (prefer IPv4 on en0 or 192.168.x / 10.x / 172.x)
      if (isIpv4 && !primaryIp) {
        if (isWifi || net.address.startsWith('192.168.') || net.address.startsWith('10.')) {
          primaryIp = net.address
        }
      }
    }
  }

  // Fallback to any IPv4 if primary not set
  if (!primaryIp && list.length > 0) {
    const firstIpv4 = list.find((i) => i.family === 'IPv4')
    if (firstIpv4) primaryIp = firstIpv4.address
  }

  return {
    primaryIp: primaryIp || '127.0.0.1',
    interfaces: list
  }
}

/**
 * Check listen status of common developer ports
 */
export async function checkPorts(ports = [3000, 5173, 8080, 8081, 8888, 9090]) {
  const results = []

  for (const port of ports) {
    const pNum = parseInt(port, 10)
    if (isNaN(pNum) || pNum <= 0 || pNum > 65535) continue

    try {
      // lsof -nP -iTCP:3000 -sTCP:LISTEN
      const { stdout } = await execAsync(`/usr/sbin/lsof -nP -iTCP:${pNum} -sTCP:LISTEN`, {
        timeout: 3000
      })
      const lines = stdout.trim().split('\n')

      if (lines.length > 1) {
        // Output format: COMMAND   PID USER   FD   TYPE             DEVICE SIZE/OFF NODE NAME
        const parts = lines[1].trim().split(/\s+/)
        const command = parts[0] || 'Unknown'
        const pid = parseInt(parts[1], 10)
        const user = parts[2] || ''

        results.push({
          port: pNum,
          inUse: true,
          command,
          pid,
          user,
          description: `${command} (PID: ${pid}) 正在监听`
        })
      } else {
        results.push({
          port: pNum,
          inUse: false,
          description: '空闲可用'
        })
      }
    } catch {
      // lsof exits with 1 if no process is listening on this port
      results.push({
        port: pNum,
        inUse: false,
        description: '空闲可用'
      })
    }
  }

  return results
}

/**
 * Kill process occupying a port by PID
 */
export async function killPortProcess(pid) {
  const p = parseInt(pid, 10)
  if (isNaN(p) || p <= 1) {
    return { success: false, error: '无效的进程 PID' }
  }

  try {
    process.kill(p, 'SIGTERM')
    // Wait slightly, check if still alive, then SIGKILL if needed
    setTimeout(() => {
      try {
        process.kill(p, 'SIGKILL')
      } catch {}
    }, 500)

    return { success: true, message: `已向进程 ${p} 发送终止信号` }
  } catch (err) {
    // Try system kill command
    try {
      await execAsync(`kill -9 ${p}`)
      return { success: true, message: `已强制杀死进程 ${p}` }
    } catch (cmdErr) {
      return { success: false, error: `杀死进程失败: ${cmdErr.message}` }
    }
  }
}

/* eslint-disable react/prop-types */
import { useState, useEffect, useCallback } from 'react'

const DEFAULT_PORTS = [3000, 5173, 8080, 8081, 8888, 9090]

export default function NetworkHelper({ showToast }) {
  const [networkData, setNetworkData] = useState({ primaryIp: '', interfaces: [] })
  const [loadingNets, setLoadingNets] = useState(false)

  const [monitoredPorts, setMonitoredPorts] = useState(DEFAULT_PORTS)
  const [portStatuses, setPortStatuses] = useState([])
  const [loadingPorts, setLoadingPorts] = useState(false)
  const [customPortInput, setCustomPortInput] = useState('')
  const [killingPid, setKillingPid] = useState(null)

  // 1. Fetch network interfaces
  const loadInterfaces = useCallback(async () => {
    setLoadingNets(true)
    try {
      if (window.flywork?.networkGetInterfaces) {
        const res = await window.flywork.networkGetInterfaces()
        setNetworkData(res || { primaryIp: '127.0.0.1', interfaces: [] })
      }
    } catch (err) {
      showToast?.(`获取网络接口失败: ${err.message}`)
    } finally {
      setLoadingNets(false)
    }
  }, [showToast])

  // 2. Scan ports
  const scanPorts = useCallback(
    async (portsToScan = monitoredPorts) => {
      setLoadingPorts(true)
      try {
        if (window.flywork?.networkCheckPorts) {
          const res = await window.flywork.networkCheckPorts(portsToScan)
          setPortStatuses(Array.isArray(res) ? res : [])
        }
      } catch (err) {
        showToast?.(`检测端口占用失败: ${err.message}`)
      } finally {
        setLoadingPorts(false)
      }
    },
    [monitoredPorts, showToast]
  )

  useEffect(() => {
    loadInterfaces()
    scanPorts()
  }, [loadInterfaces, scanPorts])

  // Copy text helper
  const copyText = (text, label) => {
    if (!text) return
    navigator.clipboard.writeText(text)
    showToast?.(`✓ 已复制 ${label}: ${text}`)
  }

  // Kill occupying process
  const handleKillProcess = async (pid, port) => {
    if (!pid) return
    setKillingPid(pid)
    try {
      if (window.flywork?.networkKillPortProcess) {
        const res = await window.flywork.networkKillPortProcess(pid)
        if (res?.success) {
          showToast?.(`✓ 成功释放端口 ${port} (PID: ${pid})`)
          setTimeout(() => scanPorts(), 600)
        } else {
          showToast?.(`释放失败: ${res?.error || '未知错误'}`)
        }
      }
    } catch (err) {
      showToast?.(`操作异常: ${err.message}`)
    } finally {
      setKillingPid(null)
    }
  }

  // Add custom port
  const handleAddPort = () => {
    const p = parseInt(customPortInput.trim(), 10)
    if (isNaN(p) || p <= 0 || p > 65535) {
      showToast?.('请输入 1 - 65535 之间的合法端口号')
      return
    }
    if (monitoredPorts.includes(p)) {
      showToast?.(`端口 ${p} 已在监控列表中`)
      return
    }
    const nextPorts = [...monitoredPorts, p].sort((a, b) => a - b)
    setMonitoredPorts(nextPorts)
    setCustomPortInput('')
    scanPorts(nextPorts)
    showToast?.(`已添加端口 ${p} 并开始检测`)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* 1. LAN IP & Network Interfaces Card */}
      <div className="card" style={{ padding: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 16 }}>🌐</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
              本机局域网 IP 与网络接口
            </span>
          </div>

          <button
            className="btn btn-secondary btn-sm"
            onClick={loadInterfaces}
            disabled={loadingNets}
            style={{ fontSize: 11, height: 26, gap: 4 }}
          >
            <span style={{ display: 'inline-block', animation: loadingNets ? 'spin 1s linear infinite' : 'none' }}>
              🔄
            </span>
            <span>刷新接口</span>
          </button>
        </div>

        {/* Primary Recommended IP Hero Box */}
        <div
          style={{
            padding: '14px 18px',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12,
            marginBottom: 14
          }}
        >
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
              推荐真机 / 局域网连接 IP (Primary Wi-Fi):
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 22, fontWeight: 700, fontFamily: 'monospace', color: 'var(--accent-blue)' }}>
                {networkData.primaryIp || '127.0.0.1'}
              </span>
              <span className="badge" style={{ background: 'var(--accent-green-dim)', color: 'var(--accent-green)', fontSize: 10 }}>
                ● 当前活动
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => copyText(networkData.primaryIp, '局域网 IP')}
              style={{ fontSize: 12, height: 32, gap: 6 }}
            >
              <span>📋</span>
              <span>复制 IP 地址</span>
            </button>
          </div>
        </div>

        {/* Other interfaces table */}
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>
          全部物理与虚拟网卡清单 ({networkData.interfaces.length})
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {networkData.interfaces.map((net, idx) => (
            <div
              key={idx}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '6px 12px',
                background: 'var(--bg-base)',
                borderRadius: 'var(--radius-sm)',
                fontSize: 11
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="badge" style={{ fontSize: 10, background: 'var(--bg-hover)' }}>
                  {net.name}
                </span>
                <span style={{ fontWeight: 600, fontFamily: 'monospace', color: 'var(--text-primary)' }}>
                  {net.address}
                </span>
                <span style={{ color: 'var(--text-muted)' }}>({net.family})</span>
                {net.isWifi && (
                  <span className="badge" style={{ background: 'var(--accent-blue-dim)', color: 'var(--accent-blue)', fontSize: 9 }}>
                    Wi-Fi
                  </span>
                )}
                {net.isEthernet && (
                  <span className="badge" style={{ background: 'var(--accent-purple-dim)', color: 'var(--accent-purple)', fontSize: 9 }}>
                    有线以太网
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {net.mac && net.mac !== '00:00:00:00:00:00' && (
                  <span style={{ color: 'var(--text-muted)', fontFamily: 'monospace' }}>MAC: {net.mac}</span>
                )}
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => copyText(net.address, 'IP')}
                  style={{ fontSize: 10, height: 22, padding: '1px 6px' }}
                >
                  复制
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 2. Developer Ports Inspector & Process Killer */}
      <div className="card" style={{ padding: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 16 }}>🔌</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
              常用开发端口冲突检测与一键释放
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ display: 'flex', gap: 4 }}>
              <input
                type="number"
                className="input"
                value={customPortInput}
                onChange={(e) => setCustomPortInput(e.target.value)}
                placeholder="自定义端口 (如 4000)"
                style={{ width: 140, fontSize: 11, height: 26, padding: '2px 8px' }}
                onKeyDown={(e) => e.key === 'Enter' && handleAddPort()}
              />
              <button className="btn btn-secondary btn-sm" onClick={handleAddPort} style={{ fontSize: 11, height: 26 }}>
                + 添加
              </button>
            </div>

            <button
              className="btn btn-secondary btn-sm"
              onClick={() => scanPorts()}
              disabled={loadingPorts}
              style={{ fontSize: 11, height: 26, gap: 4 }}
            >
              <span style={{ display: 'inline-block', animation: loadingPorts ? 'spin 1s linear infinite' : 'none' }}>
                🔄
              </span>
              <span>重新扫描</span>
            </button>
          </div>
        </div>

        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12, lineHeight: 1.5 }}>
          移动端与前端开发经常遇到 <code>Port 3000/5173/8080/8081 is already in use</code> 的僵尸进程占用问题。在此可一目了然定位占用程序并一键强制释放。
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {portStatuses.map((p) => {
            const isKillThis = killingPid === p.pid
            return (
              <div
                key={p.port}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  background: p.inUse ? 'rgba(239, 68, 68, 0.06)' : 'var(--bg-elevated)',
                  border: `1px solid ${p.inUse ? 'rgba(239, 68, 68, 0.3)' : 'var(--border)'}`,
                  borderRadius: 'var(--radius-sm)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span
                    style={{
                      fontFamily: 'monospace',
                      fontSize: 14,
                      fontWeight: 700,
                      color: p.inUse ? 'var(--accent-red)' : 'var(--accent-green)',
                      width: 50
                    }}
                  >
                    :{p.port}
                  </span>

                  <span
                    className="badge"
                    style={{
                      fontSize: 10,
                      background: p.inUse ? 'var(--accent-red-dim)' : 'var(--accent-green-dim)',
                      color: p.inUse ? 'var(--accent-red)' : 'var(--accent-green)'
                    }}
                  >
                    {p.inUse ? '● 正在被占用' : '○ 空闲可用'}
                  </span>

                  <span style={{ fontSize: 12, color: 'var(--text-primary)' }}>
                    {p.inUse ? (
                      <span>
                        进程：<strong>{p.command}</strong> (PID: <code>{p.pid}</code>) · 用户: <code>{p.user}</code>
                      </span>
                    ) : (
                      <span style={{ color: 'var(--text-muted)' }}>端口未被任何程序监听</span>
                    )}
                  </span>
                </div>

                {p.inUse && (
                  <button
                    className="btn btn-sm"
                    onClick={() => handleKillProcess(p.pid, p.port)}
                    disabled={isKillThis}
                    style={{
                      fontSize: 11,
                      height: 26,
                      background: 'var(--accent-red)',
                      color: '#fff',
                      border: 'none',
                      gap: 4
                    }}
                  >
                    <span>⚡️</span>
                    <span>{isKillThis ? '正在释放...' : '一键释放端口'}</span>
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* 3. Mobile Wi-Fi HTTP Proxy Setup Guide */}
      <div className="card" style={{ padding: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <span style={{ fontSize: 16 }}>📲</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
            移动端真机 Wi-Fi 抓包代理配置指南 (Charles / Proxyman)
          </span>
        </div>

        <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 12 }}>
          真机联调网络请求或接口抓包时，需在 iPhone 上将 Wi-Fi 代理指向当前 Mac 本机：
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div style={{ padding: 12, background: 'var(--bg-elevated)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Charles 默认抓包配置</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
              服务器：<code>{networkData.primaryIp || '192.168.x.x'}</code> · 端口：<code>8888</code>
            </div>
          </div>

          <div style={{ padding: 12, background: 'var(--bg-elevated)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Proxyman 默认抓包配置</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
              服务器：<code>{networkData.primaryIp || '192.168.x.x'}</code> · 端口：<code>9090</code>
            </div>
          </div>
        </div>

        <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.6 }}>
          <strong>操作步骤：</strong>
          <ol style={{ margin: '4px 0 0 0', paddingLeft: 18 }}>
            <li>确保 iPhone 与本 Mac 连接在同一个 Wi-Fi 无线路由器下；</li>
            <li>在 iPhone 打开「设置」→「无线局域网」→ 点击当前 Wi-Fi 旁的 <code>(i)</code> 详情图标；</li>
            <li>向下滑动至底部，点击「配置代理」选择「手动」；</li>
            <li>在服务器输入框填入上述 IP，端口填写 <code>8888</code> 或 <code>9090</code> 并保存；</li>
            <li>iPhone Safari 浏览器访问 <code>chls.pro/ssl</code> 或 <code>proxy.man/ssl</code> 安装并信任证书即可。</li>
          </ol>
        </div>
      </div>
    </div>
  )
}

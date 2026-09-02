/* eslint-disable react/prop-types */
import { useState } from 'react'
import SimulatorToolbox from './SimulatorToolbox'
import ProvisioningProfiles from './ProvisioningProfiles'
import CrashAnalysis from './CrashAnalysis'
import UniversalLink from './UniversalLink'
import IpaAnalyzer from '../components/IpaAnalyzer'

const IOS_TABS = [
  { id: 'simulator', label: '设备与模拟器', icon: '📱' },
  { id: 'provisioning', label: '描述文件与证书', icon: '🔏' },
  { id: 'ipa-analyzer', label: 'IPA 体积分析', icon: '📦' },
  { id: 'crash', label: '崩溃符号化', icon: '💥' },
  { id: 'universal-link', label: '通用链接自检', icon: '🔗' }
]

export default function IOSToolbox({
  initialTab = 'simulator',
  workspaces = [],
  selectedWorkspaceId = null
}) {
  // Normalize tab
  const resolveTab = (tab) => {
    if (tab === 'provisioning' || tab === 'profiles') return 'provisioning'
    if (tab === 'ipa' || tab === 'ipa-analyzer') return 'ipa-analyzer'
    if (tab === 'crash') return 'crash'
    if (tab === 'universal-link') return 'universal-link'
    return 'simulator'
  }

  const [activeTab, setActiveTab] = useState(resolveTab(initialTab))
  const [prevInitialTab, setPrevInitialTab] = useState(initialTab)

  if (initialTab !== prevInitialTab) {
    setPrevInitialTab(initialTab)
    setActiveTab(resolveTab(initialTab))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Unified iOS Toolbox Top Header */}
      <div
        style={{
          padding: '12px 20px 0 20px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--bg-card)',
          flexShrink: 0
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 10
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: 'rgba(56, 139, 253, 0.15)',
                color: 'var(--accent-blue)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 18
              }}
            >
              🍎
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>
                iOS 研发工具箱
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                真机与模拟器控制 · 描述文件与证书 · 崩溃符号化解析 · Apple 通用链接校验
              </div>
            </div>
          </div>
        </div>

        {/* Tab navigation buttons */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
          {IOS_TABS.map((tab) => {
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                className={`btn btn-sm ${isActive ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setActiveTab(tab.id)}
                style={{ fontSize: 12, gap: 6, height: 28 }}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Persistent view containers (preserves inner states across tab switches) */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        <div
          style={{
            display: activeTab === 'simulator' ? 'flex' : 'none',
            height: '100%',
            flexDirection: 'column'
          }}
        >
          <SimulatorToolbox hideHeader={true} />
        </div>
        <div
          style={{
            display: activeTab === 'provisioning' ? 'flex' : 'none',
            height: '100%',
            flexDirection: 'column'
          }}
        >
          <ProvisioningProfiles hideHeader={true} />
        </div>
        <div
          style={{
            display: activeTab === 'ipa-analyzer' ? 'block' : 'none',
            height: '100%',
            overflowY: 'auto'
          }}
        >
          <IpaAnalyzer />
        </div>
        <div
          style={{
            display: activeTab === 'crash' ? 'block' : 'none',
            height: '100%'
          }}
        >
          <CrashAnalysis hideHeader={true} />
        </div>
        <div
          style={{
            display: activeTab === 'universal-link' ? 'block' : 'none',
            height: '100%'
          }}
        >
          <UniversalLink
            hideHeader={true}
            workspaces={workspaces}
            selectedWorkspaceId={selectedWorkspaceId}
          />
        </div>
      </div>
    </div>
  )
}

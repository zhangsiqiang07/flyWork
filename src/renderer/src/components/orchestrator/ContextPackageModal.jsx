import { useState } from 'react'

export default function ContextPackageModal({ isOpen, onClose, task, contextPackage }) {
  const [activeTab, setActiveTab] = useState('summary')
  const [copied, setCopied] = useState(false)

  if (!isOpen || !task) return null

  const handleCopyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(contextPackage, null, 2))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.7)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: 20
      }}
    >
      <div
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-xl)',
          width: '100%',
          maxWidth: 720,
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: 'var(--shadow-xl)',
          overflow: 'hidden'
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '14px 18px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--bg-elevated)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 20 }}>📦</span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                Task Context Package: {task.id}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                由 Context Builder 独立装配的最小隔离上下文切片
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary)',
              fontSize: 18,
              cursor: 'pointer'
            }}
          >
            ✕
          </button>
        </div>

        {/* Tab Selector */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)' }}>
          {[
            { id: 'summary', label: '切片结构概览' },
            { id: 'raw', label: 'Raw JSON Package' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                flex: 1,
                padding: '8px 0',
                background: 'transparent',
                border: 'none',
                borderBottom: activeTab === tab.id ? '2px solid var(--accent-blue)' : '2px solid transparent',
                color: activeTab === tab.id ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontSize: 12,
                fontWeight: activeTab === tab.id ? 600 : 400,
                cursor: 'pointer'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          {activeTab === 'summary' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Section 1: PRD Snippet */}
              <div style={{ background: 'var(--bg-elevated)', padding: '12px', borderRadius: 6, border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent-blue)', marginBottom: 6 }}>
                  📋 1. PRD 需求切片 (§ {contextPackage?.prdSnippet?.sectionId || '3.2'})
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.5 }}>
                  {contextPackage?.prdSnippet?.content || '包含对应状态流、分页拉取与离线读取规则。'}
                </div>
              </div>

              {/* Section 2: API Contract */}
              <div style={{ background: 'var(--bg-elevated)', padding: '12px', borderRadius: 6, border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#a371f7', marginBottom: 6 }}>
                  🔌 2. API 接口契约
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-primary)', fontFamily: 'monospace' }}>
                  {contextPackage?.apiContract ? (
                    <div>
                      <div>Endpoint: {contextPackage.apiContract.endpoint}</div>
                      <div>Operation: {contextPackage.apiContract.operationId}</div>
                    </div>
                  ) : (
                    '无外部直接 API 依赖'
                  )}
                </div>
              </div>

              {/* Section 3: Rules & Skills */}
              <div style={{ background: 'var(--bg-elevated)', padding: '12px', borderRadius: 6, border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent-green)', marginBottom: 6 }}>
                  📐 3. 注入的 Rules 与 Skills
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {(contextPackage?.rules || ['rules/architecture.md']).map((r, i) => (
                    <span
                      key={i}
                      style={{
                        fontSize: 11,
                        background: 'rgba(63,185,80,0.1)',
                        color: 'var(--accent-green)',
                        padding: '2px 8px',
                        borderRadius: 4
                      }}
                    >
                      Rule: {r}
                    </span>
                  ))}
                  {(contextPackage?.skills || ['ios-mvvm']).map((s, i) => (
                    <span
                      key={i}
                      style={{
                        fontSize: 11,
                        background: 'rgba(79,158,248,0.1)',
                        color: 'var(--accent-blue)',
                        padding: '2px 8px',
                        borderRadius: 4
                      }}
                    >
                      Skill: {s}
                    </span>
                  ))}
                </div>
              </div>

              {/* Section 4: Upstream Contracts */}
              <div style={{ background: 'var(--bg-elevated)', padding: '12px', borderRadius: 6, border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#d29922', marginBottom: 6 }}>
                  🔗 4. 前置任务产出与上游契约
                </div>
                {contextPackage?.upstreamContracts?.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {contextPackage.upstreamContracts.map((u, i) => (
                      <div key={i} style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                        • <span style={{ color: 'var(--accent-blue)', fontFamily: 'monospace' }}>{u.taskId}</span>: {u.title}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>无上游生成契约</div>
                )}
              </div>
            </div>
          ) : (
            <pre
              style={{
                background: 'var(--bg-elevated)',
                padding: '12px',
                borderRadius: 6,
                fontSize: 11,
                color: 'var(--text-primary)',
                fontFamily: 'monospace',
                overflowX: 'auto',
                border: '1px solid var(--border)'
              }}
            >
              {JSON.stringify(contextPackage, null, 2)}
            </pre>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '12px 20px',
            borderTop: '1px solid var(--border)',
            background: 'var(--bg-elevated)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <button
            onClick={handleCopyJson}
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
              padding: '6px 12px',
              borderRadius: 'var(--radius-md)',
              fontSize: 12,
              cursor: 'pointer'
            }}
          >
            {copied ? '✓ 已复制 JSON' : '📋 复制 JSON 切片'}
          </button>

          <button
            onClick={onClose}
            style={{
              background: 'var(--accent-blue)',
              border: 'none',
              color: '#fff',
              padding: '6px 16px',
              borderRadius: 'var(--radius-md)',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  )
}

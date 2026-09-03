import { useState, useMemo } from 'react'

export default function FeatureTreePanel({
  requirement,
  projects = [],
  tasks = [],
  selectedNode,
  onSelectNode,
  statusFilter,
  onStatusFilterChange,
  searchQuery,
  onSearchChange
}) {
  const [expandedNodes, setExpandedNodes] = useState(
    new Set([
      'req-root',
      'feat-HealthReport',
      'proj-PetPal-iOS',
      'proj-PetPal-Backend',
      'proj-PetPal-Android'
    ])
  )

  const toggleExpand = (id) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Build tree structure
  const treeData = useMemo(() => {
    const featureMap = {}

    tasks.forEach((t) => {
      const fName = t.feature || 'GeneralFeature'
      const pName = t.project || 'GeneralProject'
      const domainName = t.page_or_domain || 'GeneralDomain'
      const layerName = t.layer || 'core'

      if (!featureMap[fName]) {
        featureMap[fName] = { id: `feat-${fName}`, name: fName, projects: {} }
      }
      if (!featureMap[fName].projects[pName]) {
        featureMap[fName].projects[pName] = { id: `proj-${pName}`, name: pName, domains: {} }
      }
      if (!featureMap[fName].projects[pName].domains[domainName]) {
        featureMap[fName].projects[pName].domains[domainName] = {
          id: `domain-${pName}-${domainName}`,
          name: domainName,
          layers: {}
        }
      }
      if (!featureMap[fName].projects[pName].domains[domainName].layers[layerName]) {
        featureMap[fName].projects[pName].domains[domainName].layers[layerName] = {
          id: `layer-${pName}-${domainName}-${layerName}`,
          name: layerName,
          tasks: []
        }
      }

      featureMap[fName].projects[pName].domains[domainName].layers[layerName].tasks.push(t)
    })

    return featureMap
  }, [tasks])

  return (
    <div
      style={{
        width: 220,
        minWidth: 180,
        maxWidth: 250,
        height: '100%',
        background: 'var(--bg-surface)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0
      }}
    >
      {/* Panel Title & Search */}
      <div
        style={{
          padding: '12px 14px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          gap: 8
        }}
      >
        <div
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: 'var(--text-secondary)',
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}
        >
          工程领域架构树 (Hierarchy)
        </div>

        {/* Search Filter */}
        <input
          type="text"
          placeholder="搜索功能 / 页面 / 任务..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          style={{
            width: '100%',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            padding: '6px 10px',
            fontSize: 12,
            color: 'var(--text-primary)',
            outline: 'none'
          }}
        />

        {/* Status Filter Chips */}
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {[
            { id: 'ALL', label: '全部' },
            { id: 'READY', label: '⚡就绪' },
            { id: 'WAITING', label: '⏳等待' },
            { id: 'BLOCKED', label: '⛔阻塞' },
            { id: 'DONE', label: '✓已完' }
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => onStatusFilterChange(f.id)}
              style={{
                fontSize: 11,
                padding: '2px 7px',
                borderRadius: 10,
                background: statusFilter === f.id ? 'var(--accent-blue-dim)' : 'transparent',
                color: statusFilter === f.id ? 'var(--accent-blue)' : 'var(--text-secondary)',
                border:
                  statusFilter === f.id ? '1px solid var(--accent-blue)' : '1px solid transparent',
                cursor: 'pointer',
                fontWeight: statusFilter === f.id ? 600 : 400
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tree Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 6px' }}>
        {/* Requirement Root */}
        <div
          style={{
            padding: '6px 8px',
            borderRadius: 'var(--radius-md)',
            background: 'rgba(79,158,248,0.06)',
            marginBottom: 6,
            border: '1px solid rgba(79,158,248,0.15)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 13 }}>📋</span>
            <span
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--text-primary)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}
            >
              {requirement?.title || '宠物健康报告与应激分析'}
            </span>
          </div>
          <div
            style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 2, paddingLeft: 20 }}
          >
            REQ-2026-003 · v2.4 Active
          </div>
        </div>

        {/* Feature Branches */}
        {Object.entries(treeData).map(([fName, feature]) => {
          const isFeatExp = expandedNodes.has(feature.id)
          return (
            <div key={feature.id} style={{ marginBottom: 4 }}>
              <div
                onClick={() => toggleExpand(feature.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '5px 8px',
                  borderRadius: 4,
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  background: isFeatExp ? 'rgba(255,255,255,0.03)' : 'transparent'
                }}
              >
                <span style={{ fontSize: 10, color: 'var(--text-secondary)', width: 12 }}>
                  {isFeatExp ? '▼' : '▶'}
                </span>
                <span>✨ {fName}</span>
              </div>

              {/* Projects under Feature */}
              {isFeatExp && (
                <div style={{ paddingLeft: 14 }}>
                  {Object.entries(feature.projects).map(([pName, proj]) => {
                    const isProjExp = expandedNodes.has(proj.id)
                    const projTaskCount = Object.values(proj.domains).reduce(
                      (acc, d) =>
                        acc + Object.values(d.layers).reduce((lAcc, l) => lAcc + l.tasks.length, 0),
                      0
                    )

                    return (
                      <div key={proj.id} style={{ marginTop: 2 }}>
                        <div
                          onClick={() => toggleExpand(proj.id)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '4px 6px',
                            borderRadius: 4,
                            cursor: 'pointer',
                            fontSize: 11,
                            fontWeight: 600,
                            color: 'var(--accent-blue)'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: 9, color: 'var(--text-secondary)' }}>
                              {isProjExp ? '▼' : '▶'}
                            </span>
                            <span>📁 {pName}</span>
                          </div>
                          <span
                            style={{
                              fontSize: 10,
                              background: 'var(--bg-elevated)',
                              padding: '1px 6px',
                              borderRadius: 8,
                              color: 'var(--text-secondary)'
                            }}
                          >
                            {projTaskCount}
                          </span>
                        </div>

                        {/* Domains / Pages */}
                        {isProjExp && (
                          <div style={{ paddingLeft: 12 }}>
                            {Object.entries(proj.domains).map(([dName, domain]) => {
                              const isDomainExp = expandedNodes.has(domain.id)
                              return (
                                <div key={domain.id} style={{ marginTop: 2 }}>
                                  <div
                                    onClick={() => toggleExpand(domain.id)}
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: 4,
                                      padding: '3px 6px',
                                      fontSize: 11,
                                      color: 'var(--text-primary)',
                                      cursor: 'pointer'
                                    }}
                                  >
                                    <span style={{ fontSize: 8, color: 'var(--text-secondary)' }}>
                                      {isDomainExp ? '▼' : '▶'}
                                    </span>
                                    <span>📑 {dName}</span>
                                  </div>

                                  {/* Layers */}
                                  {isDomainExp && (
                                    <div style={{ paddingLeft: 12 }}>
                                      {Object.entries(domain.layers).map(([lName, layer]) => {
                                        const isSelected = selectedNode === layer.id
                                        return (
                                          <div
                                            key={layer.id}
                                            onClick={() => onSelectNode(layer.id, layer)}
                                            style={{
                                              display: 'flex',
                                              alignItems: 'center',
                                              justifyContent: 'space-between',
                                              padding: '3px 8px',
                                              borderRadius: 4,
                                              fontSize: 11,
                                              cursor: 'pointer',
                                              background: isSelected
                                                ? 'var(--accent-blue-dim)'
                                                : 'transparent',
                                              color: isSelected
                                                ? 'var(--accent-blue)'
                                                : 'var(--text-secondary)'
                                            }}
                                          >
                                            <span
                                              style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 4
                                              }}
                                            >
                                              <span
                                                style={{
                                                  width: 5,
                                                  height: 5,
                                                  borderRadius: '50%',
                                                  background:
                                                    lName === 'domain'
                                                      ? '#10a37f'
                                                      : lName === 'data'
                                                        ? '#8b5cf6'
                                                        : lName === 'state'
                                                          ? '#3b82f6'
                                                          : lName === 'ui'
                                                            ? '#06b6d4'
                                                            : '#d97706'
                                                }}
                                              />
                                              {lName}
                                            </span>
                                            <span style={{ fontSize: 10, opacity: 0.8 }}>
                                              {layer.tasks.length}
                                            </span>
                                          </div>
                                        )
                                      })}
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

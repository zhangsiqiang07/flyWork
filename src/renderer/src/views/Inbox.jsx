import { useState } from 'react'

const TYPE_CONFIG = {
  url: { label: '链接', icon: '🔗', color: 'var(--accent-blue)', bg: 'var(--accent-blue-dim)' },
  note: { label: '笔记', icon: '📝', color: 'var(--accent-amber)', bg: 'var(--accent-amber-dim)' },
  bug: { label: 'Bug', icon: '🐛', color: 'var(--accent-red)', bg: 'var(--accent-red-dim)' },
  clip: { label: '剪贴板', icon: '📋', color: 'var(--accent-purple)', bg: 'var(--accent-purple-dim)' },
  file: { label: '文件', icon: '📄', color: 'var(--accent-teal)', bg: 'var(--accent-teal-dim)' }
}

function formatRelTime(iso) {
  const d = new Date(iso)
  const now = new Date()
  const diff = now - d
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`
  return `${Math.floor(diff / 86400000)}天前`
}

export default function Inbox({ items, workspaces, onAddItem }) {
  const [quickText, setQuickText] = useState('')
  const [filterType, setFilterType] = useState('all')
  const [selectedItem, setSelectedItem] = useState(null)

  const filteredItems = filterType === 'all' ? items : items.filter(i => i.type === filterType)

  const handleQuickSave = () => {
    if (!quickText.trim()) return
    const isUrl = quickText.startsWith('http')
    onAddItem({
      type: isUrl ? 'url' : 'note',
      title: isUrl ? quickText : quickText.slice(0, 40) + (quickText.length > 40 ? '...' : ''),
      preview: isUrl ? '来自快速保存的链接' : quickText,
      source: 'quick-input',
      workspaceId: null,
      tags: []
    })
    setQuickText('')
  }

  const typeCounts = items.reduce((acc, item) => {
    acc[item.type] = (acc[item.type] || 0) + 1
    return acc
  }, {})

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div>
            <div className="page-title">收件箱</div>
            <div className="page-subtitle">{items.length} 条待处理内容 · 所有未分类信息先进入这里</div>
          </div>
        </div>

        {/* Quick Capture */}
        <div className="quick-input" style={{ marginBottom: 12 }}>
          <span style={{ fontSize: 16 }}>✍️</span>
          <input
            placeholder="快速记录想法、粘贴链接或剪贴板内容..."
            value={quickText}
            onChange={e => setQuickText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleQuickSave() }}
            className="selectable"
          />
          {quickText && (
            <button className="btn btn-primary btn-sm" onClick={handleQuickSave}>保存</button>
          )}
        </div>

        {/* Type filters */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button
            className={`btn btn-sm ${filterType === 'all' ? 'btn-secondary' : 'btn-ghost'}`}
            onClick={() => setFilterType('all')}
            style={{ fontSize: 11 }}
          >
            全部 ({items.length})
          </button>
          {Object.entries(TYPE_CONFIG).map(([type, conf]) => (
            typeCounts[type] ? (
              <button
                key={type}
                className={`btn btn-sm ${filterType === type ? 'btn-secondary' : 'btn-ghost'}`}
                onClick={() => setFilterType(filterType === type ? 'all' : type)}
                style={{ fontSize: 11 }}
              >
                {conf.icon} {conf.label} ({typeCounts[type]})
              </button>
            ) : null
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Item List */}
        <div style={{ flex: 1, overflowY: 'auto', borderRight: selectedItem ? '1px solid var(--border)' : 'none' }}>
          {filteredItems.length === 0 ? (
            <div className="empty-state" style={{ marginTop: 40 }}>
              <div style={{ fontSize: 32 }}>📭</div>
              <div className="empty-state-title">收件箱是空的</div>
              <div className="empty-state-desc">使用上方的快速输入来保存链接、笔记和想法。</div>
            </div>
          ) : filteredItems.map((item, i) => {
            const typeConf = TYPE_CONFIG[item.type] || TYPE_CONFIG.note
            const ws = workspaces.find(w => w.id === item.workspaceId)
            const isSelected = selectedItem?.id === item.id
            return (
              <div
                key={item.id}
                className="inbox-item"
                onClick={() => setSelectedItem(isSelected ? null : item)}
                style={{
                  background: isSelected ? 'var(--bg-selected)' : 'transparent',
                  borderLeft: isSelected ? '2px solid var(--accent-blue)' : '2px solid transparent',
                  animation: `fadeIn 150ms ease ${i * 20}ms both`
                }}
              >
                <div className="inbox-item-icon" style={{ background: typeConf.bg }}>
                  <span style={{ fontSize: 14 }}>{typeConf.icon}</span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="inbox-item-title">{item.title}</div>
                  <div className="inbox-item-preview">{item.preview}</div>
                  <div className="inbox-item-meta">
                    <span className="badge" style={{ background: typeConf.bg, color: typeConf.color, fontSize: 10 }}>{typeConf.label}</span>
                    {ws && <span className="badge badge-gray" style={{ fontSize: 10 }}>{ws.icon} {ws.name}</span>}
                    {item.tags?.map(tag => <span key={tag} className="badge badge-gray" style={{ fontSize: 10 }}>{tag}</span>)}
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 'auto' }}>{formatRelTime(item.createdAt)}</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Detail Panel */}
        {selectedItem && (
          <div style={{ width: 280, padding: 16, overflowY: 'auto', animation: 'slideInRight 150ms ease' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>转化为</span>
              <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setSelectedItem(null)}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[
                { label: '→ 工作任务', icon: '✅', color: 'var(--accent-blue)' },
                { label: '→ 知识笔记', icon: '📚', color: 'var(--accent-purple)' },
                { label: '→ Bug 记录', icon: '🐛', color: 'var(--accent-red)' },
                { label: '→ 自动化动作', icon: '⚙️', color: 'var(--accent-amber)' }
              ].map(action => (
                <button key={action.label} className="btn btn-secondary btn-sm" style={{ justifyContent: 'flex-start', gap: 8, fontSize: 12 }}>
                  <span>{action.icon}</span>
                  <span style={{ color: action.color }}>{action.label}</span>
                </button>
              ))}
            </div>
            <div className="divider" />
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 6 }}>内容预览</div>
            <div className="card selectable" style={{ padding: '10px 12px', fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.7, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {selectedItem.preview}
            </div>
            {selectedItem.tags?.length > 0 && (
              <div style={{ marginTop: 10, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {selectedItem.tags.map(tag => <span key={tag} className="badge badge-gray" style={{ fontSize: 10 }}>{tag}</span>)}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

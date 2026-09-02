/* eslint-disable react/prop-types */
import JenkinsSettings from './JenkinsSettings'

export default function JenkinsSettingsModal({ isOpen, onClose, onConfigSaved }) {
  if (!isOpen) return null

  return (
    <div className="modal-backdrop" onClick={onClose} style={{ zIndex: 1100 }}>
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{ width: 560, maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto' }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 16
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: 'rgba(210, 153, 34, 0.15)',
                color: 'var(--accent-amber)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 16
              }}
            >
              ⚙
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Jenkins 连接配置</h3>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)' }}>
                配置服务器地址与 API Token 即可实时管理 CI 任务
              </p>
            </div>
          </div>
          <button
            className="btn btn-ghost"
            onClick={onClose}
            style={{ padding: 4, borderRadius: 6, color: 'var(--text-muted)' }}
          >
            ✕
          </button>
        </div>

        <JenkinsSettings
          isModal={true}
          onClose={onClose}
          onConfigChange={() => {
            if (onConfigSaved) onConfigSaved()
          }}
        />
      </div>
    </div>
  )
}

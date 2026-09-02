import React, { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('[App Crash Caught by ErrorBoundary]', error, errorInfo)
    this.setState({ errorInfo })
  }

  handleReload = () => {
    window.location.reload()
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            height: '100vh',
            width: '100vw',
            background: 'var(--bg-app, #0d1117)',
            color: 'var(--text-primary, #c9d1d9)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 32,
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
          }}
        >
          <div
            style={{
              maxWidth: 600,
              width: '100%',
              background: 'var(--bg-elevated, #161b22)',
              border: '1px solid var(--border, #30363d)',
              borderRadius: 12,
              padding: 28,
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <span style={{ fontSize: 28 }}>⚠️</span>
              <div>
                <h2 style={{ fontSize: 18, margin: 0, fontWeight: 700, color: '#f85149' }}>
                  应用页面渲染发生异常
                </h2>
                <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-muted, #8b949e)' }}>
                  已拦截该异常并防止白屏崩溃，您可以尝试刷新恢复。
                </p>
              </div>
            </div>

            <div
              style={{
                background: 'rgba(0,0,0,0.3)',
                borderRadius: 6,
                padding: 12,
                fontSize: 12,
                fontFamily: 'monospace',
                color: '#ff7b72',
                overflowX: 'auto',
                marginBottom: 20,
                maxHeight: 180
              }}
            >
              {this.state.error?.toString()}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                className="btn btn-ghost"
                onClick={this.handleReset}
                style={{
                  padding: '6px 14px',
                  borderRadius: 6,
                  border: '1px solid #30363d',
                  background: 'transparent',
                  color: '#c9d1d9',
                  cursor: 'pointer'
                }}
              >
                重试渲染
              </button>
              <button
                className="btn btn-primary"
                onClick={this.handleReload}
                style={{
                  padding: '6px 18px',
                  borderRadius: 6,
                  border: 'none',
                  background: 'linear-gradient(135deg, #4f9ef8, #8b5cf6)',
                  color: '#fff',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                🔄 刷新页面
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

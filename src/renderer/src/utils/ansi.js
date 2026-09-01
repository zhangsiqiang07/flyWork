/* eslint-disable no-control-regex */
/**
 * 轻量 ANSI 转义码转 HTML 工具

 * 用于在前端高亮展示 Jenkins 控制台日志
 */

const ANSI_COLORS = {
  // 标准前景色
  30: 'var(--text-muted, #8b949e)',
  31: 'var(--accent-red, #f85149)',
  32: 'var(--accent-green, #3fb950)',
  33: 'var(--accent-amber, #d29922)',
  34: 'var(--accent-blue, #58a6ff)',
  35: 'var(--accent-purple, #bc8cff)',
  36: 'var(--accent-teal, #39c5bb)',
  37: 'var(--text-primary, #e6edf3)',
  // 高亮前景色
  90: '#6e7681',
  91: '#ff7b72',
  92: '#56d364',
  93: '#e3b341',
  94: '#79c0ff',
  95: '#d2a8ff',
  96: '#56d4dd',
  97: '#ffffff'
}

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

/**
 * 将包含 ANSI Escape 编码的纯文本转为带有样式的 HTML
 */
export function ansiToHtml(raw) {
  if (!raw) return ''

  // 1. 过滤 Jenkins 专属的内部元指令 (如 \x1b[8mha:xxx\x1b[0m)
  const sanitized = raw.replace(/\x1b\[8m.*?\x1b\[0m/gs, '')

  // 2. 切分 ANSI 转义码
  const parts = sanitized.split(/(\x1b\[[0-9;]*m)/g)
  let currentColor = null
  let isBold = false
  let isUnderline = false
  let result = ''

  for (const part of parts) {
    const match = part.match(/^\x1b\[([0-9;]*)m$/)
    if (match) {
      const codes = (match[1] || '0').split(';').map((c) => parseInt(c, 10))
      for (const code of codes) {
        if (code === 0) {
          currentColor = null
          isBold = false
          isUnderline = false
        } else if (code === 1) {
          isBold = true
        } else if (code === 4) {
          isUnderline = true
        } else if (ANSI_COLORS[code]) {
          currentColor = ANSI_COLORS[code]
        }
      }
    } else if (part) {
      let style = ''
      if (currentColor) style += `color:${currentColor};`
      if (isBold) style += 'font-weight:600;'
      if (isUnderline) style += 'text-decoration:underline;'

      const escaped = escapeHtml(part)
      if (style) {
        result += `<span style="${style}">${escaped}</span>`
      } else {
        result += escaped
      }
    }
  }

  return result
}

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

export default function WorkspaceAiRules({ workspace: ws }) {
  const [loading, setLoading] = useState(true)
  const [rulesData, setRulesData] = useState(null)
  const [selectedAgentId, setSelectedAgentId] = useState('all')
  const [searchKeyword, setSearchKeyword] = useState('')
  const [selectedRule, setSelectedRule] = useState(null)
  const [editorContent, setEditorContent] = useState('')
  const [initialContent, setInitialContent] = useState('')
  const [isDirty, setIsDirty] = useState(false)
  const [viewMode, setViewMode] = useState('edit') // 'edit' | 'preview' | 'split'
  const [toastMessage, setToastMessage] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createAgentId, setCreateAgentId] = useState('cursor')
  const [createRuleType, setCreateRuleType] = useState('standard')
  const [customFileName, setCustomFileName] = useState('')
  const [selectedTemplateId, setSelectedTemplateId] = useState('fullstack-general')

  const textareaRef = useRef(null)

  const showToast = (msg) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(''), 3500)
  }

  // Load agent rules for current workspace
  const loadRules = useCallback(
    async (keepSelectedPath = null) => {
      if (!ws?.root) {
        setLoading(false)
        return
      }
      setLoading(true)
      try {
        const res = await window.flywork?.workspaceListAgentRules?.(ws.root)
        if (res) {
          setRulesData(res)

          // Select rule
          const allRules = []
          for (const agent of res.agents || []) {
            for (const r of agent.rules || []) {
              allRules.push(r)
            }
          }

          let targetRule = null
          if (keepSelectedPath) {
            targetRule = allRules.find((r) => r.relativePath === keepSelectedPath)
          }
          if (!targetRule && selectedRule) {
            targetRule = allRules.find((r) => r.relativePath === selectedRule.relativePath)
          }
          if (!targetRule) {
            // Find first existing rule
            targetRule = allRules.find((r) => r.exists) || allRules[0] || null
          }

          if (targetRule) {
            await handleSelectRule(targetRule, res)
          } else {
            setSelectedRule(null)
            setEditorContent('')
            setInitialContent('')
            setIsDirty(false)
          }
        }
      } catch (err) {
        showToast(`加载规则失败: ${err.message}`)
      } finally {
        setLoading(false)
      }
    },
    [ws?.root]
  )

  useEffect(() => {
    loadRules()
  }, [loadRules])

  // Select a rule item and load its content
  const handleSelectRule = async (rule, currentData = rulesData) => {
    if (isDirty) {
      if (!window.confirm('当前规则有未保存的修改，切换将丢失修改。确认切换吗？')) {
        return
      }
    }

    setSelectedRule(rule)
    if (rule.exists) {
      try {
        const res = await window.flywork?.workspaceReadAgentRule?.(ws.root, rule.relativePath)
        if (res?.success) {
          setEditorContent(res.content)
          setInitialContent(res.content)
          setIsDirty(false)
        } else {
          setEditorContent(rule.defaultTemplate || '')
          setInitialContent(rule.defaultTemplate || '')
          setIsDirty(false)
        }
      } catch {
        setEditorContent(rule.defaultTemplate || '')
        setInitialContent(rule.defaultTemplate || '')
        setIsDirty(false)
      }
    } else {
      // Draft / not yet created on disk: show default template
      const initial = rule.defaultTemplate || '# AI Rules\n'
      setEditorContent(initial)
      setInitialContent(initial)
      setIsDirty(false)
    }
  }

  // Handle content change in editor
  const handleContentChange = (e) => {
    const val = e.target.value
    setEditorContent(val)
    setIsDirty(val !== initialContent)
  }

  // Save rule content
  const handleSaveRule = async () => {
    if (!selectedRule || !ws?.root || isSaving) return
    setIsSaving(true)
    try {
      if (selectedRule.exists) {
        const res = await window.flywork?.workspaceSaveAgentRule?.(
          ws.root,
          selectedRule.relativePath,
          editorContent
        )
        if (res?.success) {
          setInitialContent(editorContent)
          setIsDirty(false)
          showToast(`已成功保存规则：${selectedRule.relativePath}`)
          await loadRules(selectedRule.relativePath)
        } else {
          showToast(`保存失败: ${res?.error || '未知错误'}`)
        }
      } else {
        // Create file
        const res = await window.flywork?.workspaceSaveAgentRule?.(
          ws.root,
          selectedRule.relativePath,
          editorContent
        )
        if (res?.success) {
          setInitialContent(editorContent)
          setIsDirty(false)
          showToast(`已成功在工程中创建并生效规则：${selectedRule.relativePath}`)
          await loadRules(selectedRule.relativePath)
        } else {
          showToast(`创建失败: ${res?.error || '未知错误'}`)
        }
      }
    } catch (err) {
      showToast(`保存异常: ${err.message}`)
    } finally {
      setIsSaving(false)
    }
  }

  // Delete rule
  const handleDeleteRule = async () => {
    if (!selectedRule || !selectedRule.exists || !ws?.root) return
    if (
      !window.confirm(
        `确定要从项目中删除规则文件 "${selectedRule.relativePath}" 吗？此操作无法撤销。`
      )
    ) {
      return
    }

    try {
      const res = await window.flywork?.workspaceDeleteAgentRule?.(
        ws.root,
        selectedRule.relativePath
      )
      if (res?.success) {
        showToast(`已删除规则文件：${selectedRule.relativePath}`)
        setIsDirty(false)
        await loadRules()
      } else {
        showToast(`删除失败: ${res?.error || '未知错误'}`)
      }
    } catch (err) {
      showToast(`删除异常: ${err.message}`)
    }
  }

  // Revert changes
  const handleRevert = () => {
    if (window.confirm('确定要放弃未保存的修改并还原吗？')) {
      setEditorContent(initialContent)
      setIsDirty(false)
      showToast('已还原至当前文件内容')
    }
  }

  // Insert code snippet into editor
  const handleInsertSnippet = (snippet) => {
    const textarea = textareaRef.current
    if (!textarea) {
      setEditorContent((prev) => prev + '\n\n' + snippet.content)
      setIsDirty(true)
      return
    }

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const before = editorContent.substring(0, start)
    const after = editorContent.substring(end)
    const textToInsert = `\n${snippet.content.trim()}\n`
    const newContent = before + textToInsert + after
    setEditorContent(newContent)
    setIsDirty(true)

    // Focus back and position cursor
    setTimeout(() => {
      textarea.focus()
      const newPos = start + textToInsert.length
      textarea.setSelectionRange(newPos, newPos)
    }, 50)

    showToast(`已插入“${snippet.title}”片段`)
  }

  // Apply template
  const handleApplyTemplate = (tpl) => {
    if (!tpl) return
    if (isDirty && !window.confirm('应用模板将覆盖当前编辑区内容，确认覆盖吗？')) {
      return
    }
    setEditorContent(tpl.content)
    setIsDirty(tpl.content !== initialContent)
    showToast(`已应用“${tpl.name}”模板`)
  }

  // Keyboard shortcut for saving
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        if (isDirty && selectedRule) {
          handleSaveRule()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isDirty, selectedRule, editorContent])

  // Open directory in native finder / file explorer
  const handleOpenFolder = () => {
    if (ws?.root && window.flywork?.openPath) {
      window.flywork.openPath(ws.root)
    }
  }

  // Open file in external system editor
  const handleOpenExternal = () => {
    if (selectedRule?.fullPath && window.flywork?.openPath) {
      window.flywork.openPath(selectedRule.fullPath)
    }
  }

  // Filter rules based on selected agent and search keyword
  const filteredAgents = useMemo(() => {
    if (!rulesData?.agents) return []
    let list = rulesData.agents
    if (selectedAgentId !== 'all') {
      list = list.filter((a) => a.id === selectedAgentId)
    }
    if (!searchKeyword.trim()) return list

    const kw = searchKeyword.toLowerCase()
    return list
      .map((agent) => {
        const matchedRules = agent.rules.filter(
          (r) =>
            r.name.toLowerCase().includes(kw) ||
            r.relativePath.toLowerCase().includes(kw) ||
            (r.description && r.description.toLowerCase().includes(kw)) ||
            agent.name.toLowerCase().includes(kw)
        )
        return {
          ...agent,
          rules: matchedRules
        }
      })
      .filter((agent) => agent.rules.length > 0 || agent.name.toLowerCase().includes(kw))
  }, [rulesData, selectedAgentId, searchKeyword])

  // Computed total stats
  const stats = useMemo(() => {
    if (!rulesData) return { totalConfigured: 0, totalAgentsConfigured: 0 }
    return {
      totalConfigured: rulesData.totalConfigured || 0,
      totalAgentsConfigured: rulesData.totalAgentsConfigured || 0
    }
  }, [rulesData])

  // Create rule submit
  const handleConfirmCreateRule = async () => {
    if (!ws?.root) return
    const agent = rulesData?.agents?.find((a) => a.id === createAgentId)
    if (!agent) return

    let relativePath = ''
    if (createRuleType === 'standard') {
      // Find primary rule definition
      const primaryDef =
        agent.ruleDefinitions.find((d) => d.type === 'single') || agent.ruleDefinitions[0]
      relativePath = primaryDef.relativePath
    } else {
      // Sub-rule or custom MDC/MD
      const nameClean = customFileName.trim().replace(/^[\/\\]+/, '')
      if (!nameClean) {
        alert('请输入规则文件名')
        return
      }

      if (agent.id === 'cursor') {
        const fileWithExt = nameClean.endsWith('.mdc') ? nameClean : `${nameClean}.mdc`
        relativePath = pathJoin('.cursor/rules', fileWithExt)
      } else if (agent.id === 'claude') {
        const fileWithExt = nameClean.endsWith('.md') ? nameClean : `${nameClean}.md`
        relativePath = pathJoin('.claude/rules', fileWithExt)
      } else if (agent.id === 'copilot') {
        const fileWithExt = nameClean.endsWith('.md') ? nameClean : `${nameClean}.md`
        relativePath = pathJoin('.github/instructions', fileWithExt)
      } else if (agent.id === 'windsurf') {
        const fileWithExt = nameClean.endsWith('.md') ? nameClean : `${nameClean}.md`
        relativePath = pathJoin('.windsurf/rules', fileWithExt)
      } else if (agent.id === 'agent-dir') {
        const fileWithExt = nameClean.includes('.') ? nameClean : `${nameClean}.md`
        relativePath = pathJoin('.agent', fileWithExt)
      } else if (agent.id === 'trae') {
        const fileWithExt = nameClean.endsWith('.md') ? nameClean : `${nameClean}.md`
        relativePath = pathJoin('.trae/rules', fileWithExt)
      } else {
        relativePath = nameClean
      }
    }

    try {
      const res = await window.flywork?.workspaceCreateAgentRule?.(
        ws.root,
        relativePath,
        selectedTemplateId
      )
      if (res?.success) {
        showToast(`规则创建成功：${relativePath}`)
        setShowCreateModal(false)
        setCustomFileName('')
        await loadRules(relativePath)
      } else {
        alert(`创建失败: ${res?.error || '未知错误'}`)
      }
    } catch (err) {
      alert(`创建异常: ${err.message}`)
    }
  }

  function pathJoin(dir, file) {
    return `${dir.replace(/\/$/, '')}/${file.replace(/^\//, '')}`
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 14 }}>
      {/* Toast Notification */}
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            bottom: 30,
            right: 30,
            background: 'var(--bg-surface)',
            color: 'var(--text-primary)',
            padding: '10px 18px',
            borderRadius: 8,
            boxShadow: 'var(--shadow-lg)',
            border: '1px solid var(--accent-blue)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            animation: 'fadeIn 200ms ease',
            fontSize: 13
          }}
        >
          <span style={{ color: 'var(--accent-blue)', fontSize: 16 }}>ℹ</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Banner & Header */}
      <div
        className="card"
        style={{
          padding: '14px 18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 8,
              background:
                'linear-gradient(135deg, rgba(79,158,248,0.2) 0%, rgba(163,113,247,0.2) 100%)',
              border: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 20
            }}
          >
            🤖
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
                项目智能体 AI 规则管理
              </span>
              <span className="badge badge-blue" style={{ fontSize: 11 }}>
                {stats.totalConfigured} 个生效中规则
              </span>
              <span className="badge badge-gray" style={{ fontSize: 11 }}>
                已识别 {stats.totalAgentsConfigured} 个智能体
              </span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
              在项目中配置各类常见 AI 智能体规范（Cursor、Claude Code、GitHub Copilot、Windsurf
              等），让智能体更精准契合你的工程架构。
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            className="btn btn-ghost btn-sm"
            onClick={handleOpenFolder}
            title="在 Finder / 资源管理器中打开项目"
            style={{ display: 'flex', alignItems: 'center', gap: 5 }}
          >
            <span>📁</span>
            <span>打开工程目录</span>
          </button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => loadRules(selectedRule?.relativePath)}
            title="刷新规则列表"
            style={{ display: 'flex', alignItems: 'center', gap: 5 }}
          >
            <span>🔄</span>
            <span>刷新</span>
          </button>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => setShowCreateModal(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 5 }}
          >
            <span>➕</span>
            <span>新建 AI 规则</span>
          </button>
        </div>
      </div>

      {/* Filter Bar & Search */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap'
        }}
      >
        {/* Agent Filter Tabs */}
        <div
          style={{
            display: 'flex',
            gap: 4,
            background: 'var(--bg-elevated)',
            padding: 3,
            borderRadius: 8,
            border: '1px solid var(--border)',
            overflowX: 'auto',
            maxWidth: '100%'
          }}
        >
          <button
            onClick={() => setSelectedAgentId('all')}
            style={{
              padding: '5px 11px',
              borderRadius: 6,
              fontSize: 12,
              fontWeight: selectedAgentId === 'all' ? 600 : 400,
              border: 'none',
              cursor: 'pointer',
              background: selectedAgentId === 'all' ? 'var(--accent-blue)' : 'transparent',
              color: selectedAgentId === 'all' ? '#fff' : 'var(--text-secondary)',
              transition: 'all 150ms ease',
              whiteSpace: 'nowrap'
            }}
          >
            全部智能体 (
            {rulesData?.agents?.reduce(
              (acc, a) => acc + (a.rules?.filter((r) => r.exists)?.length || 0),
              0
            ) || 0}
            )
          </button>
          {rulesData?.agents?.map((agent) => {
            const isActive = selectedAgentId === agent.id
            const existingCount = agent.rules?.filter((r) => r.exists)?.length || 0
            return (
              <button
                key={agent.id}
                onClick={() => setSelectedAgentId(agent.id)}
                style={{
                  padding: '5px 11px',
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: isActive ? 600 : 400,
                  border: 'none',
                  cursor: 'pointer',
                  background: isActive ? 'var(--accent-blue)' : 'transparent',
                  color: isActive ? '#fff' : 'var(--text-secondary)',
                  transition: 'all 150ms ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  whiteSpace: 'nowrap'
                }}
              >
                <span>{agent.icon}</span>
                <span>{agent.name}</span>
                {existingCount > 0 && (
                  <span
                    style={{
                      background: isActive ? 'rgba(255,255,255,0.25)' : 'var(--bg-active)',
                      padding: '1px 5px',
                      borderRadius: 10,
                      fontSize: 10,
                      color: isActive ? '#fff' : 'var(--accent-green)'
                    }}
                  >
                    {existingCount}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Search Input */}
        <div style={{ position: 'relative', minWidth: 220 }}>
          <input
            type="text"
            className="input input-sm"
            placeholder="🔍 搜索规则名称、路径或智能体..."
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            style={{ width: '100%', fontSize: 12 }}
          />
          {searchKeyword && (
            <button
              onClick={() => setSearchKeyword('')}
              style={{
                position: 'absolute',
                right: 8,
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                fontSize: 12
              }}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Main Two-Column Master-Detail Layout */}
      <div
        style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: '300px 1fr',
          gap: 16,
          minHeight: 0,
          overflow: 'hidden'
        }}
      >
        {/* Left Column: Rule Files Navigator */}
        <div
          className="card"
          style={{
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            padding: 0
          }}
        >
          <div
            style={{
              padding: '12px 14px',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'var(--bg-elevated)'
            }}
          >
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
              规则文件清单 ({filteredAgents.reduce((acc, a) => acc + (a.rules?.length || 0), 0)})
            </span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>单击切换查看</span>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '10px 8px' }}>
            {filteredAgents.length === 0 ? (
              <div
                style={{
                  padding: 24,
                  textAlign: 'center',
                  color: 'var(--text-muted)',
                  fontSize: 12
                }}
              >
                未找到匹配的规则文件
              </div>
            ) : (
              filteredAgents.map((agent) => {
                const existingRules = agent.rules?.filter((r) => r.exists) || []
                const candidateRules = agent.rules?.filter((r) => !r.exists) || []

                return (
                  <div key={agent.id} style={{ marginBottom: 14 }}>
                    {/* Agent Group Header */}
                    <div
                      style={{
                        padding: '4px 8px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontSize: 11,
                        fontWeight: 700,
                        color: 'var(--text-secondary)',
                        letterSpacing: 0.5,
                        textTransform: 'uppercase'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span>{agent.icon}</span>
                        <span>{agent.name}</span>
                      </div>
                      <span
                        className={`badge ${existingRules.length > 0 ? 'badge-green' : 'badge-gray'}`}
                        style={{ fontSize: 9, padding: '1px 5px' }}
                      >
                        {existingRules.length > 0 ? `${existingRules.length} 个配置` : '未配置'}
                      </span>
                    </div>

                    {/* Rules List under Agent */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 4 }}>
                      {/* 1. Existing Rules */}
                      {existingRules.map((rule) => {
                        const isSelected = selectedRule?.relativePath === rule.relativePath
                        return (
                          <div
                            key={rule.id}
                            onClick={() => handleSelectRule(rule)}
                            style={{
                              padding: '8px 10px',
                              borderRadius: 6,
                              cursor: 'pointer',
                              background: isSelected ? 'var(--accent-blue-dim)' : 'transparent',
                              border: `1px solid ${isSelected ? 'var(--accent-blue)' : 'transparent'}`,
                              transition: 'all 120ms ease',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: 8
                            }}
                            onMouseEnter={(e) => {
                              if (!isSelected) e.currentTarget.style.background = 'var(--bg-hover)'
                            }}
                            onMouseLeave={(e) => {
                              if (!isSelected) e.currentTarget.style.background = 'transparent'
                            }}
                          >
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div
                                style={{
                                  fontSize: 12,
                                  fontWeight: isSelected ? 600 : 500,
                                  color: isSelected ? 'var(--accent-blue)' : 'var(--text-primary)',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 6
                                }}
                              >
                                <span
                                  style={{
                                    width: 6,
                                    height: 6,
                                    borderRadius: '50%',
                                    background: 'var(--accent-green)',
                                    display: 'inline-block',
                                    flexShrink: 0
                                  }}
                                />
                                <span style={{ fontFamily: 'monospace' }}>{rule.name}</span>
                              </div>
                              <div
                                style={{
                                  fontSize: 10,
                                  color: 'var(--text-muted)',
                                  marginTop: 2,
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap'
                                }}
                              >
                                {rule.relativePath}
                              </div>
                            </div>
                            <span
                              style={{
                                fontSize: 9,
                                color: 'var(--text-muted)',
                                fontFamily: 'monospace',
                                flexShrink: 0
                              }}
                            >
                              {Math.round((rule.size / 1024) * 10) / 10} KB
                            </span>
                          </div>
                        )
                      })}

                      {/* 2. Candidate Rules that can be created with 1 click */}
                      {candidateRules.map((rule) => {
                        const isSelected = selectedRule?.relativePath === rule.relativePath
                        return (
                          <div
                            key={rule.id}
                            onClick={() => handleSelectRule(rule)}
                            style={{
                              padding: '6px 10px',
                              borderRadius: 6,
                              cursor: 'pointer',
                              background: isSelected ? 'var(--bg-hover)' : 'transparent',
                              border: `1px dashed ${isSelected ? 'var(--accent-blue)' : 'var(--border)'}`,
                              opacity: 0.75,
                              transition: 'all 120ms ease',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: 8
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.opacity = '1'
                            }}
                            onMouseLeave={(e) => {
                              if (!isSelected) e.currentTarget.style.opacity = '0.75'
                            }}
                          >
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div
                                style={{
                                  fontSize: 11,
                                  fontFamily: 'monospace',
                                  color: 'var(--text-secondary)',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap'
                                }}
                              >
                                {rule.name}
                              </div>
                              <div
                                style={{
                                  fontSize: 9,
                                  color: 'var(--text-muted)',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap'
                                }}
                              >
                                未创建 · 点击查看模板
                              </div>
                            </div>
                            <span
                              className="badge badge-gray"
                              style={{ fontSize: 9, padding: '1px 5px', flexShrink: 0 }}
                            >
                              可创建
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Right Column: Rule Viewer & Editor */}
        <div
          className="card"
          style={{
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            padding: 0
          }}
        >
          {selectedRule ? (
            <>
              {/* Header Bar */}
              <div
                style={{
                  padding: '12px 18px',
                  borderBottom: '1px solid var(--border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: 'var(--bg-elevated)',
                  flexWrap: 'wrap',
                  gap: 10
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                  <span style={{ fontSize: 20 }}>
                    {rulesData?.agents?.find((a) => a.id === selectedRule.agentId)?.icon || '📄'}
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span
                        style={{
                          fontSize: 14,
                          fontWeight: 700,
                          color: 'var(--text-primary)',
                          fontFamily: 'monospace'
                        }}
                      >
                        {selectedRule.relativePath}
                      </span>
                      {selectedRule.exists ? (
                        <span className="badge badge-green" style={{ fontSize: 10 }}>
                          ✓ 已生效
                        </span>
                      ) : (
                        <span className="badge badge-amber" style={{ fontSize: 10 }}>
                          待创建草稿
                        </span>
                      )}
                      {isDirty && (
                        <span
                          className="badge badge-amber"
                          style={{ fontSize: 10, animation: 'pulse 1.5s infinite' }}
                        >
                          ● 未保存修改
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                      {selectedRule.description || `${selectedRule.agentName} 智能体规则配置`}
                    </div>
                  </div>
                </div>

                {/* Top Action Buttons */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {/* View Mode Switcher */}
                  <div
                    style={{
                      display: 'flex',
                      background: 'var(--bg-base)',
                      padding: 2,
                      borderRadius: 6,
                      border: '1px solid var(--border)'
                    }}
                  >
                    <button
                      onClick={() => setViewMode('edit')}
                      style={{
                        padding: '4px 9px',
                        borderRadius: 4,
                        fontSize: 11,
                        border: 'none',
                        cursor: 'pointer',
                        background: viewMode === 'edit' ? 'var(--accent-blue)' : 'transparent',
                        color: viewMode === 'edit' ? '#fff' : 'var(--text-secondary)'
                      }}
                      title="源码编辑模式"
                    >
                      ✏️ 源码编辑
                    </button>
                    <button
                      onClick={() => setViewMode('split')}
                      style={{
                        padding: '4px 9px',
                        borderRadius: 4,
                        fontSize: 11,
                        border: 'none',
                        cursor: 'pointer',
                        background: viewMode === 'split' ? 'var(--accent-blue)' : 'transparent',
                        color: viewMode === 'split' ? '#fff' : 'var(--text-secondary)'
                      }}
                      title="左右分栏对照模式"
                    >
                      ◫ 分栏对照
                    </button>
                    <button
                      onClick={() => setViewMode('preview')}
                      style={{
                        padding: '4px 9px',
                        borderRadius: 4,
                        fontSize: 11,
                        border: 'none',
                        cursor: 'pointer',
                        background: viewMode === 'preview' ? 'var(--accent-blue)' : 'transparent',
                        color: viewMode === 'preview' ? '#fff' : 'var(--text-secondary)'
                      }}
                      title="Markdown 渲染预览"
                    >
                      👁️ 渲染预览
                    </button>
                  </div>

                  {/* Template selector dropdown */}
                  <div style={{ position: 'relative' }}>
                    <select
                      className="input input-sm"
                      style={{ fontSize: 11, width: 130, padding: '4px 6px' }}
                      defaultValue=""
                      onChange={(e) => {
                        const tpl = rulesData?.templates?.find((t) => t.id === e.target.value)
                        if (tpl) handleApplyTemplate(tpl)
                        e.target.value = ''
                      }}
                    >
                      <option value="" disabled>
                        📋 套用预置模板...
                      </option>
                      {rulesData?.templates?.map((tpl) => (
                        <option key={tpl.id} value={tpl.id}>
                          {tpl.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {isDirty && (
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={handleRevert}
                      title="放弃修改"
                      style={{ color: 'var(--text-danger)' }}
                    >
                      ↺ 还原
                    </button>
                  )}

                  {selectedRule.exists && (
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={handleOpenExternal}
                      title="在系统编辑器中打开此文件"
                    >
                      ↗ 外部打开
                    </button>
                  )}

                  {selectedRule.exists && (
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={handleDeleteRule}
                      title="删除此规则文件"
                      style={{ color: 'var(--text-danger)' }}
                    >
                      🗑️
                    </button>
                  )}

                  <button
                    className={`btn btn-sm ${isDirty || !selectedRule.exists ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={handleSaveRule}
                    disabled={isSaving || (!isDirty && selectedRule.exists)}
                    style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                  >
                    <span>💾</span>
                    <span>
                      {isSaving
                        ? '保存中...'
                        : selectedRule.exists
                          ? isDirty
                            ? '保存修改 (⌘S)'
                            : '已是最新'
                          : '创建并生效'}
                    </span>
                  </button>
                </div>
              </div>

              {/* Quick Snippets Insertion Toolbar */}
              <div
                style={{
                  padding: '8px 18px',
                  background: 'var(--bg-surface)',
                  borderBottom: '1px solid var(--border)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  overflowX: 'auto'
                }}
              >
                <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                  快速插入规范：
                </span>
                {rulesData?.snippets?.map((snip) => (
                  <button
                    key={snip.id}
                    onClick={() => handleInsertSnippet(snip)}
                    className="btn btn-ghost btn-xs"
                    style={{
                      fontSize: 11,
                      padding: '3px 8px',
                      background: 'var(--bg-elevated)',
                      border: '1px solid var(--border)',
                      borderRadius: 4,
                      whiteSpace: 'nowrap'
                    }}
                    title="点击在光标处插入规范段落"
                  >
                    {snip.title}
                  </button>
                ))}
              </div>

              {/* Notice for non-existent rule */}
              {!selectedRule.exists && (
                <div
                  style={{
                    padding: '10px 18px',
                    background: 'rgba(210,153,34,0.1)',
                    borderBottom: '1px solid rgba(210,153,34,0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: 12,
                    color: 'var(--accent-amber)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span>💡</span>
                    <span>
                      该规则文件目前尚未在项目目录中创建。下方为你预填充了官方推荐规范草稿，你可直接编辑并点击右侧按钮在项目中保存生效。
                    </span>
                  </div>
                  <button
                    className="btn btn-primary btn-xs"
                    onClick={handleSaveRule}
                    disabled={isSaving}
                  >
                    立即创建
                  </button>
                </div>
              )}

              {/* Editor / Preview Content Area */}
              <div
                style={{
                  flex: 1,
                  display: 'grid',
                  gridTemplateColumns: viewMode === 'split' ? '1fr 1fr' : '1fr',
                  minHeight: 0,
                  overflow: 'hidden'
                }}
              >
                {/* 1. Editor Pane */}
                {(viewMode === 'edit' || viewMode === 'split') && (
                  <div
                    style={{
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      borderRight: viewMode === 'split' ? '1px solid var(--border)' : 'none',
                      background: 'var(--bg-base)'
                    }}
                  >
                    <textarea
                      ref={textareaRef}
                      value={editorContent}
                      onChange={handleContentChange}
                      placeholder="在此输入 AI 规则内容（Markdown 格式）..."
                      style={{
                        flex: 1,
                        width: '100%',
                        height: '100%',
                        resize: 'none',
                        padding: 16,
                        border: 'none',
                        outline: 'none',
                        background: 'transparent',
                        color: 'var(--text-primary)',
                        fontFamily:
                          'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
                        fontSize: 13,
                        lineHeight: 1.6,
                        tabSize: 2
                      }}
                      onKeyDown={(e) => {
                        // Allow tab key indentation
                        if (e.key === 'Tab') {
                          e.preventDefault()
                          const start = e.target.selectionStart
                          const end = e.target.selectionEnd
                          const val = e.target.value
                          setEditorContent(val.substring(0, start) + '  ' + val.substring(end))
                          setIsDirty(true)
                          setTimeout(() => {
                            e.target.selectionStart = e.target.selectionEnd = start + 2
                          }, 0)
                        }
                      }}
                    />
                  </div>
                )}

                {/* 2. Preview Pane */}
                {(viewMode === 'preview' || viewMode === 'split') && (
                  <div
                    style={{
                      height: '100%',
                      overflowY: 'auto',
                      padding: '18px 24px',
                      background: 'var(--bg-surface)'
                    }}
                    className="ai-rules-markdown"
                  >
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {editorContent || '*规则内容为空*'}
                    </ReactMarkdown>
                  </div>
                )}
              </div>

              {/* Editor Footer Status Bar */}
              <div
                style={{
                  padding: '6px 16px',
                  background: 'var(--bg-elevated)',
                  borderTop: '1px solid var(--border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: 11,
                  color: 'var(--text-muted)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <span>行数: {editorContent ? editorContent.split('\n').length : 0} 行</span>
                  <span>字符数: {editorContent.length}</span>
                  <span>编码: UTF-8</span>
                </div>
                <div>
                  {isDirty ? (
                    <span style={{ color: 'var(--accent-amber)' }}>
                      ● 有未保存改动 (按 ⌘+S 保存)
                    </span>
                  ) : (
                    <span style={{ color: 'var(--accent-green)' }}>✓ 与工程文件一致</span>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'column',
                gap: 12,
                color: 'var(--text-muted)'
              }}
            >
              <div style={{ fontSize: 40 }}>📄</div>
              <div style={{ fontSize: 14, fontWeight: 500 }}>
                请在左侧选择一个规则文件，或点击“新建 AI 规则”
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal: Create New AI Rule */}
      {showCreateModal && (
        <div
          className="modal-overlay"
          onClick={() => setShowCreateModal(false)}
          style={{ zIndex: 1100 }}
        >
          <div className="modal" style={{ width: 560 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 18 }}>➕</span>
                <div className="modal-title">新建智能体 AI 规则</div>
              </div>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowCreateModal(false)}>
                ✕
              </button>
            </div>

            <div
              className="modal-body"
              style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
            >
              {/* Target Agent Selection */}
              <div>
                <label className="form-label">目标智能体 (Target Agent)</label>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: 8,
                    marginTop: 6
                  }}
                >
                  {rulesData?.agents?.map((agent) => {
                    const isSelected = createAgentId === agent.id
                    return (
                      <div
                        key={agent.id}
                        onClick={() => {
                          setCreateAgentId(agent.id)
                          setCreateRuleType('standard')
                        }}
                        style={{
                          padding: '8px 10px',
                          borderRadius: 8,
                          cursor: 'pointer',
                          background: isSelected ? 'var(--accent-blue-dim)' : 'var(--bg-elevated)',
                          border: `1px solid ${isSelected ? 'var(--accent-blue)' : 'var(--border)'}`,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          transition: 'all 120ms ease'
                        }}
                      >
                        <span style={{ fontSize: 18 }}>{agent.icon}</span>
                        <div style={{ minWidth: 0 }}>
                          <div
                            style={{
                              fontSize: 12,
                              fontWeight: 600,
                              color: isSelected ? 'var(--accent-blue)' : 'var(--text-primary)',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            {agent.name}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Rule Type / Location */}
              <div>
                <label className="form-label">规则类型与文件路径</label>
                <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      fontSize: 12,
                      cursor: 'pointer'
                    }}
                  >
                    <input
                      type="radio"
                      name="ruleType"
                      checked={createRuleType === 'standard'}
                      onChange={() => setCreateRuleType('standard')}
                    />
                    <span>
                      根目录标准规则 (
                      {rulesData?.agents
                        ?.find((a) => a.id === createAgentId)
                        ?.ruleDefinitions?.find((d) => d.type === 'single')?.fileName || '规则文件'}
                      )
                    </span>
                  </label>

                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      fontSize: 12,
                      cursor: 'pointer'
                    }}
                  >
                    <input
                      type="radio"
                      name="ruleType"
                      checked={createRuleType === 'custom'}
                      onChange={() => setCreateRuleType('custom')}
                    />
                    <span>自定义子模块规则</span>
                  </label>
                </div>

                {createRuleType === 'custom' && (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>
                      输入规则文件名（例如{' '}
                      {createAgentId === 'cursor'
                        ? 'code-style.mdc'
                        : createAgentId === 'agent-dir'
                          ? 'rules/code-style.md'
                          : createAgentId === 'claude'
                            ? 'api-guidelines.md'
                            : 'conventions.md'}
                      ）：
                    </div>
                    <input
                      type="text"
                      className="input"
                      placeholder="例如: react-guidelines"
                      value={customFileName}
                      onChange={(e) => setCustomFileName(e.target.value)}
                      style={{ fontSize: 12 }}
                    />
                  </div>
                )}
              </div>

              {/* Starter Template Selection */}
              <div>
                <label className="form-label">选用起手模板 (Starter Template)</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
                  {rulesData?.templates?.map((tpl) => {
                    const isSelected = selectedTemplateId === tpl.id
                    return (
                      <div
                        key={tpl.id}
                        onClick={() => setSelectedTemplateId(tpl.id)}
                        style={{
                          padding: '8px 12px',
                          borderRadius: 6,
                          cursor: 'pointer',
                          background: isSelected ? 'var(--accent-blue-dim)' : 'var(--bg-elevated)',
                          border: `1px solid ${isSelected ? 'var(--accent-blue)' : 'var(--border)'}`,
                          transition: 'all 120ms ease'
                        }}
                      >
                        <div
                          style={{
                            fontSize: 12,
                            fontWeight: 600,
                            color: isSelected ? 'var(--accent-blue)' : 'var(--text-primary)'
                          }}
                        >
                          {tpl.name}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                          {tpl.description}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            <div className="modal-footer" style={{ justifyContent: 'flex-end', gap: 8 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowCreateModal(false)}>
                取消
              </button>
              <button className="btn btn-primary btn-sm" onClick={handleConfirmCreateRule}>
                确认创建并在工程中生效
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

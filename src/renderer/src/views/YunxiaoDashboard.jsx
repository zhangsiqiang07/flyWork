import { useEffect, useMemo, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { patchWorkitemStatus } from './workitemStatus.mjs'

const text = (value, fallback = '') =>
  typeof value === 'string' && value.trim() ? value : fallback
const idOf = (item) =>
  item?.identifier || item?.id || item?.userId || item?.projectId || item?.workitemIdentifier || ''
const nameOf = (item, fallback = '未命名') =>
  text(
    item?.name ||
      item?.userName ||
      item?.subject ||
      item?.title ||
      item?.displayName ||
      item?.nickName ||
      item?.realName,
    fallback
  )
const displayValue = (value, fallback = '') => {
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  if (value && typeof value === 'object')
    return text(
      value.name ||
        value.userName ||
        value.displayName ||
        value.nickName ||
        value.realName ||
        value.id ||
        value.userId,
      fallback
    )
  return fallback
}
const projectPayload = (project) => project?.project || project?.data || project
const formatDate = (value) => {
  if (!value) return '未设置'
  const date = new Date(typeof value === 'number' ? value : String(value))
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString('zh-CN')
}
const normalizeMarkdown = (value) => String(value || '').replace(/\\r?\\n/g, '\n')

function MarkdownImage({ src, alt = '', workitemId, style }) {
  const [imageSrc, setImageSrc] = useState(src)
  const [triedProxy, setTriedProxy] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    setImageSrc(src)
    setTriedProxy(false)
    setFailed(false)
  }, [src])

  const loadWithYunxiaoToken = async () => {
    if (triedProxy || !/^https:\/\//i.test(src || '')) {
      setFailed(true)
      return
    }
    setTriedProxy(true)
    const result = await window.flywork.yunxiaoGetWorkitemImage(src, workitemId)
    if (result.success) setImageSrc(result.dataUrl)
    else setFailed(true)
  }

  if (failed) {
    return (
      <a className="yunxiao-markdown-image-fallback" href={src} target="_blank" rel="noreferrer">
        图片加载失败：{alt || '打开原图'}
      </a>
    )
  }
  return <img src={imageSrc} alt={alt} style={style} onError={loadWithYunxiaoToken} />
}

function DescriptionContent({ description, formatType, workitemId }) {
  const richTextHtml = useMemo(() => {
    if (formatType !== 'RICHTEXT') return null
    try {
      const parsed = JSON.parse(description)
      return typeof parsed?.htmlValue === 'string' ? parsed.htmlValue : null
    } catch {
      return /<\/?[a-z][\s\S]*>/i.test(description) ? description : null
    }
  }, [description, formatType])

  const richTextNodes = useMemo(() => {
    if (!richTextHtml) return null
    const document = new DOMParser().parseFromString(richTextHtml, 'text/html')
    const renderNode = (node, key) => {
      if (node.nodeType === Node.TEXT_NODE) return node.textContent
      if (node.nodeType !== Node.ELEMENT_NODE) return null
      const tag = node.tagName.toLowerCase()
      const children = Array.from(node.childNodes).map((child, index) => renderNode(child, index))
      if (tag === 'img') {
        const src = node.getAttribute('src') || ''
        if (!/^https:\/\//i.test(src)) return null
        const style = node.getAttribute('style') || ''
        const width = Number.parseInt(node.getAttribute('width') || style.match(/width:\s*(\d+)px/i)?.[1] || '', 10)
        const height = Number.parseInt(node.getAttribute('height') || style.match(/height:\s*(\d+)px/i)?.[1] || '', 10)
        return (
          <MarkdownImage
            key={key}
            src={src}
            alt={node.getAttribute('alt') || node.getAttribute('name') || '工作项图片'}
            workitemId={workitemId}
            style={{ width: Number.isFinite(width) ? width : undefined, height: Number.isFinite(height) ? height : undefined }}
          />
        )
      }
      if (tag === 'br') return <br key={key} />
      if (['p', 'ul', 'ol', 'li', 'blockquote', 'pre', 'code', 'strong', 'b', 'em', 'i', 'u', 's', 'h1', 'h2', 'h3', 'h4'].includes(tag)) {
        const Tag = tag
        return <Tag key={key}>{children}</Tag>
      }
      if (tag === 'a') {
        const href = node.getAttribute('href') || ''
        return /^https?:\/\//i.test(href) ? <a key={key} href={href} target="_blank" rel="noreferrer">{children}</a> : <span key={key}>{children}</span>
      }
      return <span key={key}>{children}</span>
    }
    return Array.from(document.body.childNodes).map((node, index) => renderNode(node, index))
  }, [richTextHtml, workitemId])

  if (richTextNodes) return <>{richTextNodes}</>
  return <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ img: ({ src, alt }) => <MarkdownImage src={src} alt={alt} workitemId={workitemId} /> }}>{normalizeMarkdown(description)}</ReactMarkdown>
}

function Notice({ message }) {
  return message ? (
    <div
      style={{
        padding: '10px 12px',
        marginBottom: 14,
        borderRadius: 7,
        background: 'var(--accent-red-dim)',
        color: 'var(--accent-red)',
        fontSize: 12
      }}
    >
      ⚠️ {message}
    </div>
  ) : null
}

export default function YunxiaoDashboard() {
  const [config, setConfig] = useState(null)
  const [projects, setProjects] = useState([])
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) || null,
    [projects, selectedProjectId]
  )

  const loadProjects = async () => {
    const result = await window.flywork.yunxiaoListProjects()
    if (!result.success) throw new Error(result.error || '加载项目失败')
    const normalized = (result.projects || [])
      .map((project) => ({
        id: idOf(projectPayload(project)),
        name: nameOf(
          projectPayload(project),
          text(projectPayload(project)?.identifier, '未命名项目')
        ),
        description: text(projectPayload(project)?.description || projectPayload(project)?.detail),
        customCode: text(projectPayload(project)?.customCode || projectPayload(project)?.code),
        icon: text(projectPayload(project)?.icon),
        raw: project
      }))
      .filter((project) => project.id)
    setProjects(normalized)
    setSelectedProjectId((current) =>
      normalized.some((project) => project.id === current) ? current : normalized[0]?.id || ''
    )
  }

  const refresh = async () => {
    try {
      setLoading(true)
      setError(null)
      const auth = await window.flywork?.yunxiaoCheckAuth?.()
      if (!auth?.success || !auth.configured) throw new Error('请先在云效设置中配置访问令牌')
      setConfig(auth)
      await loadProjects()
    } catch (err) {
      setError(err.message || '加载云效数据失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  if (loading && !config) return <Loading label="加载云效数据..." />
  if (error && !config) return <ErrorState error={error} onRetry={refresh} />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div
        className="page-header"
        style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)' }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12
          }}
        >
          <div>
            <div className="page-title">
              ☁️ 云效{' '}
              <span
                className="badge"
                style={{
                  marginLeft: 8,
                  background: 'var(--accent-green-dim)',
                  color: 'var(--accent-green)'
                }}
              >
                已连接
              </span>
            </div>
            <div className="page-subtitle">
              当前组织：{config?.currentOrganizationName || '未选择'}
            </div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={refresh} disabled={loading}>
            🔄 刷新
          </button>
        </div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
        <Notice message={error} />
        <WorkitemsTab
          project={selectedProject}
          projects={projects}
          onSelectProject={setSelectedProjectId}
        />
      </div>
    </div>
  )
}

function Loading({ label }) {
  return (
    <div className="empty-state" style={{ marginTop: 80 }}>
      <div style={{ fontSize: 32 }}>⏳</div>
      <div className="empty-state-desc">{label}</div>
    </div>
  )
}
function ErrorState({ error, onRetry }) {
  return (
    <div className="empty-state" style={{ marginTop: 80 }}>
      <div style={{ fontSize: 32 }}>⚠️</div>
      <div className="empty-state-title">云效连接失败</div>
      <div className="empty-state-desc">{error}</div>
      <button className="btn btn-primary" onClick={onRetry}>
        重试
      </button>
    </div>
  )
}
function ProjectPicker({ project, compact = false }) {
  return project ? (
    <div
      className="card"
      style={{
        padding: '10px 12px',
        marginBottom: compact ? 10 : 16,
        fontSize: 12,
        color: 'var(--text-secondary)',
        ...(compact
          ? {
              padding: '7px 10px',
              background: 'transparent',
              border: '1px solid var(--border)'
            }
          : {})
      }}
    >
      当前项目：<strong style={{ color: 'var(--text-primary)' }}>{project.name}</strong>
    </div>
  ) : (
    <div className="empty-state" style={{ marginTop: 50 }}>
      <div className="empty-state-title">请先选择项目</div>
      <div className="empty-state-desc">请在“项目”页选择一个云效项目。</div>
    </div>
  )
}

function ProjectsTab({ projects, selectedProjectId, onSelect, onRefresh }) {
  if (!projects.length)
    return (
      <div className="empty-state" style={{ marginTop: 60 }}>
        <div style={{ fontSize: 44 }}>📁</div>
        <div className="empty-state-title">暂无可访问项目</div>
        <div className="empty-state-desc">请检查组织权限，或在云效中创建项目后刷新。</div>
        <button className="btn btn-primary" onClick={onRefresh}>
          刷新项目
        </button>
      </div>
    )
  return (
    <div>
      <div
        className="card"
        style={{
          padding: '18px 20px',
          marginBottom: 18,
          background: 'linear-gradient(135deg, rgba(79,158,248,0.17), rgba(124,108,247,0.11))',
          border: '1px solid rgba(79,158,248,0.28)'
        }}
      >
        <div
          style={{
            fontSize: 18,
            fontWeight: 700,
            color: 'var(--text-primary)',
            letterSpacing: '-0.2px'
          }}
        >
          项目空间
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 6 }}>
          共 {projects.length} 个项目。选择一个项目后，可直接管理它的工作项和成员。
        </div>
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: 14
        }}
      >
        {projects.map((project) => (
          <button
            key={project.id}
            className="card"
            onClick={() => onSelect(project.id)}
            style={{
              padding: 20,
              textAlign: 'left',
              cursor: 'pointer',
              minHeight: 160,
              border:
                project.id === selectedProjectId
                  ? '1px solid var(--accent-blue)'
                  : '1px solid var(--border)',
              background:
                project.id === selectedProjectId
                  ? 'linear-gradient(145deg, rgba(79,158,248,0.22), rgba(124,108,247,0.12))'
                  : 'var(--bg-elevated)',
              boxShadow:
                project.id === selectedProjectId ? '0 10px 24px rgba(0,0,0,0.2)' : undefined
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 24 }}>
                {project.icon ? (
                  <img
                    src={project.icon}
                    alt=""
                    style={{ width: 28, height: 28, objectFit: 'cover', borderRadius: 6 }}
                  />
                ) : (
                  '📁'
                )}
              </span>
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 15,
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {project.name}
                </div>
                {project.id === selectedProjectId && (
                  <div style={{ fontSize: 11, marginTop: 4, color: 'var(--accent-blue)' }}>
                    当前已选项目
                  </div>
                )}
              </div>
            </div>
            <div
              style={{
                marginTop: 18,
                fontSize: 12,
                lineHeight: 1.65,
                color: 'var(--text-secondary)',
                minHeight: 40,
                overflow: 'hidden',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical'
              }}
            >
              {project.description || '暂无描述'}
            </div>
            {project.customCode && (
              <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-muted)' }}>
                🔖 {project.customCode}
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}

function WorkitemsTab({ project, projects, onSelectProject }) {
  const categories = [
    ['Bug', '缺陷'],
    ['Task', '任务'],
    ['Req', '需求'],
    ['Risk', '风险']
  ]
  const [items, setItems] = useState([])
  const [statuses, setStatuses] = useState([])
  const [statusesByType, setStatusesByType] = useState({})
  const [availableTypes, setAvailableTypes] = useState([])
  const [members, setMembers] = useState([])
  const [typeId, setTypeId] = useState('')
  const [memberId, setMemberId] = useState('')
  const [statusId, setStatusId] = useState('')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [updatingItemIds, setUpdatingItemIds] = useState(() => new Set())
  const [error, setError] = useState(null)
  const [selected, setSelected] = useState(null)
  const [detail, setDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState(null)
  const detailRequestRef = useRef(0)
  const pageSize = 12
  const load = async () => {
    if (!project) return
    try {
      setLoading(true)
      setError(null)
      const collected = []
      for (let i = 0; i < 20; i += 1) {
        const result = await window.flywork.yunxiaoListWorkitems({
          projectId: project.id,
          page: i + 1,
          perPage: 100
        })
        if (!result.success) throw new Error(result.error)
        collected.push(...(result.workitems || []))
        if (!result.hasMore) break
      }
      const [memberResult, ...typeResults] = await Promise.all([
        window.flywork.yunxiaoListProjectMembers(project.id),
        ...categories.map(([id]) => window.flywork.yunxiaoListProjectWorkitemTypes(project.id, id))
      ])
      const types = typeResults.flatMap((result, index) =>
        result.success
          ? (result.types || []).map((type) => ({ ...type, category: categories[index][0] }))
          : []
      )
      const workflowResults = await Promise.all(
        types.map((type) =>
          window.flywork.yunxiaoListWorkflowStatuses({
            projectId: project.id,
            workitemTypeId: type.identifier
          })
        )
      )
      setItems(Array.from(new Map(collected.map((item) => [idOf(item), item])).values()))
      setMembers(memberResult.success ? memberResult.members || [] : [])
      setAvailableTypes(types)
      const byType = Object.fromEntries(
        types.map((type, index) => [
          type.identifier,
          workflowResults[index]?.success ? workflowResults[index].statuses || [] : []
        ])
      )
      setStatusesByType(byType)
      setStatuses(
        Array.from(
          new Map(
            Object.values(byType)
              .flat()
              .map((status) => [idOf(status), status])
          ).values()
        )
      )
    } catch (err) {
      setError(err.message || '加载工作项失败')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    setItems([])
    setSelected(null)
    setDetail(null)
    setDetailError(null)
    setTypeId('')
    setMemberId('')
    setStatusId('')
    setPage(1)
    load()
  }, [project?.id])
  useEffect(() => {
    setPage(1)
  }, [memberId, statusId])
  const memberIdOf = (item) => item.assignedTo?.id || item.assignedToId || item.assignedTo || ''
  const statusIdOf = (item) => item.status?.id || item.statusId || item.statusIdentifier || ''
  const statusNameOf = (item) => nameOf(item.status, displayValue(item.status, '未设置'))
  const workitemTypeIdOf = (item) =>
    item.workitemTypeIdentifier ||
    item.workitemTypeId ||
    item.workitemType?.identifier ||
    item.workitemType?.id ||
    item.typeIdentifier ||
    ''
  const statusOptionsFor = (item) => statusesByType[workitemTypeIdOf(item)] || []
  const filterStatuses = Array.from(
    new Map(statuses.map((status) => [nameOf(status, displayValue(status, '未设置')), status])).values()
  )
  const statusColorOf = (item) => {
    const statusName = statusNameOf(item).replaceAll(' ', '')
    const mappedColors = {
      待确认: 'var(--accent-amber)',
      再次打开: 'var(--accent-red)',
      处理中: 'var(--accent-blue)',
      已修复: 'var(--accent-green)',
      暂不修复: 'var(--accent-purple)',
      已关闭: 'var(--text-muted)'
    }
    if (mappedColors[statusName]) return mappedColors[statusName]
    const status =
      statusOptionsFor(item).find((candidate) => idOf(candidate) === statusIdOf(item)) ||
      statuses.find((candidate) => idOf(candidate) === statusIdOf(item))
    if (status?.color) return status.color
    const value = displayValue(item.status, '').toLowerCase()
    if (value.includes('完成') || value.includes('closed') || value.includes('archived'))
      return 'var(--accent-green)'
    if (value.includes('阻塞') || value.includes('failed')) return 'var(--accent-red)'
    if (value.includes('进行') || value.includes('doing') || value.includes('progress'))
      return 'var(--accent-blue)'
    return 'var(--accent-amber)'
  }
  const filtered = items.filter((item) => {
    const itemTypeId = workitemTypeIdOf(item)
    return (
      (!typeId || itemTypeId === typeId) &&
      (!memberId || memberIdOf(item) === memberId) &&
      (!statusId || statusNameOf(item) === statusId)
    )
  })
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const visibleItems = filtered.slice((page - 1) * pageSize, page * pageSize)
  const updateStatus = async (item, value) => {
    const itemId = idOf(item)
    const status = statusOptionsFor(item).find((candidate) => idOf(candidate) === value)
    setUpdatingItemIds((current) => new Set(current).add(itemId))
    try {
      const result = await window.flywork.yunxiaoUpdateWorkitemField(itemId, { status: value })
      if (!result.success) throw new Error(result.error || '更新状态失败')

      const applyStatus = (current) =>
        current && idOf(current) === itemId ? patchWorkitemStatus(current, status) : current
      setItems((current) => current.map((current) => applyStatus(current)))
      setSelected(applyStatus)
      setDetail(applyStatus)
    } catch (err) {
      const message = err.message || '更新状态失败'
      setError(message)
      window.setTimeout(() => {
        setError((current) => (current === message ? null : current))
      }, 4000)
    } finally {
      setUpdatingItemIds((current) => {
        const next = new Set(current)
        next.delete(itemId)
        return next
      })
    }
  }
  const selectWorkitem = async (item) => {
    if (window.flywork.yunxiaoOpenWorkitemDetail) {
      const result = await window.flywork.yunxiaoOpenWorkitemDetail(idOf(item))
      if (result.success) return
      setError(result.error || '打开工作项详情失败')
      return
    }
    const requestId = detailRequestRef.current + 1
    detailRequestRef.current = requestId
    setSelected(item)
    setDetail(null)
    setDetailError(null)
    setDetailLoading(true)
    try {
      const result = await window.flywork.yunxiaoGetWorkitem(idOf(item))
      if (!result.success) throw new Error(result.error || '加载工作项详情失败')
      if (detailRequestRef.current === requestId) setDetail(result.workitem)
    } catch (err) {
      if (detailRequestRef.current === requestId)
        setDetailError(err.message || '加载工作项详情失败')
    } finally {
      if (detailRequestRef.current === requestId) setDetailLoading(false)
    }
  }
  if (!project) return <ProjectPicker project={project} />
  return (
    <div>
      <Notice message={error} />
      <div
        className="card"
        style={{
          padding: '10px 12px',
          marginBottom: 10,
          background: 'rgba(79,158,248,0.06)'
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16
          }}
        >
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>工作项</div>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={load} disabled={loading}>
            ↻ 同步云效
          </button>
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
          <select
            value={project.id}
            onChange={(e) => onSelectProject(e.target.value)}
            style={{ minWidth: 180 }}
            aria-label="当前项目"
          >
            {projects.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.name}
              </option>
            ))}
          </select>
          <select
            value={typeId}
            onChange={(e) => setTypeId(e.target.value)}
            style={{ minWidth: 160 }}
          >
            <option value="">所有云效类型</option>
            {availableTypes.map((type) => (
              <option key={type.identifier} value={type.identifier}>
                {type.name || type.nameEn || type.identifier}
              </option>
            ))}
          </select>
          <select
            value={memberId}
            onChange={(e) => setMemberId(e.target.value)}
            style={{ minWidth: 160 }}
          >
            <option value="">所有项目成员</option>
            {members.map((member) => (
              <option key={idOf(member)} value={idOf(member)}>
                {nameOf(member, displayValue(member, '未命名成员'))}
              </option>
            ))}
          </select>
          <select
            value={statusId}
            onChange={(e) => setStatusId(e.target.value)}
            style={{ minWidth: 150 }}
          >
            <option value="">所有状态</option>
            {filterStatuses.map((status) => (
              <option key={nameOf(status, displayValue(status, '未设置'))} value={nameOf(status)}>
                {nameOf(status)}
              </option>
            ))}
          </select>
        </div>
      </div>
      {loading ? (
        <Loading label="正在从云效拉取全部工作项..." />
      ) : (
        <div>
          <div className="card" style={{ overflow: 'hidden' }}>
          <div
            style={{
              padding: '14px 18px',
              display: 'flex',
              justifyContent: 'space-between',
              borderBottom: '1px solid var(--border)',
              fontSize: 12,
              color: 'var(--text-secondary)'
            }}
          >
            <span>全部工作项 · {filtered.length} 条</span>
            <span>
              第 {page} / {totalPages} 页
            </span>
          </div>
          {visibleItems.length ? (
            visibleItems.map((item) => (
              <div
                key={idOf(item)}
                style={{
                  padding: '16px 18px',
                  borderBottom: '1px solid var(--border)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  cursor: 'pointer',
                  background:
                    selected && idOf(selected) === idOf(item) ? 'var(--bg-selected)' : undefined
                }}
                onClick={() => selectWorkitem(item)}
              >
                <div
                  style={{
                    width: 4,
                    alignSelf: 'stretch',
                    borderRadius: 99,
                    background: statusColorOf(item)
                  }}
                />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 650,
                      color: 'var(--text-primary)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {nameOf(item)}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 7 }}>
                    {displayValue(item.serialNumber, idOf(item))} ·{' '}
                    {displayValue(item.assignedTo, '未指派')} ·{' '}
                    {formatDate(item.gmtModified || item.gmtCreate)}
                  </div>
                </div>
                {statusOptionsFor(item).length ? (
                  <select
                    value={statusIdOf(item)}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => updateStatus(item, e.target.value)}
                    disabled={updatingItemIds.has(idOf(item))}
                    style={{ minWidth: 112 }}
                  >
                    {!statusOptionsFor(item).some(
                      (status) => idOf(status) === statusIdOf(item)
                    ) && <option value={statusIdOf(item)}>{displayValue(item.status, '未设置')}</option>}
                    {statusOptionsFor(item).map((status) => (
                      <option key={idOf(status)} value={idOf(status)}>
                        {nameOf(status)}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="badge badge-gray" style={{ whiteSpace: 'nowrap' }}>
                    {displayValue(item.status, '未设置状态')}
                  </span>
                )}
              </div>
            ))
          ) : (
            <div className="empty-state" style={{ margin: 40 }}>
              <div className="empty-state-title">没有匹配的工作项</div>
              <div className="empty-state-desc">请调整筛选条件后重试。</div>
            </div>
          )}
          <div style={{ padding: 14, display: 'flex', justifyContent: 'center', gap: 8 }}>
            <button
              className="btn btn-ghost btn-sm"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              上一页
            </button>
            <button
              className="btn btn-ghost btn-sm"
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
            >
              下一页
            </button>
          </div>
          </div>
          {selected && (
            <WorkitemDetailPanel
              item={selected}
              detail={detail}
              loading={detailLoading}
              error={detailError}
              onClose={() => {
                detailRequestRef.current += 1
                setSelected(null)
                setDetail(null)
                setDetailError(null)
              }}
            />
          )}
        </div>
      )}
    </div>
  )
}

export function WorkitemDetailPanel({ item, detail, loading, error, onClose, standalone = false }) {
  const workitem = detail || item
  const labels = Array.isArray(workitem.labels) ? workitem.labels : []
  const participants = Array.isArray(workitem.participants) ? workitem.participants : []
  return (
    <div
      style={{
        position: 'fixed',
        zIndex: 30,
        inset: 0,
        display: 'grid',
        placeItems: 'center',
        padding: 24,
        height: '100vh',
        background: standalone ? 'var(--bg-primary)' : 'rgba(0, 0, 0, 0.54)'
      }}
      onClick={standalone ? undefined : onClose}
    >
      <aside
        className="card"
        style={{
          width: standalone ? '100%' : 'min(760px, 100%)',
          height: standalone ? '100%' : undefined,
          maxHeight: standalone ? 'none' : 'min(760px, calc(100vh - 48px))',
          padding: 18,
          overflowY: 'auto',
          boxShadow: '0 24px 64px rgba(0, 0, 0, 0.45)'
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 12,
            alignItems: 'center',
            position: 'sticky',
            zIndex: 1,
            top: -18,
            margin: '-18px -18px 0',
            padding: '12px 18px',
            background: 'var(--bg-elevated)',
            borderBottom: '1px solid var(--border)'
          }}
        >
          <div style={{ minWidth: 0, display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ flexShrink: 0, fontSize: 11, color: 'var(--text-muted)' }}>
              {displayValue(workitem.serialNumber, idOf(workitem))}
            </span>
            <div
              style={{
                fontSize: 16,
                fontWeight: 700,
                lineHeight: 1.35,
                color: 'var(--text-primary)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}
            >
              {nameOf(workitem)}
            </div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="关闭详情">
            ×
          </button>
        </div>
        {loading && <div style={{ marginTop: 16, fontSize: 12, color: 'var(--text-secondary)' }}>正在加载详情…</div>}
        {error && (
          <div style={{ marginTop: 16, fontSize: 12, color: 'var(--accent-red)' }}>⚠️ {error}</div>
        )}
        {!loading && !error && (
          <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 16px', marginTop: 14 }}>
            <DetailField label="状态" value={displayValue(workitem.status, '未设置')} />
            <DetailField label="类型" value={displayValue(workitem.workitemType, '未设置')} />
            <DetailField label="负责人" value={displayValue(workitem.assignedTo, '未指派')} />
            <DetailField label="创建人" value={displayValue(workitem.creator, '未设置')} />
            <DetailField label="创建时间" value={formatDate(workitem.gmtCreate)} />
            <DetailField label="更新时间" value={formatDate(workitem.gmtModified)} />
            {workitem.sprint && <DetailField label="迭代" value={displayValue(workitem.sprint)} />}
            {workitem.space && <DetailField label="项目" value={displayValue(workitem.space)} />}
          </div>
          {workitem.description && (
            <section style={{ marginTop: 20 }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>描述</div>
              <div className="yunxiao-markdown">
                <DescriptionContent
                  description={workitem.description}
                  formatType={workitem.formatType}
                  workitemId={idOf(workitem)}
                />
              </div>
            </section>
          )}
          {labels.length > 0 && (
            <section style={{ marginTop: 20 }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>标签</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {labels.map((label) => (
                  <span className="badge badge-gray" key={idOf(label) || nameOf(label)}>
                    {nameOf(label)}
                  </span>
                ))}
              </div>
            </section>
          )}
          {participants.length > 0 && (
            <section style={{ marginTop: 20 }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>参与人</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                {participants.map((person) => nameOf(person)).join('、')}
              </div>
            </section>
          )}
          </>
        )}
      </aside>
    </div>
  )
}

function DetailField({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 13, color: 'var(--text-primary)', overflowWrap: 'anywhere' }}>{value}</div>
    </div>
  )
}

function MembersTab({ project }) {
  const [members, setMembers] = useState([])
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const load = async () => {
    if (!project) {
      setMembers([])
      return
    }
    try {
      setLoading(true)
      setError(null)
      const result = await window.flywork.yunxiaoListProjectMembers(project.id)
      if (!result.success) throw new Error(result.error)
      setMembers(result.members || [])
    } catch (err) {
      setError(err.message || '加载成员失败')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    load()
  }, [project?.id])
  return (
    <div>
      <ProjectPicker project={project} />
      {!project ? null : <Notice message={error} />}
      {!project ? null : loading ? (
        <Loading label="加载成员..." />
      ) : (
        <div className="card">
          {members.length ? (
            members.map((member) => (
              <div
                key={idOf(member)}
                style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)' }}
              >
                <strong style={{ fontSize: 13 }}>
                  {nameOf(member, member.accountName || '未命名成员')}
                </strong>
                <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--text-muted)' }}>
                  {member.roleName || member.role || member.accountId || ''}
                </span>
              </div>
            ))
          ) : (
            <div className="empty-state" style={{ margin: 30 }}>
              <div className="empty-state-desc">暂无成员数据</div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

import { useEffect, useState } from 'react'
import { WorkitemDetailPanel } from './YunxiaoDashboard'

export default function WorkitemDetailWindow({ workitemId }) {
  const [detail, setDetail] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const result = await window.flywork.yunxiaoGetWorkitem(workitemId)
        if (!result.success) throw new Error(result.error || '加载工作项详情失败')
        if (!cancelled) setDetail(result.workitem)
      } catch (err) {
        if (!cancelled) setError(err.message || '加载工作项详情失败')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [workitemId])

  return (
    <WorkitemDetailPanel
      item={{ id: workitemId, subject: '工作项详情' }}
      detail={detail}
      loading={loading}
      error={error}
      standalone
      onClose={() => window.close()}
    />
  )
}

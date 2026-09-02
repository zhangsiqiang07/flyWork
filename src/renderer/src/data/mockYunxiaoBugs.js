export const MOCK_YUNXIAO_BUGS = [
  {
    id: 'YX-BUG-9021',
    identifier: 'YX-BUG-9021',
    serialNumber: 'PET-BUG-1024',
    subject: '历史报告列表在离线无网络时下拉刷新发生解包崩溃',
    name: '历史报告列表在离线无网络时下拉刷新发生解包崩溃',
    workitemType: { identifier: 'Bug', name: '缺陷', category: 'Bug' },
    category: 'Bug',
    status: { id: 's-1', name: '待确认', color: 'var(--accent-amber)' },
    assignedTo: { id: 'u-1', name: 'Alex' },
    creator: 'Sarah (PM)',
    gmtCreate: Date.now() - 3600000 * 5,
    gmtModified: Date.now() - 3600000 * 2,
    severity: 'urgent',
    description:
      '重现步骤：\n1. 进入个人中心健康历史报告页面；\n2. 断开 Wi-Fi 与蜂窝移动网络；\n3. 下拉列表触发刷新；\n4. 出现 fatalError: Unexpectedly found nil while unwrapping an Optional value。\n\n需要增加强类型可选解包保护与离线 SQLite 降级策略。',
    formatType: 'MARKDOWN'
  },
  {
    id: 'YX-BUG-9022',
    identifier: 'YX-BUG-9022',
    serialNumber: 'PET-BUG-1025',
    subject: '应激评估等级趋势折线图在部分机型上右侧坐标轴显示截断',
    name: '应激评估等级趋势折线图在部分机型上右侧坐标轴显示截断',
    workitemType: { identifier: 'Bug', name: '缺陷', category: 'Bug' },
    category: 'Bug',
    status: { id: 's-2', name: '处理中', color: 'var(--accent-blue)' },
    assignedTo: { id: 'u-2', name: 'Sarah' },
    creator: 'David (QA)',
    gmtCreate: Date.now() - 3600000 * 18,
    gmtModified: Date.now() - 3600000 * 4,
    severity: 'normal',
    description:
      '在 iPhone 13 mini 及小屏设备中，趋势折线图右侧 Y 轴标签超出 Safe Area 边缘，需调整 padding 布局规则并动态计算视口宽度。',
    formatType: 'MARKDOWN'
  },
  {
    id: 'YX-BUG-9023',
    identifier: 'YX-BUG-9023',
    serialNumber: 'PET-BUG-1026',
    subject: '离线 SQLite 缓存持久化失败，重新启动 App 后历史数据被重置',
    name: '离线 SQLite 缓存持久化失败，重新启动 App 后历史数据被重置',
    workitemType: { identifier: 'Bug', name: '缺陷', category: 'Bug' },
    category: 'Bug',
    status: { id: 's-1', name: '待确认', color: 'var(--accent-amber)' },
    assignedTo: { id: 'u-1', name: 'Alex' },
    creator: 'Frank (Architect)',
    gmtCreate: Date.now() - 3600000 * 24,
    gmtModified: Date.now() - 3600000 * 6,
    severity: 'high',
    description:
      '数据库连接池在后台线程未正常 commit 事务，导致未持久化到本地文件系统。需要排查 WAL 模式与并发读写锁。',
    formatType: 'MARKDOWN'
  },
  {
    id: 'YX-BUG-9024',
    identifier: 'YX-BUG-9024',
    serialNumber: 'PET-BUG-1027',
    subject: '健康建议卡片分享为微信长图时文字重叠错位',
    name: '健康建议卡片分享为微信长图时文字重叠错位',
    workitemType: { identifier: 'Bug', name: '缺陷', category: 'Bug' },
    category: 'Bug',
    status: { id: 's-3', name: '待修复', color: 'var(--accent-amber)' },
    assignedTo: { id: 'u-3', name: 'David' },
    creator: 'Sarah (PM)',
    gmtCreate: Date.now() - 3600000 * 30,
    gmtModified: Date.now() - 3600000 * 12,
    severity: 'normal',
    description:
      '使用 UIGraphicsImageRenderer 绘制长图截图时，未计算动态多行文本的实际高度 bounding rect。',
    formatType: 'MARKDOWN'
  }
]

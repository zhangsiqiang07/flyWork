import test from 'node:test'
import assert from 'node:assert/strict'
import {
  getWeeklyAgentChats,
  getAgentSessionMessages,
  parseClaudeSessionFile,
  generateWeeklyReport
} from './weeklyReport.js'
import { mkdtempSync, writeFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

test('Weekly Report Service - getWeeklyAgentChats function exists and returns array', async () => {
  assert.equal(typeof getWeeklyAgentChats, 'function')
  const res = await getWeeklyAgentChats({
    repoPaths: ['/Users/dimoo/Projects/PetPal'],
    repoNames: ['PetPal'],
    since: '2026-08-01',
    until: '2026-08-07',
    agent: 'ALL'
  })
  assert.ok(Array.isArray(res))
})

test('Weekly Report Service - parseClaudeSessionFile extracts accurate title, time, and messages', () => {
  assert.equal(typeof parseClaudeSessionFile, 'function')
  const tmpDir = mkdtempSync(join(tmpdir(), 'claude-test-'))
  const testFile = join(tmpDir, 'test-session-123.jsonl')

  const lines = [
    JSON.stringify({
      type: 'user',
      timestamp: '2026-09-14T09:30:00.000Z',
      cwd: '/Users/tester/MyProject',
      message: {
        role: 'user',
        content: '你是一名资深软件工程师。请根据标准输入中的 Git 改动生成一条准确的中文提交信息。'
      }
    }),
    JSON.stringify({
      type: 'assistant',
      timestamp: '2026-09-14T09:30:15.000Z',
      message: {
        role: 'assistant',
        content: [
          { type: 'text', text: 'feat(auth): 新增多因素认证支持与安全加固\n\n- 支持 TOTP\n- 加固会话' }
        ]
      }
    })
  ]

  writeFileSync(testFile, lines.join('\n'), 'utf-8')

  try {
    const res = parseClaudeSessionFile(testFile)
    assert.ok(res)
    assert.equal(res.sessionId, 'test-session-123')
    assert.equal(res.title, 'feat(auth): 新增多因素认证支持与安全加固')
    assert.equal(res.projectCwd, '/Users/tester/MyProject')
    assert.equal(res.messageCount, 2)
    assert.equal(res.messages[0].role, 'user')
    assert.equal(res.messages[1].role, 'assistant')
    assert.ok(res.messages[1].content.includes('多因素认证'))
    assert.ok(res.latestTimestamp >= new Date('2026-09-14T09:30:15.000Z').getTime())
  } finally {
    rmSync(tmpDir, { recursive: true, force: true })
  }
})

test('Weekly Report Service - getAgentSessionMessages returns array', () => {
  assert.equal(typeof getAgentSessionMessages, 'function')
  const msgs = getAgentSessionMessages('dummy-session-id', 'codex')
  assert.ok(Array.isArray(msgs))
})

test('Weekly Report Service - generateWeeklyReport with commits and chatRecords', async () => {
  const fakeCommits = [
    {
      id: 'repo-1-hash1',
      hash: 'a1b2c3d4e5f6',
      shortHash: 'a1b2c3d',
      author: 'Tester',
      date: '2026-09-12',
      subject: 'feat: 增加智能体聊天记录关联周报支持',
      repoName: 'FlyDeck',
      branch: 'main',
      stats: { filesChanged: 3, insertions: 45, deletions: 2, statSummary: '3 files changed' }
    },
    {
      id: 'repo-1-hash2',
      hash: 'f6e5d4c3b2a1',
      shortHash: 'f6e5d4c',
      author: 'Tester',
      date: '2026-09-13',
      subject: 'fix: 修复多工作区会话勾选时序问题',
      repoName: 'FlyDeck',
      branch: 'main',
      stats: { filesChanged: 1, insertions: 10, deletions: 5, statSummary: '1 file changed' }
    }
  ]

  const fakeChats = [
    {
      id: 'chat-001',
      sessionId: 'sess-claude-01',
      agent: 'Claude Code',
      repoName: 'FlyDeck',
      title: '研讨周报与智能体会话多源采集架构',
      summary: '研讨周报与智能体会话多源采集架构',
      date: '2026-09-12',
      updatedAt: '14:30',
      messageCount: 4,
      messages: [
        { role: 'user', content: '如何将各个智能体的聊天记录整合进周报生成中？', time: '14:20' },
        { role: 'assistant', content: '建议建立统一的会话扫描层，并支持用户在左侧交互面板中逐项勾选。', time: '14:30' }
      ]
    },
    {
      id: 'chat-002',
      sessionId: 'sess-codex-02',
      agent: 'ChatGPT / Codex',
      repoName: 'FlyDeck',
      title: '优化提示词模板与内置合成引擎',
      summary: '优化提示词模板与内置合成引擎',
      date: '2026-09-13',
      updatedAt: '16:00',
      messageCount: 2,
      preview: '探讨提示词中 {chatRecords} 占位符的解析方案'
    }
  ]

  const chunks = []
  const res = await generateWeeklyReport({
    taskId: 'test-task-001',
    agentId: 'builtin',
    prompt: '周报生成：\n{commits}\n{chatRecords}',
    commits: fakeCommits,
    chatRecords: fakeChats,
    repoNames: ['FlyDeck'],
    dateRange: '2026-09-08 ~ 2026-09-14',
    onChunk: (c) => chunks.push(c)
  })

  assert.equal(res.success, true)
  assert.ok(res.report)
  // Check that the generated report contains the agent collaboration section
  assert.ok(res.report.includes('智能体'))
  assert.ok(res.report.includes('Claude Code'))
  assert.ok(res.report.includes('增加智能体聊天记录关联周报支持'))
  assert.ok(chunks.length > 0)
})

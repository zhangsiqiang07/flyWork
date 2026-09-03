import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import {
  resolveSafePath,
  listWorkspaceAgentRules,
  readWorkspaceAgentRule,
  saveWorkspaceAgentRule,
  createWorkspaceAgentRule,
  deleteWorkspaceAgentRule,
  COMMON_AGENTS,
  RULE_TEMPLATES,
  RULE_SNIPPETS
} from './agentRulesService.js'

test('resolveSafePath enforces directory boundaries and prevents directory traversal', () => {
  const root = '/Users/test/my-project'

  // Valid paths
  const p1 = resolveSafePath(root, 'CLAUDE.md')
  assert.equal(p1, path.resolve('/Users/test/my-project/CLAUDE.md'))

  const p2 = resolveSafePath(root, '.cursor/rules/react.mdc')
  assert.equal(p2, path.resolve('/Users/test/my-project/.cursor/rules/react.mdc'))

  // Path traversal attacks
  assert.throws(() => resolveSafePath(root, '../other/secret.txt'), /路径越界/)
  assert.throws(() => resolveSafePath(root, '../../etc/passwd'), /路径越界/)
  assert.throws(() => resolveSafePath(root, 'sub/../../..'), /路径越界/)
  assert.throws(() => resolveSafePath(root, 'test\0file.md'), /非法字符/)
})

test('listWorkspaceAgentRules, create, read, save and delete workflow in temporary directory', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'flywork-rules-test-'))

  try {
    // 1. Initially empty directory
    const initialList = await listWorkspaceAgentRules(tmpDir)
    assert.equal(initialList.exists, true)
    assert.equal(initialList.totalConfigured, 0)
    assert.equal(initialList.totalAgentsConfigured, 0)
    assert.ok(initialList.agents.length >= 8)

    // Check templates and snippets are provided
    assert.ok(RULE_TEMPLATES.length >= 4)
    assert.ok(RULE_SNIPPETS.length >= 4)

    // 2. Create Claude Code rule file
    const createClaude = await createWorkspaceAgentRule(tmpDir, 'CLAUDE.md', 'minimal')
    assert.equal(createClaude.success, true)
    assert.ok(createClaude.size > 0)

    // Cannot recreate existing without save
    const recreateFail = await createWorkspaceAgentRule(tmpDir, 'CLAUDE.md')
    assert.equal(recreateFail.success, false)

    // 3. Create Cursor MDC rule inside subdirectory
    const createCursorMdc = await createWorkspaceAgentRule(
      tmpDir,
      '.cursor/rules/ui-guidelines.mdc',
      'frontend-react'
    )
    assert.equal(createCursorMdc.success, true)

    // 4. Create Copilot instructions
    const createCopilot = await createWorkspaceAgentRule(
      tmpDir,
      '.github/copilot-instructions.md',
      'fullstack-general'
    )
    assert.equal(createCopilot.success, true)

    // 5. Scan again, now should have 3 configured rules across 3 agents
    const secondList = await listWorkspaceAgentRules(tmpDir)
    assert.equal(secondList.totalConfigured, 3)
    assert.equal(secondList.totalAgentsConfigured, 3)

    const claudeAgent = secondList.agents.find((a) => a.id === 'claude')
    assert.ok(claudeAgent)
    assert.equal(claudeAgent.configuredCount, 1)
    const claudeRule = claudeAgent.rules.find((r) => r.name === 'CLAUDE.md')
    assert.equal(claudeRule.exists, true)

    // 6. Read rule content
    const readResult = await readWorkspaceAgentRule(tmpDir, 'CLAUDE.md')
    assert.equal(readResult.success, true)
    assert.ok(readResult.content.includes('项目核心准则'))

    // 7. Save updated content
    const updatedContent = '# Updated Claude Guidelines\n\n- Follow strict rules.\n'
    const saveResult = await saveWorkspaceAgentRule(tmpDir, 'CLAUDE.md', updatedContent)
    assert.equal(saveResult.success, true)

    const readAfterSave = await readWorkspaceAgentRule(tmpDir, 'CLAUDE.md')
    assert.equal(readAfterSave.content, updatedContent)

    // 8. Delete rule
    const deleteResult = await deleteWorkspaceAgentRule(tmpDir, 'CLAUDE.md')
    assert.equal(deleteResult.success, true)

    const readAfterDelete = await readWorkspaceAgentRule(tmpDir, 'CLAUDE.md')
    assert.equal(readAfterDelete.success, false)
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
})

test('listWorkspaceAgentRules detects all subdocuments inside .agent and its subdirectories', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'flywork-agent-dir-test-'))

  try {
    // Create nested .agent directory structure with multiple subdocuments
    await saveWorkspaceAgentRule(tmpDir, '.agent/rules.md', '# Agent Core Rules\n')
    await saveWorkspaceAgentRule(tmpDir, '.agent/rules/coding-style.md', '# Coding Style\n')
    await saveWorkspaceAgentRule(tmpDir, '.agent/prompts/reviewer.md', '# Reviewer Prompt\n')
    await saveWorkspaceAgentRule(tmpDir, '.agent/workflows/deploy.yaml', 'name: deploy\n')

    const listRes = await listWorkspaceAgentRules(tmpDir)
    assert.equal(listRes.exists, true)

    const agentDir = listRes.agents.find((a) => a.id === 'agent-dir')
    assert.ok(agentDir, '.agent agent profile should be present')
    assert.equal(agentDir.configuredCount, 4, 'Should detect all 4 subdocuments')

    const relPaths = agentDir.rules.map((r) => r.relativePath)
    assert.ok(relPaths.includes('.agent/rules.md'))
    assert.ok(relPaths.includes('.agent/rules/coding-style.md'))
    assert.ok(relPaths.includes('.agent/prompts/reviewer.md'))
    assert.ok(relPaths.includes('.agent/workflows/deploy.yaml'))

    // Verify subdocument reading
    const readSub = await readWorkspaceAgentRule(tmpDir, '.agent/rules/coding-style.md')
    assert.equal(readSub.success, true)
    assert.equal(readSub.content, '# Coding Style\n')

    // Verify saving edit to subdocument
    const saveSub = await saveWorkspaceAgentRule(
      tmpDir,
      '.agent/rules/coding-style.md',
      '# Coding Style v2\n'
    )
    assert.equal(saveSub.success, true)
    const readSub2 = await readWorkspaceAgentRule(tmpDir, '.agent/rules/coding-style.md')
    assert.equal(readSub2.content, '# Coding Style v2\n')
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
})

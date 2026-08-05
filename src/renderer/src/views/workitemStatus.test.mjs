import assert from 'node:assert/strict'
import test from 'node:test'
import { patchWorkitemStatus } from './workitemStatus.mjs'

test('patchWorkitemStatus only replaces the changed work item data', () => {
  const original = {
    identifier: 'TASK-1',
    subject: 'Keep this row mounted',
    assignedTo: { id: 'u1', name: 'Ada' },
    status: { id: 'todo', name: '待处理' }
  }

  const updated = patchWorkitemStatus(original, { identifier: 'doing', name: '处理中' })

  assert.deepEqual(updated.status, { identifier: 'doing', name: '处理中' })
  assert.equal(updated.statusId, 'doing')
  assert.equal(updated.statusIdentifier, 'doing')
  assert.equal(updated.subject, original.subject)
  assert.deepEqual(updated.assignedTo, original.assignedTo)
})

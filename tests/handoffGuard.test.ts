import assert from 'node:assert/strict'
import test from 'node:test'

import { shouldIgnoreHandoffEvent } from '../src/renderer/src/lib/handoffGuard.ts'

test('backend finished handoff is ignored even when local pair state is stale', () => {
  assert.equal(
    shouldIgnoreHandoffEvent({
      pairStatus: 'Executing',
      backendStatus: 'Finished'
    }),
    true
  )
})

test('active handoff is allowed when neither state is finished', () => {
  assert.equal(
    shouldIgnoreHandoffEvent({
      pairStatus: 'Executing',
      backendStatus: 'Executing'
    }),
    false
  )
})

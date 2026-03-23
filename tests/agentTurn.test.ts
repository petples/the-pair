import assert from 'node:assert/strict'
import test from 'node:test'

import {
  NO_TEXT_RESPONSE_PLACEHOLDER,
  buildAgentTurnResult,
  getAgentTurnDirective
} from '../src/main/agentTurn.ts'

test('buildAgentTurnResult returns a silent result for empty successful turns', () => {
  assert.deepEqual(buildAgentTurnResult('', 0, ''), {
    kind: 'silent',
    content: NO_TEXT_RESPONSE_PLACEHOLDER
  })
})

test('getAgentTurnDirective pauses silent mentor turns instead of handing off to the executor', () => {
  const directive = getAgentTurnDirective('mentor', {
    kind: 'silent',
    content: NO_TEXT_RESPONSE_PLACEHOLDER
  })

  assert.equal(directive.type, 'pause')
  assert.equal(directive.to, 'human')
  assert.equal(directive.messageType, 'question')
  assert.match(directive.content, /paused/i)
  assert.match(directive.content, /empty-response loop/i)
})

test('getAgentTurnDirective keeps normal executor updates flowing back to the mentor', () => {
  assert.deepEqual(
    getAgentTurnDirective('executor', {
      kind: 'message',
      content: 'Implemented the requested fix.'
    }),
    {
      type: 'handoff',
      nextRole: 'mentor',
      to: 'mentor',
      messageType: 'progress',
      content: 'Implemented the requested fix.'
    }
  )
})

test('getAgentTurnDirective pauses on error instead of handing off', () => {
  const directive = getAgentTurnDirective('mentor', {
    kind: 'error',
    content: 'ProviderModelNotFoundError: Model not found'
  })

  assert.equal(directive.type, 'pause')
  assert.equal(directive.to, 'human')
  assert.equal(directive.messageType, 'question')
  assert.match(directive.content, /Error occurred/i)
  assert.match(directive.content, /ProviderModelNotFoundError/i)
})

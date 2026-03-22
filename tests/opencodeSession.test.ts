import assert from 'node:assert/strict'
import test from 'node:test'

import { buildOpencodeRunArgs, extractOpencodeSessionId } from '../src/main/opencodeSession.ts'

test('buildOpencodeRunArgs omits --session before a real opencode session id exists', () => {
  assert.deepEqual(buildOpencodeRunArgs('bailian-coding-plan/glm-5'), [
    'run',
    '--model',
    'bailian-coding-plan/glm-5',
    '--format',
    'json'
  ])
})

test('buildOpencodeRunArgs reuses a real opencode session id on later turns', () => {
  assert.deepEqual(buildOpencodeRunArgs('bailian-coding-plan/glm-5', 'ses_real123'), [
    'run',
    '--model',
    'bailian-coding-plan/glm-5',
    '--session',
    'ses_real123',
    '--format',
    'json'
  ])
})

test('extractOpencodeSessionId reads the session id from JSON event payloads', () => {
  assert.equal(
    extractOpencodeSessionId({
      type: 'text',
      sessionID: 'ses_top_level',
      part: {
        sessionID: 'ses_nested',
        text: 'hello'
      }
    }),
    'ses_top_level'
  )
})

test('extractOpencodeSessionId falls back to nested part session ids', () => {
  assert.equal(
    extractOpencodeSessionId({
      type: 'step_start',
      part: {
        sessionID: 'ses_nested_only'
      }
    }),
    'ses_nested_only'
  )
})

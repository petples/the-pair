import assert from 'node:assert/strict'
import test from 'node:test'

import { prependPathEntry } from '../scripts/rustup-env.mjs'

test('prependPathEntry joins PATH entries with the platform delimiter', () => {
  assert.equal(
    prependPathEntry('/Users/example/.cargo/bin', '/usr/local/bin:/usr/bin', ':'),
    '/Users/example/.cargo/bin:/usr/local/bin:/usr/bin'
  )

  assert.equal(
    prependPathEntry(
      'C:\\Users\\example\\.cargo\\bin',
      'C:\\Windows\\System32;C:\\Windows',
      ';'
    ),
    'C:\\Users\\example\\.cargo\\bin;C:\\Windows\\System32;C:\\Windows'
  )
})

import assert from 'node:assert/strict'
import test from 'node:test'

import {
  getCrossBuildNotes,
  normalizePlatform,
  parseMinimumNodeRange
} from '../scripts/preflight.mjs'

test('parseMinimumNodeRange parses the project Node requirement', () => {
  assert.deepEqual(parseMinimumNodeRange('>=20'), { major: 20, minor: 0, patch: 0 })
  assert.deepEqual(parseMinimumNodeRange('>=22.22.0'), { major: 22, minor: 22, patch: 0 })
})

test('normalizePlatform maps host and target aliases to canonical labels', () => {
  assert.equal(normalizePlatform('darwin'), 'macos')
  assert.equal(normalizePlatform('mac'), 'macos')
  assert.equal(normalizePlatform('win32'), 'windows')
  assert.equal(normalizePlatform('linux'), 'linux')
})

test('getCrossBuildNotes explains macOS cross-build caveats', () => {
  const notes = getCrossBuildNotes({ hostPlatform: 'macos', targetPlatform: 'windows' })

  assert.equal(notes.length, 1)
  assert.match(notes[0], /llvm-rc/)
})

test('getCrossBuildNotes requires native macOS for mac bundles', () => {
  const notes = getCrossBuildNotes({ hostPlatform: 'linux', targetPlatform: 'macos' })

  assert.equal(notes.length, 1)
  assert.match(notes[0], /must be built on macOS/)
})

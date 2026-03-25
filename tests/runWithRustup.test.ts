import assert from 'node:assert/strict'
import test from 'node:test'

import {
  getPathEnvKey,
  resolveLaunchCommand
} from '../scripts/run-with-rustup.mjs'

test('getPathEnvKey preserves the existing PATH casing when it is already present', () => {
  assert.equal(getPathEnvKey({ PATH: '/usr/bin' }), 'PATH')
})

test('getPathEnvKey preserves Windows-style Path casing when that is the active key', () => {
  assert.equal(getPathEnvKey({ Path: 'C:\\Windows\\System32' }), 'Path')
})

test('resolveLaunchCommand runs Tauri through the current Node binary', () => {
  const result = resolveLaunchCommand('tauri')

  assert.equal(result.command, process.execPath)
  assert.match(result.args[0] ?? '', /@tauri-apps[\\/]+cli[\\/]+tauri\.js$/)
})

test('resolveLaunchCommand leaves non-Tauri commands untouched', () => {
  const result = resolveLaunchCommand('cargo')

  assert.equal(result.command, 'cargo')
  assert.deepEqual(result.args, [])
})

import assert from 'node:assert/strict'
import test from 'node:test'

import { derivePairNameFromDirectory } from '../src/renderer/src/lib/workspace.ts'

test('derivePairNameFromDirectory returns the selected folder name', () => {
  assert.equal(derivePairNameFromDirectory('/Users/alice/projects/the-pair'), 'the-pair')
  assert.equal(derivePairNameFromDirectory('/Users/alice/projects/the-pair/'), 'the-pair')
  assert.equal(derivePairNameFromDirectory('C:\\Users\\alice\\projects\\the-pair'), 'the-pair')
})

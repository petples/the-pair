import assert from 'node:assert/strict'
import test from 'node:test'

import { cn } from '../src/renderer/src/lib/utils.ts'

test('cn merges conflicting Tailwind classes with the later utility winning', () => {
  assert.equal(cn('px-2', 'px-4', 'text-sm'), 'px-4 text-sm')
})

test('cn ignores falsy fragments while preserving valid class names', () => {
  assert.equal(cn('flex', false, null, undefined, 'items-center'), 'flex items-center')
})

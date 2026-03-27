import assert from 'node:assert/strict'
import test from 'node:test'

import { shouldUseCompactOnboardingLayout } from '../src/renderer/src/lib/onboardingLayout.ts'

test('shouldUseCompactOnboardingLayout enables compact mode for the default window height', () => {
  assert.equal(shouldUseCompactOnboardingLayout(900), true)
  assert.equal(shouldUseCompactOnboardingLayout(860), true)
  assert.equal(shouldUseCompactOnboardingLayout(960), false)
})

import assert from 'node:assert/strict'
import test from 'node:test'

import {
  shouldSaveSnapshot,
  type SnapshotComparablePair
} from '../src/renderer/src/lib/snapshotDiff.ts'
import type { TurnTokenUsage } from '../src/renderer/src/types.ts'

function makeTokenUsage(outputTokens: number): TurnTokenUsage {
  return {
    outputTokens,
    inputTokens: 100,
    lastUpdatedAt: 2000,
    source: 'live',
    provider: 'claude'
  }
}

function makePair(): SnapshotComparablePair {
  return {
    status: 'Mentoring',
    turn: 'mentor',
    iterations: 1,
    currentRunStartedAt: 1000,
    runCount: 1,
    mentorModel: 'claude/sonnet',
    executorModel: 'gpt-4o-mini',
    currentTurnCard: {
      content: 'Mentor working',
      state: 'live',
      tokenUsage: makeTokenUsage(10)
    }
  }
}

test('shouldSaveSnapshot ignores unchanged pairs', () => {
  const previous = makePair()
  const next = makePair()

  assert.equal(shouldSaveSnapshot(previous, next), false)
})

test('shouldSaveSnapshot persists token usage changes on the active turn card', () => {
  const previous = makePair()
  const next = makePair()
  next.currentTurnCard = {
    ...next.currentTurnCard!,
    tokenUsage: makeTokenUsage(42)
  }

  assert.equal(shouldSaveSnapshot(previous, next), true)
})

test('shouldSaveSnapshot persists turn-card content changes', () => {
  const previous = makePair()
  const next = makePair()
  next.currentTurnCard = {
    ...next.currentTurnCard!,
    content: 'Mentor has new instructions'
  }

  assert.equal(shouldSaveSnapshot(previous, next), true)
})

import assert from 'node:assert/strict'
import test from 'node:test'

import { isPairBusy, resetPairStateForNewTask } from '../src/main/pairTaskState.ts'
import type { PairState } from '../src/main/types.ts'

function createState(): PairState {
  return {
    pairId: 'pair-1',
    directory: '/tmp/project',
    status: 'Finished',
    iteration: 4,
    maxIterations: 9999,
    turn: 'mentor',
    mentor: {
      status: 'Finished',
      turn: 'mentor',
      activity: {
        phase: 'idle',
        label: 'Task completed',
        startedAt: 10,
        updatedAt: 20
      }
    },
    executor: {
      status: 'Finished',
      turn: 'executor',
      activity: {
        phase: 'waiting',
        label: 'Executor completed',
        startedAt: 10,
        updatedAt: 20
      }
    },
    messages: [
      {
        id: 'msg-1',
        timestamp: 100,
        from: 'mentor',
        to: 'executor',
        type: 'plan',
        content: 'Do the thing',
        iteration: 4
      }
    ],
    mentorActivity: {
      phase: 'idle',
      label: 'Task completed',
      startedAt: 10,
      updatedAt: 20
    },
    executorActivity: {
      phase: 'waiting',
      label: 'Executor completed',
      startedAt: 10,
      updatedAt: 20
    },
    resources: {
      mentor: { cpu: 22, memMb: 320 },
      executor: { cpu: 44, memMb: 640 },
      pairTotal: { cpu: 66, memMb: 960 }
    },
    modifiedFiles: [
      {
        path: 'src/App.tsx',
        status: 'M',
        displayPath: 'src/App.tsx'
      }
    ],
    gitTracking: {
      available: true,
      rootPath: '/tmp/project',
      worktreePath: '/tmp/project/.worktree',
      gitReviewAvailable: true
    },
    automationMode: 'full-auto',
    turnArtifacts: [
      {
        iteration: 4,
        instructionSummary: 'Do the thing',
        preTurnHead: 'abc',
        postTurnHead: 'def',
        changedFiles: [],
        statusShort: 'success',
        diffStat: '',
        patchExcerpt: '',
        executorSummary: 'Done',
        verificationSummary: 'ok'
      }
    ],
    gitReviewAvailable: true
  }
}

test('resetPairStateForNewTask clears run-scoped state but preserves pair context', () => {
  const reset = resetPairStateForNewTask(createState())

  assert.equal(reset.status, 'Idle')
  assert.equal(reset.turn, 'mentor')
  assert.equal(reset.iteration, 0)
  assert.deepEqual(reset.messages, [])
  assert.deepEqual(reset.turnArtifacts, [])
  assert.deepEqual(reset.resources, {
    mentor: { cpu: 0, memMb: 0 },
    executor: { cpu: 0, memMb: 0 },
    pairTotal: { cpu: 0, memMb: 0 }
  })
  assert.deepEqual(reset.modifiedFiles, [])
  assert.equal(reset.directory, '/tmp/project')
  assert.equal(reset.gitTracking.worktreePath, '/tmp/project/.worktree')
  assert.equal(reset.mentorActivity.label, 'Mentor idle')
  assert.equal(reset.executorActivity.label, 'Executor idle')
})

test('isPairBusy only reports active mentoring/executing/reviewing states as busy', () => {
  assert.equal(isPairBusy('Mentoring'), true)
  assert.equal(isPairBusy('Executing'), true)
  assert.equal(isPairBusy('Reviewing'), true)
  assert.equal(isPairBusy('Finished'), false)
  assert.equal(isPairBusy('Error'), false)
})

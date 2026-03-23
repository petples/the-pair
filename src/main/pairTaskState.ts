import type { AgentActivity, PairResources, PairState, PairStatus } from './types'

const EMPTY_RESOURCES: PairResources = {
  mentor: { cpu: 0, memMb: 0 },
  executor: { cpu: 0, memMb: 0 },
  pairTotal: { cpu: 0, memMb: 0 }
}

function createIdleActivity(label: string): AgentActivity {
  const now = Date.now()
  return {
    phase: 'idle',
    label,
    startedAt: now,
    updatedAt: now
  }
}

export function isPairBusy(status: PairStatus): boolean {
  return status === 'Mentoring' || status === 'Executing' || status === 'Reviewing'
}

export function resetPairStateForNewTask(state: PairState): PairState {
  const mentorActivity = createIdleActivity('Mentor idle')
  const executorActivity = createIdleActivity('Executor idle')

  return {
    ...state,
    status: 'Idle',
    iteration: 0,
    turn: 'mentor',
    mentor: {
      ...state.mentor,
      status: 'Idle',
      activity: mentorActivity
    },
    executor: {
      ...state.executor,
      status: 'Idle',
      activity: executorActivity
    },
    messages: [],
    mentorActivity,
    executorActivity,
    resources: {
      mentor: { ...EMPTY_RESOURCES.mentor },
      executor: { ...EMPTY_RESOURCES.executor },
      pairTotal: { ...EMPTY_RESOURCES.pairTotal }
    },
    modifiedFiles: [],
    turnArtifacts: []
  }
}

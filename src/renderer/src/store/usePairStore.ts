import { create } from 'zustand'
import type { AvailableModel, CreatePairInput, PairModelSelection } from '../types'

export type PairStatus =
  | 'Idle'
  | 'Mentoring'
  | 'Executing'
  | 'Reviewing'
  | 'Awaiting Human Review'
  | 'Error'
  | 'Finished'

export type ActivityPhase = 'idle' | 'thinking' | 'using_tools' | 'responding' | 'waiting' | 'error'

export interface AgentActivity {
  phase: ActivityPhase
  label: string
  detail?: string
  startedAt: number
  updatedAt: number
}

export interface ResourceInfo {
  cpu: number
  memMb: number
}

export interface PairResources {
  mentor: ResourceInfo
  executor: ResourceInfo
  pairTotal: ResourceInfo
}

export type FileStatus = 'A' | 'M' | 'D' | 'R' | '??'

export interface ModifiedFile {
  path: string
  status: FileStatus
  displayPath: string
}

export interface GitTracking {
  available: boolean
  rootPath?: string
}

export type AutomationMode = 'full-auto'

export interface Message {
  id: string
  timestamp: number
  from: 'mentor' | 'executor' | 'human'
  to: 'mentor' | 'executor' | 'both' | 'human'
  type: 'plan' | 'feedback' | 'progress' | 'result' | 'question' | 'handoff'
  content: string
  attachments?: { path: string; description: string }[]
  iteration: number
}

export interface PairRunSummary {
  id: string
  spec: string
  status: PairStatus
  startedAt: number
  finishedAt?: number
  mentorModel: string
  executorModel: string
  iterations: number
}

export interface Pair {
  id: string
  name: string
  directory: string
  status: PairStatus
  iterations: number
  maxIterations: number
  cpuUsage: number
  memUsage: number
  spec: string
  mentorModel: string
  executorModel: string
  pendingMentorModel?: string
  pendingExecutorModel?: string
  messages: Message[]
  mentorActivity: AgentActivity
  executorActivity: AgentActivity
  mentorCpu: number
  mentorMemMb: number
  executorCpu: number
  executorMemMb: number
  modifiedFiles: ModifiedFile[]
  gitTracking: GitTracking
  automationMode: AutomationMode
  turn: 'mentor' | 'executor'
  runCount: number
  runHistory: PairRunSummary[]
  currentRunStartedAt: number
  currentRunFinishedAt?: number
}

interface PairStateSnapshot {
  pairId?: string
  status?: PairStatus
  iteration?: number
  maxIterations?: number
  turn?: 'mentor' | 'executor'
  mentorStatus?: PairStatus
  executorStatus?: PairStatus
  mentorActivity?: AgentActivity
  executorActivity?: AgentActivity
  resources?: PairResources
  modifiedFiles?: ModifiedFile[]
  gitTracking?: GitTracking
  automationMode?: AutomationMode
}

interface PairStore {
  pairs: Pair[]
  availableModels: AvailableModel[]
  isLoading: boolean
  error: string | null

  loadAvailableModels: () => Promise<void>
  createPair: (
    input: Omit<CreatePairInput, 'mentor' | 'executor'> & {
      mentorModel: string
      executorModel: string
    }
  ) => Promise<void>
  assignTask: (pairId: string, spec: string) => Promise<void>
  updatePairModels: (pairId: string, selection: PairModelSelection) => Promise<void>
  removePair: (id: string) => void
  updatePairStatus: (id: string, status: PairStatus) => void
  updatePairUsage: (id: string, cpu: number, mem: number) => void
  addMessage: (pairId: string, message: Message) => void
  setMessages: (pairId: string, messages: Message[]) => void
  syncState: (pairId: string, status: PairStatus, iteration: number) => void
  syncFullState: (pairId: string, state: Record<string, unknown>) => void
  humanFeedback: (pairId: string, approved: boolean) => Promise<void>
  retryTurn: (id: string) => Promise<void>
  initMessageListener: () => void
}

let _listenersInitialized = false

function createIdleActivity(label: string): AgentActivity {
  const now = Date.now()
  return {
    phase: 'idle',
    label,
    startedAt: now,
    updatedAt: now
  }
}

function createRunSummary(pair: Pair): PairRunSummary | null {
  if (!pair.spec.trim()) {
    return null
  }

  return {
    id: `${pair.id}-run-${pair.runCount}`,
    spec: pair.spec,
    status: pair.status,
    startedAt: pair.currentRunStartedAt,
    finishedAt: pair.currentRunFinishedAt ?? Date.now(),
    mentorModel: pair.mentorModel,
    executorModel: pair.executorModel,
    iterations: pair.iterations
  }
}

function resetPairForNewRun(pair: Pair, nextSpec: string, selection: PairModelSelection): Pair {
  const archivedRun = createRunSummary(pair)

  return {
    ...pair,
    status: 'Idle',
    iterations: 0,
    cpuUsage: 0,
    memUsage: 0,
    spec: nextSpec,
    mentorModel: selection.mentorModel,
    executorModel: selection.executorModel,
    pendingMentorModel: selection.pendingMentorModel,
    pendingExecutorModel: selection.pendingExecutorModel,
    messages: [],
    mentorActivity: createIdleActivity('Mentor idle'),
    executorActivity: createIdleActivity('Executor idle'),
    mentorCpu: 0,
    mentorMemMb: 0,
    executorCpu: 0,
    executorMemMb: 0,
    modifiedFiles: [],
    turn: 'mentor',
    runCount: pair.runCount + 1,
    runHistory: archivedRun ? [...pair.runHistory, archivedRun] : pair.runHistory,
    currentRunStartedAt: Date.now(),
    currentRunFinishedAt: undefined
  }
}

function syncPairFromState(pair: Pair, state: PairStateSnapshot): Pair {
  const nextStatus = state.status ?? pair.status
  const finishedNow =
    pair.currentRunFinishedAt === undefined &&
    (nextStatus === 'Finished' || nextStatus === 'Error') &&
    pair.status !== nextStatus

  return {
    ...pair,
    status: nextStatus,
    iterations: state.iteration ?? pair.iterations,
    turn: state.turn ?? pair.turn,
    mentorActivity: state.mentorActivity ?? pair.mentorActivity,
    executorActivity: state.executorActivity ?? pair.executorActivity,
    mentorCpu: state.resources?.mentor?.cpu ?? pair.mentorCpu,
    mentorMemMb: state.resources?.mentor?.memMb ?? pair.mentorMemMb,
    executorCpu: state.resources?.executor?.cpu ?? pair.executorCpu,
    executorMemMb: state.resources?.executor?.memMb ?? pair.executorMemMb,
    cpuUsage: state.resources?.pairTotal?.cpu ?? pair.cpuUsage,
    memUsage: state.resources?.pairTotal?.memMb ?? pair.memUsage,
    modifiedFiles: state.modifiedFiles ?? pair.modifiedFiles,
    gitTracking: state.gitTracking ?? pair.gitTracking,
    automationMode: state.automationMode ?? pair.automationMode,
    currentRunFinishedAt: finishedNow ? Date.now() : pair.currentRunFinishedAt
  }
}

export const usePairStore = create<PairStore>((set) => ({
  pairs: [],
  availableModels: [],
  isLoading: false,
  error: null,

  initMessageListener: () => {
    if (_listenersInitialized) return
    _listenersInitialized = true

    window.api.pair.onMessage((_data) => {
      set((state) => ({
        pairs: state.pairs.map((p) =>
          p.id === _data.pairId ? { ...p, messages: [...p.messages, _data.message] } : p
        )
      }))
    })

    window.api.pair.onState((_state: PairStateSnapshot) => {
      set((state) => ({
        pairs: state.pairs.map((p) => (p.id === _state.pairId ? syncPairFromState(p, _state) : p))
      }))
    })
  },

  loadAvailableModels: async () => {
    try {
      const models = await window.api.config.getModels()
      set({ availableModels: models })
    } catch (error) {
      console.error('Failed to load models:', error)
      set({ error: 'Failed to load models' })
    }
  },

  createPair: async (input) => {
    console.log('[usePairStore] createPair called', input)
    set({ isLoading: true, error: null })

    try {
      console.log('[usePairStore] Calling window.api.pair.create...')
      const pairProcess = await window.api.pair.create({
        name: input.name,
        directory: input.directory,
        spec: input.spec,
        mentor: { role: 'mentor', model: input.mentorModel },
        executor: { role: 'executor', model: input.executorModel }
      })
      console.log('[usePairStore] Pair created:', pairProcess)

      const now = Date.now()
      const newPair: Pair = {
        id: pairProcess.pairId,
        name: input.name,
        directory: input.directory,
        status: 'Idle',
        iterations: 0,
        maxIterations: 9999,
        cpuUsage: 0,
        memUsage: 0,
        spec: input.spec,
        mentorModel: input.mentorModel,
        executorModel: input.executorModel,
        messages: [],
        mentorActivity: createIdleActivity('Mentor idle'),
        executorActivity: createIdleActivity('Executor idle'),
        mentorCpu: 0,
        mentorMemMb: 0,
        executorCpu: 0,
        executorMemMb: 0,
        modifiedFiles: [],
        gitTracking: { available: false },
        automationMode: 'full-auto',
        turn: 'mentor',
        runCount: 1,
        runHistory: [],
        currentRunStartedAt: now
      }

      set((state) => ({
        pairs: [...state.pairs, newPair],
        isLoading: false
      }))
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create pair'
      set({
        isLoading: false,
        error: message
      })
      throw error instanceof Error ? error : new Error(message)
    }
  },

  assignTask: async (pairId, spec) => {
    console.log('[usePairStore] assignTask called', { pairId, spec })
    set({ isLoading: true, error: null })

    try {
      console.log('[usePairStore] Calling window.api.pair.assignTask...')
      const result = await window.api.pair.assignTask(pairId, { spec })
      console.log('[usePairStore] assignTask result:', result)

      set((state) => ({
        isLoading: false,
        pairs: state.pairs.map((pair) =>
          pair.id === pairId ? resetPairForNewRun(pair, result.spec, result) : pair
        )
      }))
    } catch (error) {
      console.error('[usePairStore] assignTask error:', error)
      const message = error instanceof Error ? error.message : 'Failed to assign task'
      set({
        isLoading: false,
        error: message
      })
      throw error instanceof Error ? error : new Error(message)
    }
  },

  updatePairModels: async (pairId, selection) => {
    set({ isLoading: true, error: null })

    try {
      const result = await window.api.pair.updateModels(pairId, selection)

      set((state) => ({
        isLoading: false,
        pairs: state.pairs.map((pair) =>
          pair.id === pairId
            ? {
                ...pair,
                mentorModel: result.mentorModel,
                executorModel: result.executorModel,
                pendingMentorModel: result.pendingMentorModel,
                pendingExecutorModel: result.pendingExecutorModel
              }
            : pair
        )
      }))
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update pair models'
      set({
        isLoading: false,
        error: message
      })
      throw error instanceof Error ? error : new Error(message)
    }
  },

  removePair: (id) => {
    window.api.pair.stop(id)
    set((state) => ({ pairs: state.pairs.filter((p) => p.id !== id) }))
  },

  retryTurn: async (id) => {
    await window.api.pair.retryTurn(id)
  },

  updatePairStatus: (id, status) =>
    set((state) => ({
      pairs: state.pairs.map((p) => (p.id === id ? { ...p, status } : p))
    })),

  updatePairUsage: (id, cpu, mem) =>
    set((state) => ({
      pairs: state.pairs.map((p) => (p.id === id ? { ...p, cpuUsage: cpu, memUsage: mem } : p))
    })),

  addMessage: (pairId, message) =>
    set((state) => ({
      pairs: state.pairs.map((p) =>
        p.id === pairId ? { ...p, messages: [...p.messages, message] } : p
      )
    })),

  setMessages: (pairId, messages) =>
    set((state) => ({
      pairs: state.pairs.map((p) => (p.id === pairId ? { ...p, messages } : p))
    })),

  syncState: (pairId, status, iteration) =>
    set((state) => ({
      pairs: state.pairs.map((p) => (p.id === pairId ? { ...p, status, iterations: iteration } : p))
    })),

  syncFullState: (pairId, state) =>
    set((s) => ({
      pairs: s.pairs.map((p) =>
        p.id === pairId ? syncPairFromState(p, state as PairStateSnapshot) : p
      )
    })),

  humanFeedback: async (pairId, approved) => {
    await window.api.pair.humanFeedback(pairId, approved)
  }
}))

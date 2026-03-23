import { create } from 'zustand'
import type { AvailableModel, CreatePairInput } from '../types'

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

    window.api.pair.onState((_state: any) => {
      set((state) => ({
        pairs: state.pairs.map((p) =>
          p.id === _state.pairId ? syncPairFromState(p, _state) : p
        )
      }))
    })
  },

  loadAvailableModels: async () => {
    try {
      const models = await window.api.config.getModels()
      set({ availableModels: models })
    } catch (error) {
      console.error('Failed to load models:', error)
    }
  },

  createPair: async (input) => {
    set({ isLoading: true, error: null })

    try {
      const pairProcess = await window.api.pair.create({
        name: input.name,
        directory: input.directory,
        spec: input.spec,
        mentor: { role: 'mentor', model: input.mentorModel },
        executor: { role: 'executor', model: input.executorModel }
      })

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
        mentorActivity: { phase: 'idle', label: 'Mentor idle', startedAt: Date.now(), updatedAt: Date.now() },
        executorActivity: { phase: 'idle', label: 'Executor idle', startedAt: Date.now(), updatedAt: Date.now() },
        mentorCpu: 0,
        mentorMemMb: 0,
        executorCpu: 0,
        executorMemMb: 0,
        modifiedFiles: [],
        gitTracking: { available: false },
        automationMode: 'full-auto',
        turn: 'mentor'
      }

      set((state) => ({
        pairs: [...state.pairs, newPair],
        isLoading: false
      }))
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to create pair'
      })
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
      pairs: s.pairs.map((p) => (p.id === pairId ? syncPairFromState(p, state) : p))
    })),

  humanFeedback: async (pairId, approved) => {
    await window.api.pair.humanFeedback(pairId, approved)
  }
}))

function syncPairFromState(pair: Pair, state: Record<string, unknown>): Pair {
  return {
    ...pair,
    status: (state.status as PairStatus) ?? pair.status,
    iterations: (state.iteration as number) ?? pair.iterations,
    turn: (state.turn as 'mentor' | 'executor') ?? pair.turn,
    mentorActivity: (state.mentorActivity as AgentActivity) ?? pair.mentorActivity,
    executorActivity: (state.executorActivity as AgentActivity) ?? pair.executorActivity,
    mentorCpu: (state.resources as { mentor: ResourceInfo })?.mentor?.cpu ?? pair.mentorCpu,
    mentorMemMb: (state.resources as { mentor: ResourceInfo })?.mentor?.memMb ?? pair.mentorMemMb,
    executorCpu: (state.resources as { executor: ResourceInfo })?.executor?.cpu ?? pair.executorCpu,
    executorMemMb: (state.resources as { executor: ResourceInfo })?.executor?.memMb ?? pair.executorMemMb,
    cpuUsage: (state.resources as { pairTotal: ResourceInfo })?.pairTotal?.cpu ?? pair.cpuUsage,
    memUsage: (state.resources as { pairTotal: ResourceInfo })?.pairTotal?.memMb ?? pair.memUsage,
    modifiedFiles: (state.modifiedFiles as ModifiedFile[]) ?? pair.modifiedFiles,
    gitTracking: (state.gitTracking as GitTracking) ?? pair.gitTracking,
    automationMode: (state.automationMode as AutomationMode) ?? pair.automationMode
  }
}

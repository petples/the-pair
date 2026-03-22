import type { ElectronAPI } from '@electron-toolkit/preload'

export type PairStatus =
  | 'Idle'
  | 'Mentoring'
  | 'Executing'
  | 'Reviewing'
  | 'Awaiting Human Review'
  | 'Error'
  | 'Finished'

export type AgentRole = 'mentor' | 'executor'

export interface AgentConfig {
  role: AgentRole
  model: string
}

export interface PairProcess {
  pairId: string
  mentorPid: number | null
  executorPid: number | null
  mentorStatus: PairStatus
  executorStatus: PairStatus
}

export interface CreatePairInput {
  name: string
  directory: string
  spec: string
  mentor: AgentConfig
  executor: AgentConfig
}

export interface AvailableModel {
  provider: string
  modelId: string
  displayName: string
}

interface Message {
  id: string
  timestamp: number
  from: 'mentor' | 'executor' | 'human'
  to: 'mentor' | 'executor' | 'both' | 'human'
  type: 'plan' | 'feedback' | 'progress' | 'result' | 'question' | 'handoff'
  content: string
  attachments?: { path: string; description: string }[]
  iteration: number
}

interface PairStateUpdate {
  pairId: string
  status: PairStatus
  iteration: number
  maxIterations: number
  turn: 'mentor' | 'executor'
  mentorStatus: PairStatus
  executorStatus: PairStatus
}

interface PairAPI {
  create: (input: CreatePairInput) => Promise<PairProcess>
  stop: (pairId: string) => Promise<{ success: boolean }>
  list: () => Promise<PairProcess[]>
  getMessages: (pairId: string) => Promise<Message[]>
  getState: (pairId: string) => Promise<PairStateUpdate | null>
  humanFeedback: (pairId: string, approved: boolean) => Promise<{ success: boolean }>
  onCreated: (callback: (pair: PairProcess) => void) => void
  onStopped: (callback: (data: { pairId: string }) => void) => void
  onMessage: (callback: (data: { pairId: string; message: Message }) => void) => void
  onState: (callback: (state: PairStateUpdate) => void) => void
}

interface ConfigAPI {
  getModels: () => Promise<AvailableModel[]>
  read: () => Promise<unknown>
  openFile: () => Promise<string>
}

interface API {
  pair: PairAPI
  config: ConfigAPI
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: API
  }
}

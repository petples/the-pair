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

export interface AssignTaskInput {
  spec: string
}

export interface PairModelSelection {
  mentorModel: string
  executorModel: string
  pendingMentorModel?: string
  pendingExecutorModel?: string
}

export interface AssignTaskResult extends PairModelSelection {
  spec: string
}

export interface AvailableModel {
  provider: string
  modelId: string
  displayName: string
  available: boolean
  providerLabel: string
  sourceProvider?: string
  sourceProviderLabel: string
  billingKind: 'plan' | 'payg' | 'byok' | 'unknown'
  billingLabel: string
  accessLabel: string
  planLabel?: string
  availabilityStatus: 'ready' | 'cli-missing' | 'auth-missing' | 'runtime-unsupported'
  availabilityReason?: string
  supportsPairExecution: boolean
  recommendedRoles: AgentRole[]
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
  assignTask: (pairId: string, input: AssignTaskInput) => Promise<AssignTaskResult>
  updateModels: (pairId: string, input: PairModelSelection) => Promise<PairModelSelection>
  stop: (pairId: string) => Promise<{ success: boolean }>
  retryTurn: (pairId: string) => Promise<{ success: boolean }>
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
  getProviders: () => Promise<unknown>
  read: () => Promise<unknown>
  openFile: () => Promise<string>
  getVersion: () => Promise<string>
}

export interface FileEntry {
  path: string
  type: 'file' | 'directory'
}

interface FileAPI {
  listFiles: (options: { pairId?: string; directory?: string }) => Promise<FileEntry[]>
  parseMentions: (pairId: string, spec: string) => Promise<string>
}

interface API {
  pair: PairAPI
  config: ConfigAPI
  file: FileAPI
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: API
  }
}

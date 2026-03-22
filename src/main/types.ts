export type PairStatus =
  | 'Idle'
  | 'Mentoring'
  | 'Executing'
  | 'Reviewing'
  | 'Awaiting Human Review'
  | 'Error'
  | 'Finished'

export type AgentRole = 'mentor' | 'executor'
export type MessageType = 'plan' | 'feedback' | 'progress' | 'result' | 'question' | 'handoff'
export type MessageSender = 'mentor' | 'executor' | 'human'

export interface MessageAttachment {
  path: string
  description: string
}

export interface Message {
  id: string
  timestamp: number
  from: MessageSender
  to: 'mentor' | 'executor' | 'both' | 'human'
  type: MessageType
  content: string
  attachments?: MessageAttachment[]
  iteration: number
}

export interface AgentState {
  status: PairStatus
  turn: 'mentor' | 'executor'
  lastMessage?: Message
}

export interface PairState {
  pairId: string
  directory: string
  status: PairStatus
  iteration: number
  maxIterations: number
  turn: 'mentor' | 'executor'
  mentor: AgentState
  executor: AgentState
  messages: Message[]
}

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

export interface OpenCodeConfig {
  provider?: Record<
    string,
    {
      options?: {
        apiKey?: string
        baseURL?: string
      }
      models?: Record<
        string,
        {
          name?: string
        }
      >
    }
  >
  model?: string
}

export interface AvailableModel {
  provider: string
  modelId: string
  displayName: string
}

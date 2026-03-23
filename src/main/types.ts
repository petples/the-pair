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

export type ActivityPhase = 'idle' | 'thinking' | 'using_tools' | 'responding' | 'waiting' | 'error'

export type ProviderKind = 'opencode' | 'codex' | 'claude' | 'gemini'

export type SubscriptionLabel = 
  | 'provider-backed'
  | 'authenticated'
  | 'subscription-backed'
  | 'chatgpt_plan_type'
  | string

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
  baseline?: string
  worktreePath?: string
  worktreeBranch?: string
  gitReviewAvailable?: boolean
}

export interface TurnArtifact {
  iteration: number
  instructionSummary: string
  preTurnHead: string
  postTurnHead: string
  commitSha?: string
  commitSubject?: string
  changedFiles: ModifiedFile[]
  statusShort: string
  diffStat: string
  patchExcerpt: string
  executorSummary: string
  verificationSummary: string
  noChanges?: boolean
  truncated?: boolean
}

export type AutomationMode = 'full-auto'

export interface MessageAttachment {
  path: string
  status: FileStatus
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
  activity: AgentActivity
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
  mentorActivity: AgentActivity
  executorActivity: AgentActivity
  resources: PairResources
  modifiedFiles: ModifiedFile[]
  gitTracking: GitTracking
  automationMode: AutomationMode
  turnArtifacts: TurnArtifact[]
  mentorRuntime?: PairRuntimeSpec
  executorRuntime?: PairRuntimeSpec
  gitReviewAvailable: boolean
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
  mentorActivity: AgentActivity
  executorActivity: AgentActivity
  resources: PairResources
  modifiedFiles: ModifiedFile[]
  gitTracking: GitTracking
  automationMode: AutomationMode
  turnArtifacts: TurnArtifact[]
  mentorRuntime?: PairRuntimeSpec
  executorRuntime?: PairRuntimeSpec
  gitReviewAvailable: boolean
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

export interface DetectedModelOption {
  modelId: string
  displayName: string
  subscriptionLabel: SubscriptionLabel
  supportsPairExecution: boolean
  runnable?: boolean
}

export interface DetectedProviderProfile {
  kind: ProviderKind
  installed: boolean
  authenticated: boolean
  runnable: boolean
  subscriptionLabel: SubscriptionLabel
  currentModels: DetectedModelOption[]
  detectedAt: number
}

export interface RuntimeSelection {
  providerKind: ProviderKind
  runtimeId: string
  modelId: string
  displayName: string
  subscriptionLabel: SubscriptionLabel
  launchSpecId: string
}

export type InputTransport = 'stdio' | 'json-events' | 'session-json'
export type OutputTransport = 'stdio' | 'json-events' | 'session-json'
export type SessionStrategy = 'new-first' | 'resume-existing'
export type PermissionStrategy = 'auto' | 'manual-confirm' | 'pre-approved'
export type CwdStrategy = 'worktree' | 'original-repo' | 'custom'

export interface ArgBuilder {
  (model: string, sessionId?: string, extraArgs?: string[]): string[]
}

export interface PairRuntimeSpec {
  executable: string
  argBuilder: ArgBuilder
  inputTransport: InputTransport
  outputTransport: OutputTransport
  sessionStrategy: SessionStrategy
  permissionStrategy: PermissionStrategy
  cwdStrategy: CwdStrategy
}

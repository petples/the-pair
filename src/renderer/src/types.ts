export type ProviderKind = 'opencode' | 'codex' | 'claude' | 'gemini'

export type TokenUsageSource = 'live' | 'final' | 'none'

export interface TurnTokenUsage {
  outputTokens: number
  inputTokens?: number
  lastUpdatedAt: number
  source: TokenUsageSource
  provider?: string
}

export type PairStatus =
  | 'Idle'
  | 'Mentoring'
  | 'Executing'
  | 'Reviewing'
  | 'Paused'
  | 'Awaiting Human Review'
  | 'Error'
  | 'Finished'

export interface AvailableModel {
  provider: ProviderKind
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
  recommendedRoles: ('mentor' | 'executor')[]
  reasoningEffortLevels?: string[]
}

export interface CreatePairInput {
  name: string
  directory: string
  spec: string
  mentor: { role: 'mentor' | 'executor'; provider: ProviderKind; model: string }
  executor: { role: 'mentor' | 'executor'; provider: ProviderKind; model: string }
  mentorReasoningEffort?: string
  executorReasoningEffort?: string
  branch?: string
}

export interface AssignTaskInput {
  spec: string
}

export interface PairModelSelection {
  mentorModel: string
  executorModel: string
  pendingMentorModel?: string
  pendingExecutorModel?: string
  mentorReasoningEffort?: string
  executorReasoningEffort?: string
}

export interface AgentActivity {
  phase: 'idle' | 'thinking' | 'using_tools' | 'responding' | 'waiting' | 'error'
  label: string
  detail?: string
  startedAt: number
  updatedAt: number
}

export interface SnapshotTurnCard {
  id: string
  role: 'mentor' | 'executor'
  state: 'live' | 'final'
  content: string
  activity: AgentActivity
  startedAt: number
  updatedAt: number
  tokenUsage?: TurnTokenUsage
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
  messages: Array<{
    id: string
    timestamp: number
    from: 'mentor' | 'executor' | 'human'
    to: 'mentor' | 'executor' | 'both' | 'human'
    type: 'plan' | 'feedback' | 'progress' | 'result' | 'question' | 'handoff'
    content: string
    attachments?: { path: string; description: string }[]
    iteration: number
    tokenUsage?: TurnTokenUsage
  }>
  totalOutputTokens?: number
}

export interface SessionSnapshotDraft {
  pairId: string
  name: string
  directory: string
  spec: string
  status: PairStatus
  iterations: number
  maxIterations: number
  turn: 'mentor' | 'executor'
  mentorProvider?: ProviderKind
  mentorModel: string
  executorProvider?: ProviderKind
  executorModel: string
  pendingMentorModel?: string
  pendingExecutorModel?: string
  mentorReasoningEffort?: string
  executorReasoningEffort?: string
  messages: Array<{
    id: string
    timestamp: number
    from: 'mentor' | 'executor' | 'human'
    to: 'mentor' | 'executor' | 'both' | 'human'
    type: 'plan' | 'feedback' | 'progress' | 'result' | 'question' | 'handoff'
    content: string
    attachments?: { path: string; description: string }[]
    iteration: number
    tokenUsage?: TurnTokenUsage
  }>
  mentorActivity: AgentActivity
  executorActivity: AgentActivity
  mentorCpu: number
  mentorMemMb: number
  executorCpu: number
  executorMemMb: number
  cpuUsage: number
  memUsage: number
  modifiedFiles: Array<{ path: string; status: 'A' | 'M' | 'D' | 'R' | '??'; displayPath: string }>
  gitTracking: {
    available: boolean
    rootPath?: string
    baseline?: string
    gitReviewAvailable?: boolean
  }
  automationMode: 'full-auto'
  currentTurnCard?: SnapshotTurnCard
  runCount: number
  runHistory: PairRunSummary[]
  currentRunStartedAt: number
  currentRunFinishedAt?: number
  createdAt: number
  branch?: string
  repoPath?: string
  worktreePath?: string
}

export interface RecoverableSessionSummary {
  pairId: string
  name: string
  directory: string
  spec: string
  status: PairStatus
  turn: 'mentor' | 'executor'
  mentorModel: string
  executorModel: string
  pendingMentorModel?: string
  pendingExecutorModel?: string
  mentorReasoningEffort?: string
  executorReasoningEffort?: string
  runCount: number
  currentRunStartedAt: number
  currentRunFinishedAt?: number
  savedAt: number
  createdAt: number
  currentTurnCard?: SnapshotTurnCard
  hasMentorSession: boolean
  hasExecutorSession: boolean
}

export interface SessionSnapshotRecord extends SessionSnapshotDraft {
  snapshotVersion: number
  savedAt: number
  providerSessions: {
    mentorSessionId?: string
    executorSessionId?: string
  }
}

export interface BranchInfo {
  name: string
  isLocal: boolean
  isRemote: boolean
  lastCommitSha?: string
  lastCommitMessage?: string
  lastCommitDate?: number
  isCheckedOutLocally: boolean
}

export interface RepoState {
  isGitRepo: boolean
  isDirty: boolean
  currentBranch?: string
  branches: BranchInfo[]
}

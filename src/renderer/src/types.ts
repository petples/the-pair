export type PairStatus =
  | 'Idle'
  | 'Mentoring'
  | 'Executing'
  | 'Reviewing'
  | 'Awaiting Human Review'
  | 'Error'
  | 'Finished'

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
  recommendedRoles: ('mentor' | 'executor')[]
}

export interface CreatePairInput {
  name: string
  directory: string
  spec: string
  mentor: { role: 'mentor' | 'executor'; model: string }
  executor: { role: 'mentor' | 'executor'; model: string }
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

export interface OpenCodeConfig {
  provider?: Record<
    string,
    {
      options?: { apiKey?: string; baseURL?: string }
      models?: Record<string, { name?: string }>
    }
  >
  model?: string
}

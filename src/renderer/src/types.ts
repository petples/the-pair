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
}

export interface CreatePairInput {
  name: string
  directory: string
  spec: string
  mentor: { role: 'mentor' | 'executor'; model: string }
  executor: { role: 'mentor' | 'executor'; model: string }
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

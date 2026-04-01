import type { TurnTokenUsage } from '../types'

export interface TokenUsageTurnCard {
  id: string
  role: 'mentor' | 'executor'
  state: 'live' | 'final'
  content: string
  activity: {
    phase: string
    label: string
    detail?: string
    startedAt: number
    updatedAt: number
  }
  startedAt: number
  updatedAt: number
  finalizedAt?: number
  tokenUsage?: TurnTokenUsage
}

export interface TokenUsageMessage {
  id: string
  timestamp: number
  from: 'mentor' | 'executor' | 'human'
  to: string
  type: string
  content: string
  iteration: number
  tokenUsage?: TurnTokenUsage
}

function extractJsonCandidates(raw: string): string[] {
  const trimmed = raw.trim()
  const candidates = new Set<string>()

  if (trimmed) {
    candidates.add(trimmed)
  }

  for (let i = 0; i < trimmed.length; i += 1) {
    if (trimmed[i] !== '{') continue
    let depth = 0
    let inString = false
    let escaped = false

    for (let j = i; j < trimmed.length; j += 1) {
      const char = trimmed[j]

      if (inString) {
        if (escaped) {
          escaped = false
          continue
        }
        if (char === '\\') {
          escaped = true
          continue
        }
        if (char === '"') {
          inString = false
        }
        continue
      }

      if (char === '"') {
        inString = true
        continue
      }
      if (char === '{') {
        depth += 1
      } else if (char === '}') {
        depth -= 1
        if (depth === 0) {
          candidates.add(trimmed.slice(i, j + 1).trim())
          break
        }
      }
    }
  }

  return [...candidates]
}

function isAcceptanceVerdictContent(raw: string): boolean {
  for (const candidate of extractJsonCandidates(raw)) {
    try {
      const parsed = JSON.parse(candidate) as Record<string, unknown>
      const nextStep =
        parsed.nextStep && typeof parsed.nextStep === 'object'
          ? (parsed.nextStep as Record<string, unknown>)
          : null

      if (
        (parsed.verdict === 'pass' || parsed.verdict === 'fail') &&
        (parsed.risk === 'low' || parsed.risk === 'medium' || parsed.risk === 'high') &&
        Array.isArray(parsed.evidence) &&
        typeof parsed.summary === 'string' &&
        nextStep &&
        (nextStep.action === 'continue' || nextStep.action === 'finish') &&
        Array.isArray(nextStep.instructions)
      ) {
        return true
      }
    } catch {
      // ignore invalid candidates
    }
  }

  return false
}

export function turnCardToMessage(card: TokenUsageTurnCard): TokenUsageMessage {
  const type =
    card.role === 'mentor'
      ? isAcceptanceVerdictContent(card.content)
        ? 'acceptance'
        : 'plan'
      : 'result'

  return {
    id: card.id,
    timestamp: card.updatedAt,
    from: card.role,
    to: 'human',
    type,
    content: card.content,
    iteration: 0,
    tokenUsage: card.tokenUsage
  }
}

export function mergeTokenUsage(
  nextUsage: TurnTokenUsage | undefined,
  existingUsage: TurnTokenUsage | undefined
): TurnTokenUsage | undefined {
  return nextUsage ?? existingUsage
}

export function syncTokenUsage(
  backendValue: TurnTokenUsage | null | undefined,
  existingValue: TurnTokenUsage | undefined
): TurnTokenUsage | undefined {
  if (backendValue === null) {
    return undefined
  }
  if (backendValue !== undefined) {
    return backendValue
  }
  return existingValue
}

export function resolveCurrentTurnTokenUsage(
  backendValue: TurnTokenUsage | null | undefined,
  currentValue: TurnTokenUsage | undefined,
  fallbackValue: TurnTokenUsage | undefined
): TurnTokenUsage | undefined {
  if (backendValue === null) {
    return undefined
  }
  if (backendValue !== undefined) {
    return backendValue
  }
  return currentValue ?? fallbackValue
}

export function areTokenUsagesEqual(
  first: TurnTokenUsage | undefined,
  second: TurnTokenUsage | undefined
): boolean {
  if (first === second) return true
  if (!first || !second) return false

  return (
    first.outputTokens === second.outputTokens &&
    first.inputTokens === second.inputTokens &&
    first.lastUpdatedAt === second.lastUpdatedAt &&
    first.source === second.source &&
    first.provider === second.provider
  )
}

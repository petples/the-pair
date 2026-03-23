import type {
  AgentRole,
  AvailableModel,
  DetectedModelOption,
  DetectedProviderProfile,
  ProviderKind
} from './types'

type AvailabilityStatus = AvailableModel['availabilityStatus']
type BillingKind = AvailableModel['billingKind']

const PROVIDER_LABELS: Record<ProviderKind, string> = {
  opencode: 'OpenCode',
  codex: 'Codex',
  claude: 'Claude Code',
  gemini: 'Gemini CLI'
}

const SOURCE_PROVIDER_LABELS: Record<string, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  google: 'Google',
  openrouter: 'OpenRouter',
  groq: 'Groq',
  mistral: 'Mistral'
}

function capitalizeWord(word: string): string {
  if (!word) return word
  return word[0].toUpperCase() + word.slice(1)
}

function formatWords(value: string): string {
  return value
    .split(/[-_/\s]+/)
    .filter(Boolean)
    .map((word) => capitalizeWord(word))
    .join(' ')
}

function getSourceProviderLabel(sourceProvider: string | undefined, kind: ProviderKind): string {
  if (sourceProvider) {
    return SOURCE_PROVIDER_LABELS[sourceProvider] ?? formatWords(sourceProvider)
  }

  if (kind === 'codex') return 'OpenAI'
  if (kind === 'claude') return 'Anthropic'
  if (kind === 'gemini') return 'Google'
  return 'Configured Provider'
}

function getRecommendedRoles(modelId: string): AgentRole[] {
  const normalized = modelId.toLowerCase()

  if (normalized.includes('mini') || normalized.includes('flash') || normalized.includes('haiku')) {
    return ['executor']
  }

  if (
    normalized.includes('pro') ||
    normalized.includes('sonnet') ||
    normalized.includes('opus') ||
    normalized.includes('o1')
  ) {
    return ['mentor']
  }

  return ['mentor', 'executor']
}

function getAvailability(
  profile: DetectedProviderProfile,
  model: DetectedModelOption
): { status: AvailabilityStatus; reason?: string; available: boolean } {
  const providerLabel = PROVIDER_LABELS[profile.kind]

  if (!profile.installed) {
    return {
      status: 'cli-missing',
      reason: `${providerLabel} CLI is not installed`,
      available: false
    }
  }

  if (!profile.authenticated) {
    return {
      status: 'auth-missing',
      reason: `${providerLabel} is not signed in`,
      available: false
    }
  }

  if (!profile.runnable || !model.runnable || !model.supportsPairExecution) {
    return {
      status: 'runtime-unsupported',
      reason: `${providerLabel} is detected, but pair execution is not yet supported`,
      available: false
    }
  }

  return {
    status: 'ready',
    available: true
  }
}

function getPlanLabel(profile: DetectedProviderProfile): string | undefined {
  const normalized = String(profile.subscriptionLabel || '')
    .trim()
    .toLowerCase()

  if (!normalized || normalized === 'authenticated' || normalized === 'provider-backed') {
    return undefined
  }

  if (
    profile.kind === 'codex' &&
    ['free', 'plus', 'pro', 'team', 'enterprise'].includes(normalized)
  ) {
    return `ChatGPT ${formatWords(normalized)}`
  }

  if (normalized === 'subscription-backed') {
    if (profile.kind === 'claude') return 'Claude subscription'
    if (profile.kind === 'gemini') return 'Google AI plan'
    if (profile.kind === 'codex') return 'ChatGPT account'
  }

  return formatWords(normalized)
}

function getBilling(
  profile: DetectedProviderProfile,
  sourceProviderLabel: string
): { kind: BillingKind; label: string; accessLabel: string; planLabel?: string } {
  const planLabel = getPlanLabel(profile)

  if (profile.kind === 'opencode') {
    return {
      kind: 'byok',
      label: 'Pay as you go',
      accessLabel: `${sourceProviderLabel} API key`,
      planLabel: 'BYOK'
    }
  }

  if (profile.kind === 'codex') {
    if (planLabel) {
      return {
        kind: 'plan',
        label: 'Included with plan',
        accessLabel: 'ChatGPT plan',
        planLabel
      }
    }

    if (profile.authenticated) {
      return {
        kind: 'plan',
        label: 'Included with account',
        accessLabel: 'Codex login'
      }
    }
  }

  if (profile.kind === 'claude') {
    return {
      kind: 'plan',
      label: planLabel ? 'Included with plan' : 'Requires account access',
      accessLabel: 'Claude Code login',
      planLabel
    }
  }

  if (profile.kind === 'gemini') {
    return {
      kind: 'plan',
      label: planLabel ? 'Included with plan' : 'Requires Google account',
      accessLabel: 'Google account',
      planLabel
    }
  }

  return {
    kind: 'unknown',
    label: 'Unknown billing',
    accessLabel: sourceProviderLabel
  }
}

export function buildModelCatalog(profiles: DetectedProviderProfile[]): AvailableModel[] {
  return profiles
    .flatMap((profile) => {
      const providerLabel = PROVIDER_LABELS[profile.kind]

      return profile.currentModels.map((model) => {
        const sourceProviderLabel = getSourceProviderLabel(model.sourceProvider, profile.kind)
        const availability = getAvailability(profile, model)
        const billing = getBilling(profile, sourceProviderLabel)

        return {
          provider: profile.kind,
          modelId: model.modelId,
          displayName: model.displayName,
          available: availability.available,
          providerLabel,
          sourceProvider: model.sourceProvider,
          sourceProviderLabel,
          billingKind: billing.kind,
          billingLabel: billing.label,
          accessLabel: billing.accessLabel,
          planLabel: billing.planLabel,
          availabilityStatus: availability.status,
          availabilityReason: availability.reason,
          supportsPairExecution: model.supportsPairExecution,
          recommendedRoles: getRecommendedRoles(model.modelId)
        } satisfies AvailableModel
      })
    })
    .sort((left, right) => {
      if (left.available !== right.available) {
        return left.available ? -1 : 1
      }

      if (left.providerLabel !== right.providerLabel) {
        return left.providerLabel.localeCompare(right.providerLabel)
      }

      return left.displayName.localeCompare(right.displayName)
    })
}

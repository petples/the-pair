import type { PairPreset } from '../types'

export const HARDCODED_PRESETS: PairPreset[] = [
  {
    id: 'bug-fix',
    name: 'Bug Fix',
    description:
      'Quickly investigate and fix a specific bug. Auto-pauses at iteration 5 for review.',
    icon: 'Bug',
    mentorPromptTemplate:
      'You are a meticulous bug investigator. Your role is to:\n1. Analyze the reported issue\n2. Identify root cause\n3. Propose a fix\n\nTASK:\n{task}\n\nBe systematic. Check edge cases. Verify your fix before presenting it.',
    executorPromptTemplate:
      'You are a precise bug fixer. Execute the fix as specified by the mentor.',
    defaultMaxIterations: 8,
    recommendedSkills: [],
    pauseOnIteration: 5
  },
  {
    id: 'refactor',
    name: 'Refactor',
    description: 'Safely improve code structure. Creates git baseline for rollback.',
    icon: 'RefreshCw',
    mentorPromptTemplate:
      'You are a refactoring mentor. Guide safe, incremental improvements:\n1. Understand current structure\n2. Identify improvement opportunities\n3. Propose small, safe changes\n\nTASK:\n{task}\n\nPrioritize clarity and maintainability. Never break existing behavior.',
    executorPromptTemplate: 'Execute refactoring changes as guided. Run tests after each change.',
    defaultMaxIterations: 15,
    recommendedSkills: [],
    pauseOnIteration: 8,
    autoAttachGitBaseline: true
  },
  {
    id: 'feature',
    name: 'Feature',
    description: 'Build new functionality end-to-end with planning and review.',
    icon: 'Sparkles',
    mentorPromptTemplate:
      'You are a feature planning mentor. Help break down and build:\n1. Understand requirements thoroughly\n2. Plan the implementation approach\n3. Review each step\n\nTASK:\n{task}\n\nThink big picture but execute incrementally.',
    executorPromptTemplate:
      'Implement features as planned. Ask for clarification if requirements are unclear.',
    defaultMaxIterations: 25,
    recommendedSkills: [],
    pauseOnIteration: 15
  },
  {
    id: 'hardening',
    name: 'Hardening',
    description: 'Improve error handling, security, and robustness.',
    icon: 'Shield',
    mentorPromptTemplate:
      'You are a hardening specialist. Improve code quality:\n1. Identify potential failure points\n2. Suggest defensive improvements\n3. Verify error handling\n\nTASK:\n{task}\n\nBe thorough. No bug is too small to fix.',
    executorPromptTemplate: 'Implement hardening improvements. Add tests for edge cases.',
    defaultMaxIterations: 12,
    recommendedSkills: [],
    pauseOnIteration: 8
  }
]

export interface PairConfigOverrides {
  mentorPromptTemplate?: string
  executorPromptTemplate?: string
  maxIterations?: number
  recommendedSkills?: string[]
  recommendedMentorModel?: string
  recommendedExecutorModel?: string
  pauseOnIteration?: number
  autoAttachGitBaseline?: boolean
}

export function applyPresetToPairConfig(
  preset: PairPreset,
  userOverrides: Partial<PairConfigOverrides> = {}
): PairConfigOverrides {
  return {
    mentorPromptTemplate: preset.mentorPromptTemplate,
    executorPromptTemplate: preset.executorPromptTemplate,
    maxIterations: Math.max(1, preset.defaultMaxIterations),
    recommendedSkills: [...preset.recommendedSkills],
    recommendedMentorModel: preset.recommendedMentorModel,
    recommendedExecutorModel: preset.recommendedExecutorModel,
    pauseOnIteration: preset.pauseOnIteration,
    autoAttachGitBaseline: preset.autoAttachGitBaseline,
    ...userOverrides
  }
}

export function mergePresetWithCustomizations(
  preset: PairPreset,
  customizations: PairConfigOverrides
): PairConfigOverrides {
  const merged = applyPresetToPairConfig(preset)

  for (const [key, value] of Object.entries(customizations)) {
    if (value !== undefined && value !== null && value !== '') {
      ;(merged as Record<string, unknown>)[key] = value
    }
  }

  return merged
}

export function buildSpecFromPreset(preset: PairPreset, userTask: string): string {
  const template = preset.mentorPromptTemplate
  if (!template.includes('{task}')) {
    throw new Error('Preset template is missing required {task} placeholder')
  }
  const taskText = userTask?.trim() || 'Describe what you want the pair to accomplish...'
  return template.replace('{task}', taskText)
}

export function stripTemplate(spec: string): string {
  const match = spec.match(/TASK:\s*([\s\S]*)$/)
  return match ? match[1].trim() : spec
}

export function formatPresetForDisplay(preset: PairPreset): string {
  const parts: string[] = [preset.name]

  if (preset.recommendedSkills.length > 0) {
    parts.push(`${preset.recommendedSkills.length} skills`)
  }

  parts.push(`${preset.defaultMaxIterations} iterations max`)

  if (preset.pauseOnIteration) {
    parts.push(`pause at ${preset.pauseOnIteration}`)
  }

  if (preset.autoAttachGitBaseline) {
    parts.push('git baseline')
  }

  return parts.join(' • ')
}

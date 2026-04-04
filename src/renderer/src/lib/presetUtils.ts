import type { PairPreset } from '../types'

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

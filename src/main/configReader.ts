import { app } from 'electron'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import type { OpenCodeConfig, AvailableModel } from './types'

const OPENCODE_CONFIG_PATH = join(app.getPath('home'), '.config/opencode/opencode.json')

export function readOpenCodeConfig(): OpenCodeConfig | null {
  try {
    if (!existsSync(OPENCODE_CONFIG_PATH)) {
      return null
    }
    const content = readFileSync(OPENCODE_CONFIG_PATH, 'utf-8')
    return JSON.parse(content)
  } catch (error) {
    console.error('Failed to read opencode config:', error)
    return null
  }
}

export function getAvailableModels(config: OpenCodeConfig | null): AvailableModel[] {
  const models: AvailableModel[] = []

  if (!config?.provider) {
    return models
  }

  for (const [providerId, providerConfig] of Object.entries(config.provider)) {
    if (providerConfig.models) {
      for (const [modelId, modelConfig] of Object.entries(providerConfig.models)) {
        models.push({
          provider: providerId,
          modelId: modelId,
          displayName: modelConfig.name || `${providerId}/${modelId}`
        })
      }
    }
  }

  return models
}

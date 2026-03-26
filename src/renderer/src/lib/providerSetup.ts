import type { AvailableModel } from '../types'

function isSelectableForPairExecution(model: AvailableModel): boolean {
  return model.available && model.supportsPairExecution
}

export interface ProviderSetupSummary {
  readyModelCount: number
  readyProviderLabels: string[]
  isReady: boolean
}

export function buildProviderSetupSummary(models: AvailableModel[]): ProviderSetupSummary {
  const readyModels = models.filter(isSelectableForPairExecution)
  const readyProviderLabels = Array.from(
    new Set(readyModels.map((model) => model.providerLabel))
  ).sort()

  return {
    readyModelCount: readyModels.length,
    readyProviderLabels,
    isReady: readyModels.length > 0
  }
}

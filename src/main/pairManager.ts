import { BrowserWindow } from 'electron'
import { processSpawner } from './processSpawner'
import { messageBroker } from './messageBroker'
import { providerRegistry } from './providerRegistry'
import type { CreatePairInput, PairProcess, AvailableModel, OpenCodeConfig } from './types'
import type { AgentTurnResult } from './agentTurn'

class PairManager {
  private pairs: Map<string, PairProcess & { directory: string }> = new Map()

  async createPair(input: CreatePairInput): Promise<PairProcess> {
    const pairId = this.generateId()

    providerRegistry.detectAll()

    const defaultMentorRuntime = providerRegistry.getRuntimeSpec('opencode', input.mentor.model)
    const defaultExecutorRuntime = providerRegistry.getRuntimeSpec('opencode', input.executor.model)

    const mentorRuntime = defaultMentorRuntime || providerRegistry.getRuntimeSpec('opencode', 'claude-3-5-sonnet')!
    const executorRuntime = defaultExecutorRuntime || providerRegistry.getRuntimeSpec('opencode', 'claude-3-5-sonnet')!

    messageBroker.initializePair(pairId, input)
    messageBroker.startWatching(pairId)

    const pairProcess = await processSpawner.spawnPair(
      pairId,
      input.mentor.model,
      input.executor.model,
      input.directory,
      input.spec,
      mentorRuntime,
      executorRuntime
    )

    this.pairs.set(pairId, { ...pairProcess, directory: input.directory })
    this.notifyRenderer('pair:created', pairProcess)

    return pairProcess
  }

  stopPair(pairId: string): void {
    processSpawner.killPair(pairId)
    messageBroker.stopPair(pairId)
    this.cleanupPairDir(pairId)
    this.pairs.delete(pairId)
    this.notifyRenderer('pair:stopped', { pairId })
  }

  retryTurn(pairId: string): void {
    messageBroker.retryTurn(pairId)
  }

  private cleanupPairDir(pairId: string): void {
    const pair = this.pairs.get(pairId)
    if (!pair) return
    try {
      const { rmSync } = require('fs')
      const pairDir = require('path').join(pair.directory, '.pair')
      if (require('fs').existsSync(pairDir)) {
        rmSync(pairDir, { recursive: true, force: true })
      }
    } catch {
      /* ignore cleanup errors */
    }
  }

  getPair(pairId: string): (PairProcess & { directory: string }) | undefined {
    return this.pairs.get(pairId)
  }

  getAllPairs(): PairProcess[] {
    return Array.from(this.pairs.values()).map(({ directory: _dir, ...proc }) => proc)
  }

  getAvailableModels(): AvailableModel[] {
    const models: AvailableModel[] = []
    const profiles = providerRegistry.getRunnableProviders()
    for (const profile of profiles) {
      for (const model of profile.currentModels) {
        models.push({
          provider: profile.kind,
          modelId: model.modelId,
          displayName: model.displayName
        })
      }
    }
    return models
  }

  getProviderProfiles() {
    return providerRegistry.getRunnableProviders()
  }

  readOpenCodeConfig(): OpenCodeConfig | null {
    return null
  }

  humanFeedback(pairId: string, approved: boolean): void {
    messageBroker.humanFeedback(pairId, approved)
  }

  handleAgentResponse(pairId: string, role: 'mentor' | 'executor', result: AgentTurnResult): void {
    messageBroker.handleAgentResponse(pairId, role, result)
  }

  getMessages(pairId: string) {
    return messageBroker.getMessages(pairId)
  }

  private notifyRenderer(channel: string, data: unknown): void {
    BrowserWindow.getAllWindows().forEach((win) => {
      win.webContents.send(channel, data)
    })
  }

  private generateId(): string {
    return Math.random().toString(36).substring(2, 9)
  }
}

export const pairManager = new PairManager()

processSpawner.setResponseHandler((pairId, role, result) => {
  pairManager.handleAgentResponse(pairId, role, result)
})

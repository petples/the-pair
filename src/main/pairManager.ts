import { BrowserWindow } from 'electron'
import { existsSync, rmSync } from 'fs'
import { join } from 'path'
import { processSpawner } from './processSpawner'
import { messageBroker } from './messageBroker'
import { providerRegistry } from './providerRegistry'
import { buildModelCatalog } from './modelCatalog'
import { isPairBusy } from './pairTaskState'
import { readOpenCodeConfig } from './configReader'
import type {
  AssignTaskInput,
  AssignTaskResult,
  CreatePairInput,
  PairModelSelection,
  PairProcess,
  AvailableModel,
  DetectedProviderProfile,
  Message,
  OpenCodeConfig,
  PairRuntimeSpec,
  ProviderKind,
  UpdatePairModelsInput
} from './types'
import type { AgentTurnResult } from './agentTurn'

interface ManagedPair extends PairProcess {
  directory: string
  name: string
  spec: string
  mentorModel: string
  executorModel: string
  pendingMentorModel?: string
  pendingExecutorModel?: string
}

class PairManager {
  private pairs: Map<string, ManagedPair> = new Map()

  private parseProviderModel(qualifiedModel: string): { provider: ProviderKind; model: string } {
    const KNOWN_PROVIDERS: ProviderKind[] = ['opencode', 'codex', 'claude', 'gemini']
    const parts = qualifiedModel.split('/')
    if (parts.length === 2 && KNOWN_PROVIDERS.includes(parts[0] as ProviderKind)) {
      return { provider: parts[0] as ProviderKind, model: parts[1] }
    }
    // Custom opencode provider (e.g. bailian-coding-plan/glm-5) — pass full model string to opencode
    return { provider: 'opencode', model: qualifiedModel }
  }

  async createPair(input: CreatePairInput): Promise<PairProcess> {
    const pairId = this.generateId()

    providerRegistry.detectAll()

    const mentorParsed = this.parseProviderModel(input.mentor.model)
    const executorParsed = this.parseProviderModel(input.executor.model)

    const mentorRuntime = providerRegistry.getRuntimeSpec(mentorParsed.provider, mentorParsed.model)
    const executorRuntime = providerRegistry.getRuntimeSpec(
      executorParsed.provider,
      executorParsed.model
    )

    if (!mentorRuntime || !executorRuntime) {
      throw new Error(
        `Could not get runtime spec for models: ${input.mentor.model}, ${input.executor.model}`
      )
    }

    await messageBroker.initializePair(pairId, input)
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

    this.pairs.set(pairId, {
      ...pairProcess,
      directory: input.directory,
      name: input.name,
      spec: input.spec,
      mentorModel: input.mentor.model,
      executorModel: input.executor.model
    })
    this.notifyRenderer('pair:created', pairProcess)

    return pairProcess
  }

  async stopPair(pairId: string): Promise<void> {
    processSpawner.killPair(pairId)
    await messageBroker.stopPair(pairId)
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
      const pairDir = join(pair.directory, '.pair')
      if (existsSync(pairDir)) {
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
    return Array.from(this.pairs.values()).map((pair) => {
      const { directory, ...proc } = pair
      void directory
      return proc
    })
  }

  getAvailableModels(): AvailableModel[] {
    return buildModelCatalog(providerRegistry.getProfiles())
  }

  getProviderProfiles(): DetectedProviderProfile[] {
    return providerRegistry.getProfiles()
  }

  readOpenCodeConfig(): OpenCodeConfig | null {
    return readOpenCodeConfig()
  }

  humanFeedback(pairId: string, approved: boolean): void {
    messageBroker.humanFeedback(pairId, approved)
  }

  async assignTask(pairId: string, input: AssignTaskInput): Promise<AssignTaskResult> {
    const pair = this.pairs.get(pairId)
    if (!pair) {
      throw new Error(`Unknown pair: ${pairId}`)
    }

    const state = messageBroker.getState(pairId)
    if (!state) {
      throw new Error(`Missing state for pair: ${pairId}`)
    }

    if (isPairBusy(state.status)) {
      throw new Error('Wait for the current task to finish before assigning a new one')
    }

    const mentorModel = pair.pendingMentorModel ?? pair.mentorModel
    const executorModel = pair.pendingExecutorModel ?? pair.executorModel
    const runtimeSelection = this.resolveRuntimeSelection(mentorModel, executorModel)

    processSpawner.updatePairRuntime(pairId, {
      mentorModel: runtimeSelection.mentorQualifiedModel,
      executorModel: runtimeSelection.executorQualifiedModel,
      mentorRuntime: runtimeSelection.mentorRuntime,
      executorRuntime: runtimeSelection.executorRuntime,
      resetSessions: true
    })

    pair.mentorModel = mentorModel
    pair.executorModel = executorModel
    pair.pendingMentorModel = undefined
    pair.pendingExecutorModel = undefined
    pair.spec = input.spec

    await messageBroker.assignTask(pairId, { name: pair.name, spec: input.spec })
    messageBroker.startWatching(pairId)

    return {
      spec: input.spec,
      mentorModel: pair.mentorModel,
      executorModel: pair.executorModel
    }
  }

  updatePairModels(pairId: string, input: UpdatePairModelsInput): PairModelSelection {
    const pair = this.pairs.get(pairId)
    if (!pair) {
      throw new Error(`Unknown pair: ${pairId}`)
    }

    const state = messageBroker.getState(pairId)
    if (!state) {
      throw new Error(`Missing state for pair: ${pairId}`)
    }

    if (isPairBusy(state.status)) {
      pair.pendingMentorModel = input.mentorModel
      pair.pendingExecutorModel = input.executorModel

      return {
        mentorModel: pair.mentorModel,
        executorModel: pair.executorModel,
        pendingMentorModel: pair.pendingMentorModel,
        pendingExecutorModel: pair.pendingExecutorModel
      }
    }

    const runtimeSelection = this.resolveRuntimeSelection(input.mentorModel, input.executorModel)
    processSpawner.updatePairRuntime(pairId, {
      mentorModel: runtimeSelection.mentorQualifiedModel,
      executorModel: runtimeSelection.executorQualifiedModel,
      mentorRuntime: runtimeSelection.mentorRuntime,
      executorRuntime: runtimeSelection.executorRuntime,
      resetSessions: true
    })

    pair.mentorModel = input.mentorModel
    pair.executorModel = input.executorModel
    pair.pendingMentorModel = undefined
    pair.pendingExecutorModel = undefined

    return {
      mentorModel: pair.mentorModel,
      executorModel: pair.executorModel
    }
  }

  async handleAgentResponse(
    pairId: string,
    role: 'mentor' | 'executor',
    result: AgentTurnResult
  ): Promise<void> {
    await messageBroker.handleAgentResponse(pairId, role, result)
  }

  getMessages(pairId: string): Message[] {
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

  private resolveRuntimeSelection(
    mentorQualifiedModel: string,
    executorQualifiedModel: string
  ): {
    mentorQualifiedModel: string
    executorQualifiedModel: string
    mentorRuntime: PairRuntimeSpec
    executorRuntime: PairRuntimeSpec
  } {
    providerRegistry.detectAll()

    const mentor = this.parseProviderModel(mentorQualifiedModel)
    const executor = this.parseProviderModel(executorQualifiedModel)
    const mentorRuntime = providerRegistry.getRuntimeSpec(mentor.provider, mentor.model)
    const executorRuntime = providerRegistry.getRuntimeSpec(executor.provider, executor.model)

    if (!mentorRuntime || !executorRuntime) {
      throw new Error(
        `Could not get runtime spec for models: ${mentorQualifiedModel}, ${executorQualifiedModel}`
      )
    }

    return {
      mentorQualifiedModel,
      executorQualifiedModel,
      mentorRuntime,
      executorRuntime
    }
  }
}

export const pairManager = new PairManager()

processSpawner.setResponseHandler((pairId, role, result) => {
  pairManager.handleAgentResponse(pairId, role, result)
})

import { execSync } from 'child_process'
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import * as os from 'os'
import type {
  ProviderKind,
  DetectedProviderProfile,
  DetectedModelOption,
  SubscriptionLabel,
  PairRuntimeSpec,
  ArgBuilder
} from './types'

function homedir(): string {
  return os.homedir()
}

export interface ProviderAdapter {
  kind: ProviderKind
  detect(): DetectedProviderProfile
  getRuntimeSpec(modelId: string): PairRuntimeSpec
}

const CODING_MODEL_CATALOG: Record<ProviderKind, string[]> = {
  opencode: ['claude-3-5-sonnet', 'claude-3-5-haiku', 'gpt-4o', 'gpt-4o-mini', 'o1-preview', 'o1-mini'],
  codex: ['gpt-4o', 'gpt-4o-mini', 'claude-3-5-sonnet'],
  claude: ['claude-3-5-sonnet', 'claude-3-5-haiku', 'claude-3-opus'],
  gemini: ['gemini-2-5-flash', 'gemini-2-5-pro', 'gemini-1-5-pro']
}

function whichBinary(name: string): string | null {
  try {
    const result = execSync(`which ${name}`, { encoding: 'utf-8' }).trim()
    return result || null
  } catch {
    return null
  }
}

function safeReadJson(filePath: string): object | null {
  try {
    if (!existsSync(filePath)) return null
    const content = readFileSync(filePath, 'utf-8')
    return JSON.parse(content)
  } catch {
    return null
  }
}

class OpenCodeAdapter implements ProviderAdapter {
  kind: ProviderKind = 'opencode'

  detect(): DetectedProviderProfile {
    const binaryPath = whichBinary('opencode')
    const installed = binaryPath !== null

    const configPaths = [
      join(homedir(), '.config/opencode/opencode.json'),
      join(homedir(), '.local/state/opencode/model.json')
    ]

    let authenticated = false
    let models: DetectedModelOption[] = []
    let subscriptionLabel: SubscriptionLabel = 'provider-backed'

    for (const configPath of configPaths) {
      const config = safeReadJson(configPath)
      if (config && typeof config === 'object') {
        authenticated = true
        const cfg = config as Record<string, unknown>

        if (cfg.provider && typeof cfg.provider === 'object') {
          const providers = cfg.provider as Record<string, unknown>
          for (const [providerId, providerData] of Object.entries(providers)) {
            if (providerData && typeof providerData === 'object') {
              const pdata = providerData as Record<string, unknown>
              if (pdata.models && typeof pdata.models === 'object') {
                const modelList = pdata.models as Record<string, unknown>
                for (const [modelId, modelConfig] of Object.entries(modelList)) {
                  if (modelConfig && typeof modelConfig === 'object') {
                    const mcfg = modelConfig as Record<string, unknown>
                    models.push({
                      modelId,
                      displayName: (mcfg.name as string) || `${providerId}/${modelId}`,
                      subscriptionLabel: 'provider-backed',
                      supportsPairExecution: true,
                      runnable: true
                    })
                  }
                }
              }
            }
          }
        }

        if (models.length === 0) {
          models = CODING_MODEL_CATALOG.opencode.map(id => ({
            modelId: id,
            displayName: id,
            subscriptionLabel: 'provider-backed',
            supportsPairExecution: true,
            runnable: true
          }))
        }
        break
      }
    }

    if (!authenticated) {
      models = CODING_MODEL_CATALOG.opencode.map(id => ({
        modelId: id,
        displayName: id,
        subscriptionLabel: 'provider-backed',
        supportsPairExecution: true,
        runnable: installed
      }))
    }

    return {
      kind: this.kind,
      installed,
      authenticated,
      runnable: installed,
      subscriptionLabel,
      currentModels: models,
      detectedAt: Date.now()
    }
  }

  getRuntimeSpec(_modelId: string): PairRuntimeSpec {
    const argBuilder: ArgBuilder = (model: string, sessionId?: string) => {
      const args = ['run', '--model', model]
      if (sessionId) {
        args.push('--session', sessionId)
      }
      args.push('--format', 'json')
      return args
    }

    return {
      executable: 'opencode',
      argBuilder,
      inputTransport: 'json-events',
      outputTransport: 'json-events',
      sessionStrategy: 'new-first',
      permissionStrategy: 'auto',
      cwdStrategy: 'worktree'
    }
  }
}

class CodexAdapter implements ProviderAdapter {
  kind: ProviderKind = 'codex'

  detect(): DetectedProviderProfile {
    const binaryPath = whichBinary('codex')
    const installed = binaryPath !== null

    const authPath = join(homedir(), '.codex/auth.json')
    const configPath = join(homedir(), '.codex/config.toml')

    let authenticated = false
    let subscriptionLabel: SubscriptionLabel = 'provider-backed'
    let models: DetectedModelOption[] = []

    const auth = safeReadJson(authPath)
    if (auth && typeof auth === 'object') {
      authenticated = true
      const authObj = auth as Record<string, unknown>

      if (authObj.chatgpt_plan_type) {
        subscriptionLabel = String(authObj.chatgpt_plan_type)
      } else if (authObj.token) {
        subscriptionLabel = 'subscription-backed'
      }
    }

    if (!authenticated) {
      const config = safeReadJson(configPath)
      if (config && typeof config === 'object') {
        authenticated = true
        subscriptionLabel = 'subscription-backed'
      }
    }

    if (authenticated && models.length === 0) {
      models = CODING_MODEL_CATALOG.codex.map(id => ({
        modelId: id,
        displayName: id,
        subscriptionLabel,
        supportsPairExecution: true,
        runnable: installed
      }))
    }

    if (!authenticated || models.length === 0) {
      models = CODING_MODEL_CATALOG.codex.map(id => ({
        modelId: id,
        displayName: id,
        subscriptionLabel: 'provider-backed',
        supportsPairExecution: true,
        runnable: installed
      }))
    }

    return {
      kind: this.kind,
      installed,
      authenticated,
      runnable: installed,
      subscriptionLabel,
      currentModels: models,
      detectedAt: Date.now()
    }
  }

  getRuntimeSpec(_modelId: string): PairRuntimeSpec {
    const argBuilder: ArgBuilder = (model: string, sessionId?: string) => {
      const args = ['exec', '--model', model, '--json']
      if (sessionId) {
        args.push('resume', sessionId)
      }
      return args
    }

    return {
      executable: 'codex',
      argBuilder,
      inputTransport: 'session-json',
      outputTransport: 'session-json',
      sessionStrategy: 'resume-existing',
      permissionStrategy: 'auto',
      cwdStrategy: 'worktree'
    }
  }
}

class ClaudeCodeAdapter implements ProviderAdapter {
  kind: ProviderKind = 'claude'

  detect(): DetectedProviderProfile {
    const binaryPath = whichBinary('claude')
    const installed = binaryPath !== null

    let authenticated = false
    let subscriptionLabel: SubscriptionLabel = 'provider-backed'
    let models: DetectedModelOption[] = []

    if (installed) {
      try {
        execSync('claude --version', { encoding: 'utf-8' })
        authenticated = true
      } catch {
        authenticated = false
      }
    }

    if (authenticated) {
      subscriptionLabel = 'subscription-backed'
      models = CODING_MODEL_CATALOG.claude.map(id => ({
        modelId: id,
        displayName: id,
        subscriptionLabel,
        supportsPairExecution: true,
        runnable: installed
      }))
    }

    if (!authenticated || models.length === 0) {
      models = CODING_MODEL_CATALOG.claude.map(id => ({
        modelId: id,
        displayName: id,
        subscriptionLabel: authenticated ? 'subscription-backed' : 'provider-backed',
        supportsPairExecution: true,
        runnable: installed
      }))
    }

    if (!authenticated) {
      subscriptionLabel = 'authenticated'
    }

    return {
      kind: this.kind,
      installed,
      authenticated,
      runnable: installed,
      subscriptionLabel,
      currentModels: models,
      detectedAt: Date.now()
    }
  }

  getRuntimeSpec(_modelId: string): PairRuntimeSpec {
    const argBuilder: ArgBuilder = (model: string, sessionId?: string) => {
      const args = ['-p', '--model', model, '--output-format', 'stream-json']
      if (sessionId) {
        args.push('--session-id', sessionId)
      }
      return args
    }

    return {
      executable: 'claude',
      argBuilder,
      inputTransport: 'stdio',
      outputTransport: 'json-events',
      sessionStrategy: 'resume-existing',
      permissionStrategy: 'pre-approved',
      cwdStrategy: 'worktree'
    }
  }
}

class GeminiAdapter implements ProviderAdapter {
  kind: ProviderKind = 'gemini'

  detect(): DetectedProviderProfile {
    const binaryPath = whichBinary('gemini')
    const installed = binaryPath !== null

    const settingsPath = join(homedir(), '.gemini/settings.json')
    const accountsPath = join(homedir(), '.gemini/google_accounts.json')

    let authenticated = false
    let subscriptionLabel: SubscriptionLabel = 'provider-backed'
    let models: DetectedModelOption[] = []

    const settings = safeReadJson(settingsPath)
    if (settings && typeof settings === 'object') {
      authenticated = true
      subscriptionLabel = 'authenticated'
    }

    const accounts = safeReadJson(accountsPath)
    if (accounts && typeof accounts === 'object') {
      authenticated = true
      const accountsObj = accounts as Record<string, unknown>
      if (Array.isArray(accountsObj.accounts) && accountsObj.accounts.length > 0) {
        subscriptionLabel = 'subscription-backed'
      }
    }

    models = CODING_MODEL_CATALOG.gemini.map(id => ({
      modelId: id,
      displayName: id,
      subscriptionLabel,
      supportsPairExecution: authenticated,
      runnable: false
    }))

    return {
      kind: this.kind,
      installed,
      authenticated,
      runnable: false,
      subscriptionLabel,
      currentModels: models,
      detectedAt: Date.now()
    }
  }

  getRuntimeSpec(modelId: string): PairRuntimeSpec {
    const argBuilder: ArgBuilder = (_model: string, _sessionId?: string) => {
      return ['--model', modelId]
    }

    return {
      executable: 'gemini',
      argBuilder,
      inputTransport: 'stdio',
      outputTransport: 'stdio',
      sessionStrategy: 'new-first',
      permissionStrategy: 'manual-confirm',
      cwdStrategy: 'worktree'
    }
  }
}

class ProviderRegistry {
  private adapters: Map<ProviderKind, ProviderAdapter> = new Map()
  private profiles: Map<ProviderKind, DetectedProviderProfile> = new Map()
  private detected = false

  constructor() {
    this.registerAdapter(new OpenCodeAdapter())
    this.registerAdapter(new CodexAdapter())
    this.registerAdapter(new ClaudeCodeAdapter())
    this.registerAdapter(new GeminiAdapter())
  }

  private registerAdapter(adapter: ProviderAdapter): void {
    this.adapters.set(adapter.kind, adapter)
  }

  detectAll(): Map<ProviderKind, DetectedProviderProfile> {
    if (this.detected) {
      return this.profiles
    }

    for (const [kind, adapter] of this.adapters) {
      const profile = adapter.detect()
      this.profiles.set(kind, profile)
    }

    this.detected = true
    return this.profiles
  }

  getProfile(kind: ProviderKind): DetectedProviderProfile | null {
    if (!this.detected) {
      this.detectAll()
    }
    return this.profiles.get(kind) || null
  }

  getRunnableProviders(): DetectedProviderProfile[] {
    if (!this.detected) {
      this.detectAll()
    }

    return Array.from(this.profiles.values()).filter(
      p => p.installed && p.authenticated && p.runnable
    )
  }

  getAllModels(): DetectedModelOption[] {
    if (!this.detected) {
      this.detectAll()
    }

    const allModels: DetectedModelOption[] = []
    for (const profile of this.profiles.values()) {
      if (profile.installed && profile.authenticated && profile.runnable) {
        allModels.push(...profile.currentModels)
      }
    }
    return allModels
  }

  getRuntimeSpec(kind: ProviderKind, modelId: string): PairRuntimeSpec | null {
    const adapter = this.adapters.get(kind)
    if (!adapter) return null
    return adapter.getRuntimeSpec(modelId)
  }
}

export const providerRegistry = new ProviderRegistry()

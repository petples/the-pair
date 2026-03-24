import React, { useState, useEffect } from 'react'
import { open } from '@tauri-apps/plugin-dialog'
import {
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  FolderOpen,
  ExternalLink,
  Zap,
  Brain,
  Rocket,
  Sparkles,
  Sun,
  Moon
} from 'lucide-react'
import { cn } from '../lib/utils'
import { usePairStore } from '../store/usePairStore'
import { useThemeStore } from '../store/useThemeStore'
import type { AvailableModel, OpenCodeConfig } from '../types'
import { GlassButton } from './ui/GlassButton'
import { GlassCard } from './ui/GlassCard'
import { ModelPicker } from './ModelPicker'
import { getPreferredQualifiedModel } from '../lib/modelPreferences'

interface OnboardingWizardProps {
  onComplete: () => void
}

const STEPS = [
  { id: 'setup', label: 'Setup' },
  { id: 'models', label: 'Models' },
  { id: 'review', label: 'Review & Launch' }
]

export function OnboardingWizard({ onComplete }: OnboardingWizardProps): React.ReactNode {
  const [currentStep, setCurrentStep] = useState(0)
  const [appVersion, setAppVersion] = useState<string>('1.0.1')

  useEffect(() => {
    window.api?.config?.getVersion?.().then((v: string) => {
      setAppVersion(v && v !== '0.0.0' ? v : '1.0.1')
    })
  }, [])
  const [configLoading, setConfigLoading] = useState(true)
  const [configStatus, setConfigStatus] = useState<
    'checking' | 'ok' | 'missing-keys' | 'missing-file'
  >('checking')
  const [directory, setDirectory] = useState('')
  const [name, setName] = useState('')
  const [spec, setSpec] = useState('')
  const [mentorModel, setMentorModel] = useState('')
  const [executorModel, setExecutorModel] = useState('')
  const [isOpeningFile, setIsOpeningFile] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { availableModels, loadAvailableModels, createPair } = usePairStore()
  const { theme, toggleTheme } = useThemeStore()

  useEffect(() => {
    loadAvailableModels()
  }, [loadAvailableModels])

  useEffect(() => {
    if (currentStep === 0) {
      loadConfig()
    }
  }, [currentStep])

  useEffect(() => {
    if (availableModels.length > 0 && mentorModel === '') {
      setMentorModel(getPreferredQualifiedModel('mentor', availableModels))
      setExecutorModel(getPreferredQualifiedModel('executor', availableModels))
    }
  }, [availableModels, mentorModel])

  const loadConfig = async (): Promise<void> => {
    setConfigLoading(true)
    try {
      const raw = (await window.api.config.read()) as OpenCodeConfig | null
      if (!raw) {
        setConfigStatus('missing-file')
      } else {
        const hasProviders = raw.provider && Object.keys(raw.provider).length > 0
        const hasKeys = hasProviders && Object.values(raw.provider!).some((p) => p.options?.apiKey)
        const hasModels =
          hasProviders &&
          Object.values(raw.provider!).some((p) => p.models && Object.keys(p.models).length > 0)
        if (hasKeys && hasModels) {
          setConfigStatus('ok')
        } else {
          setConfigStatus('missing-keys')
        }
      }
    } catch {
      setConfigStatus('missing-file')
    } finally {
      setConfigLoading(false)
    }
  }

  const handleOpenConfig = async (): Promise<void> => {
    setIsOpeningFile(true)
    try {
      await window.api.config.openFile()
    } finally {
      setIsOpeningFile(false)
    }
  }

  const handleSelectDirectory = async (): Promise<void> => {
    console.log('[OnboardingWizard] Choosing directory...');
    try {
      const selected = await open({
        directory: true,
        multiple: false,
      })
      console.log('[OnboardingWizard] Result:', selected);
      if (selected) {
        setDirectory(selected)
      }
    } catch (err) {
      console.error('[OnboardingWizard] Error choosing directory:', err);
    }
  }

  const handleLaunch = async (): Promise<void> => {
    if (!name.trim() || !directory.trim() || !spec.trim()) return
    setError(null)
    setIsCreating(true)
    try {
      await createPair({
        name: name.trim(),
        directory,
        spec: spec.trim(),
        mentorModel,
        executorModel
      })
      onComplete()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create pair')
      setIsCreating(false)
    }
  }

  const canNext = (): boolean => {
    switch (currentStep) {
      case 0:
        return (
          configStatus === 'ok' &&
          directory.trim().length > 0 &&
          name.trim().length > 0 &&
          spec.trim().length > 0
        )
      case 1:
        return mentorModel.length > 0 && executorModel.length > 0
      default:
        return true
    }
  }

  const renderStep = (): React.ReactNode => {
    switch (currentStep) {
      case 0:
        return (
          <SetupStep
            status={configStatus}
            loading={configLoading}
            onOpenConfig={handleOpenConfig}
            isOpening={isOpeningFile}
            directory={directory}
            onSelectDirectory={handleSelectDirectory}
            name={name}
            spec={spec}
            onNameChange={setName}
            onSpecChange={setSpec}
          />
        )
      case 1:
        return (
          <ModelStep
            availableModels={availableModels}
            mentorModel={mentorModel}
            executorModel={executorModel}
            onMentorChange={setMentorModel}
            onExecutorChange={setExecutorModel}
          />
        )
      case 2:
        return (
          <ReviewStep
            name={name}
            spec={spec}
            directory={directory}
            mentorModel={mentorModel}
            executorModel={executorModel}
            error={error}
          />
        )
      default:
        return null
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background grain-overlay">
      <div className="glass-toolbar app-drag shrink-0 px-6 py-4">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-muted border border-border flex items-center justify-center">
                <Sparkles size={15} className="text-foreground/70" />
              </div>
              <span className="font-semibold text-sm text-foreground tracking-tight">The Pair</span>
              <span className="rounded bg-blue-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                v{appVersion}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[10px] text-muted-foreground font-mono uppercase tracking-widest">
                Setup Wizard
              </span>
              <button
                onClick={toggleTheme}
                className="app-no-drag p-2 rounded-lg hover:bg-muted/50 transition-colors text-muted-foreground hover:text-foreground"
                title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
              >
                {theme === 'light' ? <Moon size={15} /> : <Sun size={15} />}
              </button>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {STEPS.map((step, idx) => (
              <React.Fragment key={step.id}>
                <div className="flex items-center gap-2">
                  <div
                    className={cn(
                      'w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-medium transition-all',
                      idx < currentStep
                        ? 'bg-green-500/20 text-green-700 dark:text-green-400 border border-green-500/30'
                        : idx === currentStep
                          ? 'bg-primary text-primary-foreground border border-primary'
                          : 'bg-muted text-muted-foreground border border-border'
                    )}
                  >
                    {idx < currentStep ? <CheckCircle2 size={12} /> : idx + 1}
                  </div>
                  <span
                    className={cn(
                      'text-[10px] hidden sm:block',
                      idx === currentStep ? 'text-foreground font-medium' : 'text-muted-foreground'
                    )}
                  >
                    {step.label}
                  </span>
                </div>
                {idx < STEPS.length - 1 && (
                  <div
                    className={cn(
                      'flex-1 h-px min-w-3 max-w-10',
                      idx < currentStep ? 'bg-green-500/30' : 'bg-border'
                    )}
                  />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-6 py-5">{renderStep()}</div>
      </div>

      <div className="glass-toolbar shrink-0 px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <GlassButton
            variant="ghost"
            size="sm"
            onClick={() => setCurrentStep((s) => Math.max(0, s - 1))}
            disabled={currentStep === 0}
            icon={<ChevronLeft size={14} />}
          >
            Back
          </GlassButton>

          {currentStep < STEPS.length - 1 ? (
            <GlassButton
              variant="primary"
              size="sm"
              onClick={() => setCurrentStep((s) => Math.min(STEPS.length - 1, s + 1))}
              disabled={!canNext()}
              icon={<ChevronRight size={14} />}
              className={cn(!canNext() ? 'opacity-30' : '')}
            >
              Next
            </GlassButton>
          ) : (
            <GlassButton
              variant="approve"
              size="sm"
              onClick={handleLaunch}
              disabled={!canNext() || isCreating}
              icon={<Rocket size={14} />}
              className={cn(!canNext() || isCreating ? 'opacity-30' : '')}
            >
              {isCreating ? 'Launching...' : 'Launch Pair'}
            </GlassButton>
          )}
        </div>
      </div>
    </div>
  )
}

function SetupStep({
  status,
  loading,
  onOpenConfig,
  isOpening,
  directory,
  onSelectDirectory,
  name,
  spec,
  onNameChange,
  onSpecChange
}: {
  status: 'checking' | 'ok' | 'missing-keys' | 'missing-file'
  loading: boolean
  onOpenConfig: () => void
  isOpening: boolean
  directory: string
  onSelectDirectory: () => void
  name: string
  spec: string
  onNameChange: (v: string) => void
  onSpecChange: (v: string) => void
}): React.ReactNode {
  return (
    <div className="space-y-6 py-1">
      <div className="text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-muted to-muted/50 border border-border flex items-center justify-center mx-auto">
          <Sparkles size={28} className="text-foreground/60" />
        </div>
        <h1 className="text-4xl font-bold tracking-tight text-foreground">
          Welcome to <span className="text-foreground/70">The Pair</span>
        </h1>
        <p className="text-muted-foreground text-base max-w-md mx-auto leading-relaxed">
          Set up the workspace once, then let the Mentor plan and the Executor build. We keep the
          first pass short so you can launch faster.
        </p>
      </div>

      <ConfigStep
        status={status}
        loading={loading}
        onOpenConfig={onOpenConfig}
        isOpening={isOpening}
      />

      <DirectoryStep directory={directory} onSelectDirectory={onSelectDirectory} />

      <GlassCard className="p-5 space-y-4">
        <div>
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest">
            Task
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Give this pair a name and one clear task. Model selection comes next.
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-foreground">Pair Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              placeholder="e.g., Add user authentication"
              className="w-full rounded-xl glass-card px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-foreground">
              Task Specification
            </label>
            <textarea
              value={spec}
              onChange={(e) => onSpecChange(e.target.value)}
              placeholder="Describe the desired outcome as directly as possible..."
              rows={5}
              className="w-full resize-none rounded-xl glass-card px-3.5 py-2.5 text-sm leading-relaxed text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <p className="mt-1.5 text-xs text-muted-foreground">
              {spec.length} characters · a concrete target works better than a vague intention
            </p>
          </div>
        </div>
      </GlassCard>
    </div>
  )
}

function ConfigStep({
  status,
  loading,
  onOpenConfig,
  isOpening
}: {
  status: 'checking' | 'ok' | 'missing-keys' | 'missing-file'
  loading: boolean
  onOpenConfig: () => void
  isOpening: boolean
}): React.ReactNode {
  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold tracking-tight text-foreground">
          OpenCode Configuration
        </h2>
        <p className="text-muted-foreground">
          The Pair uses your existing OpenCode setup to authenticate and select AI models.
        </p>
      </div>

      <GlassCard className="p-6">
        <div className="flex items-start gap-4">
          <div
            className={cn(
              'w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border',
              status === 'ok'
                ? 'bg-green-500/10 dark:bg-green-500/20 border-green-500/20'
                : status === 'checking'
                  ? 'bg-muted border-border'
                  : 'bg-amber-500/10 dark:bg-amber-500/20 border-amber-500/20'
            )}
          >
            {loading ? (
              <div className="w-4 h-4 border border-muted-foreground/20 border-t-muted-foreground rounded-full animate-spin" />
            ) : status === 'ok' ? (
              <CheckCircle2 size={20} className="text-green-600 dark:text-green-400" />
            ) : (
              <ExternalLink size={20} className="text-amber-600 dark:text-amber-400" />
            )}
          </div>
          <div className="flex-1">
            <h3 className="font-semibold mb-1 text-foreground">
              {loading
                ? 'Checking configuration...'
                : status === 'ok'
                  ? 'Configuration looks great!'
                  : status === 'missing-file'
                    ? 'Config file not found'
                    : 'API keys or models missing'}
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {status === 'ok' &&
                'Your OpenCode config is properly set up with providers and models.'}
              {status === 'missing-file' && (
                <>
                  <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono border border-border">
                    ~/.config/opencode/opencode.json
                  </code>{' '}
                  was not found. Create it with your provider settings.
                </>
              )}
              {status === 'missing-keys' && (
                <>
                  Config exists but is missing API keys or model definitions. Add at least one
                  provider with an{' '}
                  <code className="text-xs bg-muted px-1 py-0.5 rounded font-mono border border-border">
                    apiKey
                  </code>{' '}
                  and one model.
                </>
              )}
            </p>

            {status !== 'ok' && !loading && (
              <div className="mt-4 space-y-3">
                <p className="text-xs text-muted-foreground">
                  Your config file should look something like this:
                </p>
                <pre className="bg-muted/50 dark:bg-muted text-green-700 dark:text-green-400/80 text-xs rounded-lg p-4 font-mono overflow-x-auto border border-border">
                  {`{
  "provider": {
    "openai": {
      "options": { "apiKey": "sk-..." },
      "models": {
        "gpt-4o": { "name": "GPT-4o" },
        "gpt-4o-mini": { "name": "GPT-4o Mini" }
      }
    }
  }
}`}
                </pre>
              </div>
            )}
          </div>
        </div>
      </GlassCard>

      {status !== 'ok' && !loading && (
        <GlassButton
          variant="secondary"
          onClick={onOpenConfig}
          disabled={isOpening}
          className="w-full"
        >
          <ExternalLink size={15} />
          {isOpening
            ? 'Opening...'
            : status === 'missing-file'
              ? 'Create & Open Config File'
              : 'Open Config File in Editor'}
        </GlassButton>
      )}

      {status === 'ok' && (
        <p className="text-center text-sm text-green-700 dark:text-green-400 flex items-center justify-center gap-2">
          <CheckCircle2 size={15} />
          Config is ready — you can proceed to the next step.
        </p>
      )}

      {status !== 'ok' && !loading && (
        <p className="text-center text-xs text-muted-foreground">
          After saving, click &ldquo;Next&rdquo; to re-check. The wizard will verify your config
          automatically.
        </p>
      )}
    </div>
  )
}

function DirectoryStep({
  directory,
  onSelectDirectory
}: {
  directory: string
  onSelectDirectory: () => void
}): React.ReactNode {
  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold tracking-tight text-foreground">Choose a Project</h2>
        <p className="text-muted-foreground">
          Select the codebase or project folder that The Pair will work in.
        </p>
      </div>

      <GlassButton
        variant="secondary"
        onClick={onSelectDirectory}
        className="w-full h-auto py-10 flex flex-col items-center gap-4"
      >
        <div className="w-14 h-14 rounded-2xl bg-muted border border-border flex items-center justify-center">
          <FolderOpen size={26} className="text-foreground/40" />
        </div>
        <div className="text-center space-y-1">
          <p className="font-medium text-sm text-foreground">
            {directory ? 'Change project directory' : 'Click to select a folder'}
          </p>
          {directory && (
            <p className="text-xs text-muted-foreground font-mono bg-muted px-3 py-1.5 rounded-lg inline-block mt-2">
              {directory}
            </p>
          )}
          {!directory && (
            <p className="text-sm text-muted-foreground">
              Choose any folder — The Pair will read, analyze, and modify files there.
            </p>
          )}
        </div>
      </GlassButton>
    </div>
  )
}

function ModelStep({
  availableModels,
  mentorModel,
  executorModel,
  onMentorChange,
  onExecutorChange
}: {
  availableModels: AvailableModel[]
  mentorModel: string
  executorModel: string
  onMentorChange: (m: string) => void
  onExecutorChange: (m: string) => void
}): React.ReactNode {
  const [showAdvanced, setShowAdvanced] = useState(false)

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold tracking-tight text-foreground">Select Your Models</h2>
        <p className="text-muted-foreground">
          The recommended defaults are already filled in. Expand the selector only if you want to
          change them.
        </p>
      </div>

      <GlassCard className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest">
              Recommended setup
            </p>
            <p className="mt-1 text-sm text-foreground/80">
              Mentor and Executor are prefilled from your detected models.
            </p>
          </div>
          <GlassButton
            variant="ghost"
            size="sm"
            onClick={() => setShowAdvanced((s) => !s)}
            icon={showAdvanced ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
          >
            {showAdvanced ? 'Hide advanced' : 'Customize'}
          </GlassButton>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-blue-500/15 bg-blue-500/5 p-3">
            <div className="mb-1 flex items-center gap-2">
              <Brain size={14} className="text-blue-600 dark:text-blue-400" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                Mentor
              </span>
            </div>
            <p className="truncate font-mono text-xs text-foreground">{mentorModel}</p>
          </div>
          <div className="rounded-2xl border border-purple-500/15 bg-purple-500/5 p-3">
            <div className="mb-1 flex items-center gap-2">
              <Zap size={14} className="text-purple-600 dark:text-purple-400" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
                Executor
              </span>
            </div>
            <p className="truncate font-mono text-xs text-foreground">{executorModel}</p>
          </div>
        </div>
      </GlassCard>

      {showAdvanced && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <GlassCard className="space-y-3 p-5">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-blue-500/20 bg-blue-500/10">
                <Brain size={15} className="text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">Mentor</h3>
                <p className="text-xs text-muted-foreground">Analyzes & plans</p>
              </div>
            </div>
            <ModelPicker
              value={mentorModel}
              models={availableModels}
              onChange={onMentorChange}
              role="mentor"
            />
          </GlassCard>

          <GlassCard className="space-y-3 p-5">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-purple-500/20 bg-purple-500/10">
                <Zap size={15} className="text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">Executor</h3>
                <p className="text-xs text-muted-foreground">Writes & executes</p>
              </div>
            </div>
            <ModelPicker
              value={executorModel}
              models={availableModels}
              onChange={onExecutorChange}
              role="executor"
            />
          </GlassCard>
        </div>
      )}

      <GlassCard className="p-4 space-y-2">
        <p className="text-xs font-medium text-muted-foreground mb-1">Model recommendations:</p>
        <p className="text-xs text-muted-foreground">
          <span className="text-blue-600 dark:text-blue-400">Mentor</span> — Benefits from larger,
          reasoning-capable models (e.g., GPT-4o, Claude 3.5 Sonnet)
        </p>
        <p className="text-xs text-muted-foreground">
          <span className="text-purple-600 dark:text-purple-400">Executor</span> — Can use a
          smaller/faster model for code writing tasks (e.g., GPT-4o-mini)
        </p>
        <p className="text-xs text-muted-foreground">
          Greyed-out entries stay visible so you can see which providers are detected, which ones
          are paid via plan or token, and what still needs auth or runtime support.
        </p>
      </GlassCard>
    </div>
  )
}

function ReviewStep({
  name,
  spec,
  directory,
  mentorModel,
  executorModel,
  error
}: {
  name: string
  spec: string
  directory: string
  mentorModel: string
  executorModel: string
  error: string | null
}): React.ReactNode {
  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold tracking-tight text-foreground">Review & Launch</h2>
        <p className="text-muted-foreground">
          One last check before starting the pair.
        </p>
      </div>

      <GlassCard className="p-4 space-y-2">
        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest">
          Summary
        </p>
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
          <span className="text-muted-foreground">Pair Name</span>
          <span className="font-mono text-foreground truncate" title={name}>
            {name}
          </span>
          <span className="text-muted-foreground">Project</span>
          <span className="font-mono text-foreground truncate" title={directory}>
            {directory.split('/').pop()}
          </span>
          <span className="text-muted-foreground">Task</span>
          <span className="font-mono text-foreground truncate" title={spec}>
            {spec}
          </span>
          <span className="text-blue-600 dark:text-blue-400">Mentor</span>
          <span className="font-mono text-foreground">{mentorModel}</span>
          <span className="text-purple-600 dark:text-purple-400">Executor</span>
          <span className="font-mono text-foreground">{executorModel}</span>
        </div>
      </GlassCard>

      {error && (
        <div className="text-sm text-destructive glass-card p-3 rounded-xl border border-destructive/20">
          {error}
        </div>
      )}
    </div>
  )
}

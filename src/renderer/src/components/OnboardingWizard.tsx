import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { open } from '@tauri-apps/plugin-dialog'
import {
  CheckCircle2,
  FolderOpen,
  ExternalLink,
  Zap,
  Brain,
  Rocket,
  Sun,
  Moon,
  AlertCircle,
  RefreshCw
} from 'lucide-react'
import { cn } from '../lib/utils'
import { usePairStore } from '../store/usePairStore'
import { useThemeStore } from '../store/useThemeStore'
import type { AvailableModel } from '../types'
import { GlassButton } from './ui/GlassButton'
import { GlassCard } from './ui/GlassCard'
import { ModelPicker } from './ModelPicker'
import { FileMention } from './FileMention'
import { SkillPicker } from './SkillPicker'
import { getPreferredPairModelSelection } from '../lib/modelPreferences'
import { derivePairNameFromDirectory } from '../lib/workspace'
import { shouldUseCompactOnboardingLayout } from '../lib/onboardingLayout'
import { buildProviderSetupSummary } from '../lib/providerSetup'
import type { ProviderSetupSummary } from '../lib/providerSetup'
import appIcon from '../assets/app-icon.png'

interface OnboardingWizardProps {
  onComplete: () => void
}

export function OnboardingWizard({ onComplete }: OnboardingWizardProps): React.ReactNode {
  const [appVersion, setAppVersion] = useState<string>('1.0.1')
  const [isCheckingProviders, setIsCheckingProviders] = useState(true)
  const [directory, setDirectory] = useState('')
  const [name, setName] = useState('')
  const [spec, setSpec] = useState('')
  const [mentorModel, setMentorModel] = useState('')
  const [executorModel, setExecutorModel] = useState('')
  const [isOpeningFile, setIsOpeningFile] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fileContexts, setFileContexts] = useState<Map<string, string>>(new Map())
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [viewportHeight, setViewportHeight] = useState(() =>
    typeof window === 'undefined' ? 900 : window.innerHeight
  )
  const isCompactLayout = shouldUseCompactOnboardingLayout(viewportHeight)

  useEffect(() => {
    window.api?.config?.getVersion?.().then((v: string) => {
      setAppVersion(v && v !== '0.0.0' ? v : '1.0.1')
    })
  }, [])

  useEffect(() => {
    const updateViewportHeight = (): void => {
      setViewportHeight(window.innerHeight)
    }

    updateViewportHeight()
    window.addEventListener('resize', updateViewportHeight)
    return () => window.removeEventListener('resize', updateViewportHeight)
  }, [])

  const handleFileSelect = useCallback((path: string, content: string): void => {
    setFileContexts((prev) => {
      const next = new Map(prev)
      next.set(path, content)
      return next
    })
  }, [])

  const handleSkillSelect = useCallback((skillName: string) => {
    const insertion = `Load the ${skillName} skill and `
    setSpec((prev) => {
      if (textareaRef.current) {
        const start = textareaRef.current.selectionStart
        return prev.slice(0, start) + insertion + prev.slice(start)
      }
      return insertion + prev
    })
  }, [])

  const { availableModels, loadAvailableModels, createPair } = usePairStore()
  const { theme, toggleTheme } = useThemeStore()
  const providerSummary = useMemo(
    () => buildProviderSetupSummary(availableModels),
    [availableModels]
  )

  useEffect(() => {
    let cancelled = false
    setIsCheckingProviders(true)
    void (async () => {
      await loadAvailableModels()
      if (!cancelled) {
        setIsCheckingProviders(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [loadAvailableModels])

  useEffect(() => {
    if (availableModels.length > 0 && mentorModel === '' && executorModel === '') {
      const defaults = getPreferredPairModelSelection(availableModels)
      setMentorModel(defaults.mentorModel)
      setExecutorModel(defaults.executorModel)
    }
  }, [availableModels, executorModel, mentorModel])

  const handleOpenConfig = async (): Promise<void> => {
    setIsOpeningFile(true)
    try {
      await window.api.config.openFile()
    } finally {
      setIsOpeningFile(false)
    }
  }

  const handleSelectDirectory = async (): Promise<void> => {
    console.log('[OnboardingWizard] Choosing directory...')
    try {
      const selected = await open({
        directory: true,
        multiple: false
      })
      console.log('[OnboardingWizard] Result:', selected)
      if (selected) {
        setDirectory(selected)
        setName((currentName) =>
          currentName.trim().length > 0 ? currentName : derivePairNameFromDirectory(selected)
        )
      }
    } catch (err) {
      console.error('[OnboardingWizard] Error choosing directory:', err)
    }
  }

  const handleRefreshProviders = async (): Promise<void> => {
    setIsCheckingProviders(true)
    try {
      await loadAvailableModels()
    } finally {
      setIsCheckingProviders(false)
    }
  }

  const handleLaunch = async (): Promise<void> => {
    if (!name.trim() || !directory.trim() || !spec.trim()) return
    setError(null)
    setIsCreating(true)
    try {
      let finalSpec = spec.trim()
      if (fileContexts.size > 0) {
        const contextHeader =
          '--- REFERENCED FILES ---\n' +
          Array.from(fileContexts.entries())
            .map(([path, content]) => `@${path}:\n${content}`)
            .join('\n\n') +
          '\n\n--- TASK ---\n'
        finalSpec = contextHeader + finalSpec
      }
      await createPair({
        name: name.trim(),
        directory,
        spec: finalSpec,
        mentorModel,
        executorModel
      })
      onComplete()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create pair')
      setIsCreating(false)
    }
  }

  const canLaunch = useMemo(() => {
    return (
      providerSummary.isReady &&
      directory.trim().length > 0 &&
      name.trim().length > 0 &&
      spec.trim().length > 0 &&
      mentorModel.length > 0 &&
      executorModel.length > 0
    )
  }, [providerSummary.isReady, directory, name, spec, mentorModel, executorModel])

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background grain-overlay">
      <div
        className={cn(
          'glass-toolbar app-drag shrink-0 border-b border-border/40',
          isCompactLayout ? 'px-6 py-3.5 lg:px-8 lg:py-4' : 'px-8 py-5 lg:px-10 lg:py-6'
        )}
      >
        <div
          className={cn(
            'mx-auto flex max-w-7xl items-center justify-between gap-6',
            isCompactLayout && 'gap-4'
          )}
        >
          <div className={cn('flex min-w-0 items-center gap-4', isCompactLayout && 'gap-3')}>
            <img
              src={appIcon}
              alt="The Pair"
              className={cn(
                'h-10 w-10 rounded-lg object-contain',
                isCompactLayout && 'h-9 w-9'
              )}
            />
            <div className="min-w-0">
              <div className={cn('flex items-center gap-3', isCompactLayout && 'gap-2')}>
                <span
                  className={cn(
                    'truncate text-[11px] uppercase tracking-[0.24em] text-muted-foreground',
                    isCompactLayout && 'text-[10px]'
                  )}
                >
                  Setup Wizard
                </span>
                <span
                  className={cn(
                    'shrink-0 rounded-full border border-border/60 bg-muted/40 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground',
                    isCompactLayout && 'px-2 py-0.5'
                  )}
                >
                  Workspace setup
                </span>
              </div>
              <div
                className={cn(
                  'mt-1.5 flex items-center gap-3',
                  isCompactLayout && 'mt-1 gap-2'
                )}
              >
                <span
                  className={cn(
                    'truncate text-lg font-semibold tracking-tight text-foreground',
                    isCompactLayout && 'text-[17px]'
                  )}
                >
                  The Pair
                </span>
                <span className="shrink-0 rounded bg-blue-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                  v{appVersion}
                </span>
              </div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <button
              onClick={toggleTheme}
              className="app-no-drag rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
              title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
            >
              {theme === 'light' ? <Moon size={15} /> : <Sun size={15} />}
            </button>
          </div>
        </div>
      </div>

      <div className={cn('flex-1 min-h-0', isCompactLayout ? 'overflow-hidden' : 'overflow-y-auto')}>
        <div
          className={cn(
            'mx-auto max-w-7xl px-8 py-8 lg:px-10 lg:py-10',
            isCompactLayout && 'px-6 py-5 lg:px-8 lg:py-6'
          )}
        >
          <div
            className={cn(
              'grid grid-cols-1 items-stretch gap-6 lg:grid-cols-2 xl:gap-8',
              isCompactLayout && 'gap-4 xl:gap-4'
            )}
          >
            <WelcomeCard
              summary={providerSummary}
              loading={isCheckingProviders}
              onOpenConfig={handleOpenConfig}
              onRefresh={handleRefreshProviders}
              isOpening={isOpeningFile}
              isCompactLayout={isCompactLayout}
            />

            <DirectoryCard
              directory={directory}
              onSelectDirectory={handleSelectDirectory}
              isCompactLayout={isCompactLayout}
            />

            <TaskSpecCard
              name={name}
              spec={spec}
              directory={directory}
              onNameChange={setName}
              onSpecChange={setSpec}
              textareaRef={textareaRef}
              onFileSelect={handleFileSelect}
              onSkillSelect={handleSkillSelect}
              isCompactLayout={isCompactLayout}
            />

            <ModelCard
              availableModels={availableModels}
              mentorModel={mentorModel}
              executorModel={executorModel}
              onMentorChange={setMentorModel}
              onExecutorChange={setExecutorModel}
              isCompactLayout={isCompactLayout}
            />
          </div>
        </div>
      </div>

      <div
        className={cn(
          'glass-toolbar shrink-0 border-t border-border/40',
          isCompactLayout ? 'px-6 py-3.5 lg:px-8 lg:py-4' : 'px-8 py-5 lg:px-10'
        )}
      >
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-center">
          {error && (
            <div className="mb-3 flex items-center justify-center gap-2 text-sm text-destructive">
              <AlertCircle size={14} />
              {error}
            </div>
          )}
          <div
            className={cn(
              'inline-flex max-w-[320px] flex-col items-center gap-1.5 rounded-2xl border border-border/60 bg-background/40 px-4 py-3 text-center shadow-sm backdrop-blur-sm',
              isCompactLayout && 'max-w-[300px] px-3 py-2.5'
            )}
          >
            <p className={cn('text-[10px] leading-tight text-muted-foreground lg:text-[11px]')}>
              {providerSummary.isReady
                ? `${providerSummary.readyModelCount} model${providerSummary.readyModelCount !== 1 ? 's' : ''} ready across ${providerSummary.readyProviderLabels.length} provider${providerSummary.readyProviderLabels.length !== 1 ? 's' : ''}`
                : 'Configure at least one provider to continue'}
            </p>
            <GlassButton
              variant="approve"
              size="md"
              onClick={handleLaunch}
              disabled={!canLaunch || isCreating}
              icon={<Rocket size={15} />}
              className={cn(
                'min-w-[168px]',
                isCompactLayout && 'min-w-[156px]',
                !canLaunch || isCreating ? 'opacity-40' : ''
              )}
            >
              {isCreating ? 'Launching...' : 'Launch Pair'}
            </GlassButton>
          </div>
        </div>
      </div>
    </div>
  )
}

function WelcomeCard({
  summary,
  loading,
  onOpenConfig,
  onRefresh,
  isOpening,
  isCompactLayout
}: {
  summary: ProviderSetupSummary
  loading: boolean
  onOpenConfig: () => void
  onRefresh: () => void
  isOpening: boolean
  isCompactLayout: boolean
}): React.ReactNode {
  const healthState = useMemo(() => {
    if (loading) return 'checking'
    if (summary.isReady) return 'healthy'
    if (summary.readyModelCount > 0) return 'warning'
    return 'error'
  }, [loading, summary])

  const healthConfig = {
    checking: {
      icon: (
        <div className="w-5 h-5 border-2 border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin" />
      ),
      label: 'Checking provider health...',
      description: 'Scanning for installed providers and available models.',
      bgClass: 'bg-muted/30',
      borderClass: 'border-border',
      textClass: 'text-muted-foreground'
    },
    healthy: {
      icon: <CheckCircle2 size={20} className="text-green-600 dark:text-green-400" />,
      label: 'All systems ready',
      description: `${summary.readyModelCount} model${summary.readyModelCount !== 1 ? 's' : ''} available across ${summary.readyProviderLabels.join(', ')}.`,
      bgClass: 'bg-green-500/10 dark:bg-green-500/15',
      borderClass: 'border-green-500/20',
      textClass: 'text-green-700 dark:text-green-400'
    },
    warning: {
      icon: <AlertCircle size={20} className="text-amber-600 dark:text-amber-400" />,
      label: 'Partial configuration',
      description: `${summary.readyModelCount} model${summary.readyModelCount !== 1 ? 's' : ''} ready. Some providers may need attention.`,
      bgClass: 'bg-amber-500/10 dark:bg-amber-500/15',
      borderClass: 'border-amber-500/20',
      textClass: 'text-amber-700 dark:text-amber-400'
    },
    error: {
      icon: <AlertCircle size={20} className="text-red-600 dark:text-red-400" />,
      label: 'No providers configured',
      description: 'Install or sign in to at least one supported provider.',
      bgClass: 'bg-red-500/10 dark:bg-red-500/15',
      borderClass: 'border-red-500/20',
      textClass: 'text-red-700 dark:text-red-400'
    }
  }

  const config = healthConfig[healthState]

  return (
    <GlassCard
      className={cn(
        'flex h-full min-h-[240px] flex-col justify-between p-6 space-y-5',
        isCompactLayout && 'min-h-[200px] p-5'
      )}
    >
      <CardHeader
        eyebrow="SYSTEM HEALTH"
        title="Provider Health"
        description="Scan installed providers and keep the model list ready before launch."
      />
      <div className="flex items-start gap-3">
        <div
          className={cn(
            'w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border',
            config.bgClass,
            config.borderClass
          )}
        >
          {config.icon}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className={cn('font-semibold text-sm', config.textClass)}>{config.label}</h3>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
            {config.description}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <GlassButton
          variant="ghost"
          size="sm"
          onClick={onRefresh}
          disabled={loading || isOpening}
          icon={<RefreshCw size={12} className={loading ? 'animate-spin' : ''} />}
        >
          Refresh
        </GlassButton>
        {!summary.isReady && !loading && (
          <GlassButton
            variant="secondary"
            size="sm"
            onClick={onOpenConfig}
            disabled={isOpening}
            icon={<ExternalLink size={12} />}
          >
            {isOpening ? 'Opening...' : 'Open Config'}
          </GlassButton>
        )}
      </div>
    </GlassCard>
  )
}

function DirectoryCard({
  directory,
  onSelectDirectory,
  isCompactLayout
}: {
  directory: string
  onSelectDirectory: () => void
  isCompactLayout: boolean
}): React.ReactNode {
  return (
    <GlassCard
      className={cn(
        'flex h-full min-h-[240px] flex-col justify-between p-6 space-y-5',
        isCompactLayout && 'min-h-[200px] p-5'
      )}
    >
      <CardHeader
        eyebrow="WORKSPACE"
        title="Choose Workspace"
        description="Select the project folder for The Pair to work in."
      />

      <GlassButton
        variant="secondary"
        onClick={onSelectDirectory}
        className={cn(
          'w-full h-auto flex flex-col items-center gap-3 py-6',
          isCompactLayout && 'gap-2.5 py-4'
        )}
      >
        <div
          className={cn(
            'flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-muted',
            isCompactLayout && 'h-10 w-10'
          )}
        >
          <FolderOpen size={22} className="text-foreground/40" />
        </div>
        <div className="text-center space-y-1">
          <p className="font-medium text-sm text-foreground">
            {directory ? 'Change project directory' : 'Click to select a folder'}
          </p>
          {directory && (
            <p className="text-xs text-muted-foreground font-mono bg-muted px-3 py-1.5 rounded-lg inline-block mt-1">
              {directory}
            </p>
          )}
          {!directory && (
            <p className="text-xs text-muted-foreground">
              Choose any folder — The Pair will read, analyze, and modify files there.
            </p>
          )}
        </div>
      </GlassButton>
    </GlassCard>
  )
}

function TaskSpecCard({
  name,
  spec,
  directory,
  onNameChange,
  onSpecChange,
  textareaRef,
  onFileSelect,
  onSkillSelect,
  isCompactLayout
}: {
  name: string
  spec: string
  directory: string
  onNameChange: (v: string) => void
  onSpecChange: (v: string) => void
  textareaRef: React.RefObject<HTMLTextAreaElement | null>
  onFileSelect: (path: string, content: string) => void
  onSkillSelect: (skillName: string) => void
  isCompactLayout: boolean
}): React.ReactNode {
  return (
    <GlassCard
      className={cn(
        'flex h-full min-h-[250px] flex-col justify-between p-6 space-y-5',
        isCompactLayout && 'min-h-[220px] p-5'
      )}
    >
      <CardHeader
        eyebrow="TASK"
        title="Task Specification"
        description="Give this pair a name and describe the desired outcome."
      />

      <div className="space-y-4">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-foreground">Pair Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="e.g., Add user authentication"
            className="w-full rounded-xl glass-card px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        <div className="relative">
          <label className="mb-1.5 block text-xs font-medium text-foreground">
            Task Description
          </label>
          <textarea
            ref={textareaRef}
            value={spec}
            onChange={(e) => onSpecChange(e.target.value)}
            placeholder="Describe the desired outcome as directly as possible... Use @filename to reference files."
            rows={4}
            className="w-full resize-none rounded-xl glass-card px-3.5 py-2.5 text-sm leading-relaxed text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          {directory && (
            <div className="absolute right-2 top-7 flex items-center gap-1">
              <SkillPicker projectDir={directory} onSelect={onSkillSelect} />
              <FileMention
                textareaRef={textareaRef}
                onChange={onSpecChange}
                directory={directory}
                onFileSelect={onFileSelect}
              />
            </div>
          )}
          <p className="mt-1.5 text-xs text-muted-foreground">
            {spec.length} characters · Type @ to reference files
          </p>
        </div>
      </div>
    </GlassCard>
  )
}

function ModelCard({
  availableModels,
  mentorModel,
  executorModel,
  onMentorChange,
  onExecutorChange,
  isCompactLayout
}: {
  availableModels: AvailableModel[]
  mentorModel: string
  executorModel: string
  onMentorChange: (m: string) => void
  onExecutorChange: (m: string) => void
  isCompactLayout: boolean
}): React.ReactNode {
  return (
    <GlassCard
      className={cn(
        'flex h-full min-h-[250px] flex-col justify-between space-y-5 p-6',
        isCompactLayout && 'min-h-[220px] p-5'
      )}
    >
      <CardHeader
        eyebrow="MODELS"
        title="Model Selection"
        description="Each role gets its own picker. Click a row to search and change the default."
      />

      <div className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-blue-500/20 bg-blue-500/10">
              <Brain size={13} className="text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h4 className="text-xs font-semibold text-foreground">Mentor</h4>
              <p className="text-[10px] text-muted-foreground">Analyzes and plans</p>
            </div>
          </div>
          <ModelPicker
            value={mentorModel}
            models={availableModels}
            onChange={onMentorChange}
            role="mentor"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-purple-500/20 bg-purple-500/10">
              <Zap size={13} className="text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h4 className="text-xs font-semibold text-foreground">Executor</h4>
              <p className="text-[10px] text-muted-foreground">Writes and executes</p>
            </div>
          </div>
          <ModelPicker
            value={executorModel}
            models={availableModels}
            onChange={onExecutorChange}
            role="executor"
          />
        </div>
      </div>
    </GlassCard>
  )
}

function CardHeader({
  eyebrow,
  title,
  description
}: {
  eyebrow: string
  title: string
  description: string
}): React.ReactNode {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
          {eyebrow}
        </span>
        <span className="h-px flex-1 bg-border/70" />
      </div>
      <div className="space-y-1">
        <h3 className="text-sm font-semibold tracking-tight text-foreground">{title}</h3>
        <p className="text-xs leading-relaxed text-muted-foreground">{description}</p>
      </div>
    </div>
  )
}

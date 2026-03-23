import React, { useMemo, useState } from 'react'
import { Brain, CheckCircle2, ChevronDown, CircleAlert, Search, Zap } from 'lucide-react'
import { cn } from '../lib/utils'
import type { AvailableModel } from '../types'
import { GlassModal } from './ui/GlassModal'

const RECENT_MODELS_KEY = 'the-pair-recent-models'
const MAX_RECENT_MODELS = 5

function getRecentModelIds(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_MODELS_KEY) || '[]')
  } catch {
    return []
  }
}

function saveRecentModelId(modelId: string): void {
  const recent = getRecentModelIds().filter((id) => id !== modelId)
  recent.unshift(modelId)
  localStorage.setItem(RECENT_MODELS_KEY, JSON.stringify(recent.slice(0, MAX_RECENT_MODELS)))
}

interface ModelPickerProps {
  value: string
  models: AvailableModel[]
  onChange: (value: string) => void
  role: 'mentor' | 'executor'
}

function getQualifiedModel(model: AvailableModel): string {
  // For opencode, modelId already contains the full provider/model path (e.g. bailian-coding-plan/glm-5)
  // For other providers, we need to prepend the provider kind
  if (model.provider === 'opencode') {
    return model.modelId
  }
  return `${model.provider}/${model.modelId}`
}

function getRoleTone(role: 'mentor' | 'executor'): {
  icon: React.ReactNode
  text: string
  border: string
  background: string
} {
  if (role === 'mentor') {
    return {
      icon: <Brain size={15} className="text-blue-600 dark:text-blue-400" />,
      text: 'text-blue-600 dark:text-blue-400',
      border: 'border-blue-500/25',
      background: 'bg-blue-500/8 dark:bg-blue-500/14'
    }
  }

  return {
    icon: <Zap size={15} className="text-purple-600 dark:text-purple-400" />,
    text: 'text-purple-600 dark:text-purple-400',
    border: 'border-purple-500/25',
    background: 'bg-purple-500/8 dark:bg-purple-500/14'
  }
}

function ModelBadge({
  children,
  className
}: {
  children: React.ReactNode
  className?: string
}): React.ReactNode {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border border-border/60 bg-muted/40 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-[0.14em] text-muted-foreground',
        className
      )}
    >
      {children}
    </span>
  )
}

export function ModelPicker({ value, models, onChange, role }: ModelPickerProps): React.ReactNode {
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [recentModelIds, setRecentModelIds] = useState<string[]>(() => getRecentModelIds())
  const tone = getRoleTone(role)
  const selectedModel = useMemo(
    () => models.find((model) => getQualifiedModel(model) === value),
    [models, value]
  )

  const filteredModels = useMemo(() => {
    if (!searchQuery.trim()) return models
    const query = searchQuery.toLowerCase().replace(/[\s.-]/g, '')

    const fuzzyMatch = (text: string, search: string): boolean => {
      const normalized = text.toLowerCase().replace(/[\s.-]/g, '')
      let searchIndex = 0
      for (let i = 0; i < normalized.length && searchIndex < search.length; i++) {
        if (normalized[i] === search[searchIndex]) {
          searchIndex++
        }
      }
      return searchIndex === search.length
    }

    return models.filter(
      (model) =>
        fuzzyMatch(model.displayName, query) ||
        fuzzyMatch(model.providerLabel, query) ||
        fuzzyMatch(model.modelId, query)
    )
  }, [models, searchQuery])

  const readyModels = useMemo(
    () => filteredModels.filter((model) => model.available),
    [filteredModels]
  )
  const unavailableModels = useMemo(
    () => filteredModels.filter((model) => !model.available),
    [filteredModels]
  )
  const recentModels = useMemo(() => {
    return recentModelIds
      .map((id) => readyModels.find((model) => getQualifiedModel(model) === id))
      .filter((model): model is AvailableModel => model !== undefined)
  }, [recentModelIds, readyModels])

  const handleSelect = (model: AvailableModel): void => {
    if (!model.available) return
    const modelId = getQualifiedModel(model)
    saveRecentModelId(modelId)
    setRecentModelIds(getRecentModelIds())
    onChange(modelId)
    setIsOpen(false)
    setSearchQuery('')
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={cn(
          'glass-card w-full rounded-2xl border px-4 py-3 text-left transition-all hover:border-foreground/12 hover:bg-muted/30',
          selectedModel ? tone.border : 'border-border'
        )}
      >
        {selectedModel ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className={cn(
                    'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border',
                    tone.border,
                    tone.background
                  )}
                >
                  {tone.icon}
                </span>
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-foreground">
                    {selectedModel.displayName}
                  </div>
                  <div className="text-xs text-muted-foreground">{selectedModel.providerLabel}</div>
                </div>
              </div>
              <ChevronDown size={16} className="shrink-0 text-muted-foreground" />
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-muted-foreground">Select a model</span>
            <ChevronDown size={16} className="text-muted-foreground" />
          </div>
        )}
      </button>

      <GlassModal
        isOpen={isOpen}
        onClose={() => {
          setIsOpen(false)
          setSearchQuery('')
        }}
        title={`Choose ${role === 'mentor' ? 'Mentor' : 'Executor'} Model`}
        className="max-w-2xl"
      >
        <div className="space-y-3">
          <div className="relative">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setIsOpen(false)
                  setSearchQuery('')
                }
              }}
              placeholder="Search models..."
              className="w-full rounded-xl border border-border bg-background/60 py-2 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-foreground/20 focus:outline-none focus:ring-2 focus:ring-foreground/10"
              autoFocus
            />
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <ModelBadge>{readyModels.length} ready</ModelBadge>
            <ModelBadge>{unavailableModels.length} unavailable</ModelBadge>
          </div>

          <div className="max-h-[65vh] space-y-3 overflow-y-auto pr-1 scrollbar-thin">
            {[
              ...(recentModels.length > 0
                ? [{ title: 'Recently Used', items: recentModels, isRecent: true as const }]
                : []),
              { title: 'Ready to use', items: readyModels },
              { title: 'Unavailable', items: unavailableModels }
            ].map((section) =>
              section.items.length === 0 ? null : (
                <div key={section.title} className="space-y-1.5">
                  <div className="px-1 text-[9px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    {section.title}
                  </div>
                  <div className="space-y-1.5">
                    {section.items.map((model) => {
                      const selected = getQualifiedModel(model) === value
                      const isRecent = 'isRecent' in section && section.isRecent

                      return (
                        <button
                          key={getQualifiedModel(model)}
                          type="button"
                          disabled={!model.available}
                          onClick={() => handleSelect(model)}
                          className={cn(
                            'w-full rounded-xl border px-3 py-2.5 text-left transition-all',
                            selected
                              ? cn('border-foreground/20 bg-muted/40 shadow-sm', tone.border)
                              : 'border-border/60 bg-background/40',
                            model.available
                              ? 'hover:border-foreground/18 hover:bg-muted/30'
                              : 'cursor-not-allowed opacity-60'
                          )}
                        >
                          <div className="flex items-center gap-2.5">
                            <div
                              className={cn(
                                'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border',
                                model.available ? tone.border : 'border-border',
                                model.available ? tone.background : 'bg-muted/40'
                              )}
                            >
                              {model.available ? (
                                tone.icon
                              ) : (
                                <CircleAlert
                                  size={13}
                                  className="text-amber-600 dark:text-amber-400"
                                />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1">
                                    <span className="truncate text-sm font-semibold text-foreground">
                                      {model.displayName}
                                    </span>
                                    {isRecent && (
                                      <span className="shrink-0 rounded-full bg-blue-500/15 px-1.5 py-0.5 text-[9px] font-medium text-blue-500 dark:text-blue-400">
                                        recent
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1.5 text-[11px]">
                                    {model.sourceProvider &&
                                      model.sourceProvider !== model.provider && (
                                        <>
                                          <span className="font-medium text-blue-600 dark:text-blue-400">
                                            {model.sourceProvider}
                                          </span>
                                          <span className="text-muted-foreground">via</span>
                                        </>
                                      )}
                                    <span className="font-medium text-foreground/80">
                                      {model.providerLabel}
                                    </span>
                                    {model.planLabel && model.planLabel !== 'BYOK' && (
                                      <>
                                        <span className="text-muted-foreground">·</span>
                                        <span className="text-muted-foreground">
                                          {model.planLabel}
                                        </span>
                                      </>
                                    )}
                                  </div>
                                </div>
                                {selected && (
                                  <CheckCircle2 size={14} className={cn('shrink-0', tone.text)} />
                                )}
                              </div>

                              {!model.available && (
                                <div className="mt-1 text-[11px] text-amber-600 dark:text-amber-400">
                                  {model.availabilityReason}
                                </div>
                              )}
                            </div>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            )}

            {filteredModels.length === 0 && (
              <div className="py-8 text-center text-sm text-muted-foreground">
                No models found matching &quot;{searchQuery}&quot;
              </div>
            )}
          </div>
        </div>
      </GlassModal>
    </>
  )
}

import React, { useMemo, useState, useRef, useEffect } from 'react'
import { Brain, CheckCircle2, ChevronDown, CircleAlert, Search, Zap } from 'lucide-react'
import { cn } from '../lib/utils'
import type { AvailableModel } from '../types'
import {
  getQualifiedModel,
  isSelectableForPairExecution,
  savePreferredModelId
} from '../lib/modelPreferences'
import { ReasoningEffortPicker } from './ReasoningEffortPicker'

const RECENT_MODELS_KEY_PREFIX = 'the-pair-recent-models-'
const MAX_RECENT_MODELS = 4

function getRecentModelIds(role: 'mentor' | 'executor'): string[] {
  try {
    const roleKey = RECENT_MODELS_KEY_PREFIX + role
    const stored = localStorage.getItem(roleKey)
    if (stored) return JSON.parse(stored)

    // Migrate from old global key on first access
    const legacy = localStorage.getItem('the-pair-recent-models')
    if (legacy) {
      const ids: string[] = JSON.parse(legacy)
      localStorage.setItem(roleKey, JSON.stringify(ids.slice(0, MAX_RECENT_MODELS)))
      return ids.slice(0, MAX_RECENT_MODELS)
    }
    return []
  } catch {
    return []
  }
}

function saveRecentModelId(role: 'mentor' | 'executor', modelId: string): void {
  const key = RECENT_MODELS_KEY_PREFIX + role
  const recent = getRecentModelIds(role).filter((id) => id !== modelId)
  recent.unshift(modelId)
  localStorage.setItem(key, JSON.stringify(recent.slice(0, MAX_RECENT_MODELS)))
}

export interface ModelPickerProps {
  value: string
  models: AvailableModel[]
  onChange: (value: string) => void
  role: 'mentor' | 'executor'
  /** Render as a self-contained card with role header */
  variant?: 'card' | 'inline'
  /** Open the dropdown upward instead of downward */
  dropUp?: boolean
  reasoningEffort?: string
  onReasoningEffortChange?: (value: string | undefined) => void
}

function getRoleTone(role: 'mentor' | 'executor') {
  if (role === 'mentor') {
    return {
      icon: <Brain size={14} className="text-blue-600 dark:text-blue-400" />,
      iconSm: <Brain size={12} className="text-blue-600 dark:text-blue-400" />,
      text: 'text-blue-600 dark:text-blue-400',
      border: 'border-blue-500/25',
      background: 'bg-blue-500/8 dark:bg-blue-500/14',
      ringSelected: 'ring-blue-500/30',
      bgSelected: 'bg-blue-500/10 dark:bg-blue-500/18',
      headerBg: 'bg-blue-500/6 dark:bg-blue-500/10',
      label: 'Mentor',
      subtitle: 'Analyzes, plans, reviews'
    }
  }
  return {
    icon: <Zap size={14} className="text-purple-600 dark:text-purple-400" />,
    iconSm: <Zap size={12} className="text-purple-600 dark:text-purple-400" />,
    text: 'text-purple-600 dark:text-purple-400',
    border: 'border-purple-500/25',
    background: 'bg-purple-500/8 dark:bg-purple-500/14',
    ringSelected: 'ring-purple-500/30',
    bgSelected: 'bg-purple-500/10 dark:bg-purple-500/18',
    headerBg: 'bg-purple-500/6 dark:bg-purple-500/10',
    label: 'Executor',
    subtitle: 'Writes code, runs commands'
  }
}

function QuickPickCell({
  model,
  selected,
  tone,
  onSelect
}: {
  model: AvailableModel
  selected: boolean
  tone: ReturnType<typeof getRoleTone>
  onSelect: (model: AvailableModel) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(model)}
      className={cn(
        'flex w-full items-center gap-2 rounded-xl border px-2.5 py-2 text-left transition-all cursor-pointer',
        selected
          ? cn('ring-1', tone.border, tone.bgSelected, tone.ringSelected)
          : 'border-border/50 bg-background/30 hover:border-foreground/12 hover:bg-muted/30'
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="truncate text-[11px] font-semibold text-foreground leading-tight">
          {model.displayName}
        </div>
        <div className="truncate text-[10px] text-muted-foreground leading-tight mt-0.5">
          {model.providerLabel}
        </div>
      </div>
      {selected && <CheckCircle2 size={11} className={cn('shrink-0', tone.text)} />}
    </button>
  )
}

export function ModelPicker({
  value,
  models,
  onChange,
  role,
  variant = 'inline',
  dropUp = false,
  reasoningEffort,
  onReasoningEffortChange
}: ModelPickerProps): React.ReactNode {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [recentModelIds] = useState<string[]>(() => getRecentModelIds(role))
  const dropdownRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const tone = getRoleTone(role)

  useEffect(() => {
    if (!isDropdownOpen) return
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false)
        setSearchQuery('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [isDropdownOpen])

  useEffect(() => {
    if (isDropdownOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isDropdownOpen])

  const readyModels = useMemo(
    () => models.filter((model) => isSelectableForPairExecution(model)),
    [models]
  )

  const recentModels = useMemo(() => {
    return recentModelIds
      .map((id) => readyModels.find((model) => getQualifiedModel(model) === id))
      .filter((model): model is AvailableModel => model !== undefined)
      .slice(0, MAX_RECENT_MODELS)
  }, [recentModelIds, readyModels])

  const filteredDropdownModels = useMemo(() => {
    const selectable = models.filter((m) => isSelectableForPairExecution(m))
    if (!searchQuery.trim()) return selectable
    const query = searchQuery.toLowerCase().replace(/[\s.-]/g, '')
    const fuzzyMatch = (text: string, search: string): boolean => {
      const normalized = text.toLowerCase().replace(/[\s.-]/g, '')
      let searchIndex = 0
      for (let i = 0; i < normalized.length && searchIndex < search.length; i++) {
        if (normalized[i] === search[searchIndex]) searchIndex++
      }
      return searchIndex === search.length
    }
    return selectable.filter(
      (model) =>
        fuzzyMatch(model.displayName, query) ||
        fuzzyMatch(model.providerLabel, query) ||
        fuzzyMatch(model.modelId, query)
    )
  }, [models, searchQuery])

  const handleSelect = (model: AvailableModel): void => {
    if (!isSelectableForPairExecution(model)) return
    const modelId = getQualifiedModel(model)
    saveRecentModelId(role, modelId)
    savePreferredModelId(role, modelId)
    onChange(modelId)
    setIsDropdownOpen(false)
    setSearchQuery('')

    const levels = model.reasoningEffortLevels
    if (levels && levels.length > 0 && onReasoningEffortChange) {
      const defaultLevel = levels.includes('medium') ? 'medium' : levels[0]
      onReasoningEffortChange(defaultLevel)
    } else if (onReasoningEffortChange) {
      onReasoningEffortChange(undefined)
    }
  }

  const selectedModel = useMemo(
    () => models.find((model) => getQualifiedModel(model) === value),
    [models, value]
  )

  const pickerContent = (
    <div className="space-y-2.5">
      {/* 2x2 quick-pick grid for recent models */}
      {recentModels.length > 0 && (
        <div>
          <div className="mb-1.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Recent
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {recentModels.map((model) => (
              <QuickPickCell
                key={getQualifiedModel(model)}
                model={model}
                selected={getQualifiedModel(model) === value}
                tone={tone}
                onSelect={handleSelect}
              />
            ))}
          </div>
        </div>
      )}

      {/* Dropdown search selector */}
      <div className="relative" ref={dropdownRef}>
        <button
          type="button"
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          className={cn(
            'flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-left transition-all hover:border-foreground/12 hover:bg-muted/30 cursor-pointer',
            selectedModel && !recentModels.some((m) => getQualifiedModel(m) === value)
              ? tone.border
              : 'border-border/50'
          )}
        >
          {selectedModel && !recentModels.some((m) => getQualifiedModel(m) === value) ? (
            <div className="min-w-0 flex-1">
              <div className="truncate text-[11px] font-semibold text-foreground">
                {selectedModel.displayName}
              </div>
              <div className="truncate text-[10px] text-muted-foreground">
                {selectedModel.providerLabel}
              </div>
            </div>
          ) : (
            <div className="flex min-w-0 flex-1 items-center gap-1.5">
              <Search size={12} className="shrink-0 text-muted-foreground" />
              <span className="text-[11px] text-muted-foreground">
                {recentModels.length > 0 ? 'All models...' : 'Select a model'}
              </span>
            </div>
          )}
          <ChevronDown
            size={13}
            className={cn(
              'shrink-0 text-muted-foreground transition-transform',
              isDropdownOpen && 'rotate-180'
            )}
          />
        </button>

        {isDropdownOpen && (
          <div
            className={cn(
              'absolute left-0 right-0 z-50 overflow-hidden rounded-xl border border-border bg-background/95 shadow-xl backdrop-blur-lg',
              dropUp ? 'bottom-full mb-1' : 'top-full mt-1'
            )}
          >
            <div className="p-2">
              <div className="relative">
                <Search
                  size={12}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
                />
                <input
                  ref={inputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      setIsDropdownOpen(false)
                      setSearchQuery('')
                    }
                  }}
                  placeholder="Search models..."
                  className="w-full rounded-lg border border-border/60 bg-muted/30 py-1.5 pl-7 pr-3 text-[11px] text-foreground placeholder:text-muted-foreground focus:border-foreground/20 focus:outline-none"
                />
              </div>
            </div>
            <div className="max-h-52 overflow-y-auto px-1.5 pb-1.5 scrollbar-thin">
              {filteredDropdownModels.length === 0 ? (
                <div className="py-4 text-center text-[11px] text-muted-foreground">
                  No models found
                </div>
              ) : (
                filteredDropdownModels.map((model) => {
                  const selected = getQualifiedModel(model) === value
                  return (
                    <button
                      key={getQualifiedModel(model)}
                      type="button"
                      onClick={() => handleSelect(model)}
                      className={cn(
                        'flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left transition-all cursor-pointer',
                        selected ? tone.bgSelected : 'hover:bg-muted/40'
                      )}
                    >
                      <div
                        className={cn(
                          'inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md border',
                          model.available ? tone.border : 'border-border',
                          model.available ? tone.background : 'bg-muted/40'
                        )}
                      >
                        {model.supportsPairExecution ? (
                          tone.iconSm
                        ) : (
                          <CircleAlert size={10} className="text-amber-600 dark:text-amber-400" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[11px] font-semibold text-foreground">
                          {model.displayName}
                        </div>
                        <div className="flex items-center gap-1 text-[10px]">
                          {model.provider === 'claude' ? (
                            <span className="font-medium text-blue-600 dark:text-blue-400">
                              {model.modelId}
                            </span>
                          ) : (
                            model.sourceProviderLabel &&
                            model.sourceProviderLabel !== model.providerLabel && (
                              <>
                                <span className="font-medium text-blue-600 dark:text-blue-400">
                                  {model.sourceProviderLabel}
                                </span>
                                <span className="text-muted-foreground">via</span>
                              </>
                            )
                          )}
                          <span className="font-medium text-foreground/80">
                            {model.providerLabel}
                          </span>
                          {model.planLabel && model.planLabel !== 'BYOK' && (
                            <span className="inline-flex items-center rounded-full bg-emerald-500/15 px-1 py-0.5 text-[8px] font-semibold uppercase text-emerald-600 dark:text-emerald-400">
                              {model.planLabel}
                            </span>
                          )}
                        </div>
                      </div>
                      {selected && <CheckCircle2 size={11} className={cn('shrink-0', tone.text)} />}
                    </button>
                  )
                })
              )}
            </div>
          </div>
        )}
      </div>

      {selectedModel?.reasoningEffortLevels &&
        selectedModel.reasoningEffortLevels.length > 0 &&
        onReasoningEffortChange && (
          <ReasoningEffortPicker
            levels={selectedModel.reasoningEffortLevels}
            value={reasoningEffort}
            onChange={onReasoningEffortChange}
            role={role}
          />
        )}
    </div>
  )

  if (variant === 'card') {
    return (
      <div className={cn('flex flex-col rounded-2xl border p-4', tone.border, 'bg-background/40')}>
        {/* Card header */}
        <div className="mb-3 flex items-center gap-2.5">
          <div
            className={cn(
              'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border',
              tone.border,
              tone.background
            )}
          >
            {tone.icon}
          </div>
          <div>
            <div className={cn('text-sm font-semibold', tone.text)}>{tone.label}</div>
            <div className="text-[10px] text-muted-foreground">{tone.subtitle}</div>
          </div>
        </div>
        {pickerContent}
      </div>
    )
  }

  return pickerContent
}

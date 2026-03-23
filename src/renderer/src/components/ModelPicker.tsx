import React, { useMemo, useState } from 'react'
import { Brain, CheckCircle2, ChevronDown, CircleAlert, Sparkles, Zap } from 'lucide-react'
import { cn } from '../lib/utils'
import type { AvailableModel } from '../types'
import { GlassModal } from './ui/GlassModal'

interface ModelPickerProps {
  value: string
  models: AvailableModel[]
  onChange: (value: string) => void
  role: 'mentor' | 'executor'
}

function getQualifiedModel(model: AvailableModel): string {
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

function getRoleGuidance(model: AvailableModel, role: 'mentor' | 'executor'): string {
  if (model.recommendedRoles.includes(role)) {
    return role === 'mentor'
      ? 'Strong fit for planning, review, and synthesis'
      : 'Strong fit for execution speed and coding loops'
  }

  if (model.recommendedRoles.length === 1) {
    return model.recommendedRoles[0] === 'mentor'
      ? 'Better suited to deeper planning than fast execution'
      : 'Better suited to fast implementation than long review passes'
  }

  return 'Balanced option for both planning and execution'
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
        'inline-flex items-center rounded-full border border-border/60 bg-muted/40 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground',
        className
      )}
    >
      {children}
    </span>
  )
}

export function ModelPicker({ value, models, onChange, role }: ModelPickerProps): React.ReactNode {
  const [isOpen, setIsOpen] = useState(false)
  const tone = getRoleTone(role)
  const selectedModel = useMemo(
    () => models.find((model) => getQualifiedModel(model) === value),
    [models, value]
  )
  const readyModels = useMemo(() => models.filter((model) => model.available), [models])
  const unavailableModels = useMemo(() => models.filter((model) => !model.available), [models])

  const handleSelect = (model: AvailableModel): void => {
    if (!model.available) return
    onChange(getQualifiedModel(model))
    setIsOpen(false)
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
          <div className="space-y-2.5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      'inline-flex h-8 w-8 items-center justify-center rounded-xl border',
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
                    <div className="text-xs text-muted-foreground">
                      {selectedModel.providerLabel} via {selectedModel.sourceProviderLabel}
                    </div>
                  </div>
                </div>
              </div>
              <ChevronDown size={16} className="mt-1 shrink-0 text-muted-foreground" />
            </div>

            <div className="flex flex-wrap gap-2">
              <ModelBadge>{selectedModel.providerLabel}</ModelBadge>
              <ModelBadge>{selectedModel.billingLabel}</ModelBadge>
              {selectedModel.planLabel && <ModelBadge>{selectedModel.planLabel}</ModelBadge>}
              <ModelBadge
                className={cn(
                  selectedModel.available ? tone.text : 'text-amber-600 dark:text-amber-400'
                )}
              >
                {selectedModel.available ? 'Ready' : 'Unavailable'}
              </ModelBadge>
            </div>

            <p className="text-xs leading-relaxed text-muted-foreground">
              {selectedModel.available
                ? `${selectedModel.accessLabel} · ${getRoleGuidance(selectedModel, role)}`
                : selectedModel.availabilityReason}
            </p>
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
        onClose={() => setIsOpen(false)}
        title={`Choose ${role === 'mentor' ? 'Mentor' : 'Executor'} Model`}
        className="max-w-3xl"
      >
        <div className="space-y-4">
          <div className="glass-card rounded-2xl p-4">
            <div className="flex items-start gap-3">
              <div
                className={cn(
                  'mt-0.5 inline-flex h-10 w-10 items-center justify-center rounded-2xl border',
                  tone.border,
                  tone.background
                )}
              >
                {tone.icon}
              </div>
              <div className="space-y-1">
                <div className="text-sm font-semibold text-foreground">
                  {role === 'mentor' ? 'Mentor models' : 'Executor models'}
                </div>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {role === 'mentor'
                    ? 'Prioritize models that are good at planning, reviewing patches, and steering long-running tasks.'
                    : 'Prioritize models that are dependable in coding loops and can move quickly through concrete implementation work.'}
                </p>
                <div className="flex flex-wrap gap-2 pt-1">
                  <ModelBadge>{readyModels.length} ready</ModelBadge>
                  <ModelBadge>{unavailableModels.length} unavailable</ModelBadge>
                  <ModelBadge>Provider + billing visible</ModelBadge>
                </div>
              </div>
            </div>
          </div>

          <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1 scrollbar-thin">
            {[
              { title: 'Ready to use', items: readyModels },
              { title: 'Detected but unavailable', items: unavailableModels }
            ].map((section) =>
              section.items.length === 0 ? null : (
                <div key={section.title} className="space-y-2">
                  <div className="px-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                    {section.title}
                  </div>
                  <div className="space-y-2">
                    {section.items.map((model) => {
                      const selected = getQualifiedModel(model) === value

                      return (
                        <button
                          key={getQualifiedModel(model)}
                          type="button"
                          disabled={!model.available}
                          onClick={() => handleSelect(model)}
                          className={cn(
                            'w-full rounded-2xl border px-4 py-4 text-left transition-all',
                            selected
                              ? cn('border-foreground/20 bg-muted/40 shadow-lg', tone.border)
                              : 'border-border/60 bg-background/40',
                            model.available
                              ? 'hover:border-foreground/18 hover:bg-muted/30'
                              : 'cursor-not-allowed opacity-70'
                          )}
                        >
                          <div className="flex items-start gap-3">
                            <div
                              className={cn(
                                'mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border',
                                model.available ? tone.border : 'border-border',
                                model.available ? tone.background : 'bg-muted/40'
                              )}
                            >
                              {model.available ? (
                                tone.icon
                              ) : (
                                <CircleAlert
                                  size={15}
                                  className="text-amber-600 dark:text-amber-400"
                                />
                              )}
                            </div>
                            <div className="min-w-0 flex-1 space-y-2">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <div className="text-sm font-semibold text-foreground">
                                    {model.displayName}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {model.providerLabel} via {model.sourceProviderLabel}
                                  </div>
                                </div>
                                {selected && (
                                  <span
                                    className={cn(
                                      'inline-flex items-center gap-1 text-xs font-medium',
                                      tone.text
                                    )}
                                  >
                                    <CheckCircle2 size={14} />
                                    Selected
                                  </span>
                                )}
                              </div>

                              <div className="flex flex-wrap gap-2">
                                <ModelBadge>{model.providerLabel}</ModelBadge>
                                <ModelBadge>{model.billingLabel}</ModelBadge>
                                {model.planLabel && <ModelBadge>{model.planLabel}</ModelBadge>}
                                <ModelBadge>{model.accessLabel}</ModelBadge>
                                <ModelBadge
                                  className={cn(
                                    model.available
                                      ? tone.text
                                      : 'text-amber-600 dark:text-amber-400'
                                  )}
                                >
                                  {model.available ? 'Ready' : 'Unavailable'}
                                </ModelBadge>
                              </div>

                              <div className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
                                <Sparkles
                                  size={13}
                                  className="mt-0.5 shrink-0 text-muted-foreground/70"
                                />
                                <span>
                                  {model.available
                                    ? getRoleGuidance(model, role)
                                    : model.availabilityReason}
                                </span>
                              </div>
                            </div>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            )}
          </div>
        </div>
      </GlassModal>
    </>
  )
}

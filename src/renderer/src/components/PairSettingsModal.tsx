import React, { useMemo, useState } from 'react'
import { SlidersHorizontal } from 'lucide-react'
import { usePairStore, Pair } from '../store/usePairStore'
import type { PairModelSelection } from '../types'
import { GlassButton } from './ui/GlassButton'
import { GlassModal } from './ui/GlassModal'
import { ModelPicker } from './ModelPicker'
import { isPairActive } from '../lib/pairStatus'

interface PairSettingsModalProps {
  pair: Pair | null
  isOpen: boolean
  onClose: () => void
}

export function PairSettingsModal({
  pair,
  isOpen,
  onClose
}: PairSettingsModalProps): React.ReactNode {
  const { availableModels, updatePairModels, isLoading, error } = usePairStore()
  const [selection, setSelection] = useState<PairModelSelection>(() => ({
    mentorModel: pair?.pendingMentorModel ?? pair?.mentorModel ?? '',
    executorModel: pair?.pendingExecutorModel ?? pair?.executorModel ?? '',
    mentorReasoningEffort: pair?.mentorReasoningEffort,
    executorReasoningEffort: pair?.executorReasoningEffort
  }))

  const queuedForNextTask = useMemo(
    () => Boolean(pair?.pendingMentorModel || pair?.pendingExecutorModel),
    [pair]
  )

  if (!pair) return null

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()

    try {
      await updatePairModels(pair.id, selection)
      onClose()
    } catch {
      // Store already holds the user-facing error
    }
  }

  return (
    <GlassModal
      isOpen={isOpen}
      onClose={onClose}
      title={`Pair Defaults · ${pair.name}`}
      className="max-w-3xl"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="glass-card rounded-2xl p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-muted/60">
              <SlidersHorizontal size={16} className="text-foreground/70" />
            </div>
            <div className="space-y-1">
              <div className="text-sm font-semibold text-foreground">
                Default models for future tasks
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Change the mentor and executor defaults without recreating the pair. Running work is
                left untouched; new settings apply to the next task run.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <ModelPicker
            value={selection.mentorModel}
            models={availableModels}
            onChange={(mentorModel) => setSelection((current) => ({ ...current, mentorModel }))}
            role="mentor"
            variant="card"
            reasoningEffort={selection.mentorReasoningEffort}
            onReasoningEffortChange={(mentorReasoningEffort) =>
              setSelection((current) => ({ ...current, mentorReasoningEffort }))
            }
          />
          <ModelPicker
            value={selection.executorModel}
            models={availableModels}
            onChange={(executorModel) => setSelection((current) => ({ ...current, executorModel }))}
            role="executor"
            variant="card"
            reasoningEffort={selection.executorReasoningEffort}
            onReasoningEffortChange={(executorReasoningEffort) =>
              setSelection((current) => ({ ...current, executorReasoningEffort }))
            }
          />
        </div>

        {(isPairActive(pair.status) || queuedForNextTask) && (
          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
            {queuedForNextTask
              ? 'A model update is already queued for the next task.'
              : 'This pair is running right now, so saved changes will queue for the next task.'}
          </div>
        )}

        {error && (
          <div className="rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-3">
          <GlassButton
            type="button"
            variant="ghost"
            onClick={onClose}
            data-testid="settings-cancel-btn"
          >
            Cancel
          </GlassButton>
          <GlassButton
            type="submit"
            variant="primary"
            disabled={isLoading || !selection.mentorModel || !selection.executorModel}
            data-testid="settings-save-btn"
          >
            {isLoading ? 'Saving...' : 'Save Defaults'}
          </GlassButton>
        </div>
      </form>
    </GlassModal>
  )
}

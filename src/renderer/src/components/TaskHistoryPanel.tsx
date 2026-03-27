import React from 'react'
import { History, RotateCcw } from 'lucide-react'
import { cn } from '../lib/utils'
import {
  getVerificationSummaryChip,
  type VerificationSummaryTone
} from '../lib/verificationGate'
import { GlassButton } from './ui/GlassButton'
import type { PairRunSummary } from '../store/usePairStore'

interface TaskHistoryPanelProps {
  runHistory: PairRunSummary[]
  viewingRunId: string | null
  onSelectTask: (runId: string) => void
  onBackToCurrent: () => void
  onRestoreTask: (run: PairRunSummary) => void
}

function formatDate(ts: number): string {
  const d = new Date(ts)
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}

function getDuration(startedAt: number, finishedAt?: number): string {
  const end = finishedAt ?? Date.now()
  const seconds = Math.floor((end - startedAt) / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`
  const hours = Math.floor(minutes / 60)
  return `${hours}h ${minutes % 60}m`
}

const verificationToneClasses: Record<VerificationSummaryTone, string> = {
  neutral: 'border-border/50 bg-background/50 text-muted-foreground',
  blue: 'border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-300',
  amber: 'border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  green: 'border-green-500/20 bg-green-500/10 text-green-700 dark:text-green-300',
  red: 'border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-300'
}

export function TaskHistoryPanel({
  runHistory,
  viewingRunId,
  onSelectTask,
  onBackToCurrent,
  onRestoreTask
}: TaskHistoryPanelProps): React.ReactNode {
  if (runHistory.length === 0) {
    return (
      <div>
        <h3 className="mb-3 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          <History size={12} />
          Task History
        </h3>
        <div className="glass-card rounded-2xl p-4">
          <p className="text-[11px] text-muted-foreground/60">No previous tasks yet.</p>
        </div>
      </div>
    )
  }

  const sorted = [...runHistory].reverse()

  return (
    <div>
      <h3 className="mb-3 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        <History size={12} />
        Task History
        {viewingRunId && (
          <span className="ml-auto">
            <GlassButton
              variant="ghost"
              size="sm"
              onClick={onBackToCurrent}
              className="h-6 px-2 text-[9px]"
            >
              Back to Current
            </GlassButton>
          </span>
        )}
      </h3>
      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="max-h-[320px] overflow-y-auto scrollbar-thin">
          {sorted.map((run, idx) => {
            const isViewing = viewingRunId === run.id
            const duration = getDuration(run.startedAt, run.finishedAt)
            const modelShort = (model: string) => model.split('/').pop() ?? model
            const verificationSummary = getVerificationSummaryChip(run.verification)

            return (
              <div
                key={run.id}
                className={cn(
                  'group relative border-b border-border/30 last:border-b-0 transition-all duration-200',
                  isViewing ? 'bg-primary/5' : 'hover:bg-background/40'
                )}
              >
                <button
                  className="w-full text-left p-3 cursor-pointer"
                  onClick={() => onSelectTask(run.id)}
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-[10px] font-mono text-muted-foreground/50 shrink-0">
                        #{runHistory.length - idx}
                      </span>
                    </div>
                    <span className="text-[9px] font-mono text-muted-foreground/50 shrink-0">
                      {duration}
                    </span>
                  </div>
                  <p
                    className="text-[11px] leading-relaxed text-foreground/80 line-clamp-2 group-hover:line-clamp-3 transition-all"
                    title={run.spec}
                  >
                    {run.spec}
                  </p>
                  <div className="mt-1.5 flex items-center gap-2 text-[9px] text-muted-foreground/50">
                    <span className="text-blue-500/70 font-medium">
                      {modelShort(run.mentorModel)}
                    </span>
                    <span>/</span>
                    <span className="text-purple-500/70 font-medium">
                      {modelShort(run.executorModel)}
                    </span>
                    {verificationSummary ? (
                      <span
                        className={cn(
                          'max-w-[180px] truncate rounded-full border px-2 py-0.5 font-medium',
                          verificationToneClasses[verificationSummary.tone]
                        )}
                        title={verificationSummary.text}
                      >
                        {verificationSummary.text}
                      </span>
                    ) : null}
                    <span className="ml-auto">{formatDate(run.startedAt)}</span>
                  </div>
                </button>

                <div
                  className={cn(
                    'absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity',
                    isViewing && 'opacity-100'
                  )}
                >
                  <GlassButton
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      onRestoreTask(run)
                    }}
                    icon={<RotateCcw size={9} />}
                    className="h-6 w-6 min-w-0 p-0 px-1.5 [&]:text-[9px]"
                  >
                    {' '}
                  </GlassButton>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

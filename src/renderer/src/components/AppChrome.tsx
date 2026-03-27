import React, { useState, useEffect } from 'react'
import { ChevronLeft, Moon, Plus, Settings2, Sun, WandSparkles } from 'lucide-react'
import { Pair } from '../store/usePairStore'
import { StatusBadge } from './StatusBadge'
import { GlassButton } from './ui/GlassButton'
import { UpdateControls } from './UpdateControls'
import { cn } from '../lib/utils'
import { getVerificationSummaryChip } from '../lib/verificationGate'

interface AppChromeProps {
  selectedPair?: Pair | null
  readyModelCount: number
  totalModelCount: number
  theme: 'light' | 'dark'
  onToggleTheme: () => void
  onNewPair: () => void
  onBack?: () => void
  onAssignTask?: () => void
  onOpenSettings?: () => void
}

function isBusy(status: Pair['status']): boolean {
  return (
    status === 'Mentoring' ||
    status === 'Executing' ||
    status === 'Reviewing' ||
    status === 'Awaiting Human Review'
  )
}

export function AppChrome({
  selectedPair,
  readyModelCount,
  totalModelCount,
  theme,
  onToggleTheme,
  onNewPair,
  onBack,
  onAssignTask,
  onOpenSettings
}: AppChromeProps): React.ReactNode {
  const pairBusy = selectedPair ? isBusy(selectedPair.status) : false
  const verificationSummary = selectedPair
    ? getVerificationSummaryChip(selectedPair.verification)
    : null

  const [appVersion, setAppVersion] = useState<string | null>(null)

  const verificationToneClasses = {
    neutral: 'border-border/50 bg-background/50 text-muted-foreground',
    blue: 'border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-300',
    amber: 'border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300',
    green: 'border-green-500/20 bg-green-500/10 text-green-700 dark:text-green-300',
    red: 'border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-300'
  } satisfies Record<NonNullable<typeof verificationSummary>['tone'], string>

  useEffect(() => {
    window.api?.config
      ?.getVersion?.()
      .then((v: string) => {
        setAppVersion(v)
      })
      .catch((e: Error) => {
        console.error('[AppChrome] getVersion error:', e)
      })
  }, [])

  return (
    <div className="app-chrome glass-toolbar relative shrink-0 border-b border-border/60">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-foreground/12 to-transparent" />
      <div className="app-drag relative flex items-center justify-between gap-4 px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          {selectedPair ? (
            <button
              onClick={onBack}
              className="app-no-drag flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-muted/50 text-muted-foreground transition-all hover:bg-muted hover:text-foreground"
            >
              <ChevronLeft size={18} />
            </button>
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-gradient-to-br from-background via-muted/70 to-background shadow-sm">
              <span className="text-[10px] font-black tracking-[0.22em] text-foreground/70">
                TP
              </span>
            </div>
          )}

          <div className="min-w-0 flex flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-sm font-semibold tracking-tight text-foreground">
                {selectedPair ? selectedPair.name : 'The Pair'}
              </h1>
              <span className="rounded bg-blue-500 px-2 py-0.5 text-xs font-bold text-white">
                v{appVersion ?? '...'}
              </span>
              {selectedPair ? <StatusBadge status={selectedPair.status} /> : null}
              {verificationSummary ? (
                <span
                  className={cn(
                    'max-w-[240px] truncate rounded-full border px-2 py-1 text-[10px] font-medium',
                    verificationToneClasses[verificationSummary.tone]
                  )}
                  title={verificationSummary.text}
                >
                  {verificationSummary.text}
                </span>
              ) : null}
              {selectedPair?.pendingMentorModel || selectedPair?.pendingExecutorModel ? (
                <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-amber-700 dark:text-amber-300">
                  Models queued
                </span>
              ) : null}
            </div>
            <p className="truncate text-xs text-muted-foreground">
              {selectedPair
                ? selectedPair.spec || selectedPair.directory
                : `${readyModelCount}/${totalModelCount} detected models are ready for pair execution`}
            </p>
          </div>
        </div>

        <div className="app-no-drag flex shrink-0 items-center gap-2">
          {!selectedPair ? <UpdateControls /> : null}

          {selectedPair && (
            <>
              <GlassButton
                variant="secondary"
                size="sm"
                onClick={onOpenSettings}
                icon={<Settings2 size={13} />}
              >
                Models
              </GlassButton>
              <GlassButton
                variant="primary"
                size="sm"
                onClick={onAssignTask}
                disabled={pairBusy}
                icon={<WandSparkles size={13} />}
              >
                New Task
              </GlassButton>
            </>
          )}

          <button
            onClick={onToggleTheme}
            className="flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-muted/40 text-muted-foreground transition-all hover:bg-muted hover:text-foreground"
            title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
          >
            {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
          </button>

          <GlassButton variant="secondary" size="sm" onClick={onNewPair} icon={<Plus size={13} />}>
            New Pair
          </GlassButton>
        </div>
      </div>
    </div>
  )
}

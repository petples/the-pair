import React from 'react'
import { Clock3, FolderOpen, RotateCcw, Sparkles, Zap } from 'lucide-react'
import { cn } from '../lib/utils'
import type { RecoverableSessionSummary } from '../types'
import { StatusBadge } from './StatusBadge'
import { GlassButton } from './ui/GlassButton'
import { GlassModal } from './ui/GlassModal'

interface SessionRecoveryModalProps {
  sessions: RecoverableSessionSummary[]
  isOpen: boolean
  isRestoring: boolean
  onRestore: (pairId: string, continueRun: boolean) => void | Promise<void>
  onDismiss: () => void
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleString()
}

function SessionCard({
  session,
  onRestore,
  isRestoring
}: {
  session: RecoverableSessionSummary
  onRestore: (pairId: string, continueRun: boolean) => void | Promise<void>
  isRestoring: boolean
}): React.ReactNode {
  const isMentor = session.turn === 'mentor'
  const canResume = session.status !== 'Finished'

  return (
    <div className="rounded-2xl border border-border/70 bg-background/60 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-2">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-base font-semibold text-foreground">{session.name}</h3>
            <StatusBadge status={session.status} />
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-muted/30 px-2 py-1">
              <FolderOpen size={11} />
              <span className="truncate max-w-[240px]">{session.directory}</span>
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-muted/30 px-2 py-1">
              <Clock3 size={11} />
              <span>{formatTime(session.savedAt)}</span>
            </span>
          </div>
        </div>
        <div
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border',
            isMentor
              ? 'border-blue-500/25 bg-blue-500/10 text-blue-600 dark:text-blue-400'
              : 'border-purple-500/25 bg-purple-500/10 text-purple-600 dark:text-purple-400'
          )}
        >
          {isMentor ? <Sparkles size={15} /> : <Zap size={15} />}
        </div>
      </div>

      <div className="mt-4 grid gap-2 text-sm text-muted-foreground md:grid-cols-2">
        <div className="rounded-xl border border-border/60 bg-muted/20 px-3 py-2">
          <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Current turn
          </div>
          <div className="mt-1 font-medium text-foreground">{session.turn}</div>
        </div>
        <div className="rounded-xl border border-border/60 bg-muted/20 px-3 py-2">
          <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Models
          </div>
          <div className="mt-1 truncate font-mono text-xs text-foreground">
            {session.mentorModel.split('/').pop()} / {session.executorModel.split('/').pop()}
          </div>
        </div>
      </div>

      <div className="mt-3 text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
        {session.currentTurnCard?.content || session.spec}
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
          <span className="rounded-full border border-border/60 bg-muted/30 px-2 py-1">
            Runs {session.runCount}
          </span>
          {session.hasMentorSession && (
            <span className="rounded-full border border-blue-500/20 bg-blue-500/10 px-2 py-1 text-blue-700 dark:text-blue-300">
              Mentor session saved
            </span>
          )}
          {session.hasExecutorSession && (
            <span className="rounded-full border border-purple-500/20 bg-purple-500/10 px-2 py-1 text-purple-700 dark:text-purple-300">
              Executor session saved
            </span>
          )}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <GlassButton
            variant="ghost"
            size="sm"
            onClick={() => void onRestore(session.pairId, false)}
            disabled={isRestoring}
          >
            Restore history
          </GlassButton>
          <GlassButton
            variant="primary"
            size="sm"
            onClick={() => void onRestore(session.pairId, true)}
            disabled={isRestoring || !canResume}
            icon={<RotateCcw size={13} />}
          >
            Resume execution
          </GlassButton>
        </div>
      </div>
    </div>
  )
}

export function SessionRecoveryModal({
  sessions,
  isOpen,
  isRestoring,
  onRestore,
  onDismiss
}: SessionRecoveryModalProps): React.ReactNode {
  if (!isOpen || sessions.length === 0) return null

  return (
    <GlassModal
      isOpen={isOpen}
      onClose={onDismiss}
      title="Recover Unfinished Sessions"
      className="max-w-4xl"
    >
      <div className="space-y-4">
        <p className="text-sm leading-relaxed text-muted-foreground">
          The app found session records from a previous run. Restore history to inspect the saved
          messages and state, or explicitly resume execution if you want the agents to keep going.
        </p>

        <div className="max-h-[62vh] space-y-3 overflow-y-auto pr-1 scrollbar-thin">
          {sessions.map((session) => (
            <SessionCard
              key={session.pairId}
              session={session}
              onRestore={onRestore}
              isRestoring={isRestoring}
            />
          ))}
        </div>

        <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-between">
          <GlassButton variant="ghost" onClick={onDismiss}>
            Start fresh
          </GlassButton>
          <div className="text-xs leading-relaxed text-muted-foreground sm:text-right">
            Dismissing keeps the snapshots on disk for the next launch.
          </div>
        </div>
      </div>
    </GlassModal>
  )
}

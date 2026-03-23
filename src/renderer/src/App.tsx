import React, { useEffect, useState } from 'react'
import { Terminal, RefreshCw, Square, RotateCcw, Zap } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from './lib/utils'
import { usePairStore, Pair, Message } from './store/usePairStore'
import { useThemeStore } from './store/useThemeStore'
import { CreatePairModal } from './components/CreatePairModal'
import { StatusBadge } from './components/StatusBadge'
import { OnboardingWizard } from './components/OnboardingWizard'
import { GlassCard } from './components/ui/GlassCard'
import { GlassButton } from './components/ui/GlassButton'
import { ResourceMeter } from './components/ui/ResourceMeter'
import { fadeInUp, staggerContainer } from './lib/animations'
import { AppChrome } from './components/AppChrome'
import { AssignTaskModal } from './components/AssignTaskModal'
import { PairSettingsModal } from './components/PairSettingsModal'

function isPairRunning(status: Pair['status']): boolean {
  return status === 'Mentoring' || status === 'Executing' || status === 'Reviewing'
}

function Dashboard({ onSelectPair }: { onSelectPair: (p: Pair) => void }): React.ReactNode {
  const pairs = usePairStore((state) => state.pairs)

  const getPairGlow = (status: string): 'blue' | 'purple' | 'green' | 'amber' | 'none' => {
    if (status === 'Mentoring') return 'blue'
    if (status === 'Executing') return 'purple'
    if (status === 'Reviewing') return 'amber'
    if (status === 'Awaiting Human Review') return 'amber'
    if (status === 'Finished') return 'green'
    return 'none'
  }

  return (
    <div className="relative h-full overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-background via-muted/15 to-background" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.08),transparent_32%),radial-gradient(circle_at_top_right,rgba(168,85,247,0.08),transparent_30%)]" />
      <div className="relative z-10 flex h-full flex-col p-8">
        <div className="mb-8 flex items-end justify-between gap-6">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">
              Pair Containers
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Each pair keeps its workspace, defaults, and task history. Open one to continue work,
              queue a new task, or swap mentor and executor defaults without recreating the setup.
            </p>
          </div>
          <div className="hidden rounded-2xl border border-border bg-background/60 px-4 py-3 text-right shadow-sm lg:block">
            <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
              Active Containers
            </div>
            <div className="mt-1 text-2xl font-semibold text-foreground">{pairs.length}</div>
          </div>
        </div>

        <motion.div
          className="grid flex-1 grid-cols-1 gap-5 overflow-y-auto scrollbar-thin md:grid-cols-2 xl:grid-cols-3"
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
        >
          <AnimatePresence>
            {pairs.map((pair) => (
              <motion.div
                key={pair.id}
                variants={fadeInUp}
                initial="hidden"
                animate="visible"
                exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
                layout
              >
                <GlassCard
                  hoverable
                  onClick={() => onSelectPair(pair)}
                  glow={getPairGlow(pair.status)}
                  className="flex min-h-[220px] flex-col gap-4 p-5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-base font-semibold leading-tight text-foreground">
                        {pair.name}
                      </h3>
                      <p
                        className="mt-1 truncate font-mono text-xs text-muted-foreground"
                        title={pair.directory}
                      >
                        {pair.directory}
                      </p>
                    </div>
                    <div className="shrink-0">
                      <StatusBadge status={pair.status} />
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full border border-border bg-muted/40 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                      Run {pair.runCount}
                    </span>
                    <span className="rounded-full border border-border bg-muted/40 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                      {pair.runHistory.length} archived
                    </span>
                    {!isPairRunning(pair.status) && (
                      <span className="rounded-full border border-green-500/20 bg-green-500/10 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-green-700 dark:text-green-300">
                        Ready for new task
                      </span>
                    )}
                    {(pair.pendingMentorModel || pair.pendingExecutorModel) && (
                      <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-amber-700 dark:text-amber-300">
                        Models queued
                      </span>
                    )}
                  </div>

                  <div className="flex-1 text-sm leading-relaxed text-muted-foreground">
                    {pair.spec}
                  </div>

                  <div className="mt-auto space-y-3 border-t border-border/50 pt-4">
                    <ResourceMeter cpu={pair.cpuUsage} mem={pair.memUsage} />
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
                        <RefreshCw
                          size={12}
                          className={cn(
                            pair.status === 'Executing' || pair.status === 'Mentoring'
                              ? 'animate-spin text-blue-500'
                              : 'text-muted-foreground/50'
                          )}
                        />
                        <span>
                          iter {pair.iterations}/{pair.maxIterations}
                        </span>
                      </div>
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="text-[10px] font-medium text-blue-600">MENTOR</span>
                        <span className="truncate font-mono text-[10px] text-muted-foreground">
                          {(pair.pendingMentorModel ?? pair.mentorModel).split('/').pop()}
                        </span>
                        <span className="text-[10px] font-medium text-purple-600">EXEC</span>
                        <span className="truncate font-mono text-[10px] text-muted-foreground">
                          {(pair.pendingExecutorModel ?? pair.executorModel).split('/').pop()}
                        </span>
                      </div>
                    </div>
                  </div>
                </GlassCard>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  )
}

function PairDetail({ pair, onStop }: { pair: Pair; onStop: () => void }): React.ReactNode {
  const retryTurn = usePairStore((s) => s.retryTurn)

  const handleRetryTurn = (): void => {
    retryTurn(pair.id)
  }

  const formatTime = (ts: number): string => {
    const d = new Date(ts)
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`
  }

  const formatRunStamp = (ts?: number): string => {
    if (!ts) return 'still active'
    const d = new Date(ts)
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
  }

  const getMessageColor = (msg: Message): string => {
    if (msg.from === 'human') return 'text-green-600 dark:text-green-400'
    if (msg.from === 'mentor') return 'text-blue-600 dark:text-blue-400'
    return 'text-purple-600 dark:text-purple-400'
  }

  const getTypeLabel = (msg: Message): string => {
    const labels: Record<string, string> = {
      plan: '[PLAN]',
      feedback: '[FEEDBACK]',
      progress: '[PROGRESS]',
      result: '[RESULT]',
      question: '[QUESTION]',
      handoff: '[HANDOFF]'
    }
    return labels[msg.type] || `[${msg.type.toUpperCase()}]`
  }

  const getActivityIcon = (phase: string): string => {
    switch (phase) {
      case 'thinking':
        return '🤔'
      case 'using_tools':
        return '🔧'
      case 'responding':
        return '✍️'
      case 'waiting':
        return '⏳'
      case 'error':
        return '❌'
      default:
        return '💤'
    }
  }

  const getDuration = (startedAt: number, updatedAt: number): string => {
    const seconds = Math.floor((updatedAt - startedAt) / 1000)
    if (seconds < 60) return `${seconds}s`
    const minutes = Math.floor(seconds / 60)
    return `${minutes}m ${seconds % 60}s`
  }

  const activeRole = pair.turn
  const isRunning = isPairRunning(pair.status)

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-1 overflow-hidden bg-background">
        <div className="glass-panel flex w-[28%] flex-col gap-5 overflow-y-auto border-r border-border/50 p-5 scrollbar-thin">
          <div className="flex flex-wrap items-center gap-2">
            <GlassButton variant="secondary" size="sm" icon={<Square size={12} />} onClick={onStop}>
              Stop Pair
            </GlassButton>
            {pair.status === 'Error' && (
              <GlassButton
                variant="primary"
                size="sm"
                icon={<RotateCcw size={12} />}
                onClick={handleRetryTurn}
              >
                Retry Turn
              </GlassButton>
            )}
            {pair.automationMode === 'full-auto' && (
              <div className="flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-1 text-[10px] text-amber-600 dark:text-amber-400">
                <Zap size={10} />
                <span>Full Auto</span>
              </div>
            )}
          </div>

          <div>
            <h3 className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Current Task
            </h3>
            <div className="glass-card rounded-2xl p-4">
              <p className="text-sm leading-relaxed text-foreground">{pair.spec}</p>
            </div>
          </div>

          <div>
            <h3 className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Models
            </h3>
            <div className="glass-card rounded-2xl p-4 space-y-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                  <span className="text-[10px] font-medium uppercase text-blue-600">Mentor</span>
                </div>
                <p className="pl-4 font-mono text-xs text-muted-foreground">{pair.mentorModel}</p>
                {pair.pendingMentorModel && (
                  <p className="pl-4 text-[11px] text-amber-700 dark:text-amber-300">
                    Next task: {pair.pendingMentorModel}
                  </p>
                )}
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-purple-500" />
                  <span className="text-[10px] font-medium uppercase text-purple-600">
                    Executor
                  </span>
                </div>
                <p className="pl-4 font-mono text-xs text-muted-foreground">{pair.executorModel}</p>
                {pair.pendingExecutorModel && (
                  <p className="pl-4 text-[11px] text-amber-700 dark:text-amber-300">
                    Next task: {pair.pendingExecutorModel}
                  </p>
                )}
              </div>
              {(pair.pendingMentorModel || pair.pendingExecutorModel) && (
                <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-700 dark:text-amber-300">
                  Saved model changes are queued and will apply when you start the next task run.
                </div>
              )}
            </div>
          </div>

          <div>
            <h3 className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Run Progress
            </h3>
            <div className="glass-card rounded-2xl p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Run {pair.runCount}</span>
                <span className="font-mono text-xs text-foreground">
                  {pair.iterations}/{pair.maxIterations}
                </span>
              </div>
              <div className="h-1 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-500"
                  style={{ width: `${(pair.iterations / pair.maxIterations) * 100}%` }}
                />
              </div>
              <div className="mt-3 text-[11px] text-muted-foreground">
                Started {formatRunStamp(pair.currentRunStartedAt)} ·{' '}
                {pair.currentRunFinishedAt
                  ? `Finished ${formatRunStamp(pair.currentRunFinishedAt)}`
                  : 'Still running'}
              </div>
            </div>
          </div>

          <div>
            <h3 className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Task Runs
            </h3>
            <div className="glass-card rounded-2xl p-4 space-y-3">
              <div className="rounded-2xl border border-border/60 bg-background/40 px-3 py-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-medium text-foreground">Current Run</span>
                  <StatusBadge status={pair.status} />
                </div>
                <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-muted-foreground">
                  {pair.spec}
                </p>
              </div>

              {pair.runHistory.length === 0 ? (
                <div className="text-xs text-muted-foreground/70">
                  No archived runs yet. When you assign the next task, the current run will be saved
                  here.
                </div>
              ) : (
                <div className="space-y-2">
                  {pair.runHistory
                    .slice()
                    .reverse()
                    .map((run) => (
                      <div
                        key={run.id}
                        className="rounded-2xl border border-border/60 bg-background/30 px-3 py-3"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-xs font-medium text-foreground">{run.status}</span>
                          <span className="font-mono text-[11px] text-muted-foreground">
                            iter {run.iterations}
                          </span>
                        </div>
                        <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                          {run.spec}
                        </p>
                        <div className="mt-2 text-[11px] text-muted-foreground">
                          {formatRunStamp(run.startedAt)} → {formatRunStamp(run.finishedAt)}
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex w-[46%] flex-col bg-muted/10">
          <div className="flex h-10 shrink-0 items-center gap-2 border-b border-border/50 px-4 font-mono text-[11px] text-muted-foreground">
            <Terminal size={13} />
            <span>Console</span>
            <div className="ml-auto flex items-center gap-3">
              <span className="text-muted-foreground/50">
                iter {pair.iterations}/{pair.maxIterations}
              </span>
            </div>
          </div>
          <div className="flex h-12 shrink-0 items-center gap-4 border-b border-border/30 bg-muted/5 px-4">
            <div
              className={cn(
                'flex items-center gap-2 text-xs transition-all',
                activeRole === 'mentor'
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-muted-foreground/50'
              )}
            >
              <div
                className={cn(
                  'h-1.5 w-1.5 rounded-full',
                  pair.mentorActivity.phase === 'thinking' ||
                    pair.mentorActivity.phase === 'using_tools' ||
                    pair.mentorActivity.phase === 'responding'
                    ? 'animate-pulse bg-blue-500'
                    : pair.mentorActivity.phase === 'error'
                      ? 'bg-red-500'
                      : 'bg-blue-500/50'
                )}
              />
              <span className="font-medium">MENTOR</span>
              <span className="text-[10px]">{getActivityIcon(pair.mentorActivity.phase)}</span>
              <span className="max-w-[120px] truncate text-[10px]">
                {pair.mentorActivity.label}
              </span>
              {isRunning && activeRole === 'mentor' && (
                <span className="text-[9px] text-muted-foreground/50">
                  {getDuration(pair.mentorActivity.startedAt, pair.mentorActivity.updatedAt)}
                </span>
              )}
            </div>
            <div className="h-4 w-px bg-border/50" />
            <div
              className={cn(
                'flex items-center gap-2 text-xs transition-all',
                activeRole === 'executor'
                  ? 'text-purple-600 dark:text-purple-400'
                  : 'text-muted-foreground/50'
              )}
            >
              <div
                className={cn(
                  'h-1.5 w-1.5 rounded-full',
                  pair.executorActivity.phase === 'thinking' ||
                    pair.executorActivity.phase === 'using_tools' ||
                    pair.executorActivity.phase === 'responding'
                    ? 'animate-pulse bg-purple-500'
                    : pair.executorActivity.phase === 'error'
                      ? 'bg-red-500'
                      : 'bg-purple-500/50'
                )}
              />
              <span className="font-medium">EXECUTOR</span>
              <span className="text-[10px]">{getActivityIcon(pair.executorActivity.phase)}</span>
              <span className="max-w-[120px] truncate text-[10px]">
                {pair.executorActivity.label}
              </span>
              {isRunning && activeRole === 'executor' && (
                <span className="text-[9px] text-muted-foreground/50">
                  {getDuration(pair.executorActivity.startedAt, pair.executorActivity.updatedAt)}
                </span>
              )}
            </div>
          </div>
          <div className="flex-1 space-y-1 overflow-y-auto p-4 font-mono text-[13px] scrollbar-thin">
            {pair.messages.length === 0 ? (
              <>
                <div className="mb-3 text-muted-foreground/60">
                  <span className="text-muted-foreground/30">$</span> Fresh run initialized —
                  awaiting agent handoff
                </div>
                <div className="text-blue-600 dark:text-blue-400">
                  <span className="mr-2 text-muted-foreground/30">→</span>
                  <span>[Mentor]</span>
                  <span className="ml-2 text-muted-foreground">Preparing first instruction...</span>
                </div>
                <div className="text-purple-600 dark:text-purple-400">
                  <span className="mr-2 text-muted-foreground/30">→</span>
                  <span>[Executor]</span>
                  <span className="ml-2 text-muted-foreground">
                    Standing by for mentor output...
                  </span>
                </div>
              </>
            ) : (
              pair.messages.map((msg) => (
                <div key={msg.id} className={cn('flex items-start gap-2', getMessageColor(msg))}>
                  <span className="mt-0.5 shrink-0 text-muted-foreground/50">
                    {formatTime(msg.timestamp)}
                  </span>
                  <span className="shrink-0">{getTypeLabel(msg)}</span>
                  <span className="shrink-0 text-muted-foreground">[{msg.from.toUpperCase()}]</span>
                  <span className="flex-1 break-words text-foreground">{msg.content}</span>
                </div>
              ))
            )}
            {isRunning && (
              <div
                className={cn(
                  'flex items-start gap-2 animate-pulse',
                  activeRole === 'mentor'
                    ? 'text-blue-600/70 dark:text-blue-400/70'
                    : 'text-purple-600/70 dark:text-purple-400/70'
                )}
              >
                <span className="mt-0.5 shrink-0 text-muted-foreground/50">
                  {formatTime(
                    activeRole === 'mentor'
                      ? pair.mentorActivity.updatedAt
                      : pair.executorActivity.updatedAt
                  )}
                </span>
                <span>[{activeRole === 'mentor' ? 'MENTOR' : 'EXECUTOR'}]</span>
                <span>
                  {getActivityIcon(
                    activeRole === 'mentor'
                      ? pair.mentorActivity.phase
                      : pair.executorActivity.phase
                  )}
                </span>
                <span className="text-muted-foreground/70">
                  {activeRole === 'mentor'
                    ? pair.mentorActivity.label
                    : pair.executorActivity.label}
                  {(() => {
                    const detail =
                      activeRole === 'mentor'
                        ? pair.mentorActivity.detail
                        : pair.executorActivity.detail
                    return (
                      detail && <span className="ml-1 text-muted-foreground/50">({detail})</span>
                    )
                  })()}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="glass-panel flex w-[26%] flex-col gap-5 overflow-y-auto p-5 scrollbar-thin">
          <div>
            <h3 className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              System Resources
            </h3>
            <div className="space-y-3">
              <div className="glass-card rounded-2xl p-3">
                <div className="mb-2 text-[10px] text-muted-foreground">Pair Total</div>
                <ResourceMeter cpu={pair.cpuUsage} mem={pair.memUsage} />
              </div>
              <div className="glass-card rounded-2xl p-3">
                <div className="mb-2 flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                  <span className="text-[10px] font-medium text-blue-600 dark:text-blue-400">
                    MENTOR
                  </span>
                </div>
                <div className="mb-1.5 h-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-blue-500 transition-all"
                    style={{ width: `${Math.min(pair.mentorCpu, 100)}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>CPU: {pair.mentorCpu.toFixed(1)}%</span>
                  <span>MEM: {pair.mentorMemMb}MB</span>
                </div>
              </div>
              <div className="glass-card rounded-2xl p-3">
                <div className="mb-2 flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-purple-500" />
                  <span className="text-[10px] font-medium text-purple-600 dark:text-purple-400">
                    EXECUTOR
                  </span>
                </div>
                <div className="mb-1.5 h-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-purple-500 transition-all"
                    style={{ width: `${Math.min(pair.executorCpu, 100)}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>CPU: {pair.executorCpu.toFixed(1)}%</span>
                  <span>MEM: {pair.executorMemMb}MB</span>
                </div>
              </div>
            </div>
          </div>
          <div className="flex-1">
            <h3 className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Modified Files
            </h3>
            <div className="glass-card rounded-2xl p-3">
              {!pair.gitTracking.available ? (
                <div className="font-mono text-xs text-amber-600/70 dark:text-amber-400/70">
                  Git tracking unavailable for this workspace
                </div>
              ) : pair.modifiedFiles.length === 0 ? (
                <div className="font-mono text-xs text-muted-foreground/60">
                  No files modified in this run yet
                </div>
              ) : (
                <div className="space-y-1">
                  {pair.modifiedFiles.map((file, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-1 truncate font-mono text-xs text-muted-foreground"
                      title={file.path}
                    >
                      <span className="text-purple-500/60">{file.status}</span>
                      <span className="truncate">{file.displayPath}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div>
            <h3 className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Recent Activity
            </h3>
            <div className="glass-card rounded-2xl p-3 space-y-2">
              <div className="flex items-center gap-2 text-xs">
                <div
                  className={cn(
                    'h-1.5 w-1.5 rounded-full',
                    pair.mentorActivity.phase === 'error'
                      ? 'bg-red-500'
                      : pair.mentorActivity.phase !== 'idle'
                        ? 'animate-pulse bg-blue-500'
                        : 'bg-blue-500/50'
                  )}
                />
                <span className="text-muted-foreground/70">MENTOR:</span>
                <span className="truncate text-blue-600 dark:text-blue-400">
                  {pair.mentorActivity.label}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <div
                  className={cn(
                    'h-1.5 w-1.5 rounded-full',
                    pair.executorActivity.phase === 'error'
                      ? 'bg-red-500'
                      : pair.executorActivity.phase !== 'idle'
                        ? 'animate-pulse bg-purple-500'
                        : 'bg-purple-500/50'
                  )}
                />
                <span className="text-muted-foreground/70">EXEC:</span>
                <span className="truncate text-purple-600 dark:text-purple-400">
                  {pair.executorActivity.label}
                </span>
              </div>
              {pair.mentorActivity.detail && (
                <div className="truncate pl-4 text-[10px] text-muted-foreground/50">
                  {pair.mentorActivity.detail}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function App(): React.ReactNode {
  const [selectedPairId, setSelectedPairId] = useState<string | null>(null)
  const [isCreatePairOpen, setIsCreatePairOpen] = useState(false)
  const [isAssignTaskOpen, setIsAssignTaskOpen] = useState(false)
  const [isPairSettingsOpen, setIsPairSettingsOpen] = useState(false)

  const pairs = usePairStore((state) => state.pairs)
  const availableModels = usePairStore((state) => state.availableModels)
  const loadAvailableModels = usePairStore((state) => state.loadAvailableModels)
  const initMessageListener = usePairStore((state) => state.initMessageListener)
  const removePair = usePairStore((state) => state.removePair)

  const theme = useThemeStore((state) => state.theme)
  const toggleTheme = useThemeStore((state) => state.toggleTheme)

  useEffect(() => {
    loadAvailableModels()
    initMessageListener()
  }, [loadAvailableModels, initMessageListener])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])

  const selectedPair = pairs.find((p) => p.id === selectedPairId) ?? null
  const readyModelCount = availableModels.filter((model) => model.available).length
  const showOnboarding = pairs.length === 0

  const handleStopSelectedPair = (): void => {
    if (!selectedPair) return
    removePair(selectedPair.id)
    setSelectedPairId(null)
    setIsAssignTaskOpen(false)
    setIsPairSettingsOpen(false)
  }

  if (showOnboarding) {
    return (
      <div className="h-screen w-screen overflow-hidden bg-background font-sans text-foreground selection:bg-primary selection:text-primary-foreground grain-overlay">
        <OnboardingWizard onComplete={() => {}} />
      </div>
    )
  }

  return (
    <div className="h-screen w-screen overflow-hidden bg-background font-sans text-foreground selection:bg-primary selection:text-primary-foreground grain-overlay">
      <div className="flex h-full flex-col">
        <AppChrome
          selectedPair={selectedPair}
          readyModelCount={readyModelCount}
          totalModelCount={availableModels.length}
          theme={theme}
          onToggleTheme={toggleTheme}
          onNewPair={() => setIsCreatePairOpen(true)}
          onBack={selectedPair ? () => setSelectedPairId(null) : undefined}
          onAssignTask={selectedPair ? () => setIsAssignTaskOpen(true) : undefined}
          onOpenSettings={selectedPair ? () => setIsPairSettingsOpen(true) : undefined}
        />

        <div className="flex-1 overflow-hidden">
          {selectedPair ? (
            <PairDetail pair={selectedPair} onStop={handleStopSelectedPair} />
          ) : (
            <Dashboard onSelectPair={(pair) => setSelectedPairId(pair.id)} />
          )}
        </div>
      </div>

      <CreatePairModal isOpen={isCreatePairOpen} onClose={() => setIsCreatePairOpen(false)} />
      <AssignTaskModal
        key={selectedPair ? `assign-${selectedPair.id}-${String(isAssignTaskOpen)}` : 'assign-none'}
        pair={selectedPair}
        isOpen={isAssignTaskOpen}
        onClose={() => setIsAssignTaskOpen(false)}
      />
      <PairSettingsModal
        key={
          selectedPair
            ? `settings-${selectedPair.id}-${String(isPairSettingsOpen)}`
            : 'settings-none'
        }
        pair={selectedPair}
        isOpen={isPairSettingsOpen}
        onClose={() => setIsPairSettingsOpen(false)}
      />
    </div>
  )
}

export default App

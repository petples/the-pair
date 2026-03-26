import React, { useEffect, useState, useRef, useMemo } from 'react'
import { Pause, RefreshCw, RotateCcw, Terminal, Trash2, Zap } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { cn } from './lib/utils'
import { usePairStore, Pair, Message, TurnCard } from './store/usePairStore'
import { useThemeStore } from './store/useThemeStore'
import { CreatePairModal } from './components/CreatePairModal'
import { StatusBadge } from './components/StatusBadge'
import { TaskHistoryPanel } from './components/TaskHistoryPanel'
import { OnboardingWizard } from './components/OnboardingWizard'
import { SessionRecoveryModal } from './components/SessionRecoveryModal'
import { GlassCard } from './components/ui/GlassCard'
import { GlassButton } from './components/ui/GlassButton'
import { ResourceMeter } from './components/ui/ResourceMeter'
import { fadeInUp, staggerContainer } from './lib/animations'
import { AppChrome } from './components/AppChrome'
import { AssignTaskModal } from './components/AssignTaskModal'
import { PairSettingsModal } from './components/PairSettingsModal'
import { ConfirmModal } from './components/ui/ConfirmModal'
import { isSelectableForPairExecution } from './lib/modelPreferences'

function isPairRunning(status: Pair['status']): boolean {
  const normalized = String(status).toLowerCase()
  return (
    normalized === 'mentoring' ||
    normalized === 'executing' ||
    normalized === 'reviewing' ||
    normalized === 'awaiting human review'
  )
}

function isAgentExecuting(phase: string): boolean {
  return phase === 'thinking' || phase === 'using_tools' || phase === 'responding'
}

function buildConsoleMessages(messages: Message[]): Message[] {
  return messages
}

function useMinimumVisibleText(text: string, resetKey: string, minimumMs = 1200): string {
  const [visibleText, setVisibleText] = useState(text)
  const visibleTextRef = useRef(text)
  const latestTextRef = useRef(text)
  const lastChangeAtRef = useRef(0)
  const timeoutRef = useRef<number | null>(null)

  useEffect(() => {
    latestTextRef.current = text
  }, [text])

  useEffect(() => {
    visibleTextRef.current = latestTextRef.current
    lastChangeAtRef.current = Date.now()
    setVisibleText(latestTextRef.current)

    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }, [resetKey])

  useEffect(
    () => () => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current)
      }
    },
    []
  )

  useEffect(() => {
    if (text === visibleTextRef.current) {
      return
    }

    const commit = () => {
      visibleTextRef.current = text
      lastChangeAtRef.current = Date.now()
      setVisibleText(text)
      timeoutRef.current = null
    }

    const elapsed = Date.now() - lastChangeAtRef.current
    if (elapsed >= minimumMs) {
      commit()
      return
    }

    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current)
    }

    timeoutRef.current = window.setTimeout(commit, minimumMs - elapsed)

    return () => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
    }
  }, [minimumMs, text])

  return visibleText
}

function MarkdownContent({ content }: { content: string }): React.ReactNode {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h1: ({ children }) => <h1 className="text-lg font-bold">{children}</h1>,
        h2: ({ children }) => <h2 className="text-base font-semibold">{children}</h2>,
        h3: ({ children }) => <h3 className="text-sm font-semibold">{children}</h3>,
        p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
        ul: ({ children }) => <ul className="mb-2 list-disc pl-5">{children}</ul>,
        ol: ({ children }) => <ol className="mb-2 list-decimal pl-5">{children}</ol>,
        li: ({ children }) => <li className="mb-1">{children}</li>,
        blockquote: ({ children }) => (
          <blockquote className="my-2 border-l-2 border-border/70 pl-3 italic text-foreground/80">
            {children}
          </blockquote>
        ),
        code: ({ className, children }) => {
          const isBlock = className?.includes('language-')
          if (isBlock) {
            return (
              <code className="block overflow-x-auto rounded-lg border border-border/60 bg-background/70 p-3 font-mono text-[12px] leading-relaxed">
                {children}
              </code>
            )
          }
          return (
            <code className="rounded bg-muted/70 px-1.5 py-0.5 font-mono text-[12px]">
              {children}
            </code>
          )
        },
        pre: ({ children }) => <pre className="my-2 overflow-x-auto">{children}</pre>,
        a: ({ href, children }) => (
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className="text-primary underline decoration-primary/50 underline-offset-2"
          >
            {children}
          </a>
        ),
        table: ({ children }) => (
          <table className="my-2 w-full border-collapse overflow-hidden rounded-lg text-[12px]">
            {children}
          </table>
        ),
        th: ({ children }) => (
          <th className="border border-border/60 bg-muted/50 px-2 py-1 text-left font-semibold">
            {children}
          </th>
        ),
        td: ({ children }) => <td className="border border-border/50 px-2 py-1">{children}</td>
      }}
    >
      {content}
    </ReactMarkdown>
  )
}

function Dashboard({
  onSelectPair,
  onDeletePair,
  deletingPairId
}: {
  onSelectPair: (p: Pair) => void
  onDeletePair: (pair: Pair) => void
  deletingPairId: string | null
}): React.ReactNode {
  const pairs = usePairStore((state) => state.pairs)

  const getPairGlow = (status: string): 'blue' | 'purple' | 'green' | 'amber' | 'none' => {
    if (status === 'Mentoring') return 'blue'
    if (status === 'Executing') return 'purple'
    if (status === 'Reviewing') return 'amber'
    if (status === 'Awaiting Human Review') return 'amber'
    if (status === 'Paused') return 'amber'
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
                className="group"
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
                    <div className="flex shrink-0 items-center gap-2">
                      <StatusBadge status={pair.status} />
                      <GlassButton
                        variant="destructive"
                        size="sm"
                        onClick={(event) => {
                          event.stopPropagation()
                          onDeletePair(pair)
                        }}
                        disabled={deletingPairId === pair.id}
                        icon={<Trash2 size={12} />}
                        className="opacity-0 transition-opacity duration-200 group-hover:opacity-100"
                      >
                        {deletingPairId === pair.id ? 'Deleting...' : 'Delete'}
                      </GlassButton>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full border border-border bg-muted/40 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                      Run {pair.runCount}
                    </span>
                    <span className="rounded-full border border-border bg-muted/40 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                      {pair.runHistory.length} archived
                    </span>
                    {pair.status === 'Paused' ? (
                      <span className="rounded-full border border-slate-500/25 bg-slate-500/10 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-slate-700 dark:text-slate-200">
                        Paused
                      </span>
                    ) : (
                      !isPairRunning(pair.status) && (
                        <span className="rounded-full border border-green-500/20 bg-green-500/10 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-green-700 dark:text-green-300">
                          Ready for new task
                        </span>
                      )
                    )}
                    {(pair.pendingMentorModel || pair.pendingExecutorModel) && (
                      <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-amber-700 dark:text-amber-300">
                        Models queued
                      </span>
                    )}
                  </div>

                  <div className="flex-1 text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
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
                          {pair.currentTurnCard ? `turn ${pair.currentTurnCard.role}` : 'turn idle'}
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

function MessageCard({ msg }: { msg: Message }): React.ReactNode {
  const [isExpanded, setIsExpanded] = useState(false)
  const isSystem = msg.type === 'handoff'
  const isHuman = msg.from === 'human'

  const displayContent = msg.content.trim()

  // Filter out technical handoff messages
  if (!displayContent || displayContent === '{}' || displayContent === '[]') return null

  const isTechnicalHandoff =
    displayContent.includes('### ROLE:') ||
    displayContent.includes('--- COMMAND TO EXECUTE ---') ||
    displayContent.includes('--- REVIEW REQUEST ---')

  if (isTechnicalHandoff && !isHuman) return null

  const formatTime = (ts: number): string => {
    const d = new Date(ts)
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`
  }

  const getRoleColors = (): string => {
    if (isHuman) return 'bg-green-500/10 border-green-500/20 shadow-sm'
    if (msg.from === 'mentor')
      return 'bg-blue-500/10 border-blue-500/20 shadow-[0_4px_12px_rgba(59,130,246,0.06)]'
    return 'bg-purple-500/10 border-purple-500/20 shadow-[0_4px_12px_rgba(168,85,247,0.06)]'
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      className={cn(
        'group flex flex-col gap-3 rounded-2xl border p-5 transition-all duration-300 hover:shadow-xl',
        getRoleColors(),
        isSystem && 'opacity-60 grayscale border-transparent bg-transparent py-2 px-0 shadow-none'
      )}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          {!isSystem && (
            <div
              className={cn(
                'flex items-center justify-center h-7 w-7 rounded-xl text-[11px] font-black text-white shadow-md',
                msg.from === 'mentor'
                  ? 'bg-blue-600'
                  : msg.from === 'executor'
                    ? 'bg-purple-600'
                    : 'bg-green-600'
              )}
            >
              {msg.from[0].toUpperCase()}
            </div>
          )}
          <div className="flex flex-col -space-y-0.5">
            <span
              className={cn(
                'text-[11px] font-black uppercase tracking-[0.1em]',
                msg.from === 'mentor'
                  ? 'text-blue-600'
                  : msg.from === 'executor'
                    ? 'text-purple-600'
                    : 'text-green-600'
              )}
            >
              {msg.from === 'human' ? 'MISSION SPECS' : msg.from}
            </span>
            <span
              className={cn(
                'text-[9px] font-bold tracking-tight opacity-60',
                msg.from === 'mentor'
                  ? 'text-blue-500'
                  : msg.from === 'executor'
                    ? 'text-purple-500'
                    : 'text-green-500'
              )}
            >
              {msg.type.toUpperCase()}
            </span>
          </div>
        </div>
        <span className="text-[10px] font-mono text-muted-foreground/30 tabular-nums">
          {formatTime(msg.timestamp)}
        </span>
      </div>

      <div
        className={cn(
          'relative flex flex-col gap-2 overflow-hidden transition-all duration-300',
          !isExpanded && displayContent.length > 600 && 'max-h-[250px]'
        )}
      >
        <div
          className={cn(
            'break-words leading-relaxed selection:bg-primary/20 [overflow-wrap:anywhere]',
            isSystem
              ? 'text-[12px] italic text-muted-foreground'
              : 'text-[14px] text-foreground/90 font-sans'
          )}
        >
          <MarkdownContent content={displayContent} />
        </div>

        {!isExpanded && displayContent.length > 600 && (
          <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-background/90 to-transparent pointer-events-none" />
        )}
      </div>

      {displayContent.length > 600 && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-fit text-[10px] font-bold uppercase tracking-widest text-primary hover:underline transition-all"
        >
          {isExpanded ? 'Collapse' : 'Expand full report'}
        </button>
      )}
    </motion.div>
  )
}

function TurnCardView({ card }: { card: TurnCard }): React.ReactNode {
  const isMentor = card.role === 'mentor'
  const isLive = card.state === 'live'
  const accent = isMentor ? 'text-blue-500' : 'text-purple-500'
  const borderAccent = isMentor ? 'border-blue-400/30' : 'border-purple-400/30'
  const bg = isMentor ? 'bg-blue-500/6' : 'bg-purple-500/6'
  const currentAction = (
    card.content ||
    card.activity.detail ||
    card.activity.label ||
    'Working...'
  ).trim()

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'relative overflow-hidden rounded-2xl border p-5 shadow-lg',
        borderAccent,
        bg,
        'metal-sheen-surface'
      )}
    >
      <div className="mb-3 flex items-center gap-2">
        <Zap size={14} className={cn(accent, 'drop-shadow-sm')} fill="currentColor" />
        <span className={cn('text-[10px] font-black uppercase tracking-[0.16em]', accent)}>
          {card.role.toUpperCase()}
        </span>
        <span className="text-[9px] font-mono uppercase tracking-[0.18em] text-muted-foreground/70">
          {isLive ? 'working' : 'result'}
        </span>
      </div>
      <div
        className={cn(
          'text-sm leading-relaxed [overflow-wrap:anywhere]',
          isLive ? 'text-foreground/90' : 'text-foreground'
        )}
      >
        <MarkdownContent content={currentAction} />
      </div>
    </motion.div>
  )
}

function PairDetail({
  pair,
  onPause,
  onRestoreTask
}: {
  pair: Pair
  onPause: () => Promise<void>
  onRestoreTask: (spec: string, mentorModel: string, executorModel: string) => void
}): React.ReactNode {
  const retryTurn = usePairStore((s) => s.retryTurn)
  const humanFeedback = usePairStore((s) => s.humanFeedback)
  const isStoreBusy = usePairStore((s) => s.isLoading)
  const viewingRunId = usePairStore((s) => s.viewingRunId)
  const setViewingRunId = usePairStore((s) => s.setViewingRunId)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [isSubmittingReview, setIsSubmittingReview] = useState(false)
  const canPause = isPairRunning(pair.status)

  const handleRetryTurn = (): void => {
    retryTurn(pair.id)
  }

  const handleHumanFeedback = async (approved: boolean): Promise<void> => {
    setIsSubmittingReview(true)
    try {
      await humanFeedback(pair.id, approved)
    } finally {
      setIsSubmittingReview(false)
    }
  }

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [pair.messages.length])

  useEffect(() => {
    if (!isPairRunning(pair.status)) return
    const el = scrollRef.current
    if (!el) return

    const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    if (distanceToBottom < 160) {
      el.scrollTop = el.scrollHeight
    }
  }, [pair.status, pair.messages.length, pair.currentTurnCard?.updatedAt])

  const formatRunStamp = (ts?: number): string => {
    if (!ts) return 'still active'
    const d = new Date(ts)
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
  }

  const runStateText =
    pair.status === 'Paused'
      ? `Paused ${formatRunStamp(pair.currentRunFinishedAt)}`
      : pair.currentRunFinishedAt
        ? `Finished ${formatRunStamp(pair.currentRunFinishedAt)}`
        : 'Still running'

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

  const activeRole = pair.currentTurnCard?.role ?? pair.turn
  const mentorIsExecuting = isAgentExecuting(pair.mentorActivity.phase)
  const executorIsExecuting = isAgentExecuting(pair.executorActivity.phase)
  const isRunning = isPairRunning(pair.status) || mentorIsExecuting || executorIsExecuting
  const consoleMessages = useMemo(() => {
    if (viewingRunId) {
      const run = pair.runHistory.find((r) => r.id === viewingRunId)
      return run ? buildConsoleMessages(run.messages) : []
    }
    return buildConsoleMessages(pair.messages)
  }, [pair.messages, pair.runHistory, viewingRunId])
  const reviewReason =
    pair.status === 'Awaiting Human Review'
      ? (pair.mentorActivity.detail ??
        pair.executorActivity.detail ??
        pair.currentTurnCard?.content ??
        'Awaiting human intervention')
      : null
  const liveStatusText =
    pair.status === 'Awaiting Human Review'
      ? (reviewReason ?? 'Awaiting human intervention')
      : pair.currentTurnCard?.content ||
        (activeRole === 'mentor'
          ? pair.mentorActivity.detail || 'Thinking...'
          : pair.executorActivity.detail || 'Working...')
  const visibleStatusText = useMinimumVisibleText(liveStatusText, pair.id)

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-1 min-h-0 overflow-hidden bg-background">
        <div className="glass-panel flex w-[28%] flex-col gap-5 overflow-y-auto border-r border-border/50 p-5 scrollbar-thin">
          <div className="flex flex-wrap items-center gap-2">
            <GlassButton
              variant="secondary"
              size="sm"
              icon={<Pause size={12} />}
              onClick={() => {
                void onPause()
              }}
              disabled={!canPause || isStoreBusy}
            >
              {pair.status === 'Paused' ? 'Paused' : 'Pause Pair'}
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
            {pair.status === 'Awaiting Human Review' && (
              <>
                <GlassButton
                  variant="approve"
                  size="sm"
                  onClick={() => {
                    void handleHumanFeedback(true)
                  }}
                  disabled={isSubmittingReview || isStoreBusy}
                >
                  Approve
                </GlassButton>
                <GlassButton
                  variant="reject"
                  size="sm"
                  onClick={() => {
                    void handleHumanFeedback(false)
                  }}
                  disabled={isSubmittingReview || isStoreBusy}
                >
                  Reject
                </GlassButton>
              </>
            )}
            {pair.automationMode === 'full-auto' && (
              <div className="flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-1 text-[10px] text-amber-600 dark:text-amber-400">
                <Zap size={10} />
                <span>Full Auto</span>
              </div>
            )}
          </div>
          {pair.status === 'Awaiting Human Review' && (
            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/8 p-3 text-[11px] leading-relaxed text-amber-800 dark:text-amber-200">
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-700/80 dark:text-amber-300/80">
                Pause reason
              </div>
              <div className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
                {reviewReason}
              </div>
            </div>
          )}

          <div>
            <h3 className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Models
            </h3>
            <div className="glass-card rounded-2xl p-4 space-y-3">
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className={cn(
                        'h-1.5 w-1.5 rounded-full bg-blue-500',
                        mentorIsExecuting && 'metal-sheen-mark'
                      )}
                    />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600">
                      Mentor
                    </span>
                  </div>
                  {mentorIsExecuting && (
                    <span className="text-[10px] font-mono text-blue-500 metal-sheen-text">
                      ACTIVE
                    </span>
                  )}
                </div>
                <p className="pl-4 font-mono text-xs text-muted-foreground">{pair.mentorModel}</p>
                {pair.pendingMentorModel && (
                  <p className="pl-4 text-[11px] text-amber-700 dark:text-amber-300">
                    Next task: {pair.pendingMentorModel}
                  </p>
                )}
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className={cn(
                        'h-1.5 w-1.5 rounded-full bg-purple-500',
                        executorIsExecuting && 'metal-sheen-mark'
                      )}
                    />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600">
                      Executor
                    </span>
                  </div>
                  {executorIsExecuting && (
                    <span className="text-[10px] font-mono text-purple-500 metal-sheen-text">
                      ACTIVE
                    </span>
                  )}
                </div>
                <p className="pl-4 font-mono text-xs text-muted-foreground">{pair.executorModel}</p>
                {pair.pendingExecutorModel && (
                  <p className="pl-4 text-[11px] text-amber-700 dark:text-amber-300">
                    Next task: {pair.pendingExecutorModel}
                  </p>
                )}
              </div>
            </div>
          </div>

          <div>
            <h3 className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Run State
            </h3>
            <div className="glass-card rounded-2xl p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">Run {pair.runCount}</span>
                <span className="rounded-full border border-border/50 bg-background/40 px-2 py-1 text-[10px] font-medium text-foreground">
                  {pair.status}
                </span>
              </div>
              <div className="mt-3 text-[11px] text-muted-foreground">
                Started {formatRunStamp(pair.currentRunStartedAt)} · {runStateText}
              </div>
            </div>
          </div>

          <TaskHistoryPanel
            runHistory={pair.runHistory}
            viewingRunId={viewingRunId}
            onSelectTask={(runId) => setViewingRunId(runId)}
            onBackToCurrent={() => setViewingRunId(null)}
            onRestoreTask={(run) => onRestoreTask(run.spec, run.mentorModel, run.executorModel)}
          />
        </div>

        <div className="flex w-[46%] flex-col bg-muted/10">
          <div className="flex h-10 shrink-0 items-center gap-2 border-b border-border/50 px-4 font-mono text-[11px] text-muted-foreground bg-background/50">
            <Terminal size={13} />
            <span className="uppercase tracking-widest font-bold">
              {viewingRunId ? 'Task History' : 'Session Console'}
            </span>
            {viewingRunId && (
              <span className="text-[9px] text-muted-foreground/50 ml-1">
                · viewing archived run
              </span>
            )}
            <div className="ml-auto flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <div
                  className={cn(
                    'h-2 w-2 rounded-full',
                    isRunning ? 'bg-green-500 animate-pulse' : 'bg-muted-foreground/30'
                  )}
                />
                <span className="text-[10px]">{isRunning ? 'SYSTEM ONLINE' : 'SYSTEM IDLE'}</span>
              </div>
            </div>
          </div>

          {/* Active Status Bar */}
          <div className="flex h-14 shrink-0 items-center gap-6 border-b border-border/30 bg-muted/5 px-6">
            <div
              className={cn(
                'flex flex-col gap-0.5 transition-all duration-300',
                activeRole === 'mentor' ? 'opacity-100 scale-100' : 'opacity-40 scale-95 grayscale'
              )}
            >
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 tracking-tighter">
                  MENTOR
                </span>
                <span className={cn('text-xs', mentorIsExecuting && 'metal-sheen-text')}>
                  {getActivityIcon(pair.mentorActivity.phase)}
                </span>
                {mentorIsExecuting && (
                  <span className="text-[9px] font-mono text-muted-foreground/70">
                    {getDuration(pair.mentorActivity.startedAt, pair.mentorActivity.updatedAt)}
                  </span>
                )}
              </div>
              <span
                className={cn(
                  'max-w-[140px] truncate text-[11px] font-medium text-foreground',
                  mentorIsExecuting && 'metal-sheen-text'
                )}
              >
                {pair.mentorActivity.label}
              </span>
            </div>

            <div className="h-6 w-px bg-border/50" />

            <div
              className={cn(
                'flex flex-col gap-0.5 transition-all duration-300',
                activeRole === 'executor'
                  ? 'opacity-100 scale-100'
                  : 'opacity-40 scale-95 grayscale'
              )}
            >
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-purple-600 dark:text-purple-400 tracking-tighter">
                  EXECUTOR
                </span>
                <span className={cn('text-xs', executorIsExecuting && 'metal-sheen-text')}>
                  {getActivityIcon(pair.executorActivity.phase)}
                </span>
                {executorIsExecuting && (
                  <span className="text-[9px] font-mono text-muted-foreground/70">
                    {getDuration(pair.executorActivity.startedAt, pair.executorActivity.updatedAt)}
                  </span>
                )}
              </div>
              <span
                className={cn(
                  'max-w-[140px] truncate text-[11px] font-medium text-foreground',
                  executorIsExecuting && 'metal-sheen-text'
                )}
              >
                {pair.executorActivity.label}
              </span>
            </div>

            <div className="ml-auto flex items-center gap-3">
              {pair.status === 'Awaiting Human Review' && (
                <div className="max-w-[320px] rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-700 dark:text-amber-300">
                  <span className="block truncate">Human review required</span>
                  <span className="mt-1 block truncate text-[9px] font-medium normal-case tracking-normal text-amber-700/80 dark:text-amber-300/80">
                    {visibleStatusText}
                  </span>
                </div>
              )}
              {isRunning && (
                <div className="flex items-center gap-2 rounded-full border border-border/50 bg-background/50 px-3 py-1.5 shadow-sm animate-in fade-in slide-in-from-right-2">
                  <RefreshCw size={12} className="animate-spin text-primary/60" />
                  <span className="text-[10px] font-bold text-muted-foreground truncate max-w-[150px]">
                    {visibleStatusText}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="relative flex min-h-0 flex-1 flex-col bg-background/20">
            <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto scrollbar-thin">
              <div className="flex flex-col gap-4 p-6 pb-36">
                {consoleMessages.length === 0 && !pair.currentTurnCard ? (
                  <div className="flex h-[400px] flex-col items-center justify-center space-y-4 opacity-40">
                    <div className="h-12 w-12 rounded-full border-2 border-dashed border-muted-foreground/30 animate-[spin_10s_linear_infinite]" />
                    <div className="text-center space-y-1">
                      <p className="text-xs font-bold uppercase tracking-[0.2em]">Fresh Session</p>
                      <p className="text-[10px]">Awaiting first agent instruction</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-4">
                    {consoleMessages.map((msg) => (
                      <MessageCard msg={msg} key={msg.id} />
                    ))}
                  </div>
                )}
                {pair.currentTurnCard && (
                  <div className="pt-1">
                    <TurnCardView card={pair.currentTurnCard} />
                  </div>
                )}
              </div>
            </div>
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
                  <span>MEM: {pair.mentorMemMb.toFixed(1)}MB</span>
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
                  <span>MEM: {pair.executorMemMb.toFixed(1)}MB</span>
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

function AppSkeleton(): React.ReactNode {
  return (
    <div className="h-screen w-screen overflow-hidden bg-background font-sans text-foreground selection:bg-primary selection:text-primary-foreground grain-overlay">
      {/* Post-hydration skeleton.
          If the loading state shown after React mounts needs changing, edit this component.
          The very first boot splash lives in src/renderer/index.html. */}
      <div className="flex h-full flex-col">
        {/* Chrome Skeleton */}
        <div className="flex h-12 shrink-0 items-center justify-between border-b border-border/50 bg-background/80 px-4 backdrop-blur-md">
          <div className="flex items-center gap-4">
            <div className="powering-up-emblem flex h-6 w-6 items-center justify-center rounded-lg border border-border/50 bg-slate-950/5 shadow-sm">
              <Zap
                size={14}
                fill="currentColor"
                className="relative z-10 drop-shadow-[0_0_4px_rgba(255,255,255,0.32)]"
              />
            </div>
            <div className="h-4 w-32 animate-pulse rounded-md bg-muted/20" />
          </div>
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 animate-pulse rounded-full bg-muted/30" />
            <div className="h-8 w-24 animate-pulse rounded-full bg-muted/30" />
          </div>
        </div>

        <div className="flex-1 overflow-hidden p-8">
          <div className="mx-auto flex h-full max-w-4xl flex-col justify-center gap-6">
            <div className="space-y-4">
              <div className="h-10 w-64 animate-pulse rounded-lg bg-muted/40" />
              <div className="h-4 w-full max-w-2xl animate-pulse rounded bg-muted/20" />
            </div>

            <div className="rounded-[28px] border border-border/50 bg-muted/5 p-6 shadow-[0_20px_80px_rgba(0,0,0,0.08)]">
              <div className="flex items-center gap-4">
                <div className="powering-up-emblem flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-border/50 bg-slate-950/5">
                  <Zap
                    size={18}
                    fill="currentColor"
                    className="relative z-10 drop-shadow-[0_0_6px_rgba(255,255,255,0.4)]"
                  />
                </div>
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="h-4 w-40 rounded bg-muted/40" />
                  <div className="h-3 w-full rounded bg-muted/20" />
                </div>
              </div>

              <div className="mt-6 space-y-3">
                <div className="h-3 w-full rounded bg-muted/15" />
                <div className="h-3 w-5/6 rounded bg-muted/15" />
                <div className="h-3 w-2/3 rounded bg-muted/15" />
              </div>
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
  const [isInitializing, setIsInitializing] = useState(true)
  const [isRecoveryDismissed, setIsRecoveryDismissed] = useState(false)
  const [isRestoringSession, setIsRestoringSession] = useState(false)
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null)
  const [deletingPairId, setDeletingPairId] = useState<string | null>(null)
  const [pendingDeletePair, setPendingDeletePair] = useState<Pair | null>(null)

  const pairs = usePairStore((state) => state.pairs)
  const availableModels = usePairStore((state) => state.availableModels)
  const recoverableSessions = usePairStore((state) => state.recoverableSessions)
  const loadAvailableModels = usePairStore((state) => state.loadAvailableModels)
  const loadRecoverableSessions = usePairStore((state) => state.loadRecoverableSessions)
  const flushSnapshots = usePairStore((state) => state.flushSnapshots)
  const initMessageListener = usePairStore((state) => state.initMessageListener)
  const restoreSession = usePairStore((state) => state.restoreSession)
  const deleteRecoverableSession = usePairStore((state) => state.deleteRecoverableSession)
  const removeRecoverableSession = usePairStore((state) => state.removeRecoverableSession)
  const pausePair = usePairStore((state) => state.pausePair)
  const deletePair = usePairStore((state) => state.deletePair)
  const setRestoringSpec = usePairStore((state) => state.setRestoringSpec)

  const theme = useThemeStore((state) => state.theme)
  const toggleTheme = useThemeStore((state) => state.toggleTheme)

  useEffect(() => {
    const init = async (): Promise<void> => {
      // Parallel execution but wait for models to finish
      await Promise.all([loadAvailableModels(), initMessageListener(), loadRecoverableSessions()])

      setIsInitializing(false)
    }
    init()
  }, [loadAvailableModels, initMessageListener, loadRecoverableSessions])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])

  useEffect(() => {
    const handleBeforeUnload = (): void => {
      void flushSnapshots()
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [flushSnapshots])

  const selectedPair = pairs.find((p) => p.id === selectedPairId) ?? null
  const readyModelCount = availableModels.filter((model) =>
    isSelectableForPairExecution(model)
  ).length
  const showOnboarding = !isInitializing && pairs.length === 0
  const showRecoveryPrompt =
    !isInitializing && !isRecoveryDismissed && recoverableSessions.length > 0 && pairs.length === 0

  const handlePauseSelectedPair = async (): Promise<void> => {
    if (!selectedPair || !isPairRunning(selectedPair.status)) return

    try {
      await pausePair(selectedPair.id)
    } catch (error) {
      console.error('[App] Failed to pause pair:', error)
    }
  }

  const handleRestoreTask = (spec: string, mentorModel: string, executorModel: string): void => {
    setRestoringSpec({ spec, mentorModel, executorModel })
    setIsAssignTaskOpen(true)
  }

  const handleDeletePair = (pair: Pair): void => {
    setPendingDeletePair(pair)
  }

  const confirmDeletePair = async (): Promise<void> => {
    if (!pendingDeletePair) return
    const pair = pendingDeletePair
    setPendingDeletePair(null)
    setDeletingPairId(pair.id)
    try {
      await deletePair(pair.id)
      if (selectedPairId === pair.id) {
        setSelectedPairId(null)
      }
    } catch (error) {
      console.error('[App] Failed to delete pair:', error)
    } finally {
      setDeletingPairId(null)
    }
  }

  const cancelDeletePair = (): void => {
    setPendingDeletePair(null)
  }

  const handleRestoreSession = async (pairId: string, continueRun: boolean): Promise<void> => {
    setIsRestoringSession(true)
    try {
      await restoreSession(pairId, continueRun)
      setSelectedPairId(pairId)
      setIsRecoveryDismissed(true)
    } catch (error) {
      console.error('[App] Failed to restore session:', error)
    } finally {
      setIsRestoringSession(false)
    }
  }

  const handleDeleteRecoverableSession = async (pairId: string): Promise<void> => {
    const startedAt = Date.now()
    setDeletingSessionId(pairId)
    let deletionSucceeded = false
    try {
      await deleteRecoverableSession(pairId)
      deletionSucceeded = true
    } catch (error) {
      console.error('[App] Failed to delete recoverable session:', error)
    } finally {
      const elapsed = Date.now() - startedAt
      const minimumFeedbackMs = 350
      if (elapsed < minimumFeedbackMs) {
        await new Promise((resolve) => setTimeout(resolve, minimumFeedbackMs - elapsed))
      }
      if (deletionSucceeded) {
        removeRecoverableSession(pairId)
      }
      setDeletingSessionId(null)
    }
  }

  const handleDismissRecovery = (): void => {
    setIsRecoveryDismissed(true)
  }

  if (isInitializing) {
    return <AppSkeleton />
  }

  return (
    <div className="h-screen w-screen overflow-hidden bg-background font-sans text-foreground selection:bg-primary selection:text-primary-foreground grain-overlay">
      {showOnboarding ? (
        <OnboardingWizard onComplete={() => {}} />
      ) : (
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
              <PairDetail
                pair={selectedPair}
                onPause={handlePauseSelectedPair}
                onRestoreTask={handleRestoreTask}
              />
            ) : (
              <Dashboard
                onSelectPair={(pair) => setSelectedPairId(pair.id)}
                onDeletePair={(pair) => {
                  void handleDeletePair(pair)
                }}
                deletingPairId={deletingPairId}
              />
            )}
          </div>
        </div>
      )}

      <SessionRecoveryModal
        sessions={recoverableSessions}
        isOpen={showRecoveryPrompt}
        isRestoring={isRestoringSession}
        deletingPairId={deletingSessionId}
        onRestore={handleRestoreSession}
        onDelete={handleDeleteRecoverableSession}
        onDismiss={handleDismissRecovery}
      />

      <ConfirmModal
        isOpen={pendingDeletePair !== null}
        title={`Delete "${pendingDeletePair?.name}"?`}
        message="This will permanently remove the pair, its snapshot, and its recoverable session."
        confirmLabel="Delete"
        onConfirm={confirmDeletePair}
        onCancel={cancelDeletePair}
      />

      {!showOnboarding && (
        <>
          <CreatePairModal isOpen={isCreatePairOpen} onClose={() => setIsCreatePairOpen(false)} />
          <AssignTaskModal
            key={
              selectedPair ? `assign-${selectedPair.id}-${String(isAssignTaskOpen)}` : 'assign-none'
            }
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
        </>
      )}
    </div>
  )
}

export default App

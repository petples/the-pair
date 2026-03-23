import React from 'react'
import { useState, useEffect } from 'react'
import { Plus, Terminal, ChevronLeft, RefreshCw, Sun, Moon, Square, RotateCcw, Zap } from 'lucide-react'
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

function Dashboard({ onSelectPair }: { onSelectPair: (p: Pair) => void }): React.ReactNode {
  const pairs = usePairStore((state) => state.pairs)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const { theme, toggleTheme } = useThemeStore()

  const getPairGlow = (status: string): 'blue' | 'purple' | 'green' | 'amber' | 'none' => {
    if (status === 'Mentoring') return 'blue'
    if (status === 'Executing') return 'purple'
    if (status === 'Reviewing') return 'amber'
    if (status === 'Awaiting Human Review') return 'amber'
    if (status === 'Finished') return 'green'
    return 'none'
  }

  return (
    <>
      <div className="relative h-full flex flex-col overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-background via-muted/20 to-background" />
        <div className="absolute inset-0 bg-gradient-to-tr from-blue-500/[0.03] via-transparent to-purple-500/[0.03]" />
        <div className="relative z-10 p-8 h-full flex flex-col">
          <div className="flex justify-between items-center mb-10">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-foreground">
                Active Pairs
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                {pairs.length} {pairs.length === 1 ? 'pair' : 'pairs'} running
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={toggleTheme}
                className="p-2 rounded-lg hover:bg-muted/50 transition-colors text-muted-foreground hover:text-foreground"
                title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
              >
                {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
              </button>
              <GlassButton
                onClick={() => setIsModalOpen(true)}
                variant="primary"
                size="md"
                icon={<Plus size={15} />}
              >
                New Pair
              </GlassButton>
            </div>
          </div>

          <motion.div
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 flex-1 overflow-y-auto scrollbar-thin"
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
                    className="p-5 flex flex-col gap-4 min-h-[160px]"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-base text-foreground leading-tight mb-1.5 truncate">
                          {pair.name}
                        </h3>
                        <p
                          className="text-xs text-muted-foreground font-mono truncate"
                          title={pair.directory}
                        >
                          {pair.directory.split('/').pop()}
                        </p>
                      </div>
                      <div className="ml-3 shrink-0">
                        <StatusBadge status={pair.status} />
                      </div>
                    </div>

                    <div className="flex-1 text-sm text-muted-foreground line-clamp-2 leading-relaxed">
                      {pair.spec}
                    </div>

                    <div className="mt-auto pt-4 border-t border-border/50">
                      <ResourceMeter cpu={pair.cpuUsage} mem={pair.memUsage} />
                      <div className="flex items-center justify-between mt-3">
                        <div className="flex items-center gap-1.5 text-xs font-mono text-muted-foreground">
                          <RefreshCw
                            size={12}
                            className={cn(
                              pair.status === 'Executing' || pair.status === 'Mentoring'
                                ? 'text-blue-500 animate-spin'
                                : 'text-muted-foreground/50'
                            )}
                          />
                          <span>
                            iter {pair.iterations}/{pair.maxIterations}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-medium text-blue-600">MENTOR</span>
                          <span className="text-[10px] font-mono text-muted-foreground">
                            {pair.mentorModel.split('/').pop()}
                          </span>
                          <span className="text-[10px] font-medium text-purple-600">EXEC</span>
                          <span className="text-[10px] font-mono text-muted-foreground">
                            {pair.executorModel.split('/').pop()}
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

      <CreatePairModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </>
  )
}

function PairDetail({ pair, onBack }: { pair: Pair; onBack: () => void }): React.ReactNode {
  const removePair = usePairStore((s) => s.removePair)
  const retryTurn = usePairStore((s) => s.retryTurn)
  const { theme, toggleTheme } = useThemeStore()

  const handleStop = () => {
    removePair(pair.id)
    onBack()
  }

  const handleRetryTurn = () => {
    retryTurn(pair.id)
  }

  const formatTime = (ts: number) => {
    const d = new Date(ts)
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`
  }

  const getMessageColor = (msg: Message) => {
    if (msg.from === 'human') return 'text-green-600 dark:text-green-400'
    if (msg.from === 'mentor') return 'text-blue-600 dark:text-blue-400'
    return 'text-purple-600 dark:text-purple-400'
  }

  const getTypeLabel = (msg: Message) => {
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

  const getActivityIcon = (phase: string) => {
    switch (phase) {
      case 'thinking': return '🤔'
      case 'using_tools': return '🔧'
      case 'responding': return '✍️'
      case 'waiting': return '⏳'
      case 'error': return '❌'
      default: return '💤'
    }
  }

  const getDuration = (startedAt: number, updatedAt: number) => {
    const seconds = Math.floor((updatedAt - startedAt) / 1000)
    if (seconds < 60) return `${seconds}s`
    const minutes = Math.floor(seconds / 60)
    return `${minutes}m ${seconds % 60}s`
  }

  const activeRole = pair.turn
  const isRunning = pair.status === 'Mentoring' || pair.status === 'Executing' || pair.status === 'Reviewing'

  return (
    <div className="flex flex-col h-full">
      <div className="h-14 glass-toolbar flex items-center px-5 gap-4 shrink-0">
        <button
          onClick={onBack}
          className="p-2 hover:bg-muted/50 rounded-lg text-muted-foreground hover:text-foreground transition-all"
        >
          <ChevronLeft size={18} />
        </button>
        <div className="flex items-center gap-3">
          <div className="w-1.5 h-1.5 rounded-full bg-foreground/20" />
          <div>
            <h2 className="font-semibold text-sm leading-tight text-foreground">{pair.name}</h2>
            <p className="text-[10px] text-muted-foreground font-mono">{pair.directory}</p>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <StatusBadge status={pair.status} />
          {pair.automationMode === 'full-auto' && (
            <div className="flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-1 rounded-full">
              <Zap size={10} />
              <span>Full Auto</span>
            </div>
          )}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg hover:bg-muted/50 transition-colors text-muted-foreground hover:text-foreground"
            title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
          >
            {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
          </button>
          <GlassButton variant="secondary" size="sm" icon={<Square size={12} />} onClick={handleStop}>
            Stop Pair
          </GlassButton>
          {pair.status === 'Error' && (
            <GlassButton variant="primary" size="sm" icon={<RotateCcw size={12} />} onClick={handleRetryTurn}>
              Retry Turn
            </GlassButton>
          )}
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden bg-background">
        <div className="w-[26%] border-r border-border/50 glass-panel p-5 overflow-y-auto scrollbar-thin flex flex-col gap-5">
          <div>
            <h3 className="text-[10px] font-semibold uppercase text-muted-foreground mb-3 tracking-wider">
              Task Spec
            </h3>
            <div className="glass-card p-3">
              <p className="text-sm text-foreground leading-relaxed">{pair.spec}</p>
            </div>
          </div>
          <div>
            <h3 className="text-[10px] font-semibold uppercase text-muted-foreground mb-3 tracking-wider">
              Models
            </h3>
            <div className="glass-card p-3 space-y-2.5">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                <span className="text-[10px] font-medium text-blue-600 uppercase">Mentor</span>
              </div>
              <p className="text-xs font-mono text-muted-foreground pl-4">{pair.mentorModel}</p>
              <div className="flex items-center gap-2 mt-1">
                <div className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                <span className="text-[10px] font-medium text-purple-600 uppercase">Executor</span>
              </div>
              <p className="text-xs font-mono text-muted-foreground pl-4">{pair.executorModel}</p>
            </div>
          </div>
          <div>
            <h3 className="text-[10px] font-semibold uppercase text-muted-foreground mb-3 tracking-wider">
              Progress
            </h3>
            <div className="glass-card p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted-foreground">Iterations</span>
                <span className="text-xs font-mono text-foreground">
                  {pair.iterations}/{pair.maxIterations}
                </span>
              </div>
              <div className="h-1 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-500"
                  style={{ width: `${(pair.iterations / pair.maxIterations) * 100}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="w-[48%] flex flex-col bg-muted/10">
          <div className="h-10 border-b border-border/50 flex items-center px-4 text-[11px] font-mono text-muted-foreground gap-2 shrink-0">
            <Terminal size={13} />
            <span>Console</span>
            <div className="ml-auto flex items-center gap-3">
              <span className="text-muted-foreground/50">
                iter {pair.iterations}/{pair.maxIterations}
              </span>
            </div>
          </div>
          <div className="h-12 border-b border-border/30 flex items-center px-4 gap-4 shrink-0 bg-muted/5">
            <div className={cn(
              'flex items-center gap-2 text-xs transition-all',
              activeRole === 'mentor' ? 'text-blue-600 dark:text-blue-400' : 'text-muted-foreground/50'
            )}>
              <div className={cn(
                'w-1.5 h-1.5 rounded-full',
                pair.mentorActivity.phase === 'thinking' || pair.mentorActivity.phase === 'using_tools' || pair.mentorActivity.phase === 'responding'
                  ? 'bg-blue-500 animate-pulse'
                  : pair.mentorActivity.phase === 'error'
                  ? 'bg-red-500'
                  : 'bg-blue-500/50'
              )} />
              <span className="font-medium">MENTOR</span>
              <span className="text-[10px]">{getActivityIcon(pair.mentorActivity.phase)}</span>
              <span className="text-[10px] max-w-[120px] truncate">{pair.mentorActivity.label}</span>
              {isRunning && activeRole === 'mentor' && (
                <span className="text-[9px] text-muted-foreground/50">{getDuration(pair.mentorActivity.startedAt, pair.mentorActivity.updatedAt)}</span>
              )}
            </div>
            <div className="w-px h-4 bg-border/50" />
            <div className={cn(
              'flex items-center gap-2 text-xs transition-all',
              activeRole === 'executor' ? 'text-purple-600 dark:text-purple-400' : 'text-muted-foreground/50'
            )}>
              <div className={cn(
                'w-1.5 h-1.5 rounded-full',
                pair.executorActivity.phase === 'thinking' || pair.executorActivity.phase === 'using_tools' || pair.executorActivity.phase === 'responding'
                  ? 'bg-purple-500 animate-pulse'
                  : pair.executorActivity.phase === 'error'
                  ? 'bg-red-500'
                  : 'bg-purple-500/50'
              )} />
              <span className="font-medium">EXECUTOR</span>
              <span className="text-[10px]">{getActivityIcon(pair.executorActivity.phase)}</span>
              <span className="text-[10px] max-w-[120px] truncate">{pair.executorActivity.label}</span>
              {isRunning && activeRole === 'executor' && (
                <span className="text-[9px] text-muted-foreground/50">{getDuration(pair.executorActivity.startedAt, pair.executorActivity.updatedAt)}</span>
              )}
            </div>
          </div>
          <div className="flex-1 p-4 font-mono text-[13px] overflow-y-auto scrollbar-thin space-y-1">
            {pair.messages.length === 0 ? (
              <>
                <div className="text-muted-foreground/60 mb-3">
                  <span className="text-muted-foreground/30">$</span> Pair initialized — awaiting
                  agent handoff
                </div>
                <div className="text-blue-600 dark:text-blue-400">
                  <span className="text-muted-foreground/30 mr-2">→</span>
                  <span>[Mentor]</span>
                  <span className="text-muted-foreground ml-2">Initializing task analysis...</span>
                </div>
                <div className="text-purple-600 dark:text-purple-400">
                  <span className="text-muted-foreground/30 mr-2">→</span>
                  <span>[Executor]</span>
                  <span className="text-muted-foreground ml-2">
                    Standing by for mentor output...
                  </span>
                </div>
              </>
            ) : (
              pair.messages.map((msg) => (
                <div key={msg.id} className={cn('flex items-start gap-2', getMessageColor(msg))}>
                  <span className="text-muted-foreground/50 shrink-0 mt-0.5">
                    {formatTime(msg.timestamp)}
                  </span>
                  <span className="shrink-0">{getTypeLabel(msg)}</span>
                  <span className="text-muted-foreground shrink-0">[{msg.from.toUpperCase()}]</span>
                  <span className="text-foreground flex-1 break-words">{msg.content}</span>
                </div>
              ))
            )}
            {isRunning && (
              <div className={cn(
                'flex items-start gap-2 animate-pulse',
                activeRole === 'mentor' ? 'text-blue-600/70 dark:text-blue-400/70' : 'text-purple-600/70 dark:text-purple-400/70'
              )}>
                <span className="text-muted-foreground/50 shrink-0 mt-0.5">
                  {formatTime(Date.now())}
                </span>
                <span>[{activeRole === 'mentor' ? 'MENTOR' : 'EXECUTOR'}]</span>
                <span>{getActivityIcon(activeRole === 'mentor' ? pair.mentorActivity.phase : pair.executorActivity.phase)}</span>
                <span className="text-muted-foreground/70">
                  {activeRole === 'mentor' ? pair.mentorActivity.label : pair.executorActivity.label}
                  {(() => {
                    const detail = activeRole === 'mentor' ? pair.mentorActivity.detail : pair.executorActivity.detail
                    return detail && (
                      <span className="text-muted-foreground/50 ml-1">({detail})</span>
                    )
                  })()}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="w-[26%] glass-panel p-5 flex flex-col gap-5 overflow-y-auto scrollbar-thin">
          <div>
            <h3 className="text-[10px] font-semibold uppercase text-muted-foreground mb-3 tracking-wider">
              System Resources
            </h3>
            <div className="space-y-3">
              <div className="glass-card p-3">
                <div className="text-[10px] text-muted-foreground mb-2">Pair Total</div>
                <ResourceMeter cpu={pair.cpuUsage} mem={pair.memUsage} />
              </div>
              <div className="glass-card p-3">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                  <span className="text-[10px] text-blue-600 dark:text-blue-400 font-medium">MENTOR</span>
                </div>
                <div className="h-1 rounded-full bg-muted overflow-hidden mb-1.5">
                  <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${Math.min(pair.mentorCpu, 100)}%` }} />
                </div>
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>CPU: {pair.mentorCpu.toFixed(1)}%</span>
                  <span>MEM: {pair.mentorMemMb}MB</span>
                </div>
              </div>
              <div className="glass-card p-3">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                  <span className="text-[10px] text-purple-600 dark:text-purple-400 font-medium">EXECUTOR</span>
                </div>
                <div className="h-1 rounded-full bg-muted overflow-hidden mb-1.5">
                  <div className="h-full rounded-full bg-purple-500 transition-all" style={{ width: `${Math.min(pair.executorCpu, 100)}%` }} />
                </div>
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>CPU: {pair.executorCpu.toFixed(1)}%</span>
                  <span>MEM: {pair.executorMemMb}MB</span>
                </div>
              </div>
            </div>
          </div>
          <div className="flex-1">
            <h3 className="text-[10px] font-semibold uppercase text-muted-foreground mb-3 tracking-wider">
              Modified Files
            </h3>
            <div className="glass-card p-3">
              {!pair.gitTracking.available ? (
                <div className="text-xs font-mono text-amber-600/70 dark:text-amber-400/70">
                  Git tracking unavailable for this workspace
                </div>
              ) : pair.modifiedFiles.length === 0 ? (
                <div className="text-xs font-mono text-muted-foreground/60">
                  No files modified yet
                </div>
              ) : (
                <div className="space-y-1">
                  {pair.modifiedFiles.map((file, i) => (
                    <div key={i} className="text-xs font-mono text-muted-foreground truncate flex items-center gap-1" title={file.path}>
                      <span className="text-purple-500/60">{file.status}</span>
                      <span className="truncate">{file.displayPath}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div>
            <h3 className="text-[10px] font-semibold uppercase text-muted-foreground mb-3 tracking-wider">
              Recent Activity
            </h3>
            <div className="glass-card p-3 space-y-2">
              <div className="flex items-center gap-2 text-xs">
                <div className={cn(
                  'w-1.5 h-1.5 rounded-full',
                  pair.mentorActivity.phase === 'error' ? 'bg-red-500' : pair.mentorActivity.phase !== 'idle' ? 'bg-blue-500 animate-pulse' : 'bg-blue-500/50'
                )} />
                <span className="text-muted-foreground/70">MENTOR:</span>
                <span className="text-blue-600 dark:text-blue-400 truncate">{pair.mentorActivity.label}</span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <div className={cn(
                  'w-1.5 h-1.5 rounded-full',
                  pair.executorActivity.phase === 'error' ? 'bg-red-500' : pair.executorActivity.phase !== 'idle' ? 'bg-purple-500 animate-pulse' : 'bg-purple-500/50'
                )} />
                <span className="text-muted-foreground/70">EXEC:</span>
                <span className="text-purple-600 dark:text-purple-400 truncate">{pair.executorActivity.label}</span>
              </div>
              {pair.mentorActivity.detail && (
                <div className="text-[10px] text-muted-foreground/50 pl-4 truncate">
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
  const pairs = usePairStore((state) => state.pairs)
  const loadAvailableModels = usePairStore((state) => state.loadAvailableModels)
  const initMessageListener = usePairStore((state) => state.initMessageListener)
  const theme = useThemeStore((state) => state.theme)

  useEffect(() => {
    loadAvailableModels()
    initMessageListener()
  }, [loadAvailableModels, initMessageListener])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])

  const selectedPair = pairs.find((p) => p.id === selectedPairId)

  return (
    <div className="h-screen w-screen bg-background text-foreground overflow-hidden font-sans selection:bg-primary selection:text-primary-foreground grain-overlay">
      {selectedPair ? (
        <PairDetail pair={selectedPair} onBack={() => setSelectedPairId(null)} />
      ) : pairs.length === 0 ? (
        <OnboardingWizard onComplete={() => {}} />
      ) : (
        <Dashboard onSelectPair={(p) => setSelectedPairId(p.id)} />
      )}
    </div>
  )
}

export default App

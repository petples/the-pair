import React from 'react'
import { useState, useEffect } from 'react'
import { Plus, Terminal, ChevronLeft, Check, X, RefreshCw, Sun, Moon } from 'lucide-react'
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
  const humanFeedback = usePairStore((s) => s.humanFeedback)
  const updatePairStatus = usePairStore((s) => s.updatePairStatus)
  const { theme, toggleTheme } = useThemeStore()

  const handleApprove = () => {
    humanFeedback(pair.id, true)
    updatePairStatus(pair.id, 'Finished')
  }

  const handleReject = () => {
    humanFeedback(pair.id, false)
    updatePairStatus(pair.id, 'Executing')
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

  const allAttachments = pair.messages.flatMap((msg) => msg.attachments || [])

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
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg hover:bg-muted/50 transition-colors text-muted-foreground hover:text-foreground"
            title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
          >
            {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
          </button>
          {pair.status === 'Awaiting Human Review' && (
            <div className="flex gap-2 ml-2">
              <GlassButton variant="reject" size="sm" icon={<X size={12} />} onClick={handleReject}>
                Reject
              </GlassButton>
              <GlassButton
                variant="approve"
                size="sm"
                icon={<Check size={12} />}
                onClick={handleApprove}
              >
                Approve
              </GlassButton>
            </div>
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
              <span className="text-blue-600 dark:text-blue-400">
                {pair.mentorModel.split('/').pop()}
              </span>
              <span className="text-purple-600 dark:text-purple-400">
                {pair.executorModel.split('/').pop()}
              </span>
              <span className="text-muted-foreground/50">
                iter {pair.iterations}/{pair.maxIterations}
              </span>
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
          </div>
        </div>

        <div className="w-[26%] glass-panel p-5 flex flex-col gap-5 overflow-y-auto scrollbar-thin">
          <div>
            <h3 className="text-[10px] font-semibold uppercase text-muted-foreground mb-3 tracking-wider">
              System Resources
            </h3>
            <ResourceMeter cpu={pair.cpuUsage} mem={pair.memUsage} />
          </div>
          <div className="flex-1">
            <h3 className="text-[10px] font-semibold uppercase text-muted-foreground mb-3 tracking-wider">
              Modified Files
            </h3>
            <div className="glass-card p-3">
              {allAttachments.length === 0 ? (
                <div className="text-xs font-mono text-muted-foreground/60">
                  No files modified yet
                </div>
              ) : (
                <div className="space-y-1">
                  {allAttachments.map((att, i) => (
                    <div
                      key={i}
                      className="text-xs font-mono text-muted-foreground truncate"
                      title={att.description}
                    >
                      <span className="text-purple-500/60 mr-1">•</span>
                      {att.path.split('/').pop()}
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
            <div className="space-y-2">
              {[
                { time: 'now', event: 'Pair created', color: 'text-muted-foreground/50' },
                {
                  time: '-2s',
                  event: 'Mentor spawned',
                  color: 'text-blue-600 dark:text-blue-400'
                },
                {
                  time: '-1s',
                  event: 'Executor spawned',
                  color: 'text-purple-600 dark:text-purple-400'
                }
              ].map((item) => (
                <div key={item.time} className="flex items-center gap-2 text-xs">
                  <span className="text-muted-foreground/30 font-mono text-[10px] w-6">
                    {item.time}
                  </span>
                  <span className={cn('font-mono', item.color)}>{item.event}</span>
                </div>
              ))}
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

import React from 'react'
import { Plus, Brain, Zap, RefreshCw } from 'lucide-react'
import { GlassButton } from './ui/GlassButton'
import { GlassCard } from './ui/GlassCard'

interface DashboardEmptyStateProps {
  onCreatePair: () => void
}

export function DashboardEmptyState({ onCreatePair }: DashboardEmptyStateProps): React.ReactNode {
  return (
    <div className="flex h-full flex-col items-center justify-center p-8">
      <div className="relative mb-8 flex flex-col items-center">
        <div className="glass-card relative flex h-20 w-20 items-center justify-center rounded-3xl border border-border/50 bg-background/80 shadow-xl">
          <Brain size={32} className="text-blue-500" />
          <Zap size={28} className="absolute -right-1 -bottom-1 text-purple-500" />
        </div>
        <div className="absolute -inset-8 -z-10 rounded-full bg-gradient-to-br from-blue-500/10 via-transparent to-purple-500/10 blur-2xl" />
      </div>

      <h2 className="mb-3 text-xl font-semibold text-foreground">No Pair Containers Yet</h2>
      <p className="mb-8 max-w-md text-center text-sm leading-relaxed text-muted-foreground">
        A Pair is a workspace that keeps its history, defaults, and task context. Each Pair has a{' '}
        <span className="font-medium text-blue-600 dark:text-blue-400">Mentor</span> agent that
        plans and reviews, and an{' '}
        <span className="font-medium text-purple-600 dark:text-purple-400">Executor</span> agent
        that writes and runs code. Create one to get started.
      </p>

      <div className="mb-10 grid w-full max-w-lg grid-cols-3 gap-4">
        <GlassCard className="flex flex-col items-center gap-3 p-4 text-center" hoverable>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-blue-500/20 bg-blue-500/10">
            <Brain size={18} className="text-blue-600 dark:text-blue-400" />
          </div>
          <span className="text-xs font-medium text-foreground">Mentor</span>
          <span className="text-[10px] leading-relaxed text-muted-foreground">
            Analyzes tasks and reviews executor output
          </span>
        </GlassCard>

        <GlassCard className="flex flex-col items-center gap-3 p-4 text-center" hoverable>
          <div className="relative flex h-10 w-10 items-center justify-center">
            <RefreshCw size={18} className="text-muted-foreground/50" />
            <Zap
              size={16}
              className="absolute -right-0.5 -bottom-0.5 text-purple-500"
              fill="currentColor"
            />
          </div>
          <span className="text-xs font-medium text-foreground">Handoff</span>
          <span className="text-[10px] leading-relaxed text-muted-foreground">
            Agents pass control back and forth automatically
          </span>
        </GlassCard>

        <GlassCard className="flex flex-col items-center gap-3 p-4 text-center" hoverable>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-purple-500/20 bg-purple-500/10">
            <Zap size={18} className="text-purple-600 dark:text-purple-400" />
          </div>
          <span className="text-xs font-medium text-foreground">Executor</span>
          <span className="text-[10px] leading-relaxed text-muted-foreground">
            Executes plans and reports results
          </span>
        </GlassCard>
      </div>

      <GlassButton variant="primary" size="lg" onClick={onCreatePair} icon={<Plus size={16} />}>
        Create your first Pair
      </GlassButton>
    </div>
  )
}

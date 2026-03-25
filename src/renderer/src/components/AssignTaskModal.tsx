import React, { useMemo, useState, useRef, useCallback } from 'react'
import { ArrowUpRight, Sparkles } from 'lucide-react'
import { usePairStore, Pair } from '../store/usePairStore'
import { GlassButton } from './ui/GlassButton'
import { GlassModal } from './ui/GlassModal'
import { FileMention } from './FileMention'

interface AssignTaskModalProps {
  pair: Pair | null
  isOpen: boolean
  onClose: () => void
}

export function AssignTaskModal({ pair, isOpen, onClose }: AssignTaskModalProps): React.ReactNode {
  const { assignTask, isLoading, error } = usePairStore()
  const [spec, setSpec] = useState('')
  const [fileContexts, setFileContexts] = useState<Map<string, string>>(new Map())
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleFileSelect = useCallback((path: string, content: string): void => {
    setFileContexts((prev) => {
      const next = new Map(prev)
      next.set(path, content)
      return next
    })
  }, [])

  const effectiveMentorModel = useMemo(
    () => pair?.pendingMentorModel ?? pair?.mentorModel ?? '',
    [pair]
  )
  const effectiveExecutorModel = useMemo(
    () => pair?.pendingExecutorModel ?? pair?.executorModel ?? '',
    [pair]
  )

  if (!pair) return null

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (!spec.trim()) return

    const referencedFiles = Array.from(fileContexts.entries()).filter(([path]) =>
      spec.includes(`@${path}`)
    )
    let finalSpec = spec.trim()
    if (referencedFiles.length > 0) {
      const contextHeader =
        '--- REFERENCED FILES ---\n' +
        referencedFiles
          .map(([path, content]) => `@${path}:\n${content}`)
          .join('\n\n') +
        '\n\n--- TASK ---\n'
      finalSpec = contextHeader + finalSpec
    }

    try {
      await assignTask(pair.id, finalSpec)
      setSpec('')
      setFileContexts(new Map())
      onClose()
    } catch {
      // Store already holds the user-facing error
    }
  }

  return (
    <GlassModal
      isOpen={isOpen}
      onClose={onClose}
      title={`Assign New Task · ${pair.name}`}
      className="max-w-2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="glass-card rounded-2xl p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-muted/60">
              <Sparkles size={16} className="text-foreground/70" />
            </div>
            <div className="space-y-1">
              <div className="text-sm font-semibold text-foreground">Reuse this pair container</div>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Workspace, pair identity, and default models stay attached to this pair. The new
                task starts as a fresh run with a cleared console and iteration counter.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="glass-card rounded-2xl p-3">
            <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Workspace
            </div>
            <div className="mt-2 truncate font-mono text-xs text-foreground" title={pair.directory}>
              {pair.directory}
            </div>
          </div>
          <div className="glass-card rounded-2xl p-3">
            <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-400">
              Mentor Next
            </div>
            <div
              className="mt-2 truncate font-mono text-xs text-foreground"
              title={effectiveMentorModel}
            >
              {effectiveMentorModel}
            </div>
          </div>
          <div className="glass-card rounded-2xl p-3">
            <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-purple-600 dark:text-purple-400">
              Executor Next
            </div>
            <div
              className="mt-2 truncate font-mono text-xs text-foreground"
              title={effectiveExecutorModel}
            >
              {effectiveExecutorModel}
            </div>
          </div>
        </div>

        {(pair.pendingMentorModel || pair.pendingExecutorModel) && (
          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
            Queued model changes will apply to this task as soon as you launch it.
          </div>
        )}

        <div className="relative">
          <label className="mb-2 block text-sm font-medium text-foreground">
            Task Specification
          </label>
          <textarea
            ref={textareaRef}
            value={spec}
            onChange={(e) => setSpec(e.target.value)}
            placeholder="Describe the next task for this pair. Mention expected outcome, constraints, and how you want them to verify the work. Use @filename to reference files."
            rows={6}
            className="glass-card w-full resize-none rounded-2xl px-4 py-3 text-sm leading-relaxed text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
            required
          />
          <FileMention
            textareaRef={textareaRef}
            onChange={setSpec}
            directory={pair.directory}
            pairId={pair.id}
            onFileSelect={handleFileSelect}
          />
          <p className="mt-1.5 text-xs text-muted-foreground">
            {spec.length} characters · the next run starts with a fresh planning loop · Type @ to
            reference files
          </p>
        </div>

        {error && (
          <div className="rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-3">
          <GlassButton type="button" variant="ghost" onClick={onClose}>
            Cancel
          </GlassButton>
          <GlassButton
            type="submit"
            variant="primary"
            disabled={isLoading || spec.trim().length === 0}
            icon={<ArrowUpRight size={14} />}
          >
            {isLoading ? 'Starting...' : 'Start New Task'}
          </GlassButton>
        </div>
      </form>
    </GlassModal>
  )
}

import React, { useState, useEffect, useRef } from 'react'
import { open } from '@tauri-apps/plugin-dialog'
import { FolderOpen } from 'lucide-react'
import { usePairStore } from '../store/usePairStore'
import { GlassModal } from './ui/GlassModal'
import { GlassButton } from './ui/GlassButton'
import { ModelPicker } from './ModelPicker'
import { FileMention } from './FileMention'

interface CreatePairModalProps {
  isOpen: boolean
  onClose: () => void
}

export function CreatePairModal({ isOpen, onClose }: CreatePairModalProps): React.ReactNode {
  const { availableModels, loadAvailableModels, createPair, isLoading, error } = usePairStore()

  const [name, setName] = useState('')
  const [directory, setDirectory] = useState('')
  const [spec, setSpec] = useState('')
  const [mentorModel, setMentorModel] = useState('')
  const [executorModel, setExecutorModel] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (isOpen && availableModels.length === 0) {
      loadAvailableModels()
    }
  }, [isOpen, availableModels.length, loadAvailableModels])

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (availableModels.length > 0 && mentorModel === '') {
      const defaultEntry = availableModels.find((model) => model.available) ?? availableModels[0]
      const defaultModel =
        defaultEntry.provider === 'opencode'
          ? defaultEntry.modelId
          : `${defaultEntry.provider}/${defaultEntry.modelId}`
      setMentorModel(defaultModel)
      setExecutorModel(defaultModel)
    }
  }, [availableModels, mentorModel])

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    try {
      await createPair({ name, directory, spec, mentorModel, executorModel })
      setName('')
      setDirectory('')
      setSpec('')
      onClose()
    } catch {
      // Store already exposes the error copy
    }
  }

  const handleSelectDirectory = async (): Promise<void> => {
    const selected = await open({
      directory: true,
      multiple: false,
    })
    if (selected) {
      setDirectory(selected)
    }
  }

  return (
    <GlassModal isOpen={isOpen} onClose={onClose} title="Create New Pair" className="max-w-lg">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Auth Module Refactor"
            className="w-full px-3.5 py-2.5 glass-card text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20 rounded-xl"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-2">Directory</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={directory}
              onChange={(e) => setDirectory(e.target.value)}
              placeholder="/path/to/project"
              className="flex-1 px-3.5 py-2.5 glass-card text-sm font-mono text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20 rounded-xl"
              required
            />
            <GlassButton
              type="button"
              variant="secondary"
              size="md"
              onClick={handleSelectDirectory}
              icon={<FolderOpen size={15} />}
            >
              {''}
            </GlassButton>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            <span className="text-blue-600 dark:text-blue-400">Mentor</span> Model
          </label>
          <ModelPicker
            value={mentorModel}
            models={availableModels}
            onChange={setMentorModel}
            role="mentor"
          />
          <p className="text-xs text-muted-foreground mt-1.5">
            Read-only: analyzes, plans, reviews
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            <span className="text-purple-600 dark:text-purple-400">Executor</span> Model
          </label>
          <ModelPicker
            value={executorModel}
            models={availableModels}
            onChange={setExecutorModel}
            role="executor"
          />
          <p className="text-xs text-muted-foreground mt-1.5">
            Full access: writes code, runs commands
          </p>
        </div>

        <div className="relative">
          <label className="block text-sm font-medium text-foreground mb-2">
            Task Specification
          </label>
          <textarea
            ref={textareaRef}
            value={spec}
            onChange={(e) => setSpec(e.target.value)}
            placeholder="Describe what you want the pair to accomplish... Use @filename to reference files."
            rows={4}
            className="w-full px-3.5 py-2.5 glass-card text-sm text-foreground placeholder:text-muted-foreground/50 resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 rounded-xl leading-relaxed"
            required
          />
          {directory && (
            <FileMention textareaRef={textareaRef} onChange={setSpec} directory={directory} />
          )}
          <p className="mt-1.5 text-xs text-muted-foreground">
            Type @ to reference workspace files
          </p>
        </div>

        {error && (
          <div className="text-sm text-destructive glass-card p-3 rounded-xl border border-destructive/20">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-1">
          <GlassButton type="button" variant="ghost" onClick={onClose}>
            Cancel
          </GlassButton>
          <GlassButton type="submit" variant="primary" disabled={isLoading}>
            {isLoading ? 'Creating...' : 'Create Pair'}
          </GlassButton>
        </div>
      </form>
    </GlassModal>
  )
}

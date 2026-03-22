import React, { useState, useEffect } from 'react'
import { FolderOpen, ChevronDown } from 'lucide-react'
import { usePairStore } from '../store/usePairStore'
import type { AvailableModel } from '../types'
import { GlassModal } from './ui/GlassModal'
import { GlassButton } from './ui/GlassButton'

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

  useEffect(() => {
    if (isOpen && availableModels.length === 0) {
      loadAvailableModels()
    }
  }, [isOpen, availableModels.length, loadAvailableModels])

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (availableModels.length > 0 && mentorModel === '') {
      const defaultModel = `${availableModels[0].provider}/${availableModels[0].modelId}`
      setMentorModel(defaultModel)
      setExecutorModel(defaultModel)
    }
  }, [availableModels, mentorModel])

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    await createPair({ name, directory, spec, mentorModel, executorModel })
    setName('')
    setDirectory('')
    setSpec('')
    onClose()
  }

  const handleSelectDirectory = async (): Promise<void> => {
    const result = await window.electron.ipcRenderer.invoke('dialog:openDirectory')
    if (result && !result.canceled && result.filePaths.length > 0) {
      setDirectory(result.filePaths[0])
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
          <div className="relative">
            <select
              value={mentorModel}
              onChange={(e) => setMentorModel(e.target.value)}
              className="w-full px-3.5 py-2.5 glass-card text-sm text-foreground appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/20 rounded-xl"
            >
              {availableModels.length === 0 ? (
                <option value="">Loading models...</option>
              ) : (
                availableModels.map((m: AvailableModel) => (
                  <option key={`${m.provider}/${m.modelId}`} value={`${m.provider}/${m.modelId}`}>
                    {m.displayName}
                  </option>
                ))
              )}
            </select>
            <ChevronDown
              size={14}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
            />
          </div>
          <p className="text-xs text-muted-foreground mt-1.5">
            Read-only: analyzes, plans, reviews
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            <span className="text-purple-600 dark:text-purple-400">Executor</span> Model
          </label>
          <div className="relative">
            <select
              value={executorModel}
              onChange={(e) => setExecutorModel(e.target.value)}
              className="w-full px-3.5 py-2.5 glass-card text-sm text-foreground appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/20 rounded-xl"
            >
              {availableModels.length === 0 ? (
                <option value="">Loading models...</option>
              ) : (
                availableModels.map((m: AvailableModel) => (
                  <option key={`${m.provider}/${m.modelId}`} value={`${m.provider}/${m.modelId}`}>
                    {m.displayName}
                  </option>
                ))
              )}
            </select>
            <ChevronDown
              size={14}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
            />
          </div>
          <p className="text-xs text-muted-foreground mt-1.5">
            Full access: writes code, runs commands
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Task Specification
          </label>
          <textarea
            value={spec}
            onChange={(e) => setSpec(e.target.value)}
            placeholder="Describe what you want the pair to accomplish..."
            rows={4}
            className="w-full px-3.5 py-2.5 glass-card text-sm text-foreground placeholder:text-muted-foreground/50 resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 rounded-xl leading-relaxed"
            required
          />
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

import { useState, useEffect, useRef } from 'react'
import { Sparkles, RefreshCw, Loader2 } from 'lucide-react'
import { invoke } from '@tauri-apps/api/core'
import { cn } from '../lib/utils'

interface SkillInfo {
  name: string
  description: string
  source: string
}

interface SkillPickerProps {
  projectDir: string
  onSelect: (skillName: string) => void
}

export function SkillPicker({ projectDir, onSelect }: SkillPickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [skills, setSkills] = useState<SkillInfo[]>([])
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const loadSkills = async () => {
    setLoading(true)
    try {
      const result = await invoke<SkillInfo[]>('discover_skills', {
        projectDir: projectDir || null,
      })
      setSkills(result)
    } catch (error) {
      console.error('Failed to discover skills:', error)
      setSkills([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen && skills.length === 0 && !loading) {
      void loadSkills()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  const filteredSkills = skills.filter(
    (s) =>
      s.name.toLowerCase().includes(filter.toLowerCase()) ||
      s.description.toLowerCase().includes(filter.toLowerCase())
  )

  const handleSelect = (skill: SkillInfo) => {
    onSelect(skill.name)
    setIsOpen(false)
    setFilter('')
    setSelectedIndex(0)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((i) => Math.min(i + 1, filteredSkills.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && filteredSkills[selectedIndex]) {
      e.preventDefault()
      handleSelect(filteredSkills[selectedIndex])
    } else if (e.key === 'Escape') {
      setIsOpen(false)
    }
  }

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all"
        title="Add skill"
      >
        <Sparkles size={16} />
      </button>

      {isOpen && (
        <div
          ref={dropdownRef}
          className="absolute top-full right-0 mt-2 w-80 max-h-96 overflow-hidden rounded-xl border border-border/50 bg-background/95 backdrop-blur-xl shadow-2xl z-50"
        >
          <div className="p-3 border-b border-border/50 flex items-center gap-2">
            <input
              type="text"
              value={filter}
              onChange={(e) => {
                setFilter(e.target.value)
                setSelectedIndex(0)
              }}
              onKeyDown={handleKeyDown}
              placeholder="Search skills..."
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              autoFocus
            />
            <button
              type="button"
              onClick={() => void loadSkills()}
              disabled={loading}
              className="p-1 rounded hover:bg-muted/50 transition-colors disabled:opacity-50"
              title="Refresh skills"
            >
              {loading ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <RefreshCw size={14} />
              )}
            </button>
          </div>

          <div className="max-h-80 overflow-y-auto">
            {loading && skills.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                <Loader2 size={16} className="animate-spin mx-auto mb-2" />
                Discovering skills...
              </div>
            ) : filteredSkills.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                {filter ? 'No skills match your search' : 'No skills found'}
              </div>
            ) : (
              filteredSkills.map((skill, index) => (
                <button
                  key={skill.name}
                  type="button"
                  onClick={() => handleSelect(skill)}
                  className={cn(
                    'w-full text-left p-3 border-b border-border/30 last:border-0 transition-colors',
                    index === selectedIndex
                      ? 'bg-primary/10'
                      : 'hover:bg-muted/30'
                  )}
                >
                  <div className="font-medium text-sm">{skill.name}</div>
                  <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                    {skill.description}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

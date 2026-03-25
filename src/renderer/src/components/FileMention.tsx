import React, { useState, useEffect, useRef, useCallback } from 'react'
import Fuse from 'fuse.js'
import { File, Folder } from 'lucide-react'

interface FileEntry {
  path: string
  type: 'file' | 'directory'
}

interface FileMentionProps {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>
  onChange: (value: string) => void
  directory: string
  pairId?: string
  onFileSelect?: (path: string, content: string) => void
}

export function FileMention({
  textareaRef,
  onChange,
  directory,
  pairId,
  onFileSelect
}: FileMentionProps): React.ReactNode {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<FileEntry[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [position, setPosition] = useState({ top: 0, left: 0 })
  const [files, setFiles] = useState<FileEntry[]>([])
  const popoverRef = useRef<HTMLDivElement>(null)

  const [fuse, setFuse] = useState<Fuse<FileEntry> | null>(null)
  const filesRef = useRef<FileEntry[]>([])
  const resultsRef = useRef<FileEntry[]>([])
  const selectedIndexRef = useRef(0)
  const isOpenRef = useRef(false)

  useEffect(() => {
    if (!directory) return

    window.api.file.listFiles({ pairId, directory }).then((fileList) => {
      setFiles(fileList)
      filesRef.current = fileList
    })
  }, [directory, pairId])

  useEffect(() => {
    if (files.length === 0) return

    setFuse(
      new Fuse(files, {
        keys: ['path'],
        threshold: 0.4,
        includeScore: true
      })
    )
  }, [files])

  const getCursorPosition = useCallback((): { top: number; left: number } | null => {
    const textarea = textareaRef.current
    if (!textarea) return null

    const rect = textarea.getBoundingClientRect()
    const text = textarea.value
    const pos = textarea.selectionStart
    const textBeforeCursor = text.slice(0, pos)
    const lastAtPos = textBeforeCursor.lastIndexOf('@')

    const mirror = document.createElement('div')
    const computed = window.getComputedStyle(textarea)

    mirror.style.cssText = `
      position: absolute;
      visibility: hidden;
      white-space: pre-wrap;
      word-wrap: break-word;
      font: ${computed.font};
      padding: ${computed.padding};
      border: ${computed.border};
      width: ${computed.width};
      line-height: ${computed.lineHeight};
    `

    mirror.textContent = text.slice(0, lastAtPos + 1)
    document.body.appendChild(mirror)

    const span = document.createElement('span')
    span.textContent = '@'
    mirror.appendChild(span)

    const spanRect = span.getBoundingClientRect()
    document.body.removeChild(mirror)

    return {
      top: spanRect.bottom - rect.top + textarea.scrollTop,
      left: spanRect.left - rect.left + textarea.scrollLeft
    }
  }, [textareaRef])

  const insertMention = useCallback(
    async (path: string): Promise<void> => {
      const textarea = textareaRef.current
      if (!textarea) return

      if (onFileSelect) {
        try {
          const content = await window.api.file.readContent({
            pairId: pairId,
            directory: pairId ? undefined : directory,
            filePath: path
          })
          onFileSelect(path, content)
        } catch (err) {
          console.error('Failed to read file content:', err)
        }
      }

      const text = textarea.value
      const pos = textarea.selectionStart
      const textBeforeCursor = text.slice(0, pos)
      const lastAtPos = textBeforeCursor.lastIndexOf('@')

      const textBefore = text.slice(0, lastAtPos)
      const textAfter = text.slice(pos)

      const newValue = `${textBefore}@${path}${textAfter}`
      onChange(newValue)
      setIsOpen(false)
      isOpenRef.current = false

      setTimeout(() => {
        const newPos = lastAtPos + path.length + 1
        textarea.focus()
        textarea.setSelectionRange(newPos, newPos)
      }, 0)
    },
    [textareaRef, onChange, onFileSelect, pairId, directory]
  )

  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return

    const handleInput = (): void => {
      const text = textarea.value
      const pos = textarea.selectionStart
      const textBeforeCursor = text.slice(0, pos)

      const lastAtPos = textBeforeCursor.lastIndexOf('@')

      if (lastAtPos === -1) {
        setIsOpen(false)
        isOpenRef.current = false
        return
      }

      const textAfterAt = textBeforeCursor.slice(lastAtPos + 1)

      if (textAfterAt.includes(' ') || textAfterAt.includes('\n')) {
        setIsOpen(false)
        isOpenRef.current = false
        return
      }

      setQuery(textAfterAt)
      setPosition(getCursorPosition() ?? { top: 0, left: 0 })
      setIsOpen(true)
      isOpenRef.current = true
      setSelectedIndex(0)
      selectedIndexRef.current = 0
    }

    const handleKeyDown = (e: KeyboardEvent): void => {
      if (!isOpenRef.current) return

      if (e.key === 'ArrowDown') {
        e.preventDefault()
        const newIndex = (selectedIndexRef.current + 1) % resultsRef.current.length
        setSelectedIndex(newIndex)
        selectedIndexRef.current = newIndex
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        const newIndex =
          (selectedIndexRef.current - 1 + resultsRef.current.length) % resultsRef.current.length
        setSelectedIndex(newIndex)
        selectedIndexRef.current = newIndex
      } else if (e.key === 'Enter' && resultsRef.current.length > 0) {
        e.preventDefault()
        insertMention(resultsRef.current[selectedIndexRef.current].path)
      } else if (e.key === 'Escape') {
        setIsOpen(false)
        isOpenRef.current = false
      }
    }

    textarea.addEventListener('input', handleInput)
    textarea.addEventListener('keydown', handleKeyDown)
    textarea.addEventListener('scroll', handleScroll)

    return () => {
      textarea.removeEventListener('input', handleInput)
      textarea.removeEventListener('keydown', handleKeyDown)
      textarea.removeEventListener('scroll', handleScroll)
    }

    function handleScroll(): void {
      if (isOpenRef.current) {
        setPosition(getCursorPosition() ?? { top: 0, left: 0 })
      }
    }
  }, [textareaRef, getCursorPosition, insertMention])

  useEffect(() => {
    if (!query || !fuse) {
      setTimeout(() => {
        const initialResults = filesRef.current.slice(0, 50)
        setResults(initialResults)
        resultsRef.current = initialResults
      }, 0)
      return
    }

    const searchResults = fuse.search(query).slice(0, 50)
    setTimeout(() => {
      const mappedResults = searchResults.map((r) => r.item)
      setResults(mappedResults)
      resultsRef.current = mappedResults
    }, 0)
  }, [query, fuse])

  if (!isOpen || results.length === 0) return null

  return (
    <div
      ref={popoverRef}
      className="absolute z-50 max-h-64 w-80 overflow-y-auto rounded-xl border border-border bg-popover shadow-lg"
      style={{ top: position.top, left: position.left }}
    >
      {results.map((file, index) => (
        <div
          key={file.path}
          className={`flex cursor-pointer items-center gap-2 px-3 py-2 text-sm ${
            index === selectedIndex ? 'bg-accent' : 'hover:bg-accent/50'
          }`}
          onClick={() => insertMention(file.path)}
        >
          {file.type === 'directory' ? (
            <Folder size={14} className="text-amber-500" />
          ) : (
            <File size={14} className="text-blue-500" />
          )}
          <span className="truncate font-mono text-foreground">{file.path}</span>
        </div>
      ))}
      {files.length > 50 && (
        <div className="border-t px-3 py-2 text-xs text-muted-foreground">
          {files.length - 50} more files...
        </div>
      )}
    </div>
  )
}

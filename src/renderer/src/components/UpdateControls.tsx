import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowDownToLine, Info, Loader2, RefreshCw } from 'lucide-react'
import { listen } from '@tauri-apps/api/event'
import { check, type Update } from '@tauri-apps/plugin-updater'
import { GlassButton } from './ui/GlassButton'
import { cn } from '../lib/utils'
import { ReleaseNotesModal } from './ReleaseNotesModal'

type UpdatePhase = 'idle' | 'checking' | 'available' | 'installing' | 'up-to-date' | 'error'

export function UpdateControls(): React.ReactNode {
  const [phase, setPhase] = useState<UpdatePhase>('idle')
  const [version, setVersion] = useState<string | null>(null)
  const [progress, setProgress] = useState<number | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [showReleaseNotes, setShowReleaseNotes] = useState(false)
  const [releaseBody, setReleaseBody] = useState<string | null>(null)
  const updateRef = useRef<Update | null>(null)
  const totalBytesRef = useRef<number | null>(null)
  const downloadedBytesRef = useRef<number>(0)

  const clearUpdateResource = useCallback(async () => {
    const current = updateRef.current
    updateRef.current = null
    if (current) {
      await current.close().catch(() => {})
    }
  }, [])

  const checkForUpdates = useCallback(
    async (showErrors: boolean) => {
      setPhase('checking')
      setProgress(null)
      totalBytesRef.current = null
      downloadedBytesRef.current = 0

      try {
        await clearUpdateResource()
        const update = await check()

        if (!update) {
          setVersion(null)
          setMessage('You are up to date')
          setPhase('up-to-date')
          return
        }

        updateRef.current = update
        setVersion(update.version)
        setReleaseBody(update.body || null)
        setMessage(update.body?.trim() || `Version ${update.version} is available`)
        setPhase('available')
      } catch (error) {
        if (showErrors) {
          const message = error instanceof Error ? error.message : 'Unable to check for updates'
          setMessage(message)
          setPhase('error')
        } else {
          setPhase('idle')
        }
      }
    },
    [clearUpdateResource]
  )

  const installUpdate = useCallback(async () => {
    if (!updateRef.current) {
      return
    }

    setPhase('installing')
    setProgress(0)
    setMessage(`Installing v${updateRef.current.version}...`)
    totalBytesRef.current = null
    downloadedBytesRef.current = 0

    try {
      await updateRef.current.downloadAndInstall((event) => {
        if (event.event === 'Started') {
          totalBytesRef.current = event.data.contentLength ?? null
          downloadedBytesRef.current = 0
          setProgress(0)
          return
        }

        if (event.event === 'Progress') {
          downloadedBytesRef.current += event.data.chunkLength
          const totalBytes = totalBytesRef.current

          if (!totalBytes) {
            setProgress(null)
            return
          }

          const nextValue = (downloadedBytesRef.current / totalBytes) * 100
          setProgress(Math.min(99, Math.round(nextValue)))
          return
        }

        setProgress(100)
      })

      await clearUpdateResource()
      await window.api.app.restart()
    } catch (error) {
      const nextMessage = error instanceof Error ? error.message : 'Update installation failed'
      setMessage(nextMessage)
      setPhase('error')
    }
  }, [clearUpdateResource])

  useEffect(() => {
    if (import.meta.env.PROD) {
      void (async () => {
        await checkForUpdates(false)
      })()
    }

    let unlisten: (() => void) | undefined
    void listen('app:update:check', () => {
      void checkForUpdates(true)
    }).then((cleanup) => {
      unlisten = cleanup
    })

    return () => {
      unlisten?.()
      void updateRef.current?.close().catch(() => {})
    }
  }, [checkForUpdates])

  const isBusy = phase === 'checking' || phase === 'installing'
  const label =
    phase === 'available' && version
      ? `Install v${version}`
      : phase === 'checking'
        ? 'Checking...'
        : phase === 'installing'
          ? progress !== null
            ? `Installing ${progress}%`
            : 'Installing...'
          : phase === 'up-to-date'
            ? 'Up to date'
            : 'Check updates'

  const icon =
    phase === 'available' ? (
      <ArrowDownToLine size={13} />
    ) : phase === 'checking' || phase === 'installing' ? (
      <Loader2 size={13} className="animate-spin" />
    ) : (
      <RefreshCw size={13} />
    )

  const variant = phase === 'available' ? 'primary' : 'secondary'

  return (
    <div className="flex min-w-[170px] max-w-[280px] flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        <GlassButton
          variant={variant}
          size="sm"
          onClick={phase === 'available' ? installUpdate : () => void checkForUpdates(true)}
          disabled={isBusy}
          icon={icon}
          className={cn('whitespace-nowrap', phase === 'error' && 'border-red-500/30')}
        >
          {label}
        </GlassButton>
        {phase === 'available' && version && releaseBody && (
          <button
            onClick={() => setShowReleaseNotes(true)}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all"
            title="View release notes"
          >
            <Info size={14} />
          </button>
        )}
      </div>
      {message && phase !== 'available' ? (
        <p
          className={cn(
            'max-w-[280px] truncate text-[10px] leading-tight text-muted-foreground',
            phase === 'error' && 'text-red-700 dark:text-red-300',
            phase === 'up-to-date' && 'text-green-700 dark:text-green-300'
          )}
          title={message}
        >
          {message}
        </p>
      ) : null}
      {phase === 'available' && version && releaseBody && (
        <ReleaseNotesModal
          isOpen={showReleaseNotes}
          onClose={() => setShowReleaseNotes(false)}
          version={version}
          body={releaseBody}
        />
      )}
    </div>
  )
}

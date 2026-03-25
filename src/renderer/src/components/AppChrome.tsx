import React, { useState, useEffect } from 'react'
import { ChevronLeft, Moon, Plus, Settings2, Sun, WandSparkles } from 'lucide-react'
import { Pair } from '../store/usePairStore'
import { cn } from '../lib/utils'
import { StatusBadge } from './StatusBadge'
import { GlassButton } from './ui/GlassButton'
import appIcon from '../assets/app-icon.png'

interface AppChromeProps {
  selectedPair?: Pair | null
  readyModelCount: number
  totalModelCount: number
  theme: 'light' | 'dark'
  onToggleTheme: () => void
  onNewPair: () => void
  onBack?: () => void
  onAssignTask?: () => void
  onOpenSettings?: () => void
}

function isBusy(status: Pair['status']): boolean {
  return (
    status === 'Mentoring' ||
    status === 'Executing' ||
    status === 'Reviewing' ||
    status === 'Awaiting Human Review'
  )
}

export function AppChrome({
  selectedPair,
  readyModelCount,
  totalModelCount,
  theme,
  onToggleTheme,
  onNewPair,
  onBack,
  onAssignTask,
  onOpenSettings
}: AppChromeProps): React.ReactNode {
  const isMac =
    typeof navigator !== 'undefined' &&
    /(mac|iphone|ipad|ipod)/i.test(navigator.userAgent || navigator.platform)

  const pairBusy = selectedPair ? isBusy(selectedPair.status) : false

  const [appVersion, setAppVersion] = useState<string | null>(null)

  useEffect(() => {
    console.log('[AppChrome] api:', window.api)
    console.log('[AppChrome] config:', window.api?.config)
    console.log('[AppChrome] getVersion:', window.api?.config?.getVersion)
    window.api?.config
      ?.getVersion?.()
      .then((v: string) => {
        console.log('[AppChrome] version:', v)
        setAppVersion(v)
      })
      .catch((e: Error) => {
        console.error('[AppChrome] getVersion error:', e)
      })
  }, [])

  return (
    <div className="app-chrome glass-toolbar relative shrink-0 border-b border-border/60">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-foreground/12 to-transparent" />
      <div
        className={cn(
          'app-drag relative flex items-center justify-between gap-4 px-4 py-3',
          isMac ? 'pl-24' : 'pl-4'
        )}
      >
        <div className="flex min-w-0 items-center gap-3">
          {selectedPair ? (
            <button
              onClick={onBack}
              className="app-no-drag flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-muted/50 text-muted-foreground transition-all hover:bg-muted hover:text-foreground"
            >
              <ChevronLeft size={18} />
            </button>
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-gradient-to-br from-background via-muted/70 to-background shadow-sm overflow-hidden">
              <img src={appIcon} alt="The Pair" className="h-5 w-5 object-contain" />
            </div>
          )}

          <div className="min-w-0 flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-sm font-semibold tracking-tight text-foreground">
                {selectedPair ? selectedPair.name : 'The Pair'}
              </h1>
              <span className="rounded bg-blue-500 px-2 py-0.5 text-xs font-bold text-white">
                v{appVersion && appVersion !== '0.0.0' ? appVersion : '1.0.1'}
              </span>
              {selectedPair ? <StatusBadge status={selectedPair.status} /> : null}
              {selectedPair?.pendingMentorModel || selectedPair?.pendingExecutorModel ? (
                <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-amber-700 dark:text-amber-300">
                  Models queued
                </span>
              ) : null}
            </div>
            <p className="truncate text-xs text-muted-foreground">
              {selectedPair
                ? selectedPair.spec || selectedPair.directory
                : `${readyModelCount}/${totalModelCount} detected models are ready for pair execution`}
            </p>
          </div>
        </div>

        <div className="app-no-drag flex shrink-0 items-center gap-2">
          {!selectedPair && (
            <div className="hidden rounded-full border border-border bg-background/60 px-3 py-2 text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground md:block">
              Desktop orchestration cockpit
            </div>
          )}

          {selectedPair && (
            <>
              <GlassButton
                variant="secondary"
                size="sm"
                onClick={onOpenSettings}
                icon={<Settings2 size={13} />}
              >
                Models
              </GlassButton>
              <GlassButton
                variant="primary"
                size="sm"
                onClick={onAssignTask}
                disabled={pairBusy}
                icon={<WandSparkles size={13} />}
              >
                New Task
              </GlassButton>
            </>
          )}

          <button
            onClick={onToggleTheme}
            className="flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-muted/40 text-muted-foreground transition-all hover:bg-muted hover:text-foreground"
            title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
          >
            {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
          </button>

          <GlassButton variant="secondary" size="sm" onClick={onNewPair} icon={<Plus size={13} />}>
            New Pair
          </GlassButton>
        </div>
      </div>
    </div>
  )
}

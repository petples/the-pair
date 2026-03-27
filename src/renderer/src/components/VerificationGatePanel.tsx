import React from 'react'
import { AlertTriangle, Loader2, ShieldAlert, ShieldCheck, FileText } from 'lucide-react'
import { cn } from '../lib/utils'
import {
  formatVerificationCheckStatusLabel,
  formatVerificationNextActionLabel,
  formatVerificationPhaseLabel,
  formatVerificationRiskLabel,
  type VerificationState
} from '../lib/verificationGate'

interface VerificationGatePanelProps {
  verification: VerificationState
}

function formatTimestamp(ts?: number | null): string {
  if (!ts) return 'pending'

  const date = new Date(ts)
  return `${date.getMonth() + 1}/${date.getDate()} ${date
    .getHours()
    .toString()
    .padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`
}

function getPhaseClasses(phase: VerificationState['phase']): string {
  switch (phase) {
    case 'running':
      return 'border-blue-500/25 bg-blue-500/10 text-blue-700 dark:text-blue-300'
    case 'awaitingVerdict':
      return 'border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300'
    case 'passed':
      return 'border-green-500/25 bg-green-500/10 text-green-700 dark:text-green-300'
    case 'failed':
      return 'border-red-500/25 bg-red-500/10 text-red-700 dark:text-red-300'
    default:
      return 'border-border/50 bg-background/40 text-muted-foreground'
  }
}

function getPhaseIcon(phase: VerificationState['phase']): React.ReactNode {
  switch (phase) {
    case 'running':
    case 'awaitingVerdict':
      return <Loader2 size={12} className="animate-spin" />
    case 'passed':
      return <ShieldCheck size={12} />
    case 'failed':
      return <ShieldAlert size={12} />
    default:
      return <FileText size={12} />
  }
}

function getCheckStatusClasses(status: string): string {
  switch (status) {
    case 'passed':
      return 'border-green-500/20 bg-green-500/10 text-green-700 dark:text-green-300'
    case 'failed':
      return 'border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-300'
    case 'skipped':
      return 'border-border/50 bg-background/30 text-muted-foreground'
    default:
      return 'border-border/50 bg-background/30 text-muted-foreground'
  }
}

function getAutonomousRetryCopy(verdict: NonNullable<VerificationState['verdict']>): string {
  if (verdict.status === 'fail') {
    return 'The mentor said this iteration is not done yet. The executor will try again automatically.'
  }

  if (verdict.nextAction === 'continue') {
    return 'The mentor approved the work so far and asked for another automatic iteration.'
  }

  return 'The mentor requested human review, but this pair is configured to keep iterating automatically.'
}

export function VerificationGatePanel({
  verification
}: VerificationGatePanelProps): React.ReactNode {
  const report = verification.report
  const verdict = verification.verdict
  const hasReport = Boolean(report)
  const hasVerdict = Boolean(verdict)
  const hasAutonomousRetry = Boolean(verdict && verdict.nextAction !== 'finish')
  const autonomousRetryTone =
    verdict?.status === 'fail'
      ? 'border-amber-500/20 bg-amber-500/8 text-amber-700 dark:text-amber-300'
      : 'border-blue-500/20 bg-blue-500/8 text-blue-700 dark:text-blue-300'
  const checkCounts = report
    ? report.checks.reduce(
        (acc, check) => {
          acc[check.status] += 1
          return acc
        },
        { passed: 0, failed: 0, skipped: 0 }
      )
    : null

  return (
    <div>
      <h3 className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        Verification Gate
      </h3>
      <div className="glass-card rounded-2xl p-4 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div
              className={cn(
                'flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border',
                getPhaseClasses(verification.phase)
              )}
            >
              {getPhaseIcon(verification.phase)}
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Verification Gate
              </div>
              <div className="truncate text-sm font-medium text-foreground">
                {formatVerificationPhaseLabel(verification.phase)}
              </div>
            </div>
          </div>
          <span className="rounded-full border border-border/50 bg-background/50 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
            {formatVerificationRiskLabel(verification.riskLevel)}
          </span>
        </div>

        {verification.error && (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/8 p-3 text-[11px] leading-relaxed text-red-700 dark:text-red-300">
            <div className="mb-1 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em]">
              <AlertTriangle size={11} />
              Verification error
            </div>
            <div className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
              {verification.error}
            </div>
          </div>
        )}

        {hasAutonomousRetry && verdict && !verification.error && (
          <div className={cn('rounded-2xl border p-3 text-[11px] leading-relaxed', autonomousRetryTone)}>
            <div className="mb-1 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em]">
              <Loader2 size={11} className="animate-spin" />
              Automatic retry
            </div>
            <div className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
              {getAutonomousRetryCopy(verdict)}
            </div>
          </div>
        )}

        {hasReport && report && (
          <div className="space-y-3 rounded-2xl border border-border/40 bg-background/30 p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Report
              </span>
              <span className="text-[9px] font-mono text-muted-foreground/60">
                {formatTimestamp(report.startedAt)} - {formatTimestamp(report.finishedAt)}
              </span>
            </div>

            <p className="text-sm leading-relaxed text-foreground/90">{report.summary}</p>

            {checkCounts && (
              <div className="grid grid-cols-3 gap-2 text-[10px]">
                <div className="rounded-xl border border-green-500/15 bg-green-500/8 px-2 py-1.5 text-green-700 dark:text-green-300">
                  {checkCounts.passed} passed
                </div>
                <div className="rounded-xl border border-red-500/15 bg-red-500/8 px-2 py-1.5 text-red-700 dark:text-red-300">
                  {checkCounts.failed} failed
                </div>
                <div className="rounded-xl border border-border/40 bg-background/40 px-2 py-1.5 text-muted-foreground">
                  {checkCounts.skipped} skipped
                </div>
              </div>
            )}

            <div className="space-y-2">
              {report.checks.map((check) => (
                <div
                  key={`${check.name}-${check.command}`}
                  className="rounded-xl border border-border/40 bg-background/30 p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-xs font-semibold text-foreground">
                        {check.name}
                      </div>
                      <div className="truncate font-mono text-[10px] text-muted-foreground/70">
                        {check.command}
                      </div>
                    </div>
                    <span
                      className={cn(
                        'shrink-0 rounded-full border px-2 py-1 text-[9px] font-bold uppercase tracking-[0.18em]',
                        getCheckStatusClasses(check.status)
                      )}
                    >
                      {formatVerificationCheckStatusLabel(check.status)}
                    </span>
                  </div>

                  <div className="mt-2 text-[11px] leading-relaxed text-muted-foreground/85">
                    {check.summary}
                  </div>

                  <div className="mt-2 flex items-center justify-between gap-2 text-[10px] text-muted-foreground/55">
                    <span>{check.durationMs}ms</span>
                    <span>
                      exit {check.exitCode === null ? 'n/a' : check.exitCode.toString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {hasVerdict && verdict && (
          <div className="rounded-2xl border border-border/40 bg-background/30 p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Verdict
              </span>
              <span
                className={cn(
                  'rounded-full border px-2 py-1 text-[9px] font-bold uppercase tracking-[0.18em]',
                  verdict.status === 'pass'
                    ? 'border-green-500/20 bg-green-500/10 text-green-700 dark:text-green-300'
                    : 'border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-300'
                )}
              >
                {verdict.status}
              </span>
            </div>
            <p className="text-sm leading-relaxed text-foreground/90">{verdict.summary}</p>
            <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-muted-foreground/70">
              <span className="rounded-full border border-border/40 bg-background/40 px-2 py-1">
                risk {formatVerificationRiskLabel(verdict.riskLevel)}
              </span>
              <span className="rounded-full border border-border/40 bg-background/40 px-2 py-1">
                next {formatVerificationNextActionLabel(verdict.nextAction)}
              </span>
              <span className="rounded-full border border-border/40 bg-background/40 px-2 py-1">
                {verdict.evidence.length} evidence items
              </span>
            </div>
          </div>
        )}

        {!hasReport && !verification.error && (
          <div className="rounded-2xl border border-border/40 bg-background/30 p-3 text-[11px] leading-relaxed text-muted-foreground/75">
            Verification has not started yet. When the pair reaches the review gate, this panel
            will show the automated checks and the mentor&apos;s verdict.
          </div>
        )}
      </div>
    </div>
  )
}

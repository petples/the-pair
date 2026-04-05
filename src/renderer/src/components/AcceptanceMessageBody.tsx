import { ShieldAlert, ShieldCheck } from 'lucide-react'
import { cn } from '../lib/utils'
import { parseAcceptanceVerdict } from '../lib/acceptance'
import { MarkdownContent } from './MarkdownContent'

export function AcceptanceMessageBody({ content }: { content: string }): React.ReactNode {
  let verdict
  try {
    verdict = parseAcceptanceVerdict(content)
  } catch (err) {
    console.warn('[AcceptanceMessageBody] Failed to parse acceptance verdict:', err)
    return <MarkdownContent content={content} />
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={cn(
            'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em]',
            verdict.verdict === 'pass'
              ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300'
              : 'border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-300'
          )}
        >
          {verdict.verdict === 'pass' ? <ShieldCheck size={11} /> : <ShieldAlert size={11} />}
          {verdict.verdict}
        </span>
        <span className="rounded-full border border-border/40 bg-background/40 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground/80">
          risk {verdict.risk}
        </span>
        <span className="rounded-full border border-border/40 bg-background/40 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground/80">
          next {verdict.nextStep.action}
        </span>
      </div>

      <p className="text-[13px] leading-relaxed text-foreground/90">{verdict.summary}</p>

      <div className="space-y-1">
        <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
          Evidence
        </div>
        <ul className="space-y-1 text-[12px] leading-relaxed text-foreground/85">
          {verdict.evidence.map((item) => (
            <li key={item} className="flex gap-2">
              <span className="text-muted-foreground/50">•</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>

      {verdict.nextStep.instructions.length > 0 && (
        <div className="space-y-1">
          <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
            Next Step
          </div>
          <ol className="space-y-1 text-[12px] leading-relaxed text-foreground/85">
            {verdict.nextStep.instructions.map((step, index) => (
              <li key={`${index}-${step}`} className="flex gap-2">
                <span className="text-muted-foreground/50">{index + 1}.</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  )
}

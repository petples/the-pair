import React from 'react'
import { cn } from '../lib/utils'
import { TimelineEventItem } from './TimelineEventItem'
import type { IterationGroup } from '../lib/timeline'
import { formatDuration, formatTokenCount } from '../lib/timeline'

interface TimelineIterationGroupProps {
  group: IterationGroup
  isLast: boolean
}

export function TimelineIterationGroup({
  group,
  isLast
}: TimelineIterationGroupProps): React.JSX.Element {
  return (
    <div className={cn(!isLast && 'pb-4 border-b border-border/30 mb-4')}>
      {/* Iteration header */}
      <div className="mb-2 flex items-center gap-2">
        <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
          Iteration {group.iteration}
        </span>
        <span className="text-[9px] font-mono text-muted-foreground/50">
          {formatDuration(group.durationMs)}
        </span>
        {group.totalTokens > 0 && (
          <span className="text-[9px] font-mono text-muted-foreground/50">
            {formatTokenCount(group.totalTokens)} tok
          </span>
        )}
      </div>

      {/* Events */}
      <div className="pl-1">
        {group.events.map((event, idx) => (
          <TimelineEventItem
            key={event.id}
            event={event}
            isFirst={idx === 0}
            isLast={idx === group.events.length - 1}
          />
        ))}
      </div>
    </div>
  )
}

import React from 'react'
import { cn } from '../../lib/utils'
import { motion } from 'framer-motion'
import { Cpu, HardDrive } from 'lucide-react'

interface ResourceMeterProps {
  cpu: number
  mem: number
  className?: string
}

export function ResourceMeter({ cpu, mem, className }: ResourceMeterProps): React.ReactNode {
  return (
    <div className={cn('grid grid-cols-2 gap-3', className)}>
      <MeterBar icon={<Cpu size={14} />} label="CPU" value={cpu} max={100} unit="%" color="blue" />
      <MeterBar
        icon={<HardDrive size={14} />}
        label="MEM"
        value={mem}
        max={8192}
        unit="MB"
        color="purple"
      />
    </div>
  )
}

interface MeterBarProps {
  icon: React.ReactNode
  label: string
  value: number
  max: number
  unit: string
  color: 'blue' | 'purple' | 'green' | 'amber'
}

function MeterBar({ icon, label, value, max, unit, color }: MeterBarProps): React.ReactNode {
  const percent = Math.min((value / max) * 100, 100)

  const colorMap = {
    blue: {
      bar: 'bg-blue-500 dark:bg-blue-400',
      glow: 'shadow-blue-500/40 dark:shadow-blue-400/50',
      text: 'text-blue-600 dark:text-blue-300'
    },
    purple: {
      bar: 'bg-purple-500 dark:bg-purple-400',
      glow: 'shadow-purple-500/40 dark:shadow-purple-400/50',
      text: 'text-purple-600 dark:text-purple-300'
    },
    green: {
      bar: 'bg-green-500 dark:bg-green-400',
      glow: 'shadow-green-500/40 dark:shadow-green-400/50',
      text: 'text-green-600 dark:text-green-300'
    },
    amber: {
      bar: 'bg-amber-500 dark:bg-amber-400',
      glow: 'shadow-amber-500/40 dark:shadow-amber-400/50',
      text: 'text-amber-600 dark:text-amber-300'
    }
  }

  const c = colorMap[color]

  return (
    <div className="glass-card p-3 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className={c.text}>{icon}</span>
          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
            {label}
          </span>
        </div>
        <span className="text-sm font-mono font-semibold text-foreground">
          {value}
          <span className="text-[10px] text-muted-foreground ml-0.5">{unit}</span>
        </span>
      </div>
      <div className="h-1 rounded-full bg-muted overflow-hidden dark:bg-white/8">
        <motion.div
          className={cn('h-full rounded-full shadow-lg', c.bar, c.glow)}
          initial={{ width: 0 }}
          animate={{ width: `${percent}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      </div>
    </div>
  )
}

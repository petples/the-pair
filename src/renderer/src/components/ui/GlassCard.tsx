import React from 'react'
import { cn } from '../../lib/utils'
import { motion } from 'framer-motion'
import { cardHover } from '../../lib/animations'

interface GlassCardProps {
  children: React.ReactNode
  className?: string
  hoverable?: boolean
  onClick?: () => void
  glow?: 'blue' | 'purple' | 'green' | 'amber' | 'none'
}

const glowMap = {
  blue: 'shadow-blue-500/20 dark:shadow-blue-500/30',
  purple: 'shadow-purple-500/20 dark:shadow-purple-500/30',
  green: 'shadow-green-500/20 dark:shadow-green-500/30',
  amber: 'shadow-amber-500/20 dark:shadow-amber-500/30',
  none: ''
}

export function GlassCard({
  children,
  className,
  hoverable = false,
  onClick,
  glow = 'none'
}: GlassCardProps): React.ReactNode {
  const Component = hoverable ? motion.div : 'div'
  const motionProps = hoverable
    ? {
        initial: 'idle' as const,
        whileHover: 'hover' as const,
        variants: cardHover as typeof cardHover
      }
    : {}

  return (
    <Component
      onClick={onClick}
      className={cn(
        'glass-card',
        hoverable && 'glass-card-hover cursor-pointer',
        glow !== 'none' && `shadow-lg ${glowMap[glow]}`,
        onClick && 'cursor-pointer',
        className
      )}
      {...motionProps}
    >
      {children}
    </Component>
  )
}

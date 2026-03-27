import React from 'react'
import { cn } from '../../lib/utils'
import { motion } from 'framer-motion'

interface GlassButtonProps {
  children: React.ReactNode
  onClick?: React.MouseEventHandler<HTMLButtonElement>
  variant?: 'primary' | 'secondary' | 'ghost' | 'destructive' | 'approve' | 'reject'
  size?: 'sm' | 'md' | 'lg'
  className?: string
  disabled?: boolean
  type?: 'button' | 'submit'
  icon?: React.ReactNode
  'aria-label'?: string
  title?: string
}

const variantMap = {
  primary: 'bg-primary text-primary-foreground hover:bg-primary/90 border-primary',
  secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80 border-border',
  ghost: 'text-foreground hover:bg-muted/50 border-transparent',
  destructive:
    'bg-red-500/10 text-red-700 border-red-500/20 hover:bg-red-500/20 dark:bg-red-500/18 dark:text-red-200 dark:border-red-400/30 dark:hover:bg-red-500/28 dark:shadow-[0_0_0_1px_rgba(248,113,113,0.16)]',
  approve:
    'bg-green-500/15 dark:bg-green-500/20 text-green-700 dark:text-green-400 hover:bg-green-500/25 dark:hover:bg-green-500/30 border-green-500/20 dark:border-green-500/30',
  reject:
    'bg-red-500/15 dark:bg-red-500/20 text-red-700 dark:text-red-400 hover:bg-red-500/25 dark:hover:bg-red-500/30 border-red-500/20 dark:border-red-500/30'
}

const sizeMap = {
  sm: 'px-3 py-1.5 text-xs gap-1.5 rounded-lg min-h-[32px]',
  md: 'px-4 py-2 text-sm gap-2 rounded-xl min-h-[44px]',
  lg: 'px-6 py-3 text-base gap-2.5 rounded-xl min-h-[52px]'
}

export function GlassButton({
  children,
  onClick,
  variant = 'primary',
  size = 'md',
  className,
  disabled = false,
  type = 'button',
  icon,
  'aria-label': ariaLabel,
  title
}: GlassButtonProps): React.ReactNode {
  return (
    <motion.button
      type={type}
      onClick={onClick}
      disabled={disabled}
      whileTap={{ scale: 0.95 }}
      whileHover={{ scale: 1.015 }}
      aria-label={ariaLabel}
      title={title}
      className={cn(
        'flex items-center justify-center font-medium transition-all duration-200 border relative overflow-hidden',
        variantMap[variant],
        sizeMap[size],
        disabled && 'opacity-40 cursor-not-allowed pointer-events-none',
        className
      )}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      {children}
    </motion.button>
  )
}

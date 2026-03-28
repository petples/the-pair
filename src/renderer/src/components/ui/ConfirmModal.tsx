import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle } from 'lucide-react'
import { cn } from '../../lib/utils'
import { motion, AnimatePresence } from 'framer-motion'
import { overlayVariants, modalVariants } from '../../lib/animations'
import { GlassButton } from './GlassButton'

interface ConfirmModalProps {
  isOpen: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'destructive' | 'warning'
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmModal({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'destructive',
  onConfirm,
  onCancel
}: ConfirmModalProps): React.ReactNode {
  const [portalRoot] = useState<HTMLElement | null>(() => document.body)

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && isOpen) {
        onCancel()
      }
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen, onCancel])

  if (!portalRoot) return null

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          variants={overlayVariants}
          initial="hidden"
          animate="visible"
          exit="hidden"
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
          <motion.div
            className={cn('glass-modal w-full max-w-md shadow-2xl relative')}
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <div className="p-6">
              <div className="flex items-start gap-4">
                <div
                  className={cn(
                    'flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
                    variant === 'destructive'
                      ? 'bg-red-500/10 text-red-500'
                      : 'bg-amber-500/10 text-amber-500'
                  )}
                >
                  <AlertTriangle size={20} />
                </div>
                <div className="flex-1 space-y-2">
                  <h2 className="text-lg font-semibold text-foreground tracking-tight">{title}</h2>
                  <p className="text-sm text-muted-foreground leading-relaxed">{message}</p>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 pb-6 border-t border-border/50 pt-4">
              <GlassButton variant="ghost" onClick={onCancel}>
                {cancelLabel}
              </GlassButton>
              <GlassButton variant="destructive" onClick={onConfirm}>
                {confirmLabel}
              </GlassButton>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    portalRoot
  )
}

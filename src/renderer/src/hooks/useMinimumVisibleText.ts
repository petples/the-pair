import { useState, useEffect, useRef } from 'react'

/**
 * A hook that ensures text is visible for at least a minimum duration
 * before updating to prevent flickering when text changes rapidly.
 */
export function useMinimumVisibleText(text: string, resetKey: string, minimumMs = 1200): string {
  const [visibleText, setVisibleText] = useState(text)
  const visibleTextRef = useRef(text)
  const latestTextRef = useRef(text)
  const lastChangeAtRef = useRef(0)
  const timeoutRef = useRef<number | null>(null)

  useEffect(() => {
    latestTextRef.current = text
  }, [text])

  useEffect(() => {
    visibleTextRef.current = latestTextRef.current
    lastChangeAtRef.current = Date.now()
    setVisibleText(latestTextRef.current)

    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }, [resetKey])

  useEffect(
    () => () => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current)
      }
    },
    []
  )

  useEffect(() => {
    if (text === visibleTextRef.current) {
      return
    }

    const commit = () => {
      visibleTextRef.current = text
      lastChangeAtRef.current = Date.now()
      setVisibleText(text)
      timeoutRef.current = null
    }

    const elapsed = Date.now() - lastChangeAtRef.current
    if (elapsed >= minimumMs) {
      commit()
      return
    }

    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current)
    }

    timeoutRef.current = window.setTimeout(commit, minimumMs - elapsed)

    return () => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
    }
  }, [minimumMs, text])

  return visibleText
}

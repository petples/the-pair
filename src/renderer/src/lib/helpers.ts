/**
 * Check if an agent is in an executing phase (thinking, using tools, or responding)
 */
export function isAgentExecuting(phase: string): boolean {
  return phase === 'thinking' || phase === 'using_tools' || phase === 'responding'
}

/**
 * Get Tailwind CSS classes for role-based styling
 */
export function getRoleColors(from: string, isHuman: boolean): string {
  if (isHuman) return 'bg-green-500/10 border-green-500/20 shadow-sm'
  if (from === 'mentor')
    return 'bg-blue-500/10 border-blue-500/20 shadow-[0_4px_12px_rgba(59,130,246,0.06)]'
  return 'bg-purple-500/10 border-purple-500/20 shadow-[0_4px_12px_rgba(168,85,247,0.06)]'
}

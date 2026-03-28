import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

export function stripSystemPrompt(content: string): string {
  let result = content

  const mentorTaskPattern = /^ROLE: MENTOR\..*?TASK:\s*/is
  if (mentorTaskPattern.test(result)) {
    result = result.replace(mentorTaskPattern, '')
  }

  const executorCmdPattern = /^### ROLE: EXECUTOR\n.*?--- COMMAND TO EXECUTE ---\n*/is
  if (executorCmdPattern.test(result)) {
    result = result.replace(executorCmdPattern, '')
  }

  const mentorReviewPattern = /^### ROLE: MENTOR\n.*?--- REVIEW REQUEST ---\n*/is
  if (mentorReviewPattern.test(result)) {
    result = result.replace(mentorReviewPattern, '')
  }

  const roleHeaderPattern = /^### ROLE: \w+\s*\n.*?\n\n/s
  if (roleHeaderPattern.test(result)) {
    result = result.replace(roleHeaderPattern, '')
  }

  result = result.replace(/^- DO NOT.*$/gm, '')
  result = result.replace(/^- You CANNOT.*$/gm, '')
  result = result.replace(/^- Never output.*$/gm, '')
  result = result.replace(/^- YOUR GOAL:.*$/gm, '')
  result = result.replace(/^- \w+ GOAL:.*$/gm, '')

  return result.replace(/\n{3,}/g, '\n\n').trim()
}

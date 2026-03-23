export type AgentTurnRole = 'mentor' | 'executor'

export type AgentTurnResult =
  | { kind: 'message'; content: string }
  | { kind: 'silent'; content: string }
  | { kind: 'error'; content: string }

export type AgentTurnDirective =
  | {
      type: 'handoff'
      nextRole: AgentTurnRole
      to: AgentTurnRole
      messageType: 'progress'
      content: string
    }
  | {
      type: 'finish'
      to: 'human'
      messageType: 'result'
      content: string
    }
  | {
      type: 'pause'
      to: 'human'
      messageType: 'question'
      content: string
    }

export const NO_TEXT_RESPONSE_PLACEHOLDER =
  '(Agent completed its turn but provided no text response. This might happen if it only performed tool calls without a final message.)'

export function buildAgentTurnResult(
  responseText: string,
  exitCode: number | null,
  errorOutput: string
): AgentTurnResult {
  const cleanOutput = responseText.trim()

  if (cleanOutput) {
    return {
      kind: 'message',
      content: cleanOutput
    }
  }

  if (exitCode === 0) {
    return {
      kind: 'silent',
      content: NO_TEXT_RESPONSE_PLACEHOLDER
    }
  }

  const lastError = errorOutput
    .split('\n')
    .filter((line) => line.includes('Error:'))
    .pop()

  return {
    kind: 'error',
    content:
      lastError ||
      `(Process exited with error code: ${exitCode}. Stderr: ${errorOutput.slice(-200)})`
  }
}

export function getAgentTurnDirective(
  role: AgentTurnRole,
  result: AgentTurnResult
): AgentTurnDirective {
  if (role === 'mentor' && result.kind === 'message' && result.content.includes('TASK_COMPLETED')) {
    return {
      type: 'finish',
      to: 'human',
      messageType: 'result',
      content: result.content
    }
  }

  if (result.kind === 'silent') {
    return {
      type: 'pause',
      to: 'human',
      messageType: 'question',
      content: `${result.content}\n\nPair paused to avoid an empty-response loop. Use Reject to ask the mentor to recover this turn.`
    }
  }

  const nextRole = role === 'mentor' ? 'executor' : 'mentor'

  return {
    type: 'handoff',
    nextRole,
    to: nextRole,
    messageType: 'progress',
    content: result.content
  }
}

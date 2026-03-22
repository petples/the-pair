export interface OpencodeJsonEvent {
  sessionID?: unknown
  part?: {
    sessionID?: unknown
  }
}

export function buildOpencodeRunArgs(model: string, sessionId?: string): string[] {
  const args = ['run', '--model', model]

  if (sessionId) {
    args.push('--session', sessionId)
  }

  args.push('--format', 'json')
  return args
}

export function extractOpencodeSessionId(event: OpencodeJsonEvent): string | null {
  if (typeof event.sessionID === 'string' && event.sessionID.length > 0) {
    return event.sessionID
  }

  if (typeof event.part?.sessionID === 'string' && event.part.sessionID.length > 0) {
    return event.part.sessionID
  }

  return null
}

export type VerificationRiskLevel = 'low' | 'medium' | 'high'

export type VerificationVerdictStatus = 'pass' | 'fail'

export type VerificationNextAction = 'continue' | 'finish' | 'humanReview'

export type VerificationCheckStatus = 'passed' | 'failed' | 'skipped'

export type VerificationPhase = 'idle' | 'running' | 'awaitingVerdict' | 'passed' | 'failed'

export type VerificationSummaryTone = 'neutral' | 'blue' | 'amber' | 'green' | 'red'

export interface VerificationCheckRun {
  name: string
  command: string
  status: VerificationCheckStatus
  exitCode: number | null
  durationMs: number
  stdout: string
  stderr: string
  summary: string
}

export interface VerificationGateReport {
  riskLevel: VerificationRiskLevel
  checks: VerificationCheckRun[]
  summary: string
  startedAt: number
  finishedAt: number
}

export interface VerificationVerdict {
  status: VerificationVerdictStatus
  riskLevel: VerificationRiskLevel
  evidence: string[]
  nextAction: VerificationNextAction
  summary: string
}

export interface VerificationState {
  phase: VerificationPhase
  riskLevel: VerificationRiskLevel
  report: VerificationGateReport | null
  verdict: VerificationVerdict | null
  rawVerdict: string | null
  error: string | null
  startedAt: number | null
  updatedAt: number
}

export interface VerificationReviewPromptContext {
  taskSpec?: string
  executorResult?: string
}

export interface VerificationRetryPromptContext {
  taskSpec?: string
  executorResult?: string
  mentorOutput?: string
  verdict?: VerificationVerdict | null
}

export interface VerificationSummaryChip {
  tone: VerificationSummaryTone
  text: string
}

export function idleVerificationState(): VerificationState {
  return {
    phase: 'idle',
    riskLevel: 'low',
    report: null,
    verdict: null,
    rawVerdict: null,
    error: null,
    startedAt: null,
    updatedAt: 0
  }
}

export function buildVerificationReviewPrompt(
  report: VerificationGateReport,
  context: VerificationReviewPromptContext = {}
): string {
  const sections: string[] = [
    'You are the MENTOR reviewing an automated verification gate report.',
    '',
    'Return STRICT JSON ONLY. Do not use markdown, code fences, or commentary.',
    'Use exactly this schema:',
    '{',
    '  "status": "pass" | "fail",',
    '  "riskLevel": "low" | "medium" | "high",',
    '  "evidence": ["..."],',
    '  "nextAction": "continue" | "finish",',
    '  "summary": "..."',
    '}',
    '',
    'Rules:',
    '- Use "pass" when the evidence supports moving forward.',
    '- Use "fail" when the evidence shows the work is not acceptable.',
    '- Use "continue" when the run should return to execution.',
    '- Use "finish" only when the mission is complete.',
    '- Do not ask for human review; the pair must keep iterating autonomously.',
    '- Keep the summary short and specific.'
  ]

  if (context.taskSpec?.trim()) {
    sections.push('', '### TASK SPEC', context.taskSpec.trim())
  }

  if (context.executorResult?.trim()) {
    sections.push('', '### EXECUTOR RESULT', context.executorResult.trim())
  }

  sections.push('', '### VERIFICATION REPORT', JSON.stringify(report, null, 2))
  return sections.join('\n')
}

export function buildVerificationRetryPrompt(
  report: VerificationGateReport,
  context: VerificationRetryPromptContext = {}
): string {
  const sections: string[] = [
    'You are the EXECUTOR continuing an autonomous verification retry loop.',
    'The mentor has already reviewed the last attempt and wants another iteration.',
    '',
    'Return concrete implementation work and results.',
    'Do not create a new plan.',
    'Do not ask for human review.',
    'Address the mentor feedback and keep iterating from the current codebase state.',
    'You CANNOT declare the task complete. Only the MENTOR can decide when to finish.',
    'Never output "TASK_COMPLETE" - this is reserved for MENTOR only.'
  ]

  if (context.taskSpec?.trim()) {
    sections.push('', '### TASK SPEC', context.taskSpec.trim())
  }

  if (context.executorResult?.trim()) {
    sections.push('', '### PREVIOUS EXECUTOR RESULT', context.executorResult.trim())
  }

  if (context.mentorOutput?.trim()) {
    sections.push('', '### MENTOR OUTPUT', context.mentorOutput.trim())
  }

  if (context.verdict) {
    sections.push(
      '',
      '### MENTOR VERDICT',
      JSON.stringify(context.verdict, null, 2)
    )
  }

  sections.push('', '### VERIFICATION REPORT', JSON.stringify(report, null, 2))
  return sections.join('\n')
}

export function parseVerificationVerdict(raw: string): VerificationVerdict {
  const trimmed = raw.trim()
  if (!trimmed) {
    throw new Error('Verification verdict was empty')
  }

  const candidates = uniqueStrings([
    stripCodeFences(trimmed),
    trimmed,
    ...extractJsonObjectCandidates(trimmed)
  ])

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as unknown
      return normalizeVerificationVerdict(parsed)
    } catch {
      // Try the next candidate.
    }
  }

  throw new Error('Failed to parse verification verdict')
}

export function formatVerificationPhaseLabel(phase: VerificationPhase): string {
  switch (phase) {
    case 'idle':
      return 'Idle'
    case 'running':
      return 'Running'
    case 'awaitingVerdict':
      return 'Awaiting verdict'
    case 'passed':
      return 'Passed'
    case 'failed':
      return 'Failed'
    default:
      return phase
  }
}

export function formatVerificationRiskLabel(level: VerificationRiskLevel): string {
  switch (level) {
    case 'low':
      return 'LOW'
    case 'medium':
      return 'MEDIUM'
    case 'high':
      return 'HIGH'
    default:
      return String(level).toUpperCase()
  }
}

export function formatVerificationCheckStatusLabel(status: VerificationCheckStatus): string {
  switch (status) {
    case 'passed':
      return 'Passed'
    case 'failed':
      return 'Failed'
    case 'skipped':
      return 'Skipped'
    default:
      return status
  }
}

export function formatVerificationNextActionLabel(action: VerificationNextAction): string {
  switch (action) {
    case 'continue':
      return 'Continue'
    case 'finish':
      return 'Finish'
    case 'humanReview':
      return 'Human review'
    default:
      return action
  }
}

export function getVerificationSummaryChip(
  verification: VerificationState
): VerificationSummaryChip | null {
  const hasSignal =
    verification.phase !== 'idle' ||
    verification.report !== null ||
    verification.verdict !== null ||
    verification.error !== null

  if (!hasSignal) {
    return null
  }

  if (verification.error) {
    return {
      tone: 'red',
      text: 'Verification · Error'
    }
  }

  const hasAutonomousRetry = Boolean(
    verification.verdict && verification.verdict.nextAction !== 'finish'
  )

  let tone: VerificationSummaryTone = 'neutral'
  let statusLabel = formatVerificationPhaseLabel(verification.phase)

  if (hasAutonomousRetry && verification.verdict) {
    statusLabel = verification.verdict.status === 'fail' ? 'Retrying' : 'Continuing'
    tone = verification.verdict.status === 'fail' ? 'amber' : 'blue'
  } else {
    switch (verification.phase) {
      case 'running':
        tone = 'blue'
        break
      case 'awaitingVerdict':
        tone = 'amber'
        break
      case 'passed':
        tone = 'green'
        break
      case 'failed':
        tone = 'red'
        break
      default:
        tone = verification.report ? 'amber' : verification.verdict ? 'green' : 'neutral'
        break
    }
  }

  return {
    tone,
    text: `Verification · ${statusLabel} · ${formatVerificationRiskLabel(verification.riskLevel)}`
  }
}

function stripCodeFences(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed.startsWith('```')) {
    return trimmed
  }

  const lines = trimmed.split(/\r?\n/)
  if (lines.length <= 1) {
    return trimmed
  }

  const withoutOpening = lines.slice(1).join('\n').trim()
  const closingFence = withoutOpening.lastIndexOf('```')
  if (closingFence >= 0) {
    return withoutOpening.slice(0, closingFence).trim()
  }

  return withoutOpening.trim()
}

function extractJsonObjectCandidates(raw: string): string[] {
  const candidates: string[] = []

  for (let start = raw.indexOf('{'); start !== -1; start = raw.indexOf('{', start + 1)) {
    const end = findMatchingJsonObjectEnd(raw, start)
    if (end !== null) {
      candidates.push(raw.slice(start, end + 1).trim())
    }
  }

  return candidates
}

function findMatchingJsonObjectEnd(raw: string, start: number): number | null {
  let depth = 0
  let inString = false
  let escaped = false

  for (let index = start; index < raw.length; index++) {
    const char = raw[index]

    if (inString) {
      if (escaped) {
        escaped = false
      } else if (char === '\\') {
        escaped = true
      } else if (char === '"') {
        inString = false
      }
      continue
    }

    if (char === '"') {
      inString = true
      continue
    }

    if (char === '{' || char === '[') {
      depth += 1
      continue
    }

    if (char === '}' || char === ']') {
      depth -= 1
      if (depth < 0) {
        return null
      }

      if (char === '}' && depth === 0) {
        return index
      }
    }
  }

  return null
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
}

function normalizeVerificationVerdict(value: unknown): VerificationVerdict {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Verification verdict must be a JSON object')
  }

  const verdict = value as Record<string, unknown>
  const status = normalizeVerdictStatus(readString(verdict, 'status'))
  const riskLevel = normalizeRiskLevel(readString(verdict, 'riskLevel', 'risk_level'))
  const nextAction = normalizeNextAction(
    readString(verdict, 'nextAction', 'next_action')
  )
  const summary = readString(verdict, 'summary')
  if (!summary) {
    throw new Error('Verification verdict is missing summary')
  }

  const rawEvidence = verdict.evidence
  if (!Array.isArray(rawEvidence)) {
    throw new Error('Verification verdict is missing evidence')
  }

  const evidence = rawEvidence
    .map((entry) => {
      if (typeof entry === 'string') {
        return entry.trim()
      }
      if (entry === null || entry === undefined) {
        return ''
      }
      return String(entry).trim()
    })
    .filter(Boolean)

  return {
    status,
    riskLevel,
    evidence,
    nextAction,
    summary: summary.trim()
  }
}

function readString(
  value: Record<string, unknown>,
  ...keys: string[]
): string | undefined {
  for (const key of keys) {
    const candidate = value[key]
    if (typeof candidate === 'string') {
      const trimmed = candidate.trim()
      if (trimmed) {
        return trimmed
      }
    }
  }

  return undefined
}

function normalizeVerdictStatus(value?: string): VerificationVerdictStatus {
  const normalized = normalizeToken(value)
  if (normalized === 'pass' || normalized === 'passed') {
    return 'pass'
  }
  if (normalized === 'fail' || normalized === 'failed') {
    return 'fail'
  }

  throw new Error(`Unsupported verification verdict status: ${value ?? '<missing>'}`)
}

function normalizeRiskLevel(value?: string): VerificationRiskLevel {
  const normalized = normalizeToken(value)
  if (normalized === 'low' || normalized === 'medium' || normalized === 'high') {
    return normalized
  }

  throw new Error(`Unsupported verification risk level: ${value ?? '<missing>'}`)
}

function normalizeNextAction(value?: string): VerificationNextAction {
  const normalized = normalizeToken(value).replace(/[\s_-]+/g, '')
  if (normalized === 'continue') {
    return 'continue'
  }
  if (normalized === 'finish') {
    return 'finish'
  }
  if (normalized === 'humanreview') {
    return 'humanReview'
  }

  throw new Error(`Unsupported verification next action: ${value ?? '<missing>'}`)
}

function normalizeToken(value?: string): string {
  return (value ?? '').trim().toLowerCase()
}

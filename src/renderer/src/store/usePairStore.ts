import { create } from 'zustand'
import type {
  AvailableModel,
  CreatePairInput,
  PairModelSelection,
  RecoverableSessionSummary,
  SessionSnapshotDraft,
  SessionSnapshotRecord
} from '../types'

export type PairStatus =
  | 'Idle'
  | 'Mentoring'
  | 'Executing'
  | 'Reviewing'
  | 'Awaiting Human Review'
  | 'Error'
  | 'Finished'

export type ActivityPhase = 'idle' | 'thinking' | 'using_tools' | 'responding' | 'waiting' | 'error'

export interface AgentActivity {
  phase: ActivityPhase
  label: string
  detail?: string
  startedAt: number
  updatedAt: number
}

export interface ResourceInfo {
  cpu: number
  memMb: number
}

export interface PairResources {
  mentor: ResourceInfo
  executor: ResourceInfo
  pairTotal: ResourceInfo
}

export type FileStatus = 'A' | 'M' | 'D' | 'R' | '??'

export interface ModifiedFile {
  path: string
  status: FileStatus
  displayPath: string
}

export interface GitTracking {
  available: boolean
  rootPath?: string
}

export type AutomationMode = 'full-auto'

export interface Message {
  id: string
  timestamp: number
  from: 'mentor' | 'executor' | 'human'
  to: 'mentor' | 'executor' | 'both' | 'human'
  type: 'plan' | 'feedback' | 'progress' | 'result' | 'question' | 'handoff'
  content: string
  attachments?: { path: string; description: string }[]
  iteration: number
}

export interface TurnCard {
  id: string
  role: 'mentor' | 'executor'
  state: 'live' | 'final'
  content: string
  activity: AgentActivity
  startedAt: number
  updatedAt: number
}

export interface PairRunSummary {
  id: string
  spec: string
  status: PairStatus
  startedAt: number
  finishedAt?: number
  mentorModel: string
  executorModel: string
  iterations: number
}

export interface Pair {
  id: string
  name: string
  directory: string
  createdAt: number
  status: PairStatus
  iterations: number
  maxIterations: number
  cpuUsage: number
  memUsage: number
  spec: string
  mentorModel: string
  executorModel: string
  pendingMentorModel?: string
  pendingExecutorModel?: string
  messages: Message[]
  mentorActivity: AgentActivity
  executorActivity: AgentActivity
  mentorCpu: number
  mentorMemMb: number
  executorCpu: number
  executorMemMb: number
  modifiedFiles: ModifiedFile[]
  gitTracking: GitTracking
  automationMode: AutomationMode
  turn: 'mentor' | 'executor'
  currentTurnCard?: TurnCard
  runCount: number
  runHistory: PairRunSummary[]
  currentRunStartedAt: number
  currentRunFinishedAt?: number
}

interface PairStateSnapshot {
  pairId?: string
  status?: PairStatus | string
  iteration?: number
  maxIterations?: number
  turn?: 'mentor' | 'executor' | string
  mentorStatus?: PairStatus
  executorStatus?: PairStatus
  mentorActivity?: AgentActivity
  executorActivity?: AgentActivity
  resources?: PairResources
  modifiedFiles?: ModifiedFile[]
  gitTracking?: GitTracking
  automationMode?: AutomationMode
}

interface PairMessageEvent {
  pairId: string
  message: Message
}

interface PairHandoffEvent {
  pairId: string
  nextRole: string
}

interface PairCreatedResponse {
  pairId: string
}

interface BackendPairState {
  pairId?: string
  messages?: Message[]
}

interface PairStore {
  pairs: Pair[]
  availableModels: AvailableModel[]
  recoverableSessions: RecoverableSessionSummary[]
  isLoading: boolean
  error: string | null

  loadAvailableModels: () => Promise<void>
  loadRecoverableSessions: () => Promise<void>
  flushSnapshots: () => Promise<void>
  createPair: (
    input: Omit<CreatePairInput, 'mentor' | 'executor'> & {
      mentorModel: string
      executorModel: string
    }
  ) => Promise<void>
  assignTask: (pairId: string, spec: string, role?: string) => Promise<void>
  updatePairModels: (pairId: string, selection: PairModelSelection) => Promise<void>
  restoreSession: (pairId: string, continueRun?: boolean) => Promise<void>
  removePair: (id: string) => void
  updatePairStatus: (id: string, status: PairStatus) => void
  updatePairUsage: (id: string, cpu: number, mem: number) => void
  addMessage: (pairId: string, message: Message) => void
  setMessages: (pairId: string, messages: Message[]) => void
  syncState: (pairId: string, status: PairStatus, iteration: number) => void
  syncFullState: (pairId: string, state: Record<string, unknown>) => void
  humanFeedback: (pairId: string, approved: boolean) => Promise<void>
  retryTurn: (id: string) => Promise<void>
  initMessageListener: () => void
}

let _listenersInitialized = false

function createIdleActivity(label: string): AgentActivity {
  const now = Date.now()
  return {
    phase: 'idle',
    label,
    startedAt: now,
    updatedAt: now
  }
}

function snapshotPair(pair: Pair): SessionSnapshotDraft {
  return {
    pairId: pair.id,
    name: pair.name,
    directory: pair.directory,
    spec: pair.spec,
    status: pair.status,
    iterations: pair.iterations,
    maxIterations: pair.maxIterations,
    turn: pair.turn,
    mentorModel: pair.mentorModel,
    executorModel: pair.executorModel,
    pendingMentorModel: pair.pendingMentorModel,
    pendingExecutorModel: pair.pendingExecutorModel,
    messages: pair.messages,
    mentorActivity: pair.mentorActivity,
    executorActivity: pair.executorActivity,
    mentorCpu: pair.mentorCpu,
    mentorMemMb: pair.mentorMemMb,
    executorCpu: pair.executorCpu,
    executorMemMb: pair.executorMemMb,
    cpuUsage: pair.cpuUsage,
    memUsage: pair.memUsage,
    modifiedFiles: pair.modifiedFiles,
    gitTracking: {
      available: pair.gitTracking.available,
      rootPath: pair.gitTracking.rootPath,
      baseline: undefined,
      gitReviewAvailable: undefined
    },
    automationMode: pair.automationMode,
    currentTurnCard: pair.currentTurnCard,
    runCount: pair.runCount,
    runHistory: pair.runHistory,
    currentRunStartedAt: pair.currentRunStartedAt,
    currentRunFinishedAt: pair.currentRunFinishedAt,
    createdAt: pair.createdAt
  }
}

function snapshotToPair(snapshot: SessionSnapshotRecord): Pair {
  return {
    id: snapshot.pairId,
    name: snapshot.name,
    directory: snapshot.directory,
    createdAt: snapshot.createdAt,
    status: snapshot.status,
    iterations: snapshot.iterations,
    maxIterations: snapshot.maxIterations,
    cpuUsage: snapshot.cpuUsage,
    memUsage: snapshot.memUsage,
    spec: snapshot.spec,
    mentorModel: snapshot.mentorModel,
    executorModel: snapshot.executorModel,
    pendingMentorModel: snapshot.pendingMentorModel,
    pendingExecutorModel: snapshot.pendingExecutorModel,
    messages: snapshot.messages,
    mentorActivity: snapshot.mentorActivity,
    executorActivity: snapshot.executorActivity,
    mentorCpu: snapshot.mentorCpu,
    mentorMemMb: snapshot.mentorMemMb,
    executorCpu: snapshot.executorCpu,
    executorMemMb: snapshot.executorMemMb,
    modifiedFiles: snapshot.modifiedFiles,
    gitTracking: {
      available: snapshot.gitTracking.available,
      rootPath: snapshot.gitTracking.rootPath
    },
    automationMode: snapshot.automationMode,
    turn: snapshot.turn,
    currentTurnCard: snapshot.currentTurnCard,
    runCount: snapshot.runCount,
    runHistory: snapshot.runHistory,
    currentRunStartedAt: snapshot.currentRunStartedAt,
    currentRunFinishedAt: snapshot.currentRunFinishedAt
  }
}

function shouldSaveSnapshot(previous: Pair, next: Pair): boolean {
  return (
    previous.status !== next.status ||
    previous.turn !== next.turn ||
    previous.iterations !== next.iterations ||
    previous.currentRunFinishedAt !== next.currentRunFinishedAt ||
    previous.currentRunStartedAt !== next.currentRunStartedAt ||
    previous.runCount !== next.runCount ||
    previous.pendingMentorModel !== next.pendingMentorModel ||
    previous.pendingExecutorModel !== next.pendingExecutorModel ||
    previous.mentorModel !== next.mentorModel ||
    previous.executorModel !== next.executorModel
  )
}

async function saveSnapshotForPair(pair: Pair): Promise<void> {
  if (typeof window === 'undefined' || !window.api?.session?.saveSnapshot) return

  try {
    await window.api.session.saveSnapshot(snapshotPair(pair))
  } catch (error) {
    console.warn('[usePairStore] Failed to save session snapshot:', error)
  }
}

function isRunningStatus(status: PairStatus): boolean {
  return status === 'Mentoring' || status === 'Executing' || status === 'Reviewing'
}

function buildTurnCardContent(activity: AgentActivity, fallbackLabel: string): string {
  const detail = activity.detail?.trim()
  if (detail) return detail

  const label = activity.label.trim()
  if (label) return label

  return fallbackLabel
}

function createTurnCard(
  role: 'mentor' | 'executor',
  activity: AgentActivity,
  content: string,
  state: 'live' | 'final' = 'live'
): TurnCard {
  const now = Date.now()
  return {
    id: `turn-${role}-${now}-${Math.random().toString(36).slice(2, 8)}`,
    role,
    state,
    content,
    activity,
    startedAt: now,
    updatedAt: now
  }
}

function turnCardToMessage(card: TurnCard): Message {
  return {
    id: card.id,
    timestamp: card.updatedAt,
    from: card.role,
    to: 'human',
    type: card.role === 'mentor' ? 'plan' : 'result',
    content: card.content,
    iteration: 0
  }
}

function commitTurnCard(messages: Message[], card?: TurnCard): Message[] {
  if (!card) return messages
  return [...messages, turnCardToMessage({ ...card, state: 'final' })]
}

function sanitizeProgressDetail(
  detail: string,
  fallback: string,
  role: 'mentor' | 'executor'
): string {
  const text = detail.trim()
  if (!text) return fallback

  const lower = text.toLowerCase()
  if (
    lower === 'step_start' ||
    lower === 'step_finish' ||
    lower === 'step_end' ||
    lower === 'tool' ||
    lower === 'progress' ||
    lower === 'respond' ||
    lower === 'final' ||
    lower === 'thinking' ||
    lower === 'using_tools'
  ) {
    return fallback
  }

  if (text === text.toUpperCase() && text.length <= 24) {
    return fallback
  }

  if (text.startsWith('{') || text.startsWith('[')) {
    return fallback
  }

  if (text.includes('step_start') || text.includes('step_finish') || text.includes('step_end')) {
    return fallback
  }

  return role === 'mentor' ? text.replace(/^Mentor[:：]\s*/i, '') : text.replace(/^Executor[:：]\s*/i, '')
}

function normalizePairStatus(raw: unknown): PairStatus | undefined {
  if (typeof raw !== 'string') return undefined
  const normalized = raw.trim().toLowerCase().replace(/[_\s]+/g, '-')

  switch (normalized) {
    case 'idle':
      return 'Idle'
    case 'mentoring':
      return 'Mentoring'
    case 'executing':
      return 'Executing'
    case 'reviewing':
      return 'Reviewing'
    case 'awaiting-human-review':
      return 'Awaiting Human Review'
    case 'error':
      return 'Error'
    case 'finished':
      return 'Finished'
    default:
      return undefined
  }
}

function normalizeTurn(raw: unknown): 'mentor' | 'executor' | undefined {
  if (typeof raw !== 'string') return undefined
  const normalized = raw.trim().toLowerCase()
  if (normalized === 'mentor') return 'mentor'
  if (normalized === 'executor') return 'executor'
  return undefined
}

function createRunSummary(pair: Pair): PairRunSummary | null {
  if (!pair.spec.trim()) {
    return null
  }

  return {
    id: `${pair.id}-run-${pair.runCount}`,
    spec: pair.spec,
    status: pair.status,
    startedAt: pair.currentRunStartedAt,
    finishedAt: pair.currentRunFinishedAt ?? Date.now(),
    mentorModel: pair.mentorModel,
    executorModel: pair.executorModel,
    iterations: pair.iterations
  }
}

function resetPairForNewRun(pair: Pair, nextSpec: string, selection: PairModelSelection): Pair {
  const archivedRun = createRunSummary(pair)
  const now = Date.now()

  const userMessage: Message = {
    id: Math.random().toString(36).substring(7),
    timestamp: now,
    from: 'human',
    to: 'mentor',
    type: 'plan',
    content: `ROLE: MENTOR. Analyze the following task and provide a detailed PLAN for the EXECUTOR. DO NOT execute it yourself.\n\nTASK: ${nextSpec}`,
    iteration: 0
  }

  return {
    ...pair,
    status: 'Idle',
    iterations: 0,
    cpuUsage: 0,
    memUsage: 0,
    spec: nextSpec,
    mentorModel: selection.mentorModel,
    executorModel: selection.executorModel,
    pendingMentorModel: selection.pendingMentorModel,
    pendingExecutorModel: selection.pendingExecutorModel,
    messages: [userMessage],
    mentorActivity: createIdleActivity('Mentor idle'),
    executorActivity: createIdleActivity('Executor idle'),
    mentorCpu: 0,
    mentorMemMb: 0,
    executorCpu: 0,
    executorMemMb: 0,
    runCount: pair.runCount + 1,
    runHistory: archivedRun ? [...pair.runHistory, archivedRun] : pair.runHistory,
    currentRunStartedAt: now,
    currentRunFinishedAt: undefined,
    currentTurnCard: undefined
  }
}

function syncPairFromState(pair: Pair, state: PairStateSnapshot): Pair {
  const nextStatus = normalizePairStatus(state.status) ?? pair.status
  const nextTurn = normalizeTurn(state.turn) ?? pair.turn
  const nextMentorActivity = state.mentorActivity ?? pair.mentorActivity
  const nextExecutorActivity = state.executorActivity ?? pair.executorActivity
  const nextActiveActivity = nextTurn === 'mentor' ? nextMentorActivity : nextExecutorActivity
  const shouldHaveCurrentCard = isRunningStatus(nextStatus)
  const finishedNow =
    pair.currentRunFinishedAt === undefined &&
    (nextStatus === 'Finished' || nextStatus === 'Error') &&
    pair.status !== nextStatus

  let messages = pair.messages
  let currentTurnCard = pair.currentTurnCard

  if (currentTurnCard && currentTurnCard.role !== nextTurn) {
    messages = [...messages, turnCardToMessage({ ...currentTurnCard, state: 'final' })]
    currentTurnCard = undefined
  }

  if (shouldHaveCurrentCard) {
    const nextContent = buildTurnCardContent(
      nextActiveActivity,
      nextTurn === 'mentor' ? 'Mentor working' : 'Executor working'
    )

    if (!currentTurnCard) {
      currentTurnCard = createTurnCard(nextTurn, nextActiveActivity, nextContent, 'live')
    } else if (currentTurnCard.role === nextTurn) {
      currentTurnCard = {
        ...currentTurnCard,
        activity: nextActiveActivity,
        content: currentTurnCard.state === 'live' ? nextContent : currentTurnCard.content,
        updatedAt: nextActiveActivity.updatedAt
      }
    }
  } else if (currentTurnCard) {
    currentTurnCard = {
      ...currentTurnCard,
      activity: nextActiveActivity,
      state: 'final',
      updatedAt: nextActiveActivity.updatedAt
    }
  }

  return {
    ...pair,
    status: nextStatus,
    iterations: state.iteration ?? pair.iterations,
    turn: nextTurn,
    messages,
    currentTurnCard,
    mentorActivity: nextMentorActivity,
    executorActivity: nextExecutorActivity,
    mentorCpu: state.resources?.mentor?.cpu ?? pair.mentorCpu,
    mentorMemMb: state.resources?.mentor?.memMb ?? pair.mentorMemMb,
    executorCpu: state.resources?.executor?.cpu ?? pair.executorCpu,
    executorMemMb: state.resources?.executor?.memMb ?? pair.executorMemMb,
    cpuUsage: state.resources?.pairTotal?.cpu ?? pair.cpuUsage,
    memUsage: state.resources?.pairTotal?.memMb ?? pair.memUsage,
    modifiedFiles: state.modifiedFiles ?? pair.modifiedFiles,
    gitTracking: state.gitTracking ?? pair.gitTracking,
    automationMode: state.automationMode ?? pair.automationMode,
    currentRunFinishedAt: finishedNow ? Date.now() : pair.currentRunFinishedAt
  }
}

function parseProgressUpdate(
  content: string,
  role: 'mentor' | 'executor'
): { detail: string; phase?: ActivityPhase } | null {
  const line = content.trim()
  if (!line || line === '{}' || line === '[]') return null

  const parseJson = (raw: string): Record<string, unknown> | null => {
    try {
      return JSON.parse(raw) as Record<string, unknown>
    } catch {
      return null
    }
  }

  const event =
    parseJson(line) ??
    (line.startsWith('data:') ? parseJson(line.slice(5).trim()) : null)

  if (event) {
    const type = typeof event.type === 'string' ? event.type : ''
    const lowerType = type.toLowerCase()
    const part = (event.part as Record<string, unknown> | undefined) ?? {}
    const item = (event.item as Record<string, unknown> | undefined) ?? {}
    const partText = typeof part.text === 'string' ? part.text : ''
    const contentText = typeof event.content === 'string' ? event.content : ''
    const eventMessage = typeof event.message === 'string' ? event.message : ''
    const itemType = typeof item.type === 'string' ? item.type.toLowerCase() : ''
    const itemText =
      (typeof item.text === 'string' ? item.text : '') ||
      (typeof item.content === 'string' ? item.content : '') ||
      (typeof item.message === 'string' ? item.message : '')
    const toolName =
      typeof part.tool === 'string'
        ? part.tool
        : typeof (part.name as string | undefined) === 'string'
          ? (part.name as string)
          : ''
    const fallbackDetail =
      toolName ||
      (lowerType.includes('tool')
        ? 'Using tools'
        : lowerType.includes('step_start')
          ? 'Starting next step'
          : lowerType.includes('step_finish') || lowerType.includes('step_end')
            ? 'Step finished'
            : lowerType.includes('respond')
              ? 'Preparing response'
              : 'Working...')

    if (lowerType.includes('error') || itemType === 'error') {
      const errorDetail = itemText || eventMessage || contentText || 'Agent error'
      return {
        detail: sanitizeProgressDetail(errorDetail.slice(0, 260), 'Agent error', role),
        phase: 'error'
      }
    }

    if (lowerType.includes('tool') || itemType.includes('tool') || toolName) {
      return {
        detail: sanitizeProgressDetail(
          toolName ? `Using tool: ${toolName}` : fallbackDetail,
          fallbackDetail,
          role
        ),
        phase: 'using_tools'
      }
    }

    if (lowerType.includes('turn.started')) {
      return {
        detail: sanitizeProgressDetail(fallbackDetail, 'Starting turn', role),
        phase: 'thinking'
      }
    }

    if (lowerType.includes('step_start')) {
      return {
        detail: sanitizeProgressDetail(partText || fallbackDetail, fallbackDetail, role),
        phase: 'thinking'
      }
    }

    if (lowerType.includes('step_finish') || lowerType.includes('step_end')) {
      return {
        detail: sanitizeProgressDetail(partText || fallbackDetail, fallbackDetail, role),
        phase: 'responding'
      }
    }

    const text = partText || itemText || contentText || eventMessage
    if (text) {
      return {
        detail: sanitizeProgressDetail(text.slice(0, 260), fallbackDetail, role),
        phase: lowerType.includes('respond') ? 'responding' : 'thinking'
      }
    }

    return null
  }

  const normalized = line.replace(/^\[STDERR\]\s*/i, '').trim()
  if (!normalized) return null

  const lower = normalized.toLowerCase()
  let phase: ActivityPhase | undefined
  if (
    lower.includes('tool') ||
    lower.includes('apply_patch') ||
    lower.includes('bash') ||
    lower.includes('command')
  ) {
    phase = 'using_tools'
  } else if (lower.includes('respond') || lower.includes('final')) {
    phase = 'responding'
  } else if (lower.includes('step') || lower.includes('think') || lower.includes('plan')) {
    phase = 'thinking'
  }

  return {
    detail: normalized.slice(0, 260),
    phase
  }
}

function hasExecutablePlanShape(content: string): boolean {
  const text = content.trim()
  if (!text || text.length < 40) return false

  const hasStructuredSteps =
    /(?:^|\n)\s*(?:\d+[.)]|[-*])\s+/.test(text) ||
    /(?:^|\n)\s*(?:步骤|step|plan|执行)/i.test(text)

  // Guard against "intent-only" outputs that often lead to executor "no plan provided" replies.
  const intentOnly =
    /^(?:我来|我将|让我|I'll|I will|Let me)\b/i.test(text) && text.length < 120

  return hasStructuredSteps && !intentOnly
}

export const usePairStore = create<PairStore>((set) => ({
  pairs: [],
  availableModels: [],
  recoverableSessions: [],
  isLoading: false,
  error: null,

  initMessageListener: () => {
    if (_listenersInitialized) return
    _listenersInitialized = true

    window.api.pair.onMessage((payload) => {
      const data = payload as PairMessageEvent
      console.log('[usePairStore] onMessage received:', data)
      const incoming = data.message

      if (incoming.type === 'progress') {
        const progress = parseProgressUpdate(incoming.content, incoming.from === 'mentor' ? 'mentor' : 'executor')
        if (!progress) return

        set((state) => ({
          pairs: state.pairs.map((pair) => {
            if (pair.id !== data.pairId) return pair

            const role = incoming.from === 'mentor' ? 'mentor' : 'executor'
            const nextActivity =
              role === 'mentor'
                ? {
                    ...pair.mentorActivity,
                    phase: progress.phase ?? pair.mentorActivity.phase,
                    detail: progress.detail,
                    updatedAt: Date.now()
                  }
                : {
                    ...pair.executorActivity,
                    phase: progress.phase ?? pair.executorActivity.phase,
                    detail: progress.detail,
                    updatedAt: Date.now()
                  }

            let messages = pair.messages
            let currentTurnCard = pair.currentTurnCard

            if (currentTurnCard && currentTurnCard.role !== role) {
              messages = commitTurnCard(messages, currentTurnCard)
              currentTurnCard = undefined
            }

            const nextContent = progress.detail || buildTurnCardContent(nextActivity, 'Working...')
            if (!currentTurnCard) {
              currentTurnCard = createTurnCard(role, nextActivity, nextContent, 'live')
            } else {
              currentTurnCard = {
                ...currentTurnCard,
                activity: nextActivity,
                content: nextContent,
                state: 'live',
                updatedAt: Date.now()
              }
            }

            return role === 'mentor'
              ? {
                  ...pair,
                  messages,
                  currentTurnCard,
                  mentorActivity: nextActivity
                }
              : {
                  ...pair,
                  messages,
                  currentTurnCard,
                  executorActivity: nextActivity
                }
          })
        }))
        return
      }

      if (incoming.type === 'handoff') {
        return
      }

      set((state) => ({
        pairs: state.pairs.map((p) =>
          p.id === data.pairId
            ? (() => {
                const role = incoming.from === 'mentor' ? 'mentor' : incoming.from === 'executor' ? 'executor' : null
                if (!role) return p

                const nextActivity =
                  role === 'mentor'
                    ? {
                        ...p.mentorActivity,
                        detail: incoming.content.slice(0, 260),
                        updatedAt: Date.now()
                      }
                    : {
                        ...p.executorActivity,
                        detail: incoming.content.slice(0, 260),
                        updatedAt: Date.now()
                      }

                let messages = p.messages
                let currentTurnCard = p.currentTurnCard

                if (currentTurnCard && currentTurnCard.role === role) {
                  currentTurnCard = {
                    ...currentTurnCard,
                    activity: nextActivity,
                    content: incoming.content.trim() || currentTurnCard.content,
                    state: 'final',
                    updatedAt: Date.now()
                  }
                } else {
                  messages = [
                    ...messages,
                    {
                      ...incoming,
                      content: incoming.content.trim() || buildTurnCardContent(nextActivity, 'Working...')
                    }
                  ]
                }

                return role === 'mentor'
                  ? {
                      ...p,
                      messages,
                      currentTurnCard,
                      mentorActivity: nextActivity
                    }
                  : {
                      ...p,
                      messages,
                      currentTurnCard,
                      executorActivity: nextActivity
                    }
              })()
            : p
        )
      }))

      const currentPair = usePairStore
        .getState()
        .pairs.find((pair) => pair.id === data.pairId)
      if (currentPair) {
        void saveSnapshotForPair(currentPair)
      }
    })

    window.api.pair.onState((payload) => {
      const pairState = payload as PairStateSnapshot
      if (!pairState?.pairId) return

      let shouldSave = false
      set((state) => ({
        pairs: state.pairs.map((p) => {
          if (p.id !== pairState.pairId) return p
          const nextPair = syncPairFromState(p, pairState)
          shouldSave = shouldSave || shouldSaveSnapshot(p, nextPair)
          return nextPair
        })
      }))

      if (shouldSave) {
        const currentPair = usePairStore
          .getState()
          .pairs.find((pair) => pair.id === pairState.pairId)
        if (currentPair) {
          void saveSnapshotForPair(currentPair)
        }
      }
    })
    
    // Listen for handoff events to trigger next agent
    window.api.pair.onHandoff(async (payload) => {
      const data = payload as PairHandoffEvent
      console.log('[usePairStore] Handoff event:', data)
      
      const state = usePairStore.getState()
      const pair = state.pairs.find(p => p.id === data.pairId)
      
      if (!pair) {
        console.warn('[usePairStore] Pair not found for handoff:', data.pairId)
        return
      }

      let contextMessages = pair.messages
      try {
        const backendState = (await window.api.pair.getState(data.pairId)) as BackendPairState | null
        if (backendState?.messages?.length) {
          contextMessages = backendState.messages
        }
      } catch (error) {
        console.warn('[usePairStore] Failed to load backend state for handoff, falling back to local messages', error)
      }
      
      // Build context-aware message for the next agent
      let message = ''
      if (data.nextRole === 'executor') {
        const lastMentorMessage = [...contextMessages]
          .reverse()
          .find((m) => m.from === 'mentor' && (m.type === 'plan' || m.type === 'result'))

        if (!lastMentorMessage || !hasExecutablePlanShape(lastMentorMessage.content)) {
          const mentorRepairPrompt =
            '### ROLE: MENTOR\n' +
            'Your previous output was not an executable PLAN for the EXECUTOR.\n' +
            '- DO NOT execute.\n' +
            '- Return only a concrete PLAN with numbered steps.\n' +
            '- Each step must be directly executable by the EXECUTOR.\n\n' +
            'Please provide the corrected PLAN now.'

          const { assignTask } = state
          await assignTask(data.pairId, mentorRepairPrompt, 'mentor')
          return
        }

        message = '### ROLE: EXECUTOR\n' +
                  'Your mission is ONLY to EXECUTE the plan provided below. \n' +
                  '- DO NOT create new plans.\n' +
                  '- DO NOT review your own work.\n' +
                  '- JUST EXECUTE THE STEPS and report results.\n\n' +
                  '--- COMMAND TO EXECUTE ---\n'
        
        if (lastMentorMessage) {
          message += lastMentorMessage.content
        } else {
          message += 'The mentor has not provided a specific plan. Please analyze the current state and ask for a plan.'
        }
      } else {
        const lastExecutorMessage = [...contextMessages]
          .reverse()
          .find((m) => m.from === 'executor' && (m.type === 'plan' || m.type === 'result'))

        message = '### ROLE: MENTOR\n' +
                  'Your mission is ONLY to PLAN and REVIEW. \n' +
                  '- DO NOT execute any code or tools that modify files.\n' +
                  '- YOUR GOAL: Provide a clear, actionable plan for the EXECUTOR.\n\n' +
                  '--- REVIEW REQUEST ---\n' +
                  'The executor has finished a turn. Review their results below:\n\n'
        
        if (lastExecutorMessage) {
           message += lastExecutorMessage.content + '\n\n'
        }
        
        message += 'If the mission is complete and all requirements are satisfied, include the exact token "TASK_COMPLETE" in your final output. Otherwise, provide a refined PLAN for the next iteration.'
      }
      
      const { assignTask } = state
      await assignTask(data.pairId, message, data.nextRole)
    })
  },

  loadAvailableModels: async () => {
    try {
      const models = await window.api.config.getModels()
      set({ availableModels: models as AvailableModel[] })
    } catch (error) {
      console.error('Failed to load models:', error)
      set({ error: 'Failed to load models' })
    }
  },

  loadRecoverableSessions: async () => {
    try {
      const sessions = (await window.api.session.listRecoverable()) as RecoverableSessionSummary[]
      set({ recoverableSessions: sessions })
    } catch (error) {
      console.error('Failed to load recoverable sessions:', error)
      set({ recoverableSessions: [] })
    }
  },

  flushSnapshots: async () => {
    const pairs = usePairStore.getState().pairs
    await Promise.all(pairs.map((pair) => saveSnapshotForPair(pair)))
  },

  createPair: async (input) => {
    console.log('[usePairStore] createPair called', input)
    set({ isLoading: true, error: null })

    try {
      console.log('[usePairStore] Calling window.api.pair.create...')
      const pairProcess = await window.api.pair.create({
        name: input.name,
        directory: input.directory,
        spec: input.spec,
        mentor: { role: 'mentor', model: input.mentorModel },
        executor: { role: 'executor', model: input.executorModel }
      }) as PairCreatedResponse
      console.log('[usePairStore] Pair created:', pairProcess)

      const now = Date.now()
      const initialMessage: Message = {
        id: Math.random().toString(36).substring(7),
        timestamp: now,
        from: 'human',
        to: 'mentor',
        type: 'plan',
        content: `ROLE: MENTOR. Analyze the following task and provide a detailed PLAN for the EXECUTOR. DO NOT execute it yourself.\n\nTASK: ${input.spec}`,
        iteration: 0
      }

      const newPair: Pair = {
        id: pairProcess.pairId,
        name: input.name,
        directory: input.directory,
        createdAt: now,
        status: 'Idle',
        iterations: 0,
        maxIterations: 9999,
        cpuUsage: 0,
        memUsage: 0,
        spec: input.spec,
        mentorModel: input.mentorModel,
        executorModel: input.executorModel,
        messages: [initialMessage],
        mentorActivity: createIdleActivity('Mentor idle'),
        executorActivity: createIdleActivity('Executor idle'),
        mentorCpu: 0,
        mentorMemMb: 0,
        executorCpu: 0,
        executorMemMb: 0,
        modifiedFiles: [],
        gitTracking: { available: false },
        automationMode: 'full-auto',
        turn: 'mentor',
        runCount: 1,
        runHistory: [],
        currentRunStartedAt: now,
        currentTurnCard: undefined
      }

      set((state) => ({
        pairs: [...state.pairs, newPair],
        isLoading: false
      }))

      await saveSnapshotForPair(newPair)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create pair'
      set({
        isLoading: false,
        error: message
      })
      throw error instanceof Error ? error : new Error(message)
    }
  },

  assignTask: async (pairId, spec, role) => {
    console.log('[usePairStore] assignTask called', { pairId, spec, role })
    set({ isLoading: true, error: null })

    try {
      console.log('[usePairStore] Calling window.api.pair.assignTask...')
      await window.api.pair.assignTask(pairId, { spec, role })
      console.log('[usePairStore] assignTask call finished')

      set((state) => ({
        isLoading: false,
        pairs: state.pairs.map((pair) => {
          if (pair.id !== pairId) return pair
          
          // Only reset if this is a NEW run (i.e. role is undefined)
          if (!role) {
            return resetPairForNewRun(pair, spec, {
              mentorModel: pair.pendingMentorModel ?? pair.mentorModel,
              executorModel: pair.pendingExecutorModel ?? pair.executorModel,
              pendingMentorModel: undefined,
              pendingExecutorModel: undefined
            })
          }
          
          // For handoffs, we do NOT update the spec. The spec should remain the original mission goal.
          return pair
        })
      }))

      if (!role) {
        const currentPair = usePairStore.getState().pairs.find((pair) => pair.id === pairId)
        if (currentPair) {
          await saveSnapshotForPair(currentPair)
        }
      }
    } catch (error) {
      console.error('[usePairStore] assignTask error:', error)
      const message = error instanceof Error ? error.message : 'Failed to assign task'
      set({
        isLoading: false,
        error: message
      })
      throw error instanceof Error ? error : new Error(message)
    }
  },

  updatePairModels: async (pairId, selection) => {
    set({ isLoading: true, error: null })

    try {
      const result = await window.api.pair.updateModels(pairId, selection)
      const typedResult = result as PairModelSelection

      set((state) => ({
        isLoading: false,
        pairs: state.pairs.map((pair) =>
          pair.id === pairId
            ? {
                ...pair,
                mentorModel: typedResult.mentorModel,
                executorModel: typedResult.executorModel,
                pendingMentorModel: typedResult.pendingMentorModel,
                pendingExecutorModel: typedResult.pendingExecutorModel
              }
            : pair
        )
      }))

      const currentPair = usePairStore.getState().pairs.find((pair) => pair.id === pairId)
      if (currentPair) {
        await saveSnapshotForPair(currentPair)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update pair models'
      set({
        isLoading: false,
        error: message
      })
      throw error instanceof Error ? error : new Error(message)
    }
  },

  restoreSession: async (pairId, continueRun = true) => {
    set({ isLoading: true, error: null })

    try {
      const snapshot = (await window.api.session.restore(pairId, continueRun)) as SessionSnapshotRecord
      const pair = snapshotToPair(snapshot)

      set((state) => ({
        isLoading: false,
        pairs: state.pairs.some((existing) => existing.id === pair.id)
          ? state.pairs.map((existing) => (existing.id === pair.id ? pair : existing))
          : [...state.pairs, pair],
        recoverableSessions: state.recoverableSessions.filter((session) => session.pairId !== pair.id)
      }))

      if (!continueRun) {
        await saveSnapshotForPair(pair)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to restore session'
      set({
        isLoading: false,
        error: message
      })
      throw error instanceof Error ? error : new Error(message)
    }
  },

  removePair: (id) => {
    window.api.pair.stop(id)
    set((state) => ({
      pairs: state.pairs.filter((p) => p.id !== id),
      recoverableSessions: state.recoverableSessions.filter((session) => session.pairId !== id)
    }))
  },

  retryTurn: async (id) => {
    await window.api.pair.retryTurn(id)
  },

  updatePairStatus: (id, status) =>
    set((state) => ({
      pairs: state.pairs.map((p) => (p.id === id ? { ...p, status } : p))
    })),

  updatePairUsage: (id, cpu, mem) =>
    set((state) => ({
      pairs: state.pairs.map((p) => (p.id === id ? { ...p, cpuUsage: cpu, memUsage: mem } : p))
    })),

  addMessage: (pairId, message) =>
    set((state) => ({
      pairs: state.pairs.map((p) =>
        p.id === pairId ? { ...p, messages: [...p.messages, message] } : p
      )
    })),

  setMessages: (pairId, messages) =>
    set((state) => ({
      pairs: state.pairs.map((p) => (p.id === pairId ? { ...p, messages } : p))
    })),

  syncState: (pairId, status, iteration) =>
    set((state) => ({
      pairs: state.pairs.map((p) => (p.id === pairId ? { ...p, status, iterations: iteration } : p))
    })),

  syncFullState: (pairId, state) =>
    set((s) => ({
      pairs: s.pairs.map((p) =>
        p.id === pairId ? syncPairFromState(p, state as PairStateSnapshot) : p
      )
    })),

  humanFeedback: async (pairId, approved) => {
    await window.api.pair.humanFeedback(pairId, approved)
  }
}))

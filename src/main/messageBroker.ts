import * as fs from 'fs'
import * as path from 'path'
import { BrowserWindow } from 'electron'
import type {
  Message,
  PairState,
  CreatePairInput,
  AgentActivity,
  ActivityPhase,
  PairResources,
  ModifiedFile,
  TurnArtifact
} from './types'
import { processSpawner } from './processSpawner'
import { getAgentTurnDirective, type AgentTurnResult } from './agentTurn'
import { pairGitTracker } from './pairGitTracker'
import { pairResourceMonitor } from './pairResourceMonitor'
import {
  createPairWorktree,
  commitPairChanges,
  getDiffStat,
  getPatchExcerpt,
  getCurrentHead,
  removePairWorktree,
  type WorktreeInfo
} from './pairWorktree'
import { resetPairStateForNewTask } from './pairTaskState'

const MAX_ITERATIONS = 9999

function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + Date.now().toString(36)
}

function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true })
  }
}

function createIdleActivity(label: string = 'Idle'): AgentActivity {
  const now = Date.now()
  return {
    phase: 'idle',
    label,
    startedAt: now,
    updatedAt: now
  }
}

function updateActivity(
  activity: AgentActivity,
  phase: ActivityPhase,
  label: string,
  detail?: string
): AgentActivity {
  return {
    phase,
    label,
    detail,
    startedAt: activity.startedAt,
    updatedAt: Date.now()
  }
}

const EMPTY_RESOURCES: PairResources = {
  mentor: { cpu: 0, memMb: 0 },
  executor: { cpu: 0, memMb: 0 },
  pairTotal: { cpu: 0, memMb: 0 }
}

export class MessageBroker {
  private pairStates: Map<string, PairState> = new Map()
  private worktrees: Map<string, WorktreeInfo> = new Map()
  private preTurnHeads: Map<string, string> = new Map()

  initializePair(pairId: string, input: CreatePairInput): { worktreePath?: string } {
    const pairDir = path.join(input.directory, '.pair')
    ensureDir(pairDir)

    const specData = JSON.stringify({ spec: input.spec, name: input.name }, null, 2)
    fs.writeFileSync(path.join(pairDir, 'spec.json'), specData, 'utf-8')

    const gitTracking = pairGitTracker.detectGitRepo(input.directory)
    let modifiedFiles: ModifiedFile[] = []
    let worktreeInfo: WorktreeInfo | null = null

    if (gitTracking.available && gitTracking.rootPath) {
      gitTracking.baseline = pairGitTracker.captureBaseline(gitTracking.rootPath)
      modifiedFiles = pairGitTracker.getModifiedFiles(gitTracking.rootPath, gitTracking.baseline)

      if (gitTracking.gitReviewAvailable) {
        worktreeInfo = createPairWorktree(pairId, gitTracking.rootPath)
        if (worktreeInfo) {
          gitTracking.worktreePath = worktreeInfo.worktreePath
          gitTracking.worktreeBranch = worktreeInfo.branchName
          this.worktrees.set(pairId, worktreeInfo)
        }
      }
    }

    const state: PairState = {
      pairId,
      directory: input.directory,
      status: 'Idle',
      iteration: 0,
      maxIterations: MAX_ITERATIONS,
      turn: 'mentor',
      mentor: { status: 'Idle', turn: 'mentor', activity: createIdleActivity('Mentor idle') },
      executor: { status: 'Idle', turn: 'executor', activity: createIdleActivity('Executor idle') },
      messages: [],
      mentorActivity: createIdleActivity('Mentor idle'),
      executorActivity: createIdleActivity('Executor idle'),
      resources: { ...EMPTY_RESOURCES },
      modifiedFiles,
      gitTracking,
      automationMode: 'full-auto',
      turnArtifacts: [],
      gitReviewAvailable: gitTracking.gitReviewAvailable ?? false
    }

    this.writeStateFile(pairId, state)
    this.pairStates.set(pairId, state)

    pairResourceMonitor.registerPair(pairId, () => this.pairStates.get(pairId))

    return { worktreePath: worktreeInfo?.worktreePath }
  }

  private getPairDir(pairId: string): string | null {
    const state = this.pairStates.get(pairId)
    if (!state || !state.directory) return null
    return path.join(state.directory, '.pair')
  }

  private getStateFilePath(pairId: string): string {
    const pairDir = this.getPairDir(pairId)
    return pairDir ? path.join(pairDir, 'state.json') : ''
  }

  private writeStateFile(pairId: string, state: PairState): void {
    const statePath = this.getStateFilePath(pairId)
    if (statePath) {
      fs.writeFileSync(statePath, JSON.stringify(state, null, 2), 'utf-8')
    }
  }

  startWatching(pairId: string): void {
    const state = this.pairStates.get(pairId)
    if (!state) return

    setTimeout(() => {
      state.status = 'Mentoring'
      state.mentor.status = 'Executing'
      state.mentorActivity = updateActivity(
        state.mentorActivity,
        'thinking',
        'Analyzing task',
        'Preparing first instruction'
      )
      state.executorActivity = updateActivity(
        state.executorActivity,
        'waiting',
        'Executor standing by',
        undefined
      )
      this.notifyStateUpdate(pairId)

      const specPath = path.join(state.directory, '.pair', 'spec.json')
      let spec = 'No spec provided.'
      if (fs.existsSync(specPath)) {
        try {
          spec = JSON.parse(fs.readFileSync(specPath, 'utf-8')).spec
        } catch {
          // Ignore malformed spec files and fall back to the default message.
        }
      }

      const initialMessage = `Here is the user's task specification:\n\n${spec}\n\nPlease provide the first instruction for the Executor.`
      processSpawner.triggerTurn(pairId, 'mentor', initialMessage)
    }, 1000)
  }

  assignTask(pairId: string, input: Pick<CreatePairInput, 'name' | 'spec'>): void {
    const state = this.pairStates.get(pairId)
    if (!state) {
      throw new Error(`Unknown pair: ${pairId}`)
    }

    const pairDir = this.getPairDir(pairId)
    if (pairDir) {
      const specData = JSON.stringify({ spec: input.spec, name: input.name }, null, 2)
      fs.writeFileSync(path.join(pairDir, 'spec.json'), specData, 'utf-8')
    }

    const nextState = resetPairStateForNewTask(state)

    if (
      nextState.gitTracking.available &&
      nextState.gitTracking.rootPath &&
      !nextState.gitTracking.worktreePath
    ) {
      nextState.gitTracking.baseline = pairGitTracker.captureBaseline(
        nextState.gitTracking.rootPath
      )
    }

    this.preTurnHeads.delete(pairId)
    this.pairStates.set(pairId, nextState)
    this.writeStateFile(pairId, nextState)
    this.notifyStateUpdate(pairId)
  }

  handleAgentResponse(pairId: string, role: 'mentor' | 'executor', result: AgentTurnResult): void {
    const state = this.pairStates.get(pairId)
    if (!state) return

    if (state.iteration >= state.maxIterations) {
      state.status = 'Error'
      state.mentorActivity = updateActivity(
        state.mentorActivity,
        'error',
        'Max iterations reached',
        undefined
      )
      state.executorActivity = updateActivity(
        state.executorActivity,
        'idle',
        'Executor stopped',
        undefined
      )
      this.writeStateFile(pairId, state)
      this.notifyStateUpdate(pairId)
      return
    }

    const directive = getAgentTurnDirective(role, result)

    const newMessage: Message = {
      id: generateId(),
      timestamp: Date.now(),
      from: role,
      to: directive.to,
      type: directive.messageType,
      content: directive.content.trim(),
      iteration: state.iteration
    }

    state.messages.push(newMessage)
    state[role].lastMessage = newMessage

    if (directive.type === 'pause') {
      state.status = 'Reviewing'
      state.turn = 'mentor'
      state.mentor.status = 'Reviewing'
      state.mentorActivity = updateActivity(
        state.mentorActivity,
        'thinking',
        'Recovering from silent turn',
        undefined
      )
      state.executorActivity = updateActivity(
        state.executorActivity,
        'idle',
        'Executor idle',
        undefined
      )

      this.writeStateFile(pairId, state)
      this.notifyRenderer(pairId, newMessage)
      this.notifyStateUpdate(pairId)

      processSpawner.triggerTurn(pairId, 'mentor', directive.content)
      return
    }

    if (role === 'mentor') {
      if (directive.type === 'finish') {
        state.status = 'Finished'
        state.mentor.status = 'Finished'
        state.executor.status = 'Finished'
        state.mentorActivity = updateActivity(
          state.mentorActivity,
          'idle',
          'Task completed',
          undefined
        )
        state.executorActivity = updateActivity(
          state.executorActivity,
          'idle',
          'Executor stopped',
          undefined
        )

        this.writeStateFile(pairId, state)
        this.notifyRenderer(pairId, newMessage)
        this.notifyStateUpdate(pairId)
        return
      }

      if (state.gitReviewAvailable && state.gitTracking.worktreePath) {
        const preTurnHead = getCurrentHead(state.gitTracking.worktreePath)
        this.preTurnHeads.set(pairId, preTurnHead)
      }

      state.status = 'Executing'
      state.turn = 'executor'
      state.iteration++
      state.mentor.status = 'Idle'
      state.executor.status = 'Executing'
      state.mentorActivity = updateActivity(
        state.mentorActivity,
        'waiting',
        'Waiting for executor',
        undefined
      )
      state.executorActivity = updateActivity(
        state.executorActivity,
        'thinking',
        'Executing instruction',
        undefined
      )

      this.writeStateFile(pairId, state)
      this.notifyRenderer(pairId, newMessage)
      this.notifyStateUpdate(pairId)

      processSpawner.triggerTurn(pairId, 'executor', directive.content)
    } else {
      const preTurnHead = this.preTurnHeads.get(pairId) || ''
      let postTurnHead = ''
      let turnArtifact: TurnArtifact | null = null

      if (state.gitReviewAvailable && state.gitTracking.worktreePath) {
        postTurnHead = getCurrentHead(state.gitTracking.worktreePath)

        const commitResult = commitPairChanges(
          pairId,
          state.gitTracking.worktreePath,
          state.iteration
        )

        if (!commitResult.noChanges && commitResult.commitSha) {
          const diffStat = getDiffStat(state.gitTracking.worktreePath, commitResult.commitSha)
          const patchExcerpt = getPatchExcerpt(
            state.gitTracking.worktreePath,
            commitResult.commitSha
          )

          turnArtifact = {
            iteration: state.iteration,
            instructionSummary:
              state.messages.length > 0
                ? state.messages[state.messages.length - 2]?.content.slice(0, 200) || ''
                : '',
            preTurnHead,
            postTurnHead,
            commitSha: commitResult.commitSha,
            commitSubject: commitResult.commitSubject,
            changedFiles: state.modifiedFiles,
            statusShort: 'success',
            diffStat,
            patchExcerpt,
            executorSummary: directive.content.slice(0, 500),
            verificationSummary: 'Changes committed successfully',
            noChanges: false
          }
        } else {
          turnArtifact = {
            iteration: state.iteration,
            instructionSummary:
              state.messages.length > 0
                ? state.messages[state.messages.length - 2]?.content.slice(0, 200) || ''
                : '',
            preTurnHead,
            postTurnHead,
            changedFiles: [],
            statusShort: 'no_changes',
            diffStat: '',
            patchExcerpt: '',
            executorSummary: directive.content.slice(0, 500),
            verificationSummary: 'No file changes detected',
            noChanges: true
          }
        }

        if (turnArtifact) {
          state.turnArtifacts.push(turnArtifact)
        }
      }

      if (state.gitReviewAvailable && state.gitTracking.worktreePath) {
        state.modifiedFiles = pairGitTracker.getModifiedFilesRelative(
          state.gitTracking.worktreePath,
          state.gitTracking.worktreePath
        )
      } else if (
        state.gitTracking.available &&
        state.gitTracking.rootPath &&
        state.gitTracking.baseline
      ) {
        state.modifiedFiles = pairGitTracker.getModifiedFiles(
          state.gitTracking.rootPath,
          state.gitTracking.baseline
        )
      }

      state.status = 'Reviewing'
      state.turn = 'mentor'
      state.executor.status = 'Idle'
      state.mentor.status = 'Reviewing'
      state.executorActivity = updateActivity(
        state.executorActivity,
        'waiting',
        'Executor completed',
        undefined
      )
      state.mentorActivity = updateActivity(
        state.mentorActivity,
        'thinking',
        'Reviewing executor output',
        undefined
      )

      this.writeStateFile(pairId, state)
      this.notifyRenderer(pairId, newMessage)
      this.notifyStateUpdate(pairId)

      const reviewPacket = this.buildMentorReviewPacket(state, turnArtifact, directive.content)
      processSpawner.triggerTurn(pairId, 'mentor', reviewPacket)
    }
  }

  private buildMentorReviewPacket(
    state: PairState,
    artifact: TurnArtifact | null,
    executorSummary: string
  ): string {
    if (!state.gitReviewAvailable || !artifact) {
      return `Executor summary:\n${executorSummary}\n\nNo git changes detected in this turn.`
    }

    const header = `[MENTOR REVIEW PACKET - Iteration ${artifact.iteration}]`

    const commitInfo = artifact.commitSha
      ? `Commit: ${artifact.commitSha}\nSubject: ${artifact.commitSubject}\n`
      : 'No commit (no changes)\n'

    const diffInfo = artifact.commitSha ? `\nDiff Stat:\n${artifact.diffStat}\n` : ''

    const patchSection = artifact.patchExcerpt
      ? `\nPatch Excerpt (first 800 lines):\n${artifact.patchExcerpt}\n`
      : ''

    const instructionSummary = artifact.instructionSummary
      ? `\nOriginal Instruction:\n${artifact.instructionSummary}\n`
      : ''

    const footer = `\n[END REVIEW PACKET]
Executor's text summary:
${executorSummary}

IMPORTANT: First review the actual code changes above, then provide your feedback and next instruction.`

    return `${header}
${commitInfo}${diffInfo}${patchSection}${instructionSummary}${footer}`
  }

  humanFeedback(pairId: string, approved: boolean): void {
    const state = this.pairStates.get(pairId)
    if (!state) return

    const message: Message = {
      id: generateId(),
      timestamp: Date.now(),
      from: 'human',
      to: 'mentor', // Direct human feedback goes to mentor to adjust the plan
      type: 'feedback',
      content: approved
        ? 'The user approved the results. You may finalize the task.'
        : 'The user rejected the results. Please review and provide a new instruction to the Executor to fix the issues.',
      iteration: state.iteration
    }

    state.messages.push(message)
    state.iteration++

    if (approved) {
      state.status = 'Finished'
      state.mentor.status = 'Finished'
      state.executor.status = 'Finished'
      this.writeStateFile(pairId, state)
      this.notifyRenderer(pairId, message)
      this.notifyStateUpdate(pairId)
    } else {
      state.status = 'Mentoring'
      state.turn = 'mentor'
      state.mentor.status = 'Reviewing'
      state.executor.status = 'Idle'
      this.writeStateFile(pairId, state)
      this.notifyRenderer(pairId, message)
      this.notifyStateUpdate(pairId)

      processSpawner.triggerTurn(pairId, 'mentor', message.content)
    }
  }

  getMessages(pairId: string): Message[] {
    return this.pairStates.get(pairId)?.messages || []
  }

  getState(pairId: string): PairState | undefined {
    return this.pairStates.get(pairId)
  }

  stopPair(pairId: string): void {
    const worktreeInfo = this.worktrees.get(pairId)
    const state = this.pairStates.get(pairId)

    if (worktreeInfo && state?.gitTracking.rootPath) {
      removePairWorktree(
        worktreeInfo.worktreePath,
        worktreeInfo.branchName,
        state.gitTracking.rootPath
      )
      this.worktrees.delete(pairId)
    }

    pairResourceMonitor.unregisterPair(pairId)
    this.pairStates.delete(pairId)
  }

  retryTurn(pairId: string): void {
    const state = this.pairStates.get(pairId)
    if (!state) return

    if (state.status !== 'Error') return

    const lastMessage = state.messages[state.messages.length - 1]
    if (!lastMessage) return

    state.status = state.turn === 'mentor' ? 'Mentoring' : 'Executing'
    state.mentorActivity = updateActivity(
      state.mentorActivity,
      'thinking',
      'Retrying turn',
      undefined
    )
    state.executorActivity = updateActivity(
      state.executorActivity,
      'thinking',
      'Retrying turn',
      undefined
    )

    this.writeStateFile(pairId, state)
    this.notifyStateUpdate(pairId)

    processSpawner.triggerTurn(pairId, state.turn, lastMessage.content)
  }

  updateActivity(
    pairId: string,
    role: 'mentor' | 'executor',
    phase: ActivityPhase,
    label: string,
    detail?: string
  ): void {
    const state = this.pairStates.get(pairId)
    if (!state) return

    const activity = role === 'mentor' ? state.mentorActivity : state.executorActivity
    const updated = updateActivity(activity, phase, label, detail)

    if (role === 'mentor') {
      state.mentorActivity = updated
      state.mentor.activity = updated
    } else {
      state.executorActivity = updated
      state.executor.activity = updated
    }

    this.notifyStateUpdate(pairId)
  }

  updateResources(pairId: string, resources: PairResources): void {
    const state = this.pairStates.get(pairId)
    if (!state) return
    state.resources = resources
    this.notifyStateUpdate(pairId)
  }

  private notifyRenderer(pairId: string, message: Message): void {
    BrowserWindow.getAllWindows().forEach((win) => {
      win.webContents.send('pair:message', { pairId, message })
    })
  }

  private notifyStateUpdate(pairId: string): void {
    const state = this.pairStates.get(pairId)
    if (!state) return
    BrowserWindow.getAllWindows().forEach((win) => {
      win.webContents.send('pair:state', {
        pairId,
        status: state.status,
        iteration: state.iteration,
        maxIterations: state.maxIterations,
        turn: state.turn,
        mentorStatus: state.mentor.status,
        executorStatus: state.executor.status,
        mentorActivity: state.mentorActivity,
        executorActivity: state.executorActivity,
        resources: state.resources,
        modifiedFiles: state.modifiedFiles,
        gitTracking: state.gitTracking,
        automationMode: state.automationMode
      })
    })
  }
}

export const messageBroker = new MessageBroker()

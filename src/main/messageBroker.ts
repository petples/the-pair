import * as fs from 'fs'
import * as path from 'path'
import { BrowserWindow } from 'electron'
import type { Message, PairState, CreatePairInput } from './types'
import { processSpawner } from './processSpawner'
import { getAgentTurnDirective, type AgentTurnResult } from './agentTurn'

const MAX_ITERATIONS = 9999

function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + Date.now().toString(36)
}

function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true })
  }
}

export class MessageBroker {
  private pairStates: Map<string, PairState> = new Map()

  initializePair(pairId: string, input: CreatePairInput): void {
    const pairDir = path.join(input.directory, '.pair')
    ensureDir(pairDir)

    const specData = JSON.stringify({ spec: input.spec, name: input.name }, null, 2)
    fs.writeFileSync(path.join(pairDir, 'spec.json'), specData, 'utf-8')

    const state: PairState = {
      pairId,
      directory: input.directory,
      status: 'Idle',
      iteration: 0,
      maxIterations: MAX_ITERATIONS,
      turn: 'mentor',
      mentor: { status: 'Idle', turn: 'mentor' },
      executor: { status: 'Idle', turn: 'executor' },
      messages: []
    }

    this.writeStateFile(pairId, state)
    this.pairStates.set(pairId, state)
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
    // We no longer watch files. We directly trigger the first turn.
    const state = this.pairStates.get(pairId)
    if (!state) return

    setTimeout(() => {
      state.status = 'Mentoring'
      state.mentor.status = 'Executing'
      this.notifyStateUpdate(pairId)

      const specPath = path.join(state.directory, '.pair', 'spec.json')
      let spec = 'No spec provided.'
      if (fs.existsSync(specPath)) {
        try {
          spec = JSON.parse(fs.readFileSync(specPath, 'utf-8')).spec
        } catch {}
      }

      const initialMessage = `Here is the user's task specification:\n\n${spec}\n\nPlease provide the first instruction for the Executor.`
      processSpawner.triggerTurn(pairId, 'mentor', initialMessage)
    }, 1000)
  }

  handleAgentResponse(pairId: string, role: 'mentor' | 'executor', result: AgentTurnResult): void {
    const state = this.pairStates.get(pairId)
    if (!state) return

    // Limit iterations to prevent runaway
    if (state.iteration >= state.maxIterations) {
      state.status = 'Finished'
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
      state.status = 'Awaiting Human Review'
      state.turn = role
      state.mentor.status = role === 'mentor' ? 'Awaiting Human Review' : 'Idle'
      state.executor.status = role === 'executor' ? 'Awaiting Human Review' : 'Idle'

      this.writeStateFile(pairId, state)
      this.notifyRenderer(pairId, newMessage)
      this.notifyStateUpdate(pairId)
      return
    }

    if (role === 'mentor') {
      if (directive.type === 'finish') {
        state.status = 'Finished'
        state.mentor.status = 'Finished'
        state.executor.status = 'Finished'

        this.writeStateFile(pairId, state)
        this.notifyRenderer(pairId, newMessage)
        this.notifyStateUpdate(pairId)
        return
      }

      state.status = 'Executing'
      state.turn = 'executor'
      state.iteration++
      state.mentor.status = 'Idle'
      state.executor.status = 'Executing'

      this.writeStateFile(pairId, state)
      this.notifyRenderer(pairId, newMessage)
      this.notifyStateUpdate(pairId)

      processSpawner.triggerTurn(pairId, 'executor', directive.content)
    } else {
      // Executor finished its turn
      state.status = 'Reviewing'
      state.turn = 'mentor'
      state.executor.status = 'Idle'
      state.mentor.status = 'Reviewing'

      this.writeStateFile(pairId, state)
      this.notifyRenderer(pairId, newMessage)
      this.notifyStateUpdate(pairId)

      processSpawner.triggerTurn(pairId, 'mentor', directive.content)
    }
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
    this.pairStates.delete(pairId)
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
        executorStatus: state.executor.status
      })
    })
  }
}

export const messageBroker = new MessageBroker()

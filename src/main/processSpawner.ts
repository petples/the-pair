import { spawn, ChildProcess } from 'child_process'
import * as path from 'path'
import * as fs from 'fs'
import type { AgentRole, PairProcess, ActivityPhase, PairRuntimeSpec } from './types'
import { buildAgentTurnResult, type AgentTurnResult } from './agentTurn'
import { extractOpencodeSessionId } from './opencodeSession'
import { pairResourceMonitor } from './pairResourceMonitor'
import { messageBroker } from './messageBroker'

interface PairContext {
  directory: string
  mentorModel: string
  executorModel: string
  mentorRuntime: PairRuntimeSpec
  executorRuntime: PairRuntimeSpec
  mentorPrompt: string
  executorPrompt: string
  mentorSessionId?: string
  executorSessionId?: string
}

type ResponseHandler = (pairId: string, role: AgentRole, result: AgentTurnResult) => void

export class ProcessSpawner {
  private pairs: Map<string, PairContext> = new Map()
  private activeProcesses: Map<string, { pid: number; proc: ChildProcess }> = new Map()
  private responseHandler: ResponseHandler | null = null

  setResponseHandler(handler: ResponseHandler): void {
    this.responseHandler = handler
  }

  private buildMentorPrompt(): string {
    return `You are the MENTOR agent in a two-agent developer team.
Your goal is to complete the user's task by instructing the EXECUTOR agent.
You CANNOT execute code, modify files, or use tools yourself. You must only analyze, plan, and review.

Workflow:
1. You will receive the task specification or a progress update from the Executor.
2. If it's the first turn, break the task down and provide the FIRST clear, actionable instruction for the Executor.
3. If it's a progress update, review what the Executor did. If it succeeded, provide the NEXT instruction. If it failed, provide a solution or alternative approach.
4. Keep your instructions concise and step-by-step.
5. If the ENTIRE task is fully completed and verified, respond with EXACTLY the word "TASK_COMPLETED" and nothing else.

IMPORTANT: If the task is ONLY research/analysis with no implementation required, instruct the Executor to write findings to a file (e.g., .pair/analysis.md). For implementation tasks, proceed with code changes as normal.`
  }

  private buildExecutorPrompt(): string {
    return `You are the EXECUTOR agent in a two-agent developer team.
Your goal is to execute the step-by-step instructions given by the MENTOR agent.
You MUST use your available tools to modify code, read files, and run commands.
Do NOT make up your own plans. Only do what the Mentor asks.

Workflow:
1. You will receive an instruction from the Mentor.
2. Use your tools to execute the instruction.
3. Once you have completed the actions, or if you encounter a blocking error, formulate a response back to the Mentor.
4. Your response should summarize what you modified, the results of commands, and any errors. Be concise but informative so the Mentor can review your work.`
  }

  async spawnPair(
    pairId: string,
    mentorModel: string,
    executorModel: string,
    directory: string,
    _spec: string,
    mentorRuntime: PairRuntimeSpec,
    executorRuntime: PairRuntimeSpec
  ): Promise<PairProcess> {
    const mentorPrompt = this.buildMentorPrompt()
    const executorPrompt = this.buildExecutorPrompt()

    const pairDir = path.join(directory, '.pair')
    if (!fs.existsSync(pairDir)) {
      fs.mkdirSync(pairDir, { recursive: true })
    }

    const runtimeDir = path.join(pairDir, 'runtime', pairId)
    if (!fs.existsSync(runtimeDir)) {
      fs.mkdirSync(runtimeDir, { recursive: true })
    }

    this.pairs.set(pairId, {
      directory,
      mentorModel,
      executorModel,
      mentorRuntime,
      executorRuntime,
      mentorPrompt,
      executorPrompt
    })

    return {
      pairId,
      mentorPid: null,
      executorPid: null,
      mentorStatus: 'Idle',
      executorStatus: 'Idle',
      mentorActivity: {
        phase: 'idle',
        label: 'Mentor idle',
        startedAt: Date.now(),
        updatedAt: Date.now()
      },
      executorActivity: {
        phase: 'idle',
        label: 'Executor idle',
        startedAt: Date.now(),
        updatedAt: Date.now()
      },
      resources: {
        mentor: { cpu: 0, memMb: 0 },
        executor: { cpu: 0, memMb: 0 },
        pairTotal: { cpu: 0, memMb: 0 }
      },
      modifiedFiles: [],
      gitTracking: { available: false },
      automationMode: 'full-auto',
      turnArtifacts: [],
      gitReviewAvailable: false
    }
  }

  updatePairRuntime(
    pairId: string,
    updates: {
      mentorModel: string
      executorModel: string
      mentorRuntime: PairRuntimeSpec
      executorRuntime: PairRuntimeSpec
      resetSessions?: boolean
    }
  ): void {
    const ctx = this.pairs.get(pairId)
    if (!ctx) return

    ctx.mentorModel = updates.mentorModel
    ctx.executorModel = updates.executorModel
    ctx.mentorRuntime = updates.mentorRuntime
    ctx.executorRuntime = updates.executorRuntime

    if (updates.resetSessions) {
      ctx.mentorSessionId = undefined
      ctx.executorSessionId = undefined
    }
  }

  triggerTurn(pairId: string, role: AgentRole, message: string): void {
    const ctx = this.pairs.get(pairId)
    if (!ctx) return

    const runtime = role === 'mentor' ? ctx.mentorRuntime : ctx.executorRuntime
    const model = role === 'mentor' ? ctx.mentorModel : ctx.executorModel
    const systemPrompt = role === 'mentor' ? ctx.mentorPrompt : ctx.executorPrompt
    const processKey = `${pairId}-${role}`
    const sessionId = role === 'mentor' ? ctx.mentorSessionId : ctx.executorSessionId

    const cwd = ctx.directory

    const pairDir = path.join(ctx.directory, '.pair')
    const runtimeDir = path.join(pairDir, 'runtime', pairId)
    if (!fs.existsSync(runtimeDir)) {
      fs.mkdirSync(runtimeDir, { recursive: true })
    }

    const fullMessage = `[SYSTEM INSTRUCTIONS - STRICTLY FOLLOW THESE]\n${systemPrompt}\n\n[NEW INPUT]\n${message}`
    let messagePath: string | null = null

    // All providers use stdin for message input to avoid command-line length limits
    const runtimeArgs = runtime.argBuilder(model, sessionId)
    const cmdParts = [runtime.executable, ...runtimeArgs]

    messagePath = path.join(runtimeDir, `msg_${role}_${Date.now()}.txt`)
    fs.writeFileSync(messagePath, fullMessage, 'utf-8')
    const cmd = `${cmdParts.join(' ')} < "${messagePath}"`

    console.log('[ProcessSpawner] Executing command:', cmdParts.join(' '))
    console.log('[ProcessSpawner] Model:', model, 'SessionId:', sessionId)

    this.updateActivity(
      pairId,
      role,
      'thinking',
      role === 'mentor' ? 'Analyzing task' : 'Executing instruction',
      undefined
    )

    const proc: ChildProcess = spawn('bash', ['-c', cmd], {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe']
    })
    const pid = proc.pid!

    this.activeProcesses.set(processKey, { pid, proc })

    if (role === 'mentor') {
      pairResourceMonitor.setPids(pairId, pid, null)
    } else {
      pairResourceMonitor.setPids(pairId, null, pid)
    }

    let responseText = ''
    let errorOutput = ''
    let buffer = ''
    let lastActivityDetail = ''

    proc.stdout?.on('data', (data) => {
      buffer += data.toString()
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (!line.trim()) continue
        try {
          const event = JSON.parse(line)

          if (runtime.outputTransport === 'json-events') {
            const discoveredSessionId = extractOpencodeSessionId(event)

            if (discoveredSessionId) {
              if (role === 'mentor') {
                ctx.mentorSessionId = discoveredSessionId
              } else {
                ctx.executorSessionId = discoveredSessionId
              }
            }

            const text =
              event.part?.text ||
              event.text ||
              event.content ||
              (event.type === 'text' && event.text)

            if (text) {
              responseText += text
              this.updateActivity(
                pairId,
                role,
                'responding',
                'Writing response',
                lastActivityDetail
              )
            } else if (event.type === 'error') {
              // Capture error events from opencode JSON output
              const errorName = event.error?.name || 'UnknownError'
              const errorMessage =
                event.error?.data?.message || event.error?.message || 'Unknown error'
              errorOutput += `${errorName}: ${errorMessage}\n`
              this.updateActivity(
                pairId,
                role,
                'error',
                'Error occurred',
                `${errorName}: ${errorMessage.slice(0, 50)}`
              )
            } else if (event.type === 'tool' && event.name) {
              lastActivityDetail = `Using ${event.name}`
              this.updateActivity(pairId, role, 'using_tools', 'Running tools', lastActivityDetail)
            } else if (event.type === 'step_start') {
              this.updateActivity(pairId, role, 'thinking', 'Processing', undefined)
            }
          } else if (runtime.outputTransport === 'session-json') {
            // Codex session-json format
            if (event.type === 'thread.started' && event.thread_id) {
              if (role === 'mentor') {
                ctx.mentorSessionId = event.thread_id
              } else {
                ctx.executorSessionId = event.thread_id
              }
            } else if (event.type === 'item.completed' && event.item) {
              const item = event.item
              if (item.type === 'agent_message' && item.text) {
                responseText += item.text + '\n'
                this.updateActivity(
                  pairId,
                  role,
                  'responding',
                  'Writing response',
                  lastActivityDetail
                )
              } else if (item.type === 'command_execution') {
                const cmd = item.command || 'command'
                lastActivityDetail = `Running: ${cmd.slice(0, 50)}`
                this.updateActivity(
                  pairId,
                  role,
                  'using_tools',
                  'Running tools',
                  lastActivityDetail
                )
              }
            } else if (event.type === 'turn.started') {
              this.updateActivity(pairId, role, 'thinking', 'Processing', undefined)
            } else if (event.type === 'error') {
              const errorMessage = event.message || 'Unknown error'
              errorOutput += `Error: ${errorMessage}\n`
              this.updateActivity(
                pairId,
                role,
                'error',
                'Error occurred',
                errorMessage.slice(0, 50)
              )
            }
          } else {
            responseText += line
          }
        } catch {
          responseText += line
        }
      }
    })

    proc.stderr?.on('data', (data) => {
      errorOutput += data.toString()
    })

    proc.on('close', (code) => {
      this.activeProcesses.delete(processKey)

      if (messagePath) {
        try {
          fs.unlinkSync(messagePath)
        } catch {
          // Ignore cleanup errors for transient runtime files.
        }
      }

      const result = buildAgentTurnResult(responseText, code, errorOutput)

      if (result.kind === 'error') {
        this.updateActivity(pairId, role, 'error', 'Error occurred', result.content.slice(0, 50))
      } else {
        this.updateActivity(pairId, role, 'waiting', 'Turn completed', undefined)
      }

      if (role === 'mentor') {
        pairResourceMonitor.setPids(pairId, null, undefined)
      } else {
        pairResourceMonitor.setPids(pairId, undefined, null)
      }

      if (this.responseHandler) {
        this.responseHandler(pairId, role, result)
      }
    })

    proc.on('error', () => {
      this.updateActivity(pairId, role, 'error', 'Failed to start', undefined)
      if (role === 'mentor') {
        pairResourceMonitor.setPids(pairId, null, undefined)
      } else {
        pairResourceMonitor.setPids(pairId, undefined, null)
      }
    })
  }

  private updateActivity(
    pairId: string,
    role: AgentRole,
    phase: ActivityPhase,
    label: string,
    detail?: string
  ): void {
    try {
      messageBroker.updateActivity(pairId, role, phase, label, detail)
    } catch {
      // messageBroker might not be ready
    }
  }

  killPair(pairId: string): void {
    const mentorProc = this.activeProcesses.get(`${pairId}-mentor`)
    const executorProc = this.activeProcesses.get(`${pairId}-executor`)

    if (mentorProc) {
      try {
        process.kill(mentorProc.pid, 'SIGKILL')
      } catch {
        mentorProc.proc.kill()
      }
    }
    if (executorProc) {
      try {
        process.kill(executorProc.pid, 'SIGKILL')
      } catch {
        executorProc.proc.kill()
      }
    }

    this.activeProcesses.delete(`${pairId}-mentor`)
    this.activeProcesses.delete(`${pairId}-executor`)
    this.pairs.delete(pairId)
    pairResourceMonitor.setPids(pairId, null, null)
  }
}

export const processSpawner = new ProcessSpawner()

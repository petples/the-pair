import { spawn, ChildProcess } from 'child_process'
import * as path from 'path'
import * as fs from 'fs'
import type { AgentRole, PairProcess } from './types'
import { buildAgentTurnResult, type AgentTurnResult } from './agentTurn'
import { buildOpencodeRunArgs, extractOpencodeSessionId } from './opencodeSession'

interface PairContext {
  directory: string
  mentorModel: string
  executorModel: string
  mentorPrompt: string
  executorPrompt: string
  mentorSessionId?: string
  executorSessionId?: string
}

type ResponseHandler = (pairId: string, role: AgentRole, result: AgentTurnResult) => void

export class ProcessSpawner {
  private pairs: Map<string, PairContext> = new Map()
  private activeProcesses: Map<string, ChildProcess> = new Map()
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
5. If the ENTIRE task is fully completed and verified, respond with EXACTLY the word "TASK_COMPLETED" and nothing else.`
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
    _spec: string
  ): Promise<PairProcess> {
    const mentorPrompt = this.buildMentorPrompt()
    const executorPrompt = this.buildExecutorPrompt()

    const pairDir = path.join(directory, '.pair')
    if (!fs.existsSync(pairDir)) {
      fs.mkdirSync(pairDir, { recursive: true })
    }

    this.pairs.set(pairId, {
      directory,
      mentorModel,
      executorModel,
      mentorPrompt,
      executorPrompt
    })

    return {
      pairId,
      mentorPid: 0,
      executorPid: 0,
      mentorStatus: 'Idle',
      executorStatus: 'Idle'
    }
  }

  triggerTurn(pairId: string, role: AgentRole, message: string): void {
    const ctx = this.pairs.get(pairId)
    if (!ctx) return

    const isMac = process.platform === 'darwin'
    const model = role === 'mentor' ? ctx.mentorModel : ctx.executorModel
    const systemPrompt = role === 'mentor' ? ctx.mentorPrompt : ctx.executorPrompt
    const processKey = `${pairId}-${role}`
    const sessionId = role === 'mentor' ? ctx.mentorSessionId : ctx.executorSessionId

    // Ensure the .pair directory exists for temporary scripts
    const pairDir = path.join(ctx.directory, '.pair')
    const scriptsDir = path.join(pairDir, 'scripts')
    if (!fs.existsSync(scriptsDir)) {
      fs.mkdirSync(scriptsDir, { recursive: true })
    }

    const scriptPath = path.join(scriptsDir, `run_${role}_${Date.now()}.sh`)
    const messagePath = path.join(scriptsDir, `msg_${role}_${Date.now()}.txt`)
    
    // Write system instructions and message to a file to avoid command line length limits
    const fullMessage = `[SYSTEM INSTRUCTIONS - STRICTLY FOLLOW THESE]\n${systemPrompt}\n\n[NEW INPUT]\n${message}`
    fs.writeFileSync(messagePath, fullMessage, 'utf-8')

    const commonArgs = buildOpencodeRunArgs(model, sessionId)

    const scriptContent = isMac 
      ? `#!/bin/bash
source ~/.bash_profile 2>/dev/null || true
source ~/.zshrc 2>/dev/null || true
cd "${ctx.directory}"
cat "${messagePath}" | opencode ${commonArgs.join(' ')}
`
      : `cd "${ctx.directory}" && cat "${messagePath}" | opencode ${commonArgs.join(' ')}`

    fs.writeFileSync(scriptPath, scriptContent, { mode: 0o755 })

    let proc: ChildProcess

    if (isMac) {
      proc = spawn('bash', [scriptPath], {
        cwd: ctx.directory,
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: true
      })
    } else {
      proc = spawn('sh', [scriptPath], {
        cwd: ctx.directory,
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: true
      })
    }

    this.activeProcesses.set(processKey, proc)

    let responseText = ''
    let errorOutput = ''
    let buffer = ''

    proc.stdout?.on('data', (data) => {
      buffer += data.toString()
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (!line.trim()) continue
        try {
          const event = JSON.parse(line)
          const discoveredSessionId = extractOpencodeSessionId(event)

          if (discoveredSessionId) {
            if (role === 'mentor') {
              ctx.mentorSessionId = discoveredSessionId
            } else {
              ctx.executorSessionId = discoveredSessionId
            }
          }

          if (event.type === 'text' && event.part?.text) {
            responseText += event.part.text
          }
        } catch {
          // If it's not JSON, it might be a shell banner or something else, ignore
        }
      }
    })

    proc.stderr?.on('data', (data) => {
      errorOutput += data.toString()
    })

    proc.on('close', (code) => {
      this.activeProcesses.delete(processKey)
      
      // Cleanup temporary files
      try {
        fs.unlinkSync(scriptPath)
        fs.unlinkSync(messagePath)
      } catch {}

      const result = buildAgentTurnResult(responseText, code, errorOutput)

      if (this.responseHandler) {
        this.responseHandler(pairId, role, result)
      }
    })
  }

  killPair(pairId: string): void {
    const mentorProc = this.activeProcesses.get(`${pairId}-mentor`)
    const executorProc = this.activeProcesses.get(`${pairId}-executor`)

    if (mentorProc && mentorProc.pid) {
      try {
        process.kill(-mentorProc.pid, 'SIGKILL')
      } catch {
        mentorProc.kill()
      }
    }
    if (executorProc && executorProc.pid) {
      try {
        process.kill(-executorProc.pid, 'SIGKILL')
      } catch {
        executorProc.kill()
      }
    }

    this.activeProcesses.delete(`${pairId}-mentor`)
    this.activeProcesses.delete(`${pairId}-executor`)
    this.pairs.delete(pairId)
  }
}

export const processSpawner = new ProcessSpawner()

import os from 'os'
import pidusage from 'pidusage'
import type { PairResources } from './types'
import { messageBroker } from './messageBroker'

interface CachedStats {
  cpu: number
  memMb: number
}

interface PairMonitorState {
  mentorPid: number | null
  executorPid: number | null
  mentorCached: CachedStats
  executorCached: CachedStats
}

class PairResourceMonitor {
  private monitors: Map<
    string,
    {
      state: PairMonitorState
      getPairState: () => { resources: PairResources } | undefined
      intervalId: NodeJS.Timeout | null
    }
  > = new Map()

  registerPair(pairId: string, getPairState: () => { resources: PairResources } | undefined): void {
    this.monitors.set(pairId, {
      state: {
        mentorPid: null,
        executorPid: null,
        mentorCached: { cpu: 0, memMb: 0 },
        executorCached: { cpu: 0, memMb: 0 }
      },
      getPairState,
      intervalId: null
    })
  }

  setPids(
    pairId: string,
    mentorPid: number | null | undefined,
    executorPid: number | null | undefined
  ): void {
    const monitor = this.monitors.get(pairId)
    if (!monitor) return

    if (mentorPid !== undefined) {
      monitor.state.mentorPid = mentorPid
    }
    if (executorPid !== undefined) {
      monitor.state.executorPid = executorPid
    }

    this.startMonitoring(pairId)
  }

  private startMonitoring(pairId: string): void {
    const monitor = this.monitors.get(pairId)
    if (!monitor || monitor.intervalId) return

    monitor.intervalId = setInterval(async () => {
      const pairState = monitor.getPairState()
      if (!pairState) {
        this.stopMonitoring(pairId)
        return
      }

      const [mentorStats, executorStats] = await Promise.all([
        monitor.state.mentorPid ? this.getPidStats(monitor.state.mentorPid) : null,
        monitor.state.executorPid ? this.getPidStats(monitor.state.executorPid) : null
      ])

      if (mentorStats) {
        monitor.state.mentorCached = {
          cpu: mentorStats.cpu,
          memMb: Math.round(mentorStats.memory / (1024 * 1024))
        }
      }

      if (executorStats) {
        monitor.state.executorCached = {
          cpu: executorStats.cpu,
          memMb: Math.round(executorStats.memory / (1024 * 1024))
        }
      }

      const mentorCpu = monitor.state.mentorCached.cpu
      const mentorMem = monitor.state.mentorCached.memMb
      const executorCpu = monitor.state.executorCached.cpu
      const executorMem = monitor.state.executorCached.memMb

      const resources: PairResources = {
        mentor: { cpu: mentorCpu, memMb: mentorMem },
        executor: { cpu: executorCpu, memMb: executorMem },
        pairTotal: {
          cpu: mentorCpu + executorCpu,
          memMb: mentorMem + executorMem
        }
      }

      pairState.resources = resources

      messageBroker.updateResources(pairId, resources)
    }, 1000)
  }

  private stopMonitoring(pairId: string): void {
    const monitor = this.monitors.get(pairId)
    if (!monitor) return

    if (monitor.intervalId) {
      clearInterval(monitor.intervalId)
      monitor.intervalId = null
    }
  }

  private async getPidStats(pid: number): Promise<{ cpu: number; memory: number } | null> {
    try {
      const stats = await pidusage(pid)
      const cpuCount = os.cpus().length
      const cpuPercent = Math.min(stats.cpu / cpuCount, 100 * cpuCount)
      return {
        cpu: Math.round(cpuPercent * 100) / 100,
        memory: stats.memory
      }
    } catch {
      return null
    }
  }

  unregisterPair(pairId: string): void {
    this.stopMonitoring(pairId)
    this.monitors.delete(pairId)
  }
}

export { PairResourceMonitor }
export const pairResourceMonitor = new PairResourceMonitor()

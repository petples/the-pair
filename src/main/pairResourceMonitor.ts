import pidusage from 'pidusage'
import type { PairResources } from './types'
import { messageBroker } from './messageBroker'

interface PairMonitorState {
  mentorPid: number | null
  executorPid: number | null
}

class PairResourceMonitor {
  private monitors: Map<string, {
    state: PairMonitorState
    getPairState: () => { resources: PairResources } | undefined
    intervalId: NodeJS.Timeout | null
  }> = new Map()

  registerPair(pairId: string, getPairState: () => { resources: PairResources } | undefined): void {
    this.monitors.set(pairId, {
      state: { mentorPid: null, executorPid: null },
      getPairState,
      intervalId: null
    })
  }

  setPids(pairId: string, mentorPid: number | null, executorPid: number | null): void {
    const monitor = this.monitors.get(pairId)
    if (!monitor) return

    monitor.state.mentorPid = mentorPid
    monitor.state.executorPid = executorPid

    if (mentorPid || executorPid) {
      this.startMonitoring(pairId)
    } else {
      this.stopMonitoring(pairId)
    }
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

      const mentorCpu = mentorStats?.cpu ?? 0
      const mentorMem = mentorStats?.memory ? Math.round(mentorStats.memory / (1024 * 1024)) : 0
      const executorCpu = executorStats?.cpu ?? 0
      const executorMem = executorStats?.memory ? Math.round(executorStats.memory / (1024 * 1024)) : 0

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
      return {
        cpu: Math.round(stats.cpu * 100) / 100,
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

export const pairResourceMonitor = new PairResourceMonitor()
import assert from 'node:assert/strict'
import test from 'node:test'

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

class TestPairResourceMonitor {
  private monitors: Map<string, { state: PairMonitorState }> = new Map()

  registerPair(pairId: string): void {
    this.monitors.set(pairId, {
      state: {
        mentorPid: null,
        executorPid: null,
        mentorCached: { cpu: 0, memMb: 0 },
        executorCached: { cpu: 0, memMb: 0 }
      }
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
  }

  getMonitorState(pairId: string): PairMonitorState | undefined {
    return this.monitors.get(pairId)?.state
  }

  unregisterPair(pairId: string): void {
    this.monitors.delete(pairId)
  }
}

test('PairResourceMonitor caches last valid resource values per role', async () => {
  const monitor = new TestPairResourceMonitor()
  const pairId = 'test-pair-1'

  monitor.registerPair(pairId)
  monitor.setPids(pairId, 12345, undefined)

  const state = monitor.getMonitorState(pairId)
  assert.ok(state, 'Monitor should be registered')

  state.mentorCached = { cpu: 42.5, memMb: 256 }
  state.executorCached = { cpu: 78.3, memMb: 512 }

  monitor.setPids(pairId, null, undefined)

  assert.equal(state.mentorCached.cpu, 42.5, 'Mentor cached CPU should be preserved')
  assert.equal(state.mentorCached.memMb, 256, 'Mentor cached memory should be preserved')
  assert.equal(state.executorCached.cpu, 78.3, 'Executor cached CPU should be preserved')
  assert.equal(state.executorCached.memMb, 512, 'Executor cached memory should be preserved')

  monitor.unregisterPair(pairId)
})

test('PairResourceMonitor.setPids can update one role without clearing the other', async () => {
  const monitor = new TestPairResourceMonitor()
  const pairId = 'test-pair-2'

  monitor.registerPair(pairId)

  const state = monitor.getMonitorState(pairId)
  assert.ok(state, 'Monitor should be registered')

  monitor.setPids(pairId, 100, 200)
  assert.equal(state.mentorPid, 100, 'Mentor PID should be 100')
  assert.equal(state.executorPid, 200, 'Executor PID should be 200')

  state.mentorCached = { cpu: 50, memMb: 100 }
  state.executorCached = { cpu: 60, memMb: 200 }

  monitor.setPids(pairId, null, undefined)

  assert.equal(state.mentorPid, null, 'Mentor PID should be cleared')
  assert.equal(state.executorPid, 200, 'Executor PID should remain unchanged')

  assert.equal(state.mentorCached.cpu, 50, 'Mentor cached values should be preserved')
  assert.equal(state.executorCached.cpu, 60, 'Executor cached values should be preserved')

  monitor.unregisterPair(pairId)
})

test('PairResourceMonitor.setPids with undefined preserves existing PID', async () => {
  const monitor = new TestPairResourceMonitor()
  const pairId = 'test-pair-3'

  monitor.registerPair(pairId)

  const state = monitor.getMonitorState(pairId)
  assert.ok(state, 'Monitor should be registered')

  monitor.setPids(pairId, 100, 200)

  monitor.setPids(pairId, undefined, 300)

  assert.equal(state.mentorPid, 100, 'Mentor PID should remain 100')
  assert.equal(state.executorPid, 300, 'Executor PID should be updated to 300')

  monitor.unregisterPair(pairId)
})

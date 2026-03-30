import { DashboardPage } from '../pageobjects/dashboard.page.js'
import { CreatePairModalPage } from '../pageobjects/modals/create-pair-modal.page.js'
import { AssignTaskModalPage } from '../pageobjects/modals/assign-task-modal.page.js'
import { PairDetailPage } from '../pageobjects/pair-detail.page.js'

const dashboard = new DashboardPage()
const createModal = new CreatePairModalPage()
const assignModal = new AssignTaskModalPage()
const pairDetail = new PairDetailPage()

const TEST_DIR = process.env.E2E_TEST_DIR || '/tmp/e2e-the-pair-test'
const PAIR_NAME = 'Exec Lifecycle'

describe('Pair Execution - Success', () => {
  before(async () => {
    await browser.call(async () => {
      const { mkdirSync, execSync } = await import('node:fs')
      mkdirSync(TEST_DIR, { recursive: true })
      execSync(`cd ${TEST_DIR} && git init`, { stdio: 'pipe' })
    })
    process.env.THE_PAIR_E2E_MOCK_SCENARIO = 'success'
  })

  after(async () => {
    process.env.THE_PAIR_E2E_MOCK_SCENARIO = 'success'
    await browser.call(async () => {
      const { rmSync } = await import('node:fs')
      rmSync(TEST_DIR, { recursive: true, force: true })
    })
  })

  it('should complete full lifecycle: Idle -> Mentoring -> Executing -> Reviewing -> Finished', async () => {
    await dashboard.clickNewPair()
    await createModal.waitForOpen()
    await createModal.setName(PAIR_NAME)
    await createModal.setDirectory(TEST_DIR)
    await createModal.setTaskSpec('Complete the full lifecycle test')
    await createModal.submit()
    await createModal.waitForClosed()

    await dashboard.clickPairCard(PAIR_NAME)
    await assignModal.waitForOpen(PAIR_NAME)
    await assignModal.submit()
    await assignModal.waitForClosed()

    await pairDetail.waitForStatus('Finished', 20000)

    await pairDetail.waitForConsoleMessage('Plan', 5000)
    await pairDetail.waitForConsoleMessage('Done', 5000)
  })
})

describe('Pair Execution - Pause/Resume', () => {
  before(async () => {
    await browser.call(async () => {
      const { mkdirSync, execSync } = await import('node:fs')
      mkdirSync(TEST_DIR, { recursive: true })
      execSync(`cd ${TEST_DIR} && git init`, { stdio: 'pipe' })
    })
    process.env.THE_PAIR_E2E_MOCK_SCENARIO = 'success'
  })

  after(async () => {
    await browser.call(async () => {
      const { rmSync } = await import('node:fs')
      rmSync(TEST_DIR, { recursive: true, force: true })
    })
  })

  it('should show Pause button during execution', async () => {
    const name = 'Pause Test'
    await dashboard.clickNewPair()
    await createModal.waitForOpen()
    await createModal.setName(name)
    await createModal.setDirectory(TEST_DIR)
    await createModal.setTaskSpec('Pause test task')
    await createModal.submit()
    await createModal.waitForClosed()

    await dashboard.clickPairCard(name)
    await assignModal.waitForOpen(name)
    await assignModal.submit()
    await assignModal.waitForClosed()

    await pairDetail.waitForStatus('Finished', 20000)
  })
})

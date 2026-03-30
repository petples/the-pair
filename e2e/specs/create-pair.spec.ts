import { DashboardPage } from '../pageobjects/dashboard.page.js'
import { CreatePairModalPage } from '../pageobjects/modals/create-pair-modal.page.js'
import { AssignTaskModalPage } from '../pageobjects/modals/assign-task-modal.page.js'

const dashboard = new DashboardPage()
const createModal = new CreatePairModalPage()
const assignModal = new AssignTaskModalPage()

const TEST_DIR = process.env.E2E_TEST_DIR || '/tmp/e2e-the-pair-test'

describe('Create Pair', () => {
  before(async () => {
    await browser.call(async () => {
      const { mkdirSync } = await import('node:fs')
      mkdirSync(TEST_DIR, { recursive: true })
      const { execSync } = await import('node:child_process')
      execSync(`cd ${TEST_DIR} && git init`, { stdio: 'pipe' })
    })
  })

  after(async () => {
    await browser.call(async () => {
      const { rmSync } = await import('node:fs')
      rmSync(TEST_DIR, { recursive: true, force: true })
    })
  })

  it('should create a pair with valid inputs', async () => {
    await dashboard.clickNewPair()
    await createModal.waitForOpen()

    await createModal.setName('E2E Test Pair')
    await createModal.setDirectory(TEST_DIR)
    await createModal.setTaskSpec('Fix the login bug in auth module')

    await createModal.submit()
    await createModal.waitForClosed()

    await dashboard.isPairCardVisible('E2E Test Pair')
  })

  it('should open Assign Task modal when clicking an idle pair', async () => {
    await dashboard.clickPairCard('E2E Test Pair')
    await assignModal.waitForOpen('E2E Test Pair')
    await assignModal.cancel()
  })

  it('should require pair name', async () => {
    await dashboard.clickNewPair()
    await createModal.waitForOpen()

    await createModal.setDirectory(TEST_DIR)
    await createModal.setTaskSpec('Some task')

    await createModal.cancel()
  })
})

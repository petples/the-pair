import { DashboardPage } from '../pageobjects/dashboard.page.js'
import { CreatePairModalPage } from '../pageobjects/modals/create-pair-modal.page.js'

const dashboard = new DashboardPage()
const createModal = new CreatePairModalPage()

describe('Onboarding Flow', () => {
  it('should show the dashboard on launch', async () => {
    await dashboard.isToolbarVisible()
  })

  it('should open Create Pair modal from toolbar', async () => {
    await dashboard.clickNewPair()
    await createModal.waitForOpen()
    await createModal.cancel()
  })
})

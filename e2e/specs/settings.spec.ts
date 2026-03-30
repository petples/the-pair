import { DashboardPage } from '../pageobjects/dashboard.page.js'
import { SettingsModalPage } from '../pageobjects/modals/settings-modal.page.js'

const dashboard = new DashboardPage()
const settingsModal = new SettingsModalPage()

describe('Settings', () => {
  it('should toggle theme', async () => {
    await dashboard.clickThemeToggle()
  })

  it('should open and close Settings modal', async () => {
    const settingsVisible = await dashboard.isDisplayed('=Models')
    if (!settingsVisible) return

    await dashboard.clickModels()
    await settingsModal.waitForOpen()
    await settingsModal.cancel()
    await settingsModal.waitForClosed()
  })
})

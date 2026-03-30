import { S } from '../helpers/selectors.js'
import { BasePage } from './base.page.js'

export class PairDetailPage extends BasePage {
  async clickPause(): Promise<void> {
    await this.click(S.PAUSE_BTN)
  }

  async clickResume(): Promise<void> {
    await this.click(S.RESUME_BTN)
  }

  async clickRetryTurn(): Promise<void> {
    await this.click(S.RETRY_BTN)
  }

  async waitForStatus(status: string, timeout = 15000): Promise<void> {
    await this.waitForText(S.STATUS(status), status, timeout)
  }

  async getStatusText(): Promise<string> {
    return await this.getText('span[class*="rounded-full"]')
  }

  async isPauseButtonVisible(): Promise<boolean> {
    return await this.isDisplayed(S.PAUSE_BTN)
  }

  async isResumeButtonVisible(): Promise<boolean> {
    return await this.isDisplayed(S.RESUME_BTN)
  }

  async isRetryButtonVisible(): Promise<boolean> {
    return await this.isDisplayed(S.RETRY_BTN)
  }

  async getConsoleMessages(): Promise<string[]> {
    const elements = await $$(S.CONSOLE_PANEL + ' div')
    return Promise.all(elements.map((el) => el.getText()))
  }

  async waitForConsoleMessage(text: string, timeout = 10000): Promise<void> {
    await browser.waitUntil(
      async () => {
        const messages = await this.getConsoleMessages()
        return messages.some((m) => m.includes(text))
      },
      { timeout, timeoutMsg: `Expected console message containing "${text}"` }
    )
  }
}

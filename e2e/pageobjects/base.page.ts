import { S, modalTitle } from '../helpers/selectors.js'

export class BasePage {
  async waitForDisplayed(selector: string, timeout = 10000): Promise<void> {
    await $(selector).waitForDisplayed({ timeout })
  }

  async click(selector: string): Promise<void> {
    await $(selector).click()
  }

  async setValue(selector: string, value: string): Promise<void> {
    const el = $(selector)
    await el.waitForDisplayed()
    await el.setValue(value)
  }

  async getText(selector: string): Promise<string> {
    return await $(selector).getText()
  }

  async isDisplayed(selector: string): Promise<boolean> {
    return await $(selector)
      .isDisplayed()
      .catch(() => false)
  }

  async waitForText(selector: string, text: string, timeout = 10000): Promise<void> {
    await $(selector).waitForDisplayed({ timeout })
    browser.waitUntil(async () => (await $(selector).getText()).includes(text), {
      timeout,
      timeoutMsg: `Expected "${text}" in ${selector}`
    })
  }

  async isButtonDisabled(selector: string): Promise<boolean> {
    return (await $(selector).getAttribute('disabled')) !== null
  }

  async waitForModal(title: string): Promise<void> {
    await this.waitForDisplayed(modalTitle(title))
  }

  async closeModal(): Promise<void> {
    await this.click(S.MODAL_CLOSE_BTN)
  }

  async pressEscape(): Promise<void> {
    await browser.keys(['Escape'])
  }
}

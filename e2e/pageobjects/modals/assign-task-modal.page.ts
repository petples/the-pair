import { S, modalTitle } from '../../helpers/selectors.js'
import { BasePage } from '../base.page.js'

export class AssignTaskModalPage extends BasePage {
  async waitForOpen(pairName?: string): Promise<void> {
    if (pairName) {
      await this.waitForModal(`Assign New Task · ${pairName}`)
    } else {
      await this.waitForModal('Assign New Task')
    }
  }

  async setTaskSpec(spec: string): Promise<void> {
    await this.setValue(S.TASK_SPEC_ASSIGN, spec)
  }

  async submit(): Promise<void> {
    await this.click(S.START_NEW_TASK_BTN)
  }

  async restore(): Promise<void> {
    await this.click(S.CANCEL_BTN)
  }

  async cancel(): Promise<void> {
    await this.click(S.CANCEL_BTN_ASSIGN)
  }

  async waitForClosed(timeout = 5000): Promise<void> {
    await $(modalTitle('Assign New Task')).waitForDisplayed({
      timeout,
      reverse: true
    })
  }
}

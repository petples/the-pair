export const config: WebdriverIO.Config = {
  runner: 'local',
  specs: ['./e2e/specs/**/*.spec.ts'],
  maxInstances: 1,

  capabilities: [
    {
      platformName: 'mac',
      'appium:automationName': 'mac2',
      'appium:bundleId': 'com.thepair.app',
      'appium:noReset': false,
      'appium:newCommandTimeout': 300
    }
  ],

  logLevel: 'info',
  waitforTimeout: 10000,
  connectionRetryTimeout: 60000,
  connectionRetryCount: 1,

  services: ['appium'],
  appium: {
    command: 'npx',
    args: {
      address: '127.0.0.1',
      port: 4723,
      relaxedSecurity: true
    }
  },

  framework: 'mocha',
  reporters: ['spec'],
  mochaOpts: {
    ui: 'bdd',
    timeout: 60000,
    grep: process.env.E2E_GREP
  },

  beforeSession() {
    process.env.THE_PAIR_E2E_MOCK = 'true'
  },

  before() {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('ts-node/register')
  }
}

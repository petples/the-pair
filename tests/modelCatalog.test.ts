import assert from 'node:assert/strict'
import test from 'node:test'

import { buildModelCatalog } from '../src/main/modelCatalog.ts'

test('buildModelCatalog marks OpenCode BYOK models as ready and explains billing', () => {
  const [model] = buildModelCatalog([
    {
      kind: 'opencode',
      installed: true,
      authenticated: true,
      runnable: true,
      subscriptionLabel: 'provider-backed',
      detectedAt: 0,
      currentModels: [
        {
          modelId: 'gpt-4o-mini',
          displayName: 'GPT-4o Mini',
          sourceProvider: 'openai',
          subscriptionLabel: 'provider-backed',
          supportsPairExecution: true,
          runnable: true
        }
      ]
    }
  ])

  assert.equal(model.available, true)
  assert.equal(model.provider, 'opencode')
  assert.equal(model.providerLabel, 'OpenCode')
  assert.equal(model.sourceProvider, 'openai')
  assert.equal(model.sourceProviderLabel, 'OpenAI')
  assert.equal(model.billingLabel, 'Pay as you go')
  assert.equal(model.accessLabel, 'OpenAI API key')
  assert.equal(model.availabilityStatus, 'ready')
})

test('buildModelCatalog keeps unavailable runtimes visible and formats plan labels', () => {
  const models = buildModelCatalog([
    {
      kind: 'codex',
      installed: true,
      authenticated: true,
      runnable: true,
      subscriptionLabel: 'pro',
      detectedAt: 0,
      currentModels: [
        {
          modelId: 'gpt-4o',
          displayName: 'GPT-4o',
          sourceProvider: 'openai',
          subscriptionLabel: 'pro',
          supportsPairExecution: true,
          runnable: true
        }
      ]
    },
    {
      kind: 'gemini',
      installed: true,
      authenticated: true,
      runnable: false,
      subscriptionLabel: 'subscription-backed',
      detectedAt: 0,
      currentModels: [
        {
          modelId: 'gemini-2-5-pro',
          displayName: 'Gemini 2.5 Pro',
          sourceProvider: 'google',
          subscriptionLabel: 'subscription-backed',
          supportsPairExecution: false,
          runnable: false
        }
      ]
    }
  ])

  const codexModel = models.find((model) => model.provider === 'codex')
  const geminiModel = models.find((model) => model.provider === 'gemini')

  assert.ok(codexModel)
  assert.equal(codexModel.planLabel, 'ChatGPT Pro')
  assert.equal(codexModel.billingLabel, 'Included with plan')
  assert.equal(codexModel.available, true)

  assert.ok(geminiModel)
  assert.equal(geminiModel.available, false)
  assert.equal(geminiModel.availabilityStatus, 'runtime-unsupported')
  assert.match(geminiModel.availabilityReason ?? '', /not yet supported/i)
})

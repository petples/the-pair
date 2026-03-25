import assert from 'node:assert/strict'
import test from 'node:test'

import type { AvailableModel } from '../src/renderer/src/types.ts'
import { buildAgentConfig, inferProviderFromModel } from '../src/renderer/src/lib/providerResolution.ts'

const readyOpenCodeModel: AvailableModel = {
  provider: 'opencode',
  modelId: 'gpt-4o-mini',
  displayName: 'GPT-4o Mini',
  available: true,
  providerLabel: 'OpenCode',
  sourceProvider: 'openai',
  sourceProviderLabel: 'OpenAI',
  billingKind: 'byok',
  billingLabel: 'Pay as you go',
  accessLabel: 'OpenAI API key',
  planLabel: 'provider-backed',
  availabilityStatus: 'ready',
  supportsPairExecution: true,
  recommendedRoles: ['mentor', 'executor']
}

const readyClaudeModel: AvailableModel = {
  provider: 'claude',
  modelId: 'claude-3-5-sonnet',
  displayName: 'Claude 3.5 Sonnet',
  available: true,
  providerLabel: 'Claude Code',
  sourceProvider: 'anthropic',
  sourceProviderLabel: 'Anthropic',
  billingKind: 'plan',
  billingLabel: 'Included with plan',
  accessLabel: 'Claude Code login',
  planLabel: 'pro',
  availabilityStatus: 'ready',
  supportsPairExecution: true,
  recommendedRoles: ['mentor', 'executor']
}

test('inferProviderFromModel maps provider-aware ids and legacy model names', () => {
  assert.equal(inferProviderFromModel('codex/gpt-4o-mini'), 'codex')
  assert.equal(inferProviderFromModel('claude-3-5-sonnet'), 'claude')
  assert.equal(inferProviderFromModel('gemini-2.5-pro'), 'gemini')
  assert.equal(inferProviderFromModel('gpt-4o-mini'), 'codex')
})

test('buildAgentConfig preserves the selected provider and raw model id', () => {
  const config = buildAgentConfig('mentor', 'claude/claude-3-5-sonnet', [
    readyClaudeModel,
    readyOpenCodeModel
  ])

  assert.deepEqual(config, {
    role: 'mentor',
    provider: 'claude',
    model: 'claude-3-5-sonnet'
  })
})

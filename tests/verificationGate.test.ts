import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildVerificationReviewPrompt,
  buildVerificationRetryPrompt,
  getVerificationSummaryChip,
  idleVerificationState,
  parseVerificationVerdict
} from '../src/renderer/src/lib/verificationGate.ts'

test('buildVerificationReviewPrompt embeds the verification report and strict JSON instructions', () => {
  const prompt = buildVerificationReviewPrompt({
    riskLevel: 'high',
    startedAt: 10,
    finishedAt: 20,
    summary: 'all checks completed',
    checks: [
      {
        name: 'test',
        command: 'npm run test',
        status: 'passed',
        exitCode: 0,
        durationMs: 120,
        stdout: 'ok',
        stderr: '',
        summary: 'test passed'
      }
    ]
  })

  assert.match(prompt, /STRICT JSON ONLY/i)
  assert.match(prompt, /"riskLevel": "high"/)
  assert.match(prompt, /"command": "npm run test"/)
  assert.doesNotMatch(prompt, /humanReview/i)
})

test('parseVerificationVerdict accepts fenced JSON and normalizes the verdict', () => {
  const verdict = parseVerificationVerdict(`\`\`\`json
{
  "status": "pass",
  "riskLevel": "medium",
  "evidence": ["npm run test passed"],
  "nextAction": "continue",
  "summary": "Checks passed"
}
\`\`\``)

  assert.deepEqual(verdict, {
    status: 'pass',
    riskLevel: 'medium',
    evidence: ['npm run test passed'],
    nextAction: 'continue',
    summary: 'Checks passed'
  })
})

test('parseVerificationVerdict accepts JSON embedded in prose', () => {
  const verdict = parseVerificationVerdict(`Here is the final verdict:
{
  "status": "pass",
  "riskLevel": "low",
  "evidence": ["npm run test passed"],
  "nextAction": "finish",
  "summary": "Checks passed"
}
Thanks!`)

  assert.deepEqual(verdict, {
    status: 'pass',
    riskLevel: 'low',
    evidence: ['npm run test passed'],
    nextAction: 'finish',
    summary: 'Checks passed'
  })
})

test('buildVerificationRetryPrompt includes the mentor verdict and task context', () => {
  const prompt = buildVerificationRetryPrompt(
    {
      riskLevel: 'high',
      startedAt: 10,
      finishedAt: 20,
      summary: 'all checks completed',
      checks: [
        {
          name: 'test',
          command: 'npm run test',
          status: 'passed',
          exitCode: 0,
          durationMs: 120,
          stdout: 'ok',
          stderr: '',
          summary: 'test passed'
        }
      ]
    },
    {
      taskSpec: 'Fix the parser',
      executorResult: 'Previous executor result',
      mentorOutput: 'The mentor said the work still needs another pass.',
      verdict: {
        status: 'fail',
        riskLevel: 'high',
        evidence: ['tests are still failing'],
        nextAction: 'continue',
        summary: 'Need another iteration'
      }
    }
  )

  assert.match(prompt, /EXECUTOR/i)
  assert.match(prompt, /Fix the parser/)
  assert.match(prompt, /Previous executor result/)
  assert.match(prompt, /Need another iteration/)
  assert.match(prompt, /The mentor said the work still needs another pass/)
  assert.doesNotMatch(prompt, /humanReview/i)
})

test('getVerificationSummaryChip hides idle state and summarizes active review state', () => {
  assert.equal(getVerificationSummaryChip(idleVerificationState()), null)

  const chip = getVerificationSummaryChip({
    phase: 'awaitingVerdict',
    riskLevel: 'high',
    report: {
      riskLevel: 'high',
      checks: [],
      summary: 'all checks completed',
      startedAt: 10,
      finishedAt: 20
    },
    verdict: null,
    rawVerdict: null,
    error: null,
    startedAt: 10,
    updatedAt: 20
  })

  assert.deepEqual(chip, {
    tone: 'amber',
    text: 'Verification · Awaiting verdict · HIGH'
  })
})

test('getVerificationSummaryChip marks autonomous retries instead of terminal failures', () => {
  const chip = getVerificationSummaryChip({
    phase: 'failed',
    riskLevel: 'high',
    report: {
      riskLevel: 'high',
      checks: [],
      summary: 'all checks completed',
      startedAt: 10,
      finishedAt: 20
    },
    verdict: {
      status: 'fail',
      riskLevel: 'high',
      evidence: ['work is incomplete'],
      nextAction: 'continue',
      summary: 'Needs another iteration'
    },
    rawVerdict: null,
    error: null,
    startedAt: 10,
    updatedAt: 20
  })

  assert.deepEqual(chip, {
    tone: 'amber',
    text: 'Verification · Retrying · HIGH'
  })
})

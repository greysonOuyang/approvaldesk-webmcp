import { beforeEach, describe, expect, test } from 'bun:test'
import {
  Model,
  type BaseModelConfig,
  type Message,
  type ModelStreamEvent,
  type StreamOptions,
} from '@strands-agents/sdk'
import { createApprovalAgent } from './approval-agent'
import { store } from '../store'

class ScriptedModel extends Model<BaseModelConfig> {
  private config: BaseModelConfig = { modelId: 'approvaldesk-deterministic-test', contextWindowLimit: 32_000 }
  private step = 0
  private readonly mode: 'prepare' | 'resume'

  constructor(mode: 'prepare' | 'resume') {
    super()
    this.mode = mode
  }

  updateConfig(next: BaseModelConfig) {
    this.config = { ...this.config, ...next }
  }

  getConfig() {
    return { ...this.config }
  }

  async *stream(_messages: Message[], _options?: StreamOptions): AsyncIterable<ModelStreamEvent> {
    if (this.mode === 'prepare') {
      if (this.step === 0) return yield* this.toolUse('approval_create_draft', { formId: 'vendor-onboarding' })
      const draft = store.snapshot().drafts[0]
      if (this.step === 1) return yield* this.toolUse('approval_set_fields', {
        draftId: draft.id,
        expectedRevision: draft.revision,
        values: {
          vendorName: 'Example Analytics',
          service: 'Operational analytics',
          annualSpend: 12_000,
          dataAccess: 'Yes',
          ownerEmail: 'owner@example.com',
        },
      })
      if (this.step === 2) return yield* this.toolUse('approval_validate_draft', { draftId: draft.id })
      if (this.step === 3) return yield* this.toolUse('approval_request_human_approval', {
        draftId: draft.id,
        expectedRevision: draft.revision,
      })
      return yield* this.text('Draft prepared and validated. Human approval is required before submission.')
    }

    const draft = store.snapshot().drafts[0]
    if (this.step === 0) return yield* this.toolUse('approval_get_draft', { draftId: draft.id })
    if (this.step === 1) return yield* this.toolUse('approval_submit_approved_draft', {
      draftId: draft.id,
      expectedRevision: draft.revision,
    })
    return yield* this.text('The exact human-approved revision was submitted.')
  }

  private async *toolUse(name: string, input: Record<string, unknown>): AsyncIterable<ModelStreamEvent> {
    const toolUseId = `tool-${this.mode}-${this.step}`
    this.step += 1
    yield { type: 'modelMessageStartEvent', role: 'assistant' }
    yield { type: 'modelContentBlockStartEvent', start: { type: 'toolUseStart', name, toolUseId } }
    yield { type: 'modelContentBlockDeltaEvent', delta: { type: 'toolUseInputDelta', input: JSON.stringify(input) } }
    yield { type: 'modelContentBlockStopEvent' }
    yield { type: 'modelMessageStopEvent', stopReason: 'toolUse' }
  }

  private async *text(text: string): AsyncIterable<ModelStreamEvent> {
    this.step += 1
    yield { type: 'modelMessageStartEvent', role: 'assistant' }
    yield { type: 'modelContentBlockStartEvent' }
    yield { type: 'modelContentBlockDeltaEvent', delta: { type: 'textDelta', text } }
    yield { type: 'modelContentBlockStopEvent' }
    yield { type: 'modelMessageStopEvent', stopReason: 'endTurn' }
  }
}

beforeEach(() => store.reset())

describe('Strands ApprovalDesk agent', () => {
  test('does routine work autonomously and stops at the exact human decision boundary', async () => {
    const agent = createApprovalAgent({ model: new ScriptedModel('prepare') })
    const result = await agent.invoke('Prepare the provided vendor onboarding request.')

    const draft = store.snapshot().drafts[0]
    expect(result.stopReason).toBe('endTurn')
    expect(draft.formId).toBe('vendor-onboarding')
    expect(draft.status).toBe('awaiting_approval')
    expect(draft.approvalRequestedRevision).toBe(draft.revision)
    expect(draft.approvedRevision).toBeUndefined()
    expect(store.audit(draft.id, 20).some((event) => event.action === 'approval_requested')).toBe(true)
    expect(store.audit(draft.id, 20).some((event) => event.action === 'submitted')).toBe(false)
  })

  test('can resume only after a real human approval and submit that exact revision', async () => {
    const prepareAgent = createApprovalAgent({ model: new ScriptedModel('prepare') })
    await prepareAgent.invoke('Prepare the provided vendor onboarding request.')
    const queued = store.snapshot().drafts[0]

    expect(() => store.submit(queued.id, 'agent', queued.revision)).toThrow('HUMAN_APPROVAL_REQUIRED')
    store.decide(queued.id, 'approve', 'Human reviewed the exact revision.')

    const resumeAgent = createApprovalAgent({ model: new ScriptedModel('resume') })
    const result = await resumeAgent.invoke('Resume after the human decision.')
    const submitted = store.getDraft(queued.id)!

    expect(result.stopReason).toBe('endTurn')
    expect(submitted.status).toBe('submitted')
    expect(submitted.approvedRevision).toBe(submitted.revision)
    expect(store.audit(submitted.id, 20).some((event) => event.action === 'submitted')).toBe(true)
  })
})

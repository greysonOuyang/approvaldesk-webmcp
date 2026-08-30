import { beforeEach, describe, expect, test } from 'bun:test'

const memory = new Map<string, string>()
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => { memory.set(key, value) },
    removeItem: (key: string) => { memory.delete(key) },
    clear: () => memory.clear(),
  },
})

const { store } = await import('./store')

beforeEach(() => {
  memory.clear()
  store.reset()
})

describe('approval authority', () => {
  test('submission fails closed before explicit human approval', () => {
    const draft = store.createDraft('vendor-onboarding', 'agent')
    store.updateFields(draft.id, {
      vendorName: 'Example Vendor',
      service: 'Operational analytics',
      annualSpend: 12000,
      dataAccess: 'Yes',
      ownerEmail: 'owner@example.com',
    }, 'agent', draft.revision)
    const current = store.getDraft(draft.id)!
    store.requestApproval(draft.id, 'agent', current.revision)

    expect(() => store.submit(draft.id, 'agent', current.revision)).toThrow('HUMAN_APPROVAL_REQUIRED')
    expect(store.getDraft(draft.id)?.status).toBe('awaiting_approval')
  })

  test('editing after an approval request invalidates that approval state', () => {
    const draft = store.createDraft('expense-reimbursement', 'agent')
    store.updateFields(draft.id, {
      merchant: 'Northstar Hotel', amount: 100, date: '2026-08-30', category: 'Travel',
      businessPurpose: 'Workshop', costCenter: 'ENG',
    }, 'agent', draft.revision)
    const ready = store.getDraft(draft.id)!
    store.requestApproval(draft.id, 'agent', ready.revision)
    expect(store.getDraft(draft.id)?.status).toBe('awaiting_approval')

    const queued = store.getDraft(draft.id)!
    store.updateFields(draft.id, { amount: 125 }, 'agent', queued.revision)
    const changed = store.getDraft(draft.id)!
    expect(changed.status).toBe('draft')
    expect(changed.approvalRequestedRevision).toBeUndefined()
    expect(() => store.submit(draft.id, 'agent', changed.revision)).toThrow('HUMAN_APPROVAL_REQUIRED')
  })

  test('approved exact draft can be submitted and then becomes immutable', () => {
    const seeded = store.getDraft('draft_demo_1')!
    store.decide(seeded.id, 'approve', 'Reviewed exact values')
    const approved = store.getDraft(seeded.id)!
    expect(approved.status).toBe('approved')
    expect(approved.approvedRevision).toBe(approved.revision)

    store.submit(seeded.id, 'agent', approved.revision)
    expect(store.getDraft(seeded.id)?.status).toBe('submitted')
    expect(() => store.updateFields(seeded.id, { amount: 999 }, 'agent', approved.revision)).toThrow('Submitted drafts are immutable')
    expect(() => store.requestApproval(seeded.id, 'agent', approved.revision)).toThrow('Submitted drafts are immutable')
  })

  test('stale agent revisions fail closed instead of overwriting newer state', () => {
    const draft = store.createDraft('expense-reimbursement', 'agent')
    const revision = draft.revision
    store.updateFields(draft.id, { merchant: 'Northstar Hotel' }, 'agent', revision)
    expect(store.getDraft(draft.id)?.revision).toBe(revision + 1)
    expect(() => store.updateFields(draft.id, { amount: 99 }, 'agent', revision)).toThrow('REVISION_CONFLICT')
  })

  test('approval is bound to the exact revision that the human reviewed', () => {
    const draft = store.createDraft('expense-reimbursement', 'agent')
    store.updateFields(draft.id, {
      merchant: 'Northstar Hotel', amount: 100, date: '2026-08-30', category: 'Travel',
      businessPurpose: 'Workshop', costCenter: 'ENG',
    }, 'agent', draft.revision)
    const current = store.getDraft(draft.id)!
    store.requestApproval(draft.id, 'agent', current.revision)
    store.decide(draft.id, 'approve', 'Reviewed exact revision')
    const approved = store.getDraft(draft.id)!
    expect(approved.approvedRevision).toBe(approved.revision)
    expect(() => store.submit(draft.id, 'agent', approved.revision - 1)).toThrow('REVISION_CONFLICT')
    store.submit(draft.id, 'agent', approved.revision)
    expect(store.getDraft(draft.id)?.status).toBe('submitted')
  })
})

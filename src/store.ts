import { forms } from './data'
import type { AuditEvent, Draft, PersistedState } from './types'

const STORAGE_KEY = 'approvaldesk:webmcp:v2'
const listeners = new Set<() => void>()
const now = () => new Date().toISOString()
const makeId = (prefix: string) => `${prefix}_${crypto.randomUUID().slice(0, 8)}`

const seed: PersistedState = {
  drafts: [
    {
      id: 'draft_demo_1',
      formId: 'expense-reimbursement',
      status: 'awaiting_approval',
      revision: 1,
      approvalRequestedRevision: 1,
      values: {
        merchant: 'Northstar Hotel',
        amount: 286.4,
        date: new Date().toISOString().slice(0, 10),
        category: 'Travel',
        businessPurpose: 'Customer workshop travel — lodging for one night.',
        costCenter: 'CUSTOMER-SUCCESS',
        receiptUrl: 'https://example.com/receipt/NS-1842',
      },
      createdAt: now(),
      updatedAt: now(),
    },
  ],
  audit: [
    {
      id: 'evt_seed',
      ts: now(),
      actor: 'agent',
      action: 'approval_requested',
      detail: 'Prepared travel reimbursement revision 1 and requested a human decision.',
      draftId: 'draft_demo_1',
    },
  ],
}

function load(): PersistedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as PersistedState
  } catch {
    // A demo must still work when storage is unavailable or corrupt.
  }
  return structuredClone(seed)
}

let state = load()

function persist() {
  state = structuredClone(state)
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Node-side Strands agents share this exact state machine without requiring browser storage.
  }
  listeners.forEach((listener) => listener())
}

function appendAudit(
  actor: AuditEvent['actor'],
  action: string,
  detail: string,
  draftId?: string,
) {
  state.audit.unshift({ id: makeId('evt'), ts: now(), actor, action, detail, draftId })
  state.audit = state.audit.slice(0, 80)
}

function assertRevision(draft: Draft, expectedRevision?: number) {
  if (expectedRevision !== undefined && draft.revision !== expectedRevision) {
    throw new Error(
      `REVISION_CONFLICT: expected revision ${expectedRevision}, current revision is ${draft.revision}. Re-read the draft before acting.`,
    )
  }
}

function clearDecision(draft: Draft) {
  draft.approvalRequestedRevision = undefined
  draft.approvedRevision = undefined
  draft.approvalNote = undefined
}

export const store = {
  subscribe(listener: () => void) {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },

  snapshot() {
    return state
  },

  reset() {
    state = structuredClone(seed)
    persist()
    return state
  },

  listForms() {
    return forms.map(({ fields, ...form }) => ({ ...form, fieldCount: fields.length }))
  },

  getForm(id: string) {
    return forms.find((form) => form.id === id)
  },

  getDraft(id: string) {
    return state.drafts.find((draft) => draft.id === id)
  },

  listPendingApprovals() {
    return state.drafts
      .filter((draft) => draft.status === 'awaiting_approval')
      .map((draft) => {
        const form = this.getForm(draft.formId)
        const validation = this.validate(draft.id)
        return {
          draftId: draft.id,
          formId: draft.formId,
          title: form?.title ?? draft.formId,
          risk: form?.risk ?? 'medium',
          revision: draft.revision,
          approvalRequestedRevision: draft.approvalRequestedRevision,
          warnings: validation.warnings,
          updatedAt: draft.updatedAt,
        }
      })
  },

  createDraft(formId: string, actor: AuditEvent['actor'] = 'agent') {
    const form = this.getForm(formId)
    if (!form) throw new Error(`Unknown form: ${formId}`)

    const draft: Draft = {
      id: makeId('draft'),
      formId,
      status: 'draft',
      revision: 1,
      values: {},
      createdAt: now(),
      updatedAt: now(),
    }
    state.drafts.unshift(draft)
    appendAudit(actor, 'draft_created', `Created “${form.title}” revision 1.`, draft.id)
    persist()
    return draft
  },

  updateFields(
    draftId: string,
    values: Record<string, string | number>,
    actor: AuditEvent['actor'] = 'agent',
    expectedRevision?: number,
  ) {
    const draft = this.getDraft(draftId)
    if (!draft) throw new Error(`Unknown draft: ${draftId}`)
    if (draft.status === 'submitted') throw new Error('Submitted drafts are immutable.')
    assertRevision(draft, expectedRevision)

    const form = this.getForm(draft.formId)
    if (!form) throw new Error('Draft references an unknown form.')
    const allowed = new Set(form.fields.map((field) => field.key))
    const unknown = Object.keys(values).filter((key) => !allowed.has(key))
    if (unknown.length) throw new Error(`Unknown field(s): ${unknown.join(', ')}`)

    const changed = Object.entries(values).filter(
      ([key, value]) => !Object.is(draft.values[key], value),
    )
    if (!changed.length) return draft

    const invalidatedStatus = draft.status
    draft.values = { ...draft.values, ...Object.fromEntries(changed) }
    draft.revision += 1
    draft.updatedAt = now()

    if (invalidatedStatus !== 'draft') {
      draft.status = 'draft'
      clearDecision(draft)
      appendAudit(
        'system',
        'approval_invalidated',
        `Draft changed after ${invalidatedStatus.replaceAll('_', ' ')}; revision ${draft.revision} requires a fresh human decision.`,
        draft.id,
      )
    }

    appendAudit(
      actor,
      'draft_updated',
      `Updated ${changed.length} field${changed.length === 1 ? '' : 's'}; now revision ${draft.revision}.`,
      draft.id,
    )
    persist()
    return draft
  },

  validate(draftId: string) {
    const draft = this.getDraft(draftId)
    if (!draft) throw new Error(`Unknown draft: ${draftId}`)
    const form = this.getForm(draft.formId)
    if (!form) throw new Error('Draft references an unknown form.')

    const missing = form.fields
      .filter((field) => field.required)
      .filter((field) => {
        const value = draft.values[field.key]
        return value === undefined || value === null || String(value).trim() === ''
      })
      .map((field) => ({ key: field.key, label: field.label }))

    const warnings: string[] = []
    if (draft.formId === 'vendor-onboarding' && Number(draft.values.annualSpend ?? 0) >= 10_000) {
      warnings.push('Annual spend is ≥ $10,000 — finance review is recommended.')
    }
    if (draft.formId === 'vendor-onboarding' && draft.values.dataAccess === 'Yes') {
      warnings.push('Vendor data access is enabled — security/privacy review is recommended.')
    }
    if (draft.formId === 'community-event-permit' && Number(draft.values.attendees ?? 0) >= 100) {
      warnings.push('Large event: confirm crowd, accessibility, and cleanup plans.')
    }

    return { valid: missing.length === 0, revision: draft.revision, missing, warnings }
  },

  requestApproval(
    draftId: string,
    actor: AuditEvent['actor'] = 'agent',
    expectedRevision?: number,
  ) {
    const draft = this.getDraft(draftId)
    if (!draft) throw new Error(`Unknown draft: ${draftId}`)
    if (draft.status === 'submitted') throw new Error('Submitted drafts are immutable.')
    assertRevision(draft, expectedRevision)

    const validation = this.validate(draftId)
    if (!validation.valid) {
      throw new Error(`Draft is incomplete: ${validation.missing.map((item) => item.label).join(', ')}`)
    }

    draft.status = 'awaiting_approval'
    draft.approvalRequestedRevision = draft.revision
    draft.approvedRevision = undefined
    draft.approvalNote = undefined
    draft.updatedAt = now()
    appendAudit(
      actor,
      'approval_requested',
      `Validation passed; human approval requested for exact revision ${draft.revision}.`,
      draft.id,
    )
    persist()
    return { draft, validation }
  },

  decide(draftId: string, decision: 'approve' | 'reject', note = '') {
    const draft = this.getDraft(draftId)
    if (!draft) throw new Error(`Unknown draft: ${draftId}`)
    if (draft.status !== 'awaiting_approval') throw new Error('Draft is not awaiting approval.')
    if (draft.approvalRequestedRevision !== draft.revision) {
      throw new Error('STALE_APPROVAL_REQUEST: the draft changed and must be reviewed again.')
    }

    draft.status = decision === 'approve' ? 'approved' : 'rejected'
    draft.approvalNote = note
    draft.approvedRevision = decision === 'approve' ? draft.revision : undefined
    draft.updatedAt = now()
    appendAudit(
      'human',
      decision === 'approve' ? 'approved' : 'rejected',
      note || `Human ${decision}d exact revision ${draft.revision}.`,
      draft.id,
    )
    persist()
    return draft
  },

  submit(
    draftId: string,
    actor: AuditEvent['actor'] = 'agent',
    expectedRevision?: number,
  ) {
    const draft = this.getDraft(draftId)
    if (!draft) throw new Error(`Unknown draft: ${draftId}`)
    assertRevision(draft, expectedRevision)
    if (draft.status !== 'approved' || draft.approvedRevision !== draft.revision) {
      throw new Error(
        'HUMAN_APPROVAL_REQUIRED: a human must explicitly approve this exact draft revision before submission.',
      )
    }

    draft.status = 'submitted'
    draft.submittedAt = now()
    draft.updatedAt = now()
    appendAudit(
      actor,
      'submitted',
      `Submitted revision ${draft.revision} after exact-revision human approval.`,
      draft.id,
    )
    persist()
    return draft
  },

  audit(draftId?: string, limit = 12) {
    const events = draftId ? state.audit.filter((event) => event.draftId === draftId) : state.audit
    return events.slice(0, Math.min(Math.max(limit, 1), 20))
  },
}

import { tool } from '@strands-agents/sdk'
import { z } from 'zod'
import { store } from '../store'

const jsonSafe = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T
const revision = z.number().int().positive().describe('Exact draft revision last read by the agent.')
const draftId = z.string().min(1).describe('ApprovalDesk draft id.')

export const approvalToolNames = [
  'approval_list_workflows',
  'approval_get_workflow_schema',
  'approval_create_draft',
  'approval_set_fields',
  'approval_get_draft',
  'approval_validate_draft',
  'approval_request_human_approval',
  'approval_submit_approved_draft',
] as const

export function createApprovalTools() {
  const listWorkflows = tool({
    name: 'approval_list_workflows',
    description: 'List consequential ApprovalDesk workflows with risk and effort before choosing one.',
    inputSchema: z.object({}),
    callback: () => jsonSafe({ workflows: store.listForms() }),
  })

  const getWorkflowSchema = tool({
    name: 'approval_get_workflow_schema',
    description: 'Read the exact required fields and risk metadata for one workflow before creating a draft.',
    inputSchema: z.object({ formId: z.string().min(1) }),
    callback: ({ formId }) => {
      const form = store.getForm(formId)
      if (!form) throw new Error(`Unknown form: ${formId}`)
      return jsonSafe({ form })
    },
  })

  const createDraft = tool({
    name: 'approval_create_draft',
    description: 'Create a reversible ApprovalDesk draft. This never approves or submits anything.',
    inputSchema: z.object({ formId: z.string().min(1) }),
    callback: ({ formId }) => jsonSafe({ draft: store.createDraft(formId, 'agent') }),
  })

  const setFields = tool({
    name: 'approval_set_fields',
    description: 'Set known fields on the exact draft revision. A stale revision fails closed and any edit invalidates prior approval.',
    inputSchema: z.object({
      draftId,
      expectedRevision: revision,
      values: z.record(z.string(), z.union([z.string(), z.number()])),
    }),
    callback: ({ draftId: id, expectedRevision, values }) =>
      jsonSafe({ draft: store.updateFields(id, values, 'agent', expectedRevision) }),
  })

  const getDraft = tool({
    name: 'approval_get_draft',
    description: 'Inspect current values, exact revision, approval state, and validation before taking another action.',
    inputSchema: z.object({ draftId }),
    callback: ({ draftId: id }) => {
      const draft = store.getDraft(id)
      if (!draft) throw new Error(`Unknown draft: ${id}`)
      return jsonSafe({ draft, validation: store.validate(id) })
    },
  })

  const validateDraft = tool({
    name: 'approval_validate_draft',
    description: 'Validate required fields and surface policy/risk warnings before requesting a human decision.',
    inputSchema: z.object({ draftId }),
    callback: ({ draftId: id }) => jsonSafe({ validation: store.validate(id) }),
  })

  const requestHumanApproval = tool({
    name: 'approval_request_human_approval',
    description: 'Move a complete exact draft revision into the human decision queue. The agent cannot grant approval itself.',
    inputSchema: z.object({ draftId, expectedRevision: revision }),
    callback: ({ draftId: id, expectedRevision }) =>
      jsonSafe(store.requestApproval(id, 'agent', expectedRevision)),
  })

  const submitApprovedDraft = tool({
    name: 'approval_submit_approved_draft',
    description: 'Submit only an exact revision already approved by a human. The ApprovalDesk domain gate rejects stale or unapproved revisions.',
    inputSchema: z.object({ draftId, expectedRevision: revision }),
    callback: ({ draftId: id, expectedRevision }) =>
      jsonSafe({ draft: store.submit(id, 'agent', expectedRevision) }),
  })

  return [
    listWorkflows,
    getWorkflowSchema,
    createDraft,
    setFields,
    getDraft,
    validateDraft,
    requestHumanApproval,
    submitApprovedDraft,
  ]
}

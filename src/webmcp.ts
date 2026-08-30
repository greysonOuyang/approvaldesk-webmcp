import { store } from './store'

type JsonSchema = Record<string, unknown>
type ToolHandler = (input: Record<string, unknown>) => unknown | Promise<unknown>

interface ToolAnnotations {
  readOnlyHint: boolean
  untrustedContentHint?: boolean
}

export interface ToolDefinition {
  name: string
  title: string
  description: string
  inputSchema: JsonSchema
  annotations: ToolAnnotations
  execute: ToolHandler
}

interface ModelContext {
  registerTool(
    tool: ToolDefinition,
    options?: { signal?: AbortSignal },
  ): void | Promise<void>
}

declare global {
  interface Document {
    modelContext?: ModelContext
  }
}

const objectSchema = (
  properties: Record<string, unknown>,
  required: string[] = [],
): JsonSchema => ({ type: 'object', properties, required, additionalProperties: false })

const stringSchema = (description: string) => ({ type: 'string', description })
const revisionSchema = (description: string) => ({ type: 'integer', minimum: 1, description })

const readonly = (untrustedContentHint = false): ToolAnnotations => ({
  readOnlyHint: true,
  ...(untrustedContentHint ? { untrustedContentHint: true } : {}),
})

const mutating: ToolAnnotations = { readOnlyHint: false }

export const tools: ToolDefinition[] = [
  {
    name: 'list_forms',
    title: 'List approval workflows',
    description: 'List workflows available to the agent with risk, effort, and field count.',
    inputSchema: objectSchema({}),
    annotations: readonly(),
    execute: () => ({ forms: store.listForms() }),
  },
  {
    name: 'get_form_schema',
    title: 'Read workflow schema',
    description: 'Read the exact fields for one workflow before creating or editing a draft.',
    inputSchema: objectSchema(
      { formId: stringSchema('Workflow id returned by list_forms.') },
      ['formId'],
    ),
    annotations: readonly(),
    execute: ({ formId }) => {
      const form = store.getForm(String(formId))
      if (!form) throw new Error(`Unknown form: ${String(formId)}`)
      return { form }
    },
  },
  {
    name: 'list_pending_approvals',
    title: 'List human approval queue',
    description: 'Read drafts currently waiting for a human decision, including risk and revision.',
    inputSchema: objectSchema({}),
    annotations: readonly(true),
    execute: () => ({ approvals: store.listPendingApprovals() }),
  },
  {
    name: 'create_draft',
    title: 'Create reversible draft',
    description: 'Create a reversible draft for a workflow. This never approves or submits it.',
    inputSchema: objectSchema(
      { formId: stringSchema('Workflow id returned by list_forms.') },
      ['formId'],
    ),
    annotations: mutating,
    execute: ({ formId }) => ({ draft: store.createDraft(String(formId), 'agent') }),
  },
  {
    name: 'set_draft_fields',
    title: 'Update draft fields',
    description: 'Update a known draft revision. Any edit invalidates an older approval decision.',
    inputSchema: objectSchema(
      {
        draftId: stringSchema('Draft id.'),
        expectedRevision: revisionSchema('Revision returned by get_draft.'),
        values: {
          type: 'object',
          description: 'Field/value map matching the workflow schema.',
          additionalProperties: { type: ['string', 'number'] },
        },
      },
      ['draftId', 'expectedRevision', 'values'],
    ),
    annotations: mutating,
    execute: ({ draftId, expectedRevision, values }) => ({
      draft: store.updateFields(
        String(draftId),
        (values ?? {}) as Record<string, string | number>,
        'agent',
        Number(expectedRevision),
      ),
    }),
  },
  {
    name: 'get_draft',
    title: 'Read draft state',
    description: 'Read values, revision, approval provenance, and validation for a draft.',
    inputSchema: objectSchema({ draftId: stringSchema('Draft id.') }, ['draftId']),
    annotations: readonly(true),
    execute: ({ draftId }) => {
      const draft = store.getDraft(String(draftId))
      if (!draft) throw new Error(`Unknown draft: ${String(draftId)}`)
      return { draft, validation: store.validate(draft.id) }
    },
  },
  {
    name: 'validate_draft',
    title: 'Validate draft',
    description: 'Check required fields and risk warnings before requesting human approval.',
    inputSchema: objectSchema({ draftId: stringSchema('Draft id.') }, ['draftId']),
    annotations: readonly(true),
    execute: ({ draftId }) => ({ validation: store.validate(String(draftId)) }),
  },
  {
    name: 'request_approval',
    title: 'Request human approval',
    description: 'Queue a complete exact revision for a human decision. The agent cannot approve it.',
    inputSchema: objectSchema(
      {
        draftId: stringSchema('Draft id.'),
        expectedRevision: revisionSchema('Exact revision to place in the human queue.'),
      },
      ['draftId', 'expectedRevision'],
    ),
    annotations: mutating,
    execute: ({ draftId, expectedRevision }) =>
      store.requestApproval(String(draftId), 'agent', Number(expectedRevision)),
  },
  {
    name: 'submit_draft',
    title: 'Execute approved revision',
    description: 'Submit only the exact revision a human approved. Fails closed on stale or missing approval.',
    inputSchema: objectSchema(
      {
        draftId: stringSchema('Draft id.'),
        expectedRevision: revisionSchema('Exact approved revision returned by get_draft.'),
      },
      ['draftId', 'expectedRevision'],
    ),
    annotations: mutating,
    execute: ({ draftId, expectedRevision }) => ({
      draft: store.submit(String(draftId), 'agent', Number(expectedRevision)),
    }),
  },
  {
    name: 'get_audit_log',
    title: 'Read audit trail',
    description: 'Read bounded human, agent, and system events, optionally scoped to one draft.',
    inputSchema: objectSchema({
      draftId: { type: 'string', description: 'Optional draft id.' },
      limit: { type: 'integer', minimum: 1, maximum: 20, description: 'Maximum events; defaults to 12.' },
    }),
    annotations: readonly(true),
    execute: ({ draftId, limit }) => ({
      events: store.audit(draftId ? String(draftId) : undefined, limit ? Number(limit) : 12),
    }),
  },
]

export interface WebMcpRegistration {
  connected: boolean
  cleanup: () => void
}

export function registerWebMcpTools(): WebMcpRegistration {
  if (!document.modelContext?.registerTool) {
    return { connected: false, cleanup: () => undefined }
  }

  const controller = new AbortController()
  for (const tool of tools) {
    void document.modelContext.registerTool(tool, { signal: controller.signal })
  }
  return { connected: true, cleanup: () => controller.abort() }
}

export async function runTool(name: string, input: Record<string, unknown>) {
  const tool = tools.find((candidate) => candidate.name === name)
  if (!tool) throw new Error(`Unknown tool: ${name}`)
  return tool.execute(input)
}

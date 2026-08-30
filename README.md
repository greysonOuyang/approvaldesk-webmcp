# ApprovalDesk

**Human approval for agent actions — exposed as structured WebMCP tools.**

ApprovalDesk is a WebMCP-native demo for consequential forms and workflows. Agents can discover forms, read exact schemas, create and edit drafts, validate missing fields and policy warnings, and request approval. The final submission tool **fails closed** until a human approves the exact draft in the UI.

## Why WebMCP

Traditional browser agents infer meaning from labels, DOM shape, and click targets. ApprovalDesk exposes workflow semantics directly through ten tools: `list_forms`, `get_form_schema`, `list_pending_approvals`, `create_draft`, `set_draft_fields`, `get_draft`, `validate_draft`, `request_approval`, `submit_draft`, and `get_audit_log`.

The UI and WebMCP tools share the same state and validation handlers. There is no second hidden submission authority.

## Human + agent contract

1. Agent discovers a workflow and reads its schema.
2. Agent creates a reversible draft and fills known fields.
3. Agent validates and surfaces risk warnings.
4. Agent requests approval.
5. Human reviews the exact values and approves or rejects.
6. Only an approved draft can pass `submit_draft`.
7. Every transition is recorded in the audit trail.

An early submission fails with `HUMAN_APPROVAL_REQUIRED`.

## Run

```bash
bun install
bun run dev
```

Production build: `bun run build`.

When `document.modelContext.registerTool` exists the tools register directly. Without WebMCP, **Agent tool console** calls the exact same handlers so the structured contract remains visible and testable.

Seeded workflows: expense reimbursement, community event permit, vendor onboarding.

See [`docs/architecture.md`](docs/architecture.md) and [`docs/submission.md`](docs/submission.md).

MIT licensed.

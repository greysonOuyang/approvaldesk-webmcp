# ApprovalDesk

**Autonomous routine work, exact-revision human decisions.**

ApprovalDesk is a human-in-the-loop agent workflow for consequential forms and repetitive administrative work. It has two agent surfaces over one authority:

- a browser-native WebMCP surface with ten structured tools; and
- an AWS Strands Agents TypeScript agent that can prepare, validate, and route work autonomously, then stop at the real human decision boundary.

The final submission path **fails closed** until a human approves the exact draft revision. There is no agent-only or UI-only bypass.

## Why this exists

Browser and LLM agents are good at repetitive preparation, but consequential actions often need a person to own the decision. ApprovalDesk separates those responsibilities deliberately:

1. the agent discovers the workflow and schema;
2. it creates a reversible draft using known facts;
3. it validates required fields and risk warnings;
4. it requests approval for one exact revision;
5. the human approves or rejects that exact revision;
6. only the approved revision can be submitted; and
7. every transition is recorded in the audit trail.

Any edit invalidates the prior approval. A stale agent write fails with `REVISION_CONFLICT`; an early submit fails with `HUMAN_APPROVAL_REQUIRED`.

## Strands Agents implementation

`src/agent/approval-agent.ts` creates a real `Agent` from `@strands-agents/sdk`. Eight Zod-typed Strands tools in `src/agent/approval-tools.ts` adapt the existing ApprovalDesk domain store instead of creating a second workflow authority.

The agent is instructed to handle routine work end to end, pass the exact revision it most recently read, and stop once the draft reaches `awaiting_approval`. A later invocation can resume after a real human decision.

The default Strands model is Amazon Bedrock. With AWS credentials configured, run:

```bash
bun run agent:demo -- "Prepare a vendor onboarding request for Example Analytics: operational analytics service, $12000 annual spend, customer data access Yes, owner owner@example.com. Stop when human approval is required."
```

No AWS secret is required to test the authority model. `src/agent/approval-agent.test.ts` supplies a deterministic model provider but still executes the official Strands `Agent.invoke()` loop and the real typed tools.

## WebMCP implementation

Traditional browser agents infer meaning from labels, DOM shape, and click targets. ApprovalDesk also publishes workflow semantics directly through ten WebMCP tools: `list_forms`, `get_form_schema`, `list_pending_approvals`, `create_draft`, `set_draft_fields`, `get_draft`, `validate_draft`, `request_approval`, `submit_draft`, and `get_audit_log`.

When `document.modelContext.registerTool` exists, those tools register directly. Without WebMCP, the in-app **Agent tool console** calls the exact same handlers so the contract remains visible and testable.

## Run the web app

```bash
bun install
bun run dev
```

Production build:

```bash
bun run build
```

Public static demo: <https://greysonouyang.github.io/approvaldesk-webmcp/>

## Verification

```bash
bun test
bun run check
bun run build
bun run test:browser
```

The test suite covers both the underlying exact-revision state machine and the Strands agent loop. Browser smoke exercises the human queue and final submission gate in Chrome.

Seeded workflows: expense reimbursement, community event permit, vendor onboarding.

## AWS Agents for Humans

The Strands extension is being prepared for the AWS **Agents for Humans** hackathon, Professional Agents track. ApprovalDesk was created during the hackathon's submission period. The repository remains public and MIT licensed.

The current public GitHub Pages deployment demonstrates the human review surface and WebMCP contract. The Strands agent currently runs as a local/CLI agent; Amazon Bedrock is the default production model when AWS credentials are configured. Amazon Bedrock AgentCore is a logical deployment target but is **not claimed as deployed** in this repository yet.

See [`docs/aws-agents-for-humans.md`](docs/aws-agents-for-humans.md) for the hackathon architecture, disclosure notes, demo plan, and remaining deployment boundary.

## Architecture

See [`docs/architecture.md`](docs/architecture.md) and the original [`docs/submission.md`](docs/submission.md) WebMCP submission notes.

MIT licensed.

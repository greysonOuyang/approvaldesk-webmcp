# AWS Agents for Humans — ApprovalDesk

## Positioning

**Track:** Professional Agents

ApprovalDesk targets repetitive professional administration: reimbursement, vendor onboarding, and other structured requests where an agent can do nearly all preparation but a person must still own the consequential decision.

The central product idea matches the hackathon theme directly: **the agent runs through routine work autonomously and surfaces only when there is a real decision to make.**

## Current implementation

- Official Strands Agents TypeScript SDK: `@strands-agents/sdk`.
- A real Strands `Agent` with eight Zod-typed ApprovalDesk tools.
- Sequential tool execution over the existing exact-revision workflow authority.
- Default production model path: Amazon Bedrock through the Strands SDK.
- Deterministic offline model only for repeatable tests; the tests still execute the full `Agent.invoke()` tool loop.
- Human review UI: existing ApprovalDesk web app.
- Static public demo: <https://greysonouyang.github.io/approvaldesk-webmcp/>.
- Public source: <https://github.com/greysonOuyang/approvaldesk-webmcp>.

## End-to-end scenario

A representative vendor-onboarding request demonstrates the boundary:

1. Strands creates the draft.
2. Strands fills only facts supplied by the user.
3. Strands validates required fields and flags financial/privacy risks.
4. Strands requests approval for exact revision N.
5. The agent ends its turn at `awaiting_approval`.
6. A human inspects revision N and approves or rejects it.
7. A later agent invocation re-reads the current revision.
8. Submission succeeds only when `status=approved` and `approvedRevision=revision`.

Edits invalidate earlier approval. Stale agent actions fail with `REVISION_CONFLICT`; unapproved submissions fail with `HUMAN_APPROVAL_REQUIRED`.

## Verification without AWS credentials

```bash
bun test src/agent/approval-agent.test.ts
```

The deterministic model emits valid Strands model-stream events and causes the official Agent loop to invoke the real typed tools. Tests verify both the pre-approval stop and the post-human-approval resume.

Full regression:

```bash
bun test
bun run check
bun run build
bun run test:browser
```

## Bedrock / hosted runtime

The CLI demo uses the Strands SDK's default model path, Amazon Bedrock:

```bash
bun run agent:demo -- "<routine professional task>"
```

This requires valid AWS credentials and Bedrock model access. The repository intentionally does not contain or fabricate credentials.

Amazon Bedrock AgentCore is encouraged by the hackathon and would strengthen the Technical Implementation score, but it is not required. A future AgentCore deployment should be added only after an AWS account/runtime is available and the deployment is live-verified.

## Submission-period / reuse disclosure

ApprovalDesk itself was created on 2026-08-30, within the AWS Agents for Humans submission period (2026-08-10 through 2026-09-14). It began as a WebMCP human-approval prototype and was extended with the Strands agent architecture during the same period. The submission should disclose that origin and identify the Strands-specific implementation added for this hackathon rather than implying every concept originated with the AWS entry.

Standard open-source libraries and AI coding assistance are used. The repository is MIT licensed.

## Remaining contest-only steps

These are deliberately not automated as part of repository implementation:

- accept Devpost contest terms / Join Hackathon;
- make the entrant's eligibility representations;
- create or verify AWS account / AWS Builder ID identity;
- request promotional credits;
- supply winner identity, banking, or tax forms if applicable.

## Demo-video outline (≤ 5 minutes)

1. **Problem (20s):** repetitive admin consumes time, while final decisions remain consequential.
2. **Agent run (90s):** show Strands autonomously creating, filling, validating, and requesting approval.
3. **Human boundary (60s):** show the UI queue, exact revision, warnings, and why the agent cannot self-approve.
4. **Fail-closed proof (40s):** demonstrate early/stale submission failure.
5. **Resume (50s):** human approves; new agent invocation re-reads and submits exact revision.
6. **Architecture (40s):** Strands model → typed tools → one exact-revision store → human UI/audit.

## Judging fit

- **Technical implementation:** real Strands Agent loop and typed tools; tested state/authority boundary.
- **Design:** coherent human-agent workflow rather than a chat wrapper.
- **Potential impact:** applicable to recurring professional admin and approval queues.
- **Creativity:** uses autonomy specifically up to, not through, the human accountability boundary.
- **Presentation:** the workflow has a compact end-to-end demo with visible failure and success states.

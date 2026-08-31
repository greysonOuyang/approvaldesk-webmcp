# AWS Agents for Humans — Devpost Submission Draft

## Project title

ApprovalDesk — autonomous admin work with exact-revision human approval

## Track

Professional Agents

## One-line pitch

ApprovalDesk lets an AI agent prepare and validate repetitive professional requests end to end, then stops exactly where a human must own the consequential decision.

## What it does

Professionals lose time to reimbursement forms, vendor onboarding, and similar structured admin. The work is mostly repetitive: discover the required schema, collect fields, validate policy requirements, surface risks, and prepare the request. The final approval, however, should remain a human decision.

ApprovalDesk uses the Strands Agents TypeScript SDK to make that split explicit. A Strands agent can autonomously discover a workflow, create a reversible draft, populate fields, validate it, and request review. The system then fails closed at `awaiting_approval`. Only the human reviewer UI can approve the exact revision that was inspected. If the draft changes afterward, the prior approval becomes invalid. Once a human approves revision N, the agent may resume and submit only that exact revision.

The same workflow authority is shared by three surfaces:

- a Strands agent with eight typed Zod tools;
- an Amazon Bedrock AgentCore Runtime-compatible HTTP wrapper exposing `/ping` and `/invocations`;
- a browser-native WebMCP interface and human review UI.

This is deliberately not a chatbot. The agent performs the routine work and escalates only the real decision.

## Who it is for

Operations teams, finance/admin staff, small businesses, and professionals who repeatedly prepare structured requests but need accountable human approval before a consequential action is committed.

## Why it matters

Most agent demos choose between two bad extremes: fully manual workflows or agents that can commit consequential actions without a trustworthy decision boundary. ApprovalDesk demonstrates a third model: automate the repetitive 90%, preserve human authority over the consequential 10%, and bind that authority to the exact state the human reviewed.

## How Strands is used

ApprovalDesk uses the official `@strands-agents/sdk` TypeScript SDK and a real `Agent` invocation loop. Eight typed tools expose the workflow lifecycle:

1. list workflows;
2. inspect a workflow schema;
3. create a draft;
4. set fields;
5. read the draft;
6. validate the draft;
7. request human approval;
8. submit an approved draft.

The deterministic test model is used only for repeatable offline tests. Production model configuration uses the Strands Bedrock model path.

## Human authority / safety model

The workflow store is the single source of truth. Submission requires both:

- `status === approved`; and
- `approvedRevision === revision`.

Any edit after an approval request increments the revision and invalidates the prior decision. Agent tools cannot manufacture an approval. Tests prove that an early submit fails, a stale revision fails, and only the exact human-approved revision can be submitted.

## AgentCore

The Node 22 AgentCore wrapper exposes:

- `GET /ping` for runtime health;
- `POST /invocations` for Strands agent invocation.

`bun run package:agentcore` creates a direct-code CodeZip containing `app.js` and a deployment-local CommonJS `package.json`. The artifact is locally runtime-tested. No claim is made that an AWS AgentCore resource has already been deployed; cloud deployment remains optional and requires a real AWS account/credentials.

## Architecture

See [`docs/architecture.md`](./architecture.md). The Mermaid diagram shows the web UI, WebMCP surface, AgentCore HTTP wrapper, Strands agent, typed tools, single exact-revision workflow store, human reviewer, validation gate, and audit trail.

## Testing instructions

```bash
bun install
bun test
bun run check
bun run build
bun run test:browser
bun run package:agentcore
```

To verify the AgentCore-compatible runtime locally:

```bash
PORT=8080 node dist-agentcore/app.js
curl --noproxy '*' http://127.0.0.1:8080/ping
```

Expected response:

```json
{"status":"Healthy"}
```

The browser smoke test demonstrates that premature agent submission is rejected, a human approval is recorded, the approved exact revision can then be submitted, and the audit trail records the sequence.

## Public links

- Source: https://github.com/greysonOuyang/approvaldesk-webmcp
- Live web UI: https://greysonouyang.github.io/approvaldesk-webmcp/

## Open source

MIT licensed. See [`LICENSE`](../LICENSE).

## Pre-existing work disclosure

ApprovalDesk's initial browser UI, WebMCP tool surface, and exact-revision workflow store were first created as a separate WebMCP prototype on August 30, 2026, during the AWS hackathon submission period. That prior purpose is disclosed here rather than presented as AWS-specific work.

For the Agents for Humans entry, the project was extended during the same submission period with the Strands Agents TypeScript agent, eight typed agent tools, full `Agent.invoke()` orchestration tests, the AgentCore Runtime-compatible `/ping` and `/invocations` HTTP surface, Node 22 direct-code packaging, AgentCore tests, architecture documentation, and AWS-specific submission material. The shared exact-revision store was intentionally reused so the Strands/AgentCore path could not introduce a second or weaker approval authority.

AI coding assistance was used during development, which the rules permit. All submitted source and documentation are public in the repository history.

## Current evidence

At the current public revision:

- 9 tests pass with 34 assertions;
- TypeScript checks pass;
- production web build passes;
- browser end-to-end smoke passes;
- AgentCore direct-code bundle builds;
- packaged `app.js` runtime returns `{"status":"Healthy"}` from `/ping`;
- public GitHub Pages UI is available without credentials.

## Submission-boundary checklist

The following are intentionally left for the entrant to complete personally because they involve account/contract/identity actions:

- Join Hackathon / agree to Devpost rules;
- provide AWS Builder ID;
- upload the final public YouTube/Vimeo demo video;
- make any required eligibility or identity attestations;
- final Devpost submission.

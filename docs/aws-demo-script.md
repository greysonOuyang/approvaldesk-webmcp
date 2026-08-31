# ApprovalDesk — 5-minute Demo Script and Shot List

Target length: 4:15–4:40, leaving margin under the 5-minute limit.

## 0:00–0:25 — Problem and audience

**Screen:** ApprovalDesk landing/workflow screen.

**Voiceover:**

> Professional teams spend hours preparing reimbursements, onboarding requests, and other structured paperwork. Most of that work is repetitive enough for an agent, but the final decision can carry financial or operational consequences. ApprovalDesk automates the routine work while keeping that consequential decision with a human.

## 0:25–0:55 — Architecture

**Screen:** Rendered architecture diagram from `docs/architecture.md`.

**Voiceover:**

> ApprovalDesk is built with the Strands Agents TypeScript SDK. The Strands agent uses typed tools to work against one exact-revision workflow store. The browser UI, WebMCP tools, and AgentCore Runtime wrapper all share that same authority, so there is no hidden bypass. Amazon Bedrock is the production model path, and the AgentCore-compatible wrapper exposes health and invocation endpoints.

## 0:55–1:55 — Agent does the routine work

**Screen:** Terminal running the deterministic `agent:demo` or focused Strands test output while the app is visible beside it.

**Voiceover:**

> The agent discovers the workflow, reads the schema, creates a reversible draft, fills the required fields, validates policy requirements, and requests approval. These are real Strands tool calls with Zod-typed inputs. The deterministic model you see in this demo makes the sequence reproducible; the production configuration uses the Strands Bedrock path.

**Show:** Tool sequence ending in `approval_request_human_approval` and `awaiting_approval`.

## 1:55–2:35 — Prove fail-closed behavior

**Screen:** Tool console or browser smoke demonstrating an early submit.

**Voiceover:**

> Here is the important boundary. Before a human approves, submission is rejected. The agent cannot approve its own work, and it cannot convert a request-for-review into approval. This is not a prompt convention; it is enforced by the workflow state machine.

**Show:** `HUMAN_APPROVAL_REQUIRED` / rejected early submit.

## 2:35–3:20 — Human decision bound to exact revision

**Screen:** Human review UI. Approve the current draft, then show audit/revision information.

**Voiceover:**

> A human reviews the exact draft and approves that revision. ApprovalDesk records the revision number. If anyone edits the draft afterward, the old approval is invalidated automatically. That prevents a common approval bug where the human approves one state but the system submits a later, changed state.

## 3:20–3:50 — Agent resumes and completes

**Screen:** Resume the agent / approved submission flow and audit trail.

**Voiceover:**

> Once the real human approval exists, the agent resumes, reads the current state, and can submit only the exact approved revision. The audit trail shows preparation, approval, and final submission as separate accountable events.

## 3:50–4:15 — AgentCore runtime proof

**Screen:** Terminal.

Run:

```bash
bun run package:agentcore
PORT=8080 node dist-agentcore/app.js
curl --noproxy '*' http://127.0.0.1:8080/ping
```

**Voiceover:**

> The same Strands agent is wrapped for Amazon Bedrock AgentCore Runtime. The Node 22 direct-code package exposes `/ping` and `/invocations`; the health check returns Healthy. The repository includes the exact packaging and local verification steps.

## 4:15–4:35 — Why it matters

**Screen:** Live GitHub Pages UI, then public GitHub repository.

**Voiceover:**

> ApprovalDesk's goal is simple: let agents own repetitive preparation without silently taking ownership of consequential human decisions. It is open source, publicly testable, and designed for the professional workflows where trustworthy automation matters most.

## Recording checklist

- Record at 1080p if possible.
- Keep terminal font large enough to read.
- Use synthetic demo values only; no personal or financial PII.
- Show the actual failed early-submit response.
- Show the human approval action and exact revision.
- Show the final successful submission and audit trail.
- Show the AgentCore `/ping` health result.
- End on the public repo / live demo URL.
- Upload publicly to YouTube or Vimeo.

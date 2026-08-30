# WebMCP Challenge submission draft

## ApprovalDesk — Human approval for agent actions

ApprovalDesk turns consequential web forms into structured agent workflows. Instead of guessing a UI, an agent discovers WebMCP tools for form schemas, reversible drafts, validation, approval requests, and submission. The final action fails closed until a human approves the exact draft, giving agents speed without giving away human authority.

### Why WebMCP

Forms show why browser agents need semantics, not coordinates. A normal agent must infer required fields, warnings, and which button creates a real-world commitment. ApprovalDesk publishes that contract directly with WebMCP. The human does not babysit every field: the agent prepares and validates the work, then surfaces only the meaningful decision.

### Implementation

ApprovalDesk registers nine tools with `document.modelContext.registerTool`. Each delegates to shared workflow handlers also used by the React UI. The store owns validation, approval state, safe transitions, and audit events. An in-app Tool Console calls the exact same handlers for browsers where WebMCP is not enabled.

### Demo storyboard (<3 minutes)

- **0:00–0:20 Problem:** show a complex form; explain brittle UI guessing and human babysitting.
- **0:20–0:45 Discovery:** run `list_forms` and `get_form_schema`.
- **0:45–1:20 Busywork:** create a vendor draft, set fields, validate, show spend/data warnings, request approval.
- **1:20–1:50 Human authority:** demonstrate `submit_draft` failing before approval; approve the exact draft in UI.
- **1:50–2:15 Finish:** run `submit_draft` again, then show the combined audit trail.
- **2:15–2:40 Architecture:** shared state authority, WebMCP adapter, UI adapter, explicit human gate.

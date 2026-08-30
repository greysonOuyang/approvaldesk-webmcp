import {
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ChangeEvent,
} from 'react'
import { forms } from './data'
import { store } from './store'
import type { Draft, FieldDefinition } from './types'
import { registerWebMcpTools, runTool, tools } from './webmcp'

const pretty = (value: unknown) => JSON.stringify(value, null, 2)
const fmt = (iso: string) =>
  new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
    day: 'numeric',
  }).format(new Date(iso))

const labels: Record<Draft['status'], string> = {
  draft: 'Draft',
  awaiting_approval: 'Needs approval',
  approved: 'Approved',
  rejected: 'Needs revision',
  submitted: 'Submitted',
}

function Field({
  field,
  value,
  onChange,
  disabled,
}: {
  field: FieldDefinition
  value: string | number | undefined
  onChange: (value: string) => void
  disabled?: boolean
}) {
  const props = {
    id: field.key,
    value: value ?? '',
    disabled,
    onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      onChange(event.target.value),
  }

  return (
    <label className="field">
      <span>
        {field.label}
        {field.required && <b>*</b>}
      </span>
      {field.type === 'textarea' ? (
        <textarea {...props} placeholder={field.placeholder} rows={3} />
      ) : field.type === 'select' ? (
        <select {...props}>
          <option value="">Select…</option>
          {field.options?.map((option) => (
            <option key={option}>{option}</option>
          ))}
        </select>
      ) : (
        <input {...props} type={field.type} placeholder={field.placeholder} />
      )}
      {field.help && <small>{field.help}</small>}
    </label>
  )
}

export default function App() {
  const state = useSyncExternalStore(store.subscribe, store.snapshot)
  const [selectedFormId, setSelectedFormId] = useState(forms[0].id)
  const [selectedDraftId, setSelectedDraftId] = useState(state.drafts[0]?.id ?? '')
  const [tab, setTab] = useState<'workflow' | 'console' | 'audit'>('workflow')
  const [webMcp, setWebMcp] = useState(false)
  const [note, setNote] = useState('')
  const [toolName, setToolName] = useState('list_forms')
  const [toolInput, setToolInput] = useState('{}')
  const [toolOutput, setToolOutput] = useState('Run a tool to see its structured result.')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const registration = registerWebMcpTools()
    setWebMcp(registration.connected)
    return registration.cleanup
  }, [])

  const draft = state.drafts.find((candidate) => candidate.id === selectedDraftId)
  const form = forms.find((candidate) => candidate.id === (draft?.formId ?? selectedFormId)) ?? forms[0]
  const validation = draft ? store.validate(draft.id) : undefined
  const pending = state.drafts.filter((candidate) => candidate.status === 'awaiting_approval').length
  const submitted = state.drafts.filter((candidate) => candidate.status === 'submitted').length
  const agentEvents = state.audit.filter((event) => event.actor === 'agent').slice(0, 4)

  const samples = useMemo<Record<string, object>>(
    () => ({
      list_forms: {},
      get_form_schema: { formId: 'expense-reimbursement' },
      list_pending_approvals: {},
      create_draft: { formId: 'vendor-onboarding' },
      set_draft_fields: {
        draftId: draft?.id ?? 'draft_demo_1',
        expectedRevision: draft?.revision ?? 1,
        values: { merchant: 'Northstar Hotel' },
      },
      get_draft: { draftId: draft?.id ?? 'draft_demo_1' },
      validate_draft: { draftId: draft?.id ?? 'draft_demo_1' },
      request_approval: {
        draftId: draft?.id ?? 'draft_demo_1',
        expectedRevision: draft?.revision ?? 1,
      },
      submit_draft: {
        draftId: draft?.id ?? 'draft_demo_1',
        expectedRevision: draft?.revision ?? 1,
      },
      get_audit_log: { draftId: draft?.id ?? 'draft_demo_1', limit: 12 },
    }),
    [draft?.id, draft?.revision],
  )

  const createDraft = () => {
    const created = store.createDraft(selectedFormId, 'human')
    setSelectedDraftId(created.id)
  }

  const change = (key: string, value: string) => {
    if (!draft) return
    const field = form.fields.find((candidate) => candidate.key === key)
    store.updateFields(
      draft.id,
      { [key]: field?.type === 'number' && value !== '' ? Number(value) : value },
      'human',
    )
  }

  const run = async () => {
    setBusy(true)
    try {
      setToolOutput(pretty(await runTool(toolName, JSON.parse(toolInput || '{}'))))
    } catch (error) {
      setToolOutput(`ERROR: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">A</div>
          <div>
            <strong>ApprovalDesk</strong>
            <span>human gates for agent work</span>
          </div>
        </div>
        <div className="nav-label">Workflows</div>
        {forms.map((item) => (
          <button
            key={item.id}
            className={`form-nav ${selectedFormId === item.id ? 'active' : ''}`}
            onClick={() => {
              setSelectedFormId(item.id)
              const existing = state.drafts.find((candidate) => candidate.formId === item.id)
              setSelectedDraftId(existing?.id ?? '')
            }}
          >
            <span className={`risk-dot ${item.risk}`} />
            <span>
              <b>{item.title}</b>
              <small>
                {item.category} · {item.estimatedMinutes} min
              </small>
            </span>
          </button>
        ))}
        <button className="new-draft" onClick={createDraft}>
          + New {forms.find((item) => item.id === selectedFormId)?.title}
        </button>
        <div className="sidebar-note">
          <b>Why WebMCP?</b>
          <p>
            Agents get typed tools and schemas instead of guessing the UI. Humans keep authority over
            consequential actions.
          </p>
        </div>
      </aside>

      <main>
        <header className="topbar">
          <div>
            <p className="eyebrow">AGENT-NATIVE OPERATIONS</p>
            <h1>Move fast. Keep the human decision.</h1>
          </div>
          <div className={`mcp-pill ${webMcp ? 'online' : ''}`}>
            <span />
            {webMcp ? 'WebMCP connected' : 'Demo bridge active'}
          </div>
        </header>

        <section className="metrics">
          <article>
            <span>Waiting on human</span>
            <strong>{pending}</strong>
            <small>Agent work pauses at the right boundary</small>
          </article>
          <article>
            <span>Structured tools</span>
            <strong>{tools.length}</strong>
            <small>Discoverable through document.modelContext</small>
          </article>
          <article>
            <span>Completed safely</span>
            <strong>{submitted}</strong>
            <small>Only after exact-revision approval</small>
          </article>
        </section>

        <section className="demo-strip">
          <div><b>1</b><span>Agent prepares a typed draft</span></div>
          <div><b>2</b><span>Human approves one exact revision</span></div>
          <div><b>3</b><span>Agent resumes or fails closed</span></div>
        </section>

        <nav className="tabs">
          {(['workflow', 'console', 'audit'] as const).map((item) => (
            <button
              key={item}
              className={tab === item ? 'active' : ''}
              onClick={() => setTab(item)}
            >
              {item === 'workflow' ? 'Human queue' : item === 'console' ? 'Agent tool console' : 'Audit trail'}
            </button>
          ))}
        </nav>

        {tab === 'workflow' && (
          <div className="content-grid">
            <section className="panel editor-panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">CURRENT DRAFT</p>
                  <h2>{form.title}</h2>
                  <p>{form.description}</p>
                </div>
                {draft && (
                  <div className="status-stack">
                    <span className={`status ${draft.status}`}>{labels[draft.status]}</span>
                    <small>revision {draft.revision}</small>
                  </div>
                )}
              </div>

              {!draft ? (
                <div className="empty">Create a draft to begin.</div>
              ) : (
                <>
                  {(draft.status === 'awaiting_approval' || draft.status === 'approved') && (
                    <div className={`revision-lock ${draft.status}`}>
                      <span>REVISION LOCK</span>
                      <b>
                        {draft.status === 'approved'
                          ? `Human approved revision ${draft.approvedRevision}.`
                          : `Human is reviewing revision ${draft.approvalRequestedRevision}.`}
                      </b>
                      <p>Any field change invalidates this decision and creates a new revision.</p>
                    </div>
                  )}

                  <div className="fields-grid">
                    {form.fields.map((field) => (
                      <Field
                        key={field.key}
                        field={field}
                        value={draft.values[field.key]}
                        disabled={draft.status === 'submitted'}
                        onChange={(value) => change(field.key, value)}
                      />
                    ))}
                  </div>

                  <div className="validation-box">
                    <div>
                      <b>
                        {validation?.valid
                          ? `Revision ${draft.revision} is complete`
                          : `${validation?.missing.length ?? 0} required field(s) missing`}
                      </b>
                      <span>
                        {validation?.valid
                          ? 'The agent can request a human decision.'
                          : validation?.missing.map((item) => item.label).join(', ')}
                      </span>
                    </div>
                    {validation?.warnings.map((warning) => <p key={warning}>⚠ {warning}</p>)}
                  </div>

                  <div className="action-row">
                    {draft.status === 'draft' && (
                      <button
                        className="primary"
                        disabled={!validation?.valid}
                        onClick={() => store.requestApproval(draft.id, 'human')}
                      >
                        Send revision {draft.revision} to approval
                      </button>
                    )}
                    {draft.status === 'awaiting_approval' && (
                      <>
                        <input
                          className="note-input"
                          value={note}
                          onChange={(event) => setNote(event.target.value)}
                          placeholder="Optional decision note"
                        />
                        <button
                          className="approve"
                          onClick={() => {
                            store.decide(draft.id, 'approve', note)
                            setNote('')
                          }}
                        >
                          Approve revision {draft.revision}
                        </button>
                        <button
                          className="reject"
                          onClick={() => {
                            store.decide(draft.id, 'reject', note)
                            setNote('')
                          }}
                        >
                          Reject
                        </button>
                      </>
                    )}
                    {draft.status === 'approved' && (
                      <button
                        className="primary"
                        onClick={() => store.submit(draft.id, 'human', draft.revision)}
                      >
                        Execute approved revision
                      </button>
                    )}
                    {draft.status === 'rejected' && (
                      <button
                        className="primary"
                        disabled={!validation?.valid}
                        onClick={() => store.requestApproval(draft.id, 'human')}
                      >
                        Request approval again
                      </button>
                    )}
                    {draft.status === 'submitted' && (
                      <div className="success-copy">
                        ✓ Revision {draft.revision} submitted with matching human approval.
                      </div>
                    )}
                  </div>
                </>
              )}
            </section>

            <aside className="panel activity-panel">
              <div className="panel-heading compact">
                <div>
                  <p className="eyebrow">AGENT ACTIVITY</p>
                  <h2>What the agent did</h2>
                </div>
              </div>
              <div className="activity-list">
                {agentEvents.map((event) => (
                  <div className="activity" key={event.id}>
                    <div className="activity-icon">↗</div>
                    <div>
                      <b>{event.action.replaceAll('_', ' ')}</b>
                      <p>{event.detail}</p>
                      <small>{fmt(event.ts)}</small>
                    </div>
                  </div>
                ))}
              </div>
              <div className="guardrail-card">
                <span>HUMAN GATE</span>
                <h3>Approval is a revision-bound capability.</h3>
                <p>
                  <code>submit_draft</code> requires the current revision to match the exact revision a
                  person approved. Stale agent state fails closed.
                </p>
              </div>
            </aside>
          </div>
        )}

        {tab === 'console' && (
          <section className="panel console-panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">SAME HANDLERS, TWO SURFACES</p>
                <h2>Agent tool console</h2>
                <p>
                  This console calls the exact handlers registered with{' '}
                  <code>document.modelContext.registerTool</code>, so the full contract is testable even
                  without a WebMCP-enabled browser.
                </p>
              </div>
            </div>
            <div className="console-grid">
              <div>
                <label className="field">
                  <span>Tool</span>
                  <select
                    value={toolName}
                    onChange={(event) => {
                      const next = event.target.value
                      setToolName(next)
                      setToolInput(pretty(samples[next] ?? {}))
                    }}
                  >
                    {tools.map((tool) => <option key={tool.name}>{tool.name}</option>)}
                  </select>
                </label>
                <label className="field">
                  <span>JSON input</span>
                  <textarea
                    className="code-input"
                    rows={12}
                    value={toolInput}
                    onChange={(event) => setToolInput(event.target.value)}
                  />
                </label>
                <button className="primary" onClick={run} disabled={busy}>
                  {busy ? 'Running…' : 'Run structured tool'}
                </button>
              </div>
              <pre className="output">{toolOutput}</pre>
            </div>
            <div className="tool-list">
              {tools.map((tool) => (
                <article key={tool.name}>
                  <div className="tool-title-row">
                    <code>{tool.name}</code>
                    <span className={tool.annotations.readOnlyHint ? 'read-only' : 'mutating'}>
                      {tool.annotations.readOnlyHint ? 'read only' : 'state change'}
                    </span>
                  </div>
                  <p>{tool.description}</p>
                </article>
              ))}
            </div>
          </section>
        )}

        {tab === 'audit' && (
          <section className="panel audit-panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">ACCOUNTABILITY</p>
                <h2>Human + agent audit trail</h2>
                <p>Every meaningful state transition records who acted and which revision changed.</p>
              </div>
              <button
                className="ghost"
                onClick={() => {
                  store.reset()
                  setSelectedDraftId('draft_demo_1')
                }}
              >
                Reset demo
              </button>
            </div>
            <div className="audit-table">
              <div className="audit-head">
                <span>Actor</span>
                <span>Action</span>
                <span>Detail</span>
                <span>Time</span>
              </div>
              {state.audit.map((event) => (
                <div className="audit-row" key={event.id}>
                  <span className={`actor ${event.actor}`}>{event.actor}</span>
                  <code>{event.action}</code>
                  <span>{event.detail}</span>
                  <small>{fmt(event.ts)}</small>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  )
}

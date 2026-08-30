export type FieldType = 'text' | 'email' | 'number' | 'date' | 'select' | 'textarea'

export interface FieldDefinition {
  key: string
  label: string
  type: FieldType
  required?: boolean
  placeholder?: string
  options?: string[]
  help?: string
}

export interface FormDefinition {
  id: string
  title: string
  description: string
  category: string
  risk: 'low' | 'medium' | 'high'
  estimatedMinutes: number
  fields: FieldDefinition[]
}

export type DraftStatus = 'draft' | 'awaiting_approval' | 'approved' | 'rejected' | 'submitted'

export interface Draft {
  id: string
  formId: string
  values: Record<string, string | number>
  status: DraftStatus
  revision: number
  createdAt: string
  updatedAt: string
  approvalRequestedRevision?: number
  approvedRevision?: number
  approvalNote?: string
  submittedAt?: string
}

export interface AuditEvent {
  id: string
  ts: string
  actor: 'agent' | 'human' | 'system'
  action: string
  detail: string
  draftId?: string
}

export interface PersistedState {
  drafts: Draft[]
  audit: AuditEvent[]
}

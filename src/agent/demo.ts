import { createApprovalAgent } from './approval-agent'

type RuntimeWithArgv = typeof globalThis & { process?: { argv?: string[] } }
const argv = (globalThis as RuntimeWithArgv).process?.argv ?? []
const request = argv.slice(2).join(' ').trim() ||
  'Prepare a vendor onboarding request for Example Analytics: operational analytics service, $12000 annual spend, customer data access Yes, owner owner@example.com. Stop when human approval is required.'

const agent = createApprovalAgent()
const result = await agent.invoke(request)
console.log(result.lastMessage)

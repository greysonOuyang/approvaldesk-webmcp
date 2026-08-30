import { store } from './store'
type JsonSchema=Record<string,unknown>; type ToolHandler=(input:Record<string,unknown>)=>unknown|Promise<unknown>
export interface ToolDefinition{name:string;description:string;inputSchema:JsonSchema;execute:ToolHandler}
declare global{interface Document{modelContext?:{registerTool(tool:ToolDefinition):void}}}
const obj=(properties:Record<string,unknown>,required:string[]=[]):JsonSchema=>({type:'object',properties,required,additionalProperties:false});const str=(description:string)=>({type:'string',description})
let registered=false
export const tools:ToolDefinition[]=[
{name:'list_forms',description:'List the consequential workflows ApprovalDesk exposes to agents, including risk and effort.',inputSchema:obj({}),execute:()=>({forms:store.listForms()})},
{name:'get_form_schema',description:'Read the exact fields for one form before creating or editing a draft.',inputSchema:obj({formId:str('Form id returned by list_forms.')},['formId']),execute:({formId})=>{const form=store.getForm(String(formId));if(!form)throw new Error(`Unknown form: ${String(formId)}`);return{form}}},
{name:'create_draft',description:'Create a reversible draft for a form. This never submits anything.',inputSchema:obj({formId:str('Form id returned by list_forms.')},['formId']),execute:({formId})=>({draft:store.createDraft(String(formId),'agent')})},
{name:'set_draft_fields',description:'Set one or more fields on a draft. Unknown fields are ignored; this never grants approval.',inputSchema:obj({draftId:str('Draft id.'),values:{type:'object',description:'Field/value map matching the form schema.',additionalProperties:{type:['string','number']}}},['draftId','values']),execute:({draftId,values})=>({draft:store.updateFields(String(draftId),(values??{}) as Record<string,string|number>,'agent')})},
{name:'get_draft',description:'Inspect current values and approval status of a draft.',inputSchema:obj({draftId:str('Draft id.')},['draftId']),execute:({draftId})=>{const draft=store.getDraft(String(draftId));if(!draft)throw new Error(`Unknown draft: ${String(draftId)}`);return{draft,validation:store.validate(draft.id)}}},
{name:'validate_draft',description:'Validate required fields and surface risk warnings before asking a human to approve.',inputSchema:obj({draftId:str('Draft id.')},['draftId']),execute:({draftId})=>({validation:store.validate(String(draftId))})},
{name:'request_approval',description:'Move a complete draft into the human decision queue. The agent cannot approve its own request.',inputSchema:obj({draftId:str('Draft id.')},['draftId']),execute:({draftId})=>store.requestApproval(String(draftId),'agent')},
{name:'submit_draft',description:'Submit only after a human explicitly approved the exact draft. Fails closed otherwise.',inputSchema:obj({draftId:str('Draft id.')},['draftId']),execute:({draftId})=>({draft:store.submit(String(draftId),'agent')})},
{name:'get_audit_log',description:'Read the human/agent/system audit trail, optionally scoped to one draft.',inputSchema:obj({draftId:{type:'string',description:'Optional draft id.'}}),execute:({draftId})=>({events:store.audit(draftId?String(draftId):undefined)})}]
export function registerWebMcpTools(){if(registered)return true;if(!document.modelContext?.registerTool)return false;tools.forEach(t=>document.modelContext!.registerTool(t));registered=true;return true}
export async function runTool(name:string,input:Record<string,unknown>){const tool=tools.find(t=>t.name===name);if(!tool)throw new Error(`Unknown tool: ${name}`);return tool.execute(input)}

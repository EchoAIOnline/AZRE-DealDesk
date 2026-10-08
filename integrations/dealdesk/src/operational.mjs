import { z } from 'zod';
import { validatePhotos, photoUrl } from './photos.mjs';
import { randomUUID } from 'node:crypto';
import { fields, id, project, DomainError, fail } from './domain.mjs';

const text = z.string().trim().min(1).max(1000);
const date = z.iso.date().nullable();
export const dealFields = {
  ...fields.Deals,
  offerDecision: fields.Deals.offerDecision.describe('Pipeline Status. Use this field for the pipeline stage, not status.'),
  status: text.describe('Separate/general DealDesk status; NOT Pipeline Status.'),
  offerPrice: fields.Deals.offerPrice.describe("AZRE's current offer price."),
  originalAskingPrice:z.number().int().min(0).max(2147483647),
  reducedAskingPrice:z.number().int().min(0).max(2147483647),
  negotiatedAskingPrice:z.number().int().min(0).max(2147483647).describe('Seller counter/negotiated asking position.'),
  propertyType: z.enum(['Single Family Residential','Multi-Family Residential','Commercial','Land']),
  dealType: z.array(z.enum(['Renovation','Rental','New Construction','Multi-Family'])).max(4),
  interestLevel: z.enum(['High','Mild','Not Interested']),
  contactStatus: z.enum(['Agent Not Contacted Yet','Sent LOI Email','Sent Initial Text Message','First Call, No Answer','Spoke With Agent','Waiting To Hear Back','Offer Declined','Offer Accepted']),
  sqft: z.number().int().min(0).max(1e9), lotSqft: z.number().int().min(0).max(1e10),
  zoning: text, listingType: z.enum(['Listed On MLS','Off-Market']),
  listingStatus: text, forSaleBy: text, dateListed: date, inspectionDate: date, emdDate: date,
  underContractDate: date, closedDate: date, declinedDate: date,
};
export const taskFields = {
  title: text, description: z.string().max(5000), dueDate: z.union([z.iso.date(),z.iso.datetime({offset:true})]),
  assignee: text, status: z.enum(['Open','Completed']), priority:z.enum(['Low','Normal','High','Urgent']),
};
const optional = shape => Object.fromEntries(Object.entries(shape).map(([key,schema])=>[key,schema.optional()]));
export const dealCreate = z.object({...optional(dealFields),address:dealFields.address}).strict();
export const dealPatch = z.object(optional(dealFields)).strict().refine(v=>Object.keys(v).length>0,'Supply at least one field.');
const revision = z.number().int().nonnegative().describe('Current _revision from get_deal or search_tasks. Reread and reconcile on CONFLICT.');
export const operationalTools = [
  {name:'add_deal_photos',description:'Append verified Zillow CDN photo URLs to the existing gallery, preserving order and existing photos. Exact URLs are deduplicated. Requires the current deal revision; no deletion. Maximum 10 images, 8 MiB each.',schema:z.object({deal_id:id,photo_urls:z.array(z.string().max(2048).refine(v=>{try{photoUrl(v);return true;}catch{return false;}},'Use a direct photos.zillowstatic.com image URL.')).min(1).max(10),expected_revision:revision,request_id:z.uuid().optional()}).strict()},
  {name:'create_deal',description:'Create an AZRE acquisition opportunity using only known facts. offerDecision is Pipeline Status and defaults to No Offer Made Yet. Address/MLS duplicates return DUPLICATE with existing records. Never sends offers or messages.',schema:z.object({fields:dealCreate,request_id:z.uuid().optional().describe('Optional idempotency UUID; reuse on retries.')}).strict()},
  {name:'update_deal',description:'PATCH an existing deal after get_deal. Only supplied fields change; a stale expected_revision returns CONFLICT. offerDecision = Pipeline Status; status is separate/general status; offerPrice = AZRE offer; negotiatedAskingPrice = seller counter. No outreach or contract execution.',schema:z.object({deal_id:id,expected_revision:revision,fields:dealPatch}).strict()},
  {name:'add_deal_note',description:'Append a timestamped ChatGPT-attributed note without replacing history. Concurrent appends are serialized. Never deletes notes.',schema:z.object({deal_id:id,body:z.string().trim().min(1).max(5000),category:z.string().trim().min(1).max(80).optional(),request_id:z.uuid().optional()}).strict()},
  {name:'create_task',description:'Create an operational task in PluginTasks, associated with an existing AZRE deal, buyer or agent. Retrieve via search_tasks. Does not send notifications.',schema:z.object({fields:z.object({...optional(taskFields),title:taskFields.title,entityType:z.enum(['Deals','Buyers','Agents']),entityId:id,dueDate:taskFields.dueDate}).strict(),request_id:z.uuid().optional()}).strict()},
  {name:'update_task',description:'PATCH a task after search_tasks using its current _revision. Only supplied fields change. Set status to Completed to complete it; no separate completion tool is needed.',schema:z.object({task_id:z.uuid(),expected_revision:revision,fields:z.object(optional(taskFields)).strict().refine(v=>Object.keys(v).length>0)}).strict()},
];

export async function mutate(db,name,input,identity,source = name) {
  const tool=operationalTools.find(t=>t.name===name);
  if(!tool) fail('TOOL_UNAVAILABLE','This mutation is unavailable.');
  const args=tool.schema.parse(input);
  const patch={...(args.fields||{})};
  if(patch.address) patch.address=patch.address.replace(/\s+/g,' ').replace(/\s*,\s*/g,', ').trim();
  if(patch.mls) patch.mls=patch.mls.trim();
  const {data,error}=name==='add_deal_photos' ? await db.rpc('dealdesk_add_photos',{
    p_id:args.deal_id,p_urls:await validatePhotos(args.photo_urls),p_revision:args.expected_revision,
    p_user:identity.sub,p_client:identity.client_id,p_session:identity.session_id,p_request:args.request_id??null,
  }) : await db.rpc('dealdesk_operational_mutation',{
    p_tool:name,p_source:source,p_id:args.deal_id||args.task_id||args.request_id||randomUUID(),p_patch:patch,
    p_revision:args.expected_revision??null,p_note:args.body??null,p_category:args.category??null,
    p_user:identity.sub,p_client:identity.client_id,p_session:identity.session_id,
    p_request:args.request_id??null,
  });
  if(error) fail('DATABASE_ERROR','Mutation failed; no partial changes were committed.');
  if(data.error) {const e=new DomainError(data.error.code,data.error.message); e.details=data.error.details; throw e;}
  const table=name.includes('task')?'PluginTasks':'Deals';
  // Preserve every business field in the complete mutation result, but omit tenancy/internal controls.
  const {organization_id,pluginRevision,pluginArchiveReason,...record}=data.record;
  return {...data,record:{...record,...project(table,data.record),_revision:pluginRevision}};
}

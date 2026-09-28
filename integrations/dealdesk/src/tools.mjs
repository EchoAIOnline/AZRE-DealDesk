import { z } from 'zod';
import { createSchema, patchSchema, fields, searchFields, recordTypes, id, fail, DomainError } from './domain.mjs';
import { evaluateBuyer } from './matching.mjs';

const revision=z.number().int().nonnegative().describe('The _revision returned by the most recent read; stale edits are rejected.');
const target={record_type:z.enum(recordTypes),record_id:id};
const mutation={expected_revision:revision};
const definitions=[];
function define(name,description,schema,write,run,destructive=false) { definitions.push({name,description,schema,write,run,destructive}); }
for (const [singular,plural,table] of [['deal','deals','Deals'],['buyer','buyers','Buyers'],['agent','agents','Agents'],['task','tasks','PluginTasks']]) {
  const filterShape=Object.fromEntries(searchFields[table].map(k=>[k,(k==='doNotCall'?z.boolean():z.string().max(1000)).optional()]));
  define(`search_${plural}`,`Search ${plural} in the configured DealDesk organization. query searches ${table==='Deals'?'address':table==='PluginTasks'?'title':'name'}; filters are exact matches. Follow next_offset for more pages.`,z.object({query:z.string().max(200).optional(),filters:z.object(filterShape).strict().optional(),offset:z.number().int().min(0).max(100000).default(0),limit:z.number().int().min(1).max(100).default(25),include_archived:z.boolean().default(false)}).strict(),false,(args,client)=>client.operate({action:'read',table,...args}));
  if (singular==='task') continue;
  define(`get_${singular}`,`Read one ${singular}, including its _revision for a later update. Archived records can be read by ID.`,z.object({[`${singular}_id`]:id}).strict(),false,async(args,client)=>{
    const r=await client.operate({action:'read',table,id:args[`${singular}_id`],include_archived:true});
    if(r.records.length!==1) fail('NOT_FOUND','Record not found.');
    return {record:r.records[0]};
  });
}
for(const [name,table] of [['deal','Deals'],['buyer','Buyers'],['task','PluginTasks']]) {
  define(`create_${name}`,`Create a ${name}. Use a fresh UUID request_id once per intended creation and reuse it if retrying. ${name==='task'?'Tasks are stored in the plugin task table and can be retrieved with search_tasks.':''}`,z.object({request_id:z.uuid(),fields:createSchema(table)}).strict(),true,(args,client)=>client.operate({action:'create',table,request_id:args.request_id,payload:args.fields}));
  if(name==='task') continue;
  define(`update_${name}`,`Update allowed ${name} fields after reading the record. This records internal data; it never communicates externally or executes an offer. Buy box fields are merged with existing criteria.`,z.object({[`${name}_id`]:id,fields:patchSchema(table),...mutation}).strict(),true,(args,client)=>client.operate({action:'update',table,id:args[`${name}_id`],payload:args.fields,expected_revision:args.expected_revision}),true);
}
define('update_offer','Update a deal’s recorded offer and negotiation fields. Offers live on Deals; this does not send an offer, sign a contract, or transfer money.',z.object({deal_id:id,fields:z.object(Object.fromEntries(['offerPrice','offerDecision','negotiatedAskingPrice','desiredWholesaleProfit'].map(k=>[k,fields.Deals[k].optional()]))).strict().refine(v=>Object.keys(v).length>0),...mutation}).strict(),true,(args,client)=>client.operate({action:'update',table:'Deals',id:args.deal_id,payload:args.fields,expected_revision:args.expected_revision}),true);
define('create_note','Append one internal note to the existing deal logs or buyer/agent notes, preserving existing entries. Read the record first.',z.object({...target,text:z.string().trim().min(1).max(5000),...mutation}).strict(),true,(args,client)=>client.operate({action:'append_note',table:args.record_type,id:args.record_id,note:args.text,expected_revision:args.expected_revision}));
define('archive_record','Reversibly hide a deal, buyer, or agent from plugin searches and matching. The current DealDesk web UI does not filter this archive flag. Requires archive permission.',z.object({...target,reason:z.string().trim().min(1).max(1000),...mutation}).strict(),true,(args,client)=>client.operate({action:'archive',table:args.record_type,id:args.record_id,reason:args.reason,expected_revision:args.expected_revision}),true);
define('restore_record','Restore a record archived through the plugin. Requires archive permission.',z.object({...target,...mutation}).strict(),true,(args,client)=>client.operate({action:'restore',table:args.record_type,id:args.record_id,expected_revision:args.expected_revision}));
define('match_buyers','Screen one buyer page against a deal’s recorded buy boxes. Returns fit, mismatches and missing data; never treats missing criteria as confirmed fit. Follow next_offset to screen all buyers. No outreach is sent.',z.object({deal_id:id,offset:z.number().int().min(0).max(100000).default(0),limit:z.number().int().min(1).max(100).default(25)}).strict(),false,async(args,client)=>{
  const d=await client.operate({action:'read',table:'Deals',id:args.deal_id});
  if(d.records.length!==1) fail('NOT_FOUND','Active deal not found.');
  const buyers=await client.operate({action:'read',table:'Buyers',offset:args.offset,limit:args.limit});
  const candidates=buyers.records.map(b=>({buyer_id:b.id,name:b.name,status:b.status,subscriptionStatus:b.subscriptionStatus,...evaluateBuyer(d.records[0],b)})).sort((a,b)=>Number(b.eligible)-Number(a.eligible)||b.score-a.score);
  return {deal_id:args.deal_id,candidates,next_offset:buyers.next_offset,scope:'This page only. Combine every page before claiming a complete ranking.'};
});
export const tools=definitions;
export async function invoke(name,input,{client,writes=false,archive=false,audit=()=>{}}) {
  const tool=tools.find(t=>t.name===name);
  if(!tool) fail('UNKNOWN_TOOL','Unknown tool.');
  try {
    const args=tool.schema.parse(input);
    if(tool.write && !writes) fail('WRITES_DISABLED','Writes are disabled on the MCP server.');
    if(['archive_record','restore_record'].includes(name) && !archive) fail('ARCHIVE_DISABLED','Archiving is disabled on the MCP server.');
    const result=await tool.run(args,client);
    audit({tool:name,status:'success',write:tool.write});
    return result;
  } catch(error) {
    audit({tool:name,status:'error',code:error instanceof DomainError?error.code:'INVALID_REQUEST',write:tool.write});
    throw error;
  }
}

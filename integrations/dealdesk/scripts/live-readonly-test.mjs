import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { DealDeskClient } from '../src/client.mjs';
const reports=[];
const transport=new StdioClientTransport({command:process.execPath,args:['--env-file='+fileURLToPath(new URL('../.env',import.meta.url)),fileURLToPath(new URL('../src/server.mjs',import.meta.url))],env:{...process.env,DEALDESK_PLUGIN_WRITES:'false',DEALDESK_PLUGIN_ARCHIVE:'false'},stderr:'pipe'});
const mcp=new Client({name:'dealdesk-live-verification',version:'1.0'});
const check=(name,details={})=>{reports.push({name,result:'PASS',...details});console.log(name+': PASS');};
async function call(name,args,blocked=false){const r=await mcp.callTool({name,arguments:args});if(blocked){assert.equal(r.isError,true);assert.equal(JSON.parse(r.content[0].text).error.code,'WRITES_DISABLED');}else assert.notEqual(r.isError,true,JSON.stringify(r));check(name,{behavior:blocked?'write rejected':'read succeeded'});return r.structuredContent;}
try {
 await mcp.connect(transport);const listed=await mcp.listTools();assert.equal(listed.tools.length,17);check('MCP discovery',{tools:17});
 const ids={};
 for(const [plural,singular] of [['deals','deal'],['buyers','buyer'],['agents','agent']]){
  const r=await call('search_'+plural,{limit:2});assert.ok(r.records.length);ids[singular]=r.records[0];
  for(const x of r.records){assert.ok(Number.isInteger(x._revision));assert.ok(!('organization_id'in x));assert.ok(!('lockBoxCode'in x));}
  const one=await call('get_'+singular,{[singular+'_id']:ids[singular].id});assert.equal(one.record.id,ids[singular].id);
 }
 await call('search_tasks',{limit:2});await call('match_buyers',{deal_id:ids.deal.id,limit:2});
 const target={record_type:'Deals',record_id:ids.deal.id,expected_revision:ids.deal._revision};
 const cases={create_deal:{request_id:randomUUID(),fields:{address:'READONLY TEST MUST NOT BE CREATED'}},create_buyer:{request_id:randomUUID(),fields:{name:'READONLY TEST MUST NOT BE CREATED'}},create_task:{request_id:randomUUID(),fields:{title:'READONLY TEST MUST NOT BE CREATED',entityType:'Deals',entityId:ids.deal.id,dueDate:'2026-10-01'}},update_deal:{deal_id:ids.deal.id,expected_revision:ids.deal._revision,fields:{address:ids.deal.address}},update_buyer:{buyer_id:ids.buyer.id,expected_revision:ids.buyer._revision,fields:{name:ids.buyer.name}},update_offer:{deal_id:ids.deal.id,expected_revision:ids.deal._revision,fields:{offerPrice:0}},create_note:{...target,text:'READONLY TEST MUST NOT BE APPENDED'},archive_record:{...target,reason:'READONLY TEST MUST NOT ARCHIVE'},restore_record:target};
 for(const [name,args] of Object.entries(cases))await call(name,args,true);
 const upstream=new DealDeskClient({url:process.env.DEALDESK_PLUGIN_URL,apiKey:process.env.DEALDESK_PLUGIN_API_KEY,previewBypass:process.env.VERCEL_AUTOMATION_BYPASS_SECRET});
 // Deliberately incomplete requests cannot mutate even if a backend flag is misconfigured.
 for(const action of ['create','update','append_note','archive','restore']){await assert.rejects(upstream.operate({action,table:'Deals'}),{code:'WRITES_DISABLED'});check('backend '+action+' gate');}
 const bad=new DealDeskClient({url:process.env.DEALDESK_PLUGIN_URL,apiKey:'invalid-key-'.repeat(4),previewBypass:process.env.VERCEL_AUTOMATION_BYPASS_SECRET});await assert.rejects(bad.operate({action:'read',table:'Deals',limit:1}),{code:'UNAUTHORIZED'});check('invalid credential rejected');
 const empty=await mcp.callTool({name:'search_deals',arguments:{query:'nonexistent-'+randomUUID()}});assert.equal(empty.structuredContent.records.length,0);check('empty search');
 const invalid=await mcp.callTool({name:'search_deals',arguments:{filters:{organization_id:'test-org'}}});assert.equal(invalid.isError,true);check('organization override rejected');
 const missing=await mcp.callTool({name:'get_deal',arguments:{deal_id:randomUUID()}});assert.equal(missing.isError,true);check('missing record rejected');
 const page1=await upstream.operate({action:'read',table:'Deals',limit:1,offset:0});const page2=await upstream.operate({action:'read',table:'Deals',limit:1,offset:page1.next_offset});assert.notEqual(page1.records[0].id,page2.records[0].id);check('pagination');
 await writeFile(new URL('../../LIVE-TEST-RESULTS.json',import.meta.url),JSON.stringify({timestamp:new Date().toISOString(),endpoint:process.env.DEALDESK_PLUGIN_URL,mode:'read-only',reports},null,2)+'\n');
} finally {await mcp.close();}

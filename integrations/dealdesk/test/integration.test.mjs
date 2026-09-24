import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { once } from 'node:events';
import { request as httpRequest } from 'node:http';
import express from 'express';
import { database } from './database.mjs';
import { executeOperation, makeHandler } from '../backend/handler.mjs';
import { DealDeskClient } from '../src/client.mjs';
import { createServer, createHttpApp } from '../src/server.mjs';
import { invoke, tools } from '../src/tools.mjs';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { fileURLToPath } from 'node:url';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

let pg,db;
const config={organizationId:'azre-test',writes:true,archive:true};
const run=req=>executeOperation(db,req,config);
const fixture=async(table,payload)=> (await run({action:'create',table,request_id:randomUUID(),payload})).record;
before(async()=>{({pg,db}=await database());});
after(async()=>{await pg.close();});

test('migration is repeatable and audit stores field names, not note content',async()=>{
  await pg.exec(await readFile(new URL('../backend/001-plugin.sql',import.meta.url),'utf8'));
  const row=await fixture('Deals',{address:'100 Test Lane'});
  await run({action:'append_note',table:'Deals',id:row.id,expected_revision:row._revision,note:'private-note-value'});
  const result=await pg.query('SELECT * FROM "PluginAudit" WHERE "entityId"=$1',[row.id]);
  assert.equal(result.rows.length,2);
  assert.ok(result.rows[1].changedFields.includes('logs'));
  assert.ok(!JSON.stringify(result.rows).includes('private-note-value'));
});
test('organization isolation applies to reads, writes and task targets',async()=>{
  const row=await fixture('Deals',{address:'Tenant boundary'});
  const foreign={...config,organizationId:'other-org'};
  assert.equal((await executeOperation(db,{action:'read',table:'Deals',id:row.id},foreign)).records.length,0);
  await assert.rejects(executeOperation(db,{action:'update',table:'Deals',id:row.id,expected_revision:0,payload:{address:'Cross-tenant'}},foreign),{code:'NOT_FOUND'});
  await assert.rejects(executeOperation(db,{action:'create',table:'PluginTasks',request_id:randomUUID(),payload:{title:'Bad target',entityType:'Deals',entityId:row.id,dueDate:'2026-10-01'}},foreign),{code:'NOT_FOUND'});
});
test('concurrent edits cannot overwrite each other, including frontend writes',async()=>{
  const row=await fixture('Deals',{address:'Concurrent fixture',renovationEstimate:100});
  const results=await Promise.allSettled([200,300].map(value=>run({action:'update',table:'Deals',id:row.id,expected_revision:0,payload:{renovationEstimate:value}})));
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
  assert.equal(results.find(r=>r.status==='rejected').reason.code,'CONFLICT');
  await pg.query('UPDATE "Deals" SET address=$1 WHERE id=$2',['Frontend edit',row.id]);
  await assert.rejects(run({action:'update',table:'Deals',id:row.id,expected_revision:1,payload:{renovationEstimate:400}}),{code:'CONFLICT'});
});
test('notes append without losing history and buy boxes merge',async()=>{
  const row=await fixture('Buyers',{name:'Buyer fixture',buyBox:{locations:'City: Atlanta',minPrice:200,maxPrice:500}});
  const updated=(await run({action:'update',table:'Buyers',id:row.id,expected_revision:0,payload:{buyBox:{maxPrice:600}}})).record;
  assert.equal(updated.buyBox.locations,'City: Atlanta');
  assert.equal(updated.buyBox.minPrice,200);
  await run({action:'append_note',table:'Buyers',id:row.id,expected_revision:1,note:'First note'});
  const last=(await run({action:'append_note',table:'Buyers',id:row.id,expected_revision:2,note:'Second note'})).record;
  assert.equal(last.notes.length,2);
  await assert.rejects(run({action:'update',table:'Buyers',id:row.id,expected_revision:3,payload:{buyBox:{maxPrice:50}}}));
});
test('creation request IDs prevent sequential duplicates and conflicting reuse',async()=>{
  const request={action:'create',table:'Deals',request_id:randomUUID(),payload:{address:'Idempotency fixture'}};
  await run(request);
  assert.equal((await run(request)).replayed,true);
  await assert.rejects(run({...request,payload:{address:'Different'}}),{code:'REQUEST_ID_REUSED'});
});
test('archive is reversible, excludes search, and prevents hidden edits',async()=>{
  const row=await fixture('Deals',{address:'Archive fixture'});
  await run({action:'archive',table:'Deals',id:row.id,expected_revision:0,reason:'Test'});
  assert.equal((await run({action:'read',table:'Deals',id:row.id})).records.length,0);
  await assert.rejects(run({action:'update',table:'Deals',id:row.id,expected_revision:1,payload:{address:'Bad edit'}}),{code:'ARCHIVED'});
  await run({action:'restore',table:'Deals',id:row.id,expected_revision:1});
  assert.equal((await run({action:'read',table:'Deals',id:row.id})).records.length,1);
});
test('pagination covers all pages, search text is literal, and unsupported writes fail',async()=>{
  for(let i=0;i<3;i++) await fixture('Deals',{address:`Paging_test_${i}`});
  const first=await run({action:'read',table:'Deals',query:'Paging_test_',limit:2});
  assert.equal(first.records.length,2); assert.equal(first.next_offset,2);
  const second=await run({action:'read',table:'Deals',query:'Paging_test_',limit:2,offset:2});
  assert.equal(second.records.length,1);assert.equal(second.next_offset,null);
  await assert.rejects(run({action:'read',table:'Users'}));
  await assert.rejects(run({action:'delete',table:'Deals',id:first.records[0].id}));
  await assert.rejects(run({action:'update',table:'Deals',id:first.records[0].id,expected_revision:0,payload:{organization_id:'escape'}}));
});
test('offer updates target Deals and maintain stage history',async()=>{
  const row=await fixture('Deals',{address:'Offer fixture'});
  const options={client:{operate:run},writes:true,archive:true};
  const result=await invoke('update_offer',{deal_id:row.id,expected_revision:0,fields:{offerPrice:875000,offerDecision:'Seller Counter-Offered'}},options);
  assert.equal(result.record.offerPrice,875000);
  assert.equal(result.record.offerDecisionTracking[0].status,'Seller Counter-Offered');
  assert.equal(result.record.status,'Analyzing');
});
test('write and archive gates enforced independently on both layers',async()=>{
  await assert.rejects(invoke('create_deal',{request_id:randomUUID(),fields:{address:'Blocked'}},{client:{operate:()=>assert.fail('Must not call backend')}}),{code:'WRITES_DISABLED'});
  await assert.rejects(executeOperation(db,{action:'create',table:'Deals',request_id:randomUUID(),payload:{address:'Blocked'}},{...config,writes:false}),{code:'WRITES_DISABLED'});
  const row=await fixture('Deals',{address:'Archive gate'});
  await assert.rejects(executeOperation(db,{action:'archive',table:'Deals',id:row.id,expected_revision:0,reason:'test'},{...config,archive:false}),{code:'ARCHIVE_DISABLED'});
});
test('backend HTTP authentication and real client round trip',async()=>{
  const key='test-plugin-key-'.repeat(4), app=express();app.use(express.json());
  app.post('/api/ai/plugin',makeHandler({createClient:()=>db,env:{DEALDESK_PLUGIN_API_KEY:key,DEALDESK_PLUGIN_ORGANIZATION_ID:config.organizationId,SUPABASE_SERVICE_ROLE_KEY:'test-only',VITE_SUPABASE_URL:'https://db.example',DEALDESK_PLUGIN_WRITES:'true'}}));
  const listener=app.listen(0,'127.0.0.1'); await once(listener,'listening');
  const url=`http://127.0.0.1:${listener.address().port}/api/ai/plugin`;
  try {
    assert.equal((await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).status,401);
    const client=new DealDeskClient({url,apiKey:key});
    const result=await client.operate({action:'read',table:'Deals',limit:2}); assert.equal(result.records.length,2);
    assert.ok(!JSON.stringify(result).includes('organization_id'));
    assert.ok(!JSON.stringify(result).includes('lockBoxCode'));
  } finally {await new Promise(resolve=>listener.close(resolve));}
});
test('MCP SDK initializes, lists all tools, calls read and rejects mass assignment',async()=>{
  const [a,b]=InMemoryTransport.createLinkedPair();
  const server=createServer({client:{operate:run},writes:true});
  const client=new Client({name:'test',version:'1.0.0'});
  await server.connect(a);await client.connect(b);
  try {
    const result=await client.listTools();assert.equal(result.tools.length,17);
    const read=await client.callTool({name:'search_deals',arguments:{limit:1}}); assert.equal(read.structuredContent.records.length,1);
    const bad=await client.callTool({name:'create_deal',arguments:{request_id:randomUUID(),fields:{address:'Bad',organization_id:'escape'}}});assert.equal(bad.isError,true);
    assert.ok(result.tools.filter(t=>t.name.startsWith('search_')).every(t=>t.annotations.readOnlyHint));
  } finally {await client.close();await server.close();}
});
test('HTTP MCP transport authenticates and rejects browser origins and hostile hosts',async()=>{
  const token='test-mcp-token-'.repeat(4);
  const app=createHttpApp({client:{operate:run}},{token});
  const listener=app.listen(0,'127.0.0.1');await once(listener,'listening');
  const url=new URL(`http://127.0.0.1:${listener.address().port}/mcp`);
  const client=new Client({name:'http-test',version:'1.0.0'});
  try {
    assert.equal((await fetch(url,{method:'POST'})).status,401);
    assert.equal((await fetch(url,{method:'POST',headers:{Authorization:`Bearer ${token}`,Origin:'https://bad.example'}})).status,403);
    const hostileStatus=await new Promise((resolve,reject)=>{const req=httpRequest(url,{method:'POST',headers:{Authorization:`Bearer ${token}`,Host:'bad.example'}},res=>{res.resume();resolve(res.statusCode);});req.on('error',reject);req.end();});
    assert.equal(hostileStatus,403);
    await client.connect(new StreamableHTTPClientTransport(url,{requestInit:{headers:{Authorization:`Bearer ${token}`}}}));
    assert.equal((await client.listTools()).tools.length,17);
    assert.equal((await client.callTool({name:'search_buyers',arguments:{limit:1}})).isError,undefined);
  } finally {await client.close();await new Promise(resolve=>listener.close(resolve));}
});
test('stdio child process exposes tools without writing logs to its protocol stream',async()=>{
  const client=new Client({name:'stdio-test',version:'1.0.0'});
  const transport=new StdioClientTransport({command:process.execPath,args:[fileURLToPath(new URL('../src/server.mjs',import.meta.url))],env:{DEALDESK_PLUGIN_API_KEY:'test-key-'.repeat(8),DEALDESK_PLUGIN_URL:'https://example.com/api/ai/plugin'},stderr:'pipe'});
  try {await client.connect(transport);assert.equal((await client.listTools()).tools.length,17);}
  finally {await client.close();}
});
test('task creation and retrieval use the real plugin task table',async()=>{
  const row=await fixture('Deals',{address:'Task target'});
  const result=await invoke('create_task',{request_id:randomUUID(),fields:{title:'Confirm demolition approval',entityType:'Deals',entityId:row.id,dueDate:'2026-10-01'}},{client:{operate:run},writes:true});
  assert.equal(result.record.status,'Open');
  const found=await invoke('search_tasks',{filters:{entityId:row.id}},{client:{operate:run}});
  assert.equal(found.records[0].title,'Confirm demolition approval');
});

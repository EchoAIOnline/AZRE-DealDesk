import { test,before,after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { database } from './database.mjs';
import { mutate,operationalTools } from '../src/operational.mjs';
import { validateZillowUrl,mapZillow,safeZillowData } from '../src/zillow.mjs';
import { createHostedServer,ORGANIZATION,RESOURCE } from '../backend/hosted.mjs';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
let pg,db,deal,task;
const identity={sub:randomUUID(),client_id:randomUUID(),session_id:randomUUID()};
before(async()=>{
 ({pg,db}=await database());
 await pg.exec('CREATE ROLE supabase_auth_admin;');
 for(const f of ['002-oauth.sql','003-operational.sql']) await pg.exec(await readFile(new URL('../backend/'+f,import.meta.url),'utf8'));
 await pg.query('INSERT INTO "PluginOAuthGrants" (client_id,user_id,organization_id,resource,operational_writes) VALUES ($1,$2,$3,$4,true)',[identity.client_id,identity.sub,ORGANIZATION,RESOURCE]);
});
after(async()=>{await pg.close();});
const run=(name,args,who=identity)=>mutate(db,name,args,who);
test('create deal defaults, idempotency, exact fields, address and MLS duplicate conflicts',async()=>{
 const request_id=randomUUID();
 const input={request_id,fields:{address:'999 Test Dr., Atlanta, GA 30307',mls:'TEST-123',listPrice:123000}};
 deal=(await run('create_deal',input)).record;
 assert.equal(deal.offerDecision,'No Offer Made Yet');assert.equal(deal._revision,0);
 assert.equal((await run('create_deal',input)).replayed,true);
 for(const fields of [{address:'999 Test Drive, Atlanta GA 30307'},{address:'888 Other Road',mls:'test-123'}]) await assert.rejects(run('create_deal',{fields}),e=>e.code==='DUPLICATE'&&e.details.existing_deals[0].deal_id===deal.id);
 await assert.rejects(run('create_deal',{...input,fields:{address:'changed'}}),e=>e.code==='REQUEST_ID_REUSED');
});
test('PATCH preserves unspecified fields and rejects stale revisions',async()=>{
 deal=(await run('update_deal',{deal_id:deal.id,expected_revision:0,fields:{offerPrice:100000,offerDecision:'Seller Counter-Offered'}})).record;
 assert.equal(deal._revision,1);assert.equal(deal.listPrice,123000);assert.equal(deal.offerDecisionTracking.length,1);
 await assert.rejects(run('update_deal',{deal_id:deal.id,expected_revision:0,fields:{listPrice:1}}),e=>e.code==='CONFLICT');
});
test('append note preserves logs with attribution and idempotency',async()=>{
 const request_id=randomUUID(); const input={deal_id:deal.id,body:'Test note',category:'Reconciliation',request_id};
 const a=await run('add_deal_note',input);assert.match(a.note,/ChatGPT/);assert.equal(a.record._revision,2);
 assert.equal((await run('add_deal_note',input)).replayed,true);
 const b=await run('add_deal_note',{deal_id:deal.id,body:'Second'});assert.equal(b.record.logs.length,2);assert.equal(b.record.logs[0],a.note);
});
test('tasks support datetime, priority, PATCH and completion with concurrency',async()=>{
 task=(await run('create_task',{fields:{title:'Test follow-up',entityType:'Deals',entityId:deal.id,dueDate:'2026-10-20T14:30:00-04:00',priority:'High'}})).record;
 assert.equal(task._revision,0);assert.equal(task.status,'Open');
 task=(await run('update_task',{task_id:task.id,expected_revision:0,fields:{status:'Completed'}})).record;
 assert.equal(task._revision,1);assert.equal(task.status,'Completed');assert.equal(task.priority,'High');
 await assert.rejects(run('update_task',{task_id:task.id,expected_revision:0,fields:{title:'stale'}}),e=>e.code==='CONFLICT');
});
test('organization isolation, unknown fields, invalid enums/numbers/dates and denied identities',async()=>{
 const other=randomUUID();await pg.query('INSERT INTO "Deals"(id,address,organization_id) VALUES($1,$2,$3)',[other,'Other org','other']);
 await assert.rejects(run('update_deal',{deal_id:other,expected_revision:0,fields:{offerPrice:1}}),e=>e.code==='NOT_FOUND');
 await assert.rejects(run('create_task',{fields:{title:'No',entityType:'Deals',entityId:other,dueDate:'2026-10-20'}}),e=>e.code==='NOT_FOUND');
 for(const fields of [{organization_id:'other'},{logs:[]},{offerPrice:-1},{offerDecision:'Fake'},{propertyType:'Fake'},{dealType:['Fake']},{agentEmail:'bad'},{nextFollowUpDate:'tomorrow'}]) await assert.rejects(run('update_deal',{deal_id:deal.id,expected_revision:3,fields}));
 for(const who of [{...identity,sub:randomUUID()},{...identity,client_id:randomUUID()},{...identity,session_id:null}]) await assert.rejects(run('create_deal',{fields:{address:'Unauthorized'}},who),e=>e.code==='WRITES_DISABLED');
});
test('audit is atomic, attributed and retains before/after values; ordinary roles cannot write',async()=>{
 const rows=(await pg.query('SELECT * FROM "PluginMutationAudit" ORDER BY id')).rows;
 assert.equal(rows.length,6);for(const row of rows){assert.equal(row.user_id,identity.sub);assert.equal(row.session_id,identity.session_id);assert.equal(row.organization_id,ORGANIZATION);}
 const patch=rows.find(r=>r.tool==='update_deal');assert.equal(patch.previous_values.listPrice,123000);assert.equal(patch.new_values.offerPrice,100000);assert.equal(patch.resulting_revision,1);
 await pg.exec('SET ROLE authenticated');await assert.rejects(pg.query('SELECT * FROM "PluginMutationAudit"'));await pg.exec('RESET ROLE');
 // Force audit failure: the business update must roll back with it.
 await pg.exec(`CREATE FUNCTION public.reject_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test failure'; END $$; CREATE TRIGGER reject_audit BEFORE INSERT ON "PluginMutationAudit" FOR EACH ROW EXECUTE FUNCTION public.reject_audit();`);
 await assert.rejects(run('update_task',{task_id:task.id,expected_revision:1,fields:{title:'Should roll back'}}));
 assert.equal((await pg.query('SELECT title FROM "PluginTasks" WHERE id=$1',[task.id])).rows[0].title,'Test follow-up');
 await pg.exec('DROP TRIGGER reject_audit ON "PluginMutationAudit";');
});
test('hosted transport exposes exactly the controlled tools and preserves all eight reads',async()=>{
 const server=createHostedServer(db,{identity,writes:true,zillow:async()=>[{address:'Zillow test',mappedComps:[{address:'Comp',price:1}]}]});
 const [a,b]=InMemoryTransport.createLinkedPair();await server.connect(a);const client=new Client({name:'test',version:'1'});await client.connect(b);
 const listed=await client.listTools();assert.equal(listed.tools.length,16);
 for(const name of ['delete_deal','archive_record','restore_record','create_buyer','update_offer']) assert.equal((await client.callTool({name,arguments:{}})).isError,true);
 for(const [table,name] of [['Buyers','buyer'],['Agents','agent']]) await pg.query(`INSERT INTO "${table}"(id,name,organization_id) VALUES($1,$2,$3)`,[randomUUID(),name,ORGANIZATION]);
 for(const name of ['search_deals','search_buyers','search_agents','search_tasks']) assert.ok((await client.callTool({name,arguments:{limit:1}})).structuredContent.records.length);
 for(const [name,table] of [['buyer','Buyers'],['agent','Agents']]) {const id=(await pg.query(`SELECT id FROM "${table}" LIMIT 1`)).rows[0].id;assert.ok((await client.callTool({name:'get_'+name,arguments:{[name+'_id']:id}})).structuredContent.record);}
 for(const name of ['get_deal','match_buyers']) assert.ok(!(await client.callTool({name,arguments:{deal_id:deal.id}})).isError);
 const before=(await pg.query('SELECT count(*)::int n FROM "PluginMutationAudit"')).rows[0].n;
 for(const name of ['import_from_zillow','pull_zillow_comps']) assert.equal((await client.callTool({name,arguments:{url:'https://www.zillow.com/homedetails/123_zpid/'}})).structuredContent.saved,false);
 assert.equal((await pg.query('SELECT count(*)::int n FROM "PluginMutationAudit"')).rows[0].n,before);
 await client.close();await server.close();
});
test('Zillow blocks arbitrary hosts, redirects in input, malformed URLs; safe mapping preserves fractions',()=>{
 for(const url of ['http://www.zillow.com/homedetails/1_zpid/','https://zillow.com.evil.test/homedetails/1_zpid/','https://user@zillow.com/homedetails/1_zpid/','https://zillow.com/search/','https://127.0.0.1/','garbage']) assert.throws(()=>validateZillowUrl(url));
 assert.equal(validateZillowUrl('https://zillow.com/homedetails/test/123_zpid/?redirect=https://evil.test'),'https://www.zillow.com/homedetails/123_zpid/');
 assert.equal(mapZillow({address:'test',bathrooms:2.5,price:'$100,000'}).bathrooms,2.5);
 assert.deepEqual(safeZillowData([{address:'test',collector_id:'private',api_key:'secret'}]),[{address:'test'}]);
});

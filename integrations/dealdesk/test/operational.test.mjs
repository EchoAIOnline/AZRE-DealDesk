import { test,before,after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { database, attachTestAuthAdmin } from './database.mjs';
import { mutate,operationalTools } from '../src/operational.mjs';
import { validateZillowUrl,mapZillow,safeZillowData } from '../src/zillow.mjs';
import { createHostedServer,ORGANIZATION,RESOURCE } from '../backend/hosted.mjs';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
let pg,db,deal,task;
const identity={sub:randomUUID(),client_id:randomUUID(),session_id:randomUUID()};
before(async()=>{
 ({pg,db}=await database());
 attachTestAuthAdmin(db);
 await pg.exec('CREATE ROLE supabase_auth_admin;');
 for(const f of ['002-oauth.sql','003-operational.sql','007-hosted-expansion.sql','008-full-user-capabilities.sql','009-users-activity-dashboard.sql']) await pg.exec(await readFile(new URL('../backend/'+f,import.meta.url),'utf8'));
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
test('create_buyer defaults, idempotency, duplicates, partial buyBox merge, and revision conflicts',async()=>{
 const request_id=randomUUID();
 const input={request_id,fields:{name:'Peach Capital LLC',email:'Acquisitions@PeachCap.com',phone:'(404) 555-0199',buyBox:{locations:'Atlanta, Decatur',minPrice:200000,maxPrice:600000,propertyTypes:['Renovation']}}};
 let buyer=(await run('create_buyer',input)).record;
 assert.equal(buyer.status,'New Lead');
 assert.equal(buyer.subscriptionStatus,'Subscribed');
 assert.equal(buyer.propertiesBought,0);
 assert.deepEqual(buyer.notes,[]);
 assert.equal(buyer._revision,0);
 assert.equal((await run('create_buyer',input)).replayed,true);
 await assert.rejects(run('create_buyer',{...input,fields:{name:'Changed'}}),e=>e.code==='REQUEST_ID_REUSED');
 await assert.rejects(run('create_buyer',{fields:{name:'Dup Email',email:'acquisitions@peachcap.com'}}),e=>e.code==='DUPLICATE'&&e.details.existing_buyers[0].buyer_id===buyer.id);
 await assert.rejects(run('create_buyer',{fields:{name:'Dup Phone',phone:'404-555-0199'}}),e=>e.code==='DUPLICATE'&&e.details.existing_buyers[0].buyer_id===buyer.id);
 const noEmailReq=randomUUID();
 const solo=(await run('create_buyer',{request_id:noEmailReq,fields:{name:'Solo Name Buyer'}})).record;
 await assert.rejects(run('create_buyer',{fields:{name:' solo name buyer '}}),e=>e.code==='DUPLICATE'&&e.details.existing_buyers[0].buyer_id===solo.id);
 buyer=(await run('update_buyer',{buyer_id:buyer.id,expected_revision:0,fields:{status:'Vetted Buyer',buyBox:{maxPrice:750000,minBedrooms:3}}})).record;
 assert.equal(buyer._revision,1);
 assert.equal(buyer.status,'Vetted Buyer');
 assert.equal(buyer.buyBox.locations,'Atlanta, Decatur');
 assert.equal(buyer.buyBox.minPrice,200000);
 assert.equal(buyer.buyBox.maxPrice,750000);
 assert.equal(buyer.buyBox.minBedrooms,3);
 assert.deepEqual(buyer.buyBox.propertyTypes,['Renovation']);
 await assert.rejects(run('update_buyer',{buyer_id:buyer.id,expected_revision:0,fields:{companyName:'Stale Co'}}),e=>e.code==='CONFLICT');
 await assert.rejects(run('update_buyer',{buyer_id:buyer.id,expected_revision:1,fields:{buyBox:{maxPrice:100000}}}),e=>e.code==='INVALID_REQUEST');
 for(const fields of [{organization_id:'other'},{notes:[]},{status:'Fake'},{email:'bad'},{buyBox:{minPrice:-1}},{nextFollowUpDate:'tomorrow'}]) await assert.rejects(run('update_buyer',{buyer_id:buyer.id,expected_revision:1,fields}));
 await assert.rejects(run('update_buyer',{buyer_id:solo.id,expected_revision:0,fields:{email:'acquisitions@peachcap.com'}}),e=>e.code==='DUPLICATE');
 const otherBuyer=randomUUID();
 await pg.query('INSERT INTO "Buyers"(id,name,email,organization_id) VALUES($1,$2,$3,$4)',[otherBuyer,'Other Org Buyer','other@other.org','other']);
 await assert.rejects(run('update_buyer',{buyer_id:otherBuyer,expected_revision:0,fields:{status:'VIP Buyer'}}),e=>e.code==='NOT_FOUND');
 const archivedBuyer=randomUUID();
 await pg.query('INSERT INTO "Buyers"(id,name,organization_id,"pluginArchivedAt") VALUES($1,$2,$3,$4)',[archivedBuyer,'Archived Buyer',ORGANIZATION,'2026-01-01T00:00:00Z']);
 await assert.rejects(run('update_buyer',{buyer_id:archivedBuyer,expected_revision:0,fields:{status:'VIP Buyer'}}),e=>e.code==='ARCHIVED');
});
test('add_buyer_note and add_agent_note preserve existing notes, attribute ChatGPT, enforce idempotency and tenant bounds',async()=>{
 const buyerId=randomUUID();
 const agentId=randomUUID();
 await pg.query('INSERT INTO "Buyers"(id,name,notes,organization_id) VALUES($1,$2,$3,$4)',[buyerId,'History Buyer',JSON.stringify(['2026-01-01 - User: Legacy buyer note']),ORGANIZATION]);
 await pg.query('INSERT INTO "Agents"(id,name,notes,organization_id) VALUES($1,$2,$3,$4)',[agentId,'History Agent',JSON.stringify(['2026-01-02 - User: Legacy agent note']),ORGANIZATION]);
 const bReq=randomUUID();
 const bInput={buyer_id:buyerId,body:'Confirmed proof of funds',category:'Verification',request_id:bReq};
 const bNote1=await run('add_buyer_note',bInput);
 assert.match(bNote1.note,/ChatGPT \/ DealDesk Hosted \| \[Verification\] Confirmed proof of funds/);
 assert.equal(bNote1.record.notes.length,2);
 assert.equal(bNote1.record.notes[0],'2026-01-01 - User: Legacy buyer note');
 assert.equal(bNote1.record.notes[1],bNote1.note);
 assert.equal((await run('add_buyer_note',bInput)).replayed,true);
 await assert.rejects(run('add_buyer_note',{buyer_id:randomUUID(),body:'Different target',request_id:bReq}),e=>e.code==='REQUEST_ID_REUSED');
 const bNote2=await run('add_buyer_note',{buyer_id:buyerId,body:'Prefers Fulton County'});
 assert.equal(bNote2.record.notes.length,3);
 assert.equal(bNote2.record.notes[1],bNote1.note);
 const aReq=randomUUID();
 const aNote=await run('add_agent_note',{agent_id:agentId,body:'Agent confirmed seller flexibility',category:'Follow-up',request_id:aReq});
 assert.match(aNote.note,/ChatGPT \/ DealDesk Hosted \| \[Follow-up\] Agent confirmed seller flexibility/);
 assert.equal(aNote.record.notes.length,2);
 assert.equal(aNote.record.notes[0],'2026-01-02 - User: Legacy agent note');
 assert.equal(aNote.record.notes[1],aNote.note);
 assert.equal((await run('add_agent_note',{agent_id:agentId,body:'Agent confirmed seller flexibility',category:'Follow-up',request_id:aReq})).replayed,true);
 const otherAgent=randomUUID();
 await pg.query('INSERT INTO "Agents"(id,name,organization_id) VALUES($1,$2,$3)',[otherAgent,'Other Org Agent','other']);
 await assert.rejects(run('add_agent_note',{agent_id:otherAgent,body:'Should fail'}),e=>e.code==='NOT_FOUND');
 await assert.rejects(run('add_buyer_note',{buyer_id:buyerId,body:'Denied'},{...identity,sub:randomUUID()}),e=>e.code==='WRITES_DISABLED');
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
 assert.equal(rows.length,12);for(const row of rows){assert.equal(row.user_id,identity.sub);assert.equal(row.session_id,identity.session_id);assert.equal(row.organization_id,ORGANIZATION);}
 const patch=rows.find(r=>r.tool==='update_deal');assert.equal(patch.previous_values.listPrice,123000);assert.equal(patch.new_values.offerPrice,100000);assert.equal(patch.resulting_revision,1);
 const buyerAudit=rows.find(r=>r.tool==='update_buyer');assert.equal(buyerAudit.entity_type,'Buyers');assert.equal(buyerAudit.new_values.status,'Vetted Buyer');
 const agentAudit=rows.find(r=>r.tool==='add_agent_note');assert.equal(agentAudit.entity_type,'Agents');assert.ok(agentAudit.changed_fields.includes('notes'));
 await pg.exec('SET ROLE authenticated');await assert.rejects(pg.query('SELECT * FROM "PluginMutationAudit"'));await pg.exec('RESET ROLE');
 // Force audit failure: the business update must roll back with it.
 await pg.exec(`CREATE FUNCTION public.reject_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test failure'; END $$; CREATE TRIGGER reject_audit BEFORE INSERT ON "PluginMutationAudit" FOR EACH ROW EXECUTE FUNCTION public.reject_audit();`);
 await assert.rejects(run('update_task',{task_id:task.id,expected_revision:1,fields:{title:'Should roll back'}}));
 assert.equal((await pg.query('SELECT title FROM "PluginTasks" WHERE id=$1',[task.id])).rows[0].title,'Test follow-up');
 await pg.exec('DROP TRIGGER reject_audit ON "PluginMutationAudit";');
});
test('hosted transport exposes all 63 user-capability tools across all tables, dashboard, activity feed, and user creation',async()=>{
 await pg.query('INSERT INTO "OffMarketProperties"(id,"Address","City","State","Zip","Interested","Trash",organization_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[501,'501 Scouter Way','Decatur','GA','30030',true,false,ORGANIZATION]);
 const server=createHostedServer(db,{
   identity,
   writes:true,
   zillow:async()=>[{address:'Zillow test',mappedComps:[{address:'Comp',price:1}]}],
   sendEmail:async input=>({status:'success',results:input.recipients.map(r=>({email:r.email,status:'success',messageId:'ses-123'}))}),
   geminiComps:async input=>([{address:input.address+' Comp 1',sqft:1800,saleDate:'05/10/2026',salePrice:410000}]),
   geminiChat:async input=>`Answer: ${input.message}`,
 });
 const [a,b]=InMemoryTransport.createLinkedPair();await server.connect(a);const client=new Client({name:'test',version:'1'});await client.connect(b);
 const listed=await client.listTools();assert.equal(listed.tools.length,63);
 for(const [table,name] of [['Buyers','buyer'],['Agents','agent']]) await pg.query(`INSERT INTO "${table}"(id,name,organization_id) VALUES($1,$2,$3)`,[randomUUID(),name,ORGANIZATION]);
 for(const name of ['search_deals','search_buyers','search_agents','search_tasks','search_off_market_properties']) assert.ok((await client.callTool({name,arguments:{limit:1}})).structuredContent.records.length);
 for(const [name,table] of [['buyer','Buyers'],['agent','Agents']]) {const rid=(await pg.query(`SELECT id FROM "${table}" LIMIT 1`)).rows[0].id;assert.ok((await client.callTool({name:'get_'+name,arguments:{[name+'_id']:rid}})).structuredContent.record);}
 assert.equal((await client.callTool({name:'get_off_market_property',arguments:{property_id:501}})).structuredContent.record.Address,'501 Scouter Way');

 // Deal full fields + update_offer + archive/restore + move_deal + delete_deal
 const fullDeal=(await client.callTool({name:'create_deal',arguments:{fields:{address:'400 Full User Rd',lockBoxCode:'9988',ownerLLCName:'Test Holdings LLC',dispo:{photos:true,blast:false}}}})).structuredContent.record;
 assert.equal(fullDeal.lockBoxCode,'9988');
 const offered=(await client.callTool({name:'update_offer',arguments:{deal_id:fullDeal.id,expected_revision:fullDeal._revision,fields:{offerPrice:550000,offerDecision:'Seller Counter-Offered'}}})).structuredContent.record;
 assert.equal(offered.offerPrice,550000);
 const archived=(await client.callTool({name:'archive_record',arguments:{record_type:'Deals',record_id:offered.id,reason:'Testing archive',expected_revision:offered._revision}})).structuredContent.record;
 assert.ok(archived.pluginArchivedAt);
 const restored=(await client.callTool({name:'restore_record',arguments:{record_type:'Deals',record_id:archived.id,expected_revision:archived._revision}})).structuredContent.record;
 assert.equal(restored.pluginArchivedAt,null);
 const movedJv=(await client.callTool({name:'move_deal',arguments:{deal_id:restored.id,target_pipeline:'dfd',expected_revision:restored._revision}})).structuredContent;
 assert.equal(movedJv.moved_to,'JVDeals');
 assert.equal((await client.callTool({name:'search_jv_deals',arguments:{query:'400 Full User Rd'}})).structuredContent.records.length,1);
 const deletedJv=(await client.callTool({name:'delete_jv_deal',arguments:{deal_id:movedJv.record.id}})).structuredContent;
 assert.equal(deletedJv.deleted,true);

 // Buyers + Agents + Wholesalers + move_contact
 const createdBuyer=(await client.callTool({name:'create_buyer',arguments:{fields:{name:'MCP Tool Buyer',email:'mcp@buyer.test'}}})).structuredContent.record;
 assert.equal(createdBuyer.status,'New Lead');
 const notedBuyer=(await client.callTool({name:'add_buyer_note',arguments:{buyer_id:createdBuyer.id,body:'MCP buyer note'}})).structuredContent;
 assert.equal(notedBuyer.record.notes.length,1);
 const createdAgent=(await client.callTool({name:'create_agent',arguments:{fields:{name:'Alex Agent',email:'alex@agent.test',investorFriendly:true}}})).structuredContent.record;
 assert.equal(createdAgent.agentFirstName,'Alex');
 const mcpAgentId=(await pg.query(`SELECT id FROM "Agents" WHERE name='agent'`)).rows[0].id;
 const notedAgent=(await client.callTool({name:'add_agent_note',arguments:{agent_id:mcpAgentId,body:'MCP agent note'}})).structuredContent;
 assert.equal(notedAgent.record.notes.length,1);
 const movedWholesaler=(await client.callTool({name:'move_contact',arguments:{contact_id:createdAgent.id,source_table:'Agents',target_table:'Wholesalers',expected_revision:createdAgent._revision}})).structuredContent;
 assert.equal(movedWholesaler.moved_to,'Wholesalers');
 assert.equal((await client.callTool({name:'get_wholesaler',arguments:{wholesaler_id:movedWholesaler.record.id}})).structuredContent.record.name,'Alex Agent');
 const deletedWs=(await client.callTool({name:'delete_wholesaler',arguments:{wholesaler_id:movedWholesaler.record.id}})).structuredContent;
 assert.equal(deletedWs.deleted,true);

 // Off-Market Scouter CRUD + templates
 const omCreated=(await client.callTool({name:'create_off_market_property',arguments:{fields:{Address:'502 Scouter Ln',City:'Atlanta',State:'GA'}}})).structuredContent.record;
 const omUpdated=(await client.callTool({name:'update_off_market_property',arguments:{property_id:omCreated.id,expected_revision:omCreated._revision,fields:{Interested:true,'My Estimated Offer':250000}}})).structuredContent.record;
 assert.equal(omUpdated.Interested,true);
 assert.equal(omUpdated['My Estimated Offer'],250000);
 await client.callTool({name:'update_off_market_templates',arguments:{fields:{'Text Message Template 1':'Hi owner at [Address]'}}});
 const tplRead=(await client.callTool({name:'get_off_market_templates',arguments:{}})).structuredContent.templates;
 assert.equal(tplRead['Text Message Template 1'],'Hi owner at [Address]');
 assert.equal((await client.callTool({name:'delete_off_market_property',arguments:{property_id:omCreated.id}})).structuredContent.deleted,true);

 // Workspace CRM CRUD & secret masking on Integrations
 const contact=(await client.callTool({name:'create_workspace_record',arguments:{table:'Contacts',fields:{name:'Lender Bob',email:'bob@lender.test'}}})).structuredContent.record;
 assert.equal(contact.name,'Lender Bob');
 assert.equal((await client.callTool({name:'search_workspace_records',arguments:{table:'Contacts',query:'Lender Bob'}})).structuredContent.records.length,1);
 const integ=(await client.callTool({name:'create_workspace_record',arguments:{table:'Integrations',fields:{organization:'AZRE',twilioPhoneNumber:'+14045550111'}}})).structuredContent.record;
 await pg.query('UPDATE "Integrations" SET "twilioAuthToken"=$1 WHERE id=$2',['top-secret',integ.id]);
 const integRead=(await client.callTool({name:'get_workspace_record',arguments:{table:'Integrations',record_id:integ.id}})).structuredContent.record;
 assert.equal(integRead.twilioPhoneNumber,'+14045550111');
 assert.equal(integRead.twilioAuthToken,undefined);
 assert.equal((await client.callTool({name:'delete_workspace_record',arguments:{table:'Contacts',record_id:contact.id}})).structuredContent.deleted,true);

 // Email + Gemini services
 const emailOut=(await client.callTool({name:'send_email',arguments:{recipients:[{email:'buyer@example.com'}],subject:'New Deal',body:'<p>Deal</p>'}})).structuredContent;
 assert.equal(emailOut.status,'success');
 assert.equal((await client.callTool({name:'generate_ai_comps',arguments:{address:'400 Full User Rd'}})).structuredContent.comps.length,1);
 assert.match((await client.callTool({name:'ai_search_chat',arguments:{message:'ATL median price?'}})).structuredContent.reply,/ATL median price/);

 // User account creation (creates Auth user + Users profile + optional MCP grant; never returns/audits password)
 const userReqId=randomUUID();
 const createdUser=(await client.callTool({name:'create_user',arguments:{request_id:userReqId,name:'API Operator',email:'Operator@AzreTest.com',password:'Str0ngPass!123',position:'Acquisitions',grant_mcp_access:true,mcp_operational_writes:true}})).structuredContent;
 assert.equal(createdUser.user.email,'operator@azretest.com');
 assert.equal(createdUser.user.position,'Acquisitions');
 assert.equal(createdUser.mcp_grant.enabled,true);
 assert.equal(createdUser.mcp_grant.operational_writes,true);
 assert.ok(!JSON.stringify(createdUser).includes('Str0ngPass!123'));
 assert.equal((await client.callTool({name:'create_user',arguments:{request_id:userReqId,name:'API Operator',email:'Operator@AzreTest.com',password:'Str0ngPass!123',position:'Acquisitions',grant_mcp_access:true,mcp_operational_writes:true}})).structuredContent.replayed,true);
 assert.equal((await client.callTool({name:'create_user',arguments:{name:'Dup',email:'operator@azretest.com',password:'AnotherPass!123'}})).isError,true);
 const userAuditRows=(await pg.query(`SELECT * FROM "PluginMutationAudit" WHERE tool='create_user'`)).rows;
 assert.equal(userAuditRows.length,1);
 assert.ok(!JSON.stringify(userAuditRows).includes('Str0ngPass!123'));

 // Activity feed (log_activity grouping + get_activity_feed) & Dashboard (get_dashboard)
 const act1=(await client.callTool({name:'log_activity',arguments:{action_type:'UPDATE',entity_type:'DEAL',entity_id:deal.id,entity_display:'999 Test Dr',description:'Updated offerPrice',metadata:{offerPrice:100000}}})).structuredContent;
 assert.equal(act1.grouped,false);
 const act2=(await client.callTool({name:'log_activity',arguments:{action_type:'UPDATE',entity_type:'DEAL',entity_id:deal.id,entity_display:'999 Test Dr',description:'Updated status',metadata:{status:'Analyzing'}}})).structuredContent;
 assert.equal(act2.grouped,true);
 assert.equal(act2.activity.metadata.offerPrice,100000);
 assert.equal(act2.activity.metadata.status,'Analyzing');
 await client.callTool({name:'log_activity',arguments:{action_type:'LOI_SENT',entity_type:'DEAL',entity_id:deal.id,entity_display:'999 Test Dr',description:'Sent LOI'}});
 const feedAll=(await client.callTool({name:'get_activity_feed',arguments:{limit:10}})).structuredContent;
 assert.equal(feedAll.activities.length,2);
 assert.equal(feedAll.activities[0].action_type,'LOI_SENT');
 const dash=(await client.callTool({name:'get_dashboard',arguments:{timeframe:'week'}})).structuredContent;
 assert.ok(dash.kpis.totalDeals>=1);
 assert.ok(dash.recentActivity.length>=2);
 assert.ok(dash.usersSummary.users.some(u=>u.name==='API Operator'));
 assert.ok(!JSON.stringify(dash).includes('Str0ngPass!123'));

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

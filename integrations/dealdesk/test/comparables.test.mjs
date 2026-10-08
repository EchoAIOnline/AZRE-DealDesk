import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { database } from './database.mjs';
import { mutate } from '../src/operational.mjs';
import { comparableFields } from '../src/domain.mjs';
import { createHostedServer, ORGANIZATION, RESOURCE } from '../backend/hosted.mjs';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
const keys=Object.keys(comparableFields);
const comp=n=>({address:`DISPOSABLE COMP ${n}`,saleDate:'10/01/2026',salePrice:1000000+n,sqft:3000.5,softenerPercent:5.5});
test('migration fails closed against historical column names without modifying records',async()=>{
 const {pg}=await database();
 try {
  await pg.exec('CREATE ROLE supabase_auth_admin;');
  for(const f of ['002-oauth.sql','003-operational.sql']) await pg.exec(await readFile(new URL('../backend/'+f,import.meta.url),'utf8'));
  await assert.rejects(pg.exec(await readFile(new URL('../backend/005-comparables.sql',import.meta.url),'utf8')),/Expected existing Deals JSONB column/);
  await pg.exec('ROLLBACK');
  assert.equal((await pg.query('SELECT count(*)::int n FROM "Deals"')).rows[0].n,0);
 } finally {await pg.close();}
});
test('hosted comp schemas, create/read persistence, all-slot updates, partial updates, empty slots, conflicts and invalid inputs',async()=>{
 const {pg,db}=await database(); let client,server;
 try {
  await pg.exec('CREATE ROLE supabase_auth_admin;');
  // Fixture models the current frontend columns; historical schema stays intact.
  for(const k of keys.filter(k=>k.startsWith('renovation'))) await pg.exec(`ALTER TABLE "Deals" ADD COLUMN "${k}" jsonb`);
  for(const f of ['002-oauth.sql','003-operational.sql','005-comparables.sql']) await pg.exec(await readFile(new URL('../backend/'+f,import.meta.url),'utf8'));
  const identity={sub:randomUUID(),client_id:randomUUID(),session_id:randomUUID()};
  await pg.query('INSERT INTO "PluginOAuthGrants"(user_id,client_id,organization_id,resource,operational_writes) VALUES($1,$2,$3,$4,true)',[identity.sub,identity.client_id,ORGANIZATION,RESOURCE]);
  server=createHostedServer(db,{identity,writes:true});const [a,b]=InMemoryTransport.createLinkedPair();await server.connect(a);
  client=new Client({name:'disposable-comps-test',version:'1'});await client.connect(b);
  const call=async(name,args)=>client.callTool({name,arguments:args});
  const list=await client.listTools();
  for(const name of ['create_deal','update_deal']) for(const k of keys) assert.ok(list.tools.find(t=>t.name===name).inputSchema.properties.fields.properties[k]);
  const request_id=randomUUID();
  const initial=Object.fromEntries(keys.map((k,n)=>[k,comp(n)]));
  const created=await call('create_deal',{request_id,fields:{address:`999999 DISPOSABLE COMPS TEST ${request_id}`,listPrice:25,...initial}});
  assert.equal(created.isError,undefined);assert.equal(created.structuredContent.record._revision,0);
  const get=async()=> (await call('get_deal',{deal_id:request_id})).structuredContent.record;
  for(const k of keys) assert.deepEqual((await get())[k],initial[k]);
  const all=Object.fromEntries(keys.map((k,n)=>[k,comp(n+10)]));
  assert.equal((await call('update_deal',{deal_id:request_id,expected_revision:0,fields:all})).structuredContent.record._revision,1);
  const blank={address:'',saleDate:'',salePrice:0};
  assert.equal((await call('update_deal',{deal_id:request_id,expected_revision:1,fields:{renovationComparable1:blank,newConstructionComparable3:null}})).structuredContent.record._revision,2);
  const saved=await get();assert.deepEqual(saved.renovationComparable1,blank);assert.equal(saved.newConstructionComparable3,null);assert.equal(saved.listPrice,25);
  for(const k of keys.filter(k=>!['renovationComparable1','newConstructionComparable3'].includes(k))) assert.deepEqual(saved[k],all[k]);
  const stale=await call('update_deal',{deal_id:request_id,expected_revision:1,fields:{renovationComparable2:comp(99)}});
  assert.match(stale.content[0].text,/CONFLICT/);assert.deepEqual(await get(),saved);
  for(const k of keys) for(const value of ['bad',[],{address:'x'}, {...comp(1),salePrice:-1},{...comp(1),sqft:'3000'},{...comp(1),softenerPercent:101},{...comp(1),unknown:'x'}]) {
   for(const name of ['create_deal','update_deal']) {
    const args=name==='create_deal'?{fields:{address:'999999 DISPOSABLE INVALID', [k]:value}}:{deal_id:request_id,expected_revision:2,fields:{[k]:value}};
    assert.match((await call(name,args)).content[0].text,/INVALID_REQUEST/);
   }
  }
  assert.deepEqual(await get(),saved);
  const sparseId=randomUUID();assert.equal((await call('create_deal',{request_id:sparseId,fields:{address:`999998 DISPOSABLE SPARSE ${sparseId}`,newConstructionComparable1:comp(1)}})).isError,undefined);
  const sparse=(await call('get_deal',{deal_id:sparseId})).structuredContent.record;
  for(const k of keys.filter(k=>k!=='newConstructionComparable1')) assert.equal(sparse[k],null);
  await assert.rejects(mutate(db,'update_deal',{deal_id:request_id,expected_revision:2,fields:{renovationComparable2:comp(99)}},{...identity,sub:randomUUID()}),e=>e.code==='WRITES_DISABLED');
  const other=randomUUID();await pg.query('INSERT INTO "Deals"(id,address,organization_id) VALUES($1,$2,$3)',[other,'DISPOSABLE OTHER ORG','other']);
  assert.match((await call('update_deal',{deal_id:other,expected_revision:0,fields:{renovationComparable2:comp(99)}})).content[0].text,/NOT_FOUND/);
  assert.deepEqual(await get(),saved);
 } finally {if(client)await client.close();if(server)await server.close();await pg.close();}
});

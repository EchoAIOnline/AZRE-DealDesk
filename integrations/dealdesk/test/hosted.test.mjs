import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { generateKeyPair, SignJWT, createLocalJWKSet, exportJWK } from 'jose';
import express from 'express';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { database } from './database.mjs';
import { makeHostedHandler, verifyIdentity, RESOURCE, ISSUER, ORGANIZATION } from '../backend/hosted.mjs';

let pg, db, keys, keySet, http, base;
const user = randomUUID(), clientId = randomUUID();
const claims = { role:'dealdesk_mcp', client_id:clientId, dealdesk_organization:ORGANIZATION, dealdesk_permission:'read', scope:'openid' };
async function token(overrides = {}, { audience = RESOURCE, issuer = ISSUER, expiry = '5m' } = {}) {
  return new SignJWT({...claims,...overrides}).setProtectedHeader({alg:'ES256',kid:'test'}).setSubject(user).setIssuer(issuer).setAudience(audience).setIssuedAt().setExpirationTime(expiry).sign(keys.privateKey);
}
before(async () => {
  ({pg,db} = await database());
  await pg.exec('CREATE ROLE supabase_auth_admin;');
  const sql = await readFile(new URL('../backend/002-oauth.sql',import.meta.url),'utf8');
  await pg.exec(sql); await pg.exec(sql);
  await pg.exec(await readFile(new URL('../backend/003-operational.sql',import.meta.url),'utf8'));
  await pg.exec(await readFile(new URL('../backend/003-operational.sql',import.meta.url),'utf8'));
  await pg.exec(await readFile(new URL('../backend/007-hosted-expansion.sql',import.meta.url),'utf8'));
  await pg.exec(await readFile(new URL('../backend/007-hosted-expansion.sql',import.meta.url),'utf8'));
  await pg.exec(await readFile(new URL('../backend/008-full-user-capabilities.sql',import.meta.url),'utf8'));
  await pg.exec(await readFile(new URL('../backend/008-full-user-capabilities.sql',import.meta.url),'utf8'));
  await pg.exec(await readFile(new URL('../backend/009-users-activity-dashboard.sql',import.meta.url),'utf8'));
  await pg.exec(await readFile(new URL('../backend/009-users-activity-dashboard.sql',import.meta.url),'utf8'));
  await pg.query('INSERT INTO "PluginOAuthGrants" (client_id,user_id,organization_id,resource,enabled) VALUES ($1,$2,$3,$4,true)',[clientId,user,ORGANIZATION,RESOURCE]);
  await pg.query('INSERT INTO "Deals" (id,address,organization_id) VALUES ($1,$2,$3),($4,$5,$6)',[randomUUID(),'AZRE fixture',ORGANIZATION,randomUUID(),'Other org private address','other']);
  await pg.query('INSERT INTO "OffMarketProperties" (id,"Address","City","State","Interested","Trash",organization_id,"pluginArchivedAt") VALUES ($1,$2,$3,$4,$5,$6,$7,$8),($9,$10,$11,$12,$13,$14,$15,$16),($17,$18,$19,$20,$21,$22,$23,$24),($25,$26,$27,$28,$29,$30,$31,$32),($33,$34,$35,$36,$37,$38,$39,$40)',[
    101,'101 Peachtree St','Atlanta','GA',true,false,ORGANIZATION,null,
    102,'102 Oak Ave','Marietta','GA',false,false,ORGANIZATION,null,
    103,'103 Archived Rd','Atlanta','GA',true,false,ORGANIZATION,'2026-01-01T00:00:00Z',
    104,'104 Private Blvd','Atlanta','GA',true,false,'other',null,
    105,'105 UI Imported Rd','Roswell','GA',true,false,null,null,
  ]);
  keys = await generateKeyPair('ES256');
  keySet = createLocalJWKSet({keys:[{...await exportJWK(keys.publicKey),kid:'test'}]});
  const app = express(); app.use(express.json());
  app.all('/api/mcp',makeHostedHandler({createClient:()=>db,env:{DEALDESK_PLUGIN_ORGANIZATION_ID:ORGANIZATION,SUPABASE_SERVICE_ROLE_KEY:'test',VITE_SUPABASE_URL:ISSUER.replace('/auth/v1','')},verify:(value,options)=>verifyIdentity(value,{...options,keySet})}));
  http = app.listen(0,'127.0.0.1'); await new Promise(resolve=>http.once('listening',resolve));
  base = `http://127.0.0.1:${http.address().port}/api/mcp`;
});
after(async()=>{http?.closeAllConnections(); await new Promise(resolve=>http.close(resolve)); await pg.close();});

test('JWT verification rejects wrong audience/issuer, expiry, privilege and organization',async()=>{
  await verifyIdentity(await token(),{keySet});
  for(const options of [{audience:'authenticated'},{issuer:'https://attacker.invalid'},{expiry:'-1s'}]) await assert.rejects(verifyIdentity(await token({},options),{keySet}));
  for(const change of [{role:'authenticated'},{client_id:null},{dealdesk_organization:'other'},{dealdesk_permission:'write'},{scope:''}]) await assert.rejects(verifyIdentity(await token(change),{keySet}));
  const foreign = await generateKeyPair('ES256');
  const forged = await new SignJWT(claims).setProtectedHeader({alg:'ES256',kid:'test'}).setSubject(user).setIssuer(ISSUER).setAudience(RESOURCE).setExpirationTime('5m').setIssuedAt().sign(foreign.privateKey);
  await assert.rejects(verifyIdentity(forged,{keySet}));
});
test('unauthenticated requests receive discoverable OAuth challenge; browser origins rejected',async()=>{
  const response = await fetch(base,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
  assert.equal(response.status,401); assert.match(response.headers.get('www-authenticate'),/oauth-protected-resource/);
  const metadata = await (await fetch(base+'?view=metadata')).json(); assert.equal(metadata.resource,RESOURCE);
  assert.equal((await fetch(base,{method:'POST',headers:{origin:'https://attacker.invalid'}})).status,403);
});
test('hosted MCP discovers only read tools, reads one organization and rejects all mutations',async()=>{
  const client = new Client({name:'hosted-test',version:'1'});
  await client.connect(new StreamableHTTPClientTransport(new URL(base),{requestInit:{headers:{Authorization:`Bearer ${await token()}`}}}));
  try {
    const listed = await client.listTools(); assert.equal(listed.tools.length,23);
    assert.ok(listed.tools.every(tool=>tool._meta.securitySchemes[0].type==='oauth2'));
    assert.equal(listed.tools.filter(tool=>tool.annotations.readOnlyHint).length,22);
    const result = await client.callTool({name:'search_deals',arguments:{limit:5}});
    assert.equal(result.structuredContent.records.length,1); assert.equal(result.structuredContent.records[0].address,'AZRE fixture');
    const dash = await client.callTool({name:'get_dashboard',arguments:{timeframe:'week'}});
    assert.equal(typeof dash.structuredContent.kpis.totalDeals,'number');
    assert.ok(Array.isArray(dash.structuredContent.recentDeals));
    const feed = await client.callTool({name:'get_activity_feed',arguments:{limit:10}});
    assert.ok(Array.isArray(feed.structuredContent.activities));
    const page1 = await client.callTool({name:'search_off_market_properties',arguments:{limit:1}});
    assert.equal(page1.structuredContent.records.length,1);
    assert.equal(page1.structuredContent.records[0].id,101);
    assert.equal(page1.structuredContent.next_offset,1);
    assert.ok(!JSON.stringify(page1.structuredContent).includes('organization_id'));
    const page2 = await client.callTool({name:'search_off_market_properties',arguments:{limit:1,offset:1}});
    assert.equal(page2.structuredContent.records.length,1);
    assert.equal(page2.structuredContent.records[0].id,102);
    assert.equal(page2.structuredContent.next_offset,2);
    const page3 = await client.callTool({name:'search_off_market_properties',arguments:{limit:1,offset:2}});
    assert.equal(page3.structuredContent.records.length,1);
    assert.equal(page3.structuredContent.records[0].id,105);
    assert.equal(page3.structuredContent.next_offset,null);
    const filtered = await client.callTool({name:'search_off_market_properties',arguments:{filters:{City:'Atlanta',Interested:true}}});
    assert.equal(filtered.structuredContent.records.length,1);
    assert.equal(filtered.structuredContent.records[0].id,101);
    const prop = await client.callTool({name:'get_off_market_property',arguments:{property_id:101}});
    assert.equal(prop.structuredContent.record.Address,'101 Peachtree St');
    const nullOrgProp = await client.callTool({name:'get_off_market_property',arguments:{property_id:105}});
    assert.equal(nullOrgProp.structuredContent.record.Address,'105 UI Imported Rd');
    assert.equal((await client.callTool({name:'get_off_market_property',arguments:{property_id:104}})).isError,true);
    for(const name of ['create_deal','update_deal','delete_deal','move_deal','add_deal_note','add_deal_photos','create_jv_deal','create_buyer','update_buyer','add_buyer_note','delete_buyer','create_agent','update_agent','add_agent_note','delete_agent','create_wholesaler','move_contact','create_off_market_property','update_off_market_property','delete_off_market_property','create_task','update_task','delete_task','create_note','update_offer','archive_record','restore_record','create_workspace_record','send_email','log_activity','create_user']) {
      const rejected = await client.callTool({name,arguments:{}}); assert.equal(rejected.isError,true); assert.match(rejected.content[0].text,/WRITES_DISABLED/);
    }
    const injected = await client.callTool({name:'search_deals',arguments:{organization_id:'other'}}); assert.equal(injected.isError,true);
    const injectedOffMarket = await client.callTool({name:'search_off_market_properties',arguments:{organization_id:'other'}}); assert.equal(injectedOffMarket.isError,true);
  } finally {await client.close();}
});
test('grant revocation and unknown clients deny access even with a valid signature',async()=>{
  const unknown = await token({client_id:randomUUID()});
  assert.equal((await fetch(base,{method:'POST',headers:{Authorization:`Bearer ${unknown}`}})).status,403);
  await pg.query('UPDATE "PluginOAuthGrants" SET enabled=false WHERE user_id=$1',[user]);
  assert.equal((await fetch(base,{method:'POST',headers:{Authorization:`Bearer ${await token()}`}})).status,403);
  await pg.query('UPDATE "PluginOAuthGrants" SET enabled=true WHERE user_id=$1',[user]);
});
test('consent lookup requires an ordinary authenticated session, not an MCP token',async()=>{
  assert.equal((await fetch(base+'?view=consent',{headers:{Authorization:`Bearer ${await token()}`}})).status,401);
  const session = await token({role:'authenticated',client_id:undefined,is_anonymous:false},{audience:'authenticated'});
  const response = await fetch(base+'?view=consent',{headers:{Authorization:`Bearer ${session}`}}); assert.equal(response.status,200);
  assert.deepEqual((await response.json()).client_ids,[clientId]);
});
test('OAuth hook leaves ordinary login unchanged and confines approved tokens to MCP',async()=>{
  const original = {aud:'authenticated',role:'authenticated',sub:user};
  async function hook(event) {return (await pg.query('SELECT public.dealdesk_oauth_token_hook($1::jsonb) AS result',[JSON.stringify(event)])).rows[0].result;}
  assert.deepEqual(await hook({user_id:user,claims:original}),{claims:original});
  const minted = await hook({user_id:user,claims:{...original,client_id:clientId}});
  assert.equal(minted.claims.aud,RESOURCE); assert.equal(minted.claims.role,'dealdesk_mcp'); assert.equal(minted.claims.dealdesk_permission,'read');
  assert.equal((await hook({user_id:randomUUID(),claims:{...original,client_id:clientId}})).error.http_code,403);
  assert.equal((await pg.query("SELECT count(*)::int AS n FROM pg_roles WHERE rolname='dealdesk_mcp'")).rows[0].n,0);
  await pg.exec('SET ROLE authenticated');
  await assert.rejects(pg.query('SELECT * FROM public."PluginOAuthGrants"'));
  await assert.rejects(pg.query('SELECT public.dealdesk_oauth_token_hook($1::jsonb)',[JSON.stringify({claims:original})]));
  await pg.exec('RESET ROLE');
});

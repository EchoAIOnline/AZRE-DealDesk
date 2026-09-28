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
  await pg.query('INSERT INTO "PluginOAuthGrants" VALUES ($1,$2,$3,$4,true)',[clientId,user,ORGANIZATION,RESOURCE]);
  await pg.query('INSERT INTO "Deals" (id,address,organization_id) VALUES ($1,$2,$3),($4,$5,$6)',[randomUUID(),'AZRE fixture',ORGANIZATION,randomUUID(),'Other org private address','other']);
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
test('hosted MCP discovers only read tools, reads one organization and rejects all nine mutations',async()=>{
  const client = new Client({name:'hosted-test',version:'1'});
  await client.connect(new StreamableHTTPClientTransport(new URL(base),{requestInit:{headers:{Authorization:`Bearer ${await token()}`}}}));
  try {
    const listed = await client.listTools(); assert.equal(listed.tools.length,8);
    assert.ok(listed.tools.every(tool=>tool.annotations.readOnlyHint && tool._meta.securitySchemes[0].type==='oauth2'));
    const result = await client.callTool({name:'search_deals',arguments:{limit:5}});
    assert.equal(result.structuredContent.records.length,1); assert.equal(result.structuredContent.records[0].address,'AZRE fixture');
    for(const name of ['create_deal','update_deal','create_buyer','update_buyer','create_task','create_note','update_offer','archive_record','restore_record']) {
      const rejected = await client.callTool({name,arguments:{}}); assert.equal(rejected.isError,true); assert.match(rejected.content[0].text,/WRITES_DISABLED/);
    }
    const injected = await client.callTool({name:'search_deals',arguments:{organization_id:'other'}}); assert.equal(injected.isError,true);
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

import test from 'node:test';
import assert from 'node:assert/strict';
import {DealDeskClient} from '../src/client.mjs';
test('preview credential is confined to Vercel endpoints and forwards without replacing API auth',async()=>{
 assert.throws(()=>new DealDeskClient({url:'https://example.com/api',apiKey:'k'.repeat(32),previewBypass:'private'}),/vercel.app/);
 let headers;
 const client=new DealDeskClient({url:'https://example.vercel.app/api',apiKey:'k'.repeat(32),previewBypass:'private',fetchImpl:async(_u,o)=>{headers=o.headers;assert.equal(o.redirect,'error');return new Response(JSON.stringify({success:true,records:[],next_offset:null}));}});
 await client.operate({action:'read',table:'Deals'});
 assert.equal(headers['x-vercel-protection-bypass'],'private');assert.equal(headers.Authorization,'Bearer '+'k'.repeat(32));
});

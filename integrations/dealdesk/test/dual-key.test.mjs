import {test} from 'node:test';
import assert from 'node:assert/strict';
import {makeHandler} from '../backend/handler.mjs';
const primary='original-key-'.padEnd(40,'a'),secondary='office-key-'.padEnd(40,'b');
async function check(keys,authorization){
 const env={...keys,DEALDESK_PLUGIN_ORGANIZATION_ID:'org_test',SUPABASE_SERVICE_ROLE_KEY:'test',VITE_SUPABASE_URL:'https://test.example'};
 const db={from(){return {select(){return this},eq(){return this},is(){return this},order(){return this},range(){return Promise.resolve({data:[],error:null})}}}};
 let output;const res={statusCode:200,setHeader(){},status(value){this.statusCode=value;return this},json(value){output=value;return this}};
 await makeHandler({createClient:()=>db,env})({method:'POST',headers:{authorization},body:{action:'read',table:'Deals'}},res);
 return {status:res.statusCode,output};
}
test('either valid key works; second key alone works in Production',async()=>{
 const env={DEALDESK_PLUGIN_API_KEY:primary,DEALDESK_PLUGIN_API_KEY2:secondary};
 assert.equal((await check(env,`Bearer ${primary}`)).status,200);
 assert.equal((await check(env,`Bearer ${secondary}`)).status,200);
 assert.equal((await check({DEALDESK_PLUGIN_API_KEY2:secondary},`Bearer ${secondary}`)).status,200);
 assert.equal((await check(env,'Bearer invalid')).status,401);
 assert.equal((await check({DEALDESK_PLUGIN_API_KEY2:'short'},'Bearer short')).status,503);
 assert.equal((await check({...env,DEALDESK_API_KEY:secondary},`Bearer ${secondary}`)).status,401);
});

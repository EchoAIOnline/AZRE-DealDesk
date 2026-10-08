import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {EventEmitter} from 'node:events';
import {Readable} from 'node:stream';
import {database} from './database.mjs';
import {photoUrl,publicAddress,validatePhoto,MAX_PHOTO_BYTES} from '../src/photos.mjs';
const a='https://photos.zillowstatic.com/fp/abc-p_e.jpg',b='https://photos.zillowstatic.com/fp/def-p_e.webp';
const jpeg=Buffer.from([255,216,255,224,0,1]);
const resolve=async()=>[{address:'8.8.8.8',family:4}];
function openMock({statusCode=200,type='image/jpeg',data=jpeg,length=data.length}={}) {
 return (_url,options,callback)=>{
  const req=new EventEmitter();req.destroy=err=>{if(err)req.emit('error',err);req.emit('close');};
  req.end=()=>queueMicrotask(()=>{options.lookup('photos.zillowstatic.com',{},(err,ip)=>assert.equal(ip,'8.8.8.8'));const res=Readable.from([data]);res.statusCode=statusCode;res.headers={'content-type':type,'content-length':String(length)};res.on('end',()=>req.emit('close'));callback(res);});return req;
 };
}
test('strict CDN URL and public DNS validation blocks SSRF variants',async()=>{
 for(const url of ['http://photos.zillowstatic.com/fp/a.jpg','https://photos.zillowstatic.com.evil.test/a.jpg','https://user@photos.zillowstatic.com/a.jpg',a+'?redirect=https://evil.test',a+'#x','https://photos.zillowstatic.com:443/a.jpg','https://photos.zillowstatic.com/%2f/a.jpg','https://photos.zillowstatic.com/a.svg']) assert.throws(()=>photoUrl(url));
 for(const ip of ['127.0.0.1','10.0.0.1','169.254.169.254','192.168.1.1','100.64.0.1','::1','::ffff:127.0.0.1','fc00::1','2001:db8::1','2002:7f00:1::']) assert.equal(publicAddress(ip),false,ip);
 assert.equal(publicAddress('8.8.8.8'),true);assert.equal(publicAddress('2606:4700::1111'),true);
 await assert.rejects(validatePhoto(a,{resolve:async()=>[{address:'127.0.0.1',family:4}],open:()=>assert.fail('must not request')}));
});
test('bounded download verifies image type/bytes and rejects every redirect and oversized bodies',async()=>{
 assert.equal(await validatePhoto(a,{resolve,open:openMock()}),a);
 for(const [type,data] of [['image/png',Buffer.from([137,80,78,71,13,10,26,10,0])],['image/webp',Buffer.from('RIFF1234WEBP')]]) assert.equal(await validatePhoto(a,{resolve,open:openMock({type,data})}),a);
 for(const options of [{statusCode:302},{statusCode:307},{type:'text/html'},{data:Buffer.from('<html>')},{length:MAX_PHOTO_BYTES+1},{length:0,data:Buffer.alloc(MAX_PHOTO_BYTES+1)}]) await assert.rejects(validatePhoto(a,{resolve,open:openMock(options)}));
});
let pg,db;const user=randomUUID(),client=randomUUID(),session=randomUUID(),id=randomUUID();
before(async()=>{
 ({pg,db}=await database());await pg.exec('CREATE ROLE supabase_auth_admin;');
 for(const f of ['002-oauth.sql','003-operational.sql','004-photos.sql']) await pg.exec(await readFile(new URL('../backend/'+f,import.meta.url),'utf8'));
 await pg.query(`INSERT INTO "PluginOAuthGrants"(client_id,user_id,organization_id,resource,operational_writes) VALUES($1,$2,'org_azre_00001','https://dealdesk.asharizakargroup.com/api/mcp',true)`,[client,user]);
 await pg.query(`INSERT INTO "Deals"(id,address,organization_id,photos) VALUES($1,'Photo test','org_azre_00001',$2)`,[id,JSON.stringify(['https://existing.test/image.jpg'])]);
});
after(async()=>pg.close());
async function run(overrides={}) {const r=await db.rpc('dealdesk_add_photos',{p_id:id,p_urls:JSON.stringify([a,b,a]),p_revision:0,p_user:user,p_client:client,p_session:session,p_request:null,...overrides});if(r.error)throw r.error;return r.data;}
test('atomic append preserves order/history, deduplicates, increments revision and replays',async()=>{
 const request=randomUUID(),r=await run({p_request:request});assert.equal(r.added,2);assert.deepEqual(r.record.photos,['https://existing.test/image.jpg',a,b]);assert.equal(r.record.pluginRevision,1);
 assert.equal((await run({p_request:request})).replayed,true);
 assert.equal((await run({p_request:request,p_revision:1})).error.code,'REQUEST_ID_REUSED');
 assert.equal((await run()).error.code,'CONFLICT');
 const noop=await run({p_revision:1});assert.equal(noop.added,0);assert.equal(noop.record.pluginRevision,1);
 const rows=(await pg.query('SELECT * FROM "PluginMutationAudit"')).rows;assert.equal(rows.length,2);assert.deepEqual(rows[0].changed_fields,['photos']);assert.equal(rows[0].previous_values.photos.length,1);assert.equal(rows[0].new_values.photos.length,3);
});
test('organization, grant, archive and database-role restrictions remain enforced',async()=>{
 for(const change of [{p_user:randomUUID()},{p_client:randomUUID()},{p_session:''}]) assert.equal((await run(change)).error.code,'WRITES_DISABLED');
 const other=randomUUID();await pg.query(`INSERT INTO "Deals"(id,address,organization_id) VALUES($1,'Other','other')`,[other]);assert.equal((await run({p_id:other})).error.code,'NOT_FOUND');
 await pg.query(`UPDATE "PluginOAuthGrants" SET enabled=false WHERE user_id=$1`,[user]);assert.equal((await run()).error.code,'WRITES_DISABLED');await pg.query(`UPDATE "PluginOAuthGrants" SET enabled=true WHERE user_id=$1`,[user]);
 await pg.exec('SET ROLE authenticated');await assert.rejects(run());await pg.exec('RESET ROLE');
 await assert.rejects(run({p_urls:JSON.stringify(['https://evil.test/x.jpg'])}));
 await pg.query(`UPDATE "Deals" SET "pluginArchivedAt"=now() WHERE id=$1`,[id]);assert.equal((await run({p_revision:2})).error.code,'ARCHIVED');
 await pg.query(`UPDATE "Deals" SET "pluginArchivedAt"=NULL WHERE id=$1`,[id]);
});
test('audit failure rolls back photos and revision',async()=>{
 await pg.exec(`CREATE FUNCTION public.reject_photo_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test failure'; END $$; CREATE TRIGGER reject_photo_audit BEFORE INSERT ON "PluginMutationAudit" FOR EACH ROW EXECUTE FUNCTION public.reject_photo_audit();`);
 await assert.rejects(run({p_revision:3,p_urls:JSON.stringify(['https://photos.zillowstatic.com/fp/new.jpg'])}));
 const row=(await pg.query('SELECT photos,"pluginRevision" FROM "Deals" WHERE id=$1',[id])).rows[0];assert.equal(row.pluginRevision,3);assert.equal(row.photos.length,3);
});

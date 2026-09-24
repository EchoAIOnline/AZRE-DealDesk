import { test } from 'node:test';
import assert from 'node:assert/strict';
import { database } from './database.mjs';
import { executeOperation } from '../backend/handler.mjs';

test('live DealDesk text IDs and text yearBuilt work with revisions and numeric outputs',async()=>{
  const {pg,db}=await database();
  try {
    await pg.exec('ALTER TABLE "Deals" ALTER COLUMN id TYPE text USING id::text; ALTER TABLE "Deals" ALTER COLUMN "yearBuilt" TYPE text USING "yearBuilt"::text;');
    await pg.query('INSERT INTO "Deals" (id,address,"yearBuilt",organization_id) VALUES ($1,$2,$3,$4)',['legacy_short_id','Compatibility fixture','1980','org_azre_00001']);
    const config={organizationId:'org_azre_00001',writes:true,archive:false};
    const result=await executeOperation(db,{action:'read',table:'Deals',id:'legacy_short_id'},config);
    assert.equal(result.records[0].yearBuilt,1980);
    const update=await executeOperation(db,{action:'update',table:'Deals',id:'legacy_short_id',expected_revision:0,payload:{yearBuilt:1981}},config);
    assert.equal(update.record.yearBuilt,1981);
    assert.equal(update.record._revision,1);
  } finally {await pg.close();}
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateBuyer } from '../src/matching.mjs';
import { DealDeskClient } from '../src/client.mjs';
const deal={address:'Test Atlanta GA 30319',subMarket:'Atlanta',offerDecision:'Analyzing',dealType:['Renovation'],offerPrice:200000,renovationARV:500000,renovationEstimate:100000,bedrooms:3,bathrooms:2,sqft:2000,yearBuilt:1980};
const buyer={status:'Vetted Buyer',buyBox:{locations:'City: Atlanta, Zip: 30319',propertyTypes:['Fix & Flip'],minPrice:100000,maxPrice:300000,maxRenoBudget:150000,minArv:400000,earliestYearBuilt:1950}};
test('recorded criteria match with explicit evidence',()=>{assert.equal(evaluateBuyer(deal,buyer).eligible,true);});
test('ZIP refines city and unknown ARV never counts as confirmed fit',()=>{
  assert.equal(evaluateBuyer({...deal,address:'Test Atlanta 30318'},buyer).eligible,false);
  const result=evaluateBuyer({...deal,renovationARV:undefined},buyer);
  assert.equal(result.eligible,false);assert.ok(result.missing.includes('ARV'));
});
test('repair budget, year built and inactive buyer are respected',()=>{
  assert.equal(evaluateBuyer({...deal,renovationEstimate:200000},buyer).eligible,false);
  assert.equal(evaluateBuyer({...deal,yearBuilt:1920},buyer).eligible,false);
  assert.equal(evaluateBuyer(deal,{...buyer,status:'Deactivated'}).eligible,false);
});
test('closed deals and missing strategies are not eligible',()=>{
  assert.equal(evaluateBuyer({...deal,offerDecision:'Deal Successfully Closed'},buyer).eligible,false);
  assert.equal(evaluateBuyer({...deal,dealType:[]},buyer).eligible,false);
});
test('client rejects insecure URLs and redacts upstream failures',async()=>{
  assert.throws(()=>new DealDeskClient({url:'http://external.example/api',apiKey:'x'.repeat(32)}));
  const client=new DealDeskClient({url:'https://example.com/plugin',apiKey:'x'.repeat(32),fetchImpl:async()=>new Response(JSON.stringify({error:{code:'SQL_ERROR',message:'secret-database-text'}}),{status:500})});
  await assert.rejects(client.operate({action:'read',table:'Deals'}),error=>!error.message.includes('secret-database-text'));
});

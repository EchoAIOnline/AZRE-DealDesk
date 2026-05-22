import { createClient } from '@supabase/supabase-js';

const url = process.env.VITE_SUPABASE_URL || '';
const key = process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(url, key);

async function run() {
  const { data, error } = await supabase.from('Deals').select('id, address, pipelineType, offerDecision, organization_id');
  if (error) {
    console.log("Error:", error.message);
    return;
  }
  
  console.log("Total Deals in Database:", data.length);
  
  const pipelineTypes: Record<string, number> = {};
  const orgIds: Record<string, number> = {};
  const offerDecisions: Record<string, number> = {};
  
  data.forEach(d => {
    const pt = d.pipelineType || 'undefined/null';
    pipelineTypes[pt] = (pipelineTypes[pt] || 0) + 1;
    
    const org = d.organization_id || 'undefined/null';
    orgIds[org] = (orgIds[org] || 0) + 1;

    const od = d.offerDecision || 'undefined/null';
    offerDecisions[od] = (offerDecisions[od] || 0) + 1;
  });
  
  console.log("\nPipeline Types distribution:", pipelineTypes);
  console.log("\nOrganization IDs distribution:", orgIds);
  console.log("\nOffer Decisions distribution (first 20):", Object.fromEntries(Object.entries(offerDecisions).slice(0, 20)));
}

run();

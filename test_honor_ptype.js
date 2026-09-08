import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
async function run() {
  const { data } = await supabase.from('Deals').select('*');
  const jv = await supabase.from('JVDeals').select('*');
  let combined = [...data.map(d => ({...d, _isJV: false})), ...(jv.data || []).map(d => ({...d, _isJV: true}))];
  const map = new Map();
  combined.forEach(item => map.set(item.id, item));
  const deduped = Array.from(map.values());
  
  let pTypes = {};
  for (let d of deduped) {
    let pType = d.pipelineType;
    if (pType === 'main') pType = 'mls';
    if (pType === 'jv') pType = 'dfd';
    
    if (!pType) {
        if (d._isJV) pType = 'dfd';
        else if (d.listingType === 'Off-Market') pType = 'off-market';
        else pType = 'mls';
    }
    pTypes[pType] = (pTypes[pType] || 0) + 1;
  }
  console.log(pTypes);
}
run();

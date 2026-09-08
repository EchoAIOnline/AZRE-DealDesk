import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
async function run() {
  const { data, error } = await supabase.from('Deals').select('id, pipelineType, listingType');
  const unique = new Set(data.map(d => d.id));
  console.log(`total: ${data.length}, unique Deals ids: ${unique.size}`);
  
  const jv = await supabase.from('JVDeals').select('id');
  const all_ids = new Set([...data.map(d => d.id), ...(jv.data || []).map(d => d.id)]);
  console.log(`total Deals + JV: ${data.length + (jv.data?.length || 0)}, unique combined ids: ${all_ids.size}`);
  
  // Apply deduplicateById logic
  let combined = [...data.map(d => ({...d, _isJV: false})), ...(jv.data || []).map(d => ({...d, _isJV: true}))];
  const map = new Map();
  combined.forEach(item => map.set(item.id, item));
  const deduped = Array.from(map.values());
  
  let mls = 0, off = 0, dfd = 0;
  for (let d of deduped) {
    let pType = d.pipelineType;
    if (d._isJV || pType === 'jv' || pType === 'dfd') {
        pType = 'dfd';
    } else if (d.listingType === 'Off-Market' || pType === 'off-market') {
        pType = 'off-market';
    } else {
        pType = 'mls';
    }
    if (pType === 'mls') mls++;
    if (pType === 'off-market') off++;
    if (pType === 'dfd') dfd++;
  }
  console.log(`After dedup -> mls: ${mls}, off-market: ${off}, dfd: ${dfd}, total: ${deduped.length}`);
}
run();

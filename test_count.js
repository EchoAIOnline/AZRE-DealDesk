import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
async function run() {
  let from = 0; let allDeals = [];
  while (true) {
    const { data } = await supabase.from('Deals').select('*').range(from, from + 999);
    if (!data || data.length === 0) break;
    allDeals.push(...data);
    from += 1000;
  }
  const jv = await supabase.from('JVDeals').select('*');
  console.log(`Deals: ${allDeals.length}, JVDeals: ${jv.data?.length}`);
  
  let combined = [...allDeals.map(d => ({...d, _isJV: false})), ...(jv.data || []).map(d => ({...d, _isJV: true}))];
  const map = new Map();
  combined.forEach(item => map.set(item.id, item));
  const deduped = Array.from(map.values());
  
  let mls = 0;
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
  }
  console.log(`Deduped MLS: ${mls}`);
}
run();

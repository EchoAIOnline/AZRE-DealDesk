import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
async function run() {
  let from = 0; let allDealsData = [];
  while (true) {
    const { data } = await supabase.from('Deals').select('*').range(from, from + 999);
    if (!data || data.length === 0) break;
    allDealsData.push(...data);
    from += 1000;
  }
  const jvDealsData = (await supabase.from('JVDeals').select('*')).data || [];
  
  let combined = [...allDealsData.map(d => ({...d, _isJV: false})), ...jvDealsData.map(d => ({...d, _isJV: true}))];
  const map = new Map();
  combined.forEach(item => map.set(item.id, item));
  const allDealsDataDedup = Array.from(map.values());
  
  const cleanDeals = allDealsDataDedup.map((d) => {
      let pType = d.pipelineType;
      if (d._isJV || pType === 'jv' || pType === 'dfd') {
          pType = 'dfd';
      } else if (d.listingType === 'Off-Market' || pType === 'off-market') {
          pType = 'off-market';
      } else {
          pType = 'mls';
      }
      return { ...d, pipelineType: pType };
  });

  // Filter 1: App.tsx getFilteredDeals
  let filtered = [...cleanDeals].filter(Boolean); 
  filtered = filtered.filter(d => d.pipelineType === 'mls' || !d.pipelineType || false);
  console.log(`Filtered count (mls pipeline): ${filtered.length}`);
  
  // Also filter by org_id 'org_azre_00001' or null
  const orgFiltered = filtered.filter(d => !d.organization_id || d.organization_id === 'org_azre_00001');
  console.log(`Filtered count with org check: ${orgFiltered.length}`);
}
run();

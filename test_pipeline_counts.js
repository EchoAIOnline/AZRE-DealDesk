import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
async function run() {
  const { data, error } = await supabase.from('Deals').select('id, pipelineType, listingType');
  
  let mls = 0, off = 0, dfd = 0;
  for (let d of data) {
    let pType = d.pipelineType;
    if (pType === 'jv' || pType === 'dfd') {
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
  console.log(`mls: ${mls}, off-market: ${off}, dfd: ${dfd}, total: ${data.length}`);
}
run();

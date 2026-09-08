import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
async function run() {
  const { data } = await supabase.from('Deals').select('organization_id');
  const orgs = {};
  for (let d of data) {
    orgs[d.organization_id] = (orgs[d.organization_id] || 0) + 1;
  }
  console.log(orgs);
}
run();

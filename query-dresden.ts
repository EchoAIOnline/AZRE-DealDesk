import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
async function run() {
  const { data, error } = await supabase.from('Deals').select('id, address, organization_id, pipelineType, listingType, offerDecision, isArchived, archived').ilike('address', '%Dresden%');
  console.log(data, error);
}
run();

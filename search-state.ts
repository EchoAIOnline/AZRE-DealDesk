import { createClient } from '@supabase/supabase-js';

const url = process.env.VITE_SUPABASE_URL || '';
const key = process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(url, key);

async function run() {
  const { data, error } = await supabase.from('Deals').select('*');
  if (error) {
    console.error("Error loading deals:", error.message);
    return;
  }

  const query = "state";
  const matches = data.filter(d => {
    return (d.address && d.address.toLowerCase().includes(query)) ||
           (d.mls && String(d.mls).toLowerCase().includes(query)) ||
           (d.agentName && d.agentName.toLowerCase().includes(query));
  });

  console.log("Found matches count:", matches.length);
  matches.forEach(m => {
    console.log(`Address: ${m.address}, MLS: ${m.mls}, Agent: ${m.agentName}, pipelineType: ${m.pipelineType}, offerDecision: ${m.offerDecision}`);
  });
}

run();

import { createClient } from '@supabase/supabase-js';

const url = process.env.VITE_SUPABASE_URL || '';
const key = process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(url, key);

async function run() {
  const { data, error } = await supabase.from('Deals').select('id, address, offerDecision').ilike('address', '%1008 State%');
  if (error) {
    console.log("Error:", error.message);
    return;
  }
  
  if (data && data.length > 0) {
    const deal = data[0];
    const od = deal.offerDecision;
    console.log("Deal address:", deal.address);
    console.log("offerDecision raw:", JSON.stringify(od));
    console.log("offerDecision length:", od ? od.length : 0);
    if (od) {
      console.log("Char codes:", od.split('').map((c: string) => c.charCodeAt(0)));
    }
  } else {
    console.log("Deal not found!");
  }
}

run();

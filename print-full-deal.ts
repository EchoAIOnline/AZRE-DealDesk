import { createClient } from '@supabase/supabase-js';

const url = process.env.VITE_SUPABASE_URL || '';
const key = process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(url, key);

async function run() {
  const { data, error } = await supabase.from('Deals').select('*').ilike('address', '%1008 State%');
  if (error) {
    console.error("Error loader:", error.message);
    return;
  }
  
  console.log("Entire deal JSON (Beautified):");
  console.log(JSON.stringify(data?.[0], null, 2));
}

run();

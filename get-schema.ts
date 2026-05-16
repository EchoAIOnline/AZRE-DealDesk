import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
const envFile = fs.readFileSync('.env', 'utf8');
const env: Record<string, string> = {};
envFile.split('\n').forEach(line => {
   const [k, ...vParts] = line.split('=');
   if(k && vParts.length) {
       let v = vParts.join('=').trim();
       if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
       if (v.startsWith("'") && v.endsWith("'")) v = v.slice(1, -1);
       env[k.trim()] = v;
   }
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function run() {
  console.log("Fetching Agents schema...");
  const { data, error } = await supabase.rpc('execute_sql', { query: `
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'Agents';
  `});
  if (error) {
     console.error("RPC Error:", error);
     return;
  }
  console.log(data);
}
run();

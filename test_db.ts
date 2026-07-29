import { createClient } from '@supabase/supabase-js';
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: agents, error } = await supabase.from('Agents').select('*').in('name', ['Jenea Kennedy', 'Luis Rodriguez']);
  if (error) console.error(error);
  else console.log(JSON.stringify(agents, null, 2));
}
run();

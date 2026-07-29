import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
  const { data: buyers, error } = await supabase.from('Buyers').select('id, name, email, nextFollowUpDate').in('name', ['Andy Griffith', 'Jenea Kennedy', 'Luis Rodriguez']);
  if (error) console.error(error);
  else console.log(JSON.stringify(buyers, null, 2));
}
run();

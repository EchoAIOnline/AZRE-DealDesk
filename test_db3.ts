import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
  const { data: agents, error } = await supabase.from('Agents').select('id, name, email, nextFollowUpDate').in('name', ['Andy Griffith']);
  if (error) console.error(error);
  else console.log(JSON.stringify(agents, null, 2));
}
run();

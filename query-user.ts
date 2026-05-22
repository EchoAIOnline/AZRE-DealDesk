import { createClient } from '@supabase/supabase-js';

const url = process.env.VITE_SUPABASE_URL || '';
const key = process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(url, key);

async function run() {
  const { data, error } = await supabase.from('Users').select('*').eq('email', 'asharizakarrei@gmail.com');
  if (error) {
    console.log("Users error:", error.message);
  } else {
    console.log("Found users matching email:", data);
  }
}

run();

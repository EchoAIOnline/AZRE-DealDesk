import { createClient } from '@supabase/supabase-js';

const url = process.env.VITE_SUPABASE_URL || '';
const key = process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(url, key);

async function run() {
  const tables = ['Deals', 'JVDeals', 'Agents', 'Buyers', 'Wholesalers'];
  for (const table of tables) {
    const { data, error } = await supabase.from(table).select('*');
    if (error) {
      console.log(`Table ${table} error:`, error.message);
    } else {
      console.log(`Table ${table} row count:`, data.length);
      if (data.length > 0) {
        console.log(`Sample row from ${table}:`, JSON.stringify(data[0]).substring(0, 300));
      }
    }
  }
}

run();

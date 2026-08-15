const { createClient } = require('@supabase/supabase-js');
let rawSupabaseUrl = process.env.VITE_SUPABASE_URL || '';
if (!rawSupabaseUrl.startsWith('http')) rawSupabaseUrl = `https://${rawSupabaseUrl}`;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(rawSupabaseUrl, supabaseKey);
async function run() {
    const res = await supabase.rpc('reload_schema_cache');
    console.log("RPC res:", res.error || "Success");
}
run();

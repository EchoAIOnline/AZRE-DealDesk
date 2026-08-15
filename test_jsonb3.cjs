const { createClient } = require('@supabase/supabase-js');
let rawSupabaseUrl = process.env.VITE_SUPABASE_URL || '';
if (!rawSupabaseUrl.startsWith('http')) rawSupabaseUrl = `https://${rawSupabaseUrl}`;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(rawSupabaseUrl, supabaseKey);
async function run() {
    const { data, error } = await supabase.from('Deals').select('id').limit(1);
    if(error || !data || data.length === 0) {
        console.log("Error or no deals:", error);
        return;
    }
    const dealId = data[0].id;
    console.log("Updating deal", dealId);
    // motivationSignals is jsonb
    const res = await supabase.from('Deals').update({ motivationSignals: "Test string" }).eq('id', dealId);
    console.log("Update res:", res.error || "Success");
}
run();

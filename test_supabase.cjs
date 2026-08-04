const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl.startsWith('http')) {
    console.log("No valid supabase url");
    process.exit(0);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    let { data, error } = await supabase.from('Deals').select('id, address, pipelineType, listingType').limit(10);
    console.log("Deals:", data);
}
check();

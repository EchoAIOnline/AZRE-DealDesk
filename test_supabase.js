import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Parse .env
const env = fs.readFileSync('.env', 'utf-8');
const VITE_SUPABASE_URL = env.match(/VITE_SUPABASE_URL=(.*)/)?.[1]?.trim() || '';
const VITE_SUPABASE_ANON_KEY = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)?.[1]?.trim() || '';

const supabaseUrl = VITE_SUPABASE_URL.startsWith('http') ? VITE_SUPABASE_URL : `https://${VITE_SUPABASE_URL}`;
const supabase = createClient(supabaseUrl, VITE_SUPABASE_ANON_KEY);

async function check() {
    let { data, error } = await supabase.from('Deals').select('id, address, pipelineType, listingType').limit(10);
    console.log("Deals:", data);
}
check();

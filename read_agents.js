import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const env = fs.readFileSync('.env', 'utf8').split('\n').reduce((acc, line) => {
    const [key, ...rest] = line.split('=');
    if (key) acc[key.trim()] = rest.join('=').trim();
    return acc;
}, {});

const supabaseUrl = env['VITE_SUPABASE_URL'] || '';
const supabaseKey = env['VITE_SUPABASE_ANON_KEY'] || '';
const supabase = createClient(supabaseUrl.startsWith('http') ? supabaseUrl : `https://${supabaseUrl}`, supabaseKey);

async function check() {
    let { data, error } = await supabase.from('Agents').select('*').limit(20);
    console.log(error || data);
}
check();

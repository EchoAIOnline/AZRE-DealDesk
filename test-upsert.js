import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const payload = {
    address: 'TEST DOC UPLOAD',
    documents: [{ id: 'test', name: 'test.pdf', url: 'http://test.com', category: 'Other Documents', uploadedAt: new Date().toISOString() }],
    organization_id: 'org_azre_00001'
  };
  const { data, error } = await supabase.from('Deals').upsert(payload).select().single();
  console.log('Error:', error);
  console.log('Data:', data?.documents);
}
test();

import { createClient } from '@supabase/supabase-js';
import { makeHostedHandler } from '../integrations/dealdesk/backend/hosted.mjs';

export const config = { maxDuration: 60 };
export default makeHostedHandler({ createClient });

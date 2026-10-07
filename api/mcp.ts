import { createClient } from '@supabase/supabase-js';
import { makeHostedHandler } from '../integrations/dealdesk/backend/hosted.mjs';

import zillowHandler from './zillow-data.js';
import { DomainError } from '../integrations/dealdesk/src/domain.mjs';

// Reuse the exact service that powers the frontend; never forward OAuth tokens.
export async function zillow(url: string) {
  let status = 200;
  let payload: any;
  await zillowHandler({ method: 'POST', body: { url } }, {
    status(code: number) { status = code; return this; },
    json(data: any) { payload = data; return this; },
  });
  if (status !== 200 || payload?.status !== 'success') throw new DomainError('IMPORT_FAILED', 'The existing Zillow importer could not complete this request.');
  return payload.data;
}

export const config = { maxDuration: 60 };
export default makeHostedHandler({ createClient, zillow });

import { createClient } from '@supabase/supabase-js';
import { makeHostedHandler } from '../integrations/dealdesk/backend/hosted.mjs';

import zillowHandler from './zillow-data.js';
import sendEmailHandler from './send-email.js';
import geminiCompsHandler from './gemini/comps.js';
import geminiChatHandler from './gemini/chat.js';
import { DomainError } from '../integrations/dealdesk/src/domain.mjs';

async function invokeLocalHandler(handler: (req: any, res: any) => Promise<any>, body: any) {
  let status = 200;
  let payload: any;
  await handler({ method: 'POST', body }, {
    status(code: number) { status = code; return this; },
    json(data: any) { payload = data; return this; },
  });
  return { status, payload };
}

// Reuse the exact services that power the frontend; never forward OAuth tokens.
export async function zillow(url: string) {
  const { status, payload } = await invokeLocalHandler(zillowHandler, { url });
  if (status !== 200 || payload?.status !== 'success') {
    throw new DomainError('IMPORT_FAILED', 'The existing Zillow importer could not complete this request.');
  }
  return payload.data;
}

export async function sendEmail(data: { recipients: Array<{ email: string; name?: string }>; subject: string; body: string; fromAddress?: string }) {
  const { status, payload } = await invokeLocalHandler(sendEmailHandler, {
    action: 'send_bulk_email',
    data: {
      recipients: data.recipients,
      subject: data.subject,
      body: data.body,
      fromAddress: data.fromAddress,
    },
  });
  if (status !== 200 || payload?.status !== 'success') {
    throw new DomainError('EMAIL_FAILED', payload?.message || 'Unable to send email.');
  }
  return payload;
}

export async function geminiComps(input: { address: string; sqft?: number | string; beds?: number | string; baths?: number | string }) {
  const { status, payload } = await invokeLocalHandler(geminiCompsHandler, input);
  if (status !== 200 || payload?.status !== 'success') {
    throw new DomainError('AI_FAILED', payload?.message || 'Unable to generate AI comps.');
  }
  return payload.data;
}

export async function geminiChat(input: { message: string }) {
  const { status, payload } = await invokeLocalHandler(geminiChatHandler, input);
  if (status !== 200 || payload?.status !== 'success') {
    throw new DomainError('AI_FAILED', payload?.message || 'Unable to process AI search chat.');
  }
  return payload.reply;
}

export const config = { maxDuration: 60 };
export default makeHostedHandler({ createClient, zillow, sendEmail, geminiComps, geminiChat });

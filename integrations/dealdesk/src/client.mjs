import { DomainError, fail } from './domain.mjs';

export class DealDeskClient {
  constructor({url,apiKey,fetchImpl=fetch,timeout=15000}) {
    const endpoint=new URL(url);
    if (endpoint.protocol !== 'https:' && !(endpoint.protocol === 'http:' && ['localhost','127.0.0.1','[::1]'].includes(endpoint.hostname))) throw new Error('DealDesk URL must use HTTPS (HTTP allowed only on loopback).');
    if (endpoint.username || endpoint.password || endpoint.search || endpoint.hash) throw new Error('DealDesk URL must not contain credentials, query parameters, or fragments.');
    if (!apiKey || apiKey.length < 32) throw new Error('A dedicated DEALDESK_PLUGIN_API_KEY of at least 32 characters is required.');
    this.url=endpoint.href; this.apiKey=apiKey; this.fetch=fetchImpl; this.timeout=timeout;
  }
  async operate(request) {
    let response;
    try {
      response=await this.fetch(this.url,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${this.apiKey}`},body:JSON.stringify(request),redirect:'error',signal:AbortSignal.timeout(this.timeout)});
    } catch {
      fail('CONNECTION_ERROR',request.action === 'read' ? 'Could not reach DealDesk.' : 'Write outcome is unknown. Read the record or request_id before retrying.');
    }
    let result;
    try {
      // Read incrementally so a bad upstream cannot allocate an unbounded response.
      const reader=response.body.getReader(); const chunks=[]; let size=0;
      for (;;) { const {done,value}=await reader.read(); if (done) break; size+=value.byteLength; if (size>2_000_000) { await reader.cancel(); fail('RESPONSE_TOO_LARGE','DealDesk response exceeded the safe size. Narrow the search.'); } chunks.push(value); }
      result=JSON.parse(Buffer.concat(chunks).toString('utf8'));
    } catch(error) {
      if (error instanceof DomainError) throw error;
      fail('INVALID_RESPONSE','DealDesk returned an unreadable response. Verify write outcomes before retrying.');
    }
    if (!response.ok || result.success !== true) {
      const known = {CONFLICT:'The record changed. Read it again before retrying.',WRITES_DISABLED:'Writes are disabled on the DealDesk backend.',ARCHIVE_DISABLED:'Archiving is disabled on the DealDesk backend.',NOT_FOUND:'Record not found.',UNAUTHORIZED:'DealDesk authentication failed.',CONFIGURATION:'The DealDesk plugin backend needs configuration.',REQUEST_ID_REUSED:'This request_id has already been used.',ARCHIVED:'Restore the record before editing.'};
      const code=Object.hasOwn(known,result.error?.code) ? result.error.code : 'UPSTREAM_ERROR';
      fail(code,known[code] || 'DealDesk rejected the operation. No upstream error details are exposed.');
    }
    if (request.action === 'read') {
      if (!Array.isArray(result.records) || !(result.next_offset === null || Number.isInteger(result.next_offset))) fail('INVALID_RESPONSE','DealDesk returned an invalid page.');
    } else if (!result.record || typeof result.record.id !== 'string') fail('INVALID_RESPONSE','DealDesk did not confirm a record. Verify the write before retrying.');
    return result;
  }
}

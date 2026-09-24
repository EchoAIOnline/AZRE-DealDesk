import { timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { tables, recordTypes, mutableTables, id, fields, searchFields, createSchema, patchSchema, project, DomainError, fail } from '../src/domain.mjs';

const requestSchema = z.object({
  action:z.enum(['read','create','update','append_note','archive','restore']),
  table:z.enum(tables), id:id.optional(),
  payload:z.record(z.string(),z.unknown()).optional(),
  filters:z.record(z.string(),z.union([z.string().max(1000),z.boolean()])).optional(),
  query:z.string().max(200).optional(),
  offset:z.number().int().min(0).max(100000).default(0),
  limit:z.number().int().min(1).max(100).default(25),
  include_archived:z.boolean().default(false),
  expected_revision:z.number().int().nonnegative().optional(),
  request_id:z.uuid().optional(),
  note:z.string().trim().min(1).max(5000).optional(),
  reason:z.string().trim().min(1).max(1000).optional()
}).strict();
const equal = (a,b) => typeof a === 'string' && typeof b === 'string' && Buffer.byteLength(a) === Buffer.byteLength(b) && timingSafeEqual(Buffer.from(a),Buffer.from(b));
function expose(table,row) { return {...project(table,row), _revision:row.pluginRevision}; }
function checkDb(result) {
  if (result.error) fail('DATABASE_ERROR','Database operation failed. Verify the migration and field schema; details are confined to the database.');
  return result.data;
}
function scoped(db,table,org) { return db.from(table).select('*').eq('organization_id',org); }

export async function executeOperation(db, input, config) {
  const req = requestSchema.parse(input);
  const org = config.organizationId;
  if (!org) fail('CONFIGURATION','Plugin organization is not configured.');
  if (req.action !== 'read' && !config.writes) fail('WRITES_DISABLED','Writes are disabled on the DealDesk backend.');
  if (['archive','restore'].includes(req.action) && !config.archive) fail('ARCHIVE_DISABLED','Archiving is disabled on the DealDesk backend.');
  const table = req.table;
  if (req.action === 'read') {
    let q = scoped(db,table,org);
    if (req.id) q = q.eq('id',req.id);
    if (!req.include_archived) q = q.is('pluginArchivedAt',null);
    for (const [key,value] of Object.entries(req.filters || {})) {
      if (!searchFields[table].includes(key)) fail('INVALID_FILTER','Unsupported filter.');
      q = q.eq(key,value);
    }
    if (req.query) {
      // Do not interpolate user text into PostgREST's OR/filter grammar.
      const column = table === 'Deals' ? 'address' : table === 'PluginTasks' ? 'title' : 'name';
      q = q.ilike(column,`%${req.query.replace(/[\\%_]/g,'\\$&')}%`);
    }
    const rows = checkDb(await q.order('id',{ascending:true}).range(req.offset,req.offset+req.limit));
    return {records:rows.slice(0,req.limit).map(r => expose(table,r)), next_offset:rows.length > req.limit ? req.offset+req.limit : null};
  }
  if (req.action === 'create') {
    if (!mutableTables.includes(table) || !req.request_id) fail('INVALID_REQUEST','Creation requires an allowed record type and a UUID request_id.');
    const payload = createSchema(table).parse(req.payload);
    if (table === 'PluginTasks') {
      const target = checkDb(await scoped(db,payload.entityType,org).eq('id',payload.entityId).is('pluginArchivedAt',null));
      if (target.length !== 1) fail('NOT_FOUND','The task target was not found in this organization.');
    }
    const existing = checkDb(await scoped(db,table,org).eq('id',req.request_id));
    if (existing.length) {
      if (Object.entries(payload).every(([k,v]) => JSON.stringify(project(table,existing[0])[k]) === JSON.stringify(v))) return {record:expose(table,existing[0]),replayed:true};
      fail('REQUEST_ID_REUSED','That request_id already belongs to a different or subsequently edited record.');
    }
    const defaults = table === 'Deals' ? {status:'Analyzing',offerDecision:'No Offer Made Yet',logs:[],dealType:[],dispo:{photos:false,blast:false}} : table === 'Buyers' ? {status:'New Lead',notes:[],propertiesBought:0} : {status:'Open'};
    const rows = checkDb(await db.from(table).insert({...defaults,...payload,id:req.request_id,organization_id:org}).select('*'));
    if (rows.length !== 1) fail('UNEXPECTED_RESULT','The create did not return exactly one record. Verify by request_id before retrying.');
    return {record:expose(table,rows[0])};
  }
  if (!req.id || req.expected_revision === undefined) fail('INVALID_REQUEST','A record ID and expected_revision from the latest read are required.');
  const current = checkDb(await scoped(db,table,org).eq('id',req.id));
  if (current.length !== 1) fail('NOT_FOUND','Record not found in this organization.');
  const row = current[0];
  if (row.pluginRevision !== req.expected_revision) fail('CONFLICT','The record changed. Read it again and reconcile before retrying.');
  let patch;
  if (req.action === 'update') {
    if (!mutableTables.includes(table)) fail('INVALID_REQUEST','This record type cannot be updated by the plugin.');
    patch = patchSchema(table).parse(req.payload);
    if (table === 'Deals' && patch.offerDecision && patch.offerDecision !== row.offerDecision) {
      const history=row.offerDecisionTracking || [];
      if (!Array.isArray(history)) fail('INVALID_RECORD','Existing stage history needs repair.');
      patch.offerDecisionTracking=[...history,{status:patch.offerDecision,date:new Date().toISOString(),user:'DealDesk plugin'}];
    }
    // A nested buy box is a partial edit, not replacement of unrelated criteria.
    if (patch.buyBox) {
      let previous = row.buyBox || {};
      if (typeof previous === 'string') { try { previous=JSON.parse(previous); } catch { fail('INVALID_RECORD','Existing buy box needs repair before editing.'); } }
      patch.buyBox = fields.Buyers.buyBox.parse({...previous,...patch.buyBox});
    }
  } else if (req.action === 'append_note') {
    if (!recordTypes.includes(table) || !req.note) fail('INVALID_REQUEST','Notes require a deal, buyer, or agent and nonempty text.');
    const field = table === 'Deals' ? 'logs' : 'notes';
    let previous = row[field] || [];
    if (typeof previous === 'string') { try { previous=JSON.parse(previous); } catch { fail('INVALID_RECORD','Existing notes need repair before appending.'); } }
    if (!Array.isArray(previous)) fail('INVALID_RECORD','Existing notes are not an array.');
    patch = {[field]:[...previous,`${new Date().toISOString()} | DealDesk plugin | ${req.note}`]};
  } else if (req.action === 'archive') {
    if (!req.reason) fail('INVALID_REQUEST','An archive reason is required.');
    patch = {pluginArchivedAt:new Date().toISOString(),pluginArchiveReason:req.reason};
  } else {
    patch = {pluginArchivedAt:null,pluginArchiveReason:null};
  }
  if (row.pluginArchivedAt && !['restore','archive'].includes(req.action)) fail('ARCHIVED','Restore this record before editing it.');
  const rows = checkDb(await db.from(table).update(patch).eq('id',req.id).eq('organization_id',org).eq('pluginRevision',req.expected_revision).select('*'));
  if (rows.length !== 1) fail('CONFLICT','The record changed during the update. Read it again before retrying.');
  return {record:expose(table,rows[0])};
}

export function makeHandler({createClient,env=process.env}) {
  return async (req,res) => {
    res.setHeader('Cache-Control','no-store');
    if (req.method !== 'POST') return res.status(405).json({error:{code:'METHOD_NOT_ALLOWED',message:'Use POST.'}});
    const key = env.DEALDESK_PLUGIN_API_KEY;
    if (!key || key.length < 32 || key === env.DEALDESK_API_KEY || !env.DEALDESK_PLUGIN_ORGANIZATION_ID || !env.SUPABASE_SERVICE_ROLE_KEY || !env.VITE_SUPABASE_URL) return res.status(503).json({error:{code:'CONFIGURATION',message:'Plugin backend is not configured.'}});
    if (!equal(req.headers.authorization,`Bearer ${key}`)) return res.status(401).json({error:{code:'UNAUTHORIZED',message:'Authentication required.'}});
    try {
      const db = createClient(env.VITE_SUPABASE_URL,env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
      const result = await executeOperation(db,req.body,{organizationId:env.DEALDESK_PLUGIN_ORGANIZATION_ID,writes:env.DEALDESK_PLUGIN_WRITES === 'true',archive:env.DEALDESK_PLUGIN_ARCHIVE === 'true'});
      return res.json({success:true,...result});
    } catch(error) {
      const known = error instanceof DomainError;
      const code = known ? error.code : error instanceof z.ZodError ? 'INVALID_REQUEST' : 'INTERNAL_ERROR';
      const status = code === 'CONFLICT' ? 409 : code === 'NOT_FOUND' ? 404 : code === 'INTERNAL_ERROR' || code === 'DATABASE_ERROR' ? 500 : 400;
      return res.status(status).json({error:{code,message:known ? error.message : 'Request could not be processed.'}});
    }
  };
}

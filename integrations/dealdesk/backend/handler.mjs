import { randomUUID, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import {
  tables,
  recordTypes,
  mutableTables,
  bigintIdTables,
  recordId,
  fields,
  searchFields,
  searchQueryColumn,
  createSchema,
  patchSchema,
  project,
  legacyNullOrgTables,
  scopeOrgQuery,
  DomainError,
  fail,
} from '../src/domain.mjs';
import { validateZillowUrl, mapZillow, safeZillowData } from '../src/zillow.mjs';
import { executeGetDashboard, executeGetActivityFeed, executeLogActivity } from '../src/dashboard.mjs';
import { createUserDirect } from '../src/users.mjs';

const contactMoveTables = ['Buyers', 'Agents', 'Wholesalers'];
const noteFieldFor = table => (table === 'Deals' || table === 'JVDeals' ? 'logs' : table === 'OffMarketProperties' ? 'Notes' : 'notes');

const sendEmailSchema = z.object({
  recipients: z.array(z.object({ email: z.email(), name: z.string().max(300).optional() }).passthrough()).min(1).max(500),
  subject: z.string().trim().min(1).max(500),
  body: z.string().min(1).max(200000),
  fromAddress: z.email().optional(),
});

const requestSchema = z.object({
  action: z.enum([
    'read', 'create', 'update', 'delete', 'append_note', 'archive', 'restore',
    'move_deal', 'move_contact', 'send_email', 'zillow_scrape', 'gemini_comps', 'gemini_chat',
    'create_user', 'get_dashboard', 'get_activity_feed', 'log_activity',
  ]),
  table: z.enum(tables).optional(),
  id: recordId.optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
  filters: z.record(z.string(), z.union([z.string().max(1000), z.boolean(), z.number()])).optional(),
  query: z.string().max(200).optional(),
  offset: z.number().int().min(0).max(100000).default(0),
  limit: z.number().int().min(1).max(100).default(25),
  include_archived: z.boolean().default(false),
  expected_revision: z.number().int().nonnegative().optional(),
  request_id: z.uuid().optional(),
  note: z.string().trim().min(1).max(5000).optional(),
  reason: z.string().trim().min(1).max(1000).optional(),
  target_pipeline: z.enum(['mls', 'off-market', 'azre-queue', 'dfd']).optional(),
  source_table: z.enum(contactMoveTables).optional(),
  target_table: z.enum(contactMoveTables).optional(),
  url: z.string().max(2000).optional(),
  create_deal: z.boolean().optional(),
  address: z.string().max(1000).optional(),
  sqft: z.union([z.number(), z.string()]).optional(),
  beds: z.union([z.number(), z.string()]).optional(),
  baths: z.union([z.number(), z.string()]).optional(),
  message: z.string().min(1).max(20000).optional(),
  recipients: z.array(z.unknown()).optional(),
  subject: z.string().max(500).optional(),
  body: z.string().max(200000).optional(),
  fromAddress: z.string().max(320).optional(),
  // Dashboard options
  timeframe: z.enum(['today', 'week', 'month', 'year']).optional(),
  deals_added_timeframe: z.enum(['today', 'week', 'month', 'year']).optional(),
  lois_timeframe: z.enum(['today', 'week', 'month', 'year']).optional(),
  agent_texts_timeframe: z.enum(['today', 'week', 'month', 'year']).optional(),
  owner_texts_timeframe: z.enum(['today', 'week', 'month', 'year']).optional(),
  recent_deals_limit: z.number().int().min(1).max(50).optional(),
  upcoming_tasks_limit: z.number().int().min(1).max(50).optional(),
  activity_limit: z.number().int().min(1).max(50).optional(),
  include_chart: z.boolean().optional(),
  // Activity Feed options
  action_type: z.string().max(100).optional(),
  entity_type: z.string().max(100).optional(),
  entity_id: z.string().max(200).optional(),
  user_id: z.string().max(200).optional(),
  user_name: z.string().max(200).optional(),
  entity_display: z.string().max(500).optional(),
  description: z.string().max(5000).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  group_updates: z.boolean().optional(),
  sent_text_to_agent_only: z.boolean().optional(),
  since: z.string().max(100).optional(),
  // User creation options
  name: z.string().max(200).optional(),
  email: z.string().max(320).optional(),
  password: z.string().max(128).optional(),
  position: z.string().max(100).optional(),
  organization: z.string().max(200).optional(),
  grant_mcp_access: z.boolean().optional(),
  mcp_client_id: z.string().max(128).optional(),
  mcp_operational_writes: z.boolean().optional(),
}).strict();

const equal = (a, b) =>
  typeof a === 'string' &&
  typeof b === 'string' &&
  Buffer.byteLength(a) === Buffer.byteLength(b) &&
  timingSafeEqual(Buffer.from(a), Buffer.from(b));

function expose(table, row) {
  return { ...project(table, row), _revision: row.pluginRevision };
}

function checkDb(result) {
  if (result.error) {
    fail('DATABASE_ERROR', 'Database operation failed. Verify the migration and field schema; details are confined to the database.');
  }
  return result.data;
}

function scoped(db, table, org) {
  return scopeOrgQuery(db.from(table).select('*'), table, org);
}

function computeDealPipelineType(queueStatus, listingType) {
  if (queueStatus === 'In Queue') return 'azre-queue';
  return listingType === 'Off-Market' ? 'off-market' : 'mls';
}

function splitAgentName(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  return {
    agentFirstName: parts[0] || '',
    agentLastName: parts.slice(1).join(' '),
  };
}

export async function executeOperation(db, input, config) {
  const req = requestSchema.parse(input);
  const org = config.organizationId;
  if (!org) fail('CONFIGURATION', 'Plugin organization is not configured.');
  const services = config.services || {};

  const readOnlyActions = ['read', 'gemini_comps', 'gemini_chat', 'get_dashboard', 'get_activity_feed'];
  const isWrite =
    !readOnlyActions.includes(req.action) &&
    !(req.action === 'zillow_scrape' && !req.create_deal);

  if (isWrite && !config.writes) {
    fail('WRITES_DISABLED', 'Writes are disabled on the DealDesk backend.');
  }
  if (['archive', 'restore'].includes(req.action) && !config.archive) {
    fail('ARCHIVE_DISABLED', 'Archiving is disabled on the DealDesk backend.');
  }

  // --- Service Actions ---
  if (req.action === 'send_email') {
    if (!services.sendEmail) fail('SERVICE_UNAVAILABLE', 'Email service is not configured.');
    const raw = req.payload && typeof req.payload === 'object'
      ? req.payload
      : { recipients: req.recipients, subject: req.subject, body: req.body, fromAddress: req.fromAddress };
    const emailInput = sendEmailSchema.parse(raw);
    return await services.sendEmail(emailInput);
  }

  if (req.action === 'zillow_scrape') {
    if (!services.zillow) fail('IMPORT_UNAVAILABLE', 'Zillow import is not configured.');
    const rawUrl = req.url || (req.payload && req.payload.url);
    if (!rawUrl || typeof rawUrl !== 'string') fail('INVALID_REQUEST', 'A Zillow property URL is required.');
    const url = validateZillowUrl(rawUrl);
    const items = await services.zillow(url);
    if (!Array.isArray(items) || !items.length || items.some(item => item.error || item.snapshot_id)) {
      fail('IMPORT_PENDING_OR_FAILED', 'The existing importer did not return completed property data. Try again later.');
    }
    const data = safeZillowData(items);
    if (req.create_deal) {
      if (items.length !== 1) fail('AMBIGUOUS_PROPERTY', 'Importer returned multiple properties. Inspect before creation.');
      const mapped = mapZillow(items[0]);
      const created = await executeOperation(db, {
        action: 'create',
        table: 'Deals',
        request_id: req.request_id || randomUUID(),
        payload: mapped,
      }, config);
      return { ...created, url, data, saved: true };
    }
    return { url, data, saved: false };
  }

  if (req.action === 'gemini_comps') {
    if (!services.geminiComps) fail('SERVICE_UNAVAILABLE', 'Gemini comps service is not configured.');
    const p = req.payload && typeof req.payload === 'object' ? req.payload : req;
    const address = String(p.address || '').trim();
    if (!address) fail('INVALID_REQUEST', 'Address is required for AI comps generation.');
    const comps = await services.geminiComps({ address, sqft: p.sqft, beds: p.beds, baths: p.baths });
    return { comps };
  }

  if (req.action === 'gemini_chat') {
    if (!services.geminiChat) fail('SERVICE_UNAVAILABLE', 'Gemini AI search chat is not configured.');
    const p = req.payload && typeof req.payload === 'object' ? req.payload : req;
    const message = String(p.message || '').trim();
    if (!message) fail('INVALID_REQUEST', 'Message is required for AI search chat.');
    const reply = await services.geminiChat({ message });
    return { reply };
  }

  if (req.action === 'get_dashboard') {
    const raw = req.payload && typeof req.payload === 'object'
      ? req.payload
      : {
          ...(req.timeframe !== undefined ? { timeframe: req.timeframe } : {}),
          ...(req.deals_added_timeframe !== undefined ? { deals_added_timeframe: req.deals_added_timeframe } : {}),
          ...(req.lois_timeframe !== undefined ? { lois_timeframe: req.lois_timeframe } : {}),
          ...(req.agent_texts_timeframe !== undefined ? { agent_texts_timeframe: req.agent_texts_timeframe } : {}),
          ...(req.owner_texts_timeframe !== undefined ? { owner_texts_timeframe: req.owner_texts_timeframe } : {}),
          ...(req.recent_deals_limit !== undefined ? { recent_deals_limit: req.recent_deals_limit } : {}),
          ...(req.upcoming_tasks_limit !== undefined ? { upcoming_tasks_limit: req.upcoming_tasks_limit } : {}),
          ...(req.activity_limit !== undefined ? { activity_limit: req.activity_limit } : {}),
          ...(req.include_chart !== undefined ? { include_chart: req.include_chart } : {}),
        };
    return await executeGetDashboard(db, raw, org);
  }

  if (req.action === 'get_activity_feed') {
    const raw = req.payload && typeof req.payload === 'object'
      ? req.payload
      : {
          ...(input.limit !== undefined ? { limit: req.limit } : {}),
          ...(input.offset !== undefined ? { offset: req.offset } : {}),
          ...(req.action_type !== undefined ? { action_type: req.action_type } : {}),
          ...(req.entity_type !== undefined ? { entity_type: req.entity_type } : {}),
          ...(req.entity_id !== undefined ? { entity_id: req.entity_id } : {}),
          ...(req.user_id !== undefined ? { user_id: req.user_id } : {}),
          ...(req.sent_text_to_agent_only !== undefined ? { sent_text_to_agent_only: req.sent_text_to_agent_only } : {}),
          ...(req.since !== undefined ? { since: req.since } : {}),
        };
    return await executeGetActivityFeed(db, raw, org);
  }

  if (req.action === 'log_activity') {
    const raw = req.payload && typeof req.payload === 'object'
      ? req.payload
      : {
          action_type: req.action_type,
          entity_type: req.entity_type,
          entity_id: req.entity_id,
          description: req.description,
          ...(req.user_id !== undefined ? { user_id: req.user_id } : {}),
          ...(req.user_name !== undefined ? { user_name: req.user_name } : {}),
          ...(req.entity_display !== undefined ? { entity_display: req.entity_display } : {}),
          ...(req.metadata !== undefined ? { metadata: req.metadata } : {}),
          ...(req.group_updates !== undefined ? { group_updates: req.group_updates } : {}),
          ...(req.request_id !== undefined ? { request_id: req.request_id } : {}),
        };
    return await executeLogActivity(db, raw, org, { userId: 'plugin-operator', userName: 'DealDesk Plugin' });
  }

  if (req.action === 'create_user') {
    const raw = req.payload && typeof req.payload === 'object'
      ? req.payload
      : {
          name: req.name,
          email: req.email,
          password: req.password,
          ...(req.position !== undefined ? { position: req.position } : {}),
          ...(req.organization !== undefined ? { organization: req.organization } : {}),
          ...(req.grant_mcp_access !== undefined ? { grant_mcp_access: req.grant_mcp_access } : {}),
          ...(req.mcp_client_id !== undefined ? { mcp_client_id: req.mcp_client_id } : {}),
          ...(req.mcp_operational_writes !== undefined ? { mcp_operational_writes: req.mcp_operational_writes } : {}),
          ...(req.request_id !== undefined ? { request_id: req.request_id } : {}),
        };
    return await createUserDirect(db, raw, org);
  }

  // --- Workflow Move Actions ---
  if (req.action === 'move_deal') {
    if (!req.id || req.expected_revision === undefined || !req.target_pipeline) {
      fail('INVALID_REQUEST', 'id, expected_revision, and target_pipeline are required for move_deal.');
    }
    let srcTable = 'Deals';
    let rows = checkDb(await scoped(db, 'Deals', org).eq('id', req.id));
    if (rows.length !== 1) {
      rows = checkDb(await scoped(db, 'JVDeals', org).eq('id', req.id));
      srcTable = 'JVDeals';
    }
    if (rows.length !== 1) fail('NOT_FOUND', 'Deal not found in this organization.');
    const row = rows[0];
    if (row.pluginArchivedAt) fail('ARCHIVED', 'Restore this record before moving it.');
    if (row.pluginRevision !== req.expected_revision) {
      fail('CONFLICT', 'The record changed. Read it again and reconcile before retrying.');
    }
    const dstTable = req.target_pipeline === 'dfd' ? 'JVDeals' : 'Deals';
    const pipelinePatch =
      req.target_pipeline === 'dfd'
        ? { pipelineType: 'dfd' }
        : req.target_pipeline === 'azre-queue'
          ? { queueStatus: 'In Queue', pipelineType: 'azre-queue' }
          : req.target_pipeline === 'off-market'
            ? { queueStatus: 'In Pipeline', listingType: 'Off-Market', pipelineType: 'off-market' }
            : { queueStatus: 'In Pipeline', listingType: 'Listed On MLS', pipelineType: 'mls' };

    if (srcTable === dstTable) {
      const updated = checkDb(
        await db.from(dstTable)
          .update(pipelinePatch)
          .eq('id', req.id)
          .eq('organization_id', org)
          .eq('pluginRevision', req.expected_revision)
          .select('*'),
      );
      if (updated.length !== 1) fail('CONFLICT', 'The record changed during the move. Read it again before retrying.');
      return { record: expose(dstTable, updated[0]), moved_from: srcTable, moved_to: dstTable };
    }
    const { organization_id: _org, pluginRevision: _rev, pluginArchivedAt: _arch, pluginArchiveReason: _reason, ...rest } = row;
    const inserted = checkDb(
      await db.from(dstTable).insert({ ...rest, ...pipelinePatch, organization_id: org }).select('*'),
    );
    if (inserted.length !== 1) fail('UNEXPECTED_RESULT', 'Move failed inserting target deal.');
    checkDb(await db.from(srcTable).delete().eq('id', req.id).eq('organization_id', org));
    return { record: expose(dstTable, inserted[0]), moved_from: srcTable, moved_to: dstTable };
  }

  if (req.action === 'move_contact') {
    const srcTable = req.source_table || req.table;
    const dstTable = req.target_table;
    if (!req.id || req.expected_revision === undefined || !srcTable || !dstTable || srcTable === dstTable || !contactMoveTables.includes(srcTable)) {
      fail('INVALID_REQUEST', 'id, expected_revision, source_table, and distinct target_table are required for move_contact.');
    }
    const current = checkDb(await scoped(db, srcTable, org).eq('id', req.id));
    if (current.length !== 1) fail('NOT_FOUND', 'Contact not found in this organization.');
    const row = current[0];
    if (row.pluginArchivedAt) fail('ARCHIVED', 'Restore this record before moving it.');
    if (row.pluginRevision !== req.expected_revision) {
      fail('CONFLICT', 'The record changed. Read it again and reconcile before retrying.');
    }
    const prevNotes = Array.isArray(row.notes) ? row.notes : [];
    const movedNote = `${new Date().toISOString()} | DealDesk plugin | Moved from ${srcTable}.`;
    const common = {
      id: randomUUID(),
      organization_id: org,
      name: row.name || 'Unknown',
      phone: row.phone || null,
      email: row.email || null,
      photo: row.photo || null,
      notes: [movedNote, ...prevNotes],
      subscriptionStatus: row.subscriptionStatus || 'Subscribed',
    };
    const targetPayload =
      dstTable === 'Buyers'
        ? {
            ...common,
            companyName: row.companyName || row.brokerage || '',
            status: 'New Lead',
            propertiesBought: 0,
            buyBox: { locations: '', minPrice: 0, maxPrice: 0, propertyTypes: [], minBedrooms: 0, minBathrooms: 0, notes: '' },
          }
        : dstTable === 'Agents'
          ? {
              ...common,
              ...splitAgentName(common.name),
              brokerage: row.companyName || row.brokerage || '',
            }
          : {
              ...common,
              companyName: row.companyName || row.brokerage || '',
              status: 'New',
              properties: [],
              closedDealIds: [],
            };

    const inserted = checkDb(await db.from(dstTable).insert(targetPayload).select('*'));
    if (inserted.length !== 1) fail('UNEXPECTED_RESULT', 'Failed moving contact.');
    checkDb(await db.from(srcTable).delete().eq('id', req.id).eq('organization_id', org));
    return { record: expose(dstTable, inserted[0]), moved_from: srcTable, moved_to: dstTable, deleted_source_id: req.id };
  }

  // --- Standard Table Actions ---
  const table = req.table;
  if (!table) fail('INVALID_REQUEST', 'table is required for this action.');
  const isBigintPk = bigintIdTables.includes(table);

  if (req.action === 'read') {
    let q = scoped(db, table, org);
    if (req.id !== undefined) q = q.eq('id', req.id);
    if (!req.include_archived) q = q.is('pluginArchivedAt', null);
    for (const [key, value] of Object.entries(req.filters || {})) {
      if (!searchFields[table]?.includes(key)) fail('INVALID_FILTER', 'Unsupported filter.');
      q = q.eq(key, value);
    }
    if (req.query) {
      // Do not interpolate user text into PostgREST's OR/filter grammar.
      const column = searchQueryColumn[table] || 'name';
      q = q.ilike(column, `%${req.query.replace(/[\\%_]/g, '\\$&')}%`);
    }
    const rows = checkDb(await q.order('id', { ascending: true }).range(req.offset, req.offset + req.limit));
    return {
      records: rows.slice(0, req.limit).map(r => expose(table, r)),
      next_offset: rows.length > req.limit ? req.offset + req.limit : null,
    };
  }

  if (req.action === 'create') {
    if (!mutableTables.includes(table)) fail('INVALID_REQUEST', 'Unsupported table for creation.');
    if (!isBigintPk && !req.request_id) {
      fail('INVALID_REQUEST', 'Creation requires an allowed record type and a UUID request_id.');
    }
    const payload = createSchema(table).parse(req.payload || {});
    if (table === 'PluginTasks') {
      const target = checkDb(await scoped(db, payload.entityType, org).eq('id', payload.entityId).is('pluginArchivedAt', null));
      if (target.length !== 1) fail('NOT_FOUND', 'The task target was not found in this organization.');
    }
    if (!isBigintPk && req.request_id) {
      const existing = checkDb(await scoped(db, table, org).eq('id', req.request_id));
      if (existing.length) {
        if (Object.entries(payload).every(([k, v]) => JSON.stringify(project(table, existing[0])[k]) === JSON.stringify(v))) {
          return { record: expose(table, existing[0]), replayed: true };
        }
        fail('REQUEST_ID_REUSED', 'That request_id already belongs to a different or subsequently edited record.');
      }
    }

    let defaults = {};
    if (table === 'Deals') {
      defaults = {
        status: 'Analyzing',
        offerDecision: 'No Offer Made Yet',
        logs: [],
        dealType: [],
        dispo: { photos: false, blast: false },
        ...(payload.queueStatus !== undefined
          ? { pipelineType: computeDealPipelineType(payload.queueStatus, payload.listingType || 'Listed On MLS') }
          : {}),
      };
    } else if (table === 'JVDeals') {
      defaults = {
        offerDecision: 'Available',
        pipelineType: payload.pipelineType || 'dfd',
        logs: [],
        dealType: [],
        dispo: { photos: false, blast: false },
      };
    } else if (table === 'Buyers') {
      defaults = { status: 'New Lead', subscriptionStatus: 'Subscribed', notes: [], propertiesBought: 0 };
    } else if (table === 'Agents') {
      defaults = {
        ...(payload.name && !payload.agentFirstName ? splitAgentName(payload.name) : {}),
        subscriptionStatus: 'Subscribed',
        notes: [],
        closedDealIds: [],
      };
    } else if (table === 'Wholesalers') {
      defaults = { status: 'New', subscriptionStatus: 'Subscribed', notes: [], properties: [], closedDealIds: [] };
    } else if (table === 'OffMarketProperties') {
      defaults = { Notes: [], 'Off Market List': [], Interested: false, "I'm Not Interested": false, 'Owner Not Interested': false, Trash: false, 'Text Message Sent': false, 'Owner Called': false };
    } else if (table === 'PluginTasks') {
      defaults = { status: 'Open' };
    }

    const rowToInsert = isBigintPk
      ? { ...defaults, ...payload, organization_id: org }
      : { ...defaults, ...payload, id: req.request_id, organization_id: org };

    const rows = checkDb(await db.from(table).insert(rowToInsert).select('*'));
    if (rows.length !== 1) fail('UNEXPECTED_RESULT', 'The create did not return exactly one record. Verify by request_id before retrying.');
    return { record: expose(table, rows[0]) };
  }

  if (req.action === 'delete') {
    if (req.id === undefined) fail('INVALID_REQUEST', 'A record ID is required for deletion.');
    const current = checkDb(await scoped(db, table, org).eq('id', req.id));
    if (current.length !== 1) fail('NOT_FOUND', 'Record not found in this organization.');
    if (req.expected_revision !== undefined && current[0].pluginRevision !== req.expected_revision) {
      fail('CONFLICT', 'The record changed. Read it again and reconcile before retrying.');
    }
    let delQ = scopeOrgQuery(db.from(table).delete().eq('id', req.id), table, org);
    if (req.expected_revision !== undefined) delQ = delQ.eq('pluginRevision', req.expected_revision);
    checkDb(await delQ);
    return { deleted: true, id: current[0].id, table };
  }

  if (req.id === undefined || req.expected_revision === undefined) {
    fail('INVALID_REQUEST', 'A record ID and expected_revision from the latest read are required.');
  }
  const current = checkDb(await scoped(db, table, org).eq('id', req.id));
  if (current.length !== 1) fail('NOT_FOUND', 'Record not found in this organization.');
  const row = current[0];
  if (row.pluginRevision !== req.expected_revision) {
    fail('CONFLICT', 'The record changed. Read it again and reconcile before retrying.');
  }

  let patch;
  if (req.action === 'update') {
    if (!mutableTables.includes(table)) fail('INVALID_REQUEST', 'This record type cannot be updated by the plugin.');
    patch = patchSchema(table).parse(req.payload);
    if (table === 'Deals') {
      if (['dfd', 'jv'].includes(row.pipelineType) && patch.queueStatus) {
        fail('INVALID_REQUEST', 'JV/DFD deals cannot be routed through AZRE Queue.');
      }
      if ((patch.queueStatus || patch.listingType) && !['dfd', 'jv'].includes(row.pipelineType)) {
        const qs = patch.queueStatus || row.queueStatus || (row.pipelineType === 'azre-queue' ? 'In Queue' : 'In Pipeline');
        const lt = patch.listingType || row.listingType || 'Listed On MLS';
        patch.pipelineType = computeDealPipelineType(qs, lt);
      }
    }
    if ((table === 'Deals' || table === 'JVDeals') && patch.offerDecision && patch.offerDecision !== row.offerDecision) {
      const history = row.offerDecisionTracking || [];
      if (!Array.isArray(history)) fail('INVALID_RECORD', 'Existing stage history needs repair.');
      patch.offerDecisionTracking = [...history, { status: patch.offerDecision, date: new Date().toISOString(), user: 'DealDesk plugin' }];
    }
    if (table === 'Agents' && patch.name && !patch.agentFirstName) {
      Object.assign(patch, splitAgentName(patch.name));
    }
    // A nested buy box is a partial edit, not replacement of unrelated criteria.
    if (patch.buyBox) {
      let previous = row.buyBox || {};
      if (typeof previous === 'string') {
        try { previous = JSON.parse(previous); } catch { fail('INVALID_RECORD', 'Existing buy box needs repair before editing.'); }
      }
      patch.buyBox = fields.Buyers.buyBox.parse({ ...previous, ...patch.buyBox });
    }
  } else if (req.action === 'append_note') {
    if (!recordTypes.includes(table) || !req.note) {
      fail('INVALID_REQUEST', 'Notes require a valid record type and nonempty text.');
    }
    const field = noteFieldFor(table);
    let previous = row[field] || [];
    if (typeof previous === 'string') {
      try { previous = JSON.parse(previous); } catch { fail('INVALID_RECORD', 'Existing notes need repair before appending.'); }
    }
    if (!Array.isArray(previous)) fail('INVALID_RECORD', 'Existing notes are not an array.');
    patch = { [field]: [`${new Date().toISOString()} | DealDesk plugin | ${req.note}`, ...previous] };
  } else if (req.action === 'archive') {
    if (!req.reason) fail('INVALID_REQUEST', 'An archive reason is required.');
    patch = { pluginArchivedAt: new Date().toISOString(), pluginArchiveReason: req.reason };
  } else {
    patch = { pluginArchivedAt: null, pluginArchiveReason: null };
  }

  if (row.pluginArchivedAt && !['restore', 'archive'].includes(req.action)) {
    fail('ARCHIVED', 'Restore this record before editing it.');
  }
  if (row.organization_id == null && org === 'org_azre_00001' && legacyNullOrgTables.has(table)) {
    patch = { ...patch, organization_id: org };
  }
  const rows = checkDb(
    await scopeOrgQuery(db.from(table).update(patch).eq('id', req.id), table, org)
      .eq('pluginRevision', req.expected_revision)
      .select('*'),
  );
  if (rows.length !== 1) fail('CONFLICT', 'The record changed during the update. Read it again before retrying.');
  return { record: expose(table, rows[0]) };
}

export function makeHandler({ createClient, env = process.env, services = {} }) {
  return async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    if (req.method !== 'POST') return res.status(405).json({ error: { code: 'METHOD_NOT_ALLOWED', message: 'Use POST.' } });
    const keys = [env.DEALDESK_PLUGIN_API_KEY, env.DEALDESK_PLUGIN_API_KEY2].filter(
      key => typeof key === 'string' && key.length >= 32 && key !== env.DEALDESK_API_KEY,
    );
    if (!keys.length || !env.DEALDESK_PLUGIN_ORGANIZATION_ID || !env.SUPABASE_SERVICE_ROLE_KEY || !env.VITE_SUPABASE_URL) {
      return res.status(503).json({ error: { code: 'CONFIGURATION', message: 'Plugin backend is not configured.' } });
    }
    if (!keys.some(key => equal(req.headers.authorization, `Bearer ${key}`))) {
      return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Authentication required.' } });
    }
    try {
      const db = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
      const result = await executeOperation(db, req.body, {
        organizationId: env.DEALDESK_PLUGIN_ORGANIZATION_ID,
        writes: env.DEALDESK_PLUGIN_WRITES === 'true',
        archive: env.DEALDESK_PLUGIN_ARCHIVE === 'true',
        services,
      });
      return res.json({ success: true, ...result });
    } catch (error) {
      const known = error instanceof DomainError;
      const code = known ? error.code : error instanceof z.ZodError ? 'INVALID_REQUEST' : 'INTERNAL_ERROR';
      const status =
        code === 'CONFLICT' || code === 'DUPLICATE' ? 409
          : code === 'NOT_FOUND' ? 404
            : code === 'WRITES_DISABLED' || code === 'ARCHIVE_DISABLED' ? 403
              : code === 'SERVICE_UNAVAILABLE' ? 503
                : code === 'INTERNAL_ERROR' || code === 'DATABASE_ERROR' ? 500
                  : 400;
      return res.status(status).json({ error: { code, message: known ? error.message : 'Request could not be processed.' } });
    }
  };
}

import { z } from 'zod';
import { validatePhotos, photoUrl } from './photos.mjs';
import { randomUUID } from 'node:crypto';
import {
  fields,
  id,
  numericId,
  recordId,
  workspaceTables,
  recordTypes,
  searchFields,
  searchQueryColumn,
  createSchema,
  patchSchema,
  project,
  DomainError,
  fail,
} from './domain.mjs';
import {
  offMarketPropertyCreateSchema,
  offMarketPropertyPatchSchema,
  offMarketTemplatesPatchSchema,
} from './offmarket.mjs';

const text = z.string().trim().min(1).max(1000);
const date = z.iso.date().nullable();

export const dealFields = {
  ...fields.Deals,
  queueStatus: z.enum(['In Queue', 'In Pipeline']).describe('Queue placement. In Queue routes to AZRE Queue; In Pipeline routes by listingType. Backend synchronizes pipelineType atomically.'),
  offerDecision: fields.Deals.offerDecision.describe('Pipeline Status. Use this field for the pipeline stage, not status.'),
  status: text.describe('Separate/general DealDesk status; NOT Pipeline Status.'),
  offerPrice: fields.Deals.offerPrice.describe("AZRE's current offer price."),
  originalAskingPrice: z.number().int().min(0).max(2147483647),
  reducedAskingPrice: z.number().int().min(0).max(2147483647),
  negotiatedAskingPrice: z.number().int().min(0).max(2147483647).describe('Seller counter/negotiated asking position.'),
  propertyType: z.enum(['Single Family Residential', 'Multi-Family Residential', 'Commercial', 'Land']),
  dealType: z.array(z.enum(['Renovation', 'Rental', 'New Construction', 'Multi-Family'])).max(4),
  interestLevel: z.enum(['High', 'Mild', 'Not Interested']),
  contactStatus: z.enum([
    'Agent Not Contacted Yet',
    'Sent LOI Email',
    'Sent Initial Text Message',
    'First Call, No Answer',
    'Spoke With Agent',
    'Waiting To Hear Back',
    'Offer Declined',
    'Offer Accepted',
  ]),
  sqft: z.number().int().min(0).max(1e9),
  lotSqft: z.number().int().min(0).max(1e10),
  zoning: text,
  listingType: z.enum(['Listed On MLS', 'Off-Market']),
  listingStatus: text,
  forSaleBy: text,
  dateListed: date,
  inspectionDate: date,
  emdDate: date,
  underContractDate: date,
  closedDate: date,
  declinedDate: date,
};

export const jvDealFields = {
  ...dealFields,
  offerDecision: fields.JVDeals.offerDecision,
  pipelineType: fields.JVDeals.pipelineType,
};

export const buyerFields = {
  ...fields.Buyers,
  subscriptionStatus: z.enum(['Subscribed', 'Unsubscribed']).describe('Email/SMS subscription preference. Defaults to Subscribed.'),
  website: text,
  socialMediaLinks: z.array(text).max(20),
};

export const agentFields = {
  ...fields.Agents,
};

export const wholesalerFields = {
  ...fields.Wholesalers,
};

export const taskFields = {
  title: text,
  description: z.string().max(5000),
  dueDate: z.union([z.iso.date(), z.iso.datetime({ offset: true })]),
  assignee: text,
  status: z.enum(['Open', 'Completed']),
  priority: z.enum(['Low', 'Normal', 'High', 'Urgent']),
};

const optional = shape => Object.fromEntries(Object.entries(shape).map(([key, schema]) => [key, schema.optional()]));
export const dealCreate = z.object({ ...optional(dealFields), address: dealFields.address }).strict();
export const dealPatch = z.object(optional(dealFields)).strict().refine(v => Object.keys(v).length > 0, 'Supply at least one field.');
export const jvDealCreate = z.object({ ...optional(jvDealFields), address: jvDealFields.address }).strict();
export const jvDealPatch = z.object(optional(jvDealFields)).strict().refine(v => Object.keys(v).length > 0, 'Supply at least one field.');
export const buyerCreate = z.object({ ...optional(buyerFields), name: buyerFields.name }).strict();
export const buyerPatch = z.object(optional(buyerFields)).strict().refine(v => Object.keys(v).length > 0, 'Supply at least one field.');
export const agentCreate = z.object({ ...optional(agentFields), name: agentFields.name }).strict();
export const agentPatch = z.object(optional(agentFields)).strict().refine(v => Object.keys(v).length > 0, 'Supply at least one field.');
export const wholesalerCreate = z.object({ ...optional(wholesalerFields), name: wholesalerFields.name }).strict();
export const wholesalerPatch = z.object(optional(wholesalerFields)).strict().refine(v => Object.keys(v).length > 0, 'Supply at least one field.');

const revision = z.number().int().nonnegative().describe('Current _revision from the most recent read. Reread and reconcile on CONFLICT.');
const buyerRevision = z.number().int().nonnegative().describe('Current _revision from get_buyer. Reread and reconcile on CONFLICT.');

const crmReadFilter = table =>
  Object.fromEntries(
    (searchFields[table] || []).map(k => [
      k,
      ['doNotCall', 'investorFriendly', 'agreedToSend', 'unread', 'is_default', 'Interested', "I'm Not Interested", 'Owner Not Interested', 'Trash', 'Text Message Sent', 'Owner Called'].includes(k)
        ? z.boolean().optional()
        : z.string().max(1000).optional(),
    ]),
  );

export const workspaceReadTools = [
  {
    name: 'search_jv_deals',
    description: 'Search JV/DFD deals in JVDeals. query searches address; filters are exact matches. Follow next_offset for complete results.',
    schema: z.object({
      query: z.string().max(200).optional(),
      filters: z.object(crmReadFilter('JVDeals')).strict().optional(),
      offset: z.number().int().min(0).max(100000).default(0),
      limit: z.number().int().min(1).max(100).default(25),
      include_archived: z.boolean().default(false),
    }).strict(),
    write: false,
  },
  {
    name: 'get_jv_deal',
    description: 'Read one JV/DFD deal from JVDeals by deal_id, including its _revision.',
    schema: z.object({ deal_id: id }).strict(),
    write: false,
  },
  {
    name: 'search_wholesalers',
    description: 'Search wholesalers in the configured DealDesk organization. query searches name; filters are exact matches.',
    schema: z.object({
      query: z.string().max(200).optional(),
      filters: z.object(crmReadFilter('Wholesalers')).strict().optional(),
      offset: z.number().int().min(0).max(100000).default(0),
      limit: z.number().int().min(1).max(100).default(25),
      include_archived: z.boolean().default(false),
    }).strict(),
    write: false,
  },
  {
    name: 'get_wholesaler',
    description: 'Read one wholesaler record by wholesaler_id, including its _revision.',
    schema: z.object({ wholesaler_id: id }).strict(),
    write: false,
  },
  {
    name: 'search_workspace_records',
    description: 'Search any DealDesk workspace table (Brokerages, Contacts, EmailLists, Campaigns, EmailTemplates, OfferTemplates, sender_emails, activity_logs, InboxMessages, MarketData, Integrations, JVDeals, Wholesalers, OffMarketOfferTextMessageGenerator). Sensitive credentials are omitted.',
    schema: z.object({
      table: z.enum(workspaceTables),
      query: z.string().max(200).optional(),
      filters: z.record(z.string(), z.union([z.string().max(1000), z.boolean(), z.number()])).optional(),
      offset: z.number().int().min(0).max(100000).default(0),
      limit: z.number().int().min(1).max(100).default(25),
      include_archived: z.boolean().default(false),
    }).strict(),
    write: false,
  },
  {
    name: 'get_workspace_record',
    description: 'Read one workspace record by table and record_id, including _revision.',
    schema: z.object({
      table: z.enum(workspaceTables),
      record_id: recordId,
    }).strict(),
    write: false,
  },
];

export const serviceTools = [
  {
    name: 'send_email',
    description: 'Send single or bulk HTML email via the configured AWS SES integration on behalf of DealDesk.',
    schema: z.object({
      recipients: z.array(z.object({ email: z.email(), name: z.string().max(300).optional() }).passthrough()).min(1).max(500),
      subject: z.string().trim().min(1).max(500),
      body: z.string().min(1).max(200000),
      fromAddress: z.email().optional(),
      request_id: z.uuid().optional(),
    }).strict(),
    write: true,
    destructive: true,
  },
  {
    name: 'generate_ai_comps',
    description: 'Run Gemini grounded comparable sales search for a property address (read-only; does not write to database).',
    schema: z.object({
      address: text,
      sqft: z.union([z.number().finite().min(0).max(1e9), z.string().max(50)]).optional(),
      beds: z.union([z.number().finite().min(0).max(100), z.string().max(50)]).optional(),
      baths: z.union([z.number().finite().min(0).max(100), z.string().max(50)]).optional(),
    }).strict(),
    write: false,
  },
  {
    name: 'ai_search_chat',
    description: 'Ask the Gemini web-grounded AI search assistant a question (read-only; does not modify database records).',
    schema: z.object({
      message: z.string().trim().min(1).max(20000),
    }).strict(),
    write: false,
  },
];

export const operationalTools = [
  // Deals
  {
    name: 'add_deal_photos',
    description: 'Append verified Zillow CDN photo URLs to the existing gallery, preserving order and existing photos. Exact URLs are deduplicated. Requires the current deal revision; no deletion. Maximum 10 images, 8 MiB each.',
    schema: z.object({
      deal_id: id,
      photo_urls: z.array(z.string().max(2048).refine(v => { try { photoUrl(v); return true; } catch { return false; } }, 'Use a direct photos.zillowstatic.com image URL.')).min(1).max(10),
      expected_revision: revision,
      request_id: z.uuid().optional(),
    }).strict(),
  },
  {
    name: 'create_deal',
    description: 'Create an AZRE acquisition opportunity using only known facts. offerDecision is Pipeline Status and defaults to No Offer Made Yet. Address/MLS duplicates return DUPLICATE with existing records. Defaults queueStatus to In Pipeline; use In Queue for AZRE Queue.',
    schema: z.object({ fields: dealCreate, request_id: z.uuid().optional().describe('Optional idempotency UUID; reuse on retries.') }).strict(),
  },
  {
    name: 'update_deal',
    description: 'PATCH an existing deal after get_deal. Only supplied fields change; a stale expected_revision returns CONFLICT. offerDecision = Pipeline Status; status is separate/general status; offerPrice = AZRE offer; negotiatedAskingPrice = seller counter. queueStatus controls queue placement; pipelineType is derived automatically.',
    schema: z.object({ deal_id: id, expected_revision: revision, fields: dealPatch }).strict(),
  },
  {
    name: 'update_offer',
    description: 'Update a deal’s recorded offer and negotiation fields on Deals while maintaining offerDecisionTracking.',
    schema: z.object({
      deal_id: id,
      expected_revision: revision,
      fields: z.object(Object.fromEntries(['offerPrice', 'offerDecision', 'negotiatedAskingPrice', 'desiredWholesaleProfit'].map(k => [k, dealFields[k].optional()]))).strict().refine(v => Object.keys(v).length > 0),
    }).strict(),
  },
  {
    name: 'add_deal_note',
    description: 'Append a timestamped note to deal logs without replacing history. Concurrent appends are serialized.',
    schema: z.object({ deal_id: id, body: z.string().trim().min(1).max(5000), category: z.string().trim().min(1).max(80).optional(), request_id: z.uuid().optional() }).strict(),
  },
  {
    name: 'delete_deal',
    description: 'Permanently delete a deal from Deals or JVDeals within the organization.',
    schema: z.object({ deal_id: id, expected_revision: revision.optional(), request_id: z.uuid().optional() }).strict(),
    destructive: true,
  },
  {
    name: 'move_deal',
    description: 'Move a deal between pipelines (mls, off-market, azre-queue, or dfd/JVDeals).',
    schema: z.object({ deal_id: id, target_pipeline: z.enum(['mls', 'off-market', 'azre-queue', 'dfd']), expected_revision: revision, request_id: z.uuid().optional() }).strict(),
  },

  // JVDeals
  {
    name: 'create_jv_deal',
    description: 'Create a JV / Direct-From-Distributor deal in JVDeals.',
    schema: z.object({ fields: jvDealCreate, request_id: z.uuid().optional() }).strict(),
  },
  {
    name: 'update_jv_deal',
    description: 'PATCH an existing JV/DFD deal in JVDeals after get_jv_deal.',
    schema: z.object({ deal_id: id, expected_revision: revision, fields: jvDealPatch }).strict(),
  },
  {
    name: 'add_jv_deal_note',
    description: 'Append a timestamped note to a JVDeal record without replacing history.',
    schema: z.object({ deal_id: id, body: z.string().trim().min(1).max(5000), category: z.string().trim().min(1).max(80).optional(), request_id: z.uuid().optional() }).strict(),
  },
  {
    name: 'delete_jv_deal',
    description: 'Permanently delete a deal from JVDeals.',
    schema: z.object({ deal_id: id, expected_revision: revision.optional(), request_id: z.uuid().optional() }).strict(),
    destructive: true,
  },

  // Buyers
  {
    name: 'create_buyer',
    description: 'Create an AZRE buyer record and optional buy-box criteria. Duplicate email, phone, or un-emailed name returns DUPLICATE with existing records.',
    schema: z.object({ fields: buyerCreate, request_id: z.uuid().optional().describe('Optional idempotency UUID; reuse on retries.') }).strict(),
  },
  {
    name: 'update_buyer',
    description: 'PATCH an existing buyer after get_buyer. Only supplied fields change; supplied buyBox keys are merged with existing buy-box criteria without wiping unspecified bounds. A stale expected_revision returns CONFLICT.',
    schema: z.object({ buyer_id: id, expected_revision: buyerRevision, fields: buyerPatch }).strict(),
  },
  {
    name: 'add_buyer_note',
    description: 'Append a timestamped note to a buyer record without replacing existing note history.',
    schema: z.object({ buyer_id: id, body: z.string().trim().min(1).max(5000), category: z.string().trim().min(1).max(80).optional(), request_id: z.uuid().optional() }).strict(),
  },
  {
    name: 'delete_buyer',
    description: 'Permanently delete a buyer record.',
    schema: z.object({ buyer_id: id, expected_revision: buyerRevision.optional(), request_id: z.uuid().optional() }).strict(),
    destructive: true,
  },

  // Agents
  {
    name: 'create_agent',
    description: 'Create an AZRE agent record.',
    schema: z.object({ fields: agentCreate, request_id: z.uuid().optional() }).strict(),
  },
  {
    name: 'update_agent',
    description: 'PATCH an existing agent record after get_agent.',
    schema: z.object({ agent_id: id, expected_revision: revision, fields: agentPatch }).strict(),
  },
  {
    name: 'add_agent_note',
    description: 'Append a timestamped note to an agent record without replacing existing note history.',
    schema: z.object({ agent_id: id, body: z.string().trim().min(1).max(5000), category: z.string().trim().min(1).max(80).optional(), request_id: z.uuid().optional() }).strict(),
  },
  {
    name: 'delete_agent',
    description: 'Permanently delete an agent record.',
    schema: z.object({ agent_id: id, expected_revision: revision.optional(), request_id: z.uuid().optional() }).strict(),
    destructive: true,
  },

  // Wholesalers
  {
    name: 'create_wholesaler',
    description: 'Create an AZRE wholesaler record.',
    schema: z.object({ fields: wholesalerCreate, request_id: z.uuid().optional() }).strict(),
  },
  {
    name: 'update_wholesaler',
    description: 'PATCH an existing wholesaler record after get_wholesaler.',
    schema: z.object({ wholesaler_id: id, expected_revision: revision, fields: wholesalerPatch }).strict(),
  },
  {
    name: 'add_wholesaler_note',
    description: 'Append a timestamped note to a wholesaler record without replacing existing note history.',
    schema: z.object({ wholesaler_id: id, body: z.string().trim().min(1).max(5000), category: z.string().trim().min(1).max(80).optional(), request_id: z.uuid().optional() }).strict(),
  },
  {
    name: 'delete_wholesaler',
    description: 'Permanently delete a wholesaler record.',
    schema: z.object({ wholesaler_id: id, expected_revision: revision.optional(), request_id: z.uuid().optional() }).strict(),
    destructive: true,
  },

  // Move contact
  {
    name: 'move_contact',
    description: 'Move a contact between Buyers, Agents, and Wholesalers, preserving contact info and notes.',
    schema: z.object({
      contact_id: id,
      source_table: z.enum(['Buyers', 'Agents', 'Wholesalers']),
      target_table: z.enum(['Buyers', 'Agents', 'Wholesalers']),
      expected_revision: revision,
      request_id: z.uuid().optional(),
    }).strict(),
  },

  // Off-Market Scouter CRUD
  {
    name: 'create_off_market_property',
    description: 'Create a property record in OffMarketProperties.',
    schema: z.object({ fields: offMarketPropertyCreateSchema, request_id: z.uuid().optional() }).strict(),
  },
  {
    name: 'update_off_market_property',
    description: 'PATCH an Off-Market Scouter property in OffMarketProperties using its numeric property_id and _revision.',
    schema: z.object({ property_id: numericId, expected_revision: revision, fields: offMarketPropertyPatchSchema }).strict(),
  },
  {
    name: 'delete_off_market_property',
    description: 'Permanently delete a property from OffMarketProperties.',
    schema: z.object({ property_id: numericId, expected_revision: revision.optional(), request_id: z.uuid().optional() }).strict(),
    destructive: true,
  },
  {
    name: 'update_off_market_templates',
    description: 'Update or create the saved Off-Market SMS offer text message templates.',
    schema: z.object({ fields: offMarketTemplatesPatchSchema, request_id: z.uuid().optional() }).strict(),
  },

  // Tasks
  {
    name: 'create_task',
    description: 'Create an operational task in PluginTasks, associated with an existing AZRE deal, JVDeal, buyer, agent, or wholesaler. Retrieve via search_tasks.',
    schema: z.object({ fields: z.object({ ...optional(taskFields), title: taskFields.title, entityType: z.enum(['Deals', 'JVDeals', 'Buyers', 'Agents', 'Wholesalers']), entityId: id, dueDate: taskFields.dueDate }).strict(), request_id: z.uuid().optional() }).strict(),
  },
  {
    name: 'update_task',
    description: 'PATCH a task after search_tasks using its current _revision. Only supplied fields change. Set status to Completed to complete it.',
    schema: z.object({ task_id: z.uuid(), expected_revision: revision, fields: z.object(optional(taskFields)).strict().refine(v => Object.keys(v).length > 0) }).strict(),
  },
  {
    name: 'delete_task',
    description: 'Permanently delete a task from PluginTasks.',
    schema: z.object({ task_id: z.uuid(), expected_revision: revision.optional(), request_id: z.uuid().optional() }).strict(),
    destructive: true,
  },

  // Generic Note + Archive / Restore
  {
    name: 'create_note',
    description: 'Append one internal note to Deals, JVDeals, Buyers, Agents, or Wholesalers.',
    schema: z.object({
      record_type: z.enum(['Deals', 'JVDeals', 'Buyers', 'Agents', 'Wholesalers']),
      record_id: id,
      text: z.string().trim().min(1).max(5000),
      category: z.string().trim().min(1).max(80).optional(),
      request_id: z.uuid().optional(),
    }).strict(),
  },
  {
    name: 'archive_record',
    description: 'Reversibly archive a DealDesk record so it is hidden from default searches.',
    schema: z.object({ record_type: z.enum(recordTypes), record_id: recordId, reason: z.string().trim().min(1).max(1000), expected_revision: revision, request_id: z.uuid().optional() }).strict(),
    destructive: true,
  },
  {
    name: 'restore_record',
    description: 'Restore a previously archived DealDesk record.',
    schema: z.object({ record_type: z.enum(recordTypes), record_id: recordId, expected_revision: revision, request_id: z.uuid().optional() }).strict(),
  },

  // Workspace tables CRUD (Brokerages, Contacts, EmailLists, Campaigns, EmailTemplates, OfferTemplates, sender_emails, activity_logs, InboxMessages, MarketData, Integrations, etc.)
  {
    name: 'create_workspace_record',
    description: 'Create a record in any DealDesk CRM workspace table (Brokerages, Contacts, EmailLists, Campaigns, EmailTemplates, OfferTemplates, sender_emails, activity_logs, InboxMessages, MarketData, Integrations, JVDeals, Wholesalers).',
    schema: z.object({ table: z.enum(workspaceTables), fields: z.record(z.string(), z.unknown()), request_id: z.uuid().optional() }).strict(),
  },
  {
    name: 'update_workspace_record',
    description: 'PATCH a record in any DealDesk CRM workspace table using its current _revision.',
    schema: z.object({ table: z.enum(workspaceTables), record_id: recordId, expected_revision: revision, fields: z.record(z.string(), z.unknown()) }).strict(),
  },
  {
    name: 'delete_workspace_record',
    description: 'Permanently delete a record from any DealDesk CRM workspace table.',
    schema: z.object({ table: z.enum(workspaceTables), record_id: recordId, expected_revision: revision.optional(), request_id: z.uuid().optional() }).strict(),
    destructive: true,
  },
];

export async function executeWorkspaceRead(db, name, input, organizationId) {
  const tool = workspaceReadTools.find(t => t.name === name);
  if (!tool) fail('UNKNOWN_TOOL', 'Unknown workspace tool.');
  const args = tool.schema.parse(input);
  const table =
    name === 'search_jv_deals' || name === 'get_jv_deal'
      ? 'JVDeals'
      : name === 'search_wholesalers' || name === 'get_wholesaler'
        ? 'Wholesalers'
        : args.table;

  const expose = row => {
    const { organization_id, pluginRevision, pluginArchiveReason, supabaseKey, twilioAuthToken, mlsApiKey, ...rest } = row;
    return { ...rest, ...project(table, row), _revision: pluginRevision };
  };

  let q = db.from(table).select('*').eq('organization_id', organizationId);
  if (name.startsWith('get_')) {
    const lookupId = args.deal_id ?? args.wholesaler_id ?? args.record_id;
    const { data, error } = await q.eq('id', lookupId);
    if (error) fail('DATABASE_ERROR', 'Database operation failed.');
    if (!data || data.length !== 1) fail('NOT_FOUND', 'Record not found.');
    return { record: expose(data[0]) };
  }
  if (!args.include_archived) q = q.is('pluginArchivedAt', null);
  for (const [key, value] of Object.entries(args.filters || {})) {
    if (!searchFields[table]?.includes(key)) fail('INVALID_FILTER', `Unsupported filter "${key}" for ${table}.`);
    if (value !== undefined) q = q.eq(key, value);
  }
  if (args.query) {
    const column = searchQueryColumn[table] || 'name';
    q = q.ilike(column, `%${args.query.replace(/[\\%_]/g, '\\$&')}%`);
  }
  const { data, error } = await q.order('id', { ascending: true }).range(args.offset, args.offset + args.limit);
  if (error) fail('DATABASE_ERROR', 'Database operation failed.');
  const rows = data || [];
  return {
    records: rows.slice(0, args.limit).map(expose),
    next_offset: rows.length > args.limit ? args.offset + args.limit : null,
  };
}

function inferTable(name, args) {
  if (name === 'move_deal' || name === 'delete_deal') return 'Deals';
  if (name === 'move_contact') return args.target_table;
  if (name.includes('jv_deal')) return 'JVDeals';
  if (name.includes('wholesaler')) return 'Wholesalers';
  if (name.includes('off_market_property')) return 'OffMarketProperties';
  if (name.includes('off_market_templates')) return 'OffMarketOfferTextMessageGenerator';
  if (name.includes('task')) return 'PluginTasks';
  if (name.includes('buyer')) return 'Buyers';
  if (name.includes('agent')) return 'Agents';
  if (name === 'create_note' || name === 'archive_record' || name === 'restore_record') return args.record_type;
  if (name.includes('workspace_record')) return args.table;
  return 'Deals';
}

export async function mutate(db, name, input, identity, source = name) {
  const tool = operationalTools.find(t => t.name === name);
  if (!tool) fail('TOOL_UNAVAILABLE', 'This mutation is unavailable.');
  const args = tool.schema.parse(input);

  let rpcTool = name;
  let rpcSource = source;
  let rpcId =
    args.deal_id ??
    args.buyer_id ??
    args.agent_id ??
    args.wholesaler_id ??
    args.contact_id ??
    args.property_id ??
    args.task_id ??
    args.record_id ??
    args.request_id ??
    randomUUID();
  let patch = { ...(args.fields || {}) };
  let rpcNote = args.body ?? null;

  if (name === 'update_offer') {
    rpcTool = 'update_deal';
    rpcSource = source || 'update_offer';
  } else if (name === 'create_note') {
    rpcTool =
      args.record_type === 'JVDeals'
        ? 'add_jv_deal_note'
        : args.record_type === 'Buyers'
          ? 'add_buyer_note'
          : args.record_type === 'Agents'
            ? 'add_agent_note'
            : args.record_type === 'Wholesalers'
              ? 'add_wholesaler_note'
              : 'add_deal_note';
    rpcSource = source || 'create_note';
    rpcNote = args.text;
  } else if (name === 'update_off_market_templates') {
    rpcTool = 'upsert_off_market_templates';
    rpcSource = rpcTool;
  } else if (name === 'archive_record') {
    patch = { _table: args.record_type, reason: args.reason };
  } else if (name === 'restore_record') {
    patch = { _table: args.record_type };
  } else if (name === 'move_deal') {
    patch = { target_pipeline: args.target_pipeline };
  } else if (name === 'move_contact') {
    if (args.source_table === args.target_table) fail('INVALID_REQUEST', 'source_table and target_table must differ.');
    patch = { source_table: args.source_table, target_table: args.target_table };
  } else if (name === 'create_workspace_record') {
    const validated = createSchema(args.table).parse(args.fields);
    patch = { _table: args.table, _fields: validated };
  } else if (name === 'update_workspace_record') {
    const validated = patchSchema(args.table).parse(args.fields);
    patch = { _table: args.table, _fields: validated };
  } else if (name === 'delete_workspace_record') {
    patch = { _table: args.table };
  }

  if (patch.address && typeof patch.address === 'string') {
    patch.address = patch.address.replace(/\s+/g, ' ').replace(/\s*,\s*/g, ', ').trim();
  }
  if (patch.mls && typeof patch.mls === 'string') patch.mls = patch.mls.trim();
  if (patch.email && typeof patch.email === 'string') patch.email = patch.email.trim();

  const { data, error } =
    name === 'add_deal_photos'
      ? await db.rpc('dealdesk_add_photos', {
          p_id: args.deal_id,
          p_urls: await validatePhotos(args.photo_urls),
          p_revision: args.expected_revision,
          p_user: identity.sub,
          p_client: identity.client_id,
          p_session: identity.session_id,
          p_request: args.request_id ?? null,
        })
      : await db.rpc('dealdesk_operational_mutation', {
          p_tool: rpcTool,
          p_source: rpcSource,
          p_id: String(rpcId),
          p_patch: patch,
          p_revision: args.expected_revision ?? null,
          p_note: rpcNote,
          p_category: args.category ?? null,
          p_user: identity.sub,
          p_client: identity.client_id,
          p_session: identity.session_id,
          p_request: args.request_id ?? null,
        });

  if (error) fail('DATABASE_ERROR', 'Mutation failed; no partial changes were committed.');
  if (data.error) {
    const e = new DomainError(data.error.code, data.error.message);
    e.details = data.error.details;
    throw e;
  }
  if (!data.record) return data;

  const table = data.moved_to || inferTable(name, args);
  // Preserve every business field in the complete mutation result, but omit tenancy/internal controls.
  const { organization_id, pluginRevision, pluginArchiveReason, supabaseKey, twilioAuthToken, mlsApiKey, ...record } = data.record;
  return { ...data, record: { ...record, ...project(table, data.record), _revision: pluginRevision } };
}

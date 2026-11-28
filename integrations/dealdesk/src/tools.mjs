import { z } from 'zod';
import {
  createSchema,
  patchSchema,
  fields,
  searchFields,
  recordTypes,
  workspaceTables,
  id,
  numericId,
  recordId,
  fail,
  DomainError,
} from './domain.mjs';
import { evaluateBuyer } from './matching.mjs';
import { offMarketTools, offMarketPropertyCreateSchema, offMarketPropertyPatchSchema, offMarketTemplatesPatchSchema } from './offmarket.mjs';
import { workspaceReadTools, serviceTools } from './operational.mjs';
import { zillowTools } from './zillow.mjs';
import { dashboardReadTools, dashboardWriteTools } from './dashboard.mjs';
import { userWriteTools } from './users.mjs';

const revision = z.number().int().nonnegative().describe('The _revision returned by the most recent read; stale edits are rejected.');
const target = { record_type: z.enum(recordTypes), record_id: recordId };
const mutation = { expected_revision: revision };
const definitions = [];

function define(name, description, schema, write, run, destructive = false) {
  definitions.push({ name, description, schema, write, run, destructive });
}

const booleanFilterKeys = new Set([
  'doNotCall', 'investorFriendly', 'agreedToSend', 'unread', 'is_default',
  'Interested', "I'm Not Interested", 'Owner Not Interested', 'Trash', 'Text Message Sent', 'Owner Called',
]);

for (const [singular, plural, table] of [
  ['deal', 'deals', 'Deals'],
  ['jv_deal', 'jv_deals', 'JVDeals'],
  ['buyer', 'buyers', 'Buyers'],
  ['agent', 'agents', 'Agents'],
  ['wholesaler', 'wholesalers', 'Wholesalers'],
  ['task', 'tasks', 'PluginTasks'],
]) {
  const filterShape = Object.fromEntries(
    searchFields[table].map(k => [k, (booleanFilterKeys.has(k) ? z.boolean() : z.string().max(1000)).optional()]),
  );
  define(
    `search_${plural}`,
    `Search ${plural} in the configured DealDesk organization. query searches ${table === 'Deals' || table === 'JVDeals' ? 'address' : table === 'PluginTasks' ? 'title' : 'name'}; filters are exact matches. Follow next_offset for more pages.`,
    z.object({
      query: z.string().max(200).optional(),
      filters: z.object(filterShape).strict().optional(),
      offset: z.number().int().min(0).max(100000).default(0),
      limit: z.number().int().min(1).max(100).default(25),
      include_archived: z.boolean().default(false),
    }).strict(),
    false,
    (args, client) => client.operate({ action: 'read', table, ...args }),
  );
  if (singular === 'task') continue;
  const idKey = singular === 'jv_deal' ? 'deal_id' : `${singular}_id`;
  define(
    `get_${singular}`,
    `Read one ${singular}, including its _revision for a later update. Archived records can be read by ID.`,
    z.object({ [idKey]: id }).strict(),
    false,
    async (args, client) => {
      const r = await client.operate({ action: 'read', table, id: args[idKey], include_archived: true });
      if (r.records.length !== 1) fail('NOT_FOUND', 'Record not found.');
      return { record: r.records[0] };
    },
  );
}

for (const [name, table, idKey] of [
  ['deal', 'Deals', 'deal_id'],
  ['jv_deal', 'JVDeals', 'deal_id'],
  ['buyer', 'Buyers', 'buyer_id'],
  ['agent', 'Agents', 'agent_id'],
  ['wholesaler', 'Wholesalers', 'wholesaler_id'],
  ['task', 'PluginTasks', 'task_id'],
]) {
  define(
    `create_${name}`,
    `Create a ${name}. Use a fresh UUID request_id once per intended creation and reuse it if retrying.`,
    z.object({ request_id: z.uuid(), fields: createSchema(table) }).strict(),
    true,
    (args, client) => client.operate({ action: 'create', table, request_id: args.request_id, payload: args.fields }),
  );
  define(
    `update_${name}`,
    `Update allowed ${name} fields after reading the record using its current _revision.`,
    z.object({ [idKey]: name === 'task' ? z.uuid() : id, fields: patchSchema(table), ...mutation }).strict(),
    true,
    (args, client) => client.operate({ action: 'update', table, id: args[idKey], payload: args.fields, expected_revision: args.expected_revision }),
    true,
  );
  define(
    `delete_${name}`,
    `Permanently delete a ${name} record from ${table}.`,
    z.object({ [idKey]: name === 'task' ? z.uuid() : id, expected_revision: revision.optional() }).strict(),
    true,
    (args, client) => client.operate({ action: 'delete', table, id: args[idKey], ...(args.expected_revision !== undefined ? { expected_revision: args.expected_revision } : {}) }),
    true,
  );
}

define(
  'move_deal',
  'Move a deal between pipelines (mls, off-market, azre-queue, or dfd/JVDeals).',
  z.object({
    deal_id: id,
    target_pipeline: z.enum(['mls', 'off-market', 'azre-queue', 'dfd']),
    ...mutation,
  }).strict(),
  true,
  (args, client) => client.operate({ action: 'move_deal', id: args.deal_id, target_pipeline: args.target_pipeline, expected_revision: args.expected_revision }),
  true,
);

define(
  'move_contact',
  'Move a contact between Buyers, Agents, and Wholesalers, preserving contact details and notes.',
  z.object({
    contact_id: id,
    source_table: z.enum(['Buyers', 'Agents', 'Wholesalers']),
    target_table: z.enum(['Buyers', 'Agents', 'Wholesalers']),
    ...mutation,
  }).strict(),
  true,
  (args, client) => client.operate({ action: 'move_contact', id: args.contact_id, source_table: args.source_table, target_table: args.target_table, expected_revision: args.expected_revision }),
  true,
);

define(
  'update_offer',
  'Update a deal’s recorded offer and negotiation fields. Offers live on Deals.',
  z.object({
    deal_id: id,
    fields: z.object(Object.fromEntries(['offerPrice', 'offerDecision', 'negotiatedAskingPrice', 'desiredWholesaleProfit'].map(k => [k, fields.Deals[k].optional()]))).strict().refine(v => Object.keys(v).length > 0),
    ...mutation,
  }).strict(),
  true,
  (args, client) => client.operate({ action: 'update', table: 'Deals', id: args.deal_id, payload: args.fields, expected_revision: args.expected_revision }),
  true,
);

define(
  'create_note',
  'Append one internal note to Deals, JVDeals, Buyers, Agents, Wholesalers, or OffMarketProperties, preserving existing entries.',
  z.object({ ...target, text: z.string().trim().min(1).max(5000), ...mutation }).strict(),
  true,
  (args, client) => client.operate({ action: 'append_note', table: args.record_type, id: args.record_id, note: args.text, expected_revision: args.expected_revision }),
);

define(
  'archive_record',
  'Reversibly hide a record from default plugin searches and matching. Requires archive permission.',
  z.object({ ...target, reason: z.string().trim().min(1).max(1000), ...mutation }).strict(),
  true,
  (args, client) => client.operate({ action: 'archive', table: args.record_type, id: args.record_id, reason: args.reason, expected_revision: args.expected_revision }),
  true,
);

define(
  'restore_record',
  'Restore a record archived through the plugin. Requires archive permission.',
  z.object({ ...target, ...mutation }).strict(),
  true,
  (args, client) => client.operate({ action: 'restore', table: args.record_type, id: args.record_id, expected_revision: args.expected_revision }),
);

define(
  'match_buyers',
  'Screen one buyer page against a deal’s recorded buy boxes. Returns fit, mismatches and missing data; follow next_offset to screen all buyers.',
  z.object({ deal_id: id, offset: z.number().int().min(0).max(100000).default(0), limit: z.number().int().min(1).max(100).default(25) }).strict(),
  false,
  async (args, client) => {
    const d = await client.operate({ action: 'read', table: 'Deals', id: args.deal_id });
    if (d.records.length !== 1) fail('NOT_FOUND', 'Active deal not found.');
    const buyers = await client.operate({ action: 'read', table: 'Buyers', offset: args.offset, limit: args.limit });
    const candidates = buyers.records
      .map(b => ({ buyer_id: b.id, name: b.name, status: b.status, subscriptionStatus: b.subscriptionStatus, ...evaluateBuyer(d.records[0], b) }))
      .sort((a, b) => Number(b.eligible) - Number(a.eligible) || b.score - a.score);
    return { deal_id: args.deal_id, candidates, next_offset: buyers.next_offset, scope: 'This page only. Combine every page before claiming a complete ranking.' };
  },
);

// Off-Market Scouter tools
define(
  'search_off_market_properties',
  offMarketTools[0].description,
  offMarketTools[0].schema,
  false,
  (args, client) => client.operate({ action: 'read', table: 'OffMarketProperties', ...args }),
);
define(
  'get_off_market_property',
  offMarketTools[1].description,
  offMarketTools[1].schema,
  false,
  async (args, client) => {
    const r = await client.operate({ action: 'read', table: 'OffMarketProperties', id: args.property_id, include_archived: true });
    if (r.records.length !== 1) fail('NOT_FOUND', 'Record not found.');
    return { record: r.records[0] };
  },
);
define(
  'create_off_market_property',
  'Create a property record in OffMarketProperties.',
  z.object({ fields: offMarketPropertyCreateSchema }).strict(),
  true,
  (args, client) => client.operate({ action: 'create', table: 'OffMarketProperties', payload: args.fields }),
);
define(
  'update_off_market_property',
  'Update an OffMarketProperties record by numeric property_id and _revision.',
  z.object({ property_id: numericId, fields: offMarketPropertyPatchSchema, ...mutation }).strict(),
  true,
  (args, client) => client.operate({ action: 'update', table: 'OffMarketProperties', id: args.property_id, payload: args.fields, expected_revision: args.expected_revision }),
  true,
);
define(
  'delete_off_market_property',
  'Permanently delete a property from OffMarketProperties.',
  z.object({ property_id: numericId, expected_revision: revision.optional() }).strict(),
  true,
  (args, client) => client.operate({ action: 'delete', table: 'OffMarketProperties', id: args.property_id, ...(args.expected_revision !== undefined ? { expected_revision: args.expected_revision } : {}) }),
  true,
);
define(
  'get_off_market_templates',
  offMarketTools[2].description,
  offMarketTools[2].schema,
  false,
  async (_args, client) => {
    const r = await client.operate({ action: 'read', table: 'OffMarketOfferTextMessageGenerator', limit: 1 });
    return { templates: r.records[0] || null };
  },
);
define(
  'update_off_market_templates',
  'Update or create Off-Market SMS offer text message templates.',
  z.object({ template_id: numericId.optional(), fields: offMarketTemplatesPatchSchema, expected_revision: revision.optional(), request_id: z.uuid().optional() }).strict(),
  true,
  async (args, client) => {
    if (args.template_id !== undefined && args.expected_revision !== undefined) {
      return client.operate({ action: 'update', table: 'OffMarketOfferTextMessageGenerator', id: args.template_id, payload: args.fields, expected_revision: args.expected_revision });
    }
    const existing = await client.operate({ action: 'read', table: 'OffMarketOfferTextMessageGenerator', limit: 1 });
    if (existing.records.length) {
      const row = existing.records[0];
      return client.operate({ action: 'update', table: 'OffMarketOfferTextMessageGenerator', id: row.id, payload: args.fields, expected_revision: row._revision });
    }
    return client.operate({ action: 'create', table: 'OffMarketOfferTextMessageGenerator', payload: args.fields });
  },
);

// Workspace CRM table tools (Brokerages, Contacts, EmailLists, Campaigns, EmailTemplates, OfferTemplates, sender_emails, activity_logs, InboxMessages, MarketData, Integrations, etc.)
define(
  'search_workspace_records',
  workspaceReadTools.find(t => t.name === 'search_workspace_records').description,
  workspaceReadTools.find(t => t.name === 'search_workspace_records').schema,
  false,
  (args, client) => client.operate({ action: 'read', table: args.table, query: args.query, filters: args.filters, offset: args.offset, limit: args.limit, include_archived: args.include_archived }),
);
define(
  'get_workspace_record',
  workspaceReadTools.find(t => t.name === 'get_workspace_record').description,
  workspaceReadTools.find(t => t.name === 'get_workspace_record').schema,
  false,
  async (args, client) => {
    const r = await client.operate({ action: 'read', table: args.table, id: args.record_id, include_archived: true });
    if (r.records.length !== 1) fail('NOT_FOUND', 'Record not found.');
    return { record: r.records[0] };
  },
);
define(
  'create_workspace_record',
  'Create a record in any DealDesk workspace table.',
  z.object({ table: z.enum(workspaceTables), request_id: z.uuid().optional(), fields: z.record(z.string(), z.unknown()) }).strict(),
  true,
  (args, client) => client.operate({ action: 'create', table: args.table, ...(args.request_id ? { request_id: args.request_id } : {}), payload: args.fields }),
);
define(
  'update_workspace_record',
  'Update a record in any DealDesk workspace table using its current _revision.',
  z.object({ table: z.enum(workspaceTables), record_id: recordId, fields: z.record(z.string(), z.unknown()), ...mutation }).strict(),
  true,
  (args, client) => client.operate({ action: 'update', table: args.table, id: args.record_id, payload: args.fields, expected_revision: args.expected_revision }),
  true,
);
define(
  'delete_workspace_record',
  'Permanently delete a record from any DealDesk workspace table.',
  z.object({ table: z.enum(workspaceTables), record_id: recordId, expected_revision: revision.optional() }).strict(),
  true,
  (args, client) => client.operate({ action: 'delete', table: args.table, id: args.record_id, ...(args.expected_revision !== undefined ? { expected_revision: args.expected_revision } : {}) }),
  true,
);

// Zillow, Email, and Gemini AI services
define(
  'import_from_zillow',
  zillowTools[0].description,
  zillowTools[0].schema,
  true,
  (args, client) => client.operate({ action: 'zillow_scrape', url: args.url, create_deal: args.create_deal }),
);
define(
  'pull_zillow_comps',
  zillowTools[1].description,
  zillowTools[1].schema,
  false,
  async (args, client) => {
    const r = await client.operate({ action: 'zillow_scrape', url: args.url, create_deal: false });
    return { url: r.url, properties: (r.data || []).map(item => ({ address: item.address, comps: item.mappedComps || [] })), saved: false };
  },
);
define(
  'send_email',
  serviceTools[0].description,
  serviceTools[0].schema,
  true,
  (args, client) => client.operate({ action: 'send_email', recipients: args.recipients, subject: args.subject, body: args.body, ...(args.fromAddress ? { fromAddress: args.fromAddress } : {}) }),
  true,
);
define(
  'generate_ai_comps',
  serviceTools[1].description,
  serviceTools[1].schema,
  false,
  (args, client) => client.operate({ action: 'gemini_comps', ...args }),
);
define(
  'ai_search_chat',
  serviceTools[2].description,
  serviceTools[2].schema,
  false,
  (args, client) => client.operate({ action: 'gemini_chat', message: args.message }),
);

// Dashboard, Activity Feed, and User Account Creation
define(
  'get_dashboard',
  dashboardReadTools[0].description,
  dashboardReadTools[0].schema,
  false,
  (args, client) => client.operate({ action: 'get_dashboard', ...args }),
);
define(
  'get_activity_feed',
  dashboardReadTools[1].description,
  dashboardReadTools[1].schema,
  false,
  (args, client) => client.operate({ action: 'get_activity_feed', ...args }),
);
define(
  'log_activity',
  dashboardWriteTools[0].description,
  dashboardWriteTools[0].schema,
  true,
  (args, client) => client.operate({ action: 'log_activity', ...args }),
);
define(
  'create_user',
  userWriteTools[0].description,
  userWriteTools[0].schema,
  true,
  (args, client) => client.operate({ action: 'create_user', ...args }),
  true,
);

export const coreReadToolNames = new Set([
  'search_deals', 'get_deal',
  'search_buyers', 'get_buyer',
  'search_agents', 'get_agent',
  'search_tasks',
  'match_buyers',
]);

export const tools = definitions;

export async function invoke(name, input, { client, writes = false, archive = false, audit = () => {} }) {
  const tool = tools.find(t => t.name === name);
  if (!tool) fail('UNKNOWN_TOOL', 'Unknown tool.');
  try {
    const args = tool.schema.parse(input);
    const requiresWrite = tool.write && !(name === 'import_from_zillow' && !args.create_deal);
    if (requiresWrite && !writes) fail('WRITES_DISABLED', 'Writes are disabled on the MCP server.');
    if (['archive_record', 'restore_record'].includes(name) && !archive) fail('ARCHIVE_DISABLED', 'Archiving is disabled on the MCP server.');
    const result = await tool.run(args, client);
    audit({ tool: name, status: 'success', write: tool.write });
    return result;
  } catch (error) {
    audit({ tool: name, status: 'error', code: error instanceof DomainError ? error.code : 'INVALID_REQUEST', write: tool.write });
    throw error;
  }
}

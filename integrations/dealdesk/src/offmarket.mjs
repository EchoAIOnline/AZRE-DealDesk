import { z } from 'zod';
import { createSchema, patchSchema, fields, scopeOrgQuery, fail } from './domain.mjs';

export const offMarketFilterShape = {
  City: z.string().max(200).optional(),
  State: z.string().max(100).optional(),
  Zip: z.union([z.string().max(40), z.number().int()]).optional(),
  County: z.string().max(200).optional(),
  Subdivision: z.string().max(200).optional(),
  APN: z.union([z.string().max(100), z.number().int()]).optional(),
  Status: z.string().max(200).optional(),
  'Property Type': z.string().max(200).optional(),
  'Land Use': z.string().max(200).optional(),
  'Owner Type': z.string().max(200).optional(),
  Interested: z.boolean().optional(),
  "I'm Not Interested": z.boolean().optional(),
  'Owner Not Interested': z.boolean().optional(),
  Trash: z.boolean().optional(),
  'Text Message Sent': z.boolean().optional(),
  'Owner Called': z.boolean().optional(),
};

export const offMarketTools = [
  {
    name: 'search_off_market_properties',
    description: 'Search and filter Off-Market Scouter properties in the configured DealDesk organization. query searches Address; filters are exact matches. Follow next_offset for complete results.',
    schema: z.object({
      query: z.string().max(200).optional(),
      filters: z.object(offMarketFilterShape).strict().optional(),
      offset: z.number().int().min(0).max(100000).default(0),
      limit: z.number().int().min(1).max(100).default(25),
      include_archived: z.boolean().default(false),
    }).strict(),
    write: false,
  },
  {
    name: 'get_off_market_property',
    description: 'Retrieve one Off-Market Scouter property record by numeric property_id, including _revision. Archived records can be read by ID.',
    schema: z.object({
      property_id: z.number().int().positive().max(9007199254740991),
    }).strict(),
    write: false,
  },
  {
    name: 'get_off_market_templates',
    description: 'Retrieve the saved Off-Market SMS offer text message templates for this organization.',
    schema: z.object({}).strict(),
    write: false,
  },
];

export const offMarketPropertyCreateSchema = createSchema('OffMarketProperties');
export const offMarketPropertyPatchSchema = patchSchema('OffMarketProperties');
export const offMarketTemplatesPatchSchema = patchSchema('OffMarketOfferTextMessageGenerator');

export function projectOffMarketProperty(row) {
  const { organization_id, pluginRevision, pluginArchiveReason, ...rest } = row;
  return { ...rest, _revision: pluginRevision };
}

export async function executeOffMarketRead(db, name, input, organizationId) {
  const tool = offMarketTools.find(t => t.name === name);
  if (!tool) fail('UNKNOWN_TOOL', 'Unknown off-market tool.');
  const args = tool.schema.parse(input);
  if (name === 'get_off_market_templates') {
    const { data, error } = await scopeOrgQuery(
      db.from('OffMarketOfferTextMessageGenerator').select('*'),
      'OffMarketOfferTextMessageGenerator',
      organizationId,
    )
      .order('id', { ascending: true })
      .limit(1);
    if (error) fail('DATABASE_ERROR', 'Database operation failed. Verify the migration and field schema; details are confined to the database.');
    const row = data && data[0] ? projectOffMarketProperty(data[0]) : null;
    return { templates: row };
  }
  let q = scopeOrgQuery(
    db.from('OffMarketProperties').select('*'),
    'OffMarketProperties',
    organizationId,
  );
  if (name === 'get_off_market_property') {
    const { data, error } = await q.eq('id', args.property_id);
    if (error) fail('DATABASE_ERROR', 'Database operation failed. Verify the migration and field schema; details are confined to the database.');
    if (!data || data.length !== 1) fail('NOT_FOUND', 'Record not found.');
    return { record: projectOffMarketProperty(data[0]) };
  }
  if (!args.include_archived) q = q.is('pluginArchivedAt', null);
  for (const [key, value] of Object.entries(args.filters || {})) {
    if (value !== undefined) q = q.eq(key, value);
  }
  if (args.query) {
    q = q.ilike('Address', `%${args.query.replace(/[\\%_]/g, '\\$&')}%`);
  }
  const { data, error } = await q.order('id', { ascending: true }).range(args.offset, args.offset + args.limit);
  if (error) fail('DATABASE_ERROR', 'Database operation failed. Verify the migration and field schema; details are confined to the database.');
  const rows = data || [];
  return {
    records: rows.slice(0, args.limit).map(projectOffMarketProperty),
    next_offset: rows.length > args.limit ? args.offset + args.limit : null,
  };
}

export { fields };

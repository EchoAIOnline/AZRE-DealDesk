import { z } from 'zod';

export const stages = [
  'No Offer Made Yet','Seller Counter-Offered','Monitoring Pending Status Before Offer',
  'Requires A Buyers Agent','Made Verbal Offer On Property','Made Written Offer On Property',
  'Monitoring Pending Status After Offer','Monitoring Offer After Seller Declined',
  'Research','Analyzing','Seller Accepted Offer','Agent Sending Contract',
  'Deal Under Contract','Listing Removed - Now Off Market','Offer Declined',
  'Offer Declined and Sold','Sold To Another Investor','Deal Canceled',
  'Priced Too High To Buy','No Longer Interested In Buying','Declined',
  'Deal No Longer Available','Deal Successfully Closed'
];
export const jvStages = ['Available', 'No Longer Available', ...stages];
export const activeStages = stages.slice(0, 12);
export const id = z.string().min(1).max(128).regex(/^[a-zA-Z0-9_-]+$/);
export const numericId = z.number().int().positive().max(9007199254740991);
export const recordId = z.union([id, numericId]);

const text = z.string().trim().min(1).max(1000);
const freeText = z.string().max(10000);
const nullableText = z.string().max(1000).nullable();
const money = z.number().finite().min(0).max(1e10);
const anyNumber = z.number().finite().min(-1e12).max(1e12);
const date = z.iso.date();
const list = z.array(text).max(100);
const jsonRecord = z.record(z.string(), z.unknown());
const optional = shape => Object.fromEntries(Object.entries(shape).map(([k, v]) => [k, v.optional()]));

const boundedBuyBox = z.object(optional({
  locations: z.string().max(2000), minPrice: money, maxPrice: money, minArv: money, maxArv: money,
  maxRenoBudget: money, earliestYearBuilt: z.number().int().min(1600).max(2200),
  latestYearBuilt: z.number().int().min(1600).max(2200), propertyTypes: list,
  minBedrooms: z.number().int().min(0).max(100), minBathrooms: z.number().min(0).max(100),
  minSqft: money, maxSqft: money, notes: z.string().max(5000)
})).strict().superRefine((v, ctx) => {
  for (const [lo, hi] of [['minPrice', 'maxPrice'], ['minArv', 'maxArv'], ['minSqft', 'maxSqft'], ['earliestYearBuilt', 'latestYearBuilt']]) {
    if (v[lo] != null && v[hi] > 0 && v[lo] > v[hi]) ctx.addIssue({ code: 'custom', message: `${lo} exceeds ${hi}` });
  }
});

// Match types.ts Comparable and the existing frontend JSONB objects.
export const comparable = z.object({
  address: z.string().max(1000),
  saleDate: z.string().max(1000),
  salePrice: z.number().finite().min(0).max(1e10),
  sqft: z.number().finite().min(0).max(1e10).optional(),
  softenerPercent: z.number().finite().min(0).max(100).optional(),
}).strict().nullable().describe('Existing Comparable JSON object; null clears this slot. Omitted slots are unchanged. No automatic comp filling.');

export const comparableFields = Object.fromEntries(
  ['newConstruction', 'renovation'].flatMap(kind =>
    [1, 2, 3].map(n => [kind + 'Comparable' + n, comparable])
  )
);

export const dealDocumentSchema = z.object({
  id: z.string().min(1).max(128),
  name: z.string().min(1).max(500),
  url: z.string().min(1).max(2048),
  category: z.enum(['A-B Purchase Contract', 'B-C Purchase Contract', 'Other Documents']),
  uploadedAt: z.string().max(100),
}).strict();

const fullDealFields = {
  ...comparableFields,
  comparable1: comparable,
  comparable2: comparable,
  comparable3: comparable,
  address: text,
  mls: text,
  listPrice: money,
  offerPrice: money,
  maximumOffer: money,
  sellerCounterOffer: money,
  dispositionPrice: money,
  agentName: text,
  agentPhone: text,
  agentEmail: z.email(),
  agentBrokerage: text,
  agentBrokerPhone: text,
  secondAgentId: nullableText,
  thirdAgentId: nullableText,
  acquisitionManager: text,
  status: text,
  offerDecision: z.enum(stages),
  queueStatus: z.enum(['In Queue', 'In Pipeline']),
  subMarket: text,
  neighborhood: text,
  county: text,
  dealType: z.array(z.enum(['Renovation', 'Rental', 'New Construction', 'Multi-Family'])).max(4),
  propertyType: z.enum(['Single Family Residential', 'Multi-Family Residential', 'Commercial', 'Land']),
  listingDescription: freeText,
  originalAskingPrice: money,
  reducedAskingPrice: money,
  negotiatedAskingPrice: money,
  desiredWholesaleProfit: money,
  priceReductionAlert: freeText,
  forSaleBy: text,
  listingStatus: text,
  listingType: z.enum(['Listed On MLS', 'Off-Market']),
  contactStatus: text,
  agentContacted: text,
  renovationEstimate: money,
  newConstructionEstimate: money,
  renovationARV: money,
  newConstructionARV: money,
  renovationARVToggle: z.boolean(),
  newConstructionARVToggle: z.boolean(),
  arvCalculationType: z.enum(['renovation', 'new_construction']),
  bedrooms: z.number().int().min(0).max(100),
  bathrooms: z.number().min(0).max(100),
  sqft: money,
  lotSqft: money,
  yearBuilt: z.number().int().min(1600).max(2200),
  zoning: text,
  lockBoxCode: z.string().max(200),
  dateListed: date.nullable(),
  inspectionDate: date.nullable(),
  emdDate: date.nullable(),
  underContractDate: date.nullable(),
  closedDate: date.nullable(),
  declinedDate: date.nullable(),
  nextFollowUpDate: date.nullable(),
  lastContactDate: date.nullable(),
  interestLevel: z.enum(['High', 'Mild', 'Not Interested']),
  dispo: jsonRecord,
  documents: z.array(dealDocumentSchema).max(200),
  motivationSignals: list,
  renovationWorkflow: jsonRecord.nullable(),
  feasibilityStudy: freeText.nullable(),
  photos: z.array(z.string().max(2048)).max(200),
  picturesFolderId: nullableText,
  excludeStreetView: z.boolean(),
  loiSent: z.boolean(),
  loiSentDate: date.nullable(),
  loiSentBy: nullableText,
  ownerLLCName: nullableText,
  ownerPersonalName: nullableText,
  ownerAddress: nullableText,
  ownerPhones: list,
  interestedBuyers: z.array(z.unknown()).max(200),
  buyersWhoPassed: z.array(z.unknown()).max(200),
};

export const offMarketPropertyFields = {
  Address: text,
  City: freeText,
  State: freeText,
  Zip: z.union([z.string().max(40), z.number().int()]).nullable(),
  County: freeText,
  'Estimated Value': money.nullable(),
  'Zillow Estimate': money.nullable(),
  'Estimated Equity Percent': anyNumber.nullable(),
  'Estimated Equity': anyNumber.nullable(),
  'Living Square Feet': money.nullable(),
  'Year Built': z.number().int().min(1600).max(2200).nullable(),
  'Lot (Acres)': money.nullable(),
  'Lot (Square Feet)': money.nullable(),
  'Land Use': freeText.nullable(),
  'Property Type': freeText.nullable(),
  'Property Use': freeText.nullable(),
  Subdivision: freeText.nullable(),
  APN: z.union([z.string().max(100), z.number().int()]).nullable(),
  'Legal Description': freeText.nullable(),
  'Units Count': z.number().int().min(0).max(10000).nullable(),
  Bedrooms: z.number().min(0).max(500).nullable(),
  Bathrooms: z.number().min(0).max(500).nullable(),
  '# of Stories': z.number().min(0).max(200).nullable(),
  'Garage Type': freeText.nullable(),
  'Garage Square Feet': money.nullable(),
  Carport: freeText.nullable(),
  'Carport Area': money.nullable(),
  'Air Conditioning Type': freeText.nullable(),
  'Heating Type': freeText.nullable(),
  '# of Fireplaces': z.number().int().min(0).max(100).nullable(),
  'Owner 1 First Name': freeText.nullable(),
  'Owner 1 Last Name': freeText.nullable(),
  'Owner 1 Phone Number 1': freeText.nullable(),
  'Owner 1 Phone Number 2': freeText.nullable(),
  'Owner 1 Phone Number 3': freeText.nullable(),
  'Owner 2 First Name': freeText.nullable(),
  'Owner 2 Last Name': freeText.nullable(),
  'Owner 2 Phone Number 1': freeText.nullable(),
  'Owner 2 Phone Number 2': freeText.nullable(),
  'Owner 2 Phone Number 3': freeText.nullable(),
  'Owner 3 First Name': freeText.nullable(),
  'Owner 3 Last Name': freeText.nullable(),
  'Owner 3 Phone Number 1': freeText.nullable(),
  'Owner 3 Phone Number 2': freeText.nullable(),
  'Owner 3 Phone Number 3': freeText.nullable(),
  'Owner 4 First Name': freeText.nullable(),
  'Owner 4 Last Name': freeText.nullable(),
  'Owner 4 Phone Number 1': freeText.nullable(),
  'Owner 4 Phone Number 2': freeText.nullable(),
  'Owner 4 Phone Number 3': freeText.nullable(),
  'Owner Mailing Address': freeText.nullable(),
  'Owner Mailing City': freeText.nullable(),
  'Owner Mailing State': freeText.nullable(),
  'Owner Mailing Zip': z.union([z.string().max(40), z.number().int()]).nullable(),
  'Ownership Length (Months)': money.nullable(),
  'Owner Type': freeText.nullable(),
  'Owner Occupied': anyNumber.nullable(),
  'Vacant?': anyNumber.nullable(),
  'Last Sale Date': freeText.nullable(),
  'Last Sale Amount': money.nullable(),
  'Open Mortgage Balance': money.nullable(),
  'Recorded Mortgage Interest Rate': freeText.nullable(),
  'Mortgage Document Date': freeText.nullable(),
  'Mortgage Loan Type': freeText.nullable(),
  'Lender Name': freeText.nullable(),
  'Deed Type': freeText.nullable(),
  Position: freeText.nullable(),
  'Tax Amount': freeText.nullable(),
  'Assessment Year': z.number().int().min(1900).max(2200).nullable(),
  'Assessed Total Value': money.nullable(),
  'Assessed Land Value': money.nullable(),
  'Assessed Improvement Value': money.nullable(),
  'Assessed Improvement Percentage': freeText.nullable(),
  'Market Value': money.nullable(),
  'Market Land Value': money.nullable(),
  'Market Improvement Value': money.nullable(),
  'Market Improvement Percentage': freeText.nullable(),
  Status: freeText.nullable(),
  'Default Amount': money.nullable(),
  'Opening bid': money.nullable(),
  'Recording Date': freeText.nullable(),
  'Auction Date': freeText.nullable(),
  'Auction Time': freeText.nullable(),
  'Auction Courthouse': freeText.nullable(),
  'Auction Address': freeText.nullable(),
  'Auction City State': freeText.nullable(),
  Interested: z.boolean().nullable(),
  "I'm Not Interested": z.boolean().nullable(),
  'Owner Not Interested': z.boolean().nullable(),
  'Off Market List': z.array(freeText).max(50).nullable(),
  Trash: z.boolean().nullable(),
  'My Estimated Offer': money.nullable(),
  'Text Message Generator': z.union([freeText, jsonRecord]).nullable(),
  'Text Message Sent': z.boolean().nullable(),
  'TMS Date and Time': freeText.nullable(),
  'Owner Called': z.boolean().nullable(),
  'Called Date and Time': freeText.nullable(),
  'Text Message Templates': z.union([jsonRecord, z.array(freeText)]).nullable(),
};

export const fields = {
  Deals: fullDealFields,
  JVDeals: {
    ...fullDealFields,
    offerDecision: z.enum(jvStages),
    pipelineType: z.enum(['dfd', 'jv']),
  },
  Buyers: {
    name: text,
    companyName: text,
    email: z.email(),
    phone: text,
    status: z.enum(['New Lead', 'Vetted Buyer', 'Repeat Buyer', 'VIP Buyer', 'Deactivated']),
    subscriptionStatus: z.enum(['Subscribed', 'Unsubscribed']),
    buyBox: boundedBuyBox,
    propertiesBought: z.number().int().min(0).max(100000),
    about: z.string().max(5000),
    website: freeText,
    socialMediaLinks: z.array(text).max(20),
    photo: z.string().max(2048).nullable(),
    nextFollowUpDate: date.nullable(),
    lastContactDate: date.nullable(),
  },
  Agents: {
    name: text,
    agentFirstName: text,
    agentLastName: text,
    phone: text,
    email: z.email(),
    brokerage: text,
    brokeragePhone: text,
    brokerageEmail: z.email(),
    brokerageAddress: freeText,
    photo: z.string().max(2048).nullable(),
    hasBeenContacted: z.boolean(),
    handlesInvestments: z.boolean(),
    spokeWithAgent: z.boolean(),
    investorFriendly: z.boolean(),
    agreedToSend: z.boolean(),
    loiSent: z.boolean(),
    loiSentDate: date.nullable(),
    hasClosedDeals: z.boolean(),
    sentTextToAgent: z.boolean(),
    agentRespondedToText: z.boolean(),
    agentSentDeal: z.boolean(),
    agentRelationshipDates: jsonRecord.nullable(),
    closedDealIds: list,
    subscriptionStatus: z.enum(['Subscribed', 'Unsubscribed']),
    acquisitionManager: text,
    doNotCall: z.boolean(),
    nextFollowUpDate: date.nullable(),
    lastContactDate: date.nullable(),
  },
  Wholesalers: {
    name: text,
    companyName: text,
    phone: text,
    email: z.email(),
    status: z.enum(['New', 'Vetted', 'JV Partner', 'Blacklisted']),
    wholesalerType: z.enum(['Acquisitions', 'Dispositions', 'Acq & Dispo']),
    properties: z.array(z.object({
      id: z.string().max(128),
      address: z.string().max(1000),
      status: z.enum(['Available', 'No Longer Available']),
    }).strict()).max(500),
    photo: z.string().max(2048).nullable(),
    closedDealIds: list,
    subscriptionStatus: z.enum(['Subscribed', 'Unsubscribed']),
    nextFollowUpDate: date.nullable(),
    lastContactDate: date.nullable(),
  },
  OffMarketProperties: offMarketPropertyFields,
  OffMarketOfferTextMessageGenerator: {
    'Text Message Template 1': freeText.nullable(),
    'Text Message Template 2': freeText.nullable(),
    'Text Message Template 3': freeText.nullable(),
    'Text Message Template 4': freeText.nullable(),
  },
  PluginTasks: {
    title: text,
    description: z.string().max(5000),
    entityType: z.enum(['Deals', 'JVDeals', 'Buyers', 'Agents', 'Wholesalers']),
    entityId: id,
    dueDate: z.union([date, z.iso.datetime({ offset: true })]),
    assignee: text,
    status: z.enum(['Open', 'Completed']),
    priority: z.enum(['Low', 'Normal', 'High', 'Urgent']),
  },
  Brokerages: {
    name: text,
    phone: text,
    email: z.email(),
  },
  Contacts: {
    name: text,
    type: text,
    phone: text,
    email: z.email(),
    company: text,
    address: freeText,
    notes: freeText,
  },
  EmailLists: {
    name: text,
    source: z.enum(['buyer', 'agent', 'wholesaler']),
    type: z.enum(['list', 'segment']),
    segmentRule: freeText,
  },
  Campaigns: {
    name: text,
    type: z.enum(['Email', 'SMS', 'Hybrid', 'loi_blast', 'buyer_blast']),
    status: z.enum(['Running', 'Scheduled', 'Completed', 'Draft', 'Sent', 'finished']),
    audienceSize: z.number().int().min(0).max(1e7),
    sent: z.number().int().min(0).max(1e7),
    delivered: z.number().int().min(0).max(1e7),
    responses: z.number().int().min(0).max(1e7),
    startDate: z.string().max(100).nullable(),
    templateId: text,
    subject: text,
    from_email: z.email(),
    lists: z.array(z.unknown()).max(500),
    tags: z.array(z.unknown()).max(500),
    send_at: z.string().max(100).nullable(),
    content_type: text,
    body: z.string().max(200000),
    alt_body: z.string().max(200000),
    deliveryLogs: z.array(z.unknown()).max(5000),
    sentAt: z.string().max(100).nullable(),
    recipientCount: z.number().int().min(0).max(1e7),
    last_updated: z.string().max(100),
  },
  EmailTemplates: {
    name: text,
    type: text,
    html_content: z.string().max(200000),
    is_default: z.boolean(),
    last_updated: z.string().max(100),
  },
  OfferTemplates: {
    name: text,
    type: z.enum(['Cash', 'Subject-To', 'Seller Finance', 'Hybrid']),
    emailBody: z.string().max(100000),
    smsBody: freeText,
    loiBody: z.string().max(100000),
  },
  sender_emails: {
    email: z.email(),
    name: text,
    is_default: z.boolean(),
  },
  activity_logs: {
    user_id: text,
    user_name: text,
    action_type: text,
    entity_type: text,
    entity_id: text,
    entity_display: text,
    description: freeText,
    metadata: jsonRecord.nullable(),
  },
  InboxMessages: {
    contactName: text,
    contactPhone: text,
    contactEmail: z.email(),
    propertyAddress: freeText,
    lastMessage: freeText,
    unread: z.boolean(),
    type: z.enum(['SMS', 'Email']),
    direction: z.enum(['inbound', 'outbound']),
  },
  MarketData: {
    city: text,
    state: text,
    medianPrice: money,
    inventory: z.number().int().min(0).max(1e8),
    daysOnMarket: z.number().int().min(0).max(10000),
    marketOpportunityScore: anyNumber,
    priceGrowth: anyNumber,
    capRate: anyNumber,
    jobGrowth: anyNumber,
  },
  Integrations: {
    organization: text,
    inviteCode: text,
    twilioPhoneNumber: text,
    twilioAccountSid: text,
    supabaseUrl: text,
  },
};

export const tables = Object.keys(fields);
export const workspaceTables = [
  'JVDeals', 'Wholesalers', 'Brokerages', 'Contacts', 'EmailLists',
  'Campaigns', 'EmailTemplates', 'OfferTemplates', 'sender_emails',
  'activity_logs', 'InboxMessages', 'MarketData', 'Integrations',
  'OffMarketOfferTextMessageGenerator'
];
export const mutableTables = [...tables];
export const recordTypes = ['Deals', 'JVDeals', 'Buyers', 'Agents', 'Wholesalers', 'OffMarketProperties'];
export const bigintIdTables = ['OffMarketProperties', 'OffMarketOfferTextMessageGenerator'];

export const patchSchema = table =>
  z.object(optional(fields[table])).strict().refine(v => Object.keys(v).length > 0, 'At least one field is required');

export const createSchema = table => {
  const required = {
    Deals: ['address'],
    JVDeals: ['address'],
    Buyers: ['name'],
    Agents: ['name'],
    Wholesalers: ['name'],
    OffMarketProperties: ['Address'],
    OffMarketOfferTextMessageGenerator: [],
    PluginTasks: ['title', 'entityType', 'entityId', 'dueDate'],
    Brokerages: ['name'],
    Contacts: ['name'],
    EmailLists: ['name', 'source', 'type'],
    Campaigns: ['name'],
    EmailTemplates: ['name'],
    OfferTemplates: ['name'],
    sender_emails: ['email'],
    activity_logs: ['user_id', 'action_type', 'entity_type', 'entity_id'],
    InboxMessages: ['contactName'],
    MarketData: ['city', 'state'],
    Integrations: [],
  }[table] || [];
  return z.object(
    Object.fromEntries(Object.entries(fields[table]).map(([k, v]) => [k, required.includes(k) ? v : v.optional()]))
  ).strict();
};

export const searchFields = {
  Deals: ['queueStatus', 'pipelineType', 'listingType', 'address', 'offerDecision', 'subMarket', 'neighborhood', 'county', 'propertyType', 'acquisitionManager'],
  JVDeals: ['pipelineType', 'address', 'offerDecision', 'subMarket', 'neighborhood', 'county', 'propertyType', 'acquisitionManager'],
  Buyers: ['name', 'companyName', 'email', 'status', 'subscriptionStatus'],
  Agents: ['name', 'email', 'brokerage', 'doNotCall', 'acquisitionManager', 'investorFriendly', 'agreedToSend'],
  Wholesalers: ['name', 'companyName', 'email', 'status', 'wholesalerType', 'subscriptionStatus'],
  OffMarketProperties: ['City', 'State', 'Zip', 'County', 'Subdivision', 'APN', 'Status', 'Property Type', 'Land Use', 'Owner Type', 'Interested', "I'm Not Interested", 'Owner Not Interested', 'Trash', 'Text Message Sent', 'Owner Called'],
  OffMarketOfferTextMessageGenerator: [],
  PluginTasks: ['entityType', 'entityId', 'status', 'assignee', 'priority'],
  Brokerages: ['name', 'email', 'phone'],
  Contacts: ['name', 'type', 'company', 'email'],
  EmailLists: ['name', 'source', 'type'],
  Campaigns: ['name', 'type', 'status', 'templateId'],
  EmailTemplates: ['name', 'type', 'is_default'],
  OfferTemplates: ['name', 'type'],
  sender_emails: ['email', 'name', 'is_default'],
  activity_logs: ['user_id', 'action_type', 'entity_type', 'entity_id'],
  InboxMessages: ['contactName', 'contactPhone', 'contactEmail', 'type', 'direction', 'unread'],
  MarketData: ['city', 'state'],
  Integrations: ['organization'],
};

export const searchQueryColumn = {
  Deals: 'address',
  JVDeals: 'address',
  Buyers: 'name',
  Agents: 'name',
  Wholesalers: 'name',
  OffMarketProperties: 'Address',
  OffMarketOfferTextMessageGenerator: 'Text Message Template 1',
  PluginTasks: 'title',
  Brokerages: 'name',
  Contacts: 'name',
  EmailLists: 'name',
  Campaigns: 'name',
  EmailTemplates: 'name',
  OfferTemplates: 'name',
  sender_emails: 'email',
  activity_logs: 'description',
  InboxMessages: 'contactName',
  MarketData: 'city',
  Integrations: 'organization',
};

const privateColumns = new Set(['organization_id', 'pluginRevision', 'pluginArchiveReason', 'supabaseKey', 'twilioAuthToken', 'mlsApiKey']);

export const publicFields = {
  Deals: ['id', 'createdAt', 'queueStatus', 'pipelineType', ...Object.keys(fields.Deals), 'logs', 'offerDecisionTracking', 'pluginArchivedAt'],
  JVDeals: ['id', 'createdAt', 'queueStatus', 'pipelineType', ...Object.keys(fields.JVDeals), 'logs', 'offerDecisionTracking', 'pluginArchivedAt'],
  Buyers: ['id', 'createdAt', 'dateAdded', ...Object.keys(fields.Buyers), 'notes', 'pluginArchivedAt'],
  Agents: ['id', ...Object.keys(fields.Agents), 'notes', 'pluginArchivedAt'],
  Wholesalers: ['id', 'createdAt', ...Object.keys(fields.Wholesalers), 'notes', 'pluginArchivedAt'],
  OffMarketProperties: ['id', 'created_at', ...Object.keys(fields.OffMarketProperties), 'Notes', 'pluginArchivedAt'],
  OffMarketOfferTextMessageGenerator: ['id', ...Object.keys(fields.OffMarketOfferTextMessageGenerator), 'pluginArchivedAt'],
  PluginTasks: ['id', ...Object.keys(fields.PluginTasks), 'createdAt', 'pluginArchivedAt'],
  Brokerages: ['id', 'createdAt', ...Object.keys(fields.Brokerages), 'pluginArchivedAt'],
  Contacts: ['id', 'created_at', ...Object.keys(fields.Contacts), 'pluginArchivedAt'],
  EmailLists: ['id', 'createdAt', ...Object.keys(fields.EmailLists), 'pluginArchivedAt'],
  Campaigns: ['id', ...Object.keys(fields.Campaigns), 'pluginArchivedAt'],
  EmailTemplates: ['id', ...Object.keys(fields.EmailTemplates), 'pluginArchivedAt'],
  OfferTemplates: ['id', ...Object.keys(fields.OfferTemplates), 'pluginArchivedAt'],
  sender_emails: ['id', 'created_at', 'updated_at', ...Object.keys(fields.sender_emails), 'pluginArchivedAt'],
  activity_logs: ['id', 'created_at', ...Object.keys(fields.activity_logs), 'pluginArchivedAt'],
  InboxMessages: ['id', 'timestamp', ...Object.keys(fields.InboxMessages), 'pluginArchivedAt'],
  MarketData: ['id', ...Object.keys(fields.MarketData), 'pluginArchivedAt'],
  Integrations: ['id', 'created_at', 'updated_at', ...Object.keys(fields.Integrations), 'pluginArchivedAt'],
};

export function project(table, record) {
  const numericFields = new Set([
    'listPrice', 'offerPrice', 'maximumOffer', 'sellerCounterOffer', 'dispositionPrice',
    'originalAskingPrice', 'reducedAskingPrice', 'negotiatedAskingPrice', 'desiredWholesaleProfit',
    'renovationEstimate', 'newConstructionEstimate', 'renovationARV', 'newConstructionARV',
    'bedrooms', 'bathrooms', 'sqft', 'lotSqft', 'yearBuilt', 'propertiesBought',
    'audienceSize', 'sent', 'delivered', 'responses', 'recipientCount',
    'medianPrice', 'inventory', 'daysOnMarket', 'marketOpportunityScore', 'priceGrowth', 'capRate', 'jobGrowth',
    'Estimated Value', 'Zillow Estimate', 'Estimated Equity Percent', 'Estimated Equity',
    'Living Square Feet', 'Year Built', 'Lot (Acres)', 'Lot (Square Feet)', 'Units Count',
    'Bedrooms', 'Bathrooms', '# of Stories', 'Garage Square Feet', 'Carport Area',
    '# of Fireplaces', 'Ownership Length (Months)', 'Owner Occupied', 'Vacant?',
    'Last Sale Amount', 'Open Mortgage Balance', 'Assessment Year', 'Assessed Total Value',
    'Assessed Land Value', 'Assessed Improvement Value', 'Market Value', 'Market Land Value',
    'Market Improvement Value', 'Default Amount', 'Opening bid', 'My Estimated Offer'
  ]);
  const allowedKeys = publicFields[table] || Object.keys(record);
  const out = {};
  for (const k of allowedKeys) {
    if (privateColumns.has(k) || record[k] === undefined) continue;
    const val = record[k];
    out[k] = numericFields.has(k) && val !== null && val !== '' && Number.isFinite(Number(val)) ? Number(val) : val;
  }
  return out;
}

export const legacyNullOrgTables = new Set([
  'OffMarketProperties',
  'OffMarketOfferTextMessageGenerator',
]);

export function scopeOrgQuery(query, table, org, masterOrg = 'org_azre_00001') {
  if (org === masterOrg && legacyNullOrgTables.has(table)) {
    return query.or(`organization_id.eq.${org},organization_id.is.null`);
  }
  return query.eq('organization_id', org);
}

export class DomainError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}
export function fail(code, message) { throw new DomainError(code, message); }

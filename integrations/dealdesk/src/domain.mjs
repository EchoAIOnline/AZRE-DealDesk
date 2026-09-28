import { z } from 'zod';

export const stages = ['No Offer Made Yet','Seller Counter-Offered','Monitoring Pending Status Before Offer','Requires A Buyers Agent','Made Verbal Offer On Property','Made Written Offer On Property','Monitoring Pending Status After Offer','Monitoring Offer After Seller Declined','Analyzing','Seller Accepted Offer','Agent Sending Contract','Deal Under Contract','Listing Removed - Now Off Market','Offer Declined','Offer Declined and Sold','Sold To Another Investor','Deal Canceled','Priced Too High To Buy','No Longer Interested In Buying','Declined','Deal No Longer Available','Deal Successfully Closed'];
export const activeStages = stages.slice(0, 12);
export const id = z.string().min(1).max(128).regex(/^[a-zA-Z0-9_-]+$/);
const text = z.string().trim().min(1).max(1000);
const money = z.number().finite().min(0).max(1e10);
const date = z.iso.date();
const list = z.array(text).max(50);
const optional = shape => Object.fromEntries(Object.entries(shape).map(([k,v]) => [k,v.optional()]));
const boundedBuyBox = z.object(optional({ locations: z.string().max(2000), minPrice: money, maxPrice: money, minArv: money, maxArv: money, maxRenoBudget: money, earliestYearBuilt: z.number().int().min(1600).max(2200), latestYearBuilt: z.number().int().min(1600).max(2200), propertyTypes: list, minBedrooms: z.number().int().min(0).max(100), minBathrooms: z.number().min(0).max(100), minSqft: money, maxSqft: money, notes: z.string().max(5000) })).strict().superRefine((v,ctx) => {
  for (const [lo,hi] of [['minPrice','maxPrice'],['minArv','maxArv'],['minSqft','maxSqft'],['earliestYearBuilt','latestYearBuilt']]) {
    if (v[lo] != null && v[hi] > 0 && v[lo] > v[hi]) ctx.addIssue({code:'custom',message:`${lo} exceeds ${hi}`});
  }
});
export const fields = {
  Deals: { address:text, mls:text, listPrice:money, offerPrice:money, agentName:text, agentPhone:text, agentEmail:z.email(), agentBrokerage:text, acquisitionManager:text, offerDecision:z.enum(stages), subMarket:text, neighborhood:text, county:text, dealType:list, propertyType:text, listingDescription:z.string().max(10000), originalAskingPrice:money, reducedAskingPrice:money, negotiatedAskingPrice:money, desiredWholesaleProfit:money, renovationEstimate:money, newConstructionEstimate:money, renovationARV:money, newConstructionARV:money, bedrooms:z.number().int().min(0).max(100), bathrooms:z.number().min(0).max(100), sqft:money, lotSqft:money, yearBuilt:z.number().int().min(1600).max(2200), nextFollowUpDate:date.nullable(), lastContactDate:date.nullable(), interestLevel:text, contactStatus:text },
  Buyers: { name:text, companyName:text, email:z.email(), phone:text, status:z.enum(['New Lead','Vetted Buyer','Repeat Buyer','VIP Buyer','Deactivated']), buyBox:boundedBuyBox, propertiesBought:z.number().int().min(0).max(100000), about:z.string().max(5000), nextFollowUpDate:date.nullable(), lastContactDate:date.nullable() },
  Agents: {},
  PluginTasks: { title:text, description:z.string().max(5000), entityType:z.enum(['Deals','Buyers','Agents']), entityId:id, dueDate:date, assignee:text, status:z.enum(['Open','Completed']) }
};
export const tables = Object.keys(fields);
export const mutableTables = ['Deals','Buyers','PluginTasks'];
export const recordTypes = ['Deals','Buyers','Agents'];
export const patchSchema = table => z.object(optional(fields[table])).strict().refine(v => Object.keys(v).length > 0, 'At least one field is required');
export const createSchema = table => {
  const required = { Deals:['address'], Buyers:['name'], PluginTasks:['title','entityType','entityId','dueDate'] }[table];
  return z.object(Object.fromEntries(Object.entries(fields[table]).map(([k,v]) => [k,required.includes(k) ? v : v.optional()]))).strict();
};
export const searchFields = {
  Deals:['address','offerDecision','subMarket','neighborhood','county','propertyType','acquisitionManager'],
  Buyers:['name','companyName','email','status'],
  Agents:['name','email','brokerage','doNotCall'],
  PluginTasks:['entityType','entityId','status','assignee']
};
export const publicFields = {
  Deals:['id',...Object.keys(fields.Deals),'status','logs','offerDecisionTracking','pluginArchivedAt'],
  Buyers:['id',...Object.keys(fields.Buyers),'notes','subscriptionStatus','pluginArchivedAt'],
  Agents:['id','name','agentFirstName','agentLastName','email','phone','brokerage','notes','doNotCall','subscriptionStatus','nextFollowUpDate','lastContactDate','pluginArchivedAt'],
  PluginTasks:['id',...Object.keys(fields.PluginTasks),'createdAt','pluginArchivedAt']
};
export function project(table, record) {
  const numericFields=new Set(['listPrice','offerPrice','originalAskingPrice','reducedAskingPrice','negotiatedAskingPrice','desiredWholesaleProfit','renovationEstimate','newConstructionEstimate','renovationARV','newConstructionARV','bedrooms','bathrooms','sqft','lotSqft','yearBuilt','propertiesBought']);
  return Object.fromEntries(publicFields[table].filter(k => record[k] !== undefined).map(k => [k,numericFields.has(k) && record[k] !== null && record[k] !== '' && Number.isFinite(Number(record[k])) ? Number(record[k]) : record[k]]));
}
export class DomainError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}
export function fail(code, message) { throw new DomainError(code,message); }

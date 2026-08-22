
export interface SenderEmail {
  id: string;
  email: string;
  name?: string;
  is_default: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface ActivityLog {
  id: string;
  user_id: string;
  user_name: string;
  action_type: string; // 'CREATE', 'UPDATE', 'DELETE', 'STATUS_CHANGE', etc.
  entity_type: string; // 'DEAL', 'AGENT', 'BUYER', 'NOTE', etc.
  entity_id: string;
  entity_display?: string; // e.g., "123 Main St" or "John Doe"
  description: string;
  metadata?: any;
  created_at: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  password?: string;
  position: string;
  createdAt?: string;
  loginStatus?: 'Logged In' | 'Logged Out';
  photo?: string;
  signature?: string;
  organization?: string;
  organization_id?: string;
}

export interface DispoSettings {
  photos: boolean;
  blast: boolean;
  loiSentAgents?: string[];
  interestedBuyers?: { buyerId: string; price: string }[];
  passedBuyers?: string[];
  manualMatchedBuyers?: string[];
}

export interface Comparable {
  address: string;
  saleDate: string;
  salePrice: number;
  sqft?: number;
  softenerPercent?: number;
}

export interface OfferDecisionTrack {
  status: string;
  date: string;
  user: string;
}

export interface RenovationItem {
  id: string; // e.g. "Soft Costs_Temp Utilities"
  category: string;
  scope: string;
  projectedCost: number;
  actualCost: number;
}

export interface RenovationStage {
  stage: string;
  isActive: boolean;
  completedAt?: string | null;
  notes?: string;
}

export interface RenovationContractor {
  id: string;
  name: string;
  company: string;
  trade: string;
  phone: string;
  email: string;
  assignedTasks: string;
  status: 'Active' | 'Completed' | 'Removed';
}

export interface RenovationWorkflow {
  budgetItems: RenovationItem[];
  stages: RenovationStage[];
  contractors: RenovationContractor[];
}

export interface DealDocument {
  id: string;
  name: string;
  url: string;
  category: 'A-B Purchase Contract' | 'B-C Purchase Contract' | 'Other Documents';
  uploadedAt: string;
}

export interface Deal {
  id: string;
  createdAt?: string;
  pipelineType?: 'mls' | 'off-market' | 'dfd'; // New Field to distinguish pipelines
  address: string;
  mls: string;
  listPrice: number;
  offerPrice: number;
  // Primary Agent (Legacy fields used for Slot 1)
  agentName: string;
  agentPhone: string;
  agentEmail: string;
  agentBrokerage: string;
  agentBrokerPhone?: string;
  // Secondary Agents (New fields)
  secondAgentId?: string;
  thirdAgentId?: string;
  
  acquisitionManager: string;
  status: string; // Internal system status
  offerDecision: string; // Pipeline status
  subMarket: string;
  neighborhood?: string; // New Field
  dealType: string[]; // UPDATED: Changed to string array for multi-select
  interestLevel: string;
  logs: string[];
  inspectionDate: string | null;
  emdDate: string | null;
  underContractDate?: string | null; // New Field
  closedDate?: string | null; // New Field
  declinedDate?: string | null; // New Field
  nextFollowUpDate: string | null;
  lastContactDate: string | null;
  dispo: DispoSettings;
  listingDescription: string;
  originalAskingPrice: number;
  reducedAskingPrice: number;
  negotiatedAskingPrice: number;
  desiredWholesaleProfit?: number;
  priceReductionAlert: string;
  forSaleBy: string;
  feasibilityStudy?: string;
  listingStatus?: string;
  contactStatus: string;
  agentContacted: string;
  propertyType: string;
  listingType?: string; // New Field
  yearBuilt?: number; // New Field
  bedrooms?: number;
  bathrooms?: number;
  sqft?: number;
  lotSqft?: number;
  county?: string;
  zoning?: string;
  lockBoxCode?: string;
  dateListed?: string | null;
  renovationARVToggle?: boolean;
  renovationARV?: number;
  newConstructionARVToggle?: boolean;
  newConstructionARV?: number;
  newConstructionEstimate?: number;
  renovationEstimate?: number;
  arvCalculationType?: 'renovation' | 'new_construction';
  motivationSignals?: string[];
  renovationComparable1?: Comparable;
  renovationComparable2?: Comparable;
  renovationComparable3?: Comparable;
  newConstructionComparable1?: Comparable;
  newConstructionComparable2?: Comparable;
  newConstructionComparable3?: Comparable;
  photos?: string[];
  picturesFolderId?: string; // New Field for Drive Folder ID
  excludeStreetView?: boolean;
  loiSent?: boolean;
  loiSentDate?: string | null;
  loiSentBy?: string;
  offerDecisionTracking?: OfferDecisionTrack[];
  renovationWorkflow?: RenovationWorkflow;
  documents?: DealDocument[];
}

export interface Agent {
    overrideDuplicate?: boolean;
  id: string;
  name: string;
  agentFirstName?: string;
  agentLastName?: string;
  phone: string;
  email: string;
  brokerage: string;
  brokeragePhone?: string;
  brokerageEmail?: string;
  brokerageAddress?: string;
  notes: string[];
  lastContactDate?: string;
  nextFollowUpDate?: string;
  photo?: string;
  
  // New Relationship Fields
  spokeWithAgent?: boolean;
  investorFriendly?: boolean;
  agreedToSend?: boolean;
  loiSent?: boolean;
  loiSentDate?: string;
  hasClosedDeals?: boolean;
  sentTextToAgent?: boolean;
  agentRespondedToText?: boolean;
  agentSentDeal?: boolean;
  agentRelationshipDates?: Record<string, string>;
  closedDealIds?: string[];
  subscriptionStatus?: 'Subscribed' | 'Unsubscribed'; // New Field
  acquisitionManager?: string;
  doNotCall?: boolean;
}

export interface WholesalerProperty {
  id: string;
  address: string;
  status: 'Available' | 'No Longer Available';
}

export interface Wholesaler {
    overrideDuplicate?: boolean;
  id: string;
  name: string;
  companyName: string; // Renamed from company to match DB convention
  phone: string;
  email: string;
  status: string; // 'New', 'Vetted', 'JV Partner', 'Blacklisted'
  wholesalerType?: 'Acquisitions' | 'Dispositions' | 'Acq & Dispo';
  properties?: WholesalerProperty[];
  notes: string[];
  lastContactDate?: string;
  nextFollowUpDate?: string;
  photo?: string;
  closedDealIds?: string[];
  createdAt?: string;
  subscriptionStatus?: 'Subscribed' | 'Unsubscribed'; // New Field
}

export interface Brokerage {
  id: string;
  name: string;
  phone: string;
  email: string;
  createdAt: string;
}

export interface FilterConfig {
  type: string;
  value: string;
}

export interface BuyBox {
  locations: string;
  minPrice: number;
  maxPrice: number;
  minArv?: number;
  maxArv?: number; // NEW
  maxRenoBudget?: number;
  earliestYearBuilt?: number; // NEW
  latestYearBuilt?: number; // NEW
  propertyTypes: string[];
  minBedrooms: number;
  minBathrooms: number;
  minSqft?: number;
  maxSqft?: number;
  notes: string;
}

export interface Buyer {
    overrideDuplicate?: boolean;
  id: string;
  createdAt?: string; // Legacy field
  dateAdded?: string; // Database field
  name: string;
  companyName: string;
  phone: string;
  email: string;
  status: string;
  subscriptionStatus?: 'Subscribed' | 'Unsubscribed'; // New Field
  propertiesBought: number;
  buyBox: BuyBox;
  notes: string[]; // Activity log
  photo?: string;
  nextFollowUpDate?: string;
  lastContactDate?: string;
  about?: string;
}

export interface CalcData {
  arv: number;
  repairs: number;
  fee: number;
  isDoubleClose: boolean;
}

export interface Contact {
  id: string;
  created_at?: string;
  name: string;
  type: string;
  phone: string;
  email: string;
  company: string;
  address: string;
  notes: string;
}

export interface EmailList {
  id: string;
  name: string;
  source: 'buyer' | 'agent';
  type: 'list' | 'segment';
  segmentRule?: string; // 'all', 'new_lead', 'vetted', etc.
  createdAt: string;
}

// --- NEW ACQUIREFLOW TYPES ---

export interface DealFinderProperty {
  id: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  listPrice: number;
  beds: number;
  baths: number;
  sqft: number;
  propertyType: string;
  daysOnMarket: number;
  estimatedArv: number;
  estimatedRent: number;
  cashFlow: number;
  capRate: number;
  imageUrl: string;
  opportunitySignals: string[];
  distressSignals: string[];
  status: string;
}

export interface Campaign {
  id: string;
  name: string;
  type: 'Email' | 'SMS' | 'Hybrid' | 'loi_blast' | 'buyer_blast';
  status: 'Running' | 'Scheduled' | 'Completed' | 'Draft' | 'Sent' | 'finished';
  audienceSize: number;
  sent: number;
  delivered: number;
  responses: number;
  startDate: string;
  templateId: string;
}

export interface InboxMessage {
  id: string;
  contactName: string;
  contactPhone: string;
  contactEmail?: string;
  propertyAddress?: string;
  lastMessage: string;
  timestamp: string;
  unread: boolean;
  type: 'SMS' | 'Email';
  direction: 'inbound' | 'outbound';
}

export interface OfferTemplate {
  id: string;
  name: string;
  type: 'Cash' | 'Subject-To' | 'Seller Finance' | 'Hybrid';
  emailBody: string;
  smsBody: string;
  loiBody: string;
}

export interface MarketData {
  city: string;
  state: string;
  medianPrice: number;
  inventory: number;
  daysOnMarket: number;
  marketOpportunityScore: number;
  priceGrowth: number;
  capRate: number;
  jobGrowth: number;
}

export interface Integration {
    id: string;
    created_at?: string;
    updated_at?: string;
    supabaseUrl?: string;
    supabaseKey?: string;
    mlsApiKey?: string;
    twilioAccountSid?: string;
    twilioAuthToken?: string;
    twilioPhoneNumber?: string;
    organization?: string;
    inviteCode?: string;
}
 

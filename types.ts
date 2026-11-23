
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
  _isJV?: boolean;
  createdAt?: string;
  pipelineType?: 'mls' | 'off-market' | 'dfd' | 'azre-queue'; // Field to distinguish pipelines
  address: string;
  mls: string;
  listPrice: number;
  offerPrice: number;
  maximumOffer?: number;
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
  status?: string; // Removed from Deals table
  offerDecision: string; // Pipeline status
  queueStatus?: string;
  queueStatue?: string;
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
  sellerCounterOffer?: number;
  dispositionPrice?: number;
  desiredWholesaleProfit?: number;
  priceReductionAlert: string;
  forSaleBy: string;
  feasibilityStudy?: any;
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
  ownerLLCName?: string | null;
  ownerPersonalName?: string | null;
  ownerAddress?: string | null;
  ownerPhones?: string[];
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
  website?: string;
  socialMedia?: string;
  socialMediaLinks?: string[] | any;
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
  source: 'buyer' | 'agent' | 'wholesaler';
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
  subject?: string;
  lastMessage: string;
  timestamp: string;
  unread: boolean;
  type: 'SMS' | 'Email';
  direction: 'inbound' | 'outbound';
  body?: string;
  bodyPreview?: string;
  bodyType?: 'html' | 'text';
  toRecipients?: { name?: string; address: string }[];
  msEmailData?: any;
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

export interface OffMarketProperty {
  id: number;
  created_at?: string | null;
  'Address'?: string | null;
  'City'?: string | null;
  'State'?: string | null;
  'Zip'?: number | string | null;
  'County'?: string | null;
  'Estimated Value'?: number | string | null;
  'Zillow Estimate'?: number | string | null;
  'Estimated Equity Percent'?: number | string | null;
  'Estimated Equity'?: number | string | null;
  'Living Square Feet'?: number | string | null;
  'Year Built'?: number | string | null;
  'Lot (Acres)'?: number | string | null;
  'Lot (Square Feet)'?: number | string | null;
  'Land Use'?: string | null;
  'Property Type'?: string | null;
  'Property Use'?: string | null;
  'Subdivision'?: string | null;
  'APN'?: number | string | null;
  'Legal Description'?: string | null;
  'Units Count'?: number | string | null;
  'Bedrooms'?: number | string | null;
  'Bathrooms'?: number | string | null;
  '# of Stories'?: number | string | null;
  'Garage Type'?: string | null;
  'Garage Square Feet'?: number | string | null;
  'Carport'?: string | null;
  'Carport Area'?: number | string | null;
  'Air Conditioning Type'?: string | null;
  'Heating Type'?: string | null;
  '# of Fireplaces'?: number | string | null;
  'Owner 1 First Name'?: string | null;
  'Owner 1 Last Name'?: string | null;
  'Owner 1 Phone Number 1'?: string | null;
  'Owner 1 Phone Number 2'?: string | null;
  'Owner 1 Phone Number 3'?: string | null;
  'Owner 2 First Name'?: string | null;
  'Owner 2 Last Name'?: string | null;
  'Owner 2 Phone Number 1'?: string | null;
  'Owner 2 Phone Number 2'?: string | null;
  'Owner 2 Phone Number 3'?: string | null;
  'Owner 3 First Name'?: string | null;
  'Owner 3 Last Name'?: string | null;
  'Owner 3 Phone Number 1'?: string | null;
  'Owner 3 Phone Number 2'?: string | null;
  'Owner 3 Phone Number 3'?: string | null;
  'Owner 4 First Name'?: string | null;
  'Owner 4 Last Name'?: string | null;
  'Owner 4 Phone Number 1'?: string | null;
  'Owner 4 Phone Number 2'?: string | null;
  'Owner 4 Phone Number 3'?: string | null;
  'Owner Mailing Address'?: string | null;
  'Owner Mailing City'?: string | null;
  'Owner Mailing State'?: string | null;
  'Owner Mailing Zip'?: number | string | null;
  'Ownership Length (Months)'?: number | string | null;
  'Owner Type'?: string | null;
  'Owner Occupied'?: number | string | null;
  'Vacant?'?: number | string | null;
  'Last Sale Date'?: string | null;
  'Last Sale Amount'?: number | string | null;
  'Open Mortgage Balance'?: number | string | null;
  'Recorded Mortgage Interest Rate'?: string | null;
  'Mortgage Document Date'?: string | null;
  'Mortgage Loan Type'?: string | null;
  'Lender Name'?: string | null;
  'Deed Type'?: string | null;
  'Position'?: string | null;
  'Tax Amount'?: string | null;
  'Assessment Year'?: number | string | null;
  'Assessed Total Value'?: number | string | null;
  'Assessed Land Value'?: number | string | null;
  'Assessed Improvement Value'?: number | string | null;
  'Assessed Improvement Percentage'?: string | null;
  'Market Value'?: number | string | null;
  'Market Land Value'?: number | string | null;
  'Market Improvement Value'?: number | string | null;
  'Market Improvement Percentage'?: string | null;
  'Status'?: string | null;
  'Default Amount'?: number | string | null;
  'Opening bid'?: number | string | null;
  'Recording Date'?: string | null;
  'Auction Date'?: string | null;
  'Auction Time'?: string | null;
  'Auction Courthouse'?: string | null;
  'Auction Address'?: string | null;
  'Auction City State'?: string | null;
  'Interested'?: boolean | null;
  "I'm Not Interested"?: boolean | null;
  'Owner Not Interested'?: boolean | null;
  'Off Market List'?: string[] | null;
  'Trash'?: boolean | null;
  'My Estimated Offer'?: number | string | null;
  'Notes'?: string | string[] | null;
  'Text Message Generator'?: string | { message?: string; selectedOwner?: number; selectedTemplate?: number } | null;
  'Text Message Sent'?: boolean | null;
  'TMS Date and Time'?: string | null;
  'Owner Called'?: boolean | null;
  'Called Date and Time'?: string | null;
  'Text Message Templates'?: Record<string, any> | string[] | null;
}


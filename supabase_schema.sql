-- Supabase SQL Script to create necessary tables and fields for AZRE DealDesk

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Users Table
CREATE TABLE IF NOT EXISTS public."Users" (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT,
    position TEXT,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "loginStatus" TEXT,
    photo TEXT,
    signature TEXT
);

-- 2. Deals Table
CREATE TABLE IF NOT EXISTS public."Deals" (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    address TEXT NOT NULL,
    mls TEXT,
    "listPrice" NUMERIC,
    "offerPrice" NUMERIC,
    "agentName" TEXT,
    "agentPhone" TEXT,
    "agentEmail" TEXT,
    "agentBrokerage" TEXT,
    "secondAgentId" UUID,
    "thirdAgentId" UUID,
    "acquisitionManager" TEXT,
    status TEXT,
    "offerDecision" TEXT,
    "subMarket" TEXT,
    neighborhood TEXT,
    "dealType" JSONB DEFAULT '[]'::jsonb,
    "interestLevel" TEXT,
    logs JSONB DEFAULT '[]'::jsonb,
    "inspectionDate" DATE,
    "emdDate" DATE,
    "underContractDate" DATE,
    "closedDate" DATE,
    "declinedDate" DATE,
    "nextFollowUpDate" DATE,
    "lastContactDate" DATE,
    dispo JSONB DEFAULT '{"photos": false, "blast": false}'::jsonb,
    "listingDescription" TEXT,
    "originalAskingPrice" NUMERIC,
    "reducedAskingPrice" NUMERIC,
    "negotiatedAskingPrice" NUMERIC,
    "desiredWholesaleProfit" NUMERIC,
    "priceReductionAlert" TEXT,
    "forSaleBy" TEXT,
    "listingStatus" TEXT,
    "contactStatus" TEXT,
    "agentContacted" TEXT,
    "propertyType" TEXT,
    "listingType" TEXT,
    "yearBuilt" INTEGER,
    bedrooms INTEGER,
    bathrooms NUMERIC,
    sqft INTEGER,
    "lotSqft" INTEGER,
    county TEXT,
    zoning TEXT,
    "lockBoxCode" TEXT,
    "dateListed" DATE,
    arv NUMERIC,
    "newConstructionArv" NUMERIC,
    "newConstructionEstimate" NUMERIC,
    "renovationEstimate" NUMERIC,
    comparable1 JSONB,
    comparable2 JSONB,
    comparable3 JSONB,
    "newConstructionComparable1" JSONB,
    "newConstructionComparable2" JSONB,
    "newConstructionComparable3" JSONB,
    photos JSONB DEFAULT '[]'::jsonb,
    "picturesFolderId" TEXT,
    "excludeStreetView" BOOLEAN DEFAULT false
);

-- 3. Agents Table
CREATE TABLE IF NOT EXISTS public."Agents" (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    brokerage TEXT,
    "brokeragePhone" TEXT,
    "brokerageEmail" TEXT,
    "brokerageAddress" TEXT,
    notes JSONB DEFAULT '[]'::jsonb,
    "lastContactDate" DATE,
    "nextFollowUpDate" DATE,
    photo TEXT,
    "hasBeenContacted" BOOLEAN DEFAULT false,
    "handlesInvestments" BOOLEAN DEFAULT false,
    "agreedToSend" BOOLEAN DEFAULT false,
    "hasClosedDeals" BOOLEAN DEFAULT false,
    "doNotCall" BOOLEAN DEFAULT false,
    "closedDealIds" JSONB DEFAULT '[]'::jsonb,
    "subscriptionStatus" TEXT DEFAULT 'Subscribed'
);

-- 4. Wholesalers Table
CREATE TABLE IF NOT EXISTS public."Wholesalers" (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    "companyName" TEXT,
    phone TEXT,
    email TEXT,
    status TEXT,
    "wholesalerType" TEXT,
    properties JSONB DEFAULT '[]'::jsonb,
    notes JSONB DEFAULT '[]'::jsonb,
    "lastContactDate" DATE,
    "nextFollowUpDate" DATE,
    photo TEXT,
    "closedDealIds" JSONB DEFAULT '[]'::jsonb,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "subscriptionStatus" TEXT DEFAULT 'Subscribed'
);

-- 5. Brokerages Table
CREATE TABLE IF NOT EXISTS public."Brokerages" (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Buyers Table
CREATE TABLE IF NOT EXISTS public."Buyers" (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "dateAdded" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    name TEXT NOT NULL,
    "companyName" TEXT,
    phone TEXT,
    email TEXT,
    status TEXT,
    "subscriptionStatus" TEXT DEFAULT 'Subscribed',
    "propertiesBought" INTEGER DEFAULT 0,
    "buyBox" JSONB,
    notes JSONB DEFAULT '[]'::jsonb,
    photo TEXT,
    "nextFollowUpDate" DATE,
    "lastContactDate" DATE,
    about TEXT
);

-- 7. Contacts Table
CREATE TABLE IF NOT EXISTS public."Contacts" (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    name TEXT NOT NULL,
    type TEXT,
    phone TEXT,
    email TEXT,
    company TEXT,
    address TEXT,
    notes TEXT
);

-- 8. EmailLists Table
CREATE TABLE IF NOT EXISTS public."EmailLists" (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    source TEXT,
    type TEXT,
    "segmentRule" TEXT,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 9. Campaigns Table
CREATE TABLE IF NOT EXISTS public."Campaigns" (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    type TEXT,
    status TEXT,
    "audienceSize" INTEGER DEFAULT 0,
    sent INTEGER DEFAULT 0,
    delivered INTEGER DEFAULT 0,
    responses INTEGER DEFAULT 0,
    "startDate" TIMESTAMP WITH TIME ZONE,
    "templateId" TEXT,
    subject TEXT,
    from_email TEXT,
    lists JSONB,
    tags JSONB,
    send_at TEXT,
    content_type TEXT,
    body TEXT,
    alt_body TEXT,
    "deliveryLogs" JSONB,
    "sentAt" TEXT,
    "recipientCount" INTEGER,
    last_updated TEXT
);

-- 10. InboxMessages Table
CREATE TABLE IF NOT EXISTS public."InboxMessages" (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "contactName" TEXT NOT NULL,
    "contactPhone" TEXT,
    "contactEmail" TEXT,
    "propertyAddress" TEXT,
    "lastMessage" TEXT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    unread BOOLEAN DEFAULT true,
    type TEXT,
    direction TEXT
);

-- 11. OfferTemplates Table
CREATE TABLE IF NOT EXISTS public."OfferTemplates" (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    type TEXT,
    "emailBody" TEXT,
    "smsBody" TEXT,
    "loiBody" TEXT
);

-- 12. MarketData Table
CREATE TABLE IF NOT EXISTS public."MarketData" (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    city TEXT NOT NULL,
    state TEXT NOT NULL,
    "medianPrice" NUMERIC,
    inventory INTEGER,
    "daysOnMarket" INTEGER,
    "marketOpportunityScore" NUMERIC,
    "priceGrowth" NUMERIC,
    "capRate" NUMERIC,
    "jobGrowth" NUMERIC
);

-- 13. ActivityLogs Table
CREATE TABLE IF NOT EXISTS public."ActivityLogs" (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID,
    user_name TEXT,
    action_type TEXT,
    entity_type TEXT,
    entity_id UUID,
    description TEXT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Set up Row Level Security (RLS) - Optional but recommended
-- Example: Allow all authenticated users to read/write (adjust based on your security needs)
/*
ALTER TABLE public."Users" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all authenticated users" ON public."Users" FOR ALL USING (auth.role() = 'authenticated');

-- Repeat for other tables...
*/

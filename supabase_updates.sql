-- SQL Script to update Supabase tables for new Deal fields and Activity Logging

-- 1. Update Deals table with missing columns
ALTER TABLE public."Deals"
ADD COLUMN IF NOT EXISTS "secondAgentId" TEXT,
ADD COLUMN IF NOT EXISTS "thirdAgentId" TEXT,
ADD COLUMN IF NOT EXISTS "neighborhood" TEXT,
ADD COLUMN IF NOT EXISTS "underContractDate" TEXT,
ADD COLUMN IF NOT EXISTS "closedDate" TEXT,
ADD COLUMN IF NOT EXISTS "declinedDate" TEXT,
ADD COLUMN IF NOT EXISTS "originalAskingPrice" NUMERIC,
ADD COLUMN IF NOT EXISTS "reducedAskingPrice" NUMERIC,
ADD COLUMN IF NOT EXISTS "negotiatedAskingPrice" NUMERIC,
ADD COLUMN IF NOT EXISTS "desiredWholesaleProfit" NUMERIC,
ADD COLUMN IF NOT EXISTS "priceReductionAlert" TEXT,
ADD COLUMN IF NOT EXISTS "listingType" TEXT,
ADD COLUMN IF NOT EXISTS "forSaleBy" TEXT,
ADD COLUMN IF NOT EXISTS "propertyType" TEXT,
ADD COLUMN IF NOT EXISTS "yearBuilt" NUMERIC,
ADD COLUMN IF NOT EXISTS "bedrooms" NUMERIC,
ADD COLUMN IF NOT EXISTS "bathrooms" NUMERIC,
ADD COLUMN IF NOT EXISTS "sqft" NUMERIC,
ADD COLUMN IF NOT EXISTS "lotSqft" NUMERIC,
ADD COLUMN IF NOT EXISTS "dateListed" TEXT,
ADD COLUMN IF NOT EXISTS "zoning" TEXT,
ADD COLUMN IF NOT EXISTS "county" TEXT,
ADD COLUMN IF NOT EXISTS "lockBoxCode" TEXT,
ADD COLUMN IF NOT EXISTS "listingDescription" TEXT,
ADD COLUMN IF NOT EXISTS "arv" NUMERIC,
ADD COLUMN IF NOT EXISTS "newConstructionArv" NUMERIC,
ADD COLUMN IF NOT EXISTS "newConstructionEstimate" NUMERIC,
ADD COLUMN IF NOT EXISTS "renovationEstimate" NUMERIC,
ADD COLUMN IF NOT EXISTS "comparable1" JSONB,
ADD COLUMN IF NOT EXISTS "comparable2" JSONB,
ADD COLUMN IF NOT EXISTS "comparable3" JSONB,
ADD COLUMN IF NOT EXISTS "newConstructionComparable1" JSONB,
ADD COLUMN IF NOT EXISTS "newConstructionComparable2" JSONB,
ADD COLUMN IF NOT EXISTS "newConstructionComparable3" JSONB,
ADD COLUMN IF NOT EXISTS "contactStatus" TEXT,
ADD COLUMN IF NOT EXISTS "photos" JSONB,
ADD COLUMN IF NOT EXISTS "dealType" JSONB,
ADD COLUMN IF NOT EXISTS "logs" JSONB,
ADD COLUMN IF NOT EXISTS "picturesFolderId" TEXT,
ADD COLUMN IF NOT EXISTS "excludeStreetView" BOOLEAN,
ADD COLUMN IF NOT EXISTS "dispo" JSONB,
ADD COLUMN IF NOT EXISTS "agentContacted" TEXT,
ADD COLUMN IF NOT EXISTS "listingStatus" TEXT;

-- 2. Update Agents table with missing columns
ALTER TABLE public."Agents"
ADD COLUMN IF NOT EXISTS "hasBeenContacted" BOOLEAN,
ADD COLUMN IF NOT EXISTS "handlesInvestments" BOOLEAN,
ADD COLUMN IF NOT EXISTS "agreedToSend" BOOLEAN,
ADD COLUMN IF NOT EXISTS "hasClosedDeals" BOOLEAN,
ADD COLUMN IF NOT EXISTS "closedDealIds" JSONB,
ADD COLUMN IF NOT EXISTS "subscriptionStatus" TEXT;

-- 3. Update Wholesalers table with missing columns
ALTER TABLE public."Wholesalers"
ADD COLUMN IF NOT EXISTS "wholesalerType" TEXT,
ADD COLUMN IF NOT EXISTS "properties" JSONB,
ADD COLUMN IF NOT EXISTS "closedDealIds" JSONB,
ADD COLUMN IF NOT EXISTS "subscriptionStatus" TEXT;

-- 4. Update Buyers table with missing columns
ALTER TABLE public."Buyers"
ADD COLUMN IF NOT EXISTS "subscriptionStatus" TEXT,
ADD COLUMN IF NOT EXISTS "buyBox" JSONB,
ADD COLUMN IF NOT EXISTS "about" TEXT,
ADD COLUMN IF NOT EXISTS "dateAdded" TEXT;

-- 5. Create EmailLists table if it doesn't exist
CREATE TABLE IF NOT EXISTS public."EmailLists" (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    source TEXT NOT NULL,
    type TEXT NOT NULL,
    "segmentRule" TEXT,
    "createdAt" TEXT
);

-- 6. Create activity_logs table
CREATE TABLE IF NOT EXISTS public.activity_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id TEXT NOT NULL,
    user_name TEXT,
    action_type TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    entity_display TEXT,
    description TEXT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- If the table was created previously with 'details' instead of 'metadata', rename it
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'activity_logs' 
    AND column_name = 'details'
  ) THEN
    ALTER TABLE public.activity_logs RENAME COLUMN details TO metadata;
  END IF;
END
$$;

-- If user_id was UUID, change to TEXT to avoid casting issues with custom auth
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'activity_logs' 
    AND column_name = 'user_id'
    AND data_type = 'uuid'
  ) THEN
    ALTER TABLE public.activity_logs ALTER COLUMN user_id TYPE TEXT USING user_id::text;
  END IF;
END
$$;

-- Add indexes for common queries on activity_logs
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON public.activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_entity_type_id ON public.activity_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON public.activity_logs(created_at DESC);

-- Enable Row Level Security (RLS) for activity_logs
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- Create policies for activity_logs
-- Drop existing policies first to make the script idempotent
DROP POLICY IF EXISTS "Allow authenticated users to read activity logs" ON public.activity_logs;
DROP POLICY IF EXISTS "Allow authenticated users to insert activity logs" ON public.activity_logs;
DROP POLICY IF EXISTS "Allow public to read activity logs" ON public.activity_logs;
DROP POLICY IF EXISTS "Allow public to insert activity logs" ON public.activity_logs;
DROP POLICY IF EXISTS "Allow public to update activity logs" ON public.activity_logs;

-- Since the app uses a custom Users table and not Supabase Auth for all users,
-- we must allow public access to the activity_logs table so the app can read/write.
CREATE POLICY "Allow public to read activity logs"
ON public.activity_logs
FOR SELECT
TO public
USING (true);

CREATE POLICY "Allow public to insert activity logs"
ON public.activity_logs
FOR INSERT
TO public
WITH CHECK (true);

CREATE POLICY "Allow public to update activity logs"
ON public.activity_logs
FOR UPDATE
TO public
USING (true)
WITH CHECK (true);

-- Set up realtime for activity_logs
-- Use DO block to avoid error if table is already in publication
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
    AND schemaname = 'public'
    AND tablename = 'activity_logs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_logs;
  END IF;
END
$$;
ALTER TABLE "public"."Deals" ADD COLUMN IF NOT EXISTS "feasibilityStudy" text;

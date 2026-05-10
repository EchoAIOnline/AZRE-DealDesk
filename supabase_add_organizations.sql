-- Add organization_id to all tables to partition data
ALTER TABLE public."Users" ADD COLUMN IF NOT EXISTS organization_id TEXT;
ALTER TABLE public."Deals" ADD COLUMN IF NOT EXISTS organization_id TEXT;
ALTER TABLE public."JVDeals" ADD COLUMN IF NOT EXISTS organization_id TEXT;
ALTER TABLE public."Agents" ADD COLUMN IF NOT EXISTS organization_id TEXT;
ALTER TABLE public."Wholesalers" ADD COLUMN IF NOT EXISTS organization_id TEXT;
ALTER TABLE public."Brokerages" ADD COLUMN IF NOT EXISTS organization_id TEXT;
ALTER TABLE public."Buyers" ADD COLUMN IF NOT EXISTS organization_id TEXT;
ALTER TABLE public."Contacts" ADD COLUMN IF NOT EXISTS organization_id TEXT;
ALTER TABLE public."EmailLists" ADD COLUMN IF NOT EXISTS organization_id TEXT;
ALTER TABLE public."Campaigns" ADD COLUMN IF NOT EXISTS organization_id TEXT;
ALTER TABLE public."InboxMessages" ADD COLUMN IF NOT EXISTS organization_id TEXT;
ALTER TABLE public."OfferTemplates" ADD COLUMN IF NOT EXISTS organization_id TEXT;
ALTER TABLE public."MarketData" ADD COLUMN IF NOT EXISTS organization_id TEXT;
ALTER TABLE public."Integrations" ADD COLUMN IF NOT EXISTS organization_id TEXT;
ALTER TABLE public.activity_logs ADD COLUMN IF NOT EXISTS organization_id TEXT;
ALTER TABLE public.sender_emails ADD COLUMN IF NOT EXISTS organization_id TEXT;

-- For existing records without an organization, you might assign them to a default org
-- (Optional/Recommended if you want existing data to belong to org_azre_00001)
UPDATE public."Users" SET organization_id = 'org_azre_00001' WHERE organization_id IS NULL;
UPDATE public."Deals" SET organization_id = 'org_azre_00001' WHERE organization_id IS NULL;
UPDATE public."JVDeals" SET organization_id = 'org_azre_00001' WHERE organization_id IS NULL;
UPDATE public."Agents" SET organization_id = 'org_azre_00001' WHERE organization_id IS NULL;
UPDATE public."Wholesalers" SET organization_id = 'org_azre_00001' WHERE organization_id IS NULL;
UPDATE public."Brokerages" SET organization_id = 'org_azre_00001' WHERE organization_id IS NULL;
UPDATE public."Buyers" SET organization_id = 'org_azre_00001' WHERE organization_id IS NULL;
UPDATE public."Contacts" SET organization_id = 'org_azre_00001' WHERE organization_id IS NULL;
UPDATE public."EmailLists" SET organization_id = 'org_azre_00001' WHERE organization_id IS NULL;
UPDATE public."Campaigns" SET organization_id = 'org_azre_00001' WHERE organization_id IS NULL;
UPDATE public."InboxMessages" SET organization_id = 'org_azre_00001' WHERE organization_id IS NULL;
UPDATE public."OfferTemplates" SET organization_id = 'org_azre_00001' WHERE organization_id IS NULL;
UPDATE public."MarketData" SET organization_id = 'org_azre_00001' WHERE organization_id IS NULL;
UPDATE public."Integrations" SET organization_id = 'org_azre_00001' WHERE organization_id IS NULL;
UPDATE public.activity_logs SET organization_id = 'org_azre_00001' WHERE organization_id IS NULL;
UPDATE public.sender_emails SET organization_id = 'org_azre_00001' WHERE organization_id IS NULL;

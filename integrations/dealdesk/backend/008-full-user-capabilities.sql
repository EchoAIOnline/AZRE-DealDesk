-- Full user capabilities expansion across Deals, JVDeals, Buyers, Agents, Wholesalers,
-- OffMarketProperties, OffMarketOfferTextMessageGenerator, PluginTasks, and CRM workspace tables.
-- Repeatable and non-destructive: no existing business rows are edited or deleted.
BEGIN;

-- 1. Ensure all user Deals & JVDeals columns exist
CREATE TABLE IF NOT EXISTS public."JVDeals" (
  id text PRIMARY KEY,
  organization_id text,
  "pipelineType" text DEFAULT 'dfd',
  "createdAt" text,
  address text,
  mls text,
  "listPrice" numeric,
  "offerPrice" numeric,
  "agentName" text,
  "agentPhone" text,
  "agentEmail" text,
  "agentBrokerage" text,
  "secondAgentId" text,
  "thirdAgentId" text,
  "acquisitionManager" text,
  status text,
  "offerDecision" text,
  "subMarket" text,
  neighborhood text,
  "dealType" jsonb DEFAULT '[]'::jsonb,
  "interestLevel" text,
  logs jsonb DEFAULT '[]'::jsonb,
  "inspectionDate" text,
  "emdDate" text,
  "underContractDate" text,
  "closedDate" text,
  "declinedDate" text,
  "nextFollowUpDate" text,
  "lastContactDate" text,
  dispo jsonb DEFAULT '{"photos": false, "blast": false}'::jsonb,
  "listingDescription" text,
  "originalAskingPrice" numeric,
  "reducedAskingPrice" numeric,
  "negotiatedAskingPrice" numeric,
  "desiredWholesaleProfit" numeric,
  "priceReductionAlert" text,
  "forSaleBy" text,
  "listingStatus" text,
  "contactStatus" text,
  "agentContacted" text,
  "propertyType" text,
  "listingType" text,
  "yearBuilt" numeric,
  bedrooms numeric,
  bathrooms numeric,
  sqft numeric,
  "lotSqft" numeric,
  county text,
  zoning text,
  "lockBoxCode" text,
  "dateListed" text,
  arv numeric,
  "newConstructionArv" numeric,
  "newConstructionEstimate" numeric,
  "renovationEstimate" numeric,
  comparable1 jsonb,
  comparable2 jsonb,
  comparable3 jsonb,
  "newConstructionComparable1" jsonb,
  "newConstructionComparable2" jsonb,
  "newConstructionComparable3" jsonb,
  photos jsonb DEFAULT '[]'::jsonb,
  "picturesFolderId" text,
  "excludeStreetView" boolean DEFAULT false
);

DO $$ DECLARE tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['Deals','JVDeals'] LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS "queueStatus" text', tbl);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS "pipelineType" text', tbl);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS "renovationARV" numeric', tbl);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS "newConstructionARV" numeric', tbl);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS "renovationARVToggle" boolean', tbl);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS "newConstructionARVToggle" boolean', tbl);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS "arvCalculationType" text', tbl);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS "offerDecisionTracking" jsonb DEFAULT ''[]''::jsonb', tbl);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS "documents" jsonb DEFAULT ''[]''::jsonb', tbl);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS "motivationSignals" jsonb DEFAULT ''[]''::jsonb', tbl);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS "renovationWorkflow" jsonb', tbl);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS "renovationComparable1" jsonb', tbl);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS "renovationComparable2" jsonb', tbl);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS "renovationComparable3" jsonb', tbl);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS "maximumOffer" numeric', tbl);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS "sellerCounterOffer" numeric', tbl);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS "dispositionPrice" numeric', tbl);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS "agentBrokerPhone" text', tbl);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS "feasibilityStudy" text', tbl);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS "loiSent" boolean', tbl);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS "loiSentDate" text', tbl);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS "loiSentBy" text', tbl);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS "ownerLLCName" text', tbl);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS "ownerPersonalName" text', tbl);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS "ownerAddress" text', tbl);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS "ownerPhones" jsonb', tbl);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS "interestedBuyers" jsonb DEFAULT ''[]''::jsonb', tbl);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS "buyersWhoPassed" jsonb DEFAULT ''[]''::jsonb', tbl);
  END LOOP;
END $$;

-- 2. Ensure all user Agents columns exist
ALTER TABLE public."Agents" ADD COLUMN IF NOT EXISTS "agentFirstName" text;
ALTER TABLE public."Agents" ADD COLUMN IF NOT EXISTS "agentLastName" text;
ALTER TABLE public."Agents" ADD COLUMN IF NOT EXISTS "spokeWithAgent" boolean DEFAULT false;
ALTER TABLE public."Agents" ADD COLUMN IF NOT EXISTS "investorFriendly" boolean DEFAULT false;
ALTER TABLE public."Agents" ADD COLUMN IF NOT EXISTS "loiSent" boolean DEFAULT false;
ALTER TABLE public."Agents" ADD COLUMN IF NOT EXISTS "loiSentDate" text;
ALTER TABLE public."Agents" ADD COLUMN IF NOT EXISTS "sentTextToAgent" boolean DEFAULT false;
ALTER TABLE public."Agents" ADD COLUMN IF NOT EXISTS "agentRespondedToText" boolean DEFAULT false;
ALTER TABLE public."Agents" ADD COLUMN IF NOT EXISTS "agentSentDeal" boolean DEFAULT false;
ALTER TABLE public."Agents" ADD COLUMN IF NOT EXISTS "agentRelationshipDates" jsonb;
ALTER TABLE public."Agents" ADD COLUMN IF NOT EXISTS "acquisitionManager" text;

ALTER TABLE public."PluginTasks" DROP CONSTRAINT IF EXISTS "PluginTasks_entityType_check";
ALTER TABLE public."PluginTasks" ADD CONSTRAINT "PluginTasks_entityType_check" CHECK ("entityType" IN ('Deals','JVDeals','Buyers','Agents','Wholesalers'));

-- 3. Ensure all user OffMarketProperties columns & templates table exist
ALTER TABLE public."OffMarketProperties" ADD COLUMN IF NOT EXISTS "Text Message Generator" jsonb;
ALTER TABLE public."OffMarketProperties" ADD COLUMN IF NOT EXISTS "Text Message Templates" jsonb;
ALTER TABLE public."OffMarketProperties" ADD COLUMN IF NOT EXISTS "Assessed Land Value" numeric;
ALTER TABLE public."OffMarketProperties" ADD COLUMN IF NOT EXISTS "Assessed Improvement Value" numeric;
ALTER TABLE public."OffMarketProperties" ADD COLUMN IF NOT EXISTS "Assessed Improvement Percentage" text;
ALTER TABLE public."OffMarketProperties" ADD COLUMN IF NOT EXISTS "Market Land Value" numeric;
ALTER TABLE public."OffMarketProperties" ADD COLUMN IF NOT EXISTS "Market Improvement Value" numeric;
ALTER TABLE public."OffMarketProperties" ADD COLUMN IF NOT EXISTS "Market Improvement Percentage" text;
ALTER TABLE public."OffMarketProperties" ADD COLUMN IF NOT EXISTS "Owner 2 Phone Number 2" text;
ALTER TABLE public."OffMarketProperties" ADD COLUMN IF NOT EXISTS "Owner 2 Phone Number 3" text;
ALTER TABLE public."OffMarketProperties" ADD COLUMN IF NOT EXISTS "Owner 3 First Name" text;
ALTER TABLE public."OffMarketProperties" ADD COLUMN IF NOT EXISTS "Owner 3 Last Name" text;
ALTER TABLE public."OffMarketProperties" ADD COLUMN IF NOT EXISTS "Owner 3 Phone Number 1" text;
ALTER TABLE public."OffMarketProperties" ADD COLUMN IF NOT EXISTS "Owner 3 Phone Number 2" text;
ALTER TABLE public."OffMarketProperties" ADD COLUMN IF NOT EXISTS "Owner 3 Phone Number 3" text;
ALTER TABLE public."OffMarketProperties" ADD COLUMN IF NOT EXISTS "Owner 4 First Name" text;
ALTER TABLE public."OffMarketProperties" ADD COLUMN IF NOT EXISTS "Owner 4 Last Name" text;
ALTER TABLE public."OffMarketProperties" ADD COLUMN IF NOT EXISTS "Owner 4 Phone Number 1" text;
ALTER TABLE public."OffMarketProperties" ADD COLUMN IF NOT EXISTS "Owner 4 Phone Number 2" text;
ALTER TABLE public."OffMarketProperties" ADD COLUMN IF NOT EXISTS "Owner 4 Phone Number 3" text;

CREATE TABLE IF NOT EXISTS public."OffMarketOfferTextMessageGenerator" (
  id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  "Text Message Template 1" text,
  "Text Message Template 2" text,
  "Text Message Template 3" text,
  "Text Message Template 4" text
);

-- 4. Ensure remaining workspace CRM tables exist (when deploying onto clean/test DB)
CREATE TABLE IF NOT EXISTS public."Wholesalers" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  "companyName" text,
  phone text,
  email text,
  status text,
  "wholesalerType" text,
  properties jsonb DEFAULT '[]'::jsonb,
  notes jsonb DEFAULT '[]'::jsonb,
  "lastContactDate" date,
  "nextFollowUpDate" date,
  photo text,
  "closedDealIds" jsonb DEFAULT '[]'::jsonb,
  "createdAt" timestamptz DEFAULT now(),
  "subscriptionStatus" text DEFAULT 'Subscribed'
);
CREATE TABLE IF NOT EXISTS public."Brokerages" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text,
  email text,
  "createdAt" timestamptz DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public."Contacts" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  name text NOT NULL,
  type text,
  phone text,
  email text,
  company text,
  address text,
  notes text
);
CREATE TABLE IF NOT EXISTS public."EmailLists" (
  id text PRIMARY KEY,
  name text NOT NULL,
  source text,
  type text,
  "segmentRule" text,
  "createdAt" text
);
CREATE TABLE IF NOT EXISTS public."Campaigns" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text,
  status text,
  "audienceSize" integer DEFAULT 0,
  sent integer DEFAULT 0,
  delivered integer DEFAULT 0,
  responses integer DEFAULT 0,
  "startDate" timestamptz,
  "templateId" text,
  subject text,
  from_email text,
  lists jsonb,
  tags jsonb,
  send_at text,
  content_type text,
  body text,
  alt_body text,
  "deliveryLogs" jsonb,
  "sentAt" text,
  "recipientCount" integer,
  last_updated text
);
CREATE TABLE IF NOT EXISTS public."EmailTemplates" (
  id text PRIMARY KEY,
  name text NOT NULL,
  type text,
  html_content text,
  is_default boolean DEFAULT false,
  last_updated text
);
CREATE TABLE IF NOT EXISTS public."OfferTemplates" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text,
  "emailBody" text,
  "smsBody" text,
  "loiBody" text
);
CREATE TABLE IF NOT EXISTS public.sender_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  name text,
  is_default boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  user_name text,
  action_type text NOT NULL,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  entity_display text,
  description text,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public."InboxMessages" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "contactName" text NOT NULL,
  "contactPhone" text,
  "contactEmail" text,
  "propertyAddress" text,
  "lastMessage" text,
  timestamp timestamptz DEFAULT now(),
  unread boolean DEFAULT true,
  type text,
  direction text
);
CREATE TABLE IF NOT EXISTS public."MarketData" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city text NOT NULL,
  state text NOT NULL,
  "medianPrice" numeric,
  inventory integer,
  "daysOnMarket" integer,
  "marketOpportunityScore" numeric,
  "priceGrowth" numeric,
  "capRate" numeric,
  "jobGrowth" numeric
);
CREATE TABLE IF NOT EXISTS public."Integrations" (
  id text PRIMARY KEY,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  "supabaseUrl" text,
  "supabaseKey" text,
  "mlsApiKey" text,
  "twilioAccountSid" text,
  "twilioAuthToken" text,
  "twilioPhoneNumber" text,
  organization text,
  "inviteCode" text
);

-- 5. Add plugin tenancy, revision, archive & audit triggers cleanly to all expanded tables
DO $$ DECLARE tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'JVDeals','Wholesalers','OffMarketProperties','OffMarketOfferTextMessageGenerator',
    'Brokerages','Contacts','EmailLists','Campaigns','EmailTemplates','OfferTemplates',
    'sender_emails','activity_logs','InboxMessages','MarketData','Integrations'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS organization_id text', tbl);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS "pluginRevision" bigint NOT NULL DEFAULT 0', tbl);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS "pluginArchivedAt" timestamptz', tbl);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS "pluginArchiveReason" text', tbl);
    EXECUTE format('DROP TRIGGER IF EXISTS dealdesk_plugin_revision ON public.%I', tbl);
    EXECUTE format('CREATE TRIGGER dealdesk_plugin_revision BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.dealdesk_plugin_revision()', tbl);
    EXECUTE format('DROP TRIGGER IF EXISTS dealdesk_plugin_audit ON public.%I', tbl);
    EXECUTE format('CREATE TRIGGER dealdesk_plugin_audit AFTER INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.dealdesk_plugin_audit()', tbl);
  END LOOP;
END $$;

-- 6. Service audit helper RPC (for send_email / non-table side effects)
CREATE OR REPLACE FUNCTION public.dealdesk_log_service_audit(
  p_tool text,
  p_entity_type text,
  p_entity_id text,
  p_request_body jsonb,
  p_result jsonb,
  p_user uuid,
  p_client text,
  p_session text,
  p_request uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  org constant text := 'org_azre_00001';
  replay public."PluginMutationAudit"%ROWTYPE;
BEGIN
  IF p_session IS NULL OR length(p_session)=0 OR NOT EXISTS(
    SELECT 1 FROM public."PluginOAuthGrants"
    WHERE user_id=p_user AND client_id=p_client AND organization_id=org
      AND resource='https://dealdesk.asharizakargroup.com/api/mcp' AND enabled AND operational_writes
  ) THEN
    RETURN jsonb_build_object('error',jsonb_build_object('code','WRITES_DISABLED','message','Operational editing is not approved for this identity.'));
  END IF;

  IF p_request IS NOT NULL THEN
    SELECT * INTO replay FROM public."PluginMutationAudit" WHERE user_id=p_user AND client_id=p_client AND request_id=p_request;
    IF FOUND THEN
      IF replay.request_body=p_request_body THEN RETURN replay.result||jsonb_build_object('replayed',true); END IF;
      RETURN jsonb_build_object('error',jsonb_build_object('code','REQUEST_ID_REUSED','message','This request_id was used for a different operation.'));
    END IF;
  END IF;

  INSERT INTO public."PluginMutationAudit"(organization_id,user_id,client_id,session_id,tool,entity_type,entity_id,changed_fields,previous_values,new_values,resulting_revision,supplied_fields,request_id,request_body,result)
  VALUES(org,p_user,p_client,p_session,p_tool,p_entity_type,p_entity_id,ARRAY[p_tool],'{}'::jsonb,coalesce(p_result,'{}'::jsonb),0,coalesce(p_request_body,'{}'::jsonb),p_request,p_request_body,p_result);

  RETURN coalesce(p_result,'{}'::jsonb);
END $$;

REVOKE ALL ON FUNCTION public.dealdesk_log_service_audit(text,text,text,jsonb,jsonb,uuid,text,text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.dealdesk_log_service_audit(text,text,text,jsonb,jsonb,uuid,text,text,uuid) TO service_role;

-- 7. Expanded dealdesk_operational_mutation preserving 003/005/006/007 behavior + full user capabilities
CREATE OR REPLACE FUNCTION public.dealdesk_operational_mutation(
  p_tool text,
  p_id text,
  p_patch jsonb,
  p_revision bigint,
  p_note text,
  p_category text,
  p_user uuid,
  p_client text,
  p_session text,
  p_request uuid DEFAULT NULL,
  p_source text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  org constant text := 'org_azre_00001';
  tbl text;
  target_tbl text;
  allowed text[];
  old_row jsonb := '{}';
  new_row jsonb;
  patch jsonb := coalesce(p_patch, '{}'::jsonb);
  cols text;
  expr text;
  changed text[];
  duplicates jsonb;
  notes jsonb;
  note text;
  note_col text;
  existing_box jsonb;
  merged_box jsonb;
  body jsonb;
  replay public."PluginMutationAudit"%ROWTYPE;
  result jsonb;
  has_queue boolean;
  is_bigint_pk boolean := false;
  is_create boolean := false;
  is_delete boolean := false;
  is_note boolean := false;
  move_target text;
  src_tbl text;
  dst_tbl text;
  moved_id text;
  clean_patch jsonb;
  supported_cols text[];
  ts_note text;
  ws_tables constant text[] := ARRAY['JVDeals','Wholesalers','Brokerages','Contacts','EmailLists','Campaigns','EmailTemplates','OfferTemplates','sender_emails','activity_logs','InboxMessages','MarketData','Integrations','OffMarketOfferTextMessageGenerator'];
  all_tables constant text[] := ARRAY['Deals','JVDeals','Buyers','Agents','Wholesalers','OffMarketProperties','OffMarketOfferTextMessageGenerator','PluginTasks','Brokerages','Contacts','EmailLists','Campaigns','EmailTemplates','OfferTemplates','sender_emails','activity_logs','InboxMessages','MarketData','Integrations'];
  deal_cols constant text[] := ARRAY[
    'queueStatus',
    'comparable1','comparable2','comparable3',
    'newConstructionComparable1','newConstructionComparable2','newConstructionComparable3',
    'renovationComparable1','renovationComparable2','renovationComparable3',
    'address','mls','listPrice','offerPrice','maximumOffer','sellerCounterOffer','dispositionPrice',
    'agentName','agentPhone','agentEmail','agentBrokerage','agentBrokerPhone','secondAgentId','thirdAgentId',
    'acquisitionManager','offerDecision','subMarket','neighborhood','county','dealType','propertyType',
    'listingDescription','originalAskingPrice','reducedAskingPrice','negotiatedAskingPrice','desiredWholesaleProfit',
    'renovationEstimate','newConstructionEstimate','renovationARV','newConstructionARV',
    'renovationARVToggle','newConstructionARVToggle','arvCalculationType',
    'bedrooms','bathrooms','sqft','lotSqft','yearBuilt',
    'nextFollowUpDate','lastContactDate','interestLevel','contactStatus','agentContacted','priceReductionAlert',
    'status','zoning','listingType','listingStatus','forSaleBy','dateListed','inspectionDate','emdDate',
    'underContractDate','closedDate','declinedDate','lockBoxCode','dispo','documents','motivationSignals',
    'renovationWorkflow','feasibilityStudy','photos','picturesFolderId','excludeStreetView',
    'loiSent','loiSentDate','loiSentBy','ownerLLCName','ownerPersonalName','ownerAddress','ownerPhones',
    'interestedBuyers','buyersWhoPassed'
  ];
  jv_cols constant text[] := deal_cols || ARRAY['pipelineType','queueStatus'];
  buyer_cols constant text[] := ARRAY['name','companyName','email','phone','status','subscriptionStatus','propertiesBought','buyBox','about','nextFollowUpDate','lastContactDate','website','socialMediaLinks','photo'];
  agent_cols constant text[] := ARRAY['name','agentFirstName','agentLastName','phone','email','brokerage','brokeragePhone','brokerageEmail','brokerageAddress','photo','spokeWithAgent','investorFriendly','agreedToSend','loiSent','loiSentDate','hasClosedDeals','sentTextToAgent','agentRespondedToText','agentSentDeal','agentRelationshipDates','closedDealIds','subscriptionStatus','acquisitionManager','doNotCall','nextFollowUpDate','lastContactDate'];
  wholesaler_cols constant text[] := ARRAY['name','companyName','phone','email','status','wholesalerType','properties','lastContactDate','nextFollowUpDate','photo','closedDealIds','subscriptionStatus'];
BEGIN
  IF p_session IS NULL OR length(p_session)=0 OR NOT EXISTS(
    SELECT 1 FROM public."PluginOAuthGrants"
    WHERE user_id=p_user AND client_id=p_client AND organization_id=org
      AND resource='https://dealdesk.asharizakargroup.com/api/mcp' AND enabled AND operational_writes
  ) THEN
    RETURN jsonb_build_object('error',jsonb_build_object('code','WRITES_DISABLED','message','Operational editing is not approved for this identity.'));
  END IF;

  IF p_tool NOT IN (
    'create_deal','update_deal','add_deal_note','delete_deal','move_deal',
    'create_jv_deal','update_jv_deal','add_jv_deal_note','delete_jv_deal',
    'create_buyer','update_buyer','add_buyer_note','delete_buyer',
    'create_agent','update_agent','add_agent_note','delete_agent',
    'create_wholesaler','update_wholesaler','add_wholesaler_note','delete_wholesaler',
    'move_contact',
    'create_off_market_property','update_off_market_property','delete_off_market_property','upsert_off_market_templates',
    'create_task','update_task','delete_task',
    'archive_record','restore_record',
    'create_workspace_record','update_workspace_record','delete_workspace_record'
  ) THEN
    RETURN jsonb_build_object('error',jsonb_build_object('code','TOOL_UNAVAILABLE','message','This operation is unavailable.'));
  END IF;

  IF p_source IS NOT NULL AND p_source<>p_tool
     AND NOT(p_source='import_from_zillow' AND p_tool='create_deal')
     AND NOT(p_source='update_offer' AND p_tool='update_deal')
     AND NOT(p_source='create_note' AND p_tool IN ('add_deal_note','add_jv_deal_note','add_buyer_note','add_agent_note','add_wholesaler_note')) THEN
    RAISE EXCEPTION 'Invalid source';
  END IF;

  IF jsonb_typeof(patch) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Invalid patch'; END IF;

  is_create := p_tool IN ('create_deal','create_jv_deal','create_buyer','create_agent','create_wholesaler','create_off_market_property','create_task','create_workspace_record');
  is_delete := p_tool IN ('delete_deal','delete_jv_deal','delete_buyer','delete_agent','delete_wholesaler','delete_off_market_property','delete_task','delete_workspace_record');
  is_note := p_tool IN ('add_deal_note','add_jv_deal_note','add_buyer_note','add_agent_note','add_wholesaler_note');

  tbl := CASE
    WHEN p_tool IN ('create_task','update_task','delete_task') THEN 'PluginTasks'
    WHEN p_tool IN ('create_jv_deal','update_jv_deal','add_jv_deal_note','delete_jv_deal') THEN 'JVDeals'
    WHEN p_tool IN ('create_buyer','update_buyer','add_buyer_note','delete_buyer') THEN 'Buyers'
    WHEN p_tool IN ('create_agent','update_agent','add_agent_note','delete_agent') THEN 'Agents'
    WHEN p_tool IN ('create_wholesaler','update_wholesaler','add_wholesaler_note','delete_wholesaler') THEN 'Wholesalers'
    WHEN p_tool IN ('create_off_market_property','update_off_market_property','delete_off_market_property') THEN 'OffMarketProperties'
    WHEN p_tool='upsert_off_market_templates' THEN 'OffMarketOfferTextMessageGenerator'
    WHEN p_tool IN ('archive_record','restore_record','create_workspace_record','update_workspace_record','delete_workspace_record') THEN patch->>'_table'
    WHEN p_tool='move_contact' THEN patch->>'source_table'
    ELSE 'Deals'
  END;

  IF tbl IS NULL OR NOT(tbl = ANY(all_tables)) THEN
    RETURN jsonb_build_object('error',jsonb_build_object('code','INVALID_REQUEST','message','Unsupported record table.'));
  END IF;
  IF p_tool IN ('create_workspace_record','update_workspace_record','delete_workspace_record') AND NOT(tbl = ANY(ws_tables)) THEN
    RETURN jsonb_build_object('error',jsonb_build_object('code','INVALID_REQUEST','message','Use the dedicated tool for this entity type or a supported workspace table.'));
  END IF;

  is_bigint_pk := tbl IN ('OffMarketProperties','OffMarketOfferTextMessageGenerator');

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(org||':operational',0));
  IF tbl='Deals' AND (p_tool='create_deal' OR patch ? 'address' OR patch ? 'mls') THEN
    LOCK TABLE public."Deals" IN SHARE ROW EXCLUSIVE MODE;
  END IF;
  IF tbl='Buyers' AND (p_tool='create_buyer' OR patch ? 'email' OR patch ? 'phone' OR patch ? 'name') THEN
    LOCK TABLE public."Buyers" IN SHARE ROW EXCLUSIVE MODE;
  END IF;

  body := jsonb_build_object(
    'tool',coalesce(p_source,p_tool),
    'patch',p_patch,
    'note',p_note,
    'category',p_category,
    'target',CASE WHEN is_note OR is_delete OR p_tool IN ('archive_record','restore_record','move_deal','move_contact') THEN p_id ELSE NULL END
  );

  IF p_request IS NOT NULL THEN
    SELECT * INTO replay FROM public."PluginMutationAudit" WHERE user_id=p_user AND client_id=p_client AND request_id=p_request;
    IF FOUND THEN
      IF replay.request_body=body THEN RETURN replay.result||jsonb_build_object('replayed',true); END IF;
      RETURN jsonb_build_object('error',jsonb_build_object('code','REQUEST_ID_REUSED','message','This request_id was used for a different operation.'));
    END IF;
  END IF;

  -- Unwrap workspace/template/offmarket patches or validate fixed allowlists
  IF p_tool IN ('create_workspace_record','update_workspace_record') THEN
    patch := coalesce(patch->'_fields','{}'::jsonb);
    IF jsonb_typeof(patch) IS DISTINCT FROM 'object' OR (SELECT count(*) FROM jsonb_object_keys(patch))=0 THEN
      RETURN jsonb_build_object('error',jsonb_build_object('code','INVALID_REQUEST','message','fields object must not be empty.'));
    END IF;
    IF patch ? 'organization_id' OR patch ? 'pluginRevision' OR patch ? 'pluginArchivedAt' OR patch ? 'pluginArchiveReason' THEN
      RETURN jsonb_build_object('error',jsonb_build_object('code','INVALID_REQUEST','message','Internal fields cannot be assigned directly.'));
    END IF;
    SELECT array_agg(column_name::text) INTO supported_cols FROM information_schema.columns WHERE table_schema='public' AND table_name=tbl;
    IF EXISTS(SELECT 1 FROM jsonb_object_keys(patch) k WHERE NOT(k=ANY(supported_cols))) THEN
      RETURN jsonb_build_object('error',jsonb_build_object('code','INVALID_REQUEST','message','Unsupported field for '||tbl||'.'));
    END IF;
  ELSIF tbl='OffMarketProperties' AND p_tool IN ('create_off_market_property','update_off_market_property') THEN
    IF patch ? 'organization_id' OR patch ? 'pluginRevision' OR patch ? 'pluginArchivedAt' OR patch ? 'pluginArchiveReason' OR patch ? 'id' THEN
      RETURN jsonb_build_object('error',jsonb_build_object('code','INVALID_REQUEST','message','Internal fields cannot be assigned directly.'));
    END IF;
    SELECT array_agg(column_name::text) INTO supported_cols FROM information_schema.columns WHERE table_schema='public' AND table_name='OffMarketProperties';
    IF EXISTS(SELECT 1 FROM jsonb_object_keys(patch) k WHERE NOT(k=ANY(supported_cols))) THEN
      RETURN jsonb_build_object('error',jsonb_build_object('code','INVALID_REQUEST','message','Unsupported OffMarketProperties field.'));
    END IF;
  ELSIF p_tool='upsert_off_market_templates' THEN
    allowed := ARRAY['Text Message Template 1','Text Message Template 2','Text Message Template 3','Text Message Template 4'];
    IF EXISTS(SELECT 1 FROM jsonb_object_keys(patch) k WHERE NOT(k=ANY(allowed))) THEN
      RETURN jsonb_build_object('error',jsonb_build_object('code','INVALID_REQUEST','message','Unsupported template field.'));
    END IF;
  ELSIF p_tool IN ('archive_record','restore_record','delete_workspace_record') OR is_delete THEN
    patch := '{}'::jsonb;
  ELSIF p_tool='move_deal' THEN
    move_target := patch->>'target_pipeline';
    IF move_target NOT IN ('mls','off-market','azre-queue','dfd') THEN
      RETURN jsonb_build_object('error',jsonb_build_object('code','INVALID_REQUEST','message','target_pipeline must be mls, off-market, azre-queue, or dfd.'));
    END IF;
  ELSIF p_tool='move_contact' THEN
    src_tbl := patch->>'source_table';
    dst_tbl := patch->>'target_table';
    IF src_tbl NOT IN ('Buyers','Agents','Wholesalers') OR dst_tbl NOT IN ('Buyers','Agents','Wholesalers') OR src_tbl=dst_tbl THEN
      RETURN jsonb_build_object('error',jsonb_build_object('code','INVALID_REQUEST','message','Provide distinct source_table and target_table among Buyers, Agents, Wholesalers.'));
    END IF;
  ELSE
    allowed := CASE
      WHEN is_note THEN ARRAY[]::text[]
      WHEN tbl='Deals' THEN deal_cols
      WHEN tbl='JVDeals' THEN jv_cols
      WHEN tbl='Buyers' THEN buyer_cols
      WHEN tbl='Agents' THEN agent_cols
      WHEN tbl='Wholesalers' THEN wholesaler_cols
      WHEN p_tool='create_task' THEN ARRAY['title','description','dueDate','assignee','status','priority','entityType','entityId']
      ELSE ARRAY['title','description','dueDate','assignee','status','priority']
    END;
    IF EXISTS(SELECT 1 FROM jsonb_object_keys(patch) k WHERE NOT(k=ANY(allowed))) THEN
      RETURN jsonb_build_object('error',jsonb_build_object('code','INVALID_REQUEST','message','Unsupported field.'));
    END IF;
  END IF;

  -- Locate existing row for non-create tools (move_deal searches Deals then JVDeals)
  IF p_tool='move_deal' THEN
    EXECUTE 'SELECT to_jsonb(t) FROM public."Deals" t WHERE id::text=$1 AND organization_id=$2 FOR UPDATE' INTO old_row USING p_id,org;
    src_tbl := 'Deals';
    IF old_row IS NULL THEN
      EXECUTE 'SELECT to_jsonb(t) FROM public."JVDeals" t WHERE id::text=$1 AND organization_id=$2 FOR UPDATE' INTO old_row USING p_id,org;
      src_tbl := 'JVDeals';
    END IF;
    IF old_row IS NULL THEN
      RETURN jsonb_build_object('error',jsonb_build_object('code','NOT_FOUND','message','Deal not found in this organization.'));
    END IF;
    IF old_row->>'pluginArchivedAt' IS NOT NULL THEN
      RETURN jsonb_build_object('error',jsonb_build_object('code','ARCHIVED','message','Archived records cannot be moved.'));
    END IF;
    IF p_revision IS NULL OR (old_row->>'pluginRevision')::bigint<>p_revision THEN
      RETURN jsonb_build_object('error',jsonb_build_object('code','CONFLICT','message','Record changed. Reread its current _revision and reconcile before retrying.'));
    END IF;
    tbl := src_tbl;
  ELSIF p_tool='delete_deal' THEN
    EXECUTE 'SELECT to_jsonb(t) FROM public."Deals" t WHERE id::text=$1 AND organization_id=$2 FOR UPDATE' INTO old_row USING p_id,org;
    tbl := 'Deals';
    IF old_row IS NULL THEN
      EXECUTE 'SELECT to_jsonb(t) FROM public."JVDeals" t WHERE id::text=$1 AND organization_id=$2 FOR UPDATE' INTO old_row USING p_id,org;
      tbl := 'JVDeals';
    END IF;
    IF old_row IS NULL THEN
      RETURN jsonb_build_object('error',jsonb_build_object('code','NOT_FOUND','message','Deal not found in this organization.'));
    END IF;
    IF p_revision IS NOT NULL AND (old_row->>'pluginRevision')::bigint<>p_revision THEN
      RETURN jsonb_build_object('error',jsonb_build_object('code','CONFLICT','message','Record changed. Reread its current _revision and reconcile before retrying.'));
    END IF;
  ELSIF p_tool='upsert_off_market_templates' THEN
    SELECT to_jsonb(t) INTO old_row FROM public."OffMarketOfferTextMessageGenerator" t WHERE organization_id=org ORDER BY id ASC LIMIT 1 FOR UPDATE;
    IF old_row IS NULL THEN
      old_row := '{}'::jsonb;
      is_create := true;
    END IF;
  ELSIF NOT is_create THEN
    EXECUTE format('SELECT to_jsonb(t) FROM public.%I t WHERE id::text=$1 AND organization_id=$2 FOR UPDATE',tbl) INTO old_row USING p_id,org;
    IF old_row IS NULL THEN
      RETURN jsonb_build_object('error',jsonb_build_object('code','NOT_FOUND','message','Record not found in this organization.'));
    END IF;
    IF old_row->>'pluginArchivedAt' IS NOT NULL AND NOT is_delete AND p_tool NOT IN ('archive_record','restore_record') THEN
      RETURN jsonb_build_object('error',jsonb_build_object('code','ARCHIVED','message','Archived records cannot be edited.'));
    END IF;
    IF NOT is_note AND (
      (NOT is_delete AND p_revision IS NULL)
      OR (p_revision IS NOT NULL AND (old_row->>'pluginRevision')::bigint<>p_revision)
    ) THEN
      RETURN jsonb_build_object('error',jsonb_build_object('code','CONFLICT','message','Record changed. Reread its current _revision and reconcile before retrying.'));
    END IF;
  END IF;

  -- Execute DELETE
  IF is_delete THEN
    EXECUTE format('DELETE FROM public.%I WHERE id::text=$1 AND organization_id=$2',tbl) USING p_id,org;
    result := jsonb_build_object('deleted',true,'id',old_row->>'id','table',tbl);
    INSERT INTO public."PluginMutationAudit"(organization_id,user_id,client_id,session_id,tool,entity_type,entity_id,changed_fields,previous_values,new_values,resulting_revision,supplied_fields,request_id,request_body,result)
    VALUES(org,p_user,p_client,p_session,coalesce(p_source,p_tool),tbl,p_id,ARRAY['*deleted*'],old_row,'{}'::jsonb,coalesce((old_row->>'pluginRevision')::bigint,0),coalesce(p_patch,'{}'::jsonb),p_request,body,result);
    RETURN result;
  END IF;

  -- Execute MOVE DEAL (Deals <-> JVDeals or Deals pipeline change)
  IF p_tool='move_deal' THEN
    dst_tbl := CASE WHEN move_target='dfd' THEN 'JVDeals' ELSE 'Deals' END;
    clean_patch := old_row - 'organization_id' - 'pluginRevision' - 'pluginArchivedAt' - 'pluginArchiveReason';
    IF move_target='dfd' THEN
      clean_patch := clean_patch || jsonb_build_object('pipelineType','dfd');
    ELSIF move_target='azre-queue' THEN
      clean_patch := clean_patch || jsonb_build_object('queueStatus','In Queue','pipelineType','azre-queue');
    ELSIF move_target='off-market' THEN
      clean_patch := clean_patch || jsonb_build_object('queueStatus','In Pipeline','listingType','Off-Market','pipelineType','off-market');
    ELSE
      clean_patch := clean_patch || jsonb_build_object('queueStatus','In Pipeline','listingType','Listed On MLS','pipelineType','mls');
    END IF;
    IF src_tbl=dst_tbl THEN
      patch := clean_patch - 'id' - 'createdAt';
      SELECT string_agg(format('%I=r.%I',key,key),',') INTO expr FROM jsonb_object_keys(patch) key;
      EXECUTE format('UPDATE public.%I t SET %s FROM jsonb_populate_record(NULL::public.%I,$1) r WHERE t.id::text=$2 AND t.organization_id=$3 RETURNING to_jsonb(t.*)',dst_tbl,expr,dst_tbl) INTO new_row USING patch,p_id,org;
    ELSE
      clean_patch := clean_patch || jsonb_build_object('organization_id',org);
      SELECT array_agg(column_name::text) INTO supported_cols FROM information_schema.columns WHERE table_schema='public' AND table_name=dst_tbl;
      SELECT string_agg(format('%I',key),','),string_agg(format('r.%I',key),',') INTO cols,expr FROM jsonb_object_keys(clean_patch) key WHERE key=ANY(supported_cols);
      EXECUTE format('INSERT INTO public.%I (%s) SELECT %s FROM jsonb_populate_record(NULL::public.%I,$1) r RETURNING to_jsonb(%I.*)',dst_tbl,cols,expr,dst_tbl,dst_tbl) INTO new_row USING clean_patch;
      EXECUTE format('DELETE FROM public.%I WHERE id::text=$1 AND organization_id=$2',src_tbl) USING p_id,org;
    END IF;
    result := jsonb_build_object('record',new_row,'moved_from',src_tbl,'moved_to',dst_tbl);
    INSERT INTO public."PluginMutationAudit"(organization_id,user_id,client_id,session_id,tool,entity_type,entity_id,changed_fields,previous_values,new_values,resulting_revision,supplied_fields,request_id,request_body,result)
    VALUES(org,p_user,p_client,p_session,coalesce(p_source,p_tool),dst_tbl,p_id,ARRAY['pipelineType'],old_row,new_row,(new_row->>'pluginRevision')::bigint,p_patch,p_request,body,result);
    RETURN result;
  END IF;

  -- Execute MOVE CONTACT (Buyers <-> Agents <-> Wholesalers)
  IF p_tool='move_contact' THEN
    moved_id := gen_random_uuid()::text;
    ts_note := to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')||' | ChatGPT / DealDesk Hosted | Moved from '||src_tbl||'.';
    notes := coalesce(nullif(old_row->'notes','null'::jsonb),'[]'::jsonb);
    IF jsonb_typeof(notes)<>'array' THEN notes := '[]'::jsonb; END IF;
    clean_patch := jsonb_build_object(
      'id', moved_id,
      'organization_id', org,
      'name', coalesce(nullif(old_row->>'name',''),'Unknown'),
      'phone', old_row->>'phone',
      'email', old_row->>'email',
      'photo', old_row->>'photo',
      'notes', jsonb_build_array(ts_note) || notes
    );
    IF dst_tbl='Buyers' THEN
      clean_patch := clean_patch || jsonb_build_object(
        'companyName', coalesce(old_row->>'companyName',old_row->>'brokerage',''),
        'status', 'New Lead',
        'subscriptionStatus', coalesce(old_row->>'subscriptionStatus','Subscribed'),
        'propertiesBought', 0,
        'buyBox', '{"locations":"","minPrice":0,"maxPrice":0,"propertyTypes":[],"minBedrooms":0,"minBathrooms":0,"notes":""}'::jsonb
      );
    ELSIF dst_tbl='Agents' THEN
      clean_patch := clean_patch || jsonb_build_object(
        'agentFirstName', coalesce(nullif(old_row->>'agentFirstName',''),split_part(coalesce(old_row->>'name','Unknown'),' ',1)),
        'agentLastName', coalesce(nullif(old_row->>'agentLastName',''),nullif(trim(substr(coalesce(old_row->>'name',''),length(split_part(coalesce(old_row->>'name',''),' ',1))+2)),'')),
        'brokerage', coalesce(old_row->>'companyName',old_row->>'brokerage',''),
        'subscriptionStatus', coalesce(old_row->>'subscriptionStatus','Subscribed')
      );
    ELSE
      clean_patch := clean_patch || jsonb_build_object(
        'companyName', coalesce(old_row->>'companyName',old_row->>'brokerage',''),
        'status', 'New',
        'subscriptionStatus', coalesce(old_row->>'subscriptionStatus','Subscribed')
      );
    END IF;
    SELECT string_agg(format('%I',key),','),string_agg(format('r.%I',key),',') INTO cols,expr FROM jsonb_object_keys(clean_patch) key;
    EXECUTE format('INSERT INTO public.%I (%s) SELECT %s FROM jsonb_populate_record(NULL::public.%I,$1) r RETURNING to_jsonb(%I.*)',dst_tbl,cols,expr,dst_tbl,dst_tbl) INTO new_row USING clean_patch;
    EXECUTE format('DELETE FROM public.%I WHERE id::text=$1 AND organization_id=$2',src_tbl) USING p_id,org;
    result := jsonb_build_object('record',new_row,'moved_from',src_tbl,'moved_to',dst_tbl,'deleted_source_id',p_id);
    INSERT INTO public."PluginMutationAudit"(organization_id,user_id,client_id,session_id,tool,entity_type,entity_id,changed_fields,previous_values,new_values,resulting_revision,supplied_fields,request_id,request_body,result)
    VALUES(org,p_user,p_client,p_session,coalesce(p_source,p_tool),dst_tbl,moved_id,ARRAY['moved'],old_row,new_row,(new_row->>'pluginRevision')::bigint,p_patch,p_request,body,result);
    RETURN result;
  END IF;

  -- Task target validation
  IF p_tool='create_task' THEN
    IF patch->>'entityType' NOT IN ('Deals','JVDeals','Buyers','Agents','Wholesalers') THEN RAISE EXCEPTION 'Invalid entity'; END IF;
    EXECUTE format('SELECT to_jsonb(t) FROM public.%I t WHERE id::text=$1 AND organization_id=$2 AND "pluginArchivedAt" IS NULL FOR SHARE',patch->>'entityType') INTO new_row USING patch->>'entityId',org;
    IF new_row IS NULL THEN
      RETURN jsonb_build_object('error',jsonb_build_object('code','NOT_FOUND','message','Task target not found in this organization.'));
    END IF;
    patch := jsonb_build_object('status','Open','priority','Normal')||patch;
  END IF;

  -- Duplicate checks for Deals & Buyers
  IF tbl='Deals' AND (p_tool='create_deal' OR patch ? 'address' OR patch ? 'mls') THEN
    SELECT jsonb_agg(jsonb_build_object('deal_id',id,'address',address,'mls',mls,'offerDecision',"offerDecision",'_revision',"pluginRevision"))
    INTO duplicates
    FROM public."Deals"
    WHERE organization_id=org AND id::text<>p_id AND (
      public.dealdesk_address_key(address)=public.dealdesk_address_key(coalesce(patch->>'address',old_row->>'address'))
      OR (nullif(trim(coalesce(patch->>'mls',old_row->>'mls')),'') IS NOT NULL AND lower(trim(mls))=lower(trim(coalesce(patch->>'mls',old_row->>'mls'))))
    );
    IF duplicates IS NOT NULL THEN
      RETURN jsonb_build_object('error',jsonb_build_object('code','DUPLICATE','message','Likely duplicate exists; inspect it before proceeding.','details',jsonb_build_object('existing_deals',duplicates)));
    END IF;
  END IF;

  IF tbl='Buyers' AND p_tool IN ('create_buyer','update_buyer') AND (p_tool='create_buyer' OR patch ? 'email' OR patch ? 'phone') THEN
    SELECT jsonb_agg(jsonb_build_object('buyer_id',id,'name',name,'companyName',"companyName",'email',email,'phone',phone,'status',status,'_revision',"pluginRevision"))
    INTO duplicates
    FROM public."Buyers"
    WHERE organization_id=org AND id::text<>p_id AND (
      ((p_tool='create_buyer' OR patch ? 'email')
        AND nullif(trim(coalesce(patch->>'email','')),'') IS NOT NULL
        AND lower(trim(email))=lower(trim(patch->>'email')))
      OR ((p_tool='create_buyer' OR patch ? 'phone')
        AND length(regexp_replace(coalesce(patch->>'phone',''),'[^0-9]','','g'))>=7
        AND regexp_replace(coalesce(phone,''),'[^0-9]','','g')=regexp_replace(coalesce(patch->>'phone',''),'[^0-9]','','g'))
      OR (p_tool='create_buyer'
        AND nullif(trim(coalesce(patch->>'email','')),'') IS NULL
        AND nullif(trim(coalesce(email,'')),'') IS NULL
        AND length(regexp_replace(coalesce(patch->>'phone',''),'[^0-9]','','g'))<7
        AND length(regexp_replace(coalesce(phone,''),'[^0-9]','','g'))<7
        AND lower(trim(name))=lower(trim(patch->>'name')))
    );
    IF duplicates IS NOT NULL THEN
      RETURN jsonb_build_object('error',jsonb_build_object('code','DUPLICATE','message','Likely duplicate buyer exists; inspect it before proceeding.','details',jsonb_build_object('existing_buyers',duplicates)));
    END IF;
  END IF;

  -- Defaults on creation
  IF p_tool='create_deal' THEN
    patch := jsonb_build_object('offerDecision','No Offer Made Yet','status','Analyzing','logs','[]'::jsonb,'dealType','[]'::jsonb,'dispo','{"photos":false,"blast":false}'::jsonb)||patch;
  ELSIF p_tool='create_jv_deal' THEN
    patch := jsonb_build_object('offerDecision','Available','pipelineType','dfd','logs','[]'::jsonb,'dealType','[]'::jsonb,'dispo','{"photos":false,"blast":false}'::jsonb)||patch;
  ELSIF p_tool='create_buyer' THEN
    patch := jsonb_build_object('status','New Lead','subscriptionStatus','Subscribed','propertiesBought',0,'notes','[]'::jsonb)||patch;
  ELSIF p_tool='create_agent' THEN
    IF patch ? 'name' AND NOT(patch ? 'agentFirstName') THEN
      patch := jsonb_build_object('agentFirstName',split_part(patch->>'name',' ',1),'agentLastName',nullif(trim(substr(patch->>'name',length(split_part(patch->>'name',' ',1))+2)),''))||patch;
    END IF;
    patch := jsonb_build_object('subscriptionStatus','Subscribed','notes','[]'::jsonb,'closedDealIds','[]'::jsonb)||patch;
  ELSIF p_tool='create_wholesaler' THEN
    patch := jsonb_build_object('status','New','subscriptionStatus','Subscribed','notes','[]'::jsonb,'properties','[]'::jsonb,'closedDealIds','[]'::jsonb)||patch;
  ELSIF p_tool='create_off_market_property' THEN
    patch := jsonb_build_object('Notes','[]'::jsonb,'Off Market List','[]'::jsonb,'Interested',false,'I''m Not Interested',false,'Owner Not Interested',false,'Trash',false,'Text Message Sent',false,'Owner Called',false)||patch;
  END IF;

  -- Queue placement and pipeline routing for Deals
  IF tbl='Deals' AND p_tool IN ('create_deal','update_deal') THEN
    SELECT (SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='Deals' AND column_name IN ('queueStatus','pipelineType'))=2 INTO has_queue;
    IF patch ? 'queueStatus' AND (jsonb_typeof(patch->'queueStatus') IS DISTINCT FROM 'string' OR patch->>'queueStatus' NOT IN ('In Queue','In Pipeline')) THEN
      RETURN jsonb_build_object('error',jsonb_build_object('code','INVALID_REQUEST','message','Invalid queueStatus.'));
    END IF;
    IF old_row->>'pipelineType' IN ('dfd','jv') AND patch ? 'queueStatus' THEN
      RETURN jsonb_build_object('error',jsonb_build_object('code','INVALID_REQUEST','message','JV/DFD deals cannot be routed through AZRE Queue.'));
    END IF;
    IF has_queue THEN
      IF p_tool='create_deal' THEN
        patch := jsonb_build_object('queueStatus','In Pipeline','listingType','Listed On MLS')||patch;
      END IF;
      IF (p_tool='create_deal' OR patch ? 'queueStatus' OR patch ? 'listingType') AND coalesce(old_row->>'pipelineType','') NOT IN ('dfd','jv') THEN
        CASE coalesce(patch->>'queueStatus',nullif(old_row->>'queueStatus',''),nullif(old_row->>'queueStatue',''),CASE WHEN old_row->>'pipelineType'='azre-queue' THEN 'In Queue' ELSE 'In Pipeline' END)
          WHEN 'In Queue' THEN patch := patch||jsonb_build_object('pipelineType','azre-queue');
          WHEN 'In Pipeline' THEN patch := patch||jsonb_build_object('pipelineType',CASE WHEN coalesce(patch->>'listingType',old_row->>'listingType')='Off-Market' THEN 'off-market' ELSE 'mls' END);
          ELSE NULL;
        END CASE;
      END IF;
    END IF;
  END IF;

  -- Stage tracking for Deals & JVDeals
  IF p_tool IN ('update_deal','update_jv_deal') AND patch ? 'offerDecision' AND patch->>'offerDecision' IS DISTINCT FROM old_row->>'offerDecision' THEN
    patch := patch||jsonb_build_object('offerDecisionTracking',coalesce(nullif(old_row->'offerDecisionTracking','null'::jsonb),'[]'::jsonb)||jsonb_build_array(jsonb_build_object('status',patch->>'offerDecision','date',now(),'user','ChatGPT / DealDesk Hosted')));
  END IF;

  -- Buy box merge for Buyers
  IF p_tool='update_buyer' AND patch ? 'buyBox' THEN
    IF jsonb_typeof(patch->'buyBox') IS DISTINCT FROM 'object' THEN
      RETURN jsonb_build_object('error',jsonb_build_object('code','INVALID_REQUEST','message','buyBox must be an object.'));
    END IF;
    existing_box := coalesce(nullif(old_row->'buyBox','null'::jsonb),'{}'::jsonb);
    IF jsonb_typeof(existing_box)='string' THEN
      BEGIN
        existing_box := (existing_box#>>'{}')::jsonb;
      EXCEPTION WHEN OTHERS THEN
        RETURN jsonb_build_object('error',jsonb_build_object('code','INVALID_RECORD','message','Existing buy box needs repair before editing.'));
      END;
    END IF;
    IF jsonb_typeof(existing_box) IS DISTINCT FROM 'object' THEN
      RETURN jsonb_build_object('error',jsonb_build_object('code','INVALID_RECORD','message','Existing buy box needs repair before editing.'));
    END IF;
    merged_box := existing_box||(patch->'buyBox');
    IF (coalesce(nullif(merged_box->>'maxPrice',''),'0') ~ '^[0-9]+(\.[0-9]+)?$' AND coalesce(nullif(merged_box->>'minPrice',''),'0') ~ '^[0-9]+(\.[0-9]+)?$' AND coalesce(nullif(merged_box->>'maxPrice',''),'0')::numeric > 0 AND coalesce(nullif(merged_box->>'minPrice',''),'0')::numeric > coalesce(nullif(merged_box->>'maxPrice',''),'0')::numeric)
       OR (coalesce(nullif(merged_box->>'maxArv',''),'0') ~ '^[0-9]+(\.[0-9]+)?$' AND coalesce(nullif(merged_box->>'minArv',''),'0') ~ '^[0-9]+(\.[0-9]+)?$' AND coalesce(nullif(merged_box->>'maxArv',''),'0')::numeric > 0 AND coalesce(nullif(merged_box->>'minArv',''),'0')::numeric > coalesce(nullif(merged_box->>'maxArv',''),'0')::numeric)
       OR (coalesce(nullif(merged_box->>'maxSqft',''),'0') ~ '^[0-9]+(\.[0-9]+)?$' AND coalesce(nullif(merged_box->>'minSqft',''),'0') ~ '^[0-9]+(\.[0-9]+)?$' AND coalesce(nullif(merged_box->>'maxSqft',''),'0')::numeric > 0 AND coalesce(nullif(merged_box->>'minSqft',''),'0')::numeric > coalesce(nullif(merged_box->>'maxSqft',''),'0')::numeric)
       OR (coalesce(nullif(merged_box->>'latestYearBuilt',''),'0') ~ '^[0-9]+$' AND coalesce(nullif(merged_box->>'earliestYearBuilt',''),'0') ~ '^[0-9]+$' AND coalesce(nullif(merged_box->>'latestYearBuilt',''),'0')::numeric > 0 AND coalesce(nullif(merged_box->>'earliestYearBuilt',''),'0')::numeric > coalesce(nullif(merged_box->>'latestYearBuilt',''),'0')::numeric) THEN
      RETURN jsonb_build_object('error',jsonb_build_object('code','INVALID_REQUEST','message','Merged buyBox minimum bound exceeds maximum bound.'));
    END IF;
    patch := patch||jsonb_build_object('buyBox',merged_box);
  END IF;

  -- Agent name split sync
  IF p_tool='update_agent' AND patch ? 'name' THEN
    patch := jsonb_build_object('agentFirstName',split_part(patch->>'name',' ',1),'agentLastName',nullif(trim(substr(patch->>'name',length(split_part(patch->>'name',' ',1))+2)),''))||patch;
  END IF;

  -- Note append
  IF is_note THEN
    IF p_note IS NULL OR length(trim(p_note))=0 OR length(p_note)>5000 THEN RAISE EXCEPTION 'Invalid note'; END IF;
    note_col := CASE WHEN p_tool IN ('add_deal_note','add_jv_deal_note') THEN 'logs' ELSE 'notes' END;
    notes := coalesce(nullif(old_row->note_col,'null'::jsonb),'[]'::jsonb);
    IF jsonb_typeof(notes)='string' THEN
      BEGIN
        notes := (notes#>>'{}')::jsonb;
      EXCEPTION WHEN OTHERS THEN
        RETURN jsonb_build_object('error',jsonb_build_object('code','INVALID_RECORD','message','Existing notes need repair before appending.'));
      END;
    END IF;
    IF jsonb_typeof(notes)<>'array' THEN
      RETURN jsonb_build_object('error',jsonb_build_object('code','INVALID_RECORD','message','Existing notes are not an array.'));
    END IF;
    note := to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')||' | ChatGPT / DealDesk Hosted | '||CASE WHEN p_category IS NULL THEN '' ELSE '['||p_category||'] ' END||p_note;
    patch := jsonb_build_object(note_col,notes||jsonb_build_array(note));
  END IF;

  -- Archive / Restore
  IF p_tool='archive_record' THEN
    IF nullif(trim(coalesce(p_patch->>'reason',p_note,'')),'') IS NULL THEN
      RETURN jsonb_build_object('error',jsonb_build_object('code','INVALID_REQUEST','message','An archive reason is required.'));
    END IF;
    patch := jsonb_build_object('pluginArchivedAt',now(),'pluginArchiveReason',trim(coalesce(p_patch->>'reason',p_note)));
  ELSIF p_tool='restore_record' THEN
    patch := jsonb_build_object('pluginArchivedAt',NULL,'pluginArchiveReason',NULL);
  END IF;

  -- Execute INSERT or UPDATE
  IF is_create THEN
    IF is_bigint_pk THEN
      patch := patch||jsonb_build_object('organization_id',org);
    ELSE
      patch := patch||jsonb_build_object('id',p_id,'organization_id',org);
    END IF;
    SELECT string_agg(format('%I',key),','),string_agg(format('r.%I',key),',') INTO cols,expr FROM jsonb_object_keys(patch) key;
    EXECUTE format('INSERT INTO public.%I (%s) SELECT %s FROM jsonb_populate_record(NULL::public.%I,$1) r RETURNING to_jsonb(%I.*)',tbl,cols,expr,tbl,tbl) INTO new_row USING patch;
  ELSE
    SELECT string_agg(format('%I=r.%I',key,key),',') INTO expr FROM jsonb_object_keys(patch) key;
    IF p_tool='upsert_off_market_templates' THEN
      EXECUTE format('UPDATE public.%I t SET %s FROM jsonb_populate_record(NULL::public.%I,$1) r WHERE t.id=$2 AND t.organization_id=$3 RETURNING to_jsonb(t.*)',tbl,expr,tbl) INTO new_row USING patch,(old_row->>'id')::bigint,org;
    ELSE
      EXECUTE format('UPDATE public.%I t SET %s FROM jsonb_populate_record(NULL::public.%I,$1) r WHERE t.id::text=$2 AND t.organization_id=$3 RETURNING to_jsonb(t.*)',tbl,expr,tbl) INTO new_row USING patch,p_id,org;
    END IF;
  END IF;

  SELECT coalesce(array_agg(key ORDER BY key),'{}') INTO changed FROM jsonb_each(new_row) WHERE value IS DISTINCT FROM old_row->key AND key<>'pluginRevision';
  result := jsonb_build_object('record',new_row);
  IF note IS NOT NULL THEN result := result||jsonb_build_object('note',note); END IF;

  INSERT INTO public."PluginMutationAudit"(organization_id,user_id,client_id,session_id,tool,entity_type,entity_id,changed_fields,previous_values,new_values,resulting_revision,supplied_fields,request_id,request_body,result)
  VALUES(org,p_user,p_client,p_session,coalesce(p_source,p_tool),tbl,coalesce(new_row->>'id',p_id),changed,old_row,new_row,coalesce((new_row->>'pluginRevision')::bigint,0),coalesce(p_patch,'{}'::jsonb),p_request,body,result);

  RETURN result;
END $$;

REVOKE ALL ON FUNCTION public.dealdesk_operational_mutation(text,text,jsonb,bigint,text,text,uuid,text,text,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.dealdesk_operational_mutation(text,text,jsonb,bigint,text,text,uuid,text,text,uuid,text) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;

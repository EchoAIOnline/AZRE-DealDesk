-- Hosted MCP endpoint expansion: Buyers create/update, Buyer & Agent notes, and OffMarketProperties scoping.
-- Preserves 005 comparables and 006 queue routing. No existing business records are modified or backfilled.
BEGIN;

ALTER TABLE public."OffMarketProperties" ADD COLUMN IF NOT EXISTS organization_id text;
ALTER TABLE public."OffMarketProperties" ADD COLUMN IF NOT EXISTS "pluginArchivedAt" timestamptz;
CREATE INDEX IF NOT EXISTS "OffMarketProperties_org_id_idx" ON public."OffMarketProperties" (organization_id, id);

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
  allowed text[];
  old_row jsonb := '{}';
  new_row jsonb;
  patch jsonb := p_patch;
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
BEGIN
  IF p_session IS NULL OR length(p_session)=0 OR NOT EXISTS(
    SELECT 1 FROM public."PluginOAuthGrants"
    WHERE user_id=p_user AND client_id=p_client AND organization_id=org
      AND resource='https://dealdesk.asharizakargroup.com/api/mcp' AND enabled AND operational_writes
  ) THEN
    RETURN jsonb_build_object('error',jsonb_build_object('code','WRITES_DISABLED','message','Operational editing is not approved for this identity.'));
  END IF;

  IF p_tool NOT IN ('create_deal','update_deal','add_deal_note','create_buyer','update_buyer','add_buyer_note','add_agent_note','create_task','update_task') THEN
    RETURN jsonb_build_object('error',jsonb_build_object('code','TOOL_UNAVAILABLE','message','This operation is unavailable.'));
  END IF;

  IF p_source IS NOT NULL AND p_source<>p_tool AND NOT(p_source='import_from_zillow' AND p_tool='create_deal') THEN
    RAISE EXCEPTION 'Invalid source';
  END IF;

  tbl := CASE
    WHEN p_tool IN ('create_task','update_task') THEN 'PluginTasks'
    WHEN p_tool IN ('create_buyer','update_buyer','add_buyer_note') THEN 'Buyers'
    WHEN p_tool='add_agent_note' THEN 'Agents'
    ELSE 'Deals'
  END;

  -- Lock serializes duplicate checks and idempotency; row locks protect against UI edits.
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
    'target',CASE WHEN p_tool IN ('add_deal_note','add_buyer_note','add_agent_note') THEN p_id ELSE NULL END
  );

  IF p_request IS NOT NULL THEN
    SELECT * INTO replay FROM public."PluginMutationAudit" WHERE user_id=p_user AND client_id=p_client AND request_id=p_request;
    IF FOUND THEN
      IF replay.request_body=body THEN RETURN replay.result||jsonb_build_object('replayed',true); END IF;
      RETURN jsonb_build_object('error',jsonb_build_object('code','REQUEST_ID_REUSED','message','This request_id was used for a different operation.'));
    END IF;
  END IF;

  IF jsonb_typeof(patch) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Invalid patch'; END IF;

  allowed := CASE
    WHEN p_tool IN ('add_deal_note','add_buyer_note','add_agent_note') THEN ARRAY[]::text[]
    WHEN tbl='Deals' THEN ARRAY['queueStatus','newConstructionComparable1','newConstructionComparable2','newConstructionComparable3','renovationComparable1','renovationComparable2','renovationComparable3','address','mls','listPrice','offerPrice','agentName','agentPhone','agentEmail','agentBrokerage','acquisitionManager','offerDecision','subMarket','neighborhood','county','dealType','propertyType','listingDescription','originalAskingPrice','reducedAskingPrice','negotiatedAskingPrice','desiredWholesaleProfit','renovationEstimate','newConstructionEstimate','renovationARV','newConstructionARV','bedrooms','bathrooms','sqft','lotSqft','yearBuilt','nextFollowUpDate','lastContactDate','interestLevel','contactStatus','status','zoning','listingType','listingStatus','forSaleBy','dateListed','inspectionDate','emdDate','underContractDate','closedDate','declinedDate']
    WHEN tbl='Buyers' THEN ARRAY['name','companyName','email','phone','status','subscriptionStatus','propertiesBought','buyBox','about','nextFollowUpDate','lastContactDate','website','socialMediaLinks']
    WHEN p_tool='create_task' THEN ARRAY['title','description','dueDate','assignee','status','priority','entityType','entityId']
    ELSE ARRAY['title','description','dueDate','assignee','status','priority']
  END;

  IF EXISTS(SELECT 1 FROM jsonb_object_keys(patch) k WHERE NOT(k=ANY(allowed))) THEN
    RETURN jsonb_build_object('error',jsonb_build_object('code','INVALID_REQUEST','message','Unsupported field.'));
  END IF;

  IF p_tool NOT IN ('create_deal','create_buyer','create_task') THEN
    EXECUTE format('SELECT to_jsonb(t) FROM public.%I t WHERE id::text=$1 AND organization_id=$2 FOR UPDATE',tbl) INTO old_row USING p_id,org;
    IF old_row IS NULL THEN
      RETURN jsonb_build_object('error',jsonb_build_object('code','NOT_FOUND','message','Record not found in this organization.'));
    END IF;
    IF old_row->>'pluginArchivedAt' IS NOT NULL THEN
      RETURN jsonb_build_object('error',jsonb_build_object('code','ARCHIVED','message','Archived records cannot be edited.'));
    END IF;
    IF p_tool NOT IN ('add_deal_note','add_buyer_note','add_agent_note') AND (p_revision IS NULL OR (old_row->>'pluginRevision')::bigint<>p_revision) THEN
      RETURN jsonb_build_object('error',jsonb_build_object('code','CONFLICT','message','Record changed. Reread its current _revision and reconcile before retrying.'));
    END IF;
  END IF;

  IF p_tool='create_task' THEN
    IF patch->>'entityType' NOT IN ('Deals','Buyers','Agents') THEN RAISE EXCEPTION 'Invalid entity'; END IF;
    EXECUTE format('SELECT to_jsonb(t) FROM public.%I t WHERE id::text=$1 AND organization_id=$2 AND "pluginArchivedAt" IS NULL FOR SHARE',patch->>'entityType') INTO new_row USING patch->>'entityId',org;
    IF new_row IS NULL THEN
      RETURN jsonb_build_object('error',jsonb_build_object('code','NOT_FOUND','message','Task target not found in this organization.'));
    END IF;
    patch := jsonb_build_object('status','Open','priority','Normal')||patch;
  END IF;

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

  IF p_tool='create_deal' THEN
    patch := jsonb_build_object('offerDecision','No Offer Made Yet','status','Analyzing','logs','[]'::jsonb,'dealType','[]'::jsonb,'dispo','{"photos":false,"blast":false}'::jsonb)||patch;
  END IF;

  IF p_tool='create_buyer' THEN
    patch := jsonb_build_object('status','New Lead','subscriptionStatus','Subscribed','propertiesBought',0,'notes','[]'::jsonb)||patch;
  END IF;

  -- Queue placement and pipeline routing commit together under the existing row lock.
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

  IF p_tool='update_deal' AND patch ? 'offerDecision' AND patch->>'offerDecision' IS DISTINCT FROM old_row->>'offerDecision' THEN
    patch := patch||jsonb_build_object('offerDecisionTracking',coalesce(nullif(old_row->'offerDecisionTracking','null'::jsonb),'[]'::jsonb)||jsonb_build_array(jsonb_build_object('status',patch->>'offerDecision','date',now(),'user','ChatGPT / DealDesk Hosted')));
  END IF;

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

  IF p_tool IN ('add_deal_note','add_buyer_note','add_agent_note') THEN
    IF p_note IS NULL OR length(trim(p_note))=0 OR length(p_note)>5000 THEN RAISE EXCEPTION 'Invalid note'; END IF;
    note_col := CASE WHEN p_tool='add_deal_note' THEN 'logs' ELSE 'notes' END;
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

  IF p_tool IN ('create_deal','create_buyer','create_task') THEN
    patch := patch||jsonb_build_object('id',p_id,'organization_id',org);
    SELECT string_agg(format('%I',key),','),string_agg(format('r.%I',key),',') INTO cols,expr FROM jsonb_object_keys(patch) key;
    EXECUTE format('INSERT INTO public.%I (%s) SELECT %s FROM jsonb_populate_record(NULL::public.%I,$1) r RETURNING to_jsonb(%I.*)',tbl,cols,expr,tbl,tbl) INTO new_row USING patch;
  ELSE
    SELECT string_agg(format('%I=r.%I',key,key),',') INTO expr FROM jsonb_object_keys(patch) key;
    EXECUTE format('UPDATE public.%I t SET %s FROM jsonb_populate_record(NULL::public.%I,$1) r WHERE t.id::text=$2 AND t.organization_id=$3 RETURNING to_jsonb(t.*)',tbl,expr,tbl) INTO new_row USING patch,p_id,org;
  END IF;

  SELECT coalesce(array_agg(key ORDER BY key),'{}') INTO changed FROM jsonb_each(new_row) WHERE value IS DISTINCT FROM old_row->key AND key<>'pluginRevision';
  result := jsonb_build_object('record',new_row);
  IF note IS NOT NULL THEN result := result||jsonb_build_object('note',note); END IF;

  INSERT INTO public."PluginMutationAudit"(organization_id,user_id,client_id,session_id,tool,entity_type,entity_id,changed_fields,previous_values,new_values,resulting_revision,supplied_fields,request_id,request_body,result)
  VALUES(org,p_user,p_client,p_session,coalesce(p_source,p_tool),tbl,p_id,changed,old_row,new_row,(new_row->>'pluginRevision')::bigint,p_patch,p_request,body,result);

  RETURN result;
END $$;

REVOKE ALL ON FUNCTION public.dealdesk_operational_mutation(text,text,jsonb,bigint,text,text,uuid,text,text,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.dealdesk_operational_mutation(text,text,jsonb,bigint,text,text,uuid,text,text,uuid,text) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;

-- Controlled hosted operations; no existing business records are modified.
BEGIN;
ALTER TABLE public."PluginOAuthGrants" ADD COLUMN IF NOT EXISTS operational_writes boolean NOT NULL DEFAULT false;
ALTER TABLE public."PluginTasks" ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'Normal' CHECK(priority IN ('Low','Normal','High','Urgent'));
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='PluginTasks' AND column_name='dueDate' AND data_type='date') THEN
 ALTER TABLE public."PluginTasks" ALTER COLUMN "dueDate" TYPE timestamptz USING "dueDate"::timestamp AT TIME ZONE 'UTC';
 END IF;
END $$;
CREATE TABLE IF NOT EXISTS public."PluginMutationAudit" (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,created_at timestamptz NOT NULL DEFAULT now(),
 organization_id text NOT NULL CHECK(organization_id='org_azre_00001'),user_id uuid NOT NULL,client_id text NOT NULL,session_id text NOT NULL,
 tool text NOT NULL,entity_type text NOT NULL,entity_id text NOT NULL,changed_fields text[] NOT NULL,
 previous_values jsonb NOT NULL,new_values jsonb NOT NULL,resulting_revision bigint NOT NULL,supplied_fields jsonb NOT NULL,
 request_id uuid,request_body jsonb,result jsonb,UNIQUE(user_id,client_id,request_id)
);
ALTER TABLE public."PluginMutationAudit" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."PluginMutationAudit" FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT ON public."PluginMutationAudit" TO service_role;
GRANT USAGE,SELECT ON SEQUENCE public."PluginMutationAudit_id_seq" TO service_role;
CREATE OR REPLACE FUNCTION public.dealdesk_address_key(value text) RETURNS text
LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE word text; result text[]:='{}';
BEGIN
 -- Conservative street match also detects existing addresses lacking city/ZIP.
 FOREACH word IN ARRAY regexp_split_to_array(trim(regexp_replace(lower(split_part(coalesce(value,''),',',1)),'[^a-z0-9 ]','','g')),'\s+') LOOP
 result:=array_append(result,CASE word WHEN 'dr' THEN 'drive' WHEN 'st' THEN 'street' WHEN 'rd' THEN 'road' WHEN 'ave' THEN 'avenue' WHEN 'ln' THEN 'lane' WHEN 'blvd' THEN 'boulevard' WHEN 'ct' THEN 'court' WHEN 'cir' THEN 'circle' WHEN 'pl' THEN 'place' WHEN 'ter' THEN 'terrace' WHEN 'pkwy' THEN 'parkway' WHEN 'hwy' THEN 'highway' WHEN 'ste' THEN 'suite' WHEN 'apt' THEN 'apartment' WHEN 'n' THEN 'north' WHEN 's' THEN 'south' WHEN 'e' THEN 'east' WHEN 'w' THEN 'west' WHEN 'ne' THEN 'northeast' WHEN 'nw' THEN 'northwest' WHEN 'se' THEN 'southeast' WHEN 'sw' THEN 'southwest' ELSE word END);
 END LOOP; RETURN array_to_string(result,' ');
END $$;
CREATE OR REPLACE FUNCTION public.dealdesk_operational_mutation(p_tool text,p_id text,p_patch jsonb,p_revision bigint,p_note text,p_category text,p_user uuid,p_client text,p_session text,p_request uuid DEFAULT NULL,p_source text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE org constant text:='org_azre_00001'; tbl text; allowed text[]; old_row jsonb:='{}'; new_row jsonb; patch jsonb:=p_patch;
 cols text; expr text; changed text[]; duplicates jsonb; notes jsonb; note text; body jsonb; replay public."PluginMutationAudit"%ROWTYPE; result jsonb;
BEGIN
 IF p_session IS NULL OR length(p_session)=0 OR NOT EXISTS(SELECT 1 FROM public."PluginOAuthGrants" WHERE user_id=p_user AND client_id=p_client AND organization_id=org AND resource='https://dealdesk.asharizakargroup.com/api/mcp' AND enabled AND operational_writes) THEN
 RETURN jsonb_build_object('error',jsonb_build_object('code','WRITES_DISABLED','message','Operational editing is not approved for this identity.')); END IF;
 IF p_tool NOT IN ('create_deal','update_deal','add_deal_note','create_task','update_task') THEN RETURN jsonb_build_object('error',jsonb_build_object('code','TOOL_UNAVAILABLE','message','This operation is unavailable.')); END IF;
 IF p_source IS NOT NULL AND p_source<>p_tool AND NOT(p_source='import_from_zillow' AND p_tool='create_deal') THEN RAISE EXCEPTION 'Invalid source'; END IF;
 tbl:=CASE WHEN p_tool IN ('create_task','update_task') THEN 'PluginTasks' ELSE 'Deals' END;
 -- Lock serializes duplicate checks and idempotency; row locks protect against UI edits.
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(org||':operational',0));
 IF tbl='Deals' AND (p_tool='create_deal' OR patch ? 'address' OR patch ? 'mls') THEN
 LOCK TABLE public."Deals" IN SHARE ROW EXCLUSIVE MODE; -- include frontend inserts in the duplicate-check critical section
 END IF;
 body:=jsonb_build_object('tool',coalesce(p_source,p_tool),'patch',p_patch,'note',p_note,'category',p_category,'target',CASE WHEN p_tool='add_deal_note' THEN p_id ELSE NULL END);
 IF p_request IS NOT NULL THEN
 SELECT * INTO replay FROM public."PluginMutationAudit" WHERE user_id=p_user AND client_id=p_client AND request_id=p_request;
 IF FOUND THEN
 IF replay.request_body=body THEN RETURN replay.result||jsonb_build_object('replayed',true); END IF;
 RETURN jsonb_build_object('error',jsonb_build_object('code','REQUEST_ID_REUSED','message','This request_id was used for a different operation.')); END IF; END IF;
 IF jsonb_typeof(patch) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Invalid patch'; END IF;
 allowed:=CASE WHEN tbl='Deals' THEN ARRAY['address','mls','listPrice','offerPrice','agentName','agentPhone','agentEmail','agentBrokerage','acquisitionManager','offerDecision','subMarket','neighborhood','county','dealType','propertyType','listingDescription','originalAskingPrice','reducedAskingPrice','negotiatedAskingPrice','desiredWholesaleProfit','renovationEstimate','newConstructionEstimate','renovationARV','newConstructionARV','bedrooms','bathrooms','sqft','lotSqft','yearBuilt','nextFollowUpDate','lastContactDate','interestLevel','contactStatus','status','zoning','listingType','listingStatus','forSaleBy','dateListed','inspectionDate','emdDate','underContractDate','closedDate','declinedDate'] WHEN p_tool='create_task' THEN ARRAY['title','description','dueDate','assignee','status','priority','entityType','entityId'] ELSE ARRAY['title','description','dueDate','assignee','status','priority'] END;
 IF EXISTS(SELECT 1 FROM jsonb_object_keys(patch) k WHERE NOT(k=ANY(allowed))) THEN RETURN jsonb_build_object('error',jsonb_build_object('code','INVALID_REQUEST','message','Unsupported field.')); END IF;
 IF p_tool NOT IN ('create_deal','create_task') THEN
 EXECUTE format('SELECT to_jsonb(t) FROM public.%I t WHERE id::text=$1 AND organization_id=$2 FOR UPDATE',tbl) INTO old_row USING p_id,org;
 IF old_row IS NULL THEN RETURN jsonb_build_object('error',jsonb_build_object('code','NOT_FOUND','message','Record not found in this organization.')); END IF;
 IF old_row->>'pluginArchivedAt' IS NOT NULL THEN RETURN jsonb_build_object('error',jsonb_build_object('code','ARCHIVED','message','Archived records cannot be edited.')); END IF;
 IF p_tool<>'add_deal_note' AND (p_revision IS NULL OR (old_row->>'pluginRevision')::bigint<>p_revision) THEN RETURN jsonb_build_object('error',jsonb_build_object('code','CONFLICT','message','Record changed. Reread its current _revision and reconcile before retrying.')); END IF; END IF;
 IF p_tool='create_task' THEN
 IF patch->>'entityType' NOT IN ('Deals','Buyers','Agents') THEN RAISE EXCEPTION 'Invalid entity'; END IF;
 EXECUTE format('SELECT to_jsonb(t) FROM public.%I t WHERE id::text=$1 AND organization_id=$2 AND "pluginArchivedAt" IS NULL FOR SHARE',patch->>'entityType') INTO new_row USING patch->>'entityId',org;
 IF new_row IS NULL THEN RETURN jsonb_build_object('error',jsonb_build_object('code','NOT_FOUND','message','Task target not found in this organization.')); END IF;
 patch:=jsonb_build_object('status','Open','priority','Normal')||patch; END IF;
 IF tbl='Deals' AND (p_tool='create_deal' OR patch ? 'address' OR patch ? 'mls') THEN
 SELECT jsonb_agg(jsonb_build_object('deal_id',id,'address',address,'mls',mls,'offerDecision',"offerDecision",'_revision',"pluginRevision")) INTO duplicates FROM public."Deals" WHERE organization_id=org AND id::text<>p_id AND (
 public.dealdesk_address_key(address)=public.dealdesk_address_key(coalesce(patch->>'address',old_row->>'address')) OR (nullif(trim(coalesce(patch->>'mls',old_row->>'mls')),'') IS NOT NULL AND lower(trim(mls))=lower(trim(coalesce(patch->>'mls',old_row->>'mls')))));
 IF duplicates IS NOT NULL THEN RETURN jsonb_build_object('error',jsonb_build_object('code','DUPLICATE','message','Likely duplicate exists; inspect it before proceeding.','details',jsonb_build_object('existing_deals',duplicates))); END IF; END IF;
 IF p_tool='create_deal' THEN patch:=jsonb_build_object('offerDecision','No Offer Made Yet','status','Analyzing','logs','[]'::jsonb,'dealType','[]'::jsonb,'dispo','{"photos":false,"blast":false}'::jsonb)||patch; END IF;
 IF p_tool='update_deal' AND patch ? 'offerDecision' AND patch->>'offerDecision' IS DISTINCT FROM old_row->>'offerDecision' THEN patch:=patch||jsonb_build_object('offerDecisionTracking',coalesce(nullif(old_row->'offerDecisionTracking','null'::jsonb),'[]'::jsonb)||jsonb_build_array(jsonb_build_object('status',patch->>'offerDecision','date',now(),'user','ChatGPT / DealDesk Hosted'))); END IF;
 IF p_tool='add_deal_note' THEN
 IF p_note IS NULL OR length(trim(p_note))=0 OR length(p_note)>5000 THEN RAISE EXCEPTION 'Invalid note'; END IF;
 notes:=coalesce(nullif(old_row->'logs','null'::jsonb),'[]'::jsonb);
 IF jsonb_typeof(notes)='string' THEN notes:=(notes#>>'{}')::jsonb; END IF;
 IF jsonb_typeof(notes)<>'array' THEN RAISE EXCEPTION 'Existing logs are not an array'; END IF;
 note:=to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')||' | ChatGPT / DealDesk Hosted | '||CASE WHEN p_category IS NULL THEN '' ELSE '['||p_category||'] ' END||p_note;
 patch:=jsonb_build_object('logs',notes||jsonb_build_array(note)); END IF;
 IF p_tool IN ('create_deal','create_task') THEN
 patch:=patch||jsonb_build_object('id',p_id,'organization_id',org);
 SELECT string_agg(format('%I',key),','),string_agg(format('r.%I',key),',') INTO cols,expr FROM jsonb_object_keys(patch) key;
 EXECUTE format('INSERT INTO public.%I (%s) SELECT %s FROM jsonb_populate_record(NULL::public.%I,$1) r RETURNING to_jsonb(%I.*)',tbl,cols,expr,tbl,tbl) INTO new_row USING patch;
 ELSE
 SELECT string_agg(format('%I=r.%I',key,key),',') INTO expr FROM jsonb_object_keys(patch) key;
 EXECUTE format('UPDATE public.%I t SET %s FROM jsonb_populate_record(NULL::public.%I,$1) r WHERE t.id::text=$2 AND t.organization_id=$3 RETURNING to_jsonb(t.*)',tbl,expr,tbl) INTO new_row USING patch,p_id,org; END IF;
 SELECT coalesce(array_agg(key ORDER BY key),'{}') INTO changed FROM jsonb_each(new_row) WHERE value IS DISTINCT FROM old_row->key AND key<>'pluginRevision';
 result:=jsonb_build_object('record',new_row); IF note IS NOT NULL THEN result:=result||jsonb_build_object('note',note); END IF;
 INSERT INTO public."PluginMutationAudit"(organization_id,user_id,client_id,session_id,tool,entity_type,entity_id,changed_fields,previous_values,new_values,resulting_revision,supplied_fields,request_id,request_body,result)
 VALUES(org,p_user,p_client,p_session,coalesce(p_source,p_tool),tbl,p_id,changed,old_row,new_row,(new_row->>'pluginRevision')::bigint,p_patch,p_request,body,result);
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.dealdesk_operational_mutation(text,text,jsonb,bigint,text,text,uuid,text,text,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.dealdesk_operational_mutation(text,text,jsonb,bigint,text,text,uuid,text,text,uuid,text) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;

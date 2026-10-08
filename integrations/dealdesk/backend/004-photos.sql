-- Narrow append-only gallery operation. Existing gallery uses Deals.photos JSONB URL arrays.
BEGIN;
CREATE OR REPLACE FUNCTION public.dealdesk_add_photos(p_id text,p_urls jsonb,p_revision bigint,p_user uuid,p_client text,p_session text,p_request uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE org constant text:='org_azre_00001'; old_row jsonb; new_row jsonb; gallery jsonb; url jsonb; body jsonb; result jsonb; added integer:=0; replay public."PluginMutationAudit"%ROWTYPE;
BEGIN
 IF coalesce(length(p_session),0)=0 OR NOT EXISTS(SELECT 1 FROM public."PluginOAuthGrants" WHERE user_id=p_user AND client_id=p_client AND organization_id=org AND resource='https://dealdesk.asharizakargroup.com/api/mcp' AND enabled AND operational_writes) THEN
 RETURN jsonb_build_object('error',jsonb_build_object('code','WRITES_DISABLED','message','Operational editing is not approved for this identity.')); END IF;
 IF jsonb_typeof(p_urls) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Invalid photos'; END IF;
 IF jsonb_array_length(p_urls) NOT BETWEEN 1 AND 10 OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_urls) x WHERE jsonb_typeof(x)<>'string' OR length(x#>>'{}')>2048 OR (x#>>'{}') !~ '^https://photos\.zillowstatic\.com/[A-Za-z0-9_/-]+\.(jpg|jpeg|png|webp)$') THEN RAISE EXCEPTION 'Invalid photos'; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(org||':operational',0));
 body:=jsonb_build_object('tool','add_deal_photos','target',p_id,'photo_urls',p_urls,'expected_revision',p_revision);
 IF p_request IS NOT NULL THEN
 SELECT * INTO replay FROM public."PluginMutationAudit" WHERE user_id=p_user AND client_id=p_client AND request_id=p_request;
 IF FOUND THEN
 IF replay.request_body=body THEN RETURN replay.result||jsonb_build_object('replayed',true); END IF;
 RETURN jsonb_build_object('error',jsonb_build_object('code','REQUEST_ID_REUSED','message','This request_id was used for a different operation.')); END IF; END IF;
 SELECT to_jsonb(t) INTO old_row FROM public."Deals" t WHERE id::text=p_id AND organization_id=org FOR UPDATE;
 IF old_row IS NULL THEN RETURN jsonb_build_object('error',jsonb_build_object('code','NOT_FOUND','message','Record not found in this organization.')); END IF;
 IF old_row->>'pluginArchivedAt' IS NOT NULL THEN RETURN jsonb_build_object('error',jsonb_build_object('code','ARCHIVED','message','Archived records cannot be edited.')); END IF;
 IF p_revision IS NULL OR (old_row->>'pluginRevision')::bigint<>p_revision THEN RETURN jsonb_build_object('error',jsonb_build_object('code','CONFLICT','message','Record changed. Reread its current _revision and reconcile before retrying.')); END IF;
 gallery:=coalesce(nullif(old_row->'photos','null'::jsonb),'[]'::jsonb);
 IF jsonb_typeof(gallery)='string' THEN gallery:=(gallery#>>'{}')::jsonb; END IF;
 -- Fail closed on malformed legacy galleries; never replace or discard existing content.
 IF jsonb_typeof(gallery)<>'array' THEN RAISE EXCEPTION 'Existing photos are not an array'; END IF;
 FOR url IN SELECT value FROM jsonb_array_elements(p_urls) LOOP
 IF NOT gallery @> jsonb_build_array(url) THEN gallery:=gallery||jsonb_build_array(url); added:=added+1; END IF;
 END LOOP;
 IF added>0 THEN
 UPDATE public."Deals" t SET photos=gallery WHERE id::text=p_id AND organization_id=org RETURNING to_jsonb(t.*) INTO new_row;
 ELSE new_row:=old_row; END IF;
 result:=jsonb_build_object('record',new_row,'added',added);
 INSERT INTO public."PluginMutationAudit"(organization_id,user_id,client_id,session_id,tool,entity_type,entity_id,changed_fields,previous_values,new_values,resulting_revision,supplied_fields,request_id,request_body,result)
 VALUES(org,p_user,p_client,p_session,'add_deal_photos','Deals',p_id,CASE WHEN added>0 THEN ARRAY['photos'] ELSE ARRAY[]::text[] END,old_row,new_row,(new_row->>'pluginRevision')::bigint,jsonb_build_object('photo_urls',p_urls),p_request,body,result);
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.dealdesk_add_photos(text,jsonb,bigint,uuid,text,text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.dealdesk_add_photos(text,jsonb,bigint,uuid,text,text,uuid) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;

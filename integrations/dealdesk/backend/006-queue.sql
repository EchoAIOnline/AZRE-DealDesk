-- Existing queue columns are owned by the DealDesk UI. No record backfill.
BEGIN;
DO $migration$
DECLARE fn regprocedure := 'public.dealdesk_operational_mutation(text,text,jsonb,bigint,text,text,uuid,text,text,uuid,text)'::regprocedure;
 original text; replacement text; definition text;
BEGIN
 SELECT prosrc,pg_get_functiondef(oid) INTO original,definition FROM pg_proc WHERE oid=fn;
 IF md5(original)<>'8e41e55618e2e6476ee9482021a10949' THEN
  RAISE EXCEPTION 'Operational function differs from reviewed baseline; inspect before migration';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=fn AND pg_get_userbyid(proowner)='postgres' AND prosecdef AND proconfig=ARRAY['search_path=""']) OR has_function_privilege('anon',fn,'EXECUTE') OR has_function_privilege('authenticated',fn,'EXECUTE') OR NOT has_function_privilege('service_role',fn,'EXECUTE') THEN
  RAISE EXCEPTION 'Unexpected function owner/security/permissions';
 END IF;
 IF (SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='Deals' AND column_name IN ('queueStatus','pipelineType') AND data_type='text')<>2 THEN
  RAISE EXCEPTION 'Expected existing text queueStatus/pipelineType columns';
 END IF;
 replacement:=replace(original, 'THEN ARRAY[''newConstructionComparable1''', 'THEN ARRAY[''queueStatus'',''newConstructionComparable1''');
 replacement:=replace(replacement, '''offerDecision'',''No Offer Made Yet'',''status'',''Analyzing''', '''offerDecision'',''No Offer Made Yet'',''queueStatus'',''In Pipeline''');
 replacement:=replace(replacement, ' IF p_tool=''update_deal'' AND patch ? ''offerDecision''', $routing$
 -- Queue placement and pipeline routing commit together under the existing row lock.
 IF tbl='Deals' AND p_tool IN ('create_deal','update_deal') THEN
  IF patch ? 'queueStatus' AND (jsonb_typeof(patch->'queueStatus') IS DISTINCT FROM 'string' OR patch->>'queueStatus' NOT IN ('In Queue','In Pipeline')) THEN
   RETURN jsonb_build_object('error',jsonb_build_object('code','INVALID_REQUEST','message','Invalid queueStatus.'));
  END IF;
  IF old_row->>'pipelineType' IN ('dfd','jv') AND patch ? 'queueStatus' THEN
   RETURN jsonb_build_object('error',jsonb_build_object('code','INVALID_REQUEST','message','JV/DFD deals cannot be routed through AZRE Queue.'));
  END IF;
  IF p_tool='create_deal' THEN
   patch:=jsonb_build_object('queueStatus','In Pipeline','listingType','Listed On MLS')||patch;
  END IF;
  IF (p_tool='create_deal' OR patch ? 'queueStatus' OR patch ? 'listingType') AND coalesce(old_row->>'pipelineType','') NOT IN ('dfd','jv') THEN
   CASE coalesce(patch->>'queueStatus',nullif(old_row->>'queueStatus',''),nullif(old_row->>'queueStatue',''),CASE WHEN old_row->>'pipelineType'='azre-queue' THEN 'In Queue' ELSE 'In Pipeline' END)
    WHEN 'In Queue' THEN patch:=patch||jsonb_build_object('pipelineType','azre-queue');
    WHEN 'In Pipeline' THEN patch:=patch||jsonb_build_object('pipelineType',CASE WHEN coalesce(patch->>'listingType',old_row->>'listingType')='Off-Market' THEN 'off-market' ELSE 'mls' END);
    ELSE NULL;
   END CASE;
  END IF;
 END IF;
$routing$ || ' IF p_tool=''update_deal'' AND patch ? ''offerDecision''');
 IF replacement=original OR position('Queue placement and pipeline routing' IN replacement)=0 THEN RAISE EXCEPTION 'Queue transformation failed'; END IF;
 EXECUTE replace(definition,original,replacement);
END $migration$;
NOTIFY pgrst,'reload schema';
COMMIT;

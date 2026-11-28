-- User account creation, Activity Feed indexing, and Dashboard/Activity RPC support.
-- Non-destructive and repeatable: no existing business or user rows are modified or deleted.
BEGIN;

-- 1. Ensure Users table and DealDesk profile/plugin columns exist
CREATE TABLE IF NOT EXISTS public."Users" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text UNIQUE NOT NULL,
  password text,
  position text,
  "createdAt" timestamptz DEFAULT now(),
  "loginStatus" text,
  photo text,
  signature text
);

ALTER TABLE public."Users" ADD COLUMN IF NOT EXISTS organization text;
ALTER TABLE public."Users" ADD COLUMN IF NOT EXISTS organization_id text;
ALTER TABLE public."Users" ADD COLUMN IF NOT EXISTS position text;
ALTER TABLE public."Users" ADD COLUMN IF NOT EXISTS "createdAt" timestamptz DEFAULT now();
ALTER TABLE public."Users" ADD COLUMN IF NOT EXISTS "loginStatus" text;
ALTER TABLE public."Users" ADD COLUMN IF NOT EXISTS photo text;
ALTER TABLE public."Users" ADD COLUMN IF NOT EXISTS signature text;
ALTER TABLE public."Users" ADD COLUMN IF NOT EXISTS "pluginRevision" bigint NOT NULL DEFAULT 0;
ALTER TABLE public."Users" ADD COLUMN IF NOT EXISTS "pluginArchivedAt" timestamptz;
ALTER TABLE public."Users" ADD COLUMN IF NOT EXISTS "pluginArchiveReason" text;

DROP TRIGGER IF EXISTS dealdesk_plugin_revision ON public."Users";
CREATE TRIGGER dealdesk_plugin_revision BEFORE UPDATE ON public."Users" FOR EACH ROW EXECUTE FUNCTION public.dealdesk_plugin_revision();

CREATE INDEX IF NOT EXISTS "Users_org_email_idx" ON public."Users" (organization_id, lower(email));
CREATE INDEX IF NOT EXISTS "activity_logs_org_created_idx" ON public.activity_logs (organization_id, created_at DESC);

-- 2. Pre-check RPC before creating an Auth user (checks writes gate, idempotency replay, and duplicate email)
CREATE OR REPLACE FUNCTION public.dealdesk_check_user_create(
  p_email text,
  p_request_body jsonb,
  p_user uuid,
  p_client text,
  p_session text,
  p_request uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  org constant text := 'org_azre_00001';
  replay public."PluginMutationAudit"%ROWTYPE;
  existing_user jsonb;
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
      IF replay.request_body=p_request_body THEN
        RETURN jsonb_build_object('replay',true,'result',replay.result||jsonb_build_object('replayed',true));
      END IF;
      RETURN jsonb_build_object('error',jsonb_build_object('code','REQUEST_ID_REUSED','message','This request_id was used for a different operation.'));
    END IF;
  END IF;

  SELECT jsonb_build_object('id',id,'name',name,'email',email,'position',position,'organization',organization)
  INTO existing_user
  FROM public."Users"
  WHERE lower(trim(email))=lower(trim(p_email))
  LIMIT 1;

  IF existing_user IS NOT NULL THEN
    RETURN jsonb_build_object(
      'error',
      jsonb_build_object(
        'code','DUPLICATE',
        'message','A DealDesk user account with this email already exists.',
        'details',jsonb_build_object('existing_user',existing_user)
      )
    );
  END IF;

  RETURN jsonb_build_object('ok',true);
END $$;

REVOKE ALL ON FUNCTION public.dealdesk_check_user_create(text,jsonb,uuid,text,text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.dealdesk_check_user_create(text,jsonb,uuid,text,text,uuid) TO service_role;

-- 3. Atomic user profile + optional MCP grant + audit writer (never persists passwords)
CREATE OR REPLACE FUNCTION public.dealdesk_create_user_profile(
  p_id uuid,
  p_name text,
  p_email text,
  p_position text,
  p_organization text,
  p_grant_mcp_access boolean,
  p_mcp_client_id text,
  p_mcp_operational_writes boolean,
  p_request_body jsonb,
  p_user uuid,
  p_client text,
  p_session text,
  p_request uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  org constant text := 'org_azre_00001';
  replay public."PluginMutationAudit"%ROWTYPE;
  new_user jsonb;
  resolved_client text := nullif(trim(coalesce(p_mcp_client_id,'')),'');
  grant_row jsonb := NULL;
  result jsonb;
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

  IF EXISTS(SELECT 1 FROM public."Users" WHERE lower(trim(email))=lower(trim(p_email))) THEN
    RETURN jsonb_build_object('error',jsonb_build_object('code','DUPLICATE','message','A DealDesk user account with this email already exists.'));
  END IF;

  IF coalesce(p_grant_mcp_access,false) THEN
    IF resolved_client IS NULL THEN
      SELECT client_id INTO resolved_client
      FROM public."PluginOAuthGrants"
      WHERE organization_id=org AND resource='https://dealdesk.asharizakargroup.com/api/mcp' AND enabled
      ORDER BY operational_writes DESC, client_id ASC
      LIMIT 1;
    END IF;
    IF resolved_client IS NULL THEN
      RETURN jsonb_build_object('error',jsonb_build_object('code','INVALID_REQUEST','message','mcp_client_id is required when grant_mcp_access is true and no existing OAuth client is configured.'));
    END IF;
  END IF;

  INSERT INTO public."Users"(id,name,email,position,organization,organization_id,"createdAt","loginStatus")
  VALUES(p_id,trim(p_name),lower(trim(p_email)),coalesce(nullif(trim(p_position),''),'Acquisitions'),coalesce(nullif(trim(p_organization),''),'AZRE'),org,now(),'Offline')
  RETURNING jsonb_build_object(
    'id',id,
    'name',name,
    'email',email,
    'position',position,
    'organization',organization,
    'createdAt',"createdAt",
    'loginStatus',"loginStatus",
    '_revision',"pluginRevision"
  ) INTO new_user;

  IF coalesce(p_grant_mcp_access,false) THEN
    INSERT INTO public."PluginOAuthGrants"(client_id,user_id,organization_id,resource,enabled,operational_writes)
    VALUES(resolved_client,p_id,org,'https://dealdesk.asharizakargroup.com/api/mcp',true,coalesce(p_mcp_operational_writes,false))
    ON CONFLICT (client_id,user_id) DO UPDATE SET
      enabled=true,
      operational_writes=EXCLUDED.operational_writes
    RETURNING jsonb_build_object(
      'client_id',client_id,
      'user_id',user_id,
      'resource',resource,
      'enabled',enabled,
      'operational_writes',operational_writes
    ) INTO grant_row;
  END IF;

  result := jsonb_build_object('user',new_user);
  IF grant_row IS NOT NULL THEN
    result := result||jsonb_build_object('mcp_grant',grant_row);
  END IF;

  INSERT INTO public."PluginMutationAudit"(organization_id,user_id,client_id,session_id,tool,entity_type,entity_id,changed_fields,previous_values,new_values,resulting_revision,supplied_fields,request_id,request_body,result)
  VALUES(org,p_user,p_client,p_session,'create_user','Users',p_id::text,ARRAY['name','email','position','organization'], '{}'::jsonb, result, 0, coalesce(p_request_body,'{}'::jsonb), p_request, p_request_body, result);

  RETURN result;
END $$;

REVOKE ALL ON FUNCTION public.dealdesk_create_user_profile(uuid,text,text,text,text,boolean,text,boolean,jsonb,uuid,text,text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.dealdesk_create_user_profile(uuid,text,text,text,text,boolean,text,boolean,jsonb,uuid,text,text,uuid) TO service_role;

NOTIFY pgrst,'reload schema';
COMMIT;

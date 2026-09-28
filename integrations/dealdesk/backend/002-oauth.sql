-- Private OAuth grants. No business records are changed by this migration.
-- Run before enabling Supabase OAuth. Review any pre-existing access-token hook
-- before selecting dealdesk_oauth_token_hook in Authentication > Hooks.
BEGIN;
CREATE TABLE IF NOT EXISTS public."PluginOAuthGrants" (
  client_id text NOT NULL,
  user_id uuid NOT NULL,
  organization_id text NOT NULL CHECK (organization_id = 'org_azre_00001'),
  resource text NOT NULL CHECK (resource = 'https://dealdesk.asharizakargroup.com/api/mcp'),
  enabled boolean NOT NULL DEFAULT true,
  PRIMARY KEY (client_id, user_id)
);
ALTER TABLE public."PluginOAuthGrants" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."PluginOAuthGrants" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."PluginOAuthGrants" TO service_role;
GRANT SELECT ON public."PluginOAuthGrants" TO supabase_auth_admin;
DROP POLICY IF EXISTS "Auth hook can read explicit grants" ON public."PluginOAuthGrants";
CREATE POLICY "Auth hook can read explicit grants" ON public."PluginOAuthGrants"
  FOR SELECT TO supabase_auth_admin USING (true);

-- Intentionally do NOT create or grant the JWT role dealdesk_mcp to PostgREST's
-- authenticator. MCP tokens cannot assume a database role or use the Data API.
-- Only our verified, organization-scoped, read-only Vercel handler accepts them.
CREATE OR REPLACE FUNCTION public.dealdesk_oauth_token_hook(event jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SET search_path = '' AS $$
DECLARE
  claims jsonb := event->'claims';
  client text := coalesce(event->>'client_id', event->'claims'->>'client_id');
  grant_row public."PluginOAuthGrants"%ROWTYPE;
BEGIN
  -- Normal DealDesk login/refresh tokens are unchanged.
  IF client IS NULL OR client = '' THEN RETURN jsonb_build_object('claims', claims); END IF;
  SELECT * INTO grant_row FROM public."PluginOAuthGrants"
    WHERE client_id = client AND user_id::text = event->>'user_id' AND enabled;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', jsonb_build_object('http_code', 403, 'message', 'This OAuth connection is not approved for DealDesk.'));
  END IF;
  claims := claims || jsonb_build_object(
    'aud', grant_row.resource, 'role', 'dealdesk_mcp', 'client_id', client,
    'dealdesk_organization', grant_row.organization_id, 'dealdesk_permission', 'read',
    'scope', 'openid'
  );
  RETURN jsonb_build_object('claims', claims);
END;
$$;
REVOKE ALL ON FUNCTION public.dealdesk_oauth_token_hook(jsonb) FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.dealdesk_oauth_token_hook(jsonb) TO supabase_auth_admin;
COMMIT;

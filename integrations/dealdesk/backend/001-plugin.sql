-- Apply to the DealDesk Supabase database before enabling the plugin endpoint.
-- Existing organizations must already be assigned; null-organization rows are
-- intentionally not visible through the plugin.
BEGIN;
CREATE TABLE IF NOT EXISTS public."PluginTasks" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id text NOT NULL,
  title text NOT NULL,
  description text,
  "entityType" text NOT NULL CHECK ("entityType" IN ('Deals','Buyers','Agents')),
  "entityId" text NOT NULL,
  "dueDate" date NOT NULL,
  assignee text,
  status text NOT NULL DEFAULT 'Open' CHECK (status IN ('Open','Completed')),
  "createdAt" timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public."PluginAudit" (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  organization_id text,
  "entityType" text NOT NULL,
  "entityId" text NOT NULL,
  action text NOT NULL,
  "changedFields" text[] NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public."PluginTasks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."PluginAudit" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."PluginTasks", public."PluginAudit" FROM anon, authenticated;
GRANT ALL ON public."PluginTasks", public."PluginAudit" TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public."PluginAudit_id_seq" TO service_role;

-- Current frontend names differ from the repository's older SQL schema.
ALTER TABLE public."Deals" ADD COLUMN IF NOT EXISTS "renovationARV" numeric;
ALTER TABLE public."Deals" ADD COLUMN IF NOT EXISTS "newConstructionARV" numeric;
ALTER TABLE public."Deals" ADD COLUMN IF NOT EXISTS "offerDecisionTracking" jsonb DEFAULT '[]'::jsonb;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='Deals' AND column_name='arv') THEN
    UPDATE public."Deals" SET "renovationARV" = arv WHERE "renovationARV" IS NULL AND arv IS NOT NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='Deals' AND column_name='newConstructionArv') THEN
    UPDATE public."Deals" SET "newConstructionARV" = "newConstructionArv" WHERE "newConstructionARV" IS NULL AND "newConstructionArv" IS NOT NULL;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.dealdesk_plugin_revision() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW."pluginRevision" := OLD."pluginRevision" + 1;
  RETURN NEW;
END;
$$;
CREATE OR REPLACE FUNCTION public.dealdesk_plugin_audit() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE changed text[];
BEGIN
  SELECT coalesce(array_agg(key ORDER BY key), ARRAY[]::text[]) INTO changed
  FROM jsonb_each(to_jsonb(NEW))
  WHERE key <> 'pluginRevision'
    AND (TG_OP = 'INSERT' OR value IS DISTINCT FROM to_jsonb(OLD)->key);
  INSERT INTO public."PluginAudit" (organization_id,"entityType","entityId",action,"changedFields")
  VALUES (NEW.organization_id,TG_TABLE_NAME,NEW.id::text,TG_OP,changed);
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.dealdesk_plugin_revision() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.dealdesk_plugin_audit() FROM PUBLIC;

DO $$ DECLARE tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['Deals','Buyers','Agents','PluginTasks'] LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS organization_id text',tbl);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS "pluginRevision" bigint NOT NULL DEFAULT 0',tbl);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS "pluginArchivedAt" timestamptz',tbl);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS "pluginArchiveReason" text',tbl);
    EXECUTE format('DROP TRIGGER IF EXISTS dealdesk_plugin_revision ON public.%I',tbl);
    EXECUTE format('CREATE TRIGGER dealdesk_plugin_revision BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.dealdesk_plugin_revision()',tbl);
    EXECUTE format('DROP TRIGGER IF EXISTS dealdesk_plugin_audit ON public.%I',tbl);
    EXECUTE format('CREATE TRIGGER dealdesk_plugin_audit AFTER INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.dealdesk_plugin_audit()',tbl);
  END LOOP;
END $$;
NOTIFY pgrst, 'reload schema';
COMMIT;

-- Default and backfill organization_id on OffMarketProperties and OffMarketOfferTextMessageGenerator
-- so existing UI-imported records and future direct UI inserts belong to org_azre_00001.
-- Non-destructive and repeatable: does not add or remove any property records.
BEGIN;

ALTER TABLE public."OffMarketProperties"
  ALTER COLUMN organization_id SET DEFAULT 'org_azre_00001';

ALTER TABLE public."OffMarketOfferTextMessageGenerator"
  ALTER COLUMN organization_id SET DEFAULT 'org_azre_00001';

UPDATE public."OffMarketProperties"
SET organization_id = 'org_azre_00001'
WHERE organization_id IS NULL;

UPDATE public."OffMarketOfferTextMessageGenerator"
SET organization_id = 'org_azre_00001'
WHERE organization_id IS NULL;

NOTIFY pgrst, 'reload schema';
COMMIT;

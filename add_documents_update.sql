ALTER TABLE public."Deals"
ADD COLUMN IF NOT EXISTS "documents" JSONB DEFAULT '[]'::jsonb;

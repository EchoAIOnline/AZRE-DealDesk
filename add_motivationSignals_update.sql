ALTER TABLE public."Deals" 
ADD COLUMN IF NOT EXISTS "motivationSignals" JSONB DEFAULT '[]'::jsonb;

-- SQL Script to update Supabase database for the new JV Pipeline with a separate table

-- 0. Cleanup old triggers and functions if they exist from previous attempts
DROP TRIGGER IF EXISTS sync_jv_deal_trigger ON public."Deals";
DROP TRIGGER IF EXISTS remove_jv_deal_trigger ON public."Deals";
DROP TRIGGER IF EXISTS sync_jv_deal_trigger ON public."JVDeals";
DROP TRIGGER IF EXISTS remove_jv_deal_trigger ON public."JVDeals";
DROP FUNCTION IF EXISTS sync_jv_deal_to_wholesaler() CASCADE;
DROP FUNCTION IF EXISTS remove_jv_deal_from_wholesaler() CASCADE;

-- 1. Create the JVDeals table
CREATE TABLE IF NOT EXISTS public."JVDeals" (
    id TEXT PRIMARY KEY,
    "pipelineType" TEXT DEFAULT 'jv',
    "createdAt" TEXT,
    "address" TEXT,
    "mls" TEXT,
    "listPrice" NUMERIC,
    "offerPrice" NUMERIC,
    "agentName" TEXT,
    "agentPhone" TEXT,
    "agentEmail" TEXT,
    "agentBrokerage" TEXT,
    "secondAgentId" TEXT,
    "thirdAgentId" TEXT,
    "acquisitionManager" TEXT,
    "status" TEXT,
    "offerDecision" TEXT,
    "subMarket" TEXT,
    "neighborhood" TEXT,
    "dealType" JSONB,
    "interestLevel" TEXT,
    "logs" JSONB,
    "inspectionDate" TEXT,
    "emdDate" TEXT,
    "underContractDate" TEXT,
    "closedDate" TEXT,
    "declinedDate" TEXT,
    "nextFollowUpDate" TEXT,
    "lastContactDate" TEXT,
    "dispo" JSONB,
    "listingDescription" TEXT,
    "originalAskingPrice" NUMERIC,
    "reducedAskingPrice" NUMERIC,
    "negotiatedAskingPrice" NUMERIC,
    "desiredWholesaleProfit" NUMERIC,
    "priceReductionAlert" TEXT,
    "forSaleBy" TEXT,
    "listingStatus" TEXT,
    "contactStatus" TEXT,
    "agentContacted" TEXT,
    "propertyType" TEXT,
    "listingType" TEXT,
    "yearBuilt" NUMERIC,
    "bedrooms" NUMERIC,
    "bathrooms" NUMERIC,
    "sqft" NUMERIC,
    "lotSqft" NUMERIC,
    "county" TEXT,
    "zoning" TEXT,
    "lockBoxCode" TEXT,
    "dateListed" TEXT,
    "arv" NUMERIC,
    "newConstructionArv" NUMERIC,
    "newConstructionEstimate" NUMERIC,
    "renovationEstimate" NUMERIC,
    "comparable1" JSONB,
    "comparable2" JSONB,
    "comparable3" JSONB,
    "newConstructionComparable1" JSONB,
    "newConstructionComparable2" JSONB,
    "newConstructionComparable3" JSONB,
    "photos" JSONB,
    "picturesFolderId" TEXT,
    "excludeStreetView" BOOLEAN
);

-- 2. Create a function to update Wholesaler properties when a JV deal is added/updated
CREATE OR REPLACE FUNCTION sync_jv_deal_to_wholesaler_jv()
RETURNS TRIGGER AS $$
DECLARE
    wholesaler_id TEXT;
    current_properties JSONB;
    new_property JSONB;
    updated_properties JSONB;
    deal_status TEXT;
    
    -- Array to hold all wholesaler IDs associated with this deal
    wholesaler_ids TEXT[] := ARRAY[]::TEXT[];
    old_wholesaler_ids TEXT[] := ARRAY[]::TEXT[];
    w_id TEXT;
BEGIN
    -- Get primary wholesaler ID by name
    IF NEW."agentName" IS NOT NULL AND NEW."agentName" != '' THEN
        SELECT id INTO wholesaler_id FROM public."Wholesalers" WHERE name = NEW."agentName" LIMIT 1;
        IF wholesaler_id IS NOT NULL THEN
            wholesaler_ids := array_append(wholesaler_ids, wholesaler_id);
        END IF;
    END IF;
    
    -- Add second and third wholesaler IDs
    IF NEW."secondAgentId" IS NOT NULL AND NEW."secondAgentId" != '' THEN
        wholesaler_ids := array_append(wholesaler_ids, NEW."secondAgentId");
    END IF;
    
    IF NEW."thirdAgentId" IS NOT NULL AND NEW."thirdAgentId" != '' THEN
        wholesaler_ids := array_append(wholesaler_ids, NEW."thirdAgentId");
    END IF;
    
    -- Map deal offerDecision to WholesalerProperty status
    IF NEW."offerDecision" = 'Available' THEN
        deal_status := 'Available';
    ELSE
        deal_status := 'No Longer Available';
    END IF;
    
    new_property := jsonb_build_object(
        'id', NEW.id,
        'address', NEW.address,
        'status', deal_status
    );
    
    -- Update each associated wholesaler
    FOREACH w_id IN ARRAY wholesaler_ids
    LOOP
        SELECT properties INTO current_properties FROM public."Wholesalers" WHERE id = w_id;
        current_properties := COALESCE(current_properties, '[]'::jsonb);
        
        -- Remove existing entry for this deal to avoid duplicates
        SELECT jsonb_agg(elem) INTO updated_properties
        FROM jsonb_array_elements(current_properties) AS elem
        WHERE elem->>'id' != NEW.id;
        
        updated_properties := COALESCE(updated_properties, '[]'::jsonb) || new_property;
        
        UPDATE public."Wholesalers"
        SET properties = updated_properties
        WHERE id = w_id;
    END LOOP;
    
    -- Handle case where the wholesaler was removed (UPDATE)
    IF TG_OP = 'UPDATE' THEN
        
        -- Get old primary wholesaler ID by name
        IF OLD."agentName" IS NOT NULL AND OLD."agentName" != '' THEN
            SELECT id INTO wholesaler_id FROM public."Wholesalers" WHERE name = OLD."agentName" LIMIT 1;
            IF wholesaler_id IS NOT NULL THEN
                old_wholesaler_ids := array_append(old_wholesaler_ids, wholesaler_id);
            END IF;
        END IF;
        
        IF OLD."secondAgentId" IS NOT NULL AND OLD."secondAgentId" != '' THEN
            old_wholesaler_ids := array_append(old_wholesaler_ids, OLD."secondAgentId");
        END IF;
        
        IF OLD."thirdAgentId" IS NOT NULL AND OLD."thirdAgentId" != '' THEN
            old_wholesaler_ids := array_append(old_wholesaler_ids, OLD."thirdAgentId");
        END IF;
        
        -- For each old wholesaler, if they are not in the new list, remove the deal
        FOREACH w_id IN ARRAY old_wholesaler_ids
        LOOP
            IF NOT (w_id = ANY(wholesaler_ids)) THEN
                SELECT properties INTO current_properties FROM public."Wholesalers" WHERE id = w_id;
                
                IF current_properties IS NOT NULL THEN
                    SELECT jsonb_agg(elem) INTO updated_properties
                    FROM jsonb_array_elements(current_properties) AS elem
                    WHERE elem->>'id' != OLD.id;
                    
                    UPDATE public."Wholesalers"
                    SET properties = COALESCE(updated_properties, '[]'::jsonb)
                    WHERE id = w_id;
                END IF;
            END IF;
        END LOOP;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Create the trigger on the JVDeals table
DROP TRIGGER IF EXISTS sync_jv_deal_trigger_jv ON public."JVDeals";
CREATE TRIGGER sync_jv_deal_trigger_jv
AFTER INSERT OR UPDATE ON public."JVDeals"
FOR EACH ROW
EXECUTE FUNCTION sync_jv_deal_to_wholesaler_jv();

-- 4. Create a function to handle deal deletion (remove from wholesaler)
CREATE OR REPLACE FUNCTION remove_jv_deal_from_wholesaler_jv()
RETURNS TRIGGER AS $$
DECLARE
    wholesaler_id TEXT;
    current_properties JSONB;
    updated_properties JSONB;
    old_wholesaler_ids TEXT[] := ARRAY[]::TEXT[];
    w_id TEXT;
BEGIN
    -- Get old primary wholesaler ID by name
    IF OLD."agentName" IS NOT NULL AND OLD."agentName" != '' THEN
        SELECT id INTO wholesaler_id FROM public."Wholesalers" WHERE name = OLD."agentName" LIMIT 1;
        IF wholesaler_id IS NOT NULL THEN
            old_wholesaler_ids := array_append(old_wholesaler_ids, wholesaler_id);
        END IF;
    END IF;
    
    IF OLD."secondAgentId" IS NOT NULL AND OLD."secondAgentId" != '' THEN
        old_wholesaler_ids := array_append(old_wholesaler_ids, OLD."secondAgentId");
    END IF;
    
    IF OLD."thirdAgentId" IS NOT NULL AND OLD."thirdAgentId" != '' THEN
        old_wholesaler_ids := array_append(old_wholesaler_ids, OLD."thirdAgentId");
    END IF;
    
    FOREACH w_id IN ARRAY old_wholesaler_ids
    LOOP
        SELECT properties INTO current_properties FROM public."Wholesalers" WHERE id = w_id;
        
        IF current_properties IS NOT NULL THEN
            SELECT jsonb_agg(elem) INTO updated_properties
            FROM jsonb_array_elements(current_properties) AS elem
            WHERE elem->>'id' != OLD.id;
            
            UPDATE public."Wholesalers"
            SET properties = COALESCE(updated_properties, '[]'::jsonb)
            WHERE id = w_id;
        END IF;
    END LOOP;
    
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- 5. Create the trigger for deal deletion
DROP TRIGGER IF EXISTS remove_jv_deal_trigger_jv ON public."JVDeals";
CREATE TRIGGER remove_jv_deal_trigger_jv
AFTER DELETE ON public."JVDeals"
FOR EACH ROW
EXECUTE FUNCTION remove_jv_deal_from_wholesaler_jv();

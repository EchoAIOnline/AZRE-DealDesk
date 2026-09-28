import { createClient } from "@supabase/supabase-js";
import { makeHandler } from "../../integrations/dealdesk/backend/handler.mjs";

export default makeHandler({ createClient });

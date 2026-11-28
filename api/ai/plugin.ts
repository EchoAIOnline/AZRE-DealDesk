import { createClient } from "@supabase/supabase-js";
import { makeHandler } from "../../integrations/dealdesk/backend/handler.mjs";
import { zillow, sendEmail, geminiComps, geminiChat } from "../mcp.js";

export const config = { maxDuration: 60 };
export default makeHandler({
  createClient,
  services: { zillow, sendEmail, geminiComps, geminiChat },
});

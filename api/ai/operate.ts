import { createClient } from "@supabase/supabase-js";

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: "Missing Authorization header" });
    }

    const token = authHeader.replace("Bearer ", "");
    if (token !== process.env.DEALDESK_API_KEY) {
      return res.status(403).json({ error: "Invalid API key" });
    }

    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    // Prefer service role key for full admin access by the AI, fallback to anon key
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json({ error: "Database configuration missing on server" });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const { action, table, payload, match, id } = req.body;

    if (!action || !table) {
      return res.status(400).json({ error: "Missing required fields: action, table" });
    }

    let result;
    let error;

    switch (action) {
      case "read":
        let query = supabase.from(table).select('*');
        if (match) {
          query = query.match(match);
        }
        const readResponse = await query;
        result = readResponse.data;
        error = readResponse.error;
        break;
      case "create":
        if (!payload) return res.status(400).json({ error: "Missing payload for create" });
        const createResponse = await supabase.from(table).insert(payload).select();
        result = createResponse.data;
        error = createResponse.error;
        break;
      case "update":
        if (!payload) return res.status(400).json({ error: "Missing payload for update" });
        let updateQuery = supabase.from(table).update(payload);
        if (id) {
           updateQuery = updateQuery.eq("id", id);
        } else if (match) {
           updateQuery = updateQuery.match(match);
        } else {
           return res.status(400).json({ error: "Missing id or match for update" });
        }
        const updateResponse = await updateQuery.select();
        result = updateResponse.data;
        error = updateResponse.error;
        break;
      case "delete":
        let deleteQuery = supabase.from(table).delete();
        if (id) {
          deleteQuery = deleteQuery.eq("id", id);
        } else if (match) {
          deleteQuery = deleteQuery.match(match);
        } else {
          return res.status(400).json({ error: "Missing id or match for delete" });
        }
        const deleteResponse = await deleteQuery;
        result = deleteResponse.data;
        error = deleteResponse.error;
        break;
      default:
        return res.status(400).json({ error: `Unsupported action: ${action}` });
    }

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    return res.status(200).json({ success: true, data: result });
  } catch (err: any) {
    console.error("AI Operate Error:", err);
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
}

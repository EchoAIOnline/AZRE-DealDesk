import { createClient } from "@supabase/supabase-js";
import { randomUUID, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { zillow, sendEmail, geminiComps, geminiChat } from "../mcp.js";
import { validateZillowUrl, mapZillow, safeZillowData } from "../../integrations/dealdesk/src/zillow.mjs";
import { DomainError } from "../../integrations/dealdesk/src/domain.mjs";
import { executeGetDashboard, executeGetActivityFeed, executeLogActivity } from "../../integrations/dealdesk/src/dashboard.mjs";
import { createUserDirect } from "../../integrations/dealdesk/src/users.mjs";

const BLOCKED_TABLES = new Set(["Users", "PluginOAuthGrants"]);
const SECRET_COLUMNS = ["supabaseKey", "twilioAuthToken", "mlsApiKey"];

function sanitizeRow(table: string, row: any) {
  if (!row || typeof row !== "object") return row;
  if (table !== "Integrations") return row;
  const copy = { ...row };
  for (const key of SECRET_COLUMNS) delete copy[key];
  return copy;
}

function sanitizeData(table: string, data: any) {
  if (Array.isArray(data)) return data.map(row => sanitizeRow(table, row));
  return sanitizeRow(table, data);
}

function keysEqual(a: string | undefined, b: string | undefined): boolean {
  if (!a || !b) return false;
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

function stripActionEnvelope(body: Record<string, any>) {
  const { action: _action, payload, table: _table, match: _match, ...rest } = body;
  return payload && typeof payload === "object" ? payload : rest;
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || typeof authHeader !== "string") {
      return res.status(401).json({ error: "Missing Authorization header" });
    }

    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!keysEqual(token, process.env.DEALDESK_API_KEY)) {
      return res.status(403).json({ error: "Invalid API key" });
    }

    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
    const org = process.env.DEALDESK_PLUGIN_ORGANIZATION_ID || "org_azre_00001";

    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json({ error: "Database configuration missing on server" });
    }

    const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const body = req.body || {};
    const { action, table, payload, match, id } = body;

    if (!action) {
      return res.status(400).json({ error: "Missing required field: action" });
    }

    // --- Service Actions ---
    if (action === "send_email") {
      const emailPayload = payload || {
        recipients: body.recipients,
        subject: body.subject,
        body: body.body,
        fromAddress: body.fromAddress,
      };
      if (!emailPayload?.recipients?.length || !emailPayload?.subject || !emailPayload?.body) {
        return res.status(400).json({ error: "Missing recipients, subject, or body for send_email" });
      }
      const data = await sendEmail(emailPayload);
      return res.status(200).json({ success: true, data });
    }

    if (action === "zillow_scrape") {
      const rawUrl = body.url || payload?.url;
      if (!rawUrl || typeof rawUrl !== "string") {
        return res.status(400).json({ error: "Missing url for zillow_scrape" });
      }
      const cleanUrl = validateZillowUrl(rawUrl);
      const items = await zillow(cleanUrl);
      const data = safeZillowData(Array.isArray(items) ? items : [items]);
      if (body.create_deal && Array.isArray(items) && items.length === 1) {
        const mapped: Record<string, any> = mapZillow(items[0]);
        const newDeal = {
          id: randomUUID(),
          status: "Analyzing",
          offerDecision: "No Offer Made Yet",
          logs: [],
          dealType: [],
          dispo: { photos: false, blast: false },
          queueStatus: "In Pipeline",
          pipelineType: mapped.listingType === "Off-Market" ? "off-market" : "mls",
          ...mapped,
          organization_id: org,
        };
        const { data: created, error } = await supabase.from("Deals").insert(newDeal).select();
        if (error) return res.status(400).json({ error: error.message });
        return res.status(200).json({ success: true, data: { url: cleanUrl, zillow: data, saved: true, record: created?.[0] } });
      }
      return res.status(200).json({ success: true, data: { url: cleanUrl, zillow: data, saved: false } });
    }

    if (action === "gemini_comps") {
      const params = payload || body;
      if (!params.address) return res.status(400).json({ error: "Missing address for gemini_comps" });
      const data = await geminiComps({ address: params.address, sqft: params.sqft, beds: params.beds, baths: params.baths });
      return res.status(200).json({ success: true, data });
    }

    if (action === "gemini_chat") {
      const message = body.message || payload?.message;
      if (!message) return res.status(400).json({ error: "Missing message for gemini_chat" });
      const reply = await geminiChat({ message });
      return res.status(200).json({ success: true, data: { reply } });
    }

    if (action === "get_dashboard") {
      const data = await executeGetDashboard(supabase, stripActionEnvelope(body), org);
      return res.status(200).json({ success: true, data });
    }

    if (action === "get_activity_feed") {
      const data = await executeGetActivityFeed(supabase, stripActionEnvelope(body), org);
      return res.status(200).json({ success: true, data });
    }

    if (action === "log_activity") {
      const data = await executeLogActivity(supabase, stripActionEnvelope(body), org, { userId: "api-operate", userName: "DealDesk API" });
      return res.status(200).json({ success: true, data });
    }

    if (action === "create_user") {
      if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
        return res.status(503).json({ error: "User creation requires SUPABASE_SERVICE_ROLE_KEY on server" });
      }
      const data = await createUserDirect(supabase, stripActionEnvelope(body), org);
      return res.status(200).json({ success: true, data });
    }

    if (action === "move_deal") {
      const targetPipeline = body.target_pipeline || payload?.target_pipeline;
      if (!id || !["mls", "off-market", "azre-queue", "dfd"].includes(targetPipeline)) {
        return res.status(400).json({ error: "Missing id or valid target_pipeline (mls, off-market, azre-queue, dfd)" });
      }
      let srcTable = "Deals";
      let { data: rows, error: findErr } = await supabase.from("Deals").select("*").eq("id", id);
      if (findErr) return res.status(400).json({ error: findErr.message });
      if (!rows?.length) {
        const jvRes = await supabase.from("JVDeals").select("*").eq("id", id);
        if (jvRes.error) return res.status(400).json({ error: jvRes.error.message });
        rows = jvRes.data;
        srcTable = "JVDeals";
      }
      if (!rows?.length) return res.status(404).json({ error: "Deal not found" });
      const dstTable = targetPipeline === "dfd" ? "JVDeals" : "Deals";
      const patch =
        targetPipeline === "dfd"
          ? { pipelineType: "dfd" }
          : targetPipeline === "azre-queue"
            ? { queueStatus: "In Queue", pipelineType: "azre-queue" }
            : targetPipeline === "off-market"
              ? { queueStatus: "In Pipeline", listingType: "Off-Market", pipelineType: "off-market" }
              : { queueStatus: "In Pipeline", listingType: "Listed On MLS", pipelineType: "mls" };
      if (srcTable === dstTable) {
        const { data: updated, error: updErr } = await supabase.from(dstTable).update(patch).eq("id", id).select();
        if (updErr) return res.status(400).json({ error: updErr.message });
        return res.status(200).json({ success: true, data: updated?.[0], moved_from: srcTable, moved_to: dstTable });
      }
      const { data: inserted, error: insErr } = await supabase.from(dstTable).insert({ ...rows[0], ...patch }).select();
      if (insErr) return res.status(400).json({ error: insErr.message });
      await supabase.from(srcTable).delete().eq("id", id);
      return res.status(200).json({ success: true, data: inserted?.[0], moved_from: srcTable, moved_to: dstTable });
    }

    if (action === "move_contact") {
      const sourceTable = body.source_table || table;
      const targetTable = body.target_table;
      const valid = ["Buyers", "Agents", "Wholesalers"];
      if (!id || !valid.includes(sourceTable) || !valid.includes(targetTable) || sourceTable === targetTable) {
        return res.status(400).json({ error: "Provide id and distinct source_table/target_table among Buyers, Agents, Wholesalers" });
      }
      const { data: rows, error: findErr } = await supabase.from(sourceTable).select("*").eq("id", id);
      if (findErr) return res.status(400).json({ error: findErr.message });
      if (!rows?.length) return res.status(404).json({ error: "Contact not found" });
      const row = rows[0];
      const prevNotes = Array.isArray(row.notes) ? row.notes : [];
      const movedNote = `${new Date().toISOString()} | DealDesk API | Moved from ${sourceTable}.`;
      const parts = String(row.name || "").trim().split(/\s+/).filter(Boolean);
      const common = {
        id: randomUUID(),
        organization_id: row.organization_id || process.env.DEALDESK_PLUGIN_ORGANIZATION_ID || null,
        name: row.name || "Unknown",
        phone: row.phone || null,
        email: row.email || null,
        photo: row.photo || null,
        notes: [movedNote, ...prevNotes],
        subscriptionStatus: row.subscriptionStatus || "Subscribed",
      };
      const newRow: Record<string, any> =
        targetTable === "Buyers"
          ? { ...common, companyName: row.companyName || row.brokerage || "", status: "New Lead", propertiesBought: 0, buyBox: { locations: "", minPrice: 0, maxPrice: 0, propertyTypes: [], minBedrooms: 0, minBathrooms: 0, notes: "" } }
          : targetTable === "Agents"
            ? { ...common, agentFirstName: parts[0] || "", agentLastName: parts.slice(1).join(" "), brokerage: row.companyName || row.brokerage || "" }
            : { ...common, companyName: row.companyName || row.brokerage || "", status: "New", properties: [], closedDealIds: [] };
      const { data: inserted, error: insErr } = await supabase.from(targetTable).insert(newRow).select();
      if (insErr) return res.status(400).json({ error: insErr.message });
      await supabase.from(sourceTable).delete().eq("id", id);
      return res.status(200).json({ success: true, data: inserted?.[0], moved_from: sourceTable, moved_to: targetTable });
    }

    // --- Table Operations ---
    if (!table) {
      return res.status(400).json({ error: "Missing required field: table" });
    }
    if (BLOCKED_TABLES.has(table)) {
      return res.status(403).json({ error: `Direct access to ${table} is restricted` });
    }

    let result;
    let error;

    switch (action) {
      case "read": {
        let query = supabase.from(table).select("*");
        if (id !== undefined) query = query.eq("id", id);
        if (match) query = query.match(match);
        if (body.filters && typeof body.filters === "object") {
          for (const [k, v] of Object.entries(body.filters)) {
            if (v !== undefined) query = query.eq(k, v);
          }
        }
        if (typeof body.limit === "number" && body.limit > 0) {
          const offset = typeof body.offset === "number" && body.offset >= 0 ? body.offset : 0;
          query = query.range(offset, offset + Math.min(body.limit, 500) - 1);
        }
        const readResponse = await query;
        result = sanitizeData(table, readResponse.data);
        error = readResponse.error;
        break;
      }
      case "create": {
        if (!payload) return res.status(400).json({ error: "Missing payload for create" });
        const createResponse = await supabase.from(table).insert(payload).select();
        result = sanitizeData(table, createResponse.data);
        error = createResponse.error;
        break;
      }
      case "update": {
        if (!payload) return res.status(400).json({ error: "Missing payload for update" });
        let updateQuery = supabase.from(table).update(payload);
        if (id !== undefined) {
          updateQuery = updateQuery.eq("id", id);
        } else if (match) {
          updateQuery = updateQuery.match(match);
        } else {
          return res.status(400).json({ error: "Missing id or match for update" });
        }
        const updateResponse = await updateQuery.select();
        result = sanitizeData(table, updateResponse.data);
        error = updateResponse.error;
        break;
      }
      case "append_note": {
        const noteText = body.note || payload?.note || body.text;
        if (id === undefined || !noteText) {
          return res.status(400).json({ error: "Missing id or note text for append_note" });
        }
        const noteField = table === "Deals" || table === "JVDeals" ? "logs" : table === "OffMarketProperties" ? "Notes" : "notes";
        const { data: existingRows, error: fetchErr } = await supabase.from(table).select("*").eq("id", id);
        if (fetchErr) return res.status(400).json({ error: fetchErr.message });
        if (!existingRows?.length) return res.status(404).json({ error: "Record not found" });
        const prev = Array.isArray(existingRows[0][noteField]) ? existingRows[0][noteField] : [];
        const entry = `${new Date().toISOString()} | DealDesk API | ${noteText}`;
        const noteRes = await supabase.from(table).update({ [noteField]: [entry, ...prev] }).eq("id", id).select();
        result = sanitizeData(table, noteRes.data);
        error = noteRes.error;
        break;
      }
      case "delete": {
        let deleteQuery = supabase.from(table).delete();
        if (id !== undefined) {
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
      }
      default:
        return res.status(400).json({ error: `Unsupported action: ${action}` });
    }

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    return res.status(200).json({ success: true, data: result });
  } catch (err: any) {
    console.error("AI Operate Error:", err?.message || "Unknown error");
    if (err instanceof DomainError) {
      const status =
        err.code === "DUPLICATE" || err.code === "CONFLICT" ? 409
          : err.code === "NOT_FOUND" ? 404
            : err.code === "WRITES_DISABLED" ? 403
              : err.code === "SERVICE_UNAVAILABLE" ? 503
                : 400;
      const details = (err as DomainError & { details?: unknown }).details;
      return res.status(status).json({ error: err.message, code: err.code, ...(details ? { details } : {}) });
    }
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid request fields", code: "INVALID_REQUEST" });
    }
    const status = err?.code === "INVALID_URL" ? 400 : 500;
    return res.status(status).json({ error: err?.message || "Internal server error" });
  }
}

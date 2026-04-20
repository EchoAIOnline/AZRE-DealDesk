
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { GOOGLE_SCRIPT_URL } from '../constants';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

const isValidUrl = (url: string) => {
    try {
        new URL(url);
        return true;
    } catch {
        return false;
    }
};

export const supabase: SupabaseClient = supabaseUrl && supabaseKey && isValidUrl(supabaseUrl)
    ? createClient(supabaseUrl, supabaseKey) 
    : createClient('https://placeholder.supabase.co', 'placeholder');

// Cache the current user's organization ID to append to saves.
let currentOrgId: string | null = null;
export const setOrganizationId = (orgId: string | null) => {
    currentOrgId = orgId;
};

export interface Recipient {
    email: string;
    name: string;
    city?: string;
}

export const DEFAULT_DEALS: any[] = [];

// Helper to clean array fields
function cleanArrayField(field: any, isArray: boolean): any[] {
    if (!field) return [];
    if (Array.isArray(field)) return field;
    if (typeof field === 'string') {
        try {
            const parsed = JSON.parse(field);
            if (Array.isArray(parsed)) return parsed;
            return [field];
        } catch (e) {
            return field.split(',').map((s: string) => s.trim()).filter(Boolean);
        }
    }
    return [];
}

// Helper to process items coming FROM the database
const processIncomingItem = (item: any, tableName: string) => {
    const processed = { ...item };
    
    // Normalize timestamps: Ensure createdAt exists if created_at is present
    if (processed.created_at && !processed.createdAt) {
        processed.createdAt = processed.created_at;
    }
    
    if (tableName === 'Deals' || tableName === 'JVDeals') {
        processed.photos = cleanArrayField(processed.photos, false).filter(Boolean);
        processed.dealType = Array.from(new Set(cleanArrayField(processed.dealType, true))).filter(Boolean);
        processed.logs = cleanArrayField(processed.logs, false).filter(Boolean);
        processed.interestedBuyers = cleanArrayField(processed.interestedBuyers, false);
        processed.buyersWhoPassed = cleanArrayField(processed.buyersWhoPassed, false);
        processed.pipelineType = tableName === 'JVDeals' ? 'jv' : 'main';
    }

    if (tableName === 'Wholesalers') {
        processed.notes = cleanArrayField(processed.notes, false).filter(Boolean);
        if (typeof processed.properties === 'string') {
            try { processed.properties = JSON.parse(processed.properties); } catch { }
        }
        if (!Array.isArray(processed.properties)) processed.properties = [];
    }
    
    // Process Buyers
    if (tableName === 'Buyers') {
        processed.notes = cleanArrayField(processed.notes, false).filter(Boolean);
        if (processed.buyBox && typeof processed.buyBox === 'string') {
             try { processed.buyBox = JSON.parse(processed.buyBox); } catch {}
        }
    }

    // Process Agents
    if (tableName === 'Agents') {
        processed.notes = cleanArrayField(processed.notes, false).filter(Boolean);
        processed.closedDealIds = cleanArrayField(processed.closedDealIds, false).filter(Boolean);
    }
    
    return processed;
};

export const sendEmail = async (email: string, subject: string, body: string) => {
    return sendBulkEmailGAS([{ email, name: "Recipient" }], subject, body);
};

export const sendBulkEmailGAS = async (recipients: any[], subject: string, body: string, fromAddress?: string) => {
    if (!GOOGLE_SCRIPT_URL) throw new Error("Script URL missing");
    
    try {
        const response = await fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            headers: { "Content-Type": "text/plain" },
            body: JSON.stringify({
                action: 'send_bulk_email',
                data: {
                    recipients: recipients,
                    subject: subject,
                    body: body,
                    fromAddress: fromAddress
                }
            })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        try {
            const data = await response.json();
            return data;
        } catch (parseError) {
            console.error("Could not parse GAS response. The script might require authentication or the URL is incorrect.", parseError);
            throw new Error("Invalid response from Google Apps Script. Ensure the script is deployed to execute as 'Me' and accessible to 'Anyone'.");
        }
    } catch (e: any) {
        console.error("sendBulkEmailGAS error:", e);
        return { status: 'error', message: e.message || String(e) };
    }
};

export const executeAdminSql = async (query: string) => {
    // Assuming this proxies through the Google Script or a Supabase Edge Function
    // Since direct SQL execution isn't standard in supabase-js client without RPC
    if (GOOGLE_SCRIPT_URL) {
        const response = await fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: 'execute_sql',
                query: query
            })
        });
        return await response.json();
    }
    
    if (!supabaseUrl || !supabaseKey) {
        return { status: 'error', message: 'Supabase is not configured' };
    }

    // Fallback: Try Supabase RPC if exists
    const { data, error } = await supabase.rpc('execute_sql', { query });
    if (error) return { status: 'error', message: error.message };
    return { status: 'success', data };
};

export const api = {
    load: async (table: string) => {
        if (!supabaseUrl || !supabaseKey) {
             console.warn("Supabase not configured. Return empty dataset.");
             return [];
        }
        const { data, error } = await supabase.from(table).select('*');
        if (error) {
            console.error(`Error loading ${table}:`, error);
            throw error;
        }
        return data.map(item => processIncomingItem(item, table));
    },

    save: async (item: any, table: string) => {
        if (!supabaseUrl || !supabaseKey) {
             return null;
        }
        // Strip ID if it looks like a temp ID or let Supabase handle it if UUID
        const payload = { ...item };
        
        // Auto-inject organization_id
        if (currentOrgId && !payload.organization_id && table !== 'Users') {
            payload.organization_id = currentOrgId;
        }
        
        // Ensure JSON fields are stringified if needed for text columns
        if (table === 'Wholesalers' && payload.properties && typeof payload.properties === 'object') {
            payload.properties = JSON.stringify(payload.properties);
        }
        
        if (table === 'Deals' || table === 'JVDeals') {
            if (payload.interestedBuyers && typeof payload.interestedBuyers === 'object') {
                payload.interestedBuyers = JSON.stringify(payload.interestedBuyers);
            }
            if (payload.buyersWhoPassed && typeof payload.buyersWhoPassed === 'object') {
                payload.buyersWhoPassed = JSON.stringify(payload.buyersWhoPassed);
            }
        }
        
        const { data, error } = await supabase.from(table).upsert(payload).select().single();
        if (error) {
            console.error(`Error saving to ${table}:`, JSON.stringify(error, null, 2));
            throw error;
        }
        return processIncomingItem(data, table);
    },

    saveBatch: async (items: any[], table: string) => {
        if (!supabaseUrl || !supabaseKey) {
             return null;
        }
        const payloads = items.map(item => {
            const payload = { ...item };
            
            // Auto-inject organization_id
            if (currentOrgId && !payload.organization_id && table !== 'Users') {
                payload.organization_id = currentOrgId;
            }
            if (table === 'Wholesalers' && payload.properties && typeof payload.properties === 'object') {
                payload.properties = JSON.stringify(payload.properties);
            }
            if (table === 'Deals' || table === 'JVDeals') {
                if (payload.interestedBuyers && typeof payload.interestedBuyers === 'object') {
                    payload.interestedBuyers = JSON.stringify(payload.interestedBuyers);
                }
                if (payload.buyersWhoPassed && typeof payload.buyersWhoPassed === 'object') {
                    payload.buyersWhoPassed = JSON.stringify(payload.buyersWhoPassed);
                }
            }
            return payload;
        });

        const { data, error } = await supabase.from(table).upsert(payloads).select();
        if (error) {
            console.error(`Error batch saving to ${table}:`, error);
            throw error;
        }
        return data.map(item => processIncomingItem(item, table));
    },

    delete: async (id: string, table: string) => {
        if (!supabaseUrl || !supabaseKey) {
             return false;
        }
        const { error } = await supabase.from(table).delete().eq('id', id);
        if (error) {
            console.error(`Error deleting from ${table}:`, error);
            return false;
        }
        return true;
    },

    saveCampaign: async (campaign: any) => {
        // Ensure deliveryLogs is JSON
        const payload = { ...campaign };
        // Clean up or format specific fields if necessary
        return api.save(payload, 'Campaigns');
    }
};

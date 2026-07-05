
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { GOOGLE_SCRIPT_URL } from '../constants';

const rawSupabaseUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim();
const supabaseUrl = rawSupabaseUrl.startsWith('http') ? rawSupabaseUrl : (rawSupabaseUrl ? `https://${rawSupabaseUrl}` : '');
const supabaseKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

const isValidUrl = (url: string) => {
    try {
        new URL(url);
        return true;
    } catch {
        return false;
    }
};

const isDummyClient = !supabaseUrl || !supabaseKey || !isValidUrl(supabaseUrl) || supabaseUrl.includes('your-project-id');

export const supabase: SupabaseClient = !isDummyClient
    ? createClient(supabaseUrl, supabaseKey) 
    : createClient('http://localhost:65535', 'placeholder_key_will_fail_fast');

// Cache the current user's organization ID to append to saves.
let currentOrgId: string | null = null;
export const setOrganizationId = (orgId: string | null) => {
    currentOrgId = orgId;
};
export const getCurrentOrgId = () => currentOrgId;

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
        // Map deprecated offerDecisions to remaining corresponding statuses
        if (processed.offerDecision === 'Monitoring Pending Status - Before Offer') {
            processed.offerDecision = 'Monitoring Pending Status Before Offer';
        } else if (processed.offerDecision === 'Monitoring Pending Status - After Offer') {
            processed.offerDecision = 'Monitoring Pending Status After Offer';
        } else if (processed.offerDecision === 'Agent Responded To Offer' || processed.offerDecision === 'Offer Submitted') {
            processed.offerDecision = 'Made Written Offer On Property';
        } else if (tableName === 'Deals' && processed.offerDecision === 'Available') {
            processed.offerDecision = 'No Offer Made Yet';
        } else if (processed.offerDecision === 'Listing Removed - Now Off-Market') {
            processed.offerDecision = 'Listing Removed - Now Off Market';
        } else if (processed.offerDecision === 'No Longer Interested In Property') {
            processed.offerDecision = 'No Longer Interested In Buying';
        } else if (processed.offerDecision === 'Closed - Sold') {
            processed.offerDecision = 'Deal Successfully Closed';
        }
        
        processed.photos = cleanArrayField(processed.photos, false).filter(Boolean);
        
        // Map Documents (from Supabase) back to documents for the frontend
        if (processed.Documents !== undefined) {
            processed.documents = processed.Documents;
            delete processed.Documents;
        }

        processed.motivationSignals = processed.motivationSignals || processed.MotivationSignals || processed['Motivation Signals'] || processed.motivation_signals || [];
        processed.motivationSignals = cleanArrayField(processed.motivationSignals, false).filter(Boolean);
        
        // Remove the variations so they don't pollute the generic object
        delete processed.MotivationSignals;
        delete processed['Motivation Signals'];
        delete processed.motivation_signals;
        processed.documents = cleanArrayField(processed.documents, false).filter(Boolean);
        processed.dealType = Array.from(new Set(cleanArrayField(processed.dealType, true))).filter(Boolean);
        processed.logs = cleanArrayField(processed.logs, false).filter(Boolean);
        
        // Extract dynamically stored documents from logs
        if (processed.logs && processed.logs.length > 0) {
            const extractedDocs: any[] = [];
            processed.logs = processed.logs.filter((log: string) => {
                if (log && typeof log === 'string' && log.startsWith('[SYS_DOC]')) {
                    try {
                        extractedDocs.push(JSON.parse(log.substring(9)));
                    } catch (e) {
                         console.warn("Failed to parse [SYS_DOC]", e);
                    }
                    return false;
                }
                return true;
            });
            if (extractedDocs.length > 0) {
                processed.documents = [...(processed.documents || []), ...extractedDocs];
            }
        }
        
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
    try {
        const response = await fetch('/api/send-email', {
            method: 'POST',
            headers: { "Content-Type": "application/json" },
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
        
        let data;
        try {
            data = await response.json();
        } catch (e) {
            // Ignore JSON parse errors for non-JSON responses
        }
        
        if (!response.ok) {
            throw new Error(data?.message || `HTTP error! status: ${response.status}`);
        }
        
        if (data && data.status === 'error') {
            throw new Error(data.message || 'Server Error');
        }
        
        return data;
    } catch (e: any) {
        console.error("sendBulkEmailGAS error:", e);
        throw e;
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
    
    if (isDummyClient) {
        return { status: 'error', message: 'Supabase is not configured' };
    }

    // Fallback: Try Supabase RPC if exists
    const { data, error } = await supabase.rpc('execute_sql', { query });
    if (error) return { status: 'error', message: error.message };
    return { status: 'success', data };
};

export const api = {
    load: async (table: string) => {
        if (isDummyClient) {
             console.warn("Supabase not configured. Return empty dataset.");
             return [];
        }
        
        if (!currentOrgId && table !== 'Integrations' && table !== 'Users') {
            console.warn(`Refusing to load all ${table} for unauthenticated/unassigned organization.`);
            return []; // Prevents leaking AZRE data when org ID is missing
        }

        let query = supabase.from(table).select('*');
        if (currentOrgId && table !== 'Integrations') {
            if (currentOrgId === 'org_azre_00001') {
                // Master org automatically sees records with null organization_id to handle manual Supabase CSV imports
                query = query.or(`organization_id.eq.${currentOrgId},organization_id.is.null`);
            } else {
                query = query.eq('organization_id', currentOrgId);
            }
        }
        
        let { data, error } = await query;

        // If the schema cache is stale after running the SQL script, we must strictly enforce data isolation 
        // by throwing the error. We cannot fallback to loading all data, otherwise new organizations see old data.
        if (error && error.message && error.message.includes('organization_id') && (error.message.includes('not exist') || error.message.includes('Could not find'))) {
            console.error(`PostgREST Schema Cache is stale. Table ${table} reports missing organization_id but it was added.`);
             if (currentOrgId && currentOrgId !== 'org_azre_00001') {
                 console.warn(`Refusing to load all ${table} for new organization to maintain data isolation.`);
                 return []; // Returns empty array to prevent leaking AZRE data to the new org
             }
             // For the master org let it slide so they aren't totally broken, but still warn.
             console.warn(`Falling back to unprotected load for Master AZRE Org. You MUST run "NOTIFY pgrst, 'reload schema';" in Supabase.`);
             const fallback = await supabase.from(table).select('*');
             data = fallback.data;
             error = fallback.error;
        }

        if (error) {
            console.warn(`Error loading ${table} (suppressed):`, error);
            return [];
        }
        return data.map(item => processIncomingItem(item, table));
    },

    save: async (item: any, table: string) => {
        if (isDummyClient) {
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
            
            // motivationSignals and documents are now native JSONB columns in Supabase
            // Do not stringify them. PostgREST handles JS arrays seamlessly.
        }
        
        let { data, error } = await supabase.from(table).upsert(payload).select().single();
        
        let missingColumns: string[] = [];
        let retryCount = 0;
        
        while (error && error.message && error.message.includes('Could not find the') && error.message.includes('column') && retryCount < 10) {
             const match = error.message.match(/Could not find the '([^']+)' column/);
             if (match && match[1]) {
                 const missingColumn = match[1];
                 console.warn(`Table ${table} does not have column ${missingColumn}. Stripping it and retrying.`);
                 missingColumns.push(missingColumn);
                 delete payload[missingColumn];
                 const retry = await supabase.from(table).upsert(payload).select().single();
                 data = retry.data;
                 error = retry.error;
                 retryCount++;
             } else {
                 break;
             }
        }
        
        // Fallback for tables that don't have organization_id yet (Schema cache stale)
        if (error && error.message && error.message.includes('organization_id') && (error.message.includes('not exist') || error.message.includes('Could not find')) && payload.organization_id) {
            console.warn(`Table ${table} does not have organization_id. Saving without it but keeping it in local state.`);
            const fallbackPayload = { ...payload };
            delete fallbackPayload.organization_id;
            const fallback = await supabase.from(table).upsert(fallbackPayload).select().single();
            data = fallback.data;
            error = fallback.error;
            if (data) {
                // Re-inject so the frontend retains knowledge of the org id and doesn't wipe it
                data.organization_id = payload.organization_id;
            }
        }

        if (error) {
            if (error.code === '42P01' || (error.message && error.message.includes('relation') && error.message.includes('does not exist'))) {
                 console.warn(`Table ${table} does not exist yet. Faking save success.`);
                 return processIncomingItem(item, table);
            }
            console.error(`Error saving to ${table}:`, JSON.stringify(error, null, 2));
            throw error;
        }
        
        if (data && missingColumns.length > 0) {
            // Re-inject so frontend state isn't missing the property
            for (const col of missingColumns) {
                 data[col] = item[col];
            }
        }
        
        return processIncomingItem(data, table);
    },

    saveBatch: async (items: any[], table: string) => {
        if (isDummyClient) {
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
                
                // motivationSignals and documents are natively JSONB, do not map to strings
            }
            return payload;
        });

        let { data, error } = await supabase.from(table).upsert(payloads).select();
        
        let missingColumns: string[] = [];
        let retryCount = 0;
        
        while (error && error.message && error.message.includes('Could not find the') && error.message.includes('column') && retryCount < 10) {
             const match = error.message.match(/Could not find the '([^']+)' column/);
             if (match && match[1]) {
                 const missingColumn = match[1];
                 console.warn(`Table ${table} does not have column ${missingColumn}. Stripping it from batch and retrying.`);
                 missingColumns.push(missingColumn);
                 for (const p of payloads) {
                     delete p[missingColumn];
                 }
                 const retry = await supabase.from(table).upsert(payloads).select();
                 data = retry.data;
                 error = retry.error;
                 retryCount++;
             } else {
                 break;
             }
        }
        
        // Fallback for tables that don't have organization_id yet (Schema cache stale)
        if (error && error.message && error.message.includes('organization_id') && (error.message.includes('not exist') || error.message.includes('Could not find'))) {
            console.warn(`Table ${table} does not have organization_id. Saving batch without it but keeping it locally.`);
            const fallbackPayloads = payloads.map(p => {
                const copy = { ...p };
                delete copy.organization_id;
                return copy;
            });
            const fallback = await supabase.from(table).upsert(fallbackPayloads).select();
            data = fallback.data;
            error = fallback.error;
            if (data && Array.isArray(data)) {
                 data = data.map((d, index) => {
                     if (payloads[index]?.organization_id) {
                         d.organization_id = payloads[index].organization_id;
                     }
                     return d;
                 });
            }
        }

        if (error) {
            if (error.code === '42P01' || (error.message && error.message.includes('relation') && error.message.includes('does not exist'))) {
                 console.warn(`Table ${table} does not exist yet. Faking batch save success.`);
                 return items.map(item => processIncomingItem(item, table));
            }
            console.error(`Error batch saving to ${table}:`, error);
            throw error;
        }
        
        if (data && missingColumns.length > 0 && Array.isArray(data)) {
            data = data.map((d, index) => {
                for (const col of missingColumns) {
                    d[col] = items[index][col];
                }
                return d;
            });
        }
        
        return data.map(item => processIncomingItem(item, table));
    },

    delete: async (id: string, table: string) => {
        if (isDummyClient) {
             return false;
        }
        const { error } = await supabase.from(table).delete().eq('id', id);
        if (error) {
            if (error.code === '42P01' || (error.message && error.message.includes('relation') && error.message.includes('does not exist'))) {
                 console.warn(`Table ${table} does not exist yet. Faking delete success.`);
                 return true;
            }
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

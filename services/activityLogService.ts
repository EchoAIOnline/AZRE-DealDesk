import { supabase, getCurrentOrgId } from './api';
import { ActivityLog, User } from '../types';

export const activityLogService = {
    /**
     * Log a new activity, with grouping for rapid consecutive updates
     */
    logActivity: async (
        user: User | null,
        actionType: string,
        entityType: string,
        entityId: string,
        description: string,
        metadata: any = {},
        entityDisplay?: string
    ) => {
        if (!user) return;

        const currentOrgId = getCurrentOrgId();

        // Grouping logic for UPDATE actions
        if (actionType === 'UPDATE') {
            // Check if there's a recent UPDATE log for this user and entity within the last 5 minutes
            const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
            
            let query = supabase
                .from('activity_logs')
                .select('*')
                .eq('user_id', user.id)
                .eq('action_type', 'UPDATE')
                .eq('entity_type', entityType)
                .eq('entity_id', entityId)
                .gte('created_at', fiveMinutesAgo);
                
            if (currentOrgId) {
                query = query.eq('organization_id', currentOrgId);
            }
                
            const { data: recentLogs, error: fetchError } = await query.order('created_at', { ascending: false }).limit(1);

            if (!fetchError && recentLogs && recentLogs.length > 0) {
                const recentLog = recentLogs[0];
                
                // Merge metadata
                const mergedMetadata = {
                    ...recentLog.metadata,
                    ...metadata
                };

                // Generate a new description based on merged metadata fields
                const changedFields = Object.keys(mergedMetadata);
                let newDescription = description;
                if (changedFields.length > 0) {
                    const fieldsText = changedFields.join(', ');
                    newDescription = `Updated ${fieldsText} on ${entityDisplay || entityType}`;
                }

                // Update the existing log instead of creating a new one
                const { error: updateError } = await supabase
                    .from('activity_logs')
                    .update({
                        description: newDescription,
                        metadata: mergedMetadata,
                        created_at: new Date().toISOString() // refresh the timestamp
                    })
                    .eq('id', recentLog.id);

                if (!updateError) return; // Successfully grouped
            }
        }

        const logEntry: any = {
            user_id: user.id,
            user_name: user.name,
            action_type: actionType,
            entity_type: entityType,
            entity_id: entityId,
            entity_display: entityDisplay || '',
            description: description,
            metadata: metadata,
            created_at: new Date().toISOString()
        };
        
        if (currentOrgId) {
            logEntry.organization_id = currentOrgId;
        }

        const { error } = await supabase.from('activity_logs').insert(logEntry);
        
        if (error) {
            console.error('Error logging activity:', error);
        }
    },

    /**
     * Get recent activities
     */
    getRecentActivity: async (limit: number = 20): Promise<ActivityLog[]> => {
        const currentOrgId = getCurrentOrgId();
        let query = supabase
            .from('activity_logs')
            .select('*');
            
        if (currentOrgId) {
            query = query.eq('organization_id', currentOrgId);
        }
            
        const { data, error } = await query
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) {
            console.warn('Error fetching activity logs (suppressed):', error);
            return [];
        }

        return data as ActivityLog[];
    },

    getLogsByActionType: async (actionType: string): Promise<ActivityLog[]> => {
        const currentOrgId = getCurrentOrgId();
        let query = supabase
            .from('activity_logs')
            .select('*')
            .eq('action_type', actionType);
            
        if (currentOrgId) {
            query = query.eq('organization_id', currentOrgId);
        }
            
        const { data, error } = await query
            .order('created_at', { ascending: false });

        if (error) {
            console.warn('Error fetching activity logs by action type (suppressed):', error);
            return [];
        }

        return data as ActivityLog[];
    },

    getAgentTextLogs: async (): Promise<ActivityLog[]> => {
        const currentOrgId = getCurrentOrgId();
        let query = supabase
            .from('activity_logs')
            .select('*')
            .eq('action_type', 'UPDATE')
            .eq('entity_type', 'AGENT');
            
        if (currentOrgId) {
            query = query.eq('organization_id', currentOrgId);
        }
            
        const { data, error } = await query
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching agent text logs:', error);
            return [];
        }

        // Filter logs where sentTextToAgent is present in metadata
        const textLogs = (data as ActivityLog[]).filter(log => 
            log.metadata && log.metadata.sentTextToAgent === true
        );

        return textLogs;
    }
};

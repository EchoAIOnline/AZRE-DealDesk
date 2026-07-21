import { supabase } from './services/api';

async function fixNames() {
    console.log("Fetching agents...");
    const { data: agents, error } = await supabase.from('Agents').select('id, name, agentFirstName, agentLastName');
    if (error) {
        console.error("Error fetching agents:", error);
        return;
    }
    
    let updated = 0;
    for (const agent of agents) {
        if (agent.agentFirstName || agent.agentLastName) {
            const newName = [agent.agentFirstName, agent.agentLastName].filter(Boolean).join(' ').trim();
            if (newName && newName !== agent.name) {
                console.log(`Updating ${agent.name} to ${newName}`);
                const { error: updateError } = await supabase.from('Agents').update({ name: newName }).eq('id', agent.id);
                if (updateError) {
                    console.error(`Error updating agent ${agent.id}:`, updateError);
                } else {
                    updated++;
                }
            }
        }
    }
    
    console.log(`Updated ${updated} agents.`);
}

fixNames();

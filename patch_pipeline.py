import re

with open('components/Pipeline/PipelineView.tsx', 'r') as f:
    content = f.read()

bad_string = """        for (const dealId of selectedDealIds) {
            // Update each deal to mark LOI as sent. We update contactStatus to match standard flow
            updateDeal(dealId, { contactStatus: 'Sent LOI Email', offerDecision: 'Made Written Offer On Property', loiSent: true, loiSentDate: new Date().toISOString() });
            sentCount++;
            setBlastProgress(sentCount);
            // Simulate network/email sending delay
            await new Promise(res => setTimeout(res, 600));
        }"""

good_string = """        for (const dealId of selectedDealIds) {
            // Update each deal to mark LOI as sent. We update contactStatus to match standard flow
            updateDeal(dealId, { contactStatus: 'Sent LOI Email', offerDecision: 'Made Written Offer On Property', loiSent: true, loiSentDate: new Date().toISOString() });
            
            const deal = orderedDeals.find(d => d.id === dealId);
            if (deal && deal.agentName) {
                const agent = agents.find(a => a.name === deal.agentName);
                if (agent) {
                    api.save({ ...agent, loiSent: true, loiSentDate: new Date().toISOString() }, 'Agents').then((savedAgent: any) => {
                        if(savedAgent) setAgents((prev: any) => prev.map((a: any) => a.id === agent.id ? savedAgent : a));
                    });
                }
            }

            sentCount++;
            setBlastProgress(sentCount);
            // Simulate network/email sending delay
            await new Promise(res => setTimeout(res, 600));
        }"""

content = content.replace(bad_string, good_string)

with open('components/Pipeline/PipelineView.tsx', 'w') as f:
    f.write(content)
